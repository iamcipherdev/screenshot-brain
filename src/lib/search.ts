// ─── Search service: instant, cross-field, natural-language aware ─────────
// Searches OCR text, AI titles/summaries, tags, categories, file names and
// dates. Explains WHY each result matched.

import type { Category, MatchReason, SearchHit, Shot } from '../types';
import { CATEGORIES, CATEGORY_LABELS } from '../types';
import { dayBucket } from './util';

interface Query {
  terms: string[];          // individual tokens
  phrases: string[];        // "quoted phrases"
  category?: Category;
  bucket?: 'today' | 'yesterday' | 'week' | 'month' | 'older';
  favorites?: boolean;
  duplicates?: boolean;
  tagFilter?: string;
  maxPrice?: number;        // "under 5000", "below rs 5,000"
  minPrice?: number;        // "over 1000", "above 1,000"
}

// Words that become a hard CATEGORY FILTER only when typed after "category:"
const CATEGORY_SYNONYMS: Record<string, Category> = {
  work: 'work', office: 'work', meeting: 'work', job: 'work',
  study: 'study', university: 'study', college: 'study', school: 'study', exam: 'study', class: 'study',
  code: 'code', coding: 'code', programming: 'code', error: 'code', errors: 'code', react: 'code', bug: 'code', bugs: 'code',
  shopping: 'shopping', cart: 'shopping', order: 'shopping', price: 'shopping', prices: 'shopping',
  travel: 'travel', flight: 'travel', flights: 'travel', trip: 'travel', trips: 'travel', hotel: 'travel', hotels: 'travel', ticket: 'travel', tickets: 'travel',
  finance: 'finance', fee: 'finance', fees: 'finance', bank: 'finance', payment: 'finance', payments: 'finance', invoice: 'finance', invoices: 'finance',
  money: 'finance', bill: 'finance', bills: 'finance',
  social: 'social', chat: 'social', whatsapp: 'social', instagram: 'social',
  recipe: 'recipes', recipes: 'recipes', cooking: 'recipes',
  idea: 'ideas', ideas: 'ideas', note: 'ideas', notes: 'ideas',
  document: 'documents', documents: 'documents', doc: 'documents', docs: 'documents',
  important: 'important', meme: 'memes', memes: 'memes', funny: 'memes',
  temporary: 'temporary', otp: 'temporary', otps: 'temporary',
  other: 'other',
};

// Words that AUTO-detect category while typing a normal query — only exact
// category names/labels count, so ordinary words like "university" or "error"
// keep working as plain text terms.
const CATEGORY_AUTO: Record<string, Category> = {
  work: 'work', study: 'study', code: 'code', shopping: 'shopping', travel: 'travel',
  finance: 'finance', social: 'social', recipes: 'recipes', recipe: 'recipes',
  ideas: 'ideas', documents: 'documents', important: 'important',
  memes: 'memes', meme: 'memes', temporary: 'temporary', other: 'other',
};

const BUCKETS: Record<string, 'today' | 'yesterday' | 'week' | 'month' | 'older'> = {
  today: 'today', yesterday: 'yesterday', 'this week': 'week', week: 'week',
  'this month': 'month', month: 'month', older: 'older', old: 'older',
};

const RELATIVE_BUCKETS: [RegExp, 'today' | 'yesterday' | 'week' | 'month'][] = [
  [/\b(last|past|this)\s+week\b/, 'week'],
  [/\b(last|past|this)\s+month\b/, 'month'],
  [/\byesterday\b/, 'yesterday'],
  [/\btoday\b/, 'today'],
  [/\brecent(ly)?\b/, 'week'],
];

// "product under Rs 5000" — reserved for future soft content-type boosts
export const TYPE_WORDS: Record<string, string> = {
  receipt: 'receipt', receipts: 'receipt', invoice: 'receipt', invoices: 'receipt',
  chat: 'chat', conversation: 'chat', whatsapp: 'chat', message: 'chat', messages: 'chat',
  webpage: 'webpage', website: 'webpage', page: 'webpage',
  code: 'code', coding: 'code', snippet: 'code', error: 'code', errors: 'code',
  document: 'document', documents: 'document', doc: 'document', docs: 'document',
  ticket: 'ticket', tickets: 'ticket', booking: 'ticket', eticket: 'ticket',
  payment: 'payment', payments: 'payment', transaction: 'payment',
  email: 'email', emails: 'email', mail: 'email',
  note: 'note', notes: 'note', memo: 'note',
  meme: 'meme', memes: 'meme',
  form: 'form', forms: 'form',
};

