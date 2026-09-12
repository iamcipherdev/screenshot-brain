// ─── Import + indexing pipeline ───────────────────────────────────────────
// Per shot: thumbnails → perceptual hash → duplicate check → OCR → AI → value
// Runs in the background, never blocks the UI, reports progress events.

import type { Shot } from '../types';
import type { MediaMeta } from './native';
import { createShot, updateShot, listShots, saveSettings, loadSettings } from './repo';
import { processImage, blobToBase64, downscale } from './images';
import { runOcr, ocrAvailable } from './ocr';
import { analyzeScreenshot } from './gemini';
import { scoreShot } from './value';
import { findDuplicateOf } from './dup';
import { loadNativeImage, scanScreenshotsFolder, takeSharedFile, isNative, nativeToast } from './native';
import { blobsFor, updateAiMeta } from './repo';

export interface PipelineState {
  running: boolean;
  done: number;
  total: number;
  stage: string;        // e.g. "Reading image", "OCR", "AI analysis"
  lastError?: string;
}

type Listener = (state: PipelineState) => void;

class Emitter {
  private listeners = new Set<Listener>();
  on(l: Listener): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }
  emit(state: PipelineState): void {
    for (const l of [...this.listeners]) {
      try { l(state); } catch { /* noop */ }
    }
  }
}

class Pipeline extends Emitter {
  private queue: Shot[] = [];
  private _state: PipelineState = { running: false, done: 0, total: 0, stage: '' };

  get state(): PipelineState { return { ...this._state }; }

  private setState(patch: Partial<PipelineState>): void {
    this._state = { ...this._state, ...patch };
    this.emit(this.state);
  }

  /** Import picked files (gallery / file picker). */
  async importFiles(files: File[]): Promise<number> {
    const fresh: Shot[] = [];
    for (const file of files) {
      if (!file.type.startsWith('image/')) continue;
      try {
        const proc = await processImage(file);
        const shot = await createShot(
          {
            createdAt: file.lastModified || Date.now(),
            fileName: file.name || 'screenshot.jpg',
            width: proc.width,
            height: proc.height,
            bytes: file.size,
            source: 'pick',
          },
          { thumb: proc.thumb, full: proc.full },
        );
        await updateShot(shot.id, { hash: proc.hash, quality: proc.quality });
        fresh.push({ ...shot, hash: proc.hash });
      } catch {
        // skip unreadable file
      }
    }
    this.enqueue(fresh, files.length);
    return fresh.length;
  }

  /** Import from the Android Screenshots folder via MediaStore. */
  async importFromScan(onProgress?: (n: number, total: number) => void): Promise<number> {
    if (!isNative) return 0;
    const known = (await listShots())
      .filter((s) => s.source === 'scan')
      .map((s) => s.fileName);
    const knownSet = new Set(known);
    const items: MediaMeta[] = await scanScreenshotsFolder();
    const freshItems = items.filter((i) => !knownSet.has(i.fileName));
    let n = 0;
    const fresh: Shot[] = [];
    for (const item of freshItems) {
      try {
        const { blob } = await loadNativeImage(item.uri, 2048);
        if (!blob) continue;
        const proc = await processImage(blob);
        const shot = await createShot(
          {
            createdAt: item.dateTaken || Date.now(),
            fileName: item.fileName,
            width: proc.width,
            height: proc.height,
            bytes: item.size,
            source: 'scan',
          },
          { thumb: proc.thumb, full: proc.full },
        );
        await updateShot(shot.id, { hash: proc.hash, quality: proc.quality });
        fresh.push({ ...shot, hash: proc.hash });
        n++;
        onProgress?.(n, freshItems.length);
      } catch {
        // skip
      }
    }
    this.enqueue(fresh, n);
    return n;
  }

  /** Consume files that arrived via Android share intent. */
  async importShared(): Promise<number> {
    if (!isNative) return 0;
    let n = 0;
    const fresh: Shot[] = [];
    for (let guard = 0; guard < 40; guard++) {
      const item = await takeSharedFile();
      if (!item.found || !item.blob) break;
      try {
        const proc = await processImage(item.blob);
        const shot = await createShot(
          {
            createdAt: item.dateTaken || Date.now(),
            fileName: item.fileName || `shared-${Date.now()}.jpg`,
            width: proc.width,
            height: proc.height,
            bytes: item.blob.size,
            source: 'share',
          },
          { thumb: proc.thumb, full: proc.full },
        );
        await updateShot(shot.id, { hash: proc.hash, quality: proc.quality });
        fresh.push({ ...shot, hash: proc.hash });
        n++;
      } catch { /* skip */ }
    }
    if (n > 0) {
      this.enqueue(fresh, n);
      nativeToast(`Shared ${n} screenshot${n === 1 ? '' : 's'} imported`);
    }
    return n;
  }

