/**
 * Reads a GCash receipt (OCR text) and pulls out the fields we record.
 * Handles: inbox "Express Send", inbox "Bank Transfer Status",
 * "Transaction Details" screen, and photos of another phone ("Sent via GCash").
 */
import { refKind } from './format';

export interface ParsedReceipt {
  ref: string;
  /** True only when the reference is exactly 13 digits. */
  refOk: boolean;
  amount: number | null;
  txAt: number | null;
  name: string;
  number: string;
  /** Where the money came from: "GCash" or the other wallet or bank, like "MariBank". */
  source: string;
}

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

/** Fix common OCR mix-ups, then drop spaces. */
function cleanDigits(s: string): string {
  return s.replace(/[Oo]/g, '0').replace(/[Il|]/g, '1').replace(/\s+/g, '');
}

/**
 * A reference from another bank or wallet (InstaPay): the date, then letters and digits, like
 * 20261028LAUIPHM2XXXB000000609658881. The reader may split it with spaces or a line break, or spoil
 * the date digits (O for 0), so the pieces are joined and the date part is repaired before checking.
 */
function bankRef(rest: string): string {
  const chunks: string[] = [];
  const re = /\s*([A-Za-z0-9]+)/y;
  let pos = 0;
  while (chunks.length < 4) {
    re.lastIndex = pos;
    const c = re.exec(rest);
    if (!c) break;
    chunks.push(c[1]);
    pos = re.lastIndex;
  }
  for (let k = chunks.length; k >= 1; k--) {
    const joined = chunks.slice(0, k).join('').toUpperCase();
    if (joined.length < 16 || joined.length > 40) continue;
    const fixed = joined.slice(0, 8).replace(/O/g, '0').replace(/[IL]/g, '1') + joined.slice(8);
    if (refKind(fixed) === 'bank') return fixed;
  }
  return '';
}

export function extractRef(text: string): { ref: string; ok: boolean } {
  let candidate = '';

  const label = /\bref(?:erence)?\.?\s*(?:no\.?|number|#)?\s*[:.]?\s*/gi;
  const token = /[0-9OolI|]+(?![A-Za-z0-9])/y;
  let m: RegExpExecArray | null;
  while ((m = label.exec(text))) {
    const rest = text.slice(m.index + m[0].length);
    const bank = bankRef(rest);
    if (bank) return { ref: bank, ok: true };
    const tokens: string[] = [];
    let pos = 0;
    while (tokens.length < 4) {
      token.lastIndex = pos;
      const t = token.exec(rest);
      if (!t) break;
      tokens.push(t[0]);
      pos = token.lastIndex;
      if (rest[pos] !== ' ') break;
      pos += 1;
    }
    // Try the longest group first, then shorter (a time like "1:23" may follow).
    for (let k = tokens.length; k >= 1; k--) {
      const digits = cleanDigits(tokens.slice(0, k).join(' '));
      if (/^\d{13}$/.test(digits)) return { ref: digits, ok: true };
    }
    if (tokens.length) {
      const digits = cleanDigits(tokens.join(' '));
      if (/^\d{8,}$/.test(digits) && digits.length > candidate.length) candidate = digits;
    }
  }

  // Fallback: a standalone 13-digit number that is not a Trace No. or invno.
  const lone = /(?<!\d)\d{13}(?!\d)/g;
  while ((m = lone.exec(text))) {
    const before = text.slice(Math.max(0, m.index - 16), m.index);
    if (!/trace|invno/i.test(before)) return { ref: m[0], ok: true };
  }

  return { ref: candidate, ok: false };
}

function money(s: string): number {
  return Number(s.replace(/,/g, ''));
}

export function extractAmount(text: string): number | null {
  const tries: RegExp[] = [
    /received\s*(?:PHP|P|₱)?\s*([\d,]+\.\d{2})/i,
    /sent\s*(?:PHP|P|₱)\s*([\d,]+\.\d{2})/i,
    /\bAmount\b(?!\s*Sent)[^\d]{0,12}([\d,]+\.\d{2})/i,
    /Total\s+Amount\s+Sent[^\d]{0,12}([\d,]+\.\d{2})/i,
    /(?:PHP|P|₱)?\s*(\d{1,3}(?:,\d{3})*\.\d{2})/i,
  ];
  for (const re of tries) {
    const m = re.exec(text);
    if (m) {
      const v = money(m[1]);
      if (Number.isFinite(v) && v > 0) return v;
    }
  }
  return null;
}

function toMs(y: number, mon: number, d: number, h: number, min: number, ap: string): number {
  let hh = h % 12;
  if (/pm/i.test(ap)) hh += 12;
  return new Date(y, mon, d, hh, min).getTime();
}

export function extractDateTime(text: string, now: number = Date.now()): number | null {
  // Today, 12:16 PM   |   Yesterday, 9:05 AM   (GCash inbox messages print no calendar date)
  const rel = /\b(today|yesterday)\b[\s,.:;-]*(\d{1,2})\s*[:.]\s*(\d{2})\s*(AM|PM)/i.exec(text);
  if (rel) {
    const day = new Date(now);
    if (rel[1].toLowerCase() === 'yesterday') day.setDate(day.getDate() - 1);
    return toMs(day.getFullYear(), day.getMonth(), day.getDate(), +rel[2], +rel[3], rel[4]);
  }
  // 10-28-26 08:04 PM   (inside a "GCash Funds Received" message: the real time of the transfer)
  const us = /(?<!\d)(\d{1,2})-(\d{1,2})-(\d{2})\s+(\d{1,2}):(\d{2})\s*(AM|PM)/i.exec(text);
  if (us && +us[1] >= 1 && +us[1] <= 12 && +us[2] >= 1 && +us[2] <= 31 && +us[4] >= 1 && +us[4] <= 12 && +us[5] <= 59) {
    return toMs(2000 + +us[3], +us[1] - 1, +us[2], +us[4], +us[5], us[6]);
  }
  // Nov 2, 2026 4:39 PM   |   November 08, 2026 1:23 PM
  let m = /([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})\s+(\d{1,2}):(\d{2})\s*(AM|PM)/i.exec(text);
  if (m) {
    const mon = MONTHS[m[1].slice(0, 3).toLowerCase()];
    if (mon !== undefined) return toMs(+m[3], mon, +m[2], +m[4], +m[5], m[6]);
  }
  // 2026-Nov-03 01:01:25 PM
  m = /(\d{4})-([A-Za-z]{3})-(\d{1,2})\s+(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)/i.exec(text);
  if (m) {
    const mon = MONTHS[m[2].toLowerCase()];
    if (mon !== undefined) return toMs(+m[1], mon, +m[3], +m[4], +m[5], m[6]);
  }
  return fuzzyDateTime(text);
}

const MONTH_NAMES = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

function distance(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  }
  return d[a.length][b.length];
}