// natural-language filler words that should never become required terms
const STOPWORDS = new Set([
  'from', 'the', 'a', 'an', 'my', 'me', 'for', 'of', 'in', 'on', 'with',
  'that', 'this', 'show', 'find', 'all', 'and', 'or', 'to', 'about', 'was',
  'were', 'is', 'are', 'did', 'do', 'i', 'what', 'which', 'when', 'where',
  'have', 'saved', 'got', 'some', 'any', 'it', 'its',
  // every library item IS a screenshot — these words carry no meaning
  'screenshot', 'screenshots', 'shot', 'shots', 'pic', 'pics', 'image', 'images', 'photo', 'photos',
]);

/** Semantic synonym clusters — expand a misspelled/related query term. */
export const SEMANTIC: Record<string, string[]> = {
  fee: ['payment', 'challan', 'voucher', 'dues', 'invoice', 'tuition'],
  fees: ['payment', 'challan', 'voucher', 'dues', 'invoice', 'tuition'],
  university: ['campus', 'college', 'institute', 'student', 'semester'],
  college: ['campus', 'university', 'institute', 'student'],
  travel: ['flight', 'hotel', 'trip', 'tour', 'ticket', 'visa', 'airport'],
  trip: ['flight', 'hotel', 'travel', 'tour', 'ticket'],
  flight: ['airline', 'boarding', 'airport', 'ticket', 'pnr'],
  hotel: ['booking', 'reservation', 'checkout', 'guest'],
  error: ['bug', 'exception', 'crash', 'failed', 'traceback', 'stack'],
  errors: ['bug', 'exception', 'crash', 'failed', 'traceback', 'stack'],
  bug: ['error', 'exception', 'crash', 'fix'],
  react: ['component', 'hook', 'jsx', 'props', 'state', 'npm'],
  job: ['hiring', 'vacancy', 'position', 'apply', 'recruit', 'internship', 'opening'],
  jobs: ['hiring', 'vacancy', 'position', 'apply', 'recruit', 'internship', 'opening'],
  internship: ['intern', 'hiring', 'apply', 'opportunity', 'position'],
  buy: ['price', 'cart', 'order', 'shop', 'purchase', 'deal', 'discount'],
  product: ['price', 'item', 'order', 'cart', 'deal', 'buy'],
  receipt: ['paid', 'invoice', 'transaction', 'amount', 'total', 'bill'],
  receipts: ['paid', 'invoice', 'transaction', 'amount', 'total', 'bill'],
  invoice: ['receipt', 'paid', 'total', 'amount', 'bill'],
  payment: ['paid', 'transfer', 'transaction', 'amount', 'receipt', 'bank'],
  payments: ['paid', 'transfer', 'transaction', 'amount', 'receipt', 'bank'],
  chat: ['whatsapp', 'message', 'conversation', 'text'],
  chats: ['whatsapp', 'message', 'conversation', 'text'],
  ticket: ['booking', 'eticket', 'pnr', 'flight', 'seat'],
  tickets: ['booking', 'eticket', 'pnr', 'flight', 'seat'],
  email: ['mail', 'inbox', 'sender'],
  emails: ['mail', 'inbox', 'sender'],
  note: ['memo', 'recipe', 'steps', 'list'],
  notes: ['memo', 'recipe', 'steps', 'list'],
  meme: ['funny', 'joke', 'humor'],
  memes: ['funny', 'joke', 'humor'],
  otp: ['code', 'verification', 'password', 'pin'],
  recipe: ['ingredients', 'cook', 'bake', 'dish', 'kitchen'],
  gift: ['gift', 'university'],
  meeting: ['call', 'zoom', 'agenda', 'invite', 'schedule'],
  deadline: ['due', 'last date', 'submit', 'before', 'expires'],
  money: ['price', 'amount', 'payment', 'rs', 'rupees', 'total'],
  exam: ['result', 'marks', 'test', 'paper', 'grade'],
  result: ['marks', 'grade', 'gpa', 'score', 'exam'],
  medicine: ['dose', 'tablet', 'doctor', 'prescription', 'pharmacy'],
};

