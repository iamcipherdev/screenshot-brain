// ─── Light haptic feedback on Android (no-op on web) ──────────────────────

import { Capacitor } from '@capacitor/core';

export async function haptic(style: 'light' | 'medium' = 'light'): Promise<void> {
  if (Capacitor.getPlatform() !== 'android') return;
  try {
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
    await Haptics.impact({ style: style === 'light' ? ImpactStyle.Light : ImpactStyle.Medium });
  } catch {
    /* noop */
  }
}
