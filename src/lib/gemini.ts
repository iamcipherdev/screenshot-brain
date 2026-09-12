// ─── Gemini AI service: key test, screenshot analysis, Ask chat ───────────
// The user's API key is stored locally and sent ONLY to Google's endpoint.

import type { AiMeta, Category, ChatMsg, ContentType, ValueLevel } from '../types';
import { CATEGORIES } from '../types';

export const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';

export const SUGGESTED_MODELS = [
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-1.5-flash',
];

export class GeminiError extends Error {
  code: 'invalid_key' | 'quota' | 'blocked' | 'network' | 'parse' | 'server';
  constructor(code: GeminiError['code'], message: string) {
    super(message);
    this.code = code;
  }
}

function mapHttpError(status: number, body: string): GeminiError {
  const lower = body.toLowerCase();
  if (status === 400 && (lower.includes('api key not valid') || lower.includes('api_key_invalid'))) {
    return new GeminiError('invalid_key', 'That API key is not valid. Double-check it in Settings.');
  }
  if (status === 403) {
    return new GeminiError('invalid_key', 'Key rejected (403). Check key restrictions in Google AI Studio.');
  }
  if (status === 429) {
    return new GeminiError('quota', 'Gemini quota exceeded for now. Free tiers reset — try again in a minute.');
  }
  if (status === 404) {
    return new GeminiError('server', 'Model not found for this key. Try another model in Settings.');
  }
  if (lower.includes('safety') || lower.includes('blocked')) {
    return new GeminiError('blocked', 'Gemini blocked this content for safety reasons.');
  }
  return new GeminiError('server', `Gemini error ${status}. ${body.slice(0, 140)}`);
}

interface GenPart { text?: string; inline_data?: { mime_type: string; data: string } }
interface GenContent {
  contents?: { role: 'user' | 'model'; parts: GenPart[] }[];
  systemInstruction?: { parts: GenPart[] };
  generationConfig?: Record<string, unknown>;
}