/** A month word the reader may have spoiled: "0ctober", "Octoher", "Nov.". Returns 0 to 11, or null. */
function fuzzyMonth(word: string): number | null {
  const t = word.toLowerCase().replace(/\./g, '').replace(/0/g, 'o').replace(/5/g, 's').replace(/1/g, 'l').replace(/8/g, 'b');
  if (t.length < 3) return null;
  if (t.length === 3) return MONTHS[t] ?? null;
  let best: number | null = null;
  let bestD = 2;
  MONTH_NAMES.forEach((name, i) => {
    const dist = Math.min(distance(t, name), t.length === 4 && name.startsWith(t) ? 0 : 9);
    if (dist < bestD) {
      bestD = dist;
      best = i;
    }
  });
  return best;
}

const num = (s: string) => Number(s.replace(/[Oo]/g, '0').replace(/[Il|]/g, '1'));

/**
 * A date the text reader got a little wrong: "0ctober 26, 2026 O5.39 PN", or the date and the time on two lines.
 * Every part is checked to be a real date and time, so a wrong guess is rare.
 */
function fuzzyDateTime(text: string): number | null {
  const re = /([A-Za-z0-9]{3,9})\.?\s*(\d{1,2}|[OoIl]{1,2}\d?)\s*[,.]?\s+([12][0-9OoIl]{3})[\s,]*(?:at\s*)?([0-9OoIl]{1,2})\s*[:.;]\s*([0-9OoIl]{2})\s*([AaPp])\s*[MmNn]?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const mon = fuzzyMonth(m[1]);
    if (mon == null) continue;
    const day = num(m[2]);
    const year = num(m[3]);
    const hour = num(m[4]);
    const min = num(m[5]);
    if (day < 1 || day > 31 || year < 2000 || year > 2099 || hour < 1 || hour > 12 || min > 59) continue;
    return toMs(year, mon, day, hour, min, /^[Pp]/.test(m[6]) ? 'PM' : 'AM');
  }
  return null;
}

/** Characters that hide digits in a masked number (and ones OCR confuses them with). */
const MASK_CHARS = '●•*xX·○◦#_';
const MASKED_PHONE = new RegExp(`(?:\\+\\s?63|63|0)\\s?9[\\dOo\\s${MASK_CHARS}.\\-]{5,16}\\d{2,4}(?!\\d)`, 'g');
const HAS_MASK = new RegExp(`[${MASK_CHARS}]|[Oo]{3,}`);

export function extractPhone(text: string): { number: string; index: number; end: number } {
  const full = /(?:\+?63|0)[\s-]?(9\d{2})[\s-]?(\d{3})[\s-]?(\d{4})(?!\d)/.exec(text);
  if (full) return { number: `0${full[1]}${full[2]}${full[3]}`, index: full.index, end: full.index + full[0].length };
  MASKED_PHONE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = MASKED_PHONE.exec(text))) {
    if (HAS_MASK.test(m[0])) {
      // OCR often reads the dots as the letter O. Show them as dots again.
      const shown = m[0].trim().replace(/[Oo]{3,}/g, (r) => '●'.repeat(r.length));
      return { number: shown, index: m.index, end: m.index + m[0].length };
    }
  }
  return { number: '', index: -1, end: -1 };
}

