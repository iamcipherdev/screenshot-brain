// ─── OCR service — accurate on-device text recognition ────────────────────
// Priority: native ML Kit (Android, offline, best for screenshots)
// Fallback: Gemini vision transcription (needs key, online)
// If neither: mark shot ocrStatus='unavailable' — search still uses AI meta.

import { nativeOcr, isNative } from './native';
import { blobToBase64, downscale } from './images';
import { geminiTranscribe } from './gemini';
import type { Shot } from '../types';
import { blobsFor } from './repo';

export type OcrProvider = 'mlkit' | 'gemini' | 'none';

export interface OcrOutcome {
  text: string;
  provider: OcrProvider;
}

export function ocrAvailable(hasKey: boolean): OcrProvider {
  if (isNative) return 'mlkit';
  if (hasKey) return 'gemini';
  return 'none';
}

/**
 * Run OCR for a shot.
 * For ML Kit we feed a clean 1600px JPEG — large enough that small UI text
 * stays crisp, which is the #1 factor for accurate screenshot OCR.
 */
export async function runOcr(shot: Shot, geminiKey: string): Promise<OcrOutcome> {
  const rec = await blobsFor(shot.id);
  if (!rec) return { text: '', provider: 'none' };

  if (isNative) {
    // ML Kit path — prepare a sharp, well-sized image first.
    const ocrSized = await downscale(rec.full, 1600, 0.92);
    const b64 = await blobToBase64(ocrSized);
    const text = await nativeOcr(b64);
    if (text && text.trim().length > 0) {
      return { text: text.trim(), provider: 'mlkit' };
    }
    // ML Kit ran but found nothing — that is a real result (meme/blank image).
    return { text: '', provider: 'mlkit' };
  }

  if (geminiKey.trim()) {
    try {
      const vision = await downscale(rec.full, 1280, 0.9);
      const b64 = await blobToBase64(vision);
      const text = await geminiTranscribe('gemini-2.0-flash-lite', geminiKey.trim(), b64);
      return { text, provider: 'gemini' };
    } catch {
      return { text: '', provider: 'none' };
    }
  }

  return { text: '', provider: 'none' };
}