async function callGemini(model: string, key: string, body: GenContent, signal?: AbortSignal): Promise<string> {
  if (!navigator.onLine) throw new GeminiError('network', 'You are offline — AI features need internet.');
  let resp: Response;
  try {
    resp = await fetch(`${GEMINI_BASE}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw new GeminiError('network', 'Request timed out. Try again.');
    throw new GeminiError('network', 'Could not reach Gemini. Check your connection.');
  }
  if (!resp.ok) {
    const txt = await resp.text().catch(() => '');
    throw mapHttpError(resp.status, txt);
  }
  const data = await resp.json();
  const parts = data?.candidates?.[0]?.content?.parts as GenPart[] | undefined;
  const text = parts?.map((p) => p.text ?? '').join('') ?? '';
  if (!text.trim()) {
    const finish = data?.candidates?.[0]?.finishReason;
    if (finish && finish !== 'STOP') throw new GeminiError('blocked', `Gemini stopped early (${finish}).`);
    throw new GeminiError('parse', 'Gemini returned an empty response.');
  }
  return text;
}

export async function testKey(key: string): Promise<{ ok: boolean; message: string }> {
  if (!key.trim()) return { ok: false, message: 'Enter an API key first.' };
  if (!navigator.onLine) return { ok: false, message: 'You are offline.' };
  try {
    const resp = await fetch(`${GEMINI_BASE}/models?key=${encodeURIComponent(key)}&pageSize=5`);
    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      const err = mapHttpError(resp.status, txt);
      return { ok: false, message: err.message };
    }
    const data = await resp.json();
    const n = Array.isArray(data?.models) ? data.models.length : 0;
    return { ok: true, message: `Key works ✓ (${n}+ models visible)` };
  } catch {
    return { ok: false, message: 'Could not reach Gemini. Check your connection.' };
  }
}

// ─── Screenshot analysis ───────────────────────────────────────────────────

const ANALYSIS_SCHEMA = {
  type: 'OBJECT',
  properties: {
    title: { type: 'STRING' },
    summary: { type: 'STRING' },
    category: { type: 'STRING', enum: [...CATEGORIES] },
    contentType: { type: 'STRING', enum: ['chat', 'receipt', 'webpage', 'code', 'document', 'form', 'ticket', 'payment', 'email', 'note', 'meme', 'photo', 'other'] },
    tags: { type: 'ARRAY', items: { type: 'STRING' } },
    dates: { type: 'ARRAY', items: { type: 'STRING' } },
    phones: { type: 'ARRAY', items: { type: 'STRING' } },
    emails: { type: 'ARRAY', items: { type: 'STRING' } },
    urls: { type: 'ARRAY', items: { type: 'STRING' } },
    places: { type: 'ARRAY', items: { type: 'STRING' } },
    products: { type: 'ARRAY', items: { type: 'STRING' } },
    tasks: { type: 'ARRAY', items: { type: 'STRING' } },
    orgs: { type: 'ARRAY', items: { type: 'STRING' } },
    names: { type: 'ARRAY', items: { type: 'STRING' } },
    prices: { type: 'ARRAY', items: { type: 'STRING' } },
    deadlines: { type: 'ARRAY', items: { type: 'STRING' } },
    usefulness: { type: 'INTEGER' },
    value: { type: 'STRING', enum: ['important', 'useful', 'temporary', 'duplicate', 'low'] },
    valueReason: { type: 'STRING' },
    outdated: { type: 'STRING' },
  },
  required: ['title', 'summary', 'category', 'contentType', 'tags', 'usefulness', 'value', 'valueReason'],
} as const;

function analysisPrompt(): string {
  const today = new Date().toISOString().slice(0, 10);
  return `You analyze a phone screenshot for a personal "second brain" app. Describe ONLY what is actually visible — never invent names, numbers, prices or facts that are not in the image.

Return JSON with:
- title: short specific title (max 8 words), e.g. "University fee voucher — 12,500 PKR"
- summary: 1–2 sentence description of what this screenshot shows and why it matters
- category: exactly one of: ${CATEGORIES.join(', ')}
- contentType: exactly one of: chat, receipt, webpage, code, document, form, ticket, payment, email, note, meme, photo, other
- tags: 2–6 lowercase keywords
- dates: dates/deadlines visible in the image (keep original formatting)
- phones, emails, urls: any visible, verbatim
- places: named places/addresses visible
- products: product names/prices visible
- tasks: any actionable items implied ("pay fee by Aug 25")
- orgs: organizations/companies/universities/banks/government bodies visible
- names: person names visible (sender, recipient, contact)
- prices: prices/amounts with their currency, verbatim ("Rs 4,500", "$12.99", "€50")
- deadlines: deadline/due-date phrases visible ("due 25 September", "apply by Aug 30")
- usefulness: 0–100 score of long-term value
- value: one of important | useful | temporary | duplicate | low
- valueReason: one short sentence WHY (e.g. "Contains a one-time OTP that expires", "Fee deadline document")
- outdated: empty string, or a short reason if the info is clearly expired/time-sensitive as of ${today}

Rules: be precise and conservative; if a field has nothing, use an empty array or empty string.`;
}

export async function analyzeScreenshot(
  model: string,
  key: string,
  imageB64: string,
  ocrText: string,
): Promise<{ ai: AiMeta; value: ValueLevel; valueReason: string }> {
  const parts: GenPart[] = [];
  if (ocrText.trim()) parts.push({ text: `Text extracted from this screenshot by on-device OCR:\n"""\n${ocrText.slice(0, 6000)}\n"""` });
  parts.push({ inline_data: { mime_type: 'image/jpeg', data: imageB64 } });
  parts.push({ text: 'Analyze this screenshot now.' });

  const raw = await callGemini(model, key, {
    systemInstruction: { parts: [{ text: analysisPrompt() }] },
    contents: [{ role: 'user', parts }],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: 'application/json',
      responseSchema: ANALYSIS_SCHEMA,
    },
  });

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new GeminiError('parse', 'Gemini returned malformed JSON.');
  }
  const arr = (v: unknown): string[] => Array.isArray(v) ? v.map((x) => String(x)).slice(0, 12) : [];
  const cat = String(parsed.category ?? 'other') as Category;
  const ct = String(parsed.contentType ?? 'other') as ContentType;
  const CT_OK: ContentType[] = ['chat', 'receipt', 'webpage', 'code', 'document', 'form', 'ticket', 'payment', 'email', 'note', 'meme', 'photo', 'other'];
  const ai: AiMeta = {
    title: String(parsed.title ?? 'Screenshot').slice(0, 120),
    summary: String(parsed.summary ?? '').slice(0, 600),
    category: (CATEGORIES as readonly string[]).includes(cat) ? cat : 'other',
    tags: arr(parsed.tags).map((t) => t.toLowerCase().trim()).filter(Boolean).slice(0, 6),
    dates: arr(parsed.dates),
    phones: arr(parsed.phones),
    emails: arr(parsed.emails),
    urls: arr(parsed.urls),
    places: arr(parsed.places),
    products: arr(parsed.products),
    tasks: arr(parsed.tasks),
    orgs: arr(parsed.orgs),
    names: arr(parsed.names),
    prices: arr(parsed.prices),
    deadlines: arr(parsed.deadlines),
    contentType: CT_OK.includes(ct) ? ct : 'other',
    usefulness: Math.max(0, Math.min(100, Number(parsed.usefulness ?? 50))),
    outdated: String(parsed.outdated ?? '') || undefined,
  };
  const val = String(parsed.value ?? 'useful') as ValueLevel;
  const value: ValueLevel = ['important', 'useful', 'temporary', 'duplicate', 'low'].includes(val) ? val : 'useful';
  const valueReason = String(parsed.valueReason ?? 'Analyzed by AI').slice(0, 240);
  return { ai, value, valueReason };
}

/** Gemini-vision OCR fallback (used when ML Kit is unavailable, e.g. web preview). */
export async function geminiTranscribe(model: string, key: string, imageB64: string): Promise<string> {
  const raw = await callGemini(model, key, {
    systemInstruction: { parts: [{ text: 'You are a precise OCR engine. Transcribe ALL text visible in the screenshot exactly as it appears, preserving line breaks. Output ONLY the transcribed text — no commentary, no markdown. If there is no text, output an empty string.' }] },
    contents: [{ role: 'user', parts: [{ inline_data: { mime_type: 'image/jpeg', data: imageB64 } }] }],
    generationConfig: { temperature: 0 },
  });
  return raw.trim();
}

// ─── Ask chat (general assistant + screenshot-grounded answers) ───────────

export interface ChatContextShot {
  id: string;
  title: string;
  summary: string;
  category: string;
  tags: string[];
  date: string;
  ocrExcerpt: string;
  prices: string[];
  orgs: string[];
  deadlines: string[];
}

const CITE_FALLBACK = "I couldn't find enough information in your screenshot library to answer that.";

function chatSystemInstruction(ctx: ChatContextShot[]): string {
  const contextBlock = ctx.length
    ? `\n\nThe user's screenshot library contains these potentially relevant screenshots:\n${ctx.map((s) =>
        `- [shot:${s.id}] "${s.title}" (${s.category}, ${s.date})${s.tags.length ? ` tags: ${s.tags.join(', ')}` : ''}${s.prices.length ? ` prices: ${s.prices.join(', ')}` : ''}${s.orgs.length ? ` orgs: ${s.orgs.join(', ')}` : ''}${s.deadlines.length ? ` deadlines: ${s.deadlines.join(', ')}` : ''}\n  summary: ${s.summary || '—'}\n  text: ${s.ocrExcerpt || '—'}`
      ).join('\n')}`
    : '\n\nNo screenshot context was found for this question.';
  return `You are Screenshot Brain, a helpful personal assistant built into the user's screenshot library app. You are made by CIPHER.

You have TWO jobs, blended naturally:
1. Answer questions about the user's screenshots using the screenshot context provided below.
2. Chat like a normal, capable AI assistant about ANY topic — general knowledge, advice, writing, math, explanations, small talk. Never refuse a question just because it is not about screenshots.

Grounding rules (critical):
- When you state something the user's screenshots show, attach a citation token immediately after the claim, in the form [shot:ID] — e.g. "Your GIFT University fee voucher is 48,500 PKR, due 25 September [shot:s_abc123]."
- Cite every factual claim that came from a screenshot. Multiple claims from the same screenshot each get the citation.
- NEVER fabricate information and attribute it to a screenshot. Never invent IDs that were not given to you.
- If the question needs info from the user's screenshots but the provided context does not contain it, start your answer with exactly: "${CITE_FALLBACK}" Then, if helpful, offer general knowledge clearly labelled as such.
- If the question is general (not about the library), just answer it well without citations.

Style:
- Plain text — no markdown headers. Simple dashes for lists. Bold with *asterisks* sparingly.
- Concise and friendly; short paragraphs. Match the user's language (English, Urdu, or whatever they use).
- Today's date: ${new Date().toDateString()}.${contextBlock}`;
}

