// ─── Cleanup: suggestions with reasons — never auto-deletes ────────────────
// Groups: duplicates (with similarity + storage), blurred, empty,
// expired, outdated, low-value. Soft-delete + undo. Keeper recommendation.

import React, { useMemo, useState } from 'react';
import { useApp } from '../state/store';
import { Icon } from '../components/Icon';
import { Thumb } from '../components/Thumb';
import { Empty, ValueBadge, useConfirm, ConfirmDialog } from '../components/Ui';
import { cleanupSuggestions, dupGroupsDetailed, estimateSpare } from '../lib/cleanup';
import type { DupGroup } from '../lib/cleanup';
import { updateShot } from '../lib/repo';
import { fmtBytes, plural } from '../lib/util';
import { haptic } from '../lib/haptics';
import type { Shot } from '../types';

type GroupId = 'dups' | 'temp' | 'stale' | 'low' | 'empty' | 'blurry';

const GROUP_ICON: Record<GroupId, 'layers' | 'clock' | 'info' | 'swap' | 'alert' | 'image'> = {
  dups: 'layers', temp: 'clock', stale: 'alert', low: 'info', empty: 'image', blurry: 'image',
};

export function Cleanup() {
  const { shots, refresh, deleteShots, toast, navigate } = useApp();
  const { spec, ask, close } = useConfirm();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [reviewing, setReviewing] = useState<GroupId | null>(null);
  const [dupIndex, setDupIndex] = useState(0);

  const { groups, totalSpare } = useMemo(() => cleanupSuggestions(shots), [shots]);
  const dupGroups = useMemo(() => dupGroupsDetailed(shots), [shots]);
  const allItems = useMemo(() => groups.flatMap((g) => g.items), [groups]);
  const reviewGroup = groups.find((g) => g.id === reviewing);
  const reviewDup = reviewing === 'dups' ? dupGroups[Math.min(dupIndex, Math.max(0, dupGroups.length - 1))] : null;

  const toggle = (id: string) => {
    void haptic();
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectIds = (ids: string[]) => {
    void haptic();
    setSelected((prev) => new Set([...prev, ...ids]));
  };

  const clearSelection = () => setSelected(new Set());

  const keepIds = async (ids: string[], areDups: boolean) => {
    for (const id of ids) {
      const patch: Partial<Shot> = areDups
        ? { dupOf: undefined, value: 'useful', valueReason: 'You kept it — no longer flagged as duplicate' }
        : { value: 'useful', valueReason: 'You marked it worth keeping' };
      await updateShot(id, patch);
    }
    setSelected((prev) => {
      const n = new Set(prev);
      for (const id of ids) n.delete(id);
      return n;
    });
    await refresh();
  };

  const confirmDelete = () => {
    if (!selected.size) return;
    const items = allItems.filter((i) => selected.has(i.shot.id));
    ask({
      title: `Clean ${plural(selected.size, 'screenshot')}?`,
      danger: true,
      confirmLabel: 'Move to trash',
      body: (
        <div className="confirm-del">
          <p>They move to <b>Trash</b> (Settings → Trash) where you can restore them anytime. <b>Originals in your phone gallery are never touched.</b> Nothing is permanently deleted without a second confirmation.</p>
          <p className="confirm-spare">Frees about <b>{estimateSpare(items.map((i) => i.shot))}</b> inside the app.</p>
          <ul>
            {items.slice(0, 5).map((i) => (
              <li key={i.shot.id}><b>{i.shot.ai?.title ?? i.shot.fileName}</b> — {i.reason}</li>
            ))}
          </ul>
          {items.length > 5 && <p className="muted-line">and {items.length - 5} more…</p>}
        </div>
      ),
      onConfirm: async () => {
        await deleteShots([...selected], { undoable: true });
        clearSelection();
        await refresh();
      },
    });
  };

  const keepAll = async () => {
    await keepIds(allItems.map((i) => i.shot.id), true);
    toast(`Kept all ${allItems.length} — nothing was deleted`);
  };

  if (!allItems.length) {
    return (
      <div className="screen">
        <header className="topbar"><div className="topbar-title"><h1>Cleanup</h1><p>Nothing to clean right now</p></div></header>
        <Empty
          icon="broom"
          title="Your library is tidy"
          sub="When duplicates pile up, screenshots come out blurred, codes expire or low-value shots accumulate, suggestions will appear here — each with a reason, and nothing is deleted without you."
        />
        <div className="footline">Made by CIPHER · nothing leaves this phone</div>
      </div>
    );
  }

  // ── Duplicate groups walkthrough ────────────────────────────────────────
  if (reviewing === 'dups' && reviewDup) {
    const g: DupGroup = reviewDup;
    const extraIds = g.extras.map((e) => e.shot.id);
    return (
      <div className="screen">
        <header className="topbar topbar-back">
          <button className="iconbtn" onClick={() => setReviewing(null)} aria-label="Back"><Icon name="chevronLeft" /></button>
          <div className="topbar-title"><h1>Duplicate {dupIndex + 1} of {dupGroups.length}</h1><p>~{fmtBytes(g.bytesSpare)} recoverable</p></div>
          <div className="dup-pager">
            <button className="iconbtn" disabled={dupIndex === 0} onClick={() => setDupIndex(dupIndex - 1)} aria-label="Previous group"><Icon name="chevronLeft" size={16} /></button>
            <button className="iconbtn" disabled={dupIndex >= dupGroups.length - 1} onClick={() => setDupIndex(dupIndex + 1)} aria-label="Next group"><Icon name="chevronRight" size={16} /></button>
          </div>
        </header>

        <div className="dup-keeper">
          <span className="dup-keeper-badge"><Icon name="check" size={13} /> Recommended to keep</span>
          <div className="dup-keeper-card" onClick={() => navigate({ name: 'detail', id: g.keeper.id })} role="button" tabIndex={0} aria-label="Open keeper screenshot">
            <Thumb id={g.keeper.id} size="grid" />
            <div className="dup-keeper-info">
              <b>{g.keeper.ai?.title ?? g.keeper.fileName}</b>
              <i>{new Date(g.keeper.createdAt).toLocaleDateString()} · {fmtBytes(g.keeper.bytes)}</i>
            </div>
          </div>
        </div>

        <div className="dup-extras">
          {g.extras.map((e) => (
            <div key={e.shot.id} className={`row row-select ${selected.has(e.shot.id) ? 'row-selected' : ''}`}>
              <button className="row-check" onClick={() => toggle(e.shot.id)} aria-label="Select">
                <Icon name={selected.has(e.shot.id) ? 'checkSquare' : 'square'} size={19} />
              </button>
              <button className="row-body" onClick={() => toggle(e.shot.id)}>
                <Thumb id={e.shot.id} size="row" />
                <span className="row-main">
                  <b>{e.shot.ai?.title ?? e.shot.fileName}</b>
                  <i>{e.similarity}% same as the keeper · {new Date(e.shot.createdAt).toLocaleDateString()}</i>
                  <span className="row-meta"><ValueBadge level={e.shot.value} /></span>
                </span>
              </button>
              <button className="keepbtn" onClick={() => void keepIds([e.shot.id], true)}>Keep</button>
            </div>
          ))}
        </div>

        <div className="dup-actions">
          <button className="btn btn-primary" onClick={() => { void keepIds(extraIds, true); toast('Keeper kept — duplicates unflagged for review'); }}>
            Keep best only
          </button>
          <button className="btn btn-ghost" onClick={() => selectIds(extraIds)}>Select duplicates</button>
          <button className="btn btn-ghost" onClick={() => selectIds([g.keeper.id, ...extraIds])}>Keep all</button>
        </div>

        <SelectionBar count={selected.size} spare={estimateSpare(allItems.filter((i) => selected.has(i.shot.id)).map((i) => i.shot))} onDelete={confirmDelete} onKeep={async () => { await keepIds([...selected], true); }} onKeepAll={keepAll} onClear={clearSelection} spec={spec} onClose={close} />
      </div>
    );
  }

  // ── Review view for one regular group ────────────────────────────────────
  if (reviewGroup) {
    return (
      <div className="screen">
        <header className="topbar topbar-back">
          <button className="iconbtn" onClick={() => setReviewing(null)} aria-label="Back"><Icon name="chevronLeft" /></button>
          <div className="topbar-title"><h1>{reviewGroup.title}</h1><p>{plural(reviewGroup.items.length, 'suggestion')} · {estimateSpare(reviewGroup.items.map((i) => i.shot))}</p></div>
          <button className="btn btn-ghost btn-sm" onClick={() => selectIds(reviewGroup.items.map((i) => i.shot.id))}>Select all</button>
        </header>
        <div className="cleanup-lede">
          <Icon name="shield" size={15} />
          <span>{reviewGroup.blurb} Nothing is deleted until you confirm — and it always goes to Trash first.</span>
        </div>
        <div className="list">
          {reviewGroup.items.map((s) => (
            <div key={s.shot.id} className={`row row-select ${selected.has(s.shot.id) ? 'row-selected' : ''}`}>
              <button className="row-check" onClick={() => toggle(s.shot.id)} aria-label="Select">
                <Icon name={selected.has(s.shot.id) ? 'checkSquare' : 'square'} size={19} />
              </button>
              <button className="row-body" onClick={() => toggle(s.shot.id)}>
                <Thumb id={s.shot.id} size="row" sensitive={s.shot.sensitive} />
                <span className="row-main">
                  <b>{s.shot.ai?.title ?? s.shot.fileName}</b>
                  <i>{s.reason}</i>
                  <span className="row-meta"><ValueBadge level={s.shot.value} /></span>
                </span>
              </button>
              <button className="keepbtn" onClick={() => void keepIds([s.shot.id], s.groupId === 'dups')}>Keep</button>
            </div>
          ))}
        </div>
        <SelectionBar count={selected.size} spare={estimateSpare(allItems.filter((i) => selected.has(i.shot.id)).map((i) => i.shot))} onDelete={confirmDelete} onKeep={async () => { await keepIds([...selected], false); }} onKeepAll={keepAll} onClear={clearSelection} spec={spec} onClose={close} />
      </div>
    );
  }

  // ── Groups overview ───────────────────────────────────────────────────────
  return (
    <div className="screen">
      <header className="topbar"><div className="topbar-title"><h1>Cleanup</h1><p>{plural(allItems.length, 'suggestion')} · ~{fmtBytes(totalSpare)} recoverable</p></div></header>

      <div className="cleanup-lede">
        <Icon name="shield" size={15} />
        <span>Screenshot Brain never deletes anything on its own. Every suggestion comes with a reason — you review, then decide. Deleted items go to Trash with Undo.</span>
      </div>

      <div className="cleanup-groups">
        {groups.map((g) => (
          <button key={g.id} className="cleanup-group" onClick={() => { setDupIndex(0); setReviewing(g.id); }}>
            <span className={`cg-ico cg-${g.id}`}><Icon name={GROUP_ICON[g.id]} size={19} /></span>
            <span className="cg-main">
              <b>{g.title}</b>
              <i>{g.id === 'dups' ? `${dupGroups.length} group${dupGroups.length === 1 ? '' : 's'} · ~${fmtBytes(totalSpare)} spare` : g.blurb}</i>
            </span>
            <span className="cg-count">{g.items.length}</span>
            <Icon name="chevronRight" size={16} />
          </button>
        ))}
      </div>

      <div className="cleanup-preview">
        <span className="eyebrow">Preview</span>
        <div className="hgrid">
          {allItems.slice(0, 10).map((s) => (
            <button key={s.shot.id} className="tile" onClick={() => { setDupIndex(0); setReviewing(s.groupId); }}>
              <Thumb id={s.shot.id} sensitive={s.shot.sensitive} />
              <span className="tile-reason">{s.groupId === 'dups' ? 'Duplicate' : s.groupId === 'temp' ? 'Expired' : s.groupId === 'empty' ? 'Empty' : s.groupId === 'blurry' ? 'Blurred' : s.groupId === 'low' ? 'Low value' : 'Outdated'}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="footline">Made by CIPHER · nothing leaves this phone</div>
      <SelectionBar count={selected.size} spare={estimateSpare(allItems.filter((i) => selected.has(i.shot.id)).map((i) => i.shot))} onDelete={confirmDelete} onKeep={async () => { await keepIds([...selected], false); }} onKeepAll={keepAll} onClear={clearSelection} spec={spec} onClose={close} />
    </div>
  );
}

function SelectionBar({ count, spare, onDelete, onKeep, onKeepAll, onClear, spec, onClose }: {
  count: number; spare: string; onDelete: () => void; onKeep: () => void; onKeepAll: () => void; onClear: () => void;
  spec: ReturnType<typeof useConfirm>['spec']; onClose: () => void;
}) {
  if (count === 0) { return spec ? <ConfirmDialog spec={spec} onClose={onClose} /> : null; }
  return (
    <>
      <div className="selectionbar">
        <span>{count} selected · {spare}</span>
        <div className="selectionbar-actions">
          <button className="btn btn-ghost btn-sm" onClick={onClear}>Clear</button>
          <button className="btn btn-ghost btn-sm" onClick={onKeep}>Keep</button>
          <button className="btn btn-ghost btn-sm" onClick={onKeepAll}>Keep all</button>
          <button className="btn btn-danger btn-sm" onClick={onDelete}>Delete</button>
        </div>
      </div>
      {spec && <ConfirmDialog spec={spec} onClose={onClose} />}
    </>
  );
}
