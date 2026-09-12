// ─── Demo data (development / preview only) ───────────────────────────────
// Draws realistic-looking screenshots on canvas so the UI can be tested
// without a phone. Never auto-enabled: user must tap "Load demo data".

import type { AiMeta, Collection, Shot } from '../types';
import { createShotWithId } from './repo';
import { uid } from './util';
import { aHash } from './images';

interface DemoSpec {
  fileName: string;
  title: string;
  category: string;
  daysAgo: number;
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
  ocr: string;
  value: Shot['value'];
  valueReason: string;
  ai?: AiMeta;
}

const BG = '#101418';

function phone(ctx: CanvasRenderingContext2D, w: number, h: number, statusBar: string): void {
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#9AA0A6';
  ctx.font = '600 26px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(statusBar, 40, 52);
  ctx.textAlign = 'right';
  ctx.fillText('12:47', w - 40, 52);
  ctx.textAlign = 'left';
}

function demoCanvas(draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void, w = 640, h = 1280): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d')!;
  phone(ctx, w, h, '●●● ▲ 78%');
  draw(ctx, w, h);
  return c;
}

function toJpeg(canvas: HTMLCanvasElement, max: number, q: number): Promise<Blob> {
  return new Promise((res, rej) => canvas.toBlob((b) => b ? res(b) : rej(new Error('blob')), 'image/jpeg', q));
}

