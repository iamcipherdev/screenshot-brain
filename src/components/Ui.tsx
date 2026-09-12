// ─── Bottom sheet, confirm dialog, toasts, empty states, badges ───────────

import React, { useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';
import type { IconName } from './Icon';
import { useApp } from '../state/store';
import { haptic } from '../lib/haptics';

// Bottom sheet -------------------------------------------------------------
export function Sheet({ title, onClose, children, wide }: {
  title: string; onClose: () => void; children: React.ReactNode; wide?: boolean;
}) {
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [onClose]);
  return (
    <div className="overlay" onClick={onClose}>
      <div
        className={`sheet ${wide ? 'sheet-wide' : ''}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="sheet-grab" />
        <div className="sheet-head">
          <h3>{title}</h3>
          <button className="iconbtn" onClick={onClose} aria-label="Close"><Icon name="x" /></button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
}

// Confirm dialog -------------------------------------------------------------
export interface ConfirmSpec {
  title: string;
  body: React.ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void | Promise<void>;
}

export function ConfirmDialog({ spec, onClose }: { spec: ConfirmSpec; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="overlay overlay-center" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()} role="alertdialog" aria-modal="true">
        <h3>{spec.title}</h3>
        <div className="dialog-body">{spec.body}</div>
        <div className="dialog-actions">
          <button className="btn btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button
            className={`btn ${spec.danger ? 'btn-danger' : 'btn-primary'}`}
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try { await spec.onConfirm(); } finally { onClose(); }
            }}
          >
            {busy ? 'Working…' : (spec.confirmLabel ?? 'Confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}

// Toasts ---------------------------------------------------------------------
export function Toasts() {
  const { toasts } = useApp();
  if (!toasts.length) return null;
  return (
    <div className="toasts">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.kind}`}>
          <Icon name={t.kind === 'ok' ? 'check' : t.kind === 'warn' ? 'alert' : 'alert'} size={16} />
          <span>{t.text}</span>
        </div>
      ))}
    </div>
  );
}

// Empty state ------------------------------------------------------------------
export function Empty({ icon, title, sub, action }: {
  icon: IconName; title: string; sub?: string; action?: React.ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon"><Icon name={icon} size={30} strokeWidth={1.5} /></div>
      <h4>{title}</h4>
      {sub ? <p>{sub}</p> : null}
      {action}
    </div>
  );
}

// Section header -----------------------------------------------------------------
export function SectionHead({ label, action }: { label: string; action?: React.ReactNode }) {
  return (
    <div className="sectionhead">
      <span className="eyebrow">{label}</span>
      {action}
    </div>
  );
}

// Value badge ------------------------------------------------------------------------
export function ValueBadge({ level }: { level: string }) {
  const labels: Record<string, string> = {
    important: 'Important', useful: 'Useful', temporary: 'Temporary',
    duplicate: 'Duplicate', low: 'Low value',
  };
  return <span className={`vbadge v-${level}`}>{labels[level] ?? level}</span>;
}

// Progress bar -------------------------------------------------------------------------
export function ProgressBar({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div className="progress">
      <div className="progress-fill" style={{ width: `${pct}%` }} />
    </div>
  );
}

// Multi-use: confirm hook via local state -------------------------------------------------
export function useConfirm(): { spec: ConfirmSpec | null; ask: (s: ConfirmSpec) => void; close: () => void } {
  const [spec, setSpec] = useState<ConfirmSpec | null>(null);
  return { spec, ask: (s) => { void haptic('medium'); setSpec(s); }, close: () => setSpec(null) };
}

// Copy-to-clipboard chip -------------------------------------------------------------------
export function CopyChip({ text, label }: { text: string; label?: string }) {
  const { toast } = useApp();
  const ref = useRef(0);
  return (
    <button
      className="chip chip-action"
      onClick={async () => {
        try { await navigator.clipboard.writeText(text); toast('Copied to clipboard'); ref.current++; }
        catch { toast('Could not copy', 'err'); }
      }}
    >
      <Icon name="copy" size={13} />
      <span>{label ?? text}</span>
    </button>
  );
}