const SKIP_LINE = /transfer from|express send|notification|received gcash|transaction|sent via|gcash|amount|total|date|time|reference|ref\b|balance|bank|account|msg|fee|status|successful|share|home|done|back/i;

function cleanName(raw: string): string {
  const n = raw.replace(/\s+/g, ' ').replace(/^[\s:,-]+|[\s:,-]+$/g, '');
  if (!n || /\d/.test(n) || n.length < 2 || n.length > 40) return '';
  if (SKIP_LINE.test(n) && !/[*•●]/.test(n)) return '';
  return n;
}

export function extractName(text: string, phoneIndex: number, phoneEnd: number = -1): string {
  if (phoneIndex >= 0) {
    const before = text.slice(0, phoneIndex);

    // 1. "... from NAME +63 9..." (the name may wrap onto the next line)
    const idx = before.toLowerCase().lastIndexOf('from ');
    if (idx >= 0 && before.length - idx <= 70) {
      const n = cleanName(before.slice(idx + 5));
      if (n && !/^(gcash|maribank|bank)\b/i.test(n)) return n;
    }

    // 2. On the same line, before the number.
    const lineStart = before.lastIndexOf('\n') + 1;
    const sameLine = cleanName(before.slice(lineStart));
    if (sameLine) return sameLine;

    // 3. The line above the number.
    const lines = before.slice(0, lineStart).split('\n').map((l) => l.trim()).filter(Boolean);
    for (let i = lines.length - 1; i >= Math.max(0, lines.length - 2); i--) {
      const n = cleanName(lines[i]);
      if (n) return n;
    }

    // 4. The line below the number.
    const after = text.slice(phoneEnd >= 0 ? phoneEnd : phoneIndex).split('\n').map((l) => l.trim()).filter(Boolean);
    for (const l of after.slice(0, 2)) {
      const n = cleanName(l);
      if (n) return n;
    }
  }

  // No number found: take the words after "from".
  const m = /\bfrom\s+([A-Za-z][^\d\n+]{1,38}?)(?=\s*(?:\+|\d|\n|\sw\/|$))/i.exec(text);
  if (m) {
    const n = cleanName(m[1]);
    if (n && !/\b(bank|account|gcash|with|ending)\b/i.test(n)) return n;
  }
  return '';
}

/** Other wallets and banks a transfer can come from. The first spelling is the name that is shown. */
const SOURCES: Array<[string, RegExp]> = [
  ['MariBank', /mari\s?bank/i],
  ['Maya', /pay\s?maya|\bmaya\b/i],
  ['GoTyme', /go\s?tyme/i],
  ['SeaBank', /sea\s?bank/i],
  ['GrabPay', /grab\s?pay/i],
  ['ShopeePay', /shopee\s?pay/i],
  ['Coins.ph', /coins\.?\s?ph/i],
  ['BDO', /\bbdo\b/i],
  ['BPI', /\bbpi\b/i],
  ['UnionBank', /union\s?bank/i],
  ['Metrobank', /metro\s?bank/i],
  ['Landbank', /land\s?bank/i],
  ['Security Bank', /security\s?bank/i],
  ['PNB', /\bpnb\b/i],
  ['RCBC', /\brcbc\b/i],
  ['CIMB', /\bcimb\b/i],
  ['Tonik', /\btonik\b/i],
  ['UNO', /\buno\s?digital|\buno\s?bank/i],
  ['Komo', /\bkomo\b/i],
];
/** Brands that are safe to find anywhere in the text. A short or common word needs "from" / "to" in front. */
const SAFE = new Set(['MariBank', 'GoTyme', 'SeaBank', 'GrabPay', 'ShopeePay', 'Coins.ph', 'UnionBank', 'Metrobank', 'Landbank', 'Security Bank']);

export function extractSource(text: string): string {
  // "from MariBank with account ending...", "to BDO account..." : the word after from / to / via.
  const lead = /\b(?:from|to|via|thru|through)\s+([A-Za-z0-9.]+(?:\s[A-Za-z]+)?)/gi;
  let m: RegExpExecArray | null;
  while ((m = lead.exec(text))) {
    // "from MAYA R. +63 9..." is a person called Maya, not the wallet.
    const personLike = /^maya\s+[A-Za-z]$/i.test(m[1]) || /^\s*[.,]?\s*(?:\+|[●•*]|0?9\d)/.test(text.slice(m.index + m[0].length, m.index + m[0].length + 8));
    for (const [name, re] of SOURCES) if (re.test(m[1]) && !(name === 'Maya' && personLike)) return name;
  }
  for (const [name, re] of SOURCES) if (SAFE.has(name) && re.test(text)) return name;
  return 'GCash';
}

export function parseReceipt(text: string, now: number = Date.now()): ParsedReceipt {
  const { ref, ok } = extractRef(text);
  const phone = extractPhone(text);
  return {
    ref,
    refOk: ok,
    amount: extractAmount(text),
    txAt: extractDateTime(text, now),
    name: extractName(text, phone.index, phone.end),
    number: phone.number,
    source: extractSource(text),
  };
}
