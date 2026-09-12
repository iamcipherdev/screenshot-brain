// ─── App shell: routing stack, android back, onboarding + lock gates ──────

import React, { useEffect, useRef, useState } from 'react';
import { AppProvider, useApp } from './state/store';
import { BottomNav } from './components/BottomNav';
import { Toasts } from './components/Ui';
import { PipeStrip } from './screens/Home';
import { Onboarding } from './screens/Onboarding';
import { Home } from './screens/Home';
import { SearchScreen } from './screens/SearchScreen';
import { Brain } from './screens/Brain';
import { Cleanup } from './screens/Cleanup';
import { Library } from './screens/Library';
import { Detail } from './screens/Detail';
import { Collections, CollectionView } from './screens/Collections';
import { Timeline } from './screens/Timeline';
import { Settings } from './screens/Settings';
import { LockScreen } from './components/Lock';
import { ErrorBoundary } from './components/ErrorBoundary';
import { onShareReceived, isNative } from './lib/native';
import { pipeline } from './lib/pipeline';
import { watchSystemTheme } from './lib/theme';
import { Capacitor } from '@capacitor/core';
import { Icon } from './components/Icon';

const RELOCK_AFTER_MS = 2 * 60 * 1000; // re-lock after 2 min in background

function Routes() {
  const { ready, settings, stack, tab, back, refresh, online } = useApp();
  const [locked, setLocked] = useState(false);
  const hiddenAt = useRef<number | null>(null);

  // app lock gate — engages after settings load, re-locks after long background
  useEffect(() => {
    if (ready && settings.appLock) setLocked(true);
  }, [ready, settings.appLock]);

  useEffect(() => {
    const onVis = () => {
      if (document.hidden) {
        hiddenAt.current = Date.now();
      } else if (hiddenAt.current && settings.appLock && Date.now() - hiddenAt.current > RELOCK_AFTER_MS) {
        setLocked(true);
      }
      hiddenAt.current = null;
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [settings.appLock]);

  // Android hardware back button
  useEffect(() => {
    if (Capacitor.getPlatform() !== 'android') return;
    let cancelled = false;
    void (async () => {
      try {
        const App = await import('@capacitor/app');
        if (cancelled) return;
        await App.App.addListener('backButton', () => {
          const popped = back();
          if (!popped) void App.App.exitApp();
        });
      } catch { /* noop */ }
    })();
    return () => { cancelled = true; };
  }, [back]);

  // Share target listener
  useEffect(() => {
    if (!isNative) return;
    let handle: Awaited<ReturnType<typeof onShareReceived>> = null;
    void onShareReceived(async () => {
      const n = await pipeline.importShared();
      if (n > 0) await refresh();
    }).then((h) => { handle = h; });
    // also drain anything left from a previous session
    void pipeline.importShared().then((n) => { if (n > 0) void refresh(); });
    return () => { void handle?.remove(); };
  }, [refresh]);

  // system theme watcher
  useEffect(() => watchSystemTheme(settings.theme), [settings.theme]);

  if (!ready) {
    return (
      <div className="booting">
        <div className="booting-mark">◈</div>
        <b>Screenshot Brain</b>
        <span>made by CIPHER</span>
      </div>
    );
  }

  if (locked) {
    return (
      <LockScreen
        pinHash={settings.lockPin}
        biometric={settings.biometric}
        onUnlock={() => setLocked(false)}
      />
    );
  }

  if (!settings.onboarded) {
    return (
      <OnboardingWrapper />
    );
  }

  const current = stack[stack.length - 1];
  const showNav = current.name === 'home' || current.name === 'search' || current.name === 'brain' || current.name === 'cleanup' || current.name === 'library';

  return (
    <div className="appframe">
      {!online && (
        <div className="offlinebar" role="status">
          <Icon name="wifiOff" size={13} />
          <span>Offline — OCR, search and cleanup still work. AI features wait for connection.</span>
        </div>
      )}
      <div className="screenwrap" key={stack.length + current.name}>
        <PipeStrip />
        {current.name === 'home' && <Home />}
        {current.name === 'search' && <SearchScreen />}
        {current.name === 'brain' && <Brain />}
        {current.name === 'cleanup' && <Cleanup />}
        {current.name === 'library' && <Library />}
        {current.name === 'detail' && <Detail id={current.id} />}
        {current.name === 'collections' && <Collections />}
        {current.name === 'collection' && <CollectionView id={current.id} />}
        {current.name === 'timeline' && <Timeline />}
        {current.name === 'settings' && <Settings />}
      </div>
      {showNav && <BottomNav />}
      <Toasts />
    </div>
  );
}

function OnboardingWrapper() {
  const { updateSettings, refresh } = useApp();
  return (
    <>
      <Onboarding
        onDone={async () => {
          await updateSettings({ onboarded: true });
          await refresh();
        }}
      />
      <Toasts />
    </>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <Routes />
      </AppProvider>
    </ErrorBoundary>
  );
}
