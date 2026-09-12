// ─── Settings: Gemini, security/lock, trash, privacy model, data, about ───

import React, { useEffect, useState } from 'react';
import { useApp } from '../state/store';
import { Icon } from '../components/Icon';
import { useConfirm, ConfirmDialog } from '../components/Ui';
import { hashPin, biometricAvailable } from '../components/Lock';
import { testKey, SUGGESTED_MODELS } from '../lib/gemini';
import { isNative } from '../lib/native';
import { loadDemoData, DEMO_NOTE } from '../lib/demo';
import { pipeline, ocrAvailable } from '../lib/pipeline';
import { listTrash, restoreShots, purgeTrash, trashCount } from '../lib/repo';
import { haptic } from '../lib/haptics';
import { relTime, fmtBytes } from '../lib/util';
import type { Shot } from '../types';

export const APP_VERSION = '1.1.0';

export function Settings() {
  const { settings, updateSettings, navigate, goTab, back, refresh, toast, wipe, online, removeCollection } = useApp();
  const { spec, ask, close } = useConfirm();
  const [keyInput, setKeyInput] = useState(settings.geminiKey);
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [savingKey, setSavingKey] = useState(false);

  // security
  const [pinA, setPinA] = useState('');
  const [pinB, setPinB] = useState('');
  const [settingPin, setSettingPin] = useState(false);
  const [bioOk, setBioOk] = useState(false);

  // trash
  const [trash, setTrash] = useState<Shot[] | null>(null);

  const ocrProvider = ocrAvailable(Boolean(settings.geminiKey.trim()));

  useEffect(() => {
    if (isNative) void biometricAvailable().then(setBioOk);
  }, []);

  const saveKey = async () => {
    setSavingKey(true);
    await updateSettings({ geminiKey: keyInput.trim() });
    setSavingKey(false);
    setTestResult(null);
    toast(keyInput.trim() ? 'API key saved on this device' : 'API key cleared');
  };

  const runTest = async () => {
    setTesting(true);
    setTestResult(null);
    const keyToTest = keyInput.trim();
    if (keyToTest !== settings.geminiKey.trim()) {
      await updateSettings({ geminiKey: keyToTest });
    }
    const r = await testKey(keyToTest);
    setTestResult(r);
    setTesting(false);
    void haptic(r.ok ? 'light' : 'medium');
  };

  const doWipe = () => {
    ask({
      title: 'Delete everything?',
      danger: true,
      confirmLabel: 'Delete all data',
      body: <p>All screenshots, text, AI data, collections, chats and your API key will be removed from this device. Gallery originals are never touched. This cannot be undone.</p>,
      onConfirm: async () => {
        await wipe();
        setKeyInput('');
        toast('All app data deleted');
      },
    });
  };

  const doDemo = async () => {
    const r = await loadDemoData();
    await refresh();
    toast(`Loaded ${r.shots} demo screenshots — ${DEMO_NOTE}`);
  };

  const reRunOcr = async () => {
    await pipeline.reprocessOcr();
    toast('Re-running text recognition for shots without text');
  };

  const reRunAi = async () => {
    if (!settings.geminiKey.trim()) { toast('Add a key first', 'warn'); return; }
    await pipeline.reprocessWithAi();
    toast('AI analysis queued for shots without AI data');
  };

  const savePin = async () => {
    if (!/^\d{4}$/.test(pinA)) { toast('PIN must be exactly 4 digits', 'warn'); return; }
    if (pinA !== pinB) { toast('PINs do not match', 'warn'); return; }
    const h = await hashPin(pinA);
    await updateSettings({ appLock: true, lockPin: h });
    setPinA(''); setPinB(''); setSettingPin(false);
    toast('App lock enabled — 4-digit PIN set');
  };

  const toggleLock = async (on: boolean) => {
    if (on && !settings.lockPin) { setSettingPin(true); return; }
    await updateSettings({ appLock: on });
  };

  const openTrash = async () => {
    const t = await listTrash();
    setTrash(t);
  };

  const purgeAll = () => {
    if (!trash?.length) return;
    ask({
      title: `Permanently delete ${trash.length}?`,
      danger: true,
      confirmLabel: 'Delete forever',
      body: <p>These {trash.length} screenshots will be permanently removed from Screenshot Brain. This cannot be undone. <b>Your phone gallery is never touched.</b></p>,
      onConfirm: async () => {
        await purgeTrash();
        setTrash([]);
        await refresh();
        toast('Trash emptied');
      },
    });
  };

  const autoPurgeOld = async () => {
    const n = await purgeTrash(30 * 86400000);
    if (n > 0) {
      setTrash(await listTrash());
      await refresh();
      toast(`Removed ${n} item${n === 1 ? '' : 's'} older than 30 days`);
    } else {
      toast('Nothing older than 30 days');
    }
  };

  return (
    <div className="screen settings">
      <header className="topbar topbar-back">
        <button className="iconbtn" onClick={() => { if (!back()) goTab('home'); }} aria-label="Back"><Icon name="chevronLeft" /></button>
        <div className="topbar-title"><h1>Settings</h1><p>{online ? 'Online' : 'Offline — AI paused, everything else works'}</p></div>
      </header>

      {/* Gemini ---------------------------------------------------------- */}
      <section className="set-section">
        <span className="eyebrow">Gemini AI</span>
        <p className="set-lede">
          Paste a free API key from <b>Google AI Studio</b> (aistudio.google.com/apikey). It is stored only on this phone and used only when you import or ask something.
        </p>
        <div className="keyrow">
          <div className="keyfield">
            <input
              type={showKey ? 'text' : 'password'}
              value={keyInput}
              onChange={(e) => { setKeyInput(e.target.value); setTestResult(null); }}
              placeholder="AIza…"
              autoComplete="off"
              spellCheck={false}
            />
            <button className="iconbtn" onClick={() => setShowKey(!showKey)} aria-label="Show key">
              <Icon name={showKey ? 'eye' : 'key'} size={17} />
            </button>
          </div>
        </div>
        <div className="keyactions">
          <button className="btn btn-ghost btn-sm" onClick={() => void runTest()} disabled={testing || !keyInput.trim() || !online}>
            {testing ? 'Testing…' : 'Test API key'}
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => void saveKey()} disabled={savingKey || keyInput.trim() === settings.geminiKey}>
            {savingKey ? 'Saving…' : 'Save key'}
          </button>
          {settings.geminiKey && (
            <button className="btn btn-ghost btn-sm" onClick={() => { setKeyInput(''); void updateSettings({ geminiKey: '' }); setTestResult(null); }}>
              Remove
            </button>
          )}
        </div>
        {testResult && (
          <div className={`test-result ${testResult.ok ? 'tr-ok' : 'tr-bad'}`}>
            <Icon name={testResult.ok ? 'check' : 'alert'} size={14} />
            <span>{testResult.message}</span>
          </div>
        )}

        <label className="set-label" htmlFor="model">Model</label>
        <select id="model" className="set-select" value={settings.model} onChange={(e) => void updateSettings({ model: e.target.value })}>
          {SUGGESTED_MODELS.map((m) => <option key={m} value={m}>{m}</option>)}
          {!SUGGESTED_MODELS.includes(settings.model) && <option value={settings.model}>{settings.model}</option>}
        </select>
        <p className="set-hint">Flash models are fast and have generous free quotas. If one hits its limit, switch to the -lite version.</p>
      </section>

      {/* What works without a key ---------------------------------------- */}
      <section className="set-section">
        <span className="eyebrow">Without a key</span>
        <div className="status-rows">
          <StatusRow ok label="Offline OCR" detail={ocrProvider === 'mlkit' ? 'ML Kit on-device (most accurate, works offline)' : ocrProvider === 'gemini' ? 'Gemini vision fallback (online)' : 'Add a key or use the Android app for on-device OCR'} />
          <StatusRow ok label="Search & browse" detail="All text, tags, dates, prices and file names" />
          <StatusRow ok label="Collections & timeline" detail="Fully functional offline" />
          <StatusRow ok={Boolean(settings.geminiKey)} label="AI titles, tags & cleanup reasons" detail={settings.geminiKey ? 'Enabled' : 'Needs a Gemini key'} />
          <StatusRow ok={Boolean(settings.geminiKey)} label="Ask Screenshot Brain" detail={settings.geminiKey ? 'Chat about your screenshots — or anything' : 'Needs a Gemini key'} />
        </div>
      </section>

      {/* Security --------------------------------------------------------- */}
      <section className="set-section">
        <span className="eyebrow">Security</span>
        <div className="toggle-row">
          <span className="toggle-main"><b>App lock</b><i>Ask for unlock when the app starts</i></span>
          <button
            className={`switch ${settings.appLock ? 'on' : ''}`}
            role="switch" aria-checked={settings.appLock} aria-label="App lock"
            onClick={() => void toggleLock(!settings.appLock)}
          ><span className="knob" /></button>
        </div>
        {(settings.appLock || settingPin) && (
          <div className="pin-setup">
            <div className="pin-inputs">
              <input inputMode="numeric" maxLength={4} value={pinA} onChange={(e) => setPinA(e.target.value.replace(/\D/g, ''))} placeholder="PIN" aria-label="New PIN" autoComplete="off" />
              <input inputMode="numeric" maxLength={4} value={pinB} onChange={(e) => setPinB(e.target.value.replace(/\D/g, ''))} placeholder="Repeat" aria-label="Repeat PIN" autoComplete="off" />
            </div>
            <div className="pin-actions">
              <button className="btn btn-primary btn-sm" onClick={() => void savePin()} disabled={!pinA || !pinB}>Save PIN</button>
              {settings.lockPin && (
                <button className="btn btn-ghost btn-sm" onClick={() => { void updateSettings({ appLock: false, lockPin: '' }); setSettingPin(false); setPinA(''); setPinB(''); }}>
                  Remove lock
                </button>
              )}
            </div>
            <p className="set-hint">4 digits. Stored as a SHA-256 hash on this device only — it guards casual access, not a determined attacker.</p>
          </div>
        )}
        {isNative && settings.appLock && (
          <div className="toggle-row">
            <span className="toggle-main"><b>Fingerprint / face unlock</b><i>{bioOk ? 'Available on this device' : 'Not available on this device'}</i></span>
            <button
              className={`switch ${settings.biometric ? 'on' : ''} ${!bioOk ? 'disabled' : ''}`}
              role="switch" aria-checked={settings.biometric} aria-label="Biometric unlock" aria-disabled={!bioOk}
              onClick={() => bioOk && void updateSettings({ biometric: !settings.biometric })}
            ><span className="knob" /></button>
          </div>
        )}
        <p className="set-hint">Individual screenshots can be blurred in lists — open one and choose <b>Protect (blur)</b>. You can also exclude any screenshot from cloud AI entirely.</p>
      </section>

      {/* Trash ------------------------------------------------------------ */}
      <section className="set-section">
        <span className="eyebrow">Trash</span>
        <div className="trash-row">
          <button className="btn btn-ghost btn-sm" onClick={() => void openTrash()}>
            <Icon name="trash" size={14} /> View trash{trash ? ` (${trash.length})` : ''}
          </button>
          {trash && trash.length > 0 && (
            <>
              <button className="btn btn-ghost btn-sm" onClick={() => void autoPurgeOld()}>Purge &gt; 30 days</button>
              <button className="btn btn-danger-ghost btn-sm" onClick={purgeAll}>Empty trash</button>
            </>
          )}
        </div>
        {trash && (
          <div className="trash-list">
            {trash.length === 0 && <p className="muted-line">Trash is empty. Deleted screenshots rest here until you empty it (auto-purge after 30 days).</p>}
            {trash.map((s) => (
              <div key={s.id} className="row">
                <span className="row-main">
                  <b>{s.ai?.title ?? s.fileName}</b>
                  <i>deleted {relTime(s.deletedAt ?? Date.now())} · {fmtBytes(s.bytes)}</i>
                </span>
                <button className="btn btn-ghost btn-sm" onClick={async () => { await restoreShots([s.id]); setTrash(await listTrash()); await refresh(); toast('Restored'); }}>Restore</button>
                <button
                  className="btn btn-danger-ghost btn-sm"
                  onClick={() => ask({
                    title: 'Delete forever?',
                    danger: true,
                    confirmLabel: 'Delete forever',
                    body: <p>“{s.ai?.title ?? s.fileName}” will be permanently removed from the app. Your gallery is not touched.</p>,
                    onConfirm: async () => { await purgeTrash(); setTrash(await listTrash()); await refresh(); },
                  })}
                >Delete</button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Appearance -------------------------------------------------------- */}
      <section className="set-section">
        <span className="eyebrow">Appearance</span>
        <div className="theme-row">
          {(['system', 'light', 'dark'] as const).map((t) => (
            <button key={t} className={`themebtn ${settings.theme === t ? 'on' : ''}`} onClick={() => void updateSettings({ theme: t })}>
              <Icon name={t === 'dark' ? 'moon' : t === 'light' ? 'sun' : 'settings'} size={15} />
              {t[0].toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </section>

      {/* Developer -------------------------------------------------------- */}
      <section className="set-section">
        <span className="eyebrow">Developer</span>
        <div className="dev-row">
          <button className="btn btn-ghost btn-sm" onClick={() => void doDemo()}>Load demo data</button>
          <button className="btn btn-ghost btn-sm" onClick={() => void reRunOcr()}>Re-run OCR</button>
          <button className="btn btn-ghost btn-sm" onClick={() => void reRunAi()}>Re-run AI</button>
        </div>
        <p className="set-hint">Demo data draws 7 fake screenshots locally so you can explore the app safely. Re-run buttons rebuild indexes after installing the app or adding a key.</p>
        {!isNative && <p className="set-hint">⚠ Web preview: on-device OCR needs the Android app. In the installed APK, ML Kit reads text offline with high accuracy.</p>}
      </section>

      {/* Privacy ----------------------------------------------------------- */}
      <section className="set-section">
        <span className="eyebrow">Privacy — what runs where</span>
        <div className="privacy-cols">
          <div className="privacy-col">
            <span className="privacy-col-head"><Icon name="shield" size={14} /> On your device only</span>
            <ul>
              <li>Screenshot copies, OCR text and the search index</li>
              <li>OCR — ML Kit runs fully offline</li>
              <li>Duplicate & blur analysis</li>
              <li>Collections, tags and value scoring (rules)</li>
              <li>Your Gemini key (local storage) and PIN (hashed)</li>
            </ul>
          </div>
          <div className="privacy-col privacy-col-cloud">
            <span className="privacy-col-head"><Icon name="key" size={14} /> Sent to Google Gemini</span>
            <ul>
              <li>AI titles, summaries, tags & entities — a downscaled copy of a screenshot goes only when you import while a key is set</li>
              <li>Ask Brain — your question plus text excerpts of relevant screenshots (no full images)</li>
              <li>Nothing is sent without a key, and you can exclude any screenshot from AI</li>
              <li>Requests use your own key and quota; the app has no server of its own</li>
            </ul>
          </div>
        </div>
        <ul className="privacy-list">
          <li><Icon name="shield" size={14} /><span><b>Screenshots stay on your phone.</b> The app keeps its own local copies so search works offline; it never syncs or uploads your library anywhere.</span></li>
          <li><Icon name="trash" size={14} /><span><b>Deletion is always yours.</b> Cleanup only suggests, with reasons. Deletes go to Trash with Undo; permanent deletion needs an extra confirmation.</span></li>
        </ul>
      </section>

      {/* Danger ------------------------------------------------------------ */}
      <section className="set-section">
        <span className="eyebrow">Data</span>
        <button className="btn btn-danger-ghost" onClick={doWipe}><Icon name="trash" size={15} /> Delete all app data</button>
      </section>

      {/* About -------------------------------------------------------------- */}
      <section className="set-about">
        <div className="about-mark"><Icon name="brain" size={22} strokeWidth={1.6} /></div>
        <b>Screenshot Brain</b>
        <span>v{APP_VERSION} · Android</span>
        <span className="about-tag">Your screenshots finally make sense.</span>
        <div className="made-by">made by <b>CIPHER</b></div>
      </section>

      {spec && <ConfirmDialog spec={spec} onClose={close} />}
    </div>
  );
}

function StatusRow({ ok, label, detail }: { ok: boolean; label: string; detail: string }) {
  return (
    <div className="status-row">
      <span className={`status-dot ${ok ? 'on' : 'off'}`} />
      <span className="status-main"><b>{label}</b><i>{detail}</i></span>
    </div>
  );
}
