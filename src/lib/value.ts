// ─── Value scoring: rules that run instantly, refined later by AI ─────────
// Every shot gets a value level + a HUMAN-READABLE reason.
// Nothing here ever deletes anything.

import type { Shot, ValueLevel } from '../types';
import { fmtDate } from './util';

const OTP_PATTERNS = [
  /\b(otp|one[-\s]?time (?:code|password)|verification code|security code|login code|confirm(?:ation)? code)\b/i,
  /\b(?:code is|your code)\s*[:\-]?\s*\d{4,8}\b/i,
  /\bG-\d{4,8}\b/,
  /\b\d{3}[\s-]?\d{3}\b(?=.*(?:whatsapp|telegram|google|facebook|instagram))/i,
];

const IMPORTANT_PATTERNS = [
  /\b(invoice|receipt|fee voucher|fee challan|bank transfer|transaction id|tracking number|booking (?:id|reference)|e-?ticket|boarding pass|reservation|result card|marksheet|transcript|cnic|passport|licence|license|prescription|lab report|contract|agreement|police report|fir)\b/i,
  /\b(?:due date|deadline|last date|pay before|expires? on)\b/i,
];

const TEMP_HINTS = [
  /\b(?:expires?|expired?|valid (?:until|till)|otp|one[-\s]?time)\b/i,
];

export function scoreShot(shot: Shot): { value: ValueLevel; reason: string } {
  const text = shot.ocr ?? '';

  if (shot.dupOf) {
    return { value: 'duplicate', reason: 'Looks like a near-identical repeat of a screenshot you already have' };
  }

  if (text) {
    for (const p of OTP_PATTERNS) {
      if (p.test(text)) {
        return { value: 'temporary', reason: 'Contains a one-time code or confirmation — these stop being useful fast' };
      }
    }
    for (const p of IMPORTANT_PATTERNS) {
      if (p.test(text)) {
        return { value: 'important', reason: 'Looks like a document, payment proof or booking you may need later' };
      }
    }
  }

  if (!text.trim() && shot.ocrStatus === 'done') {
    return { value: 'low', reason: 'No readable text found — may be a photo, meme or wallpaper' };
  }

  if (text && TEMP_HINTS[0].test(text) && text.length < 400) {
    return { value: 'temporary', reason: 'Short notice about something expiring' };
  }

  return { value: 'useful', reason: text ? 'Contains searchable text worth keeping' : 'Saved screenshot' };
}

export function valueReasonLine(shot: Shot): string {
  if (shot.valueReason) return shot.valueReason;
  return scoreShot(shot).reason;
}

export function staleTempReason(shot: Shot): string {
  return `Temporary code / notice from ${fmtDate(shot.createdAt)} — almost certainly expired by now`;
}
