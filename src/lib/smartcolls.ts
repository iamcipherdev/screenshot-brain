// ─── Smart collections: rule-derived, always in sync, user can delete ─────
// Auto collections mirror rules like "category = university" or
// "value = important". They refresh on every library load and never
// contain anything the rules don't justify.

import type { Collection, Shot } from '../types';

interface SmartRule {
  slug: string;
  name: string;
  emoji: string;
  match: (s: Shot) => boolean;
}

const tag = (s: Shot, ...words: string[]) => (s.ai?.tags ?? []).some((t) => words.some((w) => t.includes(w)));
const ocr = (s: Shot, re: RegExp) => re.test(s.ocr ?? '');

const RULES: SmartRule[] = [
  {
    slug: 'smart-university', name: 'University', emoji: '🎓',
    match: (s) => s.ai?.category === 'university' || s.ai?.category === 'study'
      || tag(s, 'university', 'college', 'campus', 'exam', 'result', 'semester')
      || ocr(s, /\b(university|semester|midterm|final term|cgpa|marks)\b/i),
  },
  {
    slug: 'smart-jobs', name: 'Job Applications', emoji: '💼',
    match: (s) => s.ai?.category === 'jobs'
      || tag(s, 'job', 'hiring', 'internship', 'vacancy', 'career')
      || ocr(s, /\b(job|internship|vacancy|hiring|apply now|position)\b/i),
  },
  {
    slug: 'smart-travel', name: 'Travel', emoji: '✈️',
    match: (s) => s.ai?.category === 'travel'
      || tag(s, 'travel', 'flight', 'hotel', 'trip', 'visa', 'tour')
      || ocr(s, /\b(flight|boarding pass|pnr|booking|hotel|airport)\b/i),
  },
  {
    slug: 'smart-receipts', name: 'Receipts', emoji: '🧾',
    match: (s) => s.ai?.category === 'receipts' || s.ai?.contentType === 'receipt'
      || tag(s, 'receipt', 'invoice', 'bill', 'payment')
      || ocr(s, /\b(receipt|invoice|paid|total amount|transaction)\b/i),
  },
  {
    slug: 'smart-products', name: 'Products', emoji: '🛒',
    match: (s) => s.ai?.category === 'shopping' || (s.ai?.prices?.length ?? 0) > 0 && (s.ai?.products?.length ?? 0) > 0
      || tag(s, 'shopping', 'product', 'price', 'cart', 'deal'),
  },
  {
    slug: 'smart-dev-errors', name: 'Development Errors', emoji: '🛠️',
    match: (s) => s.ai?.category === 'code' || s.ai?.category === 'development'
      || tag(s, 'error', 'bug', 'react', 'exception', 'code')
      || ocr(s, /\b(exception|traceback|cannot read|undefined is not|error:)\b/i),
  },
  {
    slug: 'smart-documents', name: 'Documents', emoji: '📄',
    match: (s) => s.ai?.category === 'documents' || s.ai?.contentType === 'document'
      || tag(s, 'document', 'cnic', 'passport', 'license', 'certificate'),
  },
  {
    slug: 'smart-important', name: 'Important', emoji: '⭐',
    match: (s) => s.value === 'important' || Boolean(s.fav),
  },
];

/**
 * Upsert auto collections so they always mirror the current library.
 * Returns the full list (manual first, then smart). Auto collections with
 * zero members are removed to avoid clutter.
 */
export async function syncSmartCollections(
  shots: Shot[],
  putColl: (c: Collection) => Promise<void>,
  delColl: (id: string) => Promise<void>,
  excluded: Set<string> = new Set(),
): Promise<Collection[]> {
  const live = shots.filter((s) => !s.deletedAt);

  for (const rule of RULES) {
    if (excluded.has(rule.slug)) continue;
    const ids = live.filter(rule.match).map((s) => s.id);
    if (ids.length === 0) {
      await delColl(rule.slug).catch(() => undefined);
      continue;
    }
    await putColl({ id: rule.slug, name: rule.name, emoji: rule.emoji, auto: true, createdAt: Date.now(), shotIds: ids });
  }
  return listFromRules(live, excluded);
}

/** The smart collections as pure derived data (for callers that just read). */
export function listFromRules(live: Shot[], excluded: Set<string> = new Set()): Collection[] {
  const out: Collection[] = [];
  for (const rule of RULES) {
    if (excluded.has(rule.slug)) continue;
    const ids = live.filter(rule.match).map((s) => s.id);
    if (ids.length) out.push({ id: rule.slug, name: rule.name, emoji: rule.emoji, auto: true, createdAt: 0, shotIds: ids });
  }
  return out;
}