  /** Queue shots for background OCR + AI + value + dup processing. */
  enqueue(shots: Shot[], totalImported?: number): void {
    this.queue.push(...shots);
    const total = totalImported ?? this.queue.length;
    if (!this._state.running) {
      this.setState({ running: true, done: 0, total, stage: 'Starting…' });
      void this.run();
    } else {
      this.setState({ total: this._state.total + total });
    }
  }

  private async run(): Promise<void> {
    let errors = 0;
    const library = await listShots();
    while (this.queue.length) {
      const shot = this.queue.shift()!;
      try {
        await this.processOne(shot, library);
      } catch {
        errors++;
      }
      this.setState({
        done: this._state.done + 1,
        stage: this._state.done === 0 ? 'OCR + AI' : `Indexed ${this._state.done + 1} of ${this._state.total}`,
      });
    }
    this.setState({ running: false, stage: errors ? `Finished with ${errors} issue(s)` : 'All caught up' });
  }

  private async processOne(shot: Shot, library: Shot[]): Promise<void> {
    const settings = await loadSettings();
    const key = settings.geminiKey.trim();

    // 1) OCR
    let updated: Shot = shot;
    if (shot.ocrStatus === 'pending' || shot.ocrStatus === 'failed') {
      this.setState({ stage: 'Reading text (OCR)…' });
      const { text, provider } = await runOcr(shot, key);
      updated = await updateShot(shot.id, {
        ocr: text,
        ocrStatus: provider === 'none' ? 'unavailable' : 'done',
      }) ?? shot;
    }

    // 2) Duplicate check (hash-based, oldest wins as keeper)
    if (!updated.dupOf && updated.hash) {
      const dupOf = findDuplicateOf(updated, library);
      if (dupOf) {
        updated = await updateShot(updated.id, {
          dupOf,
          value: 'duplicate',
          valueReason: 'Very similar to a screenshot you already have — keep the better one',
        }) ?? updated;
      }
    }

    // 3) AI analysis (only when a key exists; never for AI-excluded shots)
    if (key && (updated.aiStatus === 'pending' || updated.aiStatus === 'failed' || updated.aiStatus === 'skipped')) {
      if (updated.aiExcluded) {
        updated = await updateShot(updated.id, { aiStatus: 'skipped' }) ?? updated;
      } else {
        try {
          this.setState({ stage: 'AI analysis…' });
          const rec = await blobsFor(updated.id);
          if (rec) {
            const small = await downscale(rec.full, 1024, 0.85);
            const b64 = await blobToBase64(small);
            const { ai, value, valueReason } = await analyzeScreenshot(settings.model, key, b64, updated.ocr ?? '');
            updated = await updateAiMeta(updated.id, ai, value, valueReason) ?? updated;
          } else {
            updated = await updateShot(updated.id, { aiStatus: 'failed' }) ?? updated;
          }
        } catch {
          updated = await updateShot(updated.id, { aiStatus: 'failed' }) ?? updated;
        }
      }
    }

    // 4) Value scoring (rules fill gaps; AI result wins)
    if (!updated.ai || updated.aiStatus !== 'done') {
      const { value, reason } = scoreShot(updated);
      const finalValue = updated.dupOf ? 'duplicate' : value;
      updated = await updateShot(updated.id, {
        value: finalValue,
        valueReason: updated.dupOf ? 'Very similar to a screenshot you already have' : reason,
      }) ?? updated;
    }

    // 5) keep in-memory library fresh for next dup checks
    const idx = library.findIndex((s) => s.id === updated.id);
    if (idx >= 0) library[idx] = updated; else library.push(updated);
  }

  /** Re-run AI for shots that were imported before a key was set. */
  async reprocessWithAi(): Promise<void> {
    const settings = await loadSettings();
    if (!settings.geminiKey.trim()) return;
    const shots = (await listShots()).filter((s) => s.aiStatus !== 'done');
    if (!shots.length) return;
    this.queue.push(...shots);
    if (!this._state.running) {
      this.setState({ running: true, done: 0, total: shots.length, stage: 'AI analysis…' });
      void this.run();
    } else {
      this.setState({ total: this._state.total + shots.length });
    }
  }

  /** Re-run OCR for shots that never got text (e.g. web preview → now native). */
  async reprocessOcr(): Promise<void> {
    const shots = (await listShots()).filter((s) => s.ocrStatus === 'unavailable' || s.ocrStatus === 'none');
    for (const s of shots) await updateShot(s.id, { ocrStatus: 'pending' });
    if (shots.length) this.enqueue(shots, shots.length);
  }
}

export const pipeline = new Pipeline();
export { saveSettings, ocrAvailable };