const SPECS: DemoSpec[] = [
  {
    fileName: 'uni_fee_voucher.jpg',
    title: 'University fee voucher — 48,500 PKR',
    category: 'finance',
    daysAgo: 3,
    ocr: 'UNIVERSITY OF KARACHI\nFEE VOUCHER\nStudent: Ahmed Raza  Roll No: CS-21-045\nSemester: Fall 2026\nTuition Fee: 42,000 PKR\nLab Charges: 4,500 PKR\nLibrary: 2,000 PKR\nTOTAL: 48,500 PKR\nDue Date: 25 September 2026\nBank: Meezan Bank  Account: 0123-0101992345\nVoucher # VC-88412',
    value: 'important',
    valueReason: 'Fee deadline document — due 25 September',
    ai: {
      title: 'University fee voucher — 48,500 PKR',
      summary: 'Fall 2026 fee voucher from University of Karachi for Ahmed Raza — total 48,500 PKR due 25 September at Meezan Bank.',
      category: 'university', tags: ['fee', 'voucher', 'university', 'payment'],
      dates: ['25 September 2026'], phones: [], emails: [], urls: [],
      places: ['University of Karachi'], products: [], tasks: ['Pay 48,500 PKR before 25 September'],
      orgs: ['University of Karachi', 'Meezan Bank'], names: ['Ahmed Raza'],
      prices: ['48,500 PKR', '42,000 PKR'], deadlines: ['Due Date: 25 September 2026'],
      contentType: 'payment', usefulness: 92,
    },
    draw(ctx, w, h) {
      ctx.fillStyle = '#F4F1EA';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#123B2E';
      ctx.fillRect(60, 120, w - 120, 8);
      ctx.fillStyle = '#111';
      ctx.font = '700 40px Georgia, serif';
      ctx.fillText('UNIVERSITY OF KARACHI', 60, 200);
      ctx.font = '400 34px system-ui';
      ctx.fillText('FEE VOUCHER · Fall 2026', 60, 260);
      ctx.font = '400 34px system-ui';
      const lines = [
        'Student: Ahmed Raza    Roll No: CS-21-045',
        'Tuition Fee:            42,000 PKR',
        'Lab Charges:             4,500 PKR',
        'Library:                  2,000 PKR',
        '',
        'TOTAL:                 48,500 PKR',
        'Due Date:      25 September 2026',
        'Bank: Meezan Bank',
        'Account: 0123-0101992345',
        'Voucher # VC-88412',
      ];
      lines.forEach((l, i) => ctx.fillText(l, 60, 360 + i * 64));
    },
  },
  {
    fileName: 'react_error.jpg',
    title: 'React hooks error — cannot update state',
    category: 'code',
    daysAgo: 1,
    ocr: 'Warning: Cannot update a component (`App`) while rendering a different component (`CartList`).\nat App (App.tsx:24)\nat CartList (CartList.tsx:11)\nTypeError: Cannot read properties of undefined (reading \'map\')\n  at CartList (CartList.tsx:11)',
    value: 'useful',
    valueReason: 'Contains searchable text worth keeping',
    ai: {
      title: 'React hooks error — cannot update state',
      summary: 'React warning and TypeError: cannot read map of undefined in CartList.tsx while updating App during render.',
      category: 'code', tags: ['react', 'error', 'hooks', 'debug'],
      dates: [], phones: [], emails: [], urls: [], places: [], products: [], tasks: [],
      orgs: [], names: [], prices: [], deadlines: [],
      contentType: 'code', usefulness: 64,
    },
    draw(ctx, w, h) {
      ctx.fillStyle = '#0D1117';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#F85149';
      ctx.font = '600 30px monospace';
      ctx.fillText('✖ Compile / runtime errors', 40, 140);
      ctx.font = '26px monospace';
      ctx.fillStyle = '#C9D1D9';
      const lines = [
        'Warning: Cannot update a component',
        '(`App`) while rendering a different',
        'component (`CartList`).',
        '',
        '    at App (App.tsx:24)',
        '    at CartList (CartList.tsx:11)',
        '',
        'TypeError: Cannot read properties of',
        'undefined (reading \'map\')',
        '  at CartList (CartList.tsx:11)',
        '',
        '> 11 | {cart.items.map(i =>',
        '     |            ^',
      ];
      lines.forEach((l, i) => ctx.fillText(l, 40, 220 + i * 44));
    },
  },
  {
    fileName: 'otp_code.jpg',
    title: 'WhatsApp verification code',
    category: 'temporary',
    daysAgo: 0,
    ocr: 'WhatsApp\nYour verification code is 814-229.\nDon\'t share this code with others.\nThis code expires in 10 minutes.',
    value: 'temporary',
    valueReason: 'Contains a one-time code — expires in minutes',
    ai: {
      title: 'WhatsApp verification code',
      summary: 'One-time WhatsApp verification code 814-229, expires in 10 minutes.',
      category: 'temporary', tags: ['otp', 'whatsapp', 'code'],
      dates: [], phones: [], emails: [], urls: [], places: [], products: [], tasks: [],
      orgs: ['WhatsApp'], names: [], prices: [], deadlines: ['expires in 10 minutes'],
      contentType: 'chat', usefulness: 8,
    },
    draw(ctx, w, h) {
      ctx.fillStyle = '#E7F3EA';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#075E54';
      ctx.font = '700 44px system-ui';
      ctx.fillText('WhatsApp', 60, 220);
      ctx.fillStyle = '#333';
      ctx.font = '400 36px system-ui';
      ctx.fillText('Your verification code is', 60, 340);
      ctx.font = '700 84px monospace';
      ctx.fillText('814-229', 60, 460);
      ctx.font = '400 32px system-ui';
      ctx.fillText('This code expires in 10 minutes.', 60, 560);
    },
  },
  {
    fileName: 'biryani_recipe.jpg',
    title: 'Chicken biryani recipe — 6 steps',
    category: 'recipes',
    daysAgo: 12,
    ocr: 'Chicken Biryani (serves 4)\n1. Fry 2 sliced onions till golden\n2. Add 1kg chicken, ginger garlic paste, 2 tsp chilli\n3. Yogurt 1 cup + biryani masala, cook 20 min\n4. Boil basmati 70%, layer over chicken\n5. Mint, coriander, saffron milk on top\n6. Dum on low heat 15 minutes\nServe with raita.',
    value: 'useful',
    valueReason: 'Contains searchable text worth keeping',
    ai: {
      title: 'Chicken biryani recipe — 6 steps',
      summary: 'Step-by-step chicken biryani recipe serving 4, from frying onions to dum finishing, served with raita.',
      category: 'recipes', tags: ['biryani', 'recipe', 'chicken', 'cooking'],
      dates: [], phones: [], emails: [], urls: [], places: [], products: [], tasks: [],
      orgs: [], names: [], prices: [], deadlines: [],
      contentType: 'note', usefulness: 70,
    },
    draw(ctx, w, h) {
      ctx.fillStyle = '#FFF8EE';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#B3401F';
      ctx.font = '700 44px Georgia, serif';
      ctx.fillText('Chicken Biryani', 60, 180);
      ctx.font = '400 32px system-ui';
      const lines = [
        'Serves 4',
        '1. Fry 2 sliced onions till golden',
        '2. Add 1kg chicken, ginger garlic',
        '   paste, 2 tsp chilli',
        '3. Yogurt 1 cup + biryani masala,',
        '   cook 20 min',
        '4. Boil basmati 70%, layer over chicken',
        '5. Mint, coriander, saffron milk',
        '6. Dum on low heat 15 minutes',
        '',
        'Serve with raita.',
      ];
      lines.forEach((l, i) => ctx.fillText(l, 60, 260 + i * 58));
    },
  },
  {
    fileName: 'flight_booking.jpg',
    title: 'Flight booking — Karachi to Istanbul',
    category: 'travel',
    daysAgo: 5,
    ocr: 'Turkish Airlines  Booking ref: TK7G2L\nKarachi (KHI) → Istanbul (IST)\nDate: 03 October 2026, 08:45 AM\nFlight TK 851 · Terminal M\nPassenger: Ahmed Raza\nSeat 14A · 1 checked bag (23kg)\nE-ticket: 235-7712984551',
    value: 'important',
    valueReason: 'Flight booking you will need at the airport',
    ai: {
      title: 'Flight booking — Karachi to Istanbul',
      summary: 'Turkish Airlines TK 851 from Karachi to Istanbul on 03 October 2026, 08:45 AM — passenger Ahmed Raza, seat 14A, e-ticket 235-7712984551.',
      category: 'travel', tags: ['flight', 'istanbul', 'turkish airlines', 'booking'],
      dates: ['03 October 2026'], phones: [], emails: [], urls: [],
      places: ['Karachi', 'Istanbul'], products: [], tasks: [],
      orgs: ['Turkish Airlines'], names: ['Ahmed Raza'],
      prices: [], deadlines: [],
      contentType: 'ticket', usefulness: 95,
    },
    draw(ctx, w, h) {
      ctx.fillStyle = '#0E1B2A';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#E8B341';
      ctx.font = '700 40px system-ui';
      ctx.fillText('TURKISH AIRLINES', 60, 170);
      ctx.fillStyle = '#EAF0F6';
      ctx.font = '400 34px system-ui';
      const lines = [
        'Booking ref: TK7G2L',
        '',
        'Karachi (KHI) → Istanbul (IST)',
        '03 October 2026 · 08:45 AM',
        'Flight TK 851 · Terminal M',
        '',
        'Passenger: Ahmed Raza',
        'Seat 14A · 1 checked bag (23kg)',
        '',
        'E-ticket: 235-7712984551',
      ];
      lines.forEach((l, i) => ctx.fillText(l, 60, 250 + i * 58));
    },
  },
  {
    fileName: 'meme_cat.jpg',
    title: 'Cat debugging meme',
    category: 'memes',
    daysAgo: 2,
    ocr: '',
    value: 'low',
    valueReason: 'No readable text found — may be a photo, meme or wallpaper',
    ai: {
      title: 'Cat debugging meme',
      summary: '"It works on my machine" cat meme.',
      category: 'memes', tags: ['meme', 'funny', 'cat'],
      dates: [], phones: [], emails: [], urls: [], places: [], products: [], tasks: [],
      orgs: [], names: [], prices: [], deadlines: [],
      contentType: 'meme', usefulness: 15,
    },
    draw(ctx, w, h) {
      ctx.fillStyle = '#2B2118';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#8A6D4B';
      ctx.beginPath();
      ctx.ellipse(w / 2, h / 2, 180, 240, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2B2118';
      ctx.beginPath();
      ctx.arc(w / 2 - 70, h / 2 - 60, 22, 0, Math.PI * 2);
      ctx.arc(w / 2 + 70, h / 2 - 60, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#2B2118';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.arc(w / 2, h / 2 + 30, 60, 0.2, Math.PI - 0.2);
      ctx.stroke();
      ctx.fillStyle = '#FFF';
      ctx.font = '700 40px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('IT WORKS ON MY MACHINE', w / 2, 1080);
      ctx.textAlign = 'left';
    },
  },
  {
    fileName: 'dupe_fee_voucher.jpg',
    title: 'University fee voucher (duplicate)',
    category: 'finance',
    daysAgo: 3,
    ocr: 'UNIVERSITY OF KARACHI\nFEE VOUCHER\nStudent: Ahmed Raza  Roll No: CS-21-045\nSemester: Fall 2026\nTuition Fee: 42,000 PKR\nLab Charges: 4,500 PKR\nLibrary: 2,000 PKR\nTOTAL: 48,500 PKR\nDue Date: 25 September 2026\nBank: Meezan Bank  Account: 0123-0101992345\nVoucher # VC-88412',
    value: 'useful',
    valueReason: 'Contains searchable text worth keeping',
    ai: {
      title: 'University fee voucher (duplicate)',
      summary: 'Another copy of the same Karachi University fee voucher — 48,500 PKR due 25 September.',
      category: 'university', tags: ['fee', 'voucher', 'university'],
      dates: ['25 September 2026'], phones: [], emails: [], urls: [],
      places: ['University of Karachi'], products: [], tasks: [],
      orgs: ['University of Karachi', 'Meezan Bank'], names: ['Ahmed Raza'],
      prices: ['48,500 PKR'], deadlines: ['Due: 25 September 2026'],
      contentType: 'payment', usefulness: 90,
    },
    draw(ctx, w, h) {
      ctx.fillStyle = '#F4F1EA';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#123B2E';
      ctx.fillRect(60, 120, w - 120, 8);
      ctx.fillStyle = '#111';
      ctx.font = '700 40px Georgia, serif';
      ctx.fillText('UNIVERSITY OF KARACHI', 60, 200);
      ctx.font = '400 34px system-ui';
      const lines = [
        'FEE VOUCHER · Fall 2026',
        'Student: Ahmed Raza    Roll No: CS-21-045',
        'Tuition 42,000 · Lab 4,500 · Lib 2,000',
        'TOTAL: 48,500 PKR',
        'Due: 25 September 2026 · Meezan Bank',
        'Account: 0123-0101992345',
      ];
      lines.forEach((l, i) => ctx.fillText(l, 60, 300 + i * 62));
    },
  },
];

export async function loadDemoData(): Promise<{ shots: number; collections: number }> {
  const specs = SPECS;
  const created: Shot[] = [];
  for (const spec of specs) {
    const canvas = demoCanvas(spec.draw);
    const full = await toJpeg(canvas, 0, 0.9);
    // small canvas for thumb
    const t = document.createElement('canvas');
    const scale = 512 / Math.max(canvas.width, canvas.height);
    t.width = Math.round(canvas.width * scale);
    t.height = Math.round(canvas.height * scale);
    t.getContext('2d')!.drawImage(canvas, 0, 0, t.width, t.height);
    const thumb = await toJpeg(t, 0, 0.8);
    const now = Date.now();
    const createdAt = now - spec.daysAgo * 86400000 - Math.floor(Math.random() * 6 * 3600000);
    const hash = aHash(await (async () => {
      const img = new Image();
      img.src = URL.createObjectURL(full);
      await img.decode();
      return img;
    })());
    const shot: Shot = {
      id: uid('s_'),
      createdAt,
      addedAt: createdAt + 3600000,
      fileName: spec.fileName,
      width: canvas.width,
      height: canvas.height,
      bytes: full.size,
      ocr: spec.ocr,
      ocrStatus: 'done',
      aiStatus: spec.ai ? 'done' : 'skipped',
      ai: spec.ai ?? null,
      hash,
      value: spec.value,
      valueReason: spec.valueReason,
      source: 'demo',
    };
    await createShotWithId(shot, { id: shot.id, thumb, full });
    created.push(shot);
  }
  // mark the second fee voucher as duplicate of the first
  const first = created.find((s) => s.fileName === 'uni_fee_voucher.jpg');
  const dupe = created.find((s) => s.fileName === 'dupe_fee_voucher.jpg');
  if (first && dupe) {
    await (await import('./repo')).updateShot(dupe.id, {
      dupOf: first.id,
      value: 'duplicate',
      valueReason: 'Very similar to a screenshot you already have — keep the better one',
    });
  }
  const colls: Collection[] = [
    { id: uid('c_'), name: 'GIFT University', emoji: '🎓', auto: false, createdAt: Date.now(), shotIds: created.filter((s) => ['uni_fee_voucher.jpg', 'dupe_fee_voucher.jpg'].includes(s.fileName)).map((s) => s.id) },
    { id: uid('c_'), name: 'Turkey Trip', emoji: '✈️', auto: false, createdAt: Date.now(), shotIds: created.filter((s) => s.fileName === 'flight_booking.jpg').map((s) => s.id) },
    { id: uid('c_'), name: 'Coding Errors', emoji: '👨‍💻', auto: false, createdAt: Date.now(), shotIds: created.filter((s) => s.fileName === 'react_error.jpg').map((s) => s.id) },
  ];
  for (const c of colls) await (await import('./repo')).saveColl(c);
  return { shots: created.length, collections: colls.length };
}

export const DEMO_NOTE = 'Demo screenshots are drawn locally for testing. They are not your real screenshots.';
