// ─── Global app state: navigation stack, data, settings, theme, toasts ────

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { Route, TabName } from '../types';
import type { AppSettings, Collection, Shot } from '../types';
import {
  loadSettings, saveSettings as persistSettings, listShots, listColls, removeShots,
  softDeleteShots, restoreShots, nukeEverything, migrateLegacyChat,
  saveColl, deleteColl as dbDeleteColl, DEFAULT_SETTINGS,
} from '../lib/repo';
import { kvGet, kvSet } from '../lib/db';
import { listFromRules } from '../lib/smartcolls';
import { pipeline } from '../lib/pipeline';
import type { PipelineState } from '../lib/pipeline';
import { applyTheme } from '../lib/theme';
import { uid } from '../lib/util';

export interface Toast {
  id: string; text: string; kind: 'ok' | 'warn' | 'err';
  action?: { label: string; run: () => void };  // e.g. Undo
}

interface AppState {
  ready: boolean;
  settings: AppSettings;
  shots: Shot[];
  colls: Collection[];
  online: boolean;
  pipe: PipelineState;
  toasts: Toast[];
  stack: Route[];
  tab: TabName;
  askPrefill: string;                 // question queued for Brain (from Detail)
  // actions
  refresh: () => Promise<void>;
  updateSettings: (patch: Partial<AppSettings>) => Promise<void>;
  navigate: (r: Route) => void;
  goTab: (t: TabName) => void;
  back: () => boolean;
  toast: (text: string, kind?: Toast['kind'], action?: Toast['action']) => void;
  deleteShots: (ids: string[], opts?: { undoable?: boolean }) => Promise<void>;
  restore: (ids: string[]) => Promise<void>;
  removeCollection: (id: string) => Promise<void>;
  wipe: () => Promise<void>;
  setAskPrefill: (q: string) => void;
}

const Ctx = createContext<AppState | null>(null);

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp outside provider');
  return v;
}

const TAB_ROOTS: Record<TabName, Route> = {
  home: { name: 'home' },
  search: { name: 'search' },
  brain: { name: 'brain' },
  cleanup: { name: 'cleanup' },
  library: { name: 'library' },
};

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [shots, setShots] = useState<Shot[]>([]);
  const [colls, setColls] = useState<Collection[]>([]);
  const [online, setOnline] = useState<boolean>(navigator.onLine);
  const [pipe, setPipe] = useState<PipelineState>(pipeline.state);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [stack, setStack] = useState<Route[]>([{ name: 'home' }]);
  const [tab, setTab] = useState<TabName>('home');
  const [askPrefill, setAskPrefill] = useState('');
  const refreshing = useRef(false);

  const refresh = useCallback(async () => {
    if (refreshing.current) return;
    refreshing.current = true;
    try {
      const [s, c] = await Promise.all([listShots(), listColls()]);
      // smart collections are derived live — they always mirror the library
      const excluded = new Set<string>((await kvGet<string[]>('smartDeleted')) ?? []);
      const manual = c.filter((x) => !x.auto && !excluded.has(x.id));
      const smart = listFromRules(s, excluded).filter((sm) => !manual.some((m) => m.name === sm.name));
      setShots(s);
      setColls([...manual, ...smart]);
    } finally {
      refreshing.current = false;
    }
  }, []);

  // boot
  useEffect(() => {
    (async () => {
      await migrateLegacyChat().catch(() => undefined);
      const s = await loadSettings();
      setSettings(s);
      applyTheme(s.theme);
      await refresh();
      setReady(true);
    })();
  }, [refresh]);

  // pipeline progress
  useEffect(() => {
    const off = pipeline.on((st) => {
      setPipe(st);
      if (!st.running) void refresh();
    });
    return off;
  }, [refresh]);

  // online/offline
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  const toast = useCallback((text: string, kind: Toast['kind'] = 'ok', action?: Toast['action']) => {
    const t: Toast = { id: uid('t_'), text, kind, action };
    setToasts((prev) => [...prev.slice(-2), t]);
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== t.id)), action ? 6500 : 3800);
  }, []);

  const updateSettings = useCallback(async (patch: Partial<AppSettings>) => {
    const next = await persistSettings(patch);
    setSettings(next);
    if (patch.theme) applyTheme(patch.theme);
  }, []);

  const navigate = useCallback((r: Route) => {
    setStack((prev) => [...prev, r]);
  }, []);

  const goTab = useCallback((t: TabName) => {
    setTab(t);
    setStack([TAB_ROOTS[t]]);
  }, []);

  const back = useCallback((): boolean => {
    let popped = false;
    setStack((prev) => {
      if (prev.length > 1) {
        popped = true;
        return prev.slice(0, -1);
      }
      // if on a non-home tab root, back goes home
      const root = prev[0];
      if (root && root.name !== 'home') {
        popped = true;
        setTab('home');
        return [TAB_ROOTS.home];
      }
      return prev;
    });
    return popped;
  }, []);

  const deleteShots = useCallback(async (ids: string[], opts?: { undoable?: boolean }) => {
    if (opts?.undoable) {
      await softDeleteShots(ids);
      await refresh();
      toast(`Moved ${ids.length === 1 ? '1 screenshot' : `${ids.length} screenshots`} to trash`, 'ok', {
        label: 'Undo',
        run: () => { void (async () => { await restoreShots(ids); await refresh(); })(); },
      });
    } else {
      await removeShots(ids);
      await refresh();
    }
  }, [refresh, toast]);

  const restore = useCallback(async (ids: string[]) => {
    await restoreShots(ids);
    await refresh();
  }, [refresh]);

  const wipe = useCallback(async () => {
    await nukeEverything();
    setStack([TAB_ROOTS.home]);
    setTab('home');
    await refresh();
  }, [refresh]);

  const removeCollection = useCallback(async (id: string) => {
    await dbDeleteColl(id);
    if (id.startsWith('smart-')) {
      const prev = (await kvGet<string[]>('smartDeleted')) ?? [];      await kvSet('smartDeleted', [...new Set([...prev, id])]);
    }
    await refresh();
  }, [refresh]);

  const value = useMemo<AppState>(() => ({
    ready, settings, shots, colls, online, pipe, toasts, stack, tab, askPrefill,
    refresh, updateSettings, navigate, goTab, back, toast, deleteShots, restore, removeCollection, wipe, setAskPrefill,
  }), [ready, settings, shots, colls, online, pipe, toasts, stack, tab, askPrefill, refresh, updateSettings, navigate, goTab, back, toast, deleteShots, restore, removeCollection, wipe]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
