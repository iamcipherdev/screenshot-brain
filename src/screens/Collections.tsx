// ─── Collections: manual + AI-suggested, never auto-created ───────────────

import React, { useMemo, useState } from 'react';
import { useApp } from '../state/store';
import { Icon } from '../components/Icon';
import { Thumb } from '../components/Thumb';
import { Empty } from '../components/Ui';
import { createColl } from '../lib/repo';
import { CATEGORIES, CATEGORY_EMOJI, CATEGORY_LABELS } from '../types';
import type { Category } from '../types';
import { plural } from '../lib/util';
import { haptic } from '../lib/haptics';

const EMOJIS = ['📁', '🎓', '✈️', '👨‍💻', '🛒', '🍳', '💰', '💼', '⭐', '📄', '🏠', '⚽', '🎬', '🎧'];

interface Suggestion {
  name: string;
  emoji: string;
  reason: string;
  shotIds: string[];
}

function buildSuggestions(shots: { id: string; value: string; ai?: { category: string; title: string } | null; ocr?: string }[]): Suggestion[] {
  const out: Suggestion[] = [];
  const catCount = new Map<string, string[]>();
  for (const s of shots) {
    if (!s.ai) continue;
    const arr = catCount.get(s.ai.category) ?? [];
    arr.push(s.id);
    catCount.set(s.ai.category, arr);
  }
  const interesting: [string, string, string][] = [
    ['study', 'University', '🎓'],
    ['code', 'Coding Errors', '👨‍💻'],
    ['travel', 'Travel Plans', '✈️'],
    ['finance', 'Payments & Fees', '💰'],
    ['recipes', 'Recipes', '🍳'],
    ['shopping', 'Shopping', '🛒'],
    ['documents', 'Documents', '📄'],
  ];
  for (const [cat, name, emoji] of interesting) {
    const ids = catCount.get(cat);
    if (ids && ids.length >= 3) {
      out.push({ name, emoji, reason: `${ids.length} ${CATEGORY_LABELS[cat as Category]?.toLowerCase() ?? cat} screenshots look related`, shotIds: ids });
    }
  }
  const important = shots.filter((s) => s.value === 'important').map((s) => s.id);
  if (important.length >= 3) {
    out.push({ name: 'Important Documents', emoji: '⭐', reason: `${important.length} screenshots marked important`, shotIds: important });
  }
  return out;
}

