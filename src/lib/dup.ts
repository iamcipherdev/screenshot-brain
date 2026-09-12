// ─── Duplicate detection: perceptual hash + OCR text similarity ───────────

import { hammingHex } from './util';
import type { Shot } from '../types';

export const EXACT_HASH = 0;     // identical images
export const NEAR_HASH = 6;      // same screenshot, tiny pixels differ (status bar clock etc)
export const SIMILAR_HASH = 11;  // very similar — maybe re-crop / re-screenshot

export function isDuplicatePair(a: Shot, b: Shot): { dup: boolean; exact: boolean } {
  if (!a.hash || !b.hash) return { dup: false, exact: false };
  const d = hammingHex(a.hash, b.hash);
  if (d <= NEAR_HASH) return { dup: true, exact: d <= EXACT_HASH };
  return { dup: false, exact: false };
}

export function isSimilarPair(a: Shot, b: Shot): boolean {
  if (!a.hash || !b.hash) return false;
  const d = hammingHex(a.hash, b.hash);
  return d > NEAR_HASH && d <= SIMILAR_HASH;
}

function normTokens(s: string): Set<string> {
  return new Set(
    (s.toLowerCase().match(/[a-z0-9]+/g) ?? [])
      .filter((t) => t.length > 2 && !STOP.has(t)),
  );
}

const STOP = new Set(['the', 'and', 'for', 'with', 'this', 'that', 'your', 'from', 'have', 'not', 'are', 'was', 'will', 'you', 'all', 'any', 'can', 'out', 'www', 'com']);

export function textSimilarity(a: string, b: string): number {
  const ta = normTokens(a);
  const tb = normTokens(b);
  if (!ta.size || !tb.size) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  return inter / Math.min(ta.size, tb.size); // containment ratio
}

/**
 * Find duplicates for `target` among candidates (usually the whole library —
 * cheap: only hashes compared in memory). Returns the id of the keeper, or
 * null if no duplicate found. The OLDEST shot wins as keeper.
 */
export function findDuplicateOf(target: Shot, candidates: Shot[]): string | null {
  let best: { id: string; dist: number } | null = null;
  for (const c of candidates) {
    if (c.id === target.id || !c.hash) continue;
    const d = hammingHex(target.hash ?? '', c.hash);
    if (d <= NEAR_HASH) {
      if (!best || d < best.dist) best = { id: c.id, dist: d };
    }
  }
  return best?.id ?? null;
}

/** Groups of near-duplicates across the whole library (for Cleanup). */
export function duplicateGroups(shots: Shot[]): Shot[][] {
  const withHash = shots.filter((s) => s.hash);
  const used = new Set<string>();
  const groups: Shot[][] = [];
  const sorted = [...withHash].sort((a, b) => a.createdAt - b.createdAt); // oldest first = keeper first
  for (const s of sorted) {
    if (used.has(s.id)) continue;
    const group = [s];
    for (const o of sorted) {
      if (o.id === s.id || used.has(o.id) || !o.hash) continue;
      if (hammingHex(s.hash!, o.hash) <= NEAR_HASH) {
        group.push(o);
        used.add(o.id);
      }
    }
    if (group.length > 1) {
      groups.push(group);
      used.add(s.id);
    }
  }
  // include shots already flagged dupOf that lost their group
  const flagged = shots.filter((s) => s.dupOf && !used.has(s.id));
  for (const f of flagged) {
    const keeper = shots.find((x) => x.id === f.dupOf);
    if (keeper) groups.push([keeper, f]);
  }
  return groups;
}