function parsePriceNum(s: string): number | null {
  const m = s.replace(/,/g, '').match(/\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : null;
}

export function parseQuery(raw: string): Query {
  const q: Query = { terms: [], phrases: [] };
  let s = raw.toLowerCase().trim();

  // quoted phrases
  s = s.replace(/"([^"]+)"/g, (_, p: string) => { q.phrases.push(p.trim()); return ' '; });

  // field filters  tag:foo  category:work  file:name
  s = s.replace(/\b(tag|category|cat|file):([^\s]+)/g, (_, f: string, v: string) => {
    if (f === 'tag') q.tagFilter = v;
    if (f === 'file') q.terms.push(v);
    if (f !== 'tag') {
      const cat = (CATEGORY_SYNONYMS[v] ?? null);
      if (cat) q.category = cat;
    }
    return ' ';
  });

  // natural-language price: "under 5000", "below rs 5,000", "less than 5000",
  // "over 1000", "above 1000", "more than 1,000", "cheaper than 5000"
  s = s.replace(/\b(?:under|below|less than|cheaper than|upto|up to|max)\s+(?:rs\.?|pkr|\$|€|£)?\s*([\d,]+(?:\.\d+)?)\b/g, (_, n: string) => {
    const v = parsePriceNum(n); if (v) q.maxPrice = v;
    return ' ';
  });
  s = s.replace(/\b(?:over|above|more than|at least|min|expensive(?:r)? than)\s+(?:rs\.?|pkr|\$|€|£)?\s*([\d,]+(?:\.\d+)?)\b/g, (_, n: string) => {
    const v = parsePriceNum(n); if (v) q.minPrice = v;
    return ' ';
  });

  // relative time phrases → buckets (before bucket keyword check)
  for (const [re, b] of RELATIVE_BUCKETS) {
    if (re.test(s) && !q.bucket) { q.bucket = b; s = s.replace(re, ' '); break; }
  }

  for (const [k, v] of Object.entries(BUCKETS)) {
    if (s.includes(k)) { q.bucket = v; s = s.replace(k, ' '); break; }
  }
  if (/\b(favorite|favourite|starred|fav)\b/.test(s)) { q.favorites = true; s = s.replace(/\b(favorite|favourite|starred|fav)\b/, ' '); }
  if (/\b(duplicates?|same screenshots?|repeats?)\b/.test(s)) { q.duplicates = true; s = s.replace(/\b(duplicates?|same screenshots?|repeats?)\b/, ' '); }

  for (const word of s.split(/\s+/)) {
    const w = word.replace(/[^\p{L}\p{N}]/gu, '');
    if (!w) continue;
    if (STOPWORDS.has(w)) continue;
    if (!q.category && CATEGORY_AUTO[w]) { q.category = CATEGORY_AUTO[w]; continue; }
    q.terms.push(w);
  }
  return q;
}

/** Forgiving term matcher: substring, plural-stem and light prefix match. */
function termMatches(term: string, hay: string): boolean {
  if (!hay) return false;
  if (hay.includes(term)) return true;
  // numeric terms also match comma-grouped numbers: "48500" hits "48,500"
  if (/^\d+(\.\d+)?$/.test(term) && hay.replace(/,/g, '').includes(term)) return true;
  // "codes" matches "code", "plans" matches "plan"
  if (term.length >= 4 && term.endsWith('s') && hay.includes(term.slice(0, -1))) return true;
  // light prefix: "screenshot" matches "screenshots"
  if (term.length >= 5) {
    const esc = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp(`\\b${esc}[a-z]{0,3}\\b`).test(hay)) return true;
  }
  return false;
}

function haystacks(shot: Shot) {
  const ai = shot.ai;
  return {
    title: (ai?.title ?? '').toLowerCase(),
    summary: (ai?.summary ?? '').toLowerCase(),
    tags: (ai?.tags ?? []).map((t) => t.toLowerCase()),
    category: (shot.ai?.category ?? '') as Category | '',
    file: shot.fileName.toLowerCase(),
    ocr: (shot.ocr ?? '').toLowerCase(),
    entities: [
      ...(ai?.orgs ?? []), ...(ai?.names ?? []), ...(ai?.places ?? []),
      ...(ai?.products ?? []), ...(ai?.prices ?? []), ...(ai?.deadlines ?? []),
    ].join(' ').toLowerCase(),
    prices: (ai?.prices ?? []).join(' ').toLowerCase(),
    contentType: (ai?.contentType ?? ''),
  };
}

