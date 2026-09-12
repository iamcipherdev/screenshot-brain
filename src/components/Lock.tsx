// ─── App lock: PIN keypad + native biometric (fingerprint/face) ───────────
// The PIN is hashed with SHA-256 before storage; it protects casual access,
// not a forensic-level attacker (see README privacy model).

import React, { useEffect, useState } from 'react';
import { Icon } from './Icon';
import { haptic } from '../lib/haptics';
import { isNative } from '../lib/native';

export async function hashPin(pin: string): Promise<string> {
  try {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`sb:${pin}`));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    let h = 0;
    for (let i = 0; i < pin.length; i++) { h = (h * 31 + pin.charCodeAt(i)) | 0; }
    return `fnv${h}`;
  }
}

export async function biometricAvailable(): Promise<boolean> {
  if (!isNative) return false;
  try {
    const { ScreenshotBrain } = await import('../lib/native');
    const r = await ScreenshotBrain.biometricCheck();
    return Boolean(r?.available);
  } catch {
    return false;
  }
}

export async function biometricPrompt(title: string, subtitle: string): Promise<boolean> {
  if (!isNative) return false;
  try {
    const { ScreenshotBrain } = await import('../lib/native');
    const r = await ScreenshotBrain.biometricAuthenticate({ title, subtitle });
    return Boolean(r?.ok);
  } catch {
    return false;
  }
}

export function LockScreen({ pinHash, biometric, onUnlock }: {
  pinHash: string; biometric: boolean; onUnlock: () => void;
}) {
  const [entry, setEntry] = useState('');
  const [error, setError] = useState(false);
  const [bioReady, setBioReady] = useState(false);

  useEffect(() => {
    if (!biometric) return;
    void biometricAvailable().then((ok) => {
      setBioReady(ok);
      if (ok) void tryBiometric();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [biometric]);

  const tryBiometric = async () => {
    const ok = await biometricPrompt('Unlock Screenshot Brain', 'Confirm to open your library');
    if (ok) {
      void haptic('light');
      onUnlock();
    }
  };

  const press = async (d: string) => {
    if (error) { setError(false); setEntry(''); }
    const next = (entry + d).slice(0, 4);
    setEntry(next);
    void haptic('light');
    if (next.length === 4) {
      const h = await hashPin(next);
      if (h === pinHash) {
        onUnlock();
      } else {
        setError(true);
        void haptic('medium');
        setTimeout(() => setEntry(''), 500);
      }
    }
  };

  const backspace = () => setEntry((e) => e.slice(0, -1));

  return (
    <div className="lockscreen">
      <div className="lock-mark"><Icon name="brain" size={30} strokeWidth={1.5} /></div>
      <b>Screenshot Brain</b>
      <p>Enter your 4-digit PIN to unlock</p>

      <div className={`lock-dots ${error ? 'lock-err' : ''}`} aria-label={error ? 'Wrong PIN' : 'PIN entry'}>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={`lock-dot ${i < entry.length ? 'on' : ''}`} />
        ))}
      </div>
      {error && <em className="lock-errmsg">Wrong PIN — try again</em>}

      <div className="lock-pad" role="group" aria-label="PIN keypad">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button key={d} className="lockkey" onClick={() => void press(d)} aria-label={`Digit ${d}`}>{d}</button>
        ))}
        {biometric && bioReady ? (
          <button className="lockkey lockkey-bio" onClick={() => void tryBiometric()} aria-label="Use biometric">
            <Icon name="shield" size={20} />
          </button>
        ) : <span className="lockkey lockkey-ghost" />}
        <button className="lockkey" onClick={() => void press('0')} aria-label="Digit 0">0</button>
        <button className="lockkey" onClick={backspace} aria-label="Delete digit"><Icon name="chevronLeft" size={18} /></button>
      </div>

      <div className="made-line">made by <b>CIPHER</b></div>
    </div>
  );
}
