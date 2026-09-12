// ─── Value scoring + utility tests ─────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { scoreShot } from './value';
import { plural, truncate, fmtBytes, hammingHex, uid, dayBucket, debounce } from './util';
import type { Shot } from '../types';

function shot(p: Partial<Shot>): Shot {
  return {
    id: 's_1', createdAt: Date.now(), addedAt: Date.now(),
    fileName: 'x.jpg', width: 1080, height: 2400, bytes: 1000,
    ocrStatus: 'done', aiStatus: 'none', value: 'useful', source: 'pick', ...p,
  };
}

describe('scoreShot', () => {
  it('OTP text is temporary with a reason', () => {
    const r = scoreShot(shot({ ocr: 'G-491820 is your Google verification code' }));
    expect(r.value).toBe('temporary');
    expect(r.reason).toMatch(/one-time|code/i);
  });

  it('fee vouchers are important', () => {
    const r = scoreShot(shot({ ocr: 'Fee Voucher  GIFT University\nDue Date: 25 Sep' }));
    expect(r.value).toBe('important');
  });

  it('duplicates stay duplicate', () => {
    const r = scoreShot(shot({ dupOf: 's_0', ocr: 'whatever' }));
    expect(r.value).toBe('duplicate');
  });

  it('no readable text means low value', () => {
    const r = scoreShot(shot({ ocr: '', ocrStatus: 'done' }));
    expect(r.value).toBe('low');
  });

  it('plain text is useful', () => {
    const r = scoreShot(shot({ ocr: 'meeting notes from the standup today' }));
    expect(r.value).toBe('useful');
  });
});

describe('util', () => {
  it('plural handles 1 and many', () => {
    expect(plural(1, 'screenshot')).toBe('1 screenshot');
    expect(plural(3, 'screenshot')).toBe('3 screenshots');
  });

  it('truncate shortens with ellipsis', () => {
    expect(truncate('hello world', 8)).toBe('hello w…');
    expect(truncate('short', 20)).toBe('short');
  });

  it('fmtBytes scales', () => {
    expect(fmtBytes(500)).toBe('500 B');
    expect(fmtBytes(2048)).toBe('2 KB');
    expect(fmtBytes(3 * 1024 * 1024)).toBe('3.0 MB');
  });

  it('hammingHex counts bit differences', () => {
    expect(hammingHex('0f', '0f')).toBe(0);
    expect(hammingHex('0f', '0e')).toBe(1);
  });

  it('uid produces prefixed unique ids', () => {
    const a = uid('s_'); const b = uid('s_');
    expect(a.startsWith('s_')).toBe(true);
    expect(a).not.toBe(b);
  });

  it('dayBucket classifies today', () => {
    expect(dayBucket(Date.now())).toBe('today');
  });

  it('debounce delays execution', () => {
    let calls = 0;
    const fn = debounce(() => { calls++; }, 10);
    fn(); fn(); fn();
    return new Promise<void>((resolve) => setTimeout(() => {
      expect(calls).toBe(1);
      resolve();
    }, 40));
  });
});
