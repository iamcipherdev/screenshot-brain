// ─── Bottom navigation: Home / Search / Brain / Cleanup / Library ─────────

import React from 'react';
import { Icon } from './Icon';
import type { IconName } from './Icon';
import { useApp } from '../state/store';
import type { TabName } from '../types';
import { haptic } from '../lib/haptics';

const TABS: { id: TabName; icon: IconName; label: string }[] = [
  { id: 'home', icon: 'home', label: 'Home' },
  { id: 'search', icon: 'search', label: 'Search' },
  { id: 'brain', icon: 'brain', label: 'Brain' },
  { id: 'cleanup', icon: 'broom', label: 'Cleanup' },
  { id: 'library', icon: 'library', label: 'Library' },
];

export function BottomNav() {
  const { tab, goTab, pipe } = useApp();
  return (
    <nav className="bottomnav" aria-label="Main navigation">
      {TABS.map((t) => {
        const active = tab === t.id;
        return (
          <button
            key={t.id}
            className={`navbtn ${active ? 'active' : ''}`}
            onClick={() => { void haptic(); goTab(t.id); }}
            aria-current={active ? 'page' : undefined}
          >
            <span className="navicon">
              <Icon name={t.icon} size={21.5} strokeWidth={active ? 2 : 1.7} />
              {t.id === 'cleanup' && pipe.running && <span className="navdot" />}
            </span>
            <span className="navlabel">{t.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
