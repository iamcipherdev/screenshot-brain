// ─── Home: Your Brain stats + Recent + Chats + Collections + Cleanup ──────

import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../state/store';
import { Icon } from '../components/Icon';
import { Thumb } from '../components/Thumb';
import { SectionHead, ValueBadge } from '../components/Ui';
import { ImportSheet } from '../components/ImportSheet';
import { cleanupSuggestions } from '../lib/cleanup';
import { plural, truncate } from '../lib/util';
import { listConvos } from '../lib/repo';
import type { Conversation } from '../types';
import type { Shot } from '../types';

export function Home() {
  const { shots, colls, navigate, goTab, settings, online, pipe } = useApp();
  const [importing, setImporting] = useState(false);
  const [recentChats, setRecentChats] = useState<Conversation[]>([]);

  useEffect(() => {
    void listConvos().then((cs) => setRecentChats(cs.filter((c) => c.messages.length).slice(0, 3)));
  }, [pipe.running]);

  const stats = useMemo(() => {
    const { groups } = cleanupSuggestions(shots);
    const cleanup = groups.reduce((n, g) => n + g.items.length, 0);
    const dups = shots.filter((s) => s.dupOf).length;
    return {
      indexed: shots.length,
      important: shots.filter((s) => s.value === 'important').length,
      dups,
      collections: colls.length,
      cleanup,
    };
  }, [shots, colls]);

  const recent = shots.slice(0, 12);
  const important = shots.filter((s) => s.value === 'important').slice(0, 6);
  const hasAny = shots.length > 0;

  return (
    <div className="screen">
      <header className="topbar">
        <div className="brand-lockup">
          <span className="brand-mark"><Icon name="brain" size={15} /></span>
          <div className="brand-text">
            <span className="brand-name">Screenshot Brain</span>
            <span className="brand-sub">by CIPHER</span>
          </div>
        </div>
        <div className="topbar-actions">
          <button className="iconbtn" aria-label="Add screenshots" onClick={() => setImporting(true)}>
            <Icon name="plus" />
          </button>
          <button className="iconbtn" aria-label="Settings" onClick={() => navigate({ name: 'settings' })}>
            <Icon name="settings" />
          </button>
        </div>
      </header>

      {!settings.geminiKey.trim() && (
        <button className="keybanner" onClick={() => navigate({ name: 'settings' })}>
          <Icon name="key" size={16} />
          <span>Add your free Gemini key to unlock AI titles & Ask Brain — <b>everything else works without it</b>.</span>
          <Icon name="chevronRight" size={15} />
        </button>
      )}

      {hasAny ? (
        <>
          <section className="stats">
            <div className="stat">
              <span className="stat-num">{stats.indexed}</span>
              <span className="stat-label">indexed</span>
            </div>
            <div className="stat">
              <span className="stat-num">{stats.important}</span>
              <span className="stat-label">important</span>
            </div>
            <div className="stat">
              <span className="stat-num">{stats.dups}</span>
              <span className="stat-label">duplicates</span>
            </div>
            <div className="stat">
              <span className="stat-num">{stats.collections}</span>
              <span className="stat-label">collections</span>
            </div>
          </section>

          <button className="askhero" onClick={() => goTab('brain')} aria-label="Ask Screenshot Brain">
            <span className="askhero-ico"><Icon name="chat" size={19} strokeWidth={1.6} /></span>
            <span className="askhero-main">
              <b>Ask your brain</b>
              <i>“What fees did I save?” · “Find my flight” · or anything at all</i>
            </span>
            <Icon name="chevronRight" size={16} className="askhero-go" />
          </button>

          {stats.cleanup > 0 && (
            <button className="cleanhint" onClick={() => goTab('cleanup')}>
              <Icon name="broom" size={16} />
              <span><b>{plural(stats.cleanup, 'screenshot')}</b> could be cleaned — duplicates, expired codes, low value.</span>
              <span className="linkbtn">Review</span>
            </button>
          )}

          <SectionHead
            label="Recent screenshots"
            action={<button className="linkbtn" onClick={() => goTab('library')}>See all</button>}
          />
          <div className="hgrid">
            {recent.map((s) => (
              <button key={s.id} className="tile" onClick={() => navigate({ name: 'detail', id: s.id })}>
                <Thumb id={s.id} alt={s.ai?.title ?? s.fileName} sensitive={s.sensitive} />
                {s.dupOf && <span className="tile-flag"><Icon name="layers" size={11} /> dup</span>}
              </button>
            ))}
          </div>

          {recentChats.length > 0 && (
            <>
              <SectionHead
                label="Recent chats"
                action={<button className="linkbtn" onClick={() => goTab('brain')}>Open Brain</button>}
              />
              <div className="list">
                {recentChats.map((c) => {
                  const last = c.messages[c.messages.length - 1];
                  return (
                    <button key={c.id} className="row chatrow" onClick={() => goTab('brain')}>
                      <span className="chatrow-ico"><Icon name="chat" size={15} /></span>
                      <span className="row-main">
                        <b>{truncate(c.title, 36)}</b>
                        <i>{truncate((last?.text ?? '').replace(/\n/g, ' '), 74)}</i>
                      </span>
                      <Icon name="chevronRight" size={16} className="row-go" />
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {important.length > 0 && (
            <>
              <SectionHead label="Important" />
              <div className="list">
                {important.map((s) => (
                  <button key={s.id} className="row" onClick={() => navigate({ name: 'detail', id: s.id })}>
                    <Thumb id={s.id} size="row" sensitive={s.sensitive} />
                    <span className="row-main">
                      <b>{s.ai?.title ?? s.fileName}</b>
                      <i>{s.ai?.summary ?? s.ocr?.slice(0, 80) ?? 'No text extracted'}</i>
                      <span className="row-meta"><ValueBadge level={s.value} /></span>
                    </span>
                    <Icon name="chevronRight" size={16} className="row-go" />
                  </button>
                ))}
              </div>
            </>
          )}

          <SectionHead
            label="Smart collections"
            action={<button className="linkbtn" onClick={() => navigate({ name: 'collections' })}>Manage</button>}
          />
          {colls.length ? (
            <div className="hgrid hgrid-colls">
              {colls.slice(0, 8).map((c) => (
                <button key={c.id} className="collcard" onClick={() => navigate({ name: 'collection', id: c.id })}>
                  <span className="coll-emoji">{c.emoji}</span>
                  <b>{c.name}</b>
                  <i>{plural(c.shotIds.length, 'shot')}</i>
                </button>
              ))}
            </div>
          ) : (
            <p className="muted-line">No collections yet — they appear automatically as your library grows.</p>
          )}

          <div className="footline">Screenshot Brain · made by CIPHER</div>
        </>
      ) : (
        <div className="home-welcome">
          <div className="home-welcome-mark"><Icon name="brain" size={34} strokeWidth={1.4} /></div>
          <h2>Your brain is empty right now.</h2>
          <p>Import a few screenshots and they will become searchable, titled and organised — all on this device.</p>
          <button className="btn btn-primary btn-big" onClick={() => setImporting(true)}>
            <Icon name="plus" size={18} /> Choose screenshots
          </button>
          {!online && <p className="muted-line small">You are offline — imports will still work, AI will wait.</p>}
        </div>
      )}

      {importing && <ImportSheet onClose={() => setImporting(false)} />}
    </div>
  );
}

export function PipeStrip() {
  const { pipe } = useApp();
  if (!pipe.running) return null;
  const pct = pipe.total > 0 ? Math.round((pipe.done / pipe.total) * 100) : 0;
  return (
    <div className="pipestrip" role="status">
      <span className="spinner spinner-sm" />
      <span className="pipestrip-label">{pipe.stage || 'Indexing…'}</span>
      <span className="pipestrip-pct">{pct}%</span>
      <div className="pipestrip-bar"><div style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

export type { Shot };
