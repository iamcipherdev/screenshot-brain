// ─── Search: natural-language search with match reasons ───────────────────

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../state/store';
import { Icon } from '../components/Icon';
import { Thumb } from '../components/Thumb';
import { Empty } from '../components/Ui';
import { searchAll, summarizeQuery, SEARCH_HINTS } from '../lib/search';
import { fmtDateShort } from '../lib/util';
import type { SearchHit } from '../types';
import { haptic } from '../lib/haptics';

export function SearchScreen() {
  const { shots, navigate } = useApp();
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 140);
    return () => clearTimeout(t);
  }, [q]);

  const hits = useMemo<SearchHit[]>(() => searchAll(shots, debounced), [shots, debounced]);

  const summary = debounced ? summarizeQuery(debounced) : '';

  return (
    <div className="screen">
      <header className="searchhead">
        <div className="searchbox">
          <Icon name="search" size={18} />
          <input
            ref={inputRef}
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="What do you remember?"
            enterKeyHint="search"
          />
          {q && <button className="iconbtn" onClick={() => { setQ(''); inputRef.current?.focus(); }} aria-label="Clear"><Icon name="x" size={16} /></button>}
        </div>
      </header>

      {!debounced && (
        <div className="search-home">
          <p className="search-lede">Search inside your screenshots — text, meaning, tags, dates. Ask the way you remember it.</p>
          <div className="hintgrid">
            {SEARCH_HINTS.map((h) => (
              <button key={h} className="hintchip" onClick={() => { void haptic(); setQ(h); }}>
                <Icon name="search" size={13} /> {h}
              </button>
            ))}
          </div>
          <div className="search-syntax muted-line">
            <b>Tricks:</b> quotes for exact phrases · <i>tag:react</i> · <i>category:finance</i> · “under Rs 5000” · “last week” · <i>duplicates</i>
          </div>
        </div>
      )}

      {debounced && (
        <div className="search-results">
          <div className="search-count">
            {summary ? <span className="search-summary">{summary}</span> : null}
            <b>{hits.length ? `${hits.length} result${hits.length === 1 ? '' : 's'}` : 'No results'}</b>
          </div>

          {hits.length === 0 ? (
            <Empty
              icon="search"
              title="Nothing matched"
              sub="Try fewer words, or check the AI title of the screenshot — add a Gemini key in Settings to make results smarter."
            />
          ) : (
            <div className="list">
              {hits.map((h) => (
                <button key={h.shot.id} className="row" onClick={() => navigate({ name: 'detail', id: h.shot.id })}>
                  <Thumb id={h.shot.id} size="row" alt={h.shot.ai?.title ?? h.shot.fileName} sensitive={h.shot.sensitive} />
                  <span className="row-main">
                    <b>{h.shot.ai?.title ?? h.shot.fileName}</b>
                    <i>{h.shot.ai?.summary ?? h.shot.ocr?.slice(0, 90) ?? 'No text extracted'}</i>
                    <span className="match-reasons">
                      {h.reasons.slice(0, 2).map((r, i) => (
                        <span key={i} className="match-reason"><Icon name="zap" size={11} /> {r.detail}</span>
                      ))}
                      <span className="match-date">{fmtDateShort(h.shot.createdAt)}</span>
                    </span>
                  </span>
                  <Icon name="chevronRight" size={16} className="row-go" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
