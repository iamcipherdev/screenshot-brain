// ─── Bridge to the native Android plugin (ScreenshotBrain) ────────────────
// On web/dev this degrades gracefully: every call resolves to a safe stub.

import { Capacitor, registerPlugin } from '@capacitor/core';
import type { PluginListenerHandle } from '@capacitor/core';

export interface MediaMeta {
  uri: string;
  fileName: string;
  dateTaken: number;
  size: number;
  width: number;
  height: number;
}

export interface LoadedMedia {
  base64: string;      // jpeg, downscaled to requested max
  width: number;
  height: number;
}

export interface OcrResult {
  text: string;
  confidenceOk: boolean;
}

export interface ScreenshotBrainPluginDef {
  checkPermissions(): Promise<{ granted: boolean; limited: boolean }>;
  requestPermissions(): Promise<{ granted: boolean; limited: boolean }>;
  scanScreenshots(opts: { knownUris?: string[] }): Promise<{ items: MediaMeta[] }>;
  loadMediaImage(opts: { uri: string; maxSize?: number }): Promise<LoadedMedia>;
  recognizeText(opts: { base64: string }): Promise<OcrResult>;
  takeSharedFile(): Promise<{ found: boolean; fileName?: string; dateTaken?: number; base64?: string; width?: number; height?: number }>;
  toast(opts: { message: string }): Promise<void>;
  biometricCheck(): Promise<{ available: boolean }>;
  biometricAuthenticate(opts: { title: string; subtitle?: string }): Promise<{ ok: boolean; reason?: string }>;
  addListener(eventName: 'shareReceived', cb: () => void): Promise<PluginListenerHandle>;
}

const stub: ScreenshotBrainPluginDef = {
  async checkPermissions() { return { granted: false, limited: false }; },
  async requestPermissions() { return { granted: false, limited: false }; },
  async scanScreenshots() { return { items: [] }; },
  async loadMediaImage() { return { base64: '', width: 0, height: 0 }; },
  async recognizeText() { return { text: '', confidenceOk: false }; },
  async takeSharedFile() { return { found: false }; },
  async toast() { /* noop */ },
  async biometricCheck() { return { available: false }; },
  async biometricAuthenticate() { return { ok: false, reason: 'stub' }; },
  async addListener() {
    return { remove: async () => { /* noop */ }, addListener: async () => ({ remove: async () => {} }) } as unknown as PluginListenerHandle;
  },
};

export const ScreenshotBrain = registerPlugin<ScreenshotBrainPluginDef>('ScreenshotBrain', { web: stub });

export const isNative = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';

// ─── Permission helpers ────────────────────────────────────────────────────
export async function nativeHasMediaPermission(): Promise<boolean> {
  if (!isNative) return false;
  try {
    const r = await ScreenshotBrain.checkPermissions();
    return r.granted;
  } catch {
    return false;
  }
}

export async function nativeRequestMediaPermission(): Promise<{ granted: boolean; limited: boolean }> {
  if (!isNative) return { granted: false, limited: false };
  try {
    return await ScreenshotBrain.requestPermissions();
  } catch {
    return { granted: false, limited: false };
  }
}

// ─── Scan Screenshots folder via MediaStore ───────────────────────────────
export async function scanScreenshotsFolder(): Promise<MediaMeta[]> {
  if (!isNative) return [];
  try {
    const r = await ScreenshotBrain.scanScreenshots({});
    return r.items ?? [];
  } catch {
    return [];
  }
}

export async function loadNativeImage(uri: string, maxSize = 2048): Promise<{ blob: Blob | null; width: number; height: number }> {
  if (!isNative) return { blob: null, width: 0, height: 0 };
  try {
    const r = await ScreenshotBrain.loadMediaImage({ uri, maxSize });
    if (!r.base64) return { blob: null, width: r.width, height: r.height };
    const bin = atob(r.base64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return { blob: new Blob([arr], { type: 'image/jpeg' }), width: r.width, height: r.height };
  } catch {
    return { blob: null, width: 0, height: 0 };
  }
}

/** Native ML Kit OCR. Returns empty string when unavailable. */
export async function nativeOcr(jpegBase64: string): Promise<string> {
  if (!isNative || !jpegBase64) return '';
  try {
    const r = await ScreenshotBrain.recognizeText({ base64: jpegBase64 });
    return r.text ?? '';
  } catch {
    return '';
  }
}

/** Pop one file shared into the app (Share Target). */
export async function takeSharedFile(): Promise<{ found: boolean; fileName?: string; dateTaken?: number; blob?: Blob; width?: number; height?: number }> {
  if (!isNative) return { found: false };
  try {
    const r = await ScreenshotBrain.takeSharedFile();
    if (!r.found || !r.base64) return { found: false };
    const bin = atob(r.base64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return {
      found: true,
      fileName: r.fileName,
      dateTaken: r.dateTaken,
      blob: new Blob([arr], { type: 'image/jpeg' }),
      width: r.width,
      height: r.height,
    };
  } catch {
    return { found: false };
  }
}

export async function onShareReceived(cb: () => void): Promise<PluginListenerHandle | null> {
  if (!isNative) return null;
  try {
    return await ScreenshotBrain.addListener('shareReceived', cb);
  } catch {
    return null;
  }
}

export async function nativeToast(message: string): Promise<void> {
  if (!isNative) return;
  try { await ScreenshotBrain.toast({ message }); } catch { /* noop */ }
}
