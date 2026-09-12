// ─── Timeline: Today / Yesterday / This week / This month / Older ─────────

import React, { useMemo } from 'react';
import { useApp } from '../state/store';
import { Icon } from '../components/Icon';
import { Thumb } from '../components/Thumb';
import { Empty } from '../components/Ui';
import { dayBucket, fmtDateShort } from '../lib/util';
import type { DayBucket } from '../lib/util';

const ORDER: DayBucket[] = ['today', 'yesterday', 'week', 'month', 'older'];
const LABELS: Record<DayBucket, string> = {
  today: 'Today', yesterday: 'Yesterday', week: 'This week', month: 'This month', older: 'Older',
};

export function Timeline() {
  const { shots, navigate, goTab, back } = useApp();

  const groups = useMemo(() => {
    const map = new Map<DayBucket, typeof shots>();
    for (const s of shots) {
      const b = dayBucket(s.createdAt);
      const arr = map.get(b) ?? [];
      arr.push(s);
      map.set(b, arr);
    }
    return ORDER.filter((k) => (map.get(k)?.length ?? 0) > 0).map((k) => ({ bucket: k, items: map.get(k)! }));
  }, [shots]);

  if (!shots.length) {
    return (
      <div className="screen">
        <header className="topbar topbar-back">
          <button className="iconbtn" onClick={() => { if (!back()) goTab('home'); }} aria-label="Back"><Icon name="chevronLeft" /></button>
          <div className="topbar-title"><h1>Timeline</h1></div>
        </header>
        <Empty icon="clock" title="Nothing on the timeline yet" sub="Import screenshots and they will appear here grouped by when you took them." />
      </div>
    );
  }

  return (
    <div className="screen">
      <header className="topbar topbar-back">
        <button className="iconbtn" onClick={() => { if (!back()) goTab('home'); }} aria-label="Back"><Icon name="chevronLeft" /></button>
        <div className="topbar-title"><h1>Timeline</h1><p>{shots.length} screenshots</p></div>
      </header>

      {groups.map((g) => (
        <section key={g.bucket} className="tl-group">
          <div className="tl-head">
            <span className="tl-label">{LABELS[g.bucket]}</span>
            <span className="tl-count">{g.items.length}</span>
          </div>
          {g.bucket === 'today' || g.bucket === 'yesterday' ? (
            <div className="tl-rows">
              {g.items.map((s) => (
                <button key={s.id} className="tl-row" onClick={() => navigate({ name: 'detail', id: s.id })}>
                  <Thumb id={s.id} size="row" />
                  <span className="row-main">
                    <b>{s.ai?.title ?? s.fileName}</b>
                    <i>{fmtDateShort(s.createdAt)} · {new Date(s.createdAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</i>
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="hgrid">
              {g.items.map((s) => (
                <button key={s.id} className="tile" onClick={() => navigate({ name: 'detail', id: s.id })}>
                  <Thumb id={s.id} />
                </button>
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
