export function peso(n: number): string {
  const whole = Number.isInteger(n);
  return '₱' + n.toLocaleString('en-US', { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 });
}

export function peso2(n: number): string {
  return '₱' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function timeOf(ms: number): string {
  return new Date(ms).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

/**
 * The business day starts at 2:00 AM, not midnight: a cash-out at 1 AM still belongs to the night before.
 * Everything that says "today", "yesterday" or groups by day uses these.
 */
export const DAY_CUTOFF_HOUR = 2;
const CUTOFF_MS = DAY_CUTOFF_HOUR * 3_600_000;

/** When the business day that contains ms began (2:00 AM that day). */
export function businessDayStart(ms: number): number {
  const d = new Date(ms - CUTOFF_MS);
  d.setHours(DAY_CUTOFF_HOUR, 0, 0, 0);
  return d.getTime();
}

/** The next 2:00 AM after ms. */
export function nextCutoff(ms: number): number {
  const start = businessDayStart(ms);
  const d = new Date(start);
  d.setDate(d.getDate() + 1);
  return d.getTime();
}

export function dayKey(ms: number): string {
  const d = new Date(ms - CUTOFF_MS);
  const p = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function isToday(ms: number): boolean {
  return dayKey(ms) === dayKey(Date.now());
}

export function isYesterday(ms: number): boolean {
  return dayKey(ms) === dayKey(Date.now() - 86_400_000);
}

export function shortDate(ms: number): string {
  return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function dateTime(ms: number): string {
  return `${shortDate(ms)}, ${timeOf(ms)}`;
}

/** Value for <input type="datetime-local"> in local time. */
export function toLocalInput(ms: number | null): string {
  if (ms == null) return '';
  const d = new Date(ms);
  const p = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function fromLocalInput(v: string): number | null {
  if (!v) return null;
  const t = new Date(v).getTime();
  return Number.isNaN(t) ? null : t;
}

export function parseMoney(s: string): number {
  const n = Number(String(s).replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

/** A real calendar date at the start of a bank-transfer reference: 20261028. */
const DATE_PREFIX = /^20\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])/;

/**
 * Which kind of reference this is.
 * "gcash": exactly 13 digits. "bank": a transfer from another bank or wallet (InstaPay),
 * 16 to 40 letters and digits that start with the date, like 20261028LAUIPHM2XXXB000000609658881.
 */
export function refKind(ref: string): 'gcash' | 'bank' | null {
  const d = ref.replace(/\s+/g, '');
  if (/^\d{13}$/.test(d)) return 'gcash';
  if (/^[A-Za-z0-9]{16,40}$/.test(d) && /[A-Za-z]/.test(d) && DATE_PREFIX.test(d)) return 'bank';
  return null;
}

export const isValidRef = (ref: string): boolean => refKind(ref) !== null;

/** 13-digit references are shown in groups of 4, 4 and 5 so they are easy to compare: 0046 2760 76549. */
export function formatRef(ref: string): string {
  const d = ref.replace(/\s+/g, '');
  return /^\d{13}$/.test(d) ? `${d.slice(0, 4)} ${d.slice(4, 8)} ${d.slice(8)}` : ref;
}

/** A long bank reference (letters and digits, 16+ characters). Its start is the same on every receipt. */
export function isLongRef(ref: string): boolean {
  return ref.length > 16;
}

/** The last 12 characters of a long reference, grouped like a GCash one: "0006 4588 1411". */
export function refTail(ref: string): string {
  const tail = ref.slice(-12);
  return tail.replace(/(.{4})(?=.)/g, '$1 ');
}

/** The reference as written in a list row: GCash ones in full, long bank ones as "…" and the last 12. */
export function listRef(ref: string): string {
  return isLongRef(ref) ? `…${refTail(ref)}` : formatRef(ref);
}

/** How long something has been waiting: "25 min", "3 h", "2 d". */
export function waitText(ms: number, tl = false): string {
  const min = Math.max(0, Math.floor(ms / 60_000));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return tl ? `${h} oras` : `${h} h`;
  return tl ? `${Math.floor(h / 24)} araw` : `${Math.floor(h / 24)} d`;
}
