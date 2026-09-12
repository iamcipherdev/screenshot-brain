// ─── Library: full grid with filters, multi-select, sort ──────────────────

import React, { useMemo, useRef, useState } from 'react';
import { useApp } from '../state/store';
import { Icon } from '../components/Icon';
import { Thumb } from '../components/Thumb';
import { Empty, ValueBadge, useConfirm, ConfirmDialog } from '../components/Ui';
import { ImportSheet } from '../components/ImportSheet';
import { plural } from '../lib/util';
import { haptic } from '../lib/haptics';
import type { Shot, ValueLevel } from '../types';

type Filter = 'all' | 'important' | 'temporary' | 'duplicates' | 'favorites' | 'noai' | 'low';
type Sort = 'newest' | 'oldest' | 'largest';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'important', label: 'Important' },
  { id: 'temporary', label: 'Temporary' },
  { id: 'duplicates', label: 'Duplicates' },
  { id: 'favorites', label: 'Favorites' },
  { id: 'noai', label: 'Needs AI' },
  { id: 'low', label: 'Low value' },
];

export function Library() {
  const { shots, navigate, deleteShots, refresh, toast } = useApp();
  const { spec, ask, close } = useConfirm();
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<Sort>('newest');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    let list = shots;
    if (filter === 'important') list = list.filter((s) => s.value === 'important');
    if (filter === 'temporary') list = list.filter((s) => s.value === 'temporary');
    if (filter === 'duplicates') list = list.filter((s) => s.dupOf);
    if (filter === 'favorites') list = list.filter((s) => s.fav);
    if (filter === 'low') list = list.filter((s) => s.value === 'low');
    if (filter === 'noai') list = list.filter((s) => s.aiStatus !== 'done');
    if (sort === 'newest') list = [...list].sort((a, b) => b.createdAt - a.createdAt);
    if (sort === 'oldest') list = [...list].sort((a, b) => a.createdAt - b.createdAt);
    if (sort === 'largest') list = [...list].sort((a, b) => b.bytes - a.bytes);
    return list;
  }, [shots, filter, sort]);

  const toggle = (id: string) => {
    void haptic();
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const onPickFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const { pipeline } = await import('../lib/pipeline');
    const n = await pipeline.importFiles(Array.from(files));
    if (n > 0) toast(`Importing ${plural(n, 'screenshot')}`);
    await refresh();
  };

  const confirmDelete = () => {
    if (!selected.size) return;
    ask({
      title: `Delete ${plural(selected.size, 'screenshot')}?`,
      danger: true,
      confirmLabel: 'Move to trash',
      body: <p>They move to <b>Trash</b> (Settings → Trash) with Undo. <b>Gallery originals are not touched.</b> Permanent deletion needs an extra confirmation.</p>,
      onConfirm: async () => {
        const n = selected.size;
        await deleteShots([...selected], { undoable: true });
        setSelected(new Set());
      },
    });
  };

  const favSelected = async () => {
    for (const id of selected) {
      const s = shots.find((x) => x.id === id);
      if (s) await fetchFavorite(s);
    }
    await refresh();
    setSelected(new Set());
    toast('Updated favorites');
  };

  const fetchFavorite = async (s: Shot) => {
    const { updateShot } = await import('../lib/repo');
    await updateShot(s.id, { fav: !s.fav });
  };

  return (
    <div className="screen">
      <header className="topbar">
        <div className="topbar-title"><h1>Library</h1><p>{plural(shots.length, 'screenshot')} on this device</p></div>
        <div className="topbar-actions">
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => { void onPickFiles(e.target.files); e.target.value = ''; }} />
          <button className="iconbtn" aria-label="Add" onClick={() => fileRef.current?.click()}><Icon name="plus" /></button>
          <button className="iconbtn" aria-label="Import options" onClick={() => setImporting(true)}><Icon name="images" /></button>
          <button className="iconbtn" aria-label="Settings" onClick={() => navigate({ name: 'settings' })}><Icon name="settings" /></button>
        </div>
      </header>

      <div className="chips-row">
        {FILTERS.map((f) => (
          <button key={f.id} className={`chip ${filter === f.id ? 'chip-on' : ''}`} onClick={() => { setFilter(f.id); setSelected(new Set()); }}>
            {f.label}
          </button>
        ))}
        <span className="chips-spacer" />
        <button className="chip chip-sort" onClick={() => setSort(sort === 'newest' ? 'oldest' : sort === 'oldest' ? 'largest' : 'newest')}>
          <Icon name="swap" size={13} /> {sort === 'newest' ? 'Newest' : sort === 'oldest' ? 'Oldest' : 'Largest'}
        </button>
      </div>

      {filtered.length === 0 ? (
        <Empty
          icon="library"
          title={shots.length ? 'Nothing in this filter' : 'No screenshots yet'}
          sub={shots.length ? 'Try another filter above.' : 'Tap + to pick screenshots, or use Share → Screenshot Brain from your gallery.'}
          action={!shots.length ? <button className="btn btn-primary" onClick={() => setImporting(true)}><Icon name="plus" size={16} /> Add screenshots</button> : undefined}
        />
      ) : (
        <div className="grid">
          {filtered.map((s) => (
            <button
              key={s.id}
              className={`gridcell ${selected.has(s.id) ? 'cell-selected' : ''}`}
              onClick={() => (selected.size ? toggle(s.id) : navigate({ name: 'detail', id: s.id }))}
              onContextMenu={(e) => { e.preventDefault(); toggle(s.id); }}
            >
              <Thumb id={s.id} alt={s.ai?.title ?? s.fileName} sensitive={s.sensitive} />
              {s.fav && <span className="cell-fav"><Icon name="star" size={11} /></span>}
              {s.dupOf && <span className="cell-dup">dup</span>}
              {selected.has(s.id) && <span className="cell-check"><Icon name="check" size={13} strokeWidth={2.4} /></span>}
            </button>
          ))}
        </div>
      )}

      <div className="gridfooter">
        <span className="muted-line small">Long-press style: right-click / hold selects. {filter !== 'all' && <button className="linkbtn" onClick={() => setFilter('all')}>Clear filter</button>}</span>
      </div>

      {selected.size > 0 && (
        <div className="selectionbar">
          <span>{plural(selected.size, 'screenshot')} selected</span>
          <div className="selectionbar-actions">
            <button className="btn btn-ghost btn-sm" onClick={() => void favSelected()}><Icon name="star" size={14} /> Favorite</button>
            <button className="btn btn-danger btn-sm" onClick={confirmDelete}>Delete</button>
          </div>
        </div>
      )}

      {importing && <ImportSheet onClose={() => setImporting(false)} />}
      {spec && <ConfirmDialog spec={spec} onClose={close} />}
    </div>
  );
}

export function valueLabel(v: ValueLevel): string {
  return v;
}