export function scoreShotAgainst(shot: Shot, q: Query): SearchHit | null {
  const reasons: MatchReason[] = [];
  let score = 0;
  const h = haystacks(shot);

  if (q.favorites && !shot.fav) return null;
  if (q.duplicates && !shot.dupOf) return null;
  if (q.category) {
    if (h.category !== q.category) return null;
    reasons.push({ field: 'category', detail: `Category: ${CATEGORY_LABELS[q.category]}` });
    score += 4;
  }
  if (q.bucket) {
    const b = dayBucket(shot.createdAt);
    const near: Record<string, string[]> = {
      today: ['today'], yesterday: ['yesterday'], week: ['today', 'yesterday', 'week'],
      month: ['today', 'yesterday', 'week', 'month'], older: ['month', 'older'],
    };
    if (!near[q.bucket].includes(b)) return null;
    reasons.push({ field: 'date', detail: `Screenshot from ${q.bucket}` });
    score += 3;
  }
  if (q.tagFilter) {
    const t = h.tags.find((x) => x.includes(q.tagFilter!));
    if (!t) return null;
    reasons.push({ field: 'tag', detail: `Tag: ${t}` });
    score += 6;
  }
  if (q.maxPrice !== undefined || q.minPrice !== undefined) {
    const nums = (h.prices.match(/[\d,]+(?:\.\d+)?/g) ?? []).map((x) => Number(x.replace(/,/g, '')));
    const ok = nums.some((n) =>
      (q.maxPrice === undefined || n <= q.maxPrice) &&
      (q.minPrice === undefined || n >= q.minPrice));
    if (!ok) return null;
    const parts: string[] = [];
    if (q.maxPrice !== undefined) parts.push(`≤ ${q.maxPrice.toLocaleString()}`);
    if (q.minPrice !== undefined) parts.push(`≥ ${q.minPrice.toLocaleString()}`);
    reasons.push({ field: 'price', detail: `Detected price ${parts.join(' and ')}` });
    score += 6;
  }

  for (const phrase of q.phrases) {
    const p = phrase.toLowerCase();
    let matched = false;
    if (h.ocr.includes(p)) { score += 8; reasons.push({ field: 'ocr', detail: `Extracted text contains “${phrase}”` }); matched = true; }
    if (h.title.includes(p)) { score += 6; reasons.push({ field: 'title', detail: `Title contains “${phrase}”` }); matched = true; }
    if (!matched && h.summary.includes(p)) { score += 4; reasons.push({ field: 'summary', detail: `AI summary mentions “${phrase}”` }); matched = true; }
    if (!matched && h.entities.includes(p)) { score += 4; reasons.push({ field: 'entity', detail: `Detected info contains “${phrase}”` }); matched = true; }
    if (!matched) return null;
  }

  for (const term of q.terms) {
    let matched = false;
    if (h.title && termMatches(term, h.title)) { score += 5; reasons.push({ field: 'title', detail: `Title matches “${term}”` }); matched = true; }
    if (h.tags.some((t) => t === term)) { score += 6; reasons.push({ field: 'tag', detail: `Tagged “${term}”` }); matched = true; }
    else if (h.tags.some((t) => termMatches(term, t))) { score += 4; reasons.push({ field: 'tag', detail: `Tag matches “${term}”` }); matched = true; }
    if (h.ocr && termMatches(term, h.ocr)) { score += 3; reasons.push({ field: 'ocr', detail: `Found in screenshot text` }); matched = true; }
    if (h.summary && termMatches(term, h.summary)) { score += 2.5; reasons.push({ field: 'summary', detail: `AI summary mentions “${term}”` }); matched = true; }
    if (h.entities && termMatches(term, h.entities)) { score += 3.5; reasons.push({ field: 'entity', detail: `Matched detected organization, place, name or price` }); matched = true; }
    if (h.category && h.category === term) { score += 4; reasons.push({ field: 'category', detail: `Category: ${CATEGORY_LABELS[h.category as Category] ?? term}` }); matched = true; }
    if (h.file && termMatches(term, h.file)) { score += 1.5; reasons.push({ field: 'file', detail: `File name matches` }); matched = true; }

    // semantic fallback: try known synonyms of the term
    if (!matched) {
      const syns = SEMANTIC[term] ?? (term.length >= 4 ? SEMANTIC[term.replace(/s$/, '')] : undefined);
      if (syns) {
        for (const syn of syns) {
          if (termMatches(syn, h.title) || h.tags.some((t) => t === syn)) {
            score += 3; reasons.push({ field: 'semantic', detail: `Semantic match: “${term}” ≈ “${syn}”` }); matched = true; break;
          }
          if (termMatches(syn, h.ocr)) {
            score += 2; reasons.push({ field: 'semantic', detail: `Semantic match: “${term}” ≈ “${syn}” in screenshot text` }); matched = true; break;
          }
          if (termMatches(syn, h.summary) || termMatches(syn, h.entities)) {
            score += 1.5; reasons.push({ field: 'semantic', detail: `Semantic match: “${term}” ≈ “${syn}”` }); matched = true; break;
          }
        }
      }
    }

    if (!matched) return null; // every term must match somewhere
  }

  if (score <= 0) return null;

  // dedupe reasons, keep strongest 3
  const seen = new Set<string>();
  const topReasons: MatchReason[] = [];
  for (const r of reasons.sort((a, b) => reasonWeight(b) - reasonWeight(a))) {
    const k = r.field + r.detail;
    if (!seen.has(k)) { seen.add(k); topReasons.push(r); }
    if (topReasons.length >= 3) break;
  }

  const recency = Math.max(0, 1 - (Date.now() - shot.createdAt) / (1000 * 60 * 60 * 24 * 365));
  return { shot, score: score + recency, reasons: topReasons };
}

