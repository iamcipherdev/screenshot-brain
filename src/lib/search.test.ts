// ─── Search engine tests: parsing, matching, natural language ─────────────
import { describe, it, expect } from 'vitest';
import { parseQuery, searchAll, scoreShotAgainst, retrieveForQuestion } from './search';
import type { Shot, AiMeta } from '../types';

function ai(p: Partial<AiMeta>): AiMeta {
  return {
    title: '', summary: '', category: 'other', tags: [], dates: [], phones: [],
    emails: [], urls: [], places: [], products: [], tasks: [], orgs: [], names: [],
    prices: [], deadlines: [], contentType: 'other', usefulness: 50, ...p,
  };
}

function shot(p: Partial<Shot>): Shot {
  return {
    id: 's_1', createdAt: Date.now() - 86400000 * 2, addedAt: Date.now(),
    fileName: 'Screenshot_20260910_1200.jpg', width: 1080, height: 2400,
    bytes: 250_000, ocrStatus: 'done', aiStatus: 'done', value: 'useful',
    source: 'pick', ...p,
  };
}

const LIB: Shot[] = [
  shot({
    id: 'fee1',
    ocr: 'GIFT University Fee Voucher\nTotal: Rs 48,500\nDue Date: 25 September 2026',
    ai: ai({ title: 'University fee voucher — 48,500 PKR', summary: 'Semester fee voucher from GIFT University', category: 'university', tags: ['fee', 'university', 'voucher'], prices: ['Rs 48,500'], deadlines: ['due 25 September'], contentType: 'payment' }),
  }),
  shot({
    id: 'err1',
    ocr: 'TypeError: Cannot read properties of undefined (reading "map")\n  at TaskList (App.tsx:42)',
    ai: ai({ title: 'React error — undefined map', summary: 'React crash: reading map of undefined in TaskList', category: 'code', tags: ['react', 'error'], contentType: 'code' }),
  }),
  shot({
    id: 'prod1',
    ocr: 'Wireless Earbuds Pro\nRs 4,299 — Free delivery\nAdd to cart',
    ai: ai({ title: 'Earbuds Pro — Rs 4,299', summary: 'Product page for wireless earbuds', category: 'shopping', tags: ['earbuds', 'product'], prices: ['Rs 4,299'], products: ['Wireless Earbuds Pro'], contentType: 'webpage' }),
  }),
  shot({
    id: 'old1',
    createdAt: Date.now() - 86400000 * 40,
    ocr: 'Your OTP is 491820. Expires in 5 minutes.',
    ai: ai({ title: 'OTP code', summary: 'One-time password', category: 'temporary', tags: ['otp'], contentType: 'chat' }),
    value: 'temporary',
  }),
];

describe('parseQuery', () => {
  it('extracts quoted phrases', () => {
    const q = parseQuery('"total amount"');
    expect(q.phrases).toContain('total amount');
  });

  it('parses price ceilings in natural language', () => {
    expect(parseQuery('product under Rs 5,000').maxPrice).toBe(5000);
    expect(parseQuery('earbuds below 4000').maxPrice).toBe(4000);
    expect(parseQuery('over 1000').minPrice).toBe(1000);
  });

  it('parses relative time phrases', () => {
    expect(parseQuery('receipt from last week').bucket).toBe('week');
    expect(parseQuery('this month').bucket).toBe('month');
    expect(parseQuery('yesterday').bucket).toBe('yesterday');
  });

  it('drops filler words instead of requiring them', () => {
    const q = parseQuery('receipt from last week');
    expect(q.terms).not.toContain('from');
    expect(q.bucket).toBe('week');
  });

  it('supports tag filters', () => {
    expect(parseQuery('tag:react').tagFilter).toBe('react');
  });
});

describe('searchAll', () => {
  it('finds by OCR text', () => {
    const hits = searchAll(LIB, '48,500');
    expect(hits.some((h) => h.shot.id === 'fee1')).toBe(true);
  });

  it('matches natural language with reasons', () => {
    const hits = searchAll(LIB, 'university fee');
    expect(hits[0]?.shot.id).toBe('fee1');
    expect(hits[0]?.reasons.length).toBeGreaterThan(0);
  });

  it('price filter keeps only shots within range', () => {
    const hits = searchAll(LIB, 'product under Rs 5000');
    expect(hits.map((h) => h.shot.id)).toContain('prod1');
    expect(hits.map((h) => h.shot.id)).not.toContain('fee1'); // 48,500 > 5,000
  });

  it('semantic fallback maps related words', () => {
    // "receipt" has no direct receipt-type shot, but semantic ≈ total/invoice reaches the fee voucher
    const hits = searchAll(LIB, 'receipt from last week');
    expect(hits.some((h) => h.shot.id === 'fee1')).toBe(true);
    const otp = searchAll(LIB, 'otp');
    expect(otp.some((h) => h.shot.id === 'old1')).toBe(true);
  });

  it('date bucket filters', () => {
    const hits = searchAll(LIB, 'otp older');
    expect(hits.some((h) => h.shot.id === 'old1')).toBe(true);
  });

  it('returns [] for empty queries', () => {
    expect(searchAll(LIB, '')).toEqual([]);
  });

  it('ignores soft-deleted shots', () => {
    const lib = [shot({ id: 'gone', deletedAt: Date.now(), ocr: 'turkey travel istanbul' }), ...LIB];
    const hits = searchAll(lib, 'turkey travel');
    expect(hits.some((h) => h.shot.id === 'gone')).toBe(false);
  });
});

describe('retrieveForQuestion', () => {
  it('blends recent analyzed shots when search misses', () => {
    const ctx = retrieveForQuestion(LIB, 'what is the meaning of life', 4);
    expect(ctx.length).toBeGreaterThan(0);
    expect(ctx.length).toBeLessThanOrEqual(4);
  });

  it('excludes AI-excluded shots', () => {
    const lib = [shot({ id: 'secret', ai: ai({ title: 'Secret doc' }), aiExcluded: true }), ...LIB];
    const ctx = retrieveForQuestion(lib, 'secret doc', 10);
    expect(ctx.some((s) => s.id === 'secret')).toBe(false);
  });
});

describe('scoreShotAgainst reasons', () => {
  it('labels entity matches', () => {
    const hit = scoreShotAgainst(LIB[0], parseQuery('gift university'));
    expect(hit).not.toBeNull();
    expect(hit!.reasons.some((r) => ['ocr', 'title', 'summary', 'tag', 'semantic', 'entity'].includes(r.field))).toBe(true);
  });
});
