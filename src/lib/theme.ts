// ─── Theme handling: system / light / dark with CSS variables ─────────────

export type ThemePref = 'system' | 'light' | 'dark';

export function applyTheme(pref: ThemePref): void {
  const root = document.documentElement;
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const dark = pref === 'dark' || (pref === 'system' && systemDark);
  root.dataset.theme = dark ? 'dark' : 'light';
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', dark ? '#0F1110' : '#F7F6F2');
}

export function watchSystemTheme(pref: ThemePref): () => void {
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const fn = () => { if (pref === 'system') applyTheme('system'); };
  mq.addEventListener('change', fn);
  return () => mq.removeEventListener('change', fn);
}