function reasonWeight(r: MatchReason): number {
  if (r.field === 'ocr' || r.field === 'price') return 5;
  if (r.field === 'entity' || r.field === 'semantic') return 4;
  return r.field === 'tag' ? 4 : r.field === 'title' ? 3 : r.field === 'category' ? 2 : 1;
}

export function searchAll(shots: Shot[], raw: string, limit = 60): SearchHit[] {
  const q = parseQuery(raw);
  if (!q.terms.length && !q.phrases.length && !q.category && !q.bucket && !q.favorites && !q.duplicates && !q.tagFilter && q.maxPrice === undefined && q.minPrice === undefined) return [];
  const hits: SearchHit[] = [];
  for (const s of shots) {
    if (s.deletedAt) continue;
    const hit = scoreShotAgainst(s, q);
    if (hit) hits.push(hit);
  }
  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, limit);
}

export function summarizeQuery(raw: string): string {
  const q = parseQuery(raw);
  const bits: string[] = [];
  if (q.category) bits.push(`in ${CATEGORY_LABELS[q.category]}`);
  if (q.bucket) bits.push(`from ${q.bucket}`);
  if (q.favorites) bits.push('favorites only');
  if (q.duplicates) bits.push('duplicates only');
  if (q.terms.length) bits.push(`“${q.terms.join(' ')}”`);
  if (q.phrases.length) bits.push(`phrase: ${q.phrases.map((p) => `“${p}”`).join(', ')}`);
  return bits.join(' · ');
}

/** Retrieve shots relevant to a chat question (for grounding the AI). */
export function retrieveForQuestion(shots: Shot[], question: string, limit = 10): Shot[] {
  const live = shots.filter((s) => !s.deletedAt && !s.aiExcluded);
  const hits = searchAll(live, question, limit);
  if (hits.length >= 3) return hits.map((h) => h.shot);
  // blend: search hits + recent analyzed shots so the model has material
  const ids = new Set(hits.map((h) => h.shot.id));
  const blended = [...hits.map((h) => h.shot)];
  for (const s of live) {
    if (blended.length >= limit) break;
    if (ids.has(s.id)) continue;
    if (s.ai || (s.ocr && s.ocr.length > 40)) blended.push(s);
  }
  return blended.slice(0, limit);
}

export const SEARCH_HINTS = [
  'university fee screenshot',
  'that react error',
  'otp codes',
  '"total amount"',
  'receipt from last week',
  'product under Rs 5000',
  'jobs posted this month',
  'travel plans',
  'tag:react',
  'duplicates',
  'important documents',
  'memes',
];

export const ALL_CATEGORIES: Category[] = [...CATEGORIES];
