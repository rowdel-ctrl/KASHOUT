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

export function parseReceipt(text: string): ParsedReceipt {
  const { ref, ok } = extractRef(text);
  const phone = extractPhone(text);
  return {
    ref,
    refOk: ok,
    amount: extractAmount(text),
    txAt: extractDateTime(text),
    name: extractName(text, phone.index, phone.end),
    number: phone.number,
  };
}
