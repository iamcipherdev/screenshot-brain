// ─── Import sheet: pick from gallery, scan folder, share hint ─────────────

import React, { useRef, useState } from 'react';
import { Sheet, ProgressBar } from './Ui';
import { Icon } from './Icon';
import { useApp } from '../state/store';
import { pipeline } from '../lib/pipeline';
import { isNative, nativeRequestMediaPermission, nativeHasMediaPermission } from '../lib/native';
import { haptic } from '../lib/haptics';

export function ImportSheet({ onClose }: { onClose: () => void }) {
  const { refresh, toast, online, settings } = useApp();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [scanned, setScanned] = useState<{ done: number; total: number } | null>(null);

  const importCount = (n: number) => {
    if (n > 0) toast(`Importing ${n} screenshot${n === 1 ? '' : 's'} — you can keep using the app`);
    else toast('No new screenshots found', 'warn');
  };

  const onPick = async (files: FileList | null) => {
    if (!files || !files.length) return;
    const arr = Array.from(files);
    setBusy(`Reading ${arr.length} image${arr.length === 1 ? '' : 's'}…`);
    try {
      const n = await pipeline.importFiles(arr);
      importCount(n);
      await refresh();
    } catch {
      toast('Import failed — could not read those images', 'err');
    } finally {
      setBusy(null);
      onClose();
    }
  };

  const onScan = async () => {
    void haptic();
    if (!isNative) {
      toast('Folder scanning works in the Android app — use Pick instead here', 'warn');
      return;
    }
    let granted = await nativeHasMediaPermission();
    if (!granted) {
      const r = await nativeRequestMediaPermission();
      granted = r.granted || r.limited;
      if (!granted) {
        toast('Permission needed to read your Screenshots folder', 'warn');
        return;
      }
    }
    setBusy('Scanning your Screenshots folder…');
    setScanned({ done: 0, total: 0 });
    try {
      const n = await pipeline.importFromScan((done, total) => setScanned({ done, total }));
      importCount(n);
      await refresh();
    } catch {
      toast('Scan failed', 'err');
    } finally {
      setBusy(null);
      setScanned(null);
      onClose();
    }
  };

  const aiOn = Boolean(settings.geminiKey.trim());

  return (
    <Sheet title="Add screenshots" onClose={onClose}>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => { void onPick(e.target.files); e.target.value = ''; }}
      />

      <button className="import-row" onClick={() => { void haptic(); fileRef.current?.click(); }}>
        <span className="import-ico"><Icon name="images" size={21} /></span>
        <span className="import-txt">
          <b>Pick from gallery</b>
          <i>Select one or many screenshots</i>
        </span>
        <Icon name="chevronRight" size={17} className="import-go" />
      </button>

      <button className="import-row" onClick={() => void onScan()}>
        <span className="import-ico"><Icon name="scan" size={21} /></span>
        <span className="import-txt">
          <b>Scan Screenshots folder</b>
          <i>Find every screenshot already on this phone</i>
        </span>
        <Icon name="chevronRight" size={17} className="import-go" />
      </button>

      {scanned && (
        <div className="scan-progress">
          <ProgressBar done={scanned.done} total={scanned.total} />
          <span>Copied {scanned.done} of {scanned.total}</span>
        </div>
      )}

      <div className="import-note">
        <Icon name="share" size={15} />
        <span>
          Tip: in any gallery app, tap <b>Share → Screenshot Brain</b> to send screenshots here without leaving the app.
        </span>
      </div>

      <div className="import-note import-note-soft">
        <Icon name={online && aiOn ? 'sparkles' : 'info'} size={15} />
        <span>
          {aiOn
            ? online
              ? 'After import, text is read on-device, then AI adds titles, tags and value scores.'
              : 'You are offline — text is still read on-device. AI titles will wait until you are back online.'
            : 'Text is read on-device. Add a Gemini key in Settings to get AI titles, tags and cleanup reasons.'}
        </span>
      </div>

      {busy && (
        <div className="import-busy">
          <span className="spinner" />
          <span>{busy}</span>
        </div>
      )}
    </Sheet>
  );
}
