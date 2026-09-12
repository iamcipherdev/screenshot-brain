// ─── Onboarding: 4 short slides + permission rationale + choose screenshots ──

import React, { useState } from 'react';
import { useApp } from '../state/store';
import { Icon } from '../components/Icon';
import { haptic } from '../lib/haptics';
import { isNative, nativeRequestMediaPermission } from '../lib/native';

const SLIDES = [
  {
    title: 'Your screenshots remember everything.',
    body: 'Every screenshot you save gets read, understood and organised — on your phone, privately. Your forgotten screenshots become searchable memory.',
    art: (
      <div className="ob-art">
        <div className="ob-chip-row"><span className="ob-chip">🎓 Study</span><span className="ob-chip">💰 Finance</span><span className="ob-chip">✈️ Travel</span></div>
        <div className="ob-stack">
          <div className="ob-card"><span className="ob-dot" /><div><b>Fee voucher — 48,500 PKR</b><i>due 25 September</i></div></div>
          <div className="ob-card ob-card-2"><span className="ob-dot ob-dot-2" /><div><b>Flight KHI → IST</b><i>03 October, 08:45</i></div></div>
          <div className="ob-card ob-card-3"><span className="ob-dot ob-dot-3" /><div><b>React error</b><i>Cannot read properties…</i></div></div>
        </div>
      </div>
    ),
  },
  {
    title: 'Search by meaning, not just filename.',
    body: 'Text inside every screenshot becomes searchable — by keyword, category, date, price even. Try “receipt from last week” or “product under Rs 5000” — you will see why each result matched.',
    art: (
      <div className="ob-art">
        <div className="ob-search">
          <Icon name="search" size={17} />
          <span>receipt from last week</span>
        </div>
        <div className="ob-result">
          <b>Fee voucher — 48,500 PKR</b>
          <span className="ob-why">Matched: OCR text · “fee” · “voucher” · date</span>
        </div>
        <div className="ob-result">
          <b>Library payment receipt</b>
          <span className="ob-why">Matched: OCR text · “receipt”</span>
        </div>
      </div>
    ),
  },
  {
    title: 'Ask your screenshots questions.',
    body: 'Chat with your library: “What university fees did I save?”, “What deadlines do I have?” Every answer cites the exact screenshots it came from — and general questions work too.',
    art: (
      <div className="ob-art">
        <div className="ob-chat">
          <div className="ob-q">What was my GIFT University fee?</div>
          <div className="ob-a"><b>48,500 PKR, due 25 September.</b><span className="ob-why">Sources: [1] Fee voucher — Sep 5 · [2] Fee notice — Sep 7</span></div>
        </div>
      </div>
    ),
  },
  {
    title: 'Clean duplicates safely.',
    body: 'Duplicates, blurred shots and expired codes are grouped with a clear reason and an estimated space saving. Nothing is ever deleted without you — and deletes go to Trash with Undo.',
    art: (
      <div className="ob-art">
        <div className="ob-clean">
          <div className="ob-clean-row"><Icon name="layers" size={15} /><span>2 duplicates</span><i>“same fee voucher”</i></div>
          <div className="ob-clean-row"><Icon name="clock" size={15} /><span>3 temporary</span><i>“old OTP codes”</i></div>
          <div className="ob-clean-row"><Icon name="info" size={15} /><span>1 low value</span><i>“no readable text”</i></div>
        </div>
        <div className="ob-never">Never deletes without asking you first.</div>
      </div>
    ),
  },
];

export function Onboarding({ onDone }: { onDone: () => void }) {
  const { navigate } = useApp();
  const [idx, setIdx] = useState(0);
  const [permState, setPermState] = useState<'idle' | 'granted' | 'denied'>('idle');
  const slide = SLIDES[idx];
  const last = idx === SLIDES.length - 1;

  const next = () => {
    void haptic();
    if (!last) { setIdx(idx + 1); return; }
    onDone();
  };

  const chooseScreenshots = async () => {
    void haptic();
    if (isNative) {
      try {
        const r = await nativeRequestMediaPermission();
        setPermState(r.granted ? 'granted' : 'denied');
      } catch {
        setPermState('denied');
      }
    }
    onDone();
  };

  return (
    <div className="onboarding">
      <div className="ob-top">
        <div className="brand-lockup">
          <span className="brand-mark"><Icon name="brain" size={15} /></span>
          <span className="brand-name">Screenshot Brain</span>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={onDone}>Skip</button>
      </div>

      <div className="ob-slide" key={idx}>
        {slide.art}
        <h1>{slide.title}</h1>
        <p>{slide.body}</p>
      </div>

      <div className="ob-bottom">
        <div className="ob-dots">
          {SLIDES.map((_, i) => (
            <button key={i} className={`ob-dot-ind ${i === idx ? 'on' : ''}`} onClick={() => setIdx(i)} aria-label={`Slide ${i + 1}`} />
          ))}
        </div>

        {last && (
          <div className="ob-perm">
            <Icon name="shield" size={14} />
            <span>
              To read your <b>Screenshots folder</b>, Android will ask for photo permission.
              OCR runs on-device; the original files never leave your phone.
            </span>
            {permState === 'denied' && <em>You can grant it later from Settings, or import via the share sheet.</em>}
          </div>
        )}

        {last ? (
          <button className="btn btn-primary btn-big" onClick={() => void chooseScreenshots()}>
            Choose Screenshots
            <Icon name="chevronRight" size={17} />
          </button>
        ) : (
          <button className="btn btn-primary btn-big" onClick={next}>
            Next
            <Icon name="chevronRight" size={17} />
          </button>
        )}
        {last && (
          <button className="ob-import-hint" onClick={() => { onDone(); navigate({ name: 'settings' }); }}>
            Not now — open Settings first
          </button>
        )}
        <div className="ob-made">made by <b>CIPHER</b></div>
      </div>
    </div>
  );
}
