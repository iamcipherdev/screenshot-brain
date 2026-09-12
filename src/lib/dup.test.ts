// ─── Duplicate detection + cleanup engine tests ────────────────────────────
import { describe, it, expect } from 'vitest';
import { findDuplicateOf, duplicateGroups, textSimilarity } from './dup';
import { dupGroupsDetailed, cleanupSuggestions, estimateSpare } from './cleanup';
import { hammingHex } from './util';
import type { Shot } from '../types';

function shot(id: string, hash: string, p: Partial<Shot> = {}): Shot {
  return {
    id, createdAt: Date.now() - 1000, addedAt: Date.now(),
    fileName: `${id}.jpg`, width: 1080, height: 2400, bytes: 1000,
    ocrStatus: 'done', aiStatus: 'none', value: 'useful', source: 'pick', hash, ...p,
  };
}

// hashes with known hamming distance: same char = distance 0
const H_SAME = 'abcdef0123456789';
const H_NEAR = 'abcdef0123456788';  // 1 bit? (hex digit differs)
const H_FAR = '0000000000000000';

describe('hammingHex', () => {
  it('identical hashes have distance 0', () => {
    expect(hammingHex(H_SAME, H_SAME)).toBe(0);
  });
  it('different lengths count as max distance', () => {
    expect(hammingHex('abc', 'abcd')).toBe(64);
  });
});

describe('findDuplicateOf', () => {
  it('flags near-identical images to the oldest candidate', () => {
    const keeper = shot('keeper', H_SAME, { createdAt: 1000 });
    const target = shot('target', H_NEAR, { createdAt: 2000 });
    expect(findDuplicateOf(target, [keeper])).toBe('keeper');
  });
  it('ignores visually different images', () => {
    const other = shot('other', H_FAR);
    expect(findDuplicateOf(shot('t', H_SAME), [other])).toBeNull();
  });
});

describe('duplicateGroups / dupGroupsDetailed', () => {
  it('groups near duplicates and reports similarity', () => {
    const a = shot('a', H_SAME, { createdAt: 1000 });
    const b = shot('b', H_NEAR, { createdAt: 2000 });
    const groups = dupGroupsDetailed([a, b]);
    expect(groups.length).toBe(1);
    expect(groups[0].keeper.id).toBe('a');
    expect(groups[0].extras[0].shot.id).toBe('b');
    expect(groups[0].extras[0].similarity).toBeGreaterThanOrEqual(95);
    expect(groups[0].bytesSpare).toBe(1000);
  });

  it('legacy duplicateGroups also finds the pair', () => {
    const a = shot('a', H_SAME, { createdAt: 1000 });
    const b = shot('b', H_NEAR, { createdAt: 2000 });
    expect(duplicateGroups([a, b]).length).toBe(1);
  });
});

describe('cleanupSuggestions', () => {
  it('flags duplicates, empty, blurry and expired groups with reasons', () => {
    const dup = shot('dup', H_NEAR, { createdAt: 2000, dupOf: 'keep' });
    const keep = shot('keep', H_SAME, { createdAt: 1000 });
    const empty = shot('empty', '1111111111111111', { ocr: '', ocrStatus: 'done' });
    const blurry = shot('blurry', '2222222222222222', { quality: 'blurry' });
    const old = shot('old', '3333333333333333', { value: 'temporary', createdAt: Date.now() - 40 * 86400000, ocr: 'otp 123456' });
    const { groups, totalSpare } = cleanupSuggestions([dup, keep, empty, blurry, old]);
    const ids = groups.map((g) => g.id);
    expect(ids).toContain('dups');
    expect(ids).toContain('empty');
    expect(ids).toContain('blurry');
    expect(ids).toContain('temp');
    expect(totalSpare).toBe(1000);
    for (const g of groups) for (const item of g.items) expect(item.reason.length).toBeGreaterThan(8);
  });

  it('never suggests favorited or AI-flagged shots as empty', () => {
    const fav = shot('fav', H_FAR, { ocr: '', ocrStatus: 'done', fav: true });
    const { groups } = cleanupSuggestions([fav]);
    expect(groups.find((g) => g.id === 'empty')).toBeUndefined();
  });
});

describe('textSimilarity + estimateSpare', () => {
  it('containment ratio of identical text is 1', () => {
    expect(textSimilarity('pay fee by 25 september', 'pay fee by 25 september')).toBe(1);
  });
  it('estimateSpare formats bytes readably', () => {
    expect(estimateSpare([shot('a', H_SAME, { bytes: 2048 })])).toBe('2 KB');
  });
});
