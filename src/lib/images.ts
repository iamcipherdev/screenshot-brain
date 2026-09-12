// ─── Image utilities: decode, downscale, thumbnail, perceptual hash ───────

import { getBlobs } from './db';

export interface ProcessedImage {
  full: Blob;          // ≤2048px jpeg — what we keep on device
  thumb: Blob;         // ≤512px jpeg — grids/lists
  width: number;
  height: number;
  hash: string;        // 64-bit aHash hex (from 16×16 grayscale)
  quality: 'ok' | 'blurry';  // Laplacian variance of thumbnail
}

function loadImage(src: Blob | string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not decode image'));
    if (typeof src === 'string') img.src = src;
    else img.src = URL.createObjectURL(src);
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, mime: string, q: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), mime, q);
  });
}

/** Draw source image onto a canvas constrained to maxSize (keeps aspect). */
function drawScaled(img: HTMLImageElement | ImageBitmap, maxSize: number): HTMLCanvasElement {
  const w = 'width' in img ? img.width : 0;
  const h = 'height' in img ? img.height : 0;
  const scale = Math.min(1, maxSize / Math.max(w, h));
  const cw = Math.max(1, Math.round(w * scale));
  const ch = Math.max(1, Math.round(h * scale));
  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img as CanvasImageSource, 0, 0, cw, ch);
  return canvas;
}

/** 64-bit average-hash computed from a 16×16 grayscale downscale. */
export function aHash(img: HTMLImageElement | ImageBitmap): string {
  const c = document.createElement('canvas');
  c.width = 16; c.height = 16;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img as CanvasImageSource, 0, 0, 16, 16);
  const data = ctx.getImageData(0, 0, 16, 16).data;
  const gray = new Float64Array(256);
  for (let i = 0; i < 256; i++) {
    gray[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
  }
  let avg = 0;
  for (let i = 0; i < 256; i++) avg += gray[i];
  avg /= 256;
  let hex = '';
  for (let i = 0; i < 64; i += 4) {
    let nib = 0;
    for (let j = 0; j < 4; j++) {
      nib = (nib << 1) | (gray[i + j] > avg ? 1 : 0);
    }
    hex += nib.toString(16);
  }
  return hex;
}

/** Full pipeline for one imported image file/bytes. */
export async function processImage(src: Blob): Promise<ProcessedImage> {
  const img = await loadImage(src);
  const fullCanvas = drawScaled(img, 2048);
  const thumbCanvas = drawScaled(img, 512);
  const [full, thumb] = await Promise.all([
    canvasToBlob(fullCanvas, 'image/jpeg', 0.85),
    canvasToBlob(thumbCanvas, 'image/jpeg', 0.8),
  ]);
  const score = blurScoreOfCanvas(thumbCanvas);
  return { full, thumb, width: img.naturalWidth, height: img.naturalHeight, hash: aHash(img), quality: score < 30 ? 'blurry' : 'ok' };
}

/** Laplacian variance over an already-drawn canvas (grayscale). */
function blurScoreOfCanvas(c: HTMLCanvasElement): number {
  try {
    const ctx = c.getContext('2d', { willReadFrequently: true })!;
    const scale = Math.min(1, 256 / Math.max(c.width, c.height));
    const w = Math.max(2, Math.round(c.width * scale));
    const h = Math.max(2, Math.round(c.height * scale));
    const tmp = document.createElement('canvas');
    tmp.width = w; tmp.height = h;
    const tctx = tmp.getContext('2d', { willReadFrequently: true })!;
    tctx.drawImage(c, 0, 0, w, h);
    const d = tctx.getImageData(0, 0, w, h).data;
    const gray = new Float64Array(w * h);
    for (let i = 0; i < w * h; i++) {
      gray[i] = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2];
    }
    let sum = 0, sumSq = 0, n = 0;
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        const lap = 4 * gray[i] - gray[i - 1] - gray[i + 1] - gray[i - w] - gray[i + w];
        sum += lap; sumSq += lap * lap; n++;
      }
    }
    if (!n) return 999;
    const mean = sum / n;
    return sumSq / n - mean * mean;
  } catch {
    return 999;
  }
}

/**
 * Laplacian-variance blur score (lower = blurrier). Screenshots of text have
 * high edge energy; accidental pocket shots / blurry photos score very low.
 * Runs fully on-device on a 256px grayscale downscale — fast enough for bulk.
 */
export function blurScore(src: Blob): Promise<number> {
  return (async () => {
    try {
      const img = await loadImage(src);
      const c = document.createElement('canvas');
      const scale = Math.min(1, 256 / Math.max(img.naturalWidth, img.naturalHeight));
      c.width = Math.max(2, Math.round(img.naturalWidth * scale));
      c.height = Math.max(2, Math.round(img.naturalHeight * scale));
      const ctx = c.getContext('2d', { willReadFrequently: true })!;
      ctx.drawImage(img, 0, 0, c.width, c.height);
      const d = ctx.getImageData(0, 0, c.width, c.height).data;
      const w = c.width, h = c.height;
      const gray = new Float64Array(w * h);
      for (let i = 0; i < w * h; i++) {
        gray[i] = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2];
      }
      let sum = 0, sumSq = 0, n = 0;
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          const i = y * w + x;
          const lap = 4 * gray[i] - gray[i - 1] - gray[i + 1] - gray[i - w] - gray[i + w];
          sum += lap; sumSq += lap * lap; n++;
        }
      }
      if (!n) return 0;
      const mean = sum / n;
      return sumSq / n - mean * mean; // variance
    } catch {
      return 999; // undecodable — treat as fine, don't flag
    }
  })();
}

/** Downscale an existing blob to maxSize and return jpeg blob. */
export async function downscale(src: Blob, maxSize: number, q = 0.82): Promise<Blob> {
  const img = await loadImage(src);
  const canvas = drawScaled(img, maxSize);
  return canvasToBlob(canvas, 'image/jpeg', q);
}

export async function blobToDataUrl(b: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(b);
  });
}

export async function blobToBase64(b: Blob): Promise<string> {
  const dataUrl = await blobToDataUrl(b);
  return dataUrl.slice(dataUrl.indexOf(',') + 1);
}

export async function base64ToBlob(b64: string, mime = 'image/jpeg'): Promise<Blob> {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

// ─── Object-URL cache (per shot thumb) ────────────────────────────────────

const urlCache = new Map<string, string>();
const inflight = new Map<string, Promise<string | null>>();

export async function thumbUrl(id: string): Promise<string | null> {
  const hit = urlCache.get(id);
  if (hit) return hit;
  const pending = inflight.get(id);
  if (pending) return pending;
  const p = (async () => {
    try {
      const rec = await getBlobs(id);
      if (!rec) return null;
      const url = URL.createObjectURL(rec.thumb);
      urlCache.set(id, url);
      return url;
    } catch {
      return null;
    } finally {
      inflight.delete(id);
    }
  })();
  inflight.set(id, p);
  return p;
}

export function dropThumbUrl(id: string): void {
  const u = urlCache.get(id);
  if (u) { URL.revokeObjectURL(u); urlCache.delete(id); }
}

export function clearThumbUrls(): void {
  for (const [id, u] of urlCache) { URL.revokeObjectURL(u); urlCache.delete(id); }
}

export async function fullUrl(id: string): Promise<string | null> {
  const rec = await getBlobs(id);
  if (!rec) return null;
  return URL.createObjectURL(rec.full);
}
