/**
 * Reads a GCash receipt (OCR text) and pulls out the fields we record.
 * Handles: inbox "Express Send", inbox "Bank Transfer Status",
 * "Transaction Details" screen, and photos of another phone ("Sent via GCash").
 */
export interface ParsedReceipt {
  ref: string;
  /** True only when the reference is exactly 13 digits. */
  refOk: boolean;
  amount: number | null;
  txAt: number | null;
  name: string;
  number: string;
}

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

/** Fix common OCR mix-ups, then drop spaces. */
function cleanDigits(s: string): string {
  return s.replace(/[Oo]/g, '0').replace(/[Il|]/g, '1').replace(/\s+/g, '');
}

export function extractRef(text: string): { ref: string; ok: boolean } {
  let candidate = '';

  const label = /\bref(?:erence)?\.?\s*(?:no\.?|number|#)?\s*[:.]?\s*/gi;
  const token = /[0-9OolI|]+(?![A-Za-z0-9])/y;
  let m: RegExpExecArray | null;
  while ((m = label.exec(text))) {
    const rest = text.slice(m.index + m[0].length);
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

export function extractDateTime(text: string): number | null {
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
  return null;
}

const MASK = '●•*xX';

export function extractPhone(text: string): { number: string; index: number } {
  const full = /(?:\+?63|0)[\s-]?(9\d{2})[\s-]?(\d{3})[\s-]?(\d{4})(?!\d)/.exec(text);
  if (full) return { number: `0${full[1]}${full[2]}${full[3]}`, index: full.index };
  const masked = new RegExp(`(?:\\+?63|0)\\s?9[\\d\\s${MASK}]{5,12}\\d{2,4}(?!\\d)`).exec(text);
  if (masked && new RegExp(`[${MASK}]`).test(masked[0])) {
    return { number: masked[0].trim(), index: masked.index };
  }
  return { number: '', index: -1 };
}

const SKIP_LINE = /transfer from|express send|notification|received gcash|transaction|sent via|gcash|amount|total|date|reference|ref\b/i;

export function extractName(text: string, phoneIndex: number): string {
  const between = /\bfrom\s+([^\d+\n]{2,40}?)\s*(?:\+?63|09)/i.exec(text);
  if (between) {
    const n = between[1].trim();
    if (n && !/^(gcash|mari)/i.test(n)) return n;
  }
  if (phoneIndex >= 0) {
    const before = text.slice(0, phoneIndex);
    const sameLine = before.slice(before.lastIndexOf('\n') + 1).trim();
    if (sameLine && !/\d/.test(sameLine) && !SKIP_LINE.test(sameLine)) return sameLine;
    const lines = before.split('\n').map((l) => l.trim()).filter(Boolean);
    const prev = lines.length ? lines[lines.length - (sameLine ? 2 : 1)] : '';
    if (prev && !/\d/.test(prev) && !SKIP_LINE.test(prev)) return prev;
  }
  return '';
}

export function parseReceipt(text: string): ParsedReceipt {
  const { ref, ok } = extractRef(text);
  const phone = extractPhone(text);
  return {
    ref,
    refOk: ok,
    amount: extractAmount(text),
    txAt: extractDateTime(text),
    name: extractName(text, phone.index),
    number: phone.number,
  };
}