/** Extract shot ids the model cited, in order of first appearance. */
export function extractCites(text: string): string[] {
  return [...new Set([...text.matchAll(/\[shot:([\w-]+)\]/g)].map((m) => m[1]))];
}

/** Strip raw citation tokens from display text; UI renders source chips itself. */
export function stripCites(text: string): string {
  return text.replace(/\s*\[shot:[\w-]+\]/g, '');
}

async function postSSE(
  model: string,
  key: string,
  body: GenContent,
  onChunk: (t: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  if (!navigator.onLine) throw new GeminiError('network', 'You are offline — AI features need internet.');
  let resp: Response;
  try {
    resp = await fetch(`${GEMINI_BASE}/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw new GeminiError('network', 'Stopped.');
    throw new GeminiError('network', 'Could not reach Gemini. Check your connection.');
  }
  if (!resp.ok) {
    const txt = await resp.text().catch(() => '');
    throw mapHttpError(resp.status, txt);
  }
  if (!resp.body) throw new GeminiError('network', 'Streaming is not supported here.');

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let full = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() ?? '';
    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith('data:')) continue;
      const payload = t.slice(5).trim();
      if (!payload || payload === '[DONE]') continue;
      try {
        const json = JSON.parse(payload);
        const parts = json?.candidates?.[0]?.content?.parts as GenPart[] | undefined;
        const chunk = parts?.map((p) => p.text ?? '').join('') ?? '';
        if (chunk) { full += chunk; onChunk(chunk); }
      } catch { /* partial JSON line — ignore */ }
    }
  }
  if (!full.trim()) throw new GeminiError('parse', 'Gemini returned an empty response.');
  return full;
}

/**
 * Streamed Ask-Brain chat. Calls onChunk with incremental display text
 * (citations already stripped) so the UI can render tokens as they arrive.
 * Resolves with the final cleaned text + cited shot ids.
 */
export async function streamChatWithBrain(
  model: string,
  key: string,
  history: ChatMsg[],
  question: string,
  context: ChatContextShot[],
  onChunk: (display: string) => void,
  signal?: AbortSignal,
): Promise<{ text: string; cites: string[] }> {
  const contents = history
    .filter((m) => !m.error && m.text.trim())
    .slice(-14)
    .map((m) => ({
      role: m.role === 'user' ? 'user' as const : 'model' as const,
      parts: [{ text: m.role === 'ai' ? stripCites(m.text) : m.text }],
    }));
  contents.push({ role: 'user', parts: [{ text: question }] });

  let raw = '';
  try {
    raw = await postSSE(
      model, key,
      {
        systemInstruction: { parts: [{ text: chatSystemInstruction(context) }] },
        contents,
        generationConfig: { temperature: 0.5, maxOutputTokens: 1400 },
      },
      (chunk) => onChunk(stripCites(chunk)),
      signal,
    );
  } catch (e) {
    // Some proxies/models reject SSE — fall back to non-streaming once.
    if (e instanceof GeminiError && e.code === 'server') {
      const { chatWithBrain } = await import('./gemini');
      const r = await chatWithBrain(model, key, history, question, context);
      onChunk(stripCites(r.text));
      return r;
    }
    throw e;
  }
  return { text: stripCites(raw).trim(), cites: extractCites(raw) };
}

/** Non-streaming variant (fallback). */
export async function chatWithBrain(
  model: string,
  key: string,
  history: ChatMsg[],
  question: string,
  context: ChatContextShot[],
): Promise<{ text: string; cites: string[] }> {
  const contents = history.slice(-12).map((m) => ({
    role: m.role === 'user' ? 'user' as const : 'model' as const,
    parts: [{ text: m.text }],
  }));
  contents.push({ role: 'user', parts: [{ text: question }] });

  const text = await callGemini(model, key, {
    systemInstruction: { parts: [{ text: chatSystemInstruction(context) }] },
    contents,
    generationConfig: { temperature: 0.5, maxOutputTokens: 1400 },
  });

  const cites = extractCites(text);
  return { text: text.trim(), cites };
}

/** Short conversation title from the opening question. */
export async function generateConvoTitle(model: string, key: string, question: string): Promise<string> {
  try {
    const raw = await callGemini('gemini-2.0-flash-lite', key, {
      systemInstruction: { parts: [{ text: 'Write a 2-5 word title for a chat that starts with the given message. No quotes, no punctuation at the end, same language as the message.' }] },
      contents: [{ role: 'user', parts: [{ text: question.slice(0, 300) }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 20 },
    });
    return raw.replace(/["'.]/g, '').trim().slice(0, 48) || 'New chat';
  } catch {
    return 'New chat';
  }
}

/** Suggested follow-up questions after an AI answer. */
export async function generateFollowUps(model: string, key: string, question: string, answer: string): Promise<string[]> {
  try {
    const raw = await callGemini('gemini-2.0-flash-lite', key, {
      systemInstruction: { parts: [{ text: 'Given a conversation exchange, suggest 3 short natural follow-up questions the user might ask next (max 9 words each, same language). Return ONLY the three questions, one per line, no numbering, no dashes.' }] },
      contents: [{ role: 'user', parts: [{ text: `User asked: ${question.slice(0, 300)}\n\nAssistant answered: ${answer.slice(0, 700)}` }] }],
      generationConfig: { temperature: 0.6, maxOutputTokens: 90 },
    });
    return raw.split('\n').map((l) => l.replace(/^[\d.\-)\s]+/, '').trim()).filter((l) => l.length > 4 && l.length < 90).slice(0, 3);
  } catch {
    return [];
  }
}
