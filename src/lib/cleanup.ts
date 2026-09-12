// ─── Cleanup engine: duplicate groups, blur, empty, low-info, outdated ────
// Pure analysis — nothing here deletes anything. Every item carries a reason.

import type { Shot } from '../types';
import { hammingHex, fmtBytes } from './util';

export interface DupGroup {
  keeper: Shot;
  extras: { shot: Shot; similarity: number }[];  // 0–100
  bytesSpare: number;                            // reclaimable if extras removed
}

export interface CleanupSuggestion {
  shot: Shot;
  reason: string;
  groupId: 'dups' | 'temp' | 'stale' | 'low' | 'empty' | 'blurry';
}

export interface CleanupGroup {
  id: CleanupSuggestion['groupId'];
  title: string;
  blurb: string;
  items: CleanupSuggestion[];
}

/** All near-duplicate groups, best keeper first inside each group. */
export function dupGroupsDetailed(shots: Shot[]): DupGroup[] {
  const withHash = shots.filter((s) => s.hash && !s.deletedAt);
  const used = new Set<string>();
  const groups: DupGroup[] = [];
  const sorted = [...withHash].sort((a, b) => a.createdAt - b.createdAt); // oldest first = keeper first
  for (const s of sorted) {
    if (used.has(s.id)) continue;
    const extras: DupGroup['extras'] = [];
    for (const o of sorted) {
      if (o.id === s.id || used.has(o.id) || !o.hash) continue;
      const d = hammingHex(s.hash!, o.hash);
      if (d <= 6) {
        extras.push({ shot: o, similarity: Math.round((1 - d / 64) * 100) });
        used.add(o.id);
      }
    }
    if (extras.length) {
      groups.push({
        keeper: s,
        extras: extras.sort((a, b) => b.similarity - a.similarity),
        bytesSpare: extras.reduce((n, e) => n + e.shot.bytes, 0),
      });
      used.add(s.id);
    }
  }
  // include shots already flagged dupOf whose hash pair drifted apart
  const flagged = shots.filter((s) => s.dupOf && !used.has(s.id) && !s.deletedAt);
  for (const f of flagged) {
    const keeper = shots.find((x) => x.id === f.dupOf && !x.deletedAt);
    if (!keeper) continue;
    const existing = groups.find((g) => g.keeper.id === keeper.id);
    const sim = pairSimilarity(keeper, f);
    if (existing) {
      if (!existing.extras.some((e) => e.shot.id === f.id)) {
        existing.extras.push({ shot: f, similarity: sim });
        existing.bytesSpare += f.bytes;
      }
    } else {
      groups.push({ keeper, extras: [{ shot: f, similarity: sim }], bytesSpare: f.bytes });
    }
    used.add(f.id);
  }
  return groups;
}

export function pairSimilarity(a: Shot, b: Shot): number {
  if (!a.hash || !b.hash) return 0;
  const d = hammingHex(a.hash, b.hash);
  return Math.round((1 - d / 64) * 100);
}

/** Full suggestion set for the Cleanup screen. */
export function cleanupSuggestions(shots: Shot[]): { groups: CleanupGroup[]; totalSpare: number } {
  const live = shots.filter((s) => !s.deletedAt);
  const groups: CleanupGroup[] = [];
  let totalSpare = 0;

  // 1) duplicates
  const dups = dupGroupsDetailed(live);
  const dupItems: CleanupSuggestion[] = [];
  for (const g of dups) {
    totalSpare += g.bytesSpare;
    for (const e of g.extras) {
      dupItems.push({
        shot: e.shot,
        groupId: 'dups',
        reason: `${e.similarity}% same as “${(g.keeper.ai?.title ?? g.keeper.fileName).slice(0, 40)}” from keeper set — this copy adds nothing`,
      });
    }
  }
  if (dupItems.length) {
    groups.push({ id: 'dups', title: 'Duplicates', blurb: `Same or nearly the same image · ~${fmtBytes(totalSpare)} recoverable`, items: dupItems });
  }

  // 2) blurred / likely accidental
  const blurry = live.filter((s) => s.quality === 'blurry' && !s.dupOf && s.value !== 'important');
  if (blurry.length) {
    groups.push({
      id: 'blurry',
      title: 'Blurred or accidental',
      blurb: 'Sharpness analysis found very little detail — likely pocket shots or bad captures.',
      items: blurry.map((s) => ({ shot: s, groupId: 'blurry', reason: 'Image is blurred or has almost no visible detail (checked on-device)' })),
    });
  }

  // 3) old temporary
  const monthAgo = Date.now() - 30 * 86400000;
  const temps = live.filter((s) => s.value === 'temporary' && s.createdAt < monthAgo);
  if (temps.length) {
    groups.push({
      id: 'temp',
      title: 'Expired one-time content',
      blurb: 'OTP codes and short notices that stopped being useful long ago.',
      items: temps.map((s) => ({ shot: s, groupId: 'temp', reason: `Temporary code / notice from ${new Date(s.createdAt).toLocaleDateString()} — almost certainly expired by now` })),
    });
  }

  // 4) AI says outdated
  const stale = live.filter((s) => s.ai?.outdated && s.value !== 'temporary');
  if (stale.length) {
    groups.push({
      id: 'stale',
      title: 'Possibly outdated',
      blurb: 'Info in these looks expired or superseded.',
      items: stale.map((s) => ({ shot: s, groupId: 'stale', reason: `AI marked as outdated: ${s.ai!.outdated}` })),
    });
  }

  // 5) empty — nothing readable, nothing AI-visible
  const empty = live.filter((s) =>
    s.ocrStatus === 'done' && !(s.ocr ?? '').trim() && !s.ai && !s.fav && !s.dupOf && s.quality !== 'blurry');
  if (empty.length) {
    groups.push({
      id: 'empty',
      title: 'Empty screenshots',
      blurb: 'No text found and no AI summary — possibly accidental or blank captures.',
      items: empty.map((s) => ({ shot: s, groupId: 'empty', reason: 'Nothing readable was found in this screenshot' })),
    });
  }

  // 6) low value
  const low = live.filter((s) => s.value === 'low' && !s.fav && !s.dupOf && !empty.includes(s));
  if (low.length) {
    groups.push({
      id: 'low',
      title: 'Low value',
      blurb: 'Memes, wallpapers, shots with little long-term value. Your call.',
      items: low.map((s) => ({ shot: s, groupId: 'low', reason: s.valueReason || 'No readable text and little long-term value' })),
    });
  }

  return { groups, totalSpare };
}

/** Estimated storage that selected shots would free inside the app. */
export function estimateSpare(shots: Shot[]): string {
  return fmtBytes(shots.reduce((n, s) => n + s.bytes, 0));
}