export function Collections() {
  const { shots, colls, navigate, goTab, back, refresh, toast } = useApp();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('📁');

  const existingNames = useMemo(() => new Set(colls.map((c) => c.name.toLowerCase())), [colls]);
  const suggestions = useMemo(
    () => buildSuggestions(shots).filter((s) => !existingNames.has(s.name.toLowerCase())),
    [shots, existingNames],
  );
  const hasShots = shots.length > 0;

  const make = async () => {
    const n = name.trim();
    if (!n) return;
    await createColl(n, emoji);
    setName('');
    setCreating(false);
    await refresh();
    toast(`Collection “${n}” created`);
  };

  const acceptSuggestion = async (s: Suggestion) => {
    void haptic();
    await createColl(s.name, s.emoji, false, s.shotIds);
    await refresh();
    toast(`Created “${s.name}” with ${plural(s.shotIds.length, 'screenshot')}`);
  };

  return (
    <div className="screen">
      <header className="topbar topbar-back">
        <button className="iconbtn" onClick={() => { if (!back()) goTab('home'); }} aria-label="Back"><Icon name="chevronLeft" /></button>
        <div className="topbar-title"><h1>Collections</h1><p>{colls.length ? `${colls.length} collections` : 'Group related screenshots'}</p></div>
        <button className="iconbtn" onClick={() => setCreating(!creating)} aria-label="New collection"><Icon name="plus" /></button>
      </header>

      {creating && (
        <div className="coll-create">
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Collection name (e.g. University)" />
          <div className="emoji-row">
            {EMOJIS.map((e) => (
              <button key={e} className={`emojibtn ${emoji === e ? 'on' : ''}`} onClick={() => setEmoji(e)}>{e}</button>
            ))}
          </div>
          <button className="btn btn-primary" onClick={() => void make()} disabled={!name.trim()}>Create collection</button>
        </div>
      )}

      {suggestions.length > 0 && (
        <section className="coll-suggest">
          <span className="eyebrow">AI suggestions · created only if you tap</span>
          {suggestions.map((s) => (
            <button key={s.name} className="suggest" onClick={() => void acceptSuggestion(s)}>
              <span className="suggest-emoji">{s.emoji}</span>
              <span className="suggest-main"><b>{s.name}</b><i>{s.reason}</i></span>
              <span className="suggest-make">Create<Icon name="plus" size={13} /></span>
            </button>
          ))}
        </section>
      )}

      {colls.length === 0 && !hasShots ? (
        <Empty icon="folder" title="No collections yet" sub="Import screenshots first — then you can group them, or let AI suggest clusters." />
      ) : (
        <div className="coll-grid">
          {colls.map((c) => (
            <button key={c.id} className="collcard collcard-full" onClick={() => navigate({ name: 'collection', id: c.id })}>
              <span className="coll-emoji">{c.emoji}</span>
              <b>{c.name}</b>
              <i>{c.auto ? 'Auto' : plural(c.shotIds.length, 'shot')}</i>
              <div className="coll-thumbs">
                {c.shotIds.slice(0, 3).map((id) => <Thumb key={id} id={id} size="strip" />)}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function CollectionView({ id }: { id: string }) {
  const { colls, shots, navigate, goTab, back, refresh, toast, deleteShots, removeCollection } = useApp();
  const coll = colls.find((c) => c.id === id);
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState('');

  if (!coll) {
    return (
      <div className="screen">
        <header className="topbar topbar-back">
          <button className="iconbtn" onClick={() => { if (!back()) goTab('home'); }} aria-label="Back"><Icon name="chevronLeft" /></button>
          <div className="topbar-title"><h1>Collection</h1></div>
        </header>
        <p className="muted-line">This collection no longer exists.</p>
      </div>
    );
  }

  const items = coll.shotIds
    .map((sid) => shots.find((s) => s.id === sid))
    .filter((s): s is NonNullable<typeof s> => Boolean(s));

  const rename = async () => {
    const n = newName.trim();
    if (!n) return;
    const { saveColl } = await import('../lib/repo');
    await saveColl({ ...coll, name: n });
    setRenaming(false);
    await refresh();
    toast('Renamed');
  };

  const removeColl = async () => {
    await removeCollection(coll.id);
    toast('Collection removed (screenshots kept)');
    if (!back()) goTab('home');
  };

  return (
    <div className="screen">
      <header className="topbar topbar-back">
        <button className="iconbtn" onClick={() => { if (!back()) goTab('home'); }} aria-label="Back"><Icon name="chevronLeft" /></button>
        <div className="topbar-title">
          {renaming ? (
            <input className="rename-input" autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void rename(); }} />
          ) : (
            <>
              <h1>{coll.emoji} {coll.name}</h1>
              <p>{plural(items.length, 'screenshot')}</p>
            </>
          )}
        </div>
        <button className="iconbtn" onClick={() => { setNewName(coll.name); setRenaming(!renaming); }} aria-label="Rename"><Icon name="edit" size={17} /></button>
      </header>

      {items.length === 0 ? (
        <Empty icon="folder" title="Empty collection" sub="Add screenshots from their detail page → Add to collection." />
      ) : (
        <div className="grid">
          {items.map((s) => (
            <button key={s.id} className="gridcell" onClick={() => navigate({ name: 'detail', id: s.id })}>
              <Thumb id={s.id} alt={s.ai?.title ?? s.fileName} />
            </button>
          ))}
        </div>
      )}

      <div className="coll-foot">
        <button className="btn btn-ghost btn-sm" onClick={() => void removeColl()}><Icon name="trash" size={14} /> Remove collection</button>
        <span className="muted-line small">Removing the collection never deletes the screenshots inside.</span>
      </div>
    </div>
  );
}

export { CATEGORIES, CATEGORY_EMOJI };
