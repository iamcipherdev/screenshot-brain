// ─── Lazy-loading thumbnail with object-URL cache + privacy blur ──────────

import React, { useEffect, useRef, useState } from 'react';
import { thumbUrl } from '../lib/images';
import { Icon } from './Icon';

export function Thumb({ id, alt, size = 'grid', sensitive }: { id: string; alt?: string; size?: 'grid' | 'row' | 'strip'; sensitive?: boolean }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setVisible(true);
            io.disconnect();
          }
        }
      },
      { rootMargin: '250px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    let alive = true;
    void thumbUrl(id).then((u) => {
      if (alive) setUrl(u);
      if (alive && !u) setFailed(true);
    });
    return () => { alive = false; };
  }, [visible, id]);

  return (
    <div ref={ref} className={`thumb thumb-${size} ${sensitive ? 'thumb-sensitive' : ''}`}>
      {url ? (
        <img src={url} alt={sensitive ? '' : (alt ?? '')} loading="lazy" decoding="async" draggable={false} aria-hidden={sensitive || undefined} />
      ) : failed ? (
        <div className="thumb-fallback"><Icon name="image" size={size === 'row' ? 16 : 22} /></div>
      ) : (
        <div className="thumb-shimmer" />
      )}
      {sensitive && (
        <span className="thumb-lock" aria-label="Protected screenshot"><Icon name="eye" size={size === 'strip' ? 10 : 14} /></span>
      )}
    </div>
  );
}
