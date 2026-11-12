import { businessDayStart, DAY_CUTOFF_HOUR, dayKey, formatRef, shortDate } from './format';
import type { AmountBand, CashRecord, Filters, Period } from './types';
import { sourceOf } from './wallets';

const DAY = 86_400_000;

/** Older records have no status and are paid. */
export const isPending = (r: CashRecord): boolean => r.status === 'pending';

/** Two hours of waiting turns the reminder stronger. */
export const LATE_MS = 2 * 3_600_000;

/** When the cash went out: the time it was marked paid, or when it was saved. Pending records use the save time. */
export const whenOf = (r: CashRecord): number => (isPending(r) ? r.savedAt : (r.paidAt ?? r.savedAt));

/** Start of the business day (2:00 AM) that contains ms. */
const startOfDay = businessDayStart;

/** The business day that starts on a calendar date typed as YYYY-MM-DD: that date at 2:00 AM. */
function dateStart(day: string): number {
  const d = new Date(`${day}T00:00:00`);
  d.setHours(DAY_CUTOFF_HOUR, 0, 0, 0);
  return d.getTime();
}

/** Start and end (exclusive) of a period, in ms. null means no limit. */
export function periodRange(f: Pick<Filters, 'period' | 'from' | 'to'>, now: number): { from: number | null; to: number | null } {
  const today = startOfDay(now);
  switch (f.period) {
    case 'today': return { from: today, to: today + DAY };
    case 'yesterday': return { from: today - DAY, to: today };
    case 'week': return { from: today - 6 * DAY, to: today + DAY };
    case 'month': return { from: today - 29 * DAY, to: today + DAY };
    case 'custom': {
      const from = f.from ? dateStart(f.from) : null;
      const to = f.to ? dateStart(f.to) + DAY : null;
      return { from, to };
    }
    default: return { from: null, to: null };
  }
}

export function inBand(amount: number, band: AmountBand): boolean {
  switch (band) {
    case 'u1k': return amount < 1000;
    case 'b1k5k': return amount >= 1000 && amount <= 5000;
    case 'o5k': return amount > 5000;
    default: return true;
  }
}

export type MatchField = 'ref' | 'number' | 'amount' | 'name' | 'staff';

const lower = (s: string) => s.toLowerCase();
const noSpace = (s: string) => s.replace(/\s+/g, '');

/** Which field of the record the search text matches, or null. */
export function matchRecord(r: CashRecord, q: string): MatchField | null {
  const t = lower(q.trim());
  if (!t) return null;
  const digits = noSpace(t);
  const money = t.replace(/[₱,\s]/g, '');

  if (/^\d{3,}$/.test(digits) && r.ref.includes(digits)) return 'ref';
  if (/^[\d+●•*xX-]{3,}$/.test(digits) && lower(noSpace(r.number)).includes(lower(digits))) return 'number';
  if (/^\d+(\.\d*)?$/.test(money) && (String(r.amount).startsWith(money) || r.amount.toFixed(2).startsWith(money))) return 'amount';
  if (lower(r.name).includes(t)) return 'name';
  if (lower(r.by).includes(t)) return 'staff';
  return null;
}

/** Lower is better. Reference endings first, then exact amounts, then names that start with the text. */
function score(r: CashRecord, q: string, field: MatchField): number {
  const t = lower(q.trim());
  const digits = noSpace(t);
  if (field === 'ref') return r.ref.endsWith(digits) ? 0 : 1;
  if (field === 'amount') return r.amount.toFixed(2) === t.replace(/[₱,\s]/g, '') || String(r.amount) === t.replace(/[₱,\s]/g, '') ? 1 : 2;
  if (field === 'name') return lower(r.name).startsWith(t) ? 2 : 3;
  return 3;
}

/**
 * With search text: look through all dates (the date choice is ignored), newest first
 * within the best matches. Without search text: the date, amount and staff choices apply.
 */
export function applyFilters(records: CashRecord[], f: Filters, now: number = Date.now()): CashRecord[] {
  const term = f.q.trim();
  const pick = (r: CashRecord) =>
    inBand(r.amount, f.amount) &&
    (f.staff === 'all' || r.by === f.staff) &&
    (f.wallet === 'all' || sourceOf(r) === f.wallet) &&
    (f.status === 'all' || (f.status === 'pending') === isPending(r));

  if (term) {
    const hits: { r: CashRecord; s: number }[] = [];
    for (const r of records) {
      if (!pick(r)) continue;
      const field = matchRecord(r, term);
      if (field) hits.push({ r, s: score(r, term, field) });
    }
    hits.sort((a, b) => a.s - b.s || b.r.savedAt - a.r.savedAt);
    return hits.map((h) => h.r);
  }

  // The Pending view shows every pending record, whatever day it was saved.
  if (f.status === 'pending') return records.filter(pick);

  const { from, to } = periodRange(f, now);
  return records.filter((r) => {
    const t = whenOf(r);
    return (from == null || t >= from) && (to == null || t < to) && pick(r);
  });
}

/** The grouped reference with the typed digits marked, even when they run across a space. */
export function highlightRef(ref: string, q: string): { t: string; hit: boolean }[] {
  const grouped = formatRef(ref);
  const needle = q.replace(/\s+/g, '');
  const start = needle ? ref.indexOf(needle) : -1;
  if (start < 0) return [{ t: grouped, hit: false }];
  const end = start + needle.length;
  const out: { t: string; hit: boolean }[] = [];
  let digits = 0;
  for (const ch of grouped) {
    const isDigit = /\d/.test(ch);
    const hit = isDigit ? digits >= start && digits < end : digits - 1 >= start && digits < end;
    if (isDigit) digits += 1;
    const last = out[out.length - 1];
    if (last && last.hit === hit) last.t += ch;
    else out.push({ t: ch, hit });
  }
  return out;
}

/** Splits text into pieces, marking the parts that match the search text. */
export function highlight(text: string, q: string): { t: string; hit: boolean }[] {
  const needle = q.trim();
  if (!needle || !text) return [{ t: text, hit: false }];
  const out: { t: string; hit: boolean }[] = [];
  const lo = lower(text);
  const n = lower(needle);
  let i = 0;
  for (;;) {
    const j = lo.indexOf(n, i);
    if (j < 0) break;
    if (j > i) out.push({ t: text.slice(i, j), hit: false });
    out.push({ t: text.slice(j, j + n.length), hit: true });
    i = j + n.length;
  }
  if (i < text.length) out.push({ t: text.slice(i), hit: false });
  return out.length ? out : [{ t: text, hit: false }];
}

export interface Summary {
  /** Paid cash-outs only. */
  count: number;
  total: number;
  fees: number;
  people: { name: string; n: number; sum: number }[];
  pendingCount: number;
  pendingTotal: number;
  /** Save time of the oldest pending record, or null. */
  oldestPending: number | null;
}

/** Totals count only paid records. Pending ones are listed apart. */
export function summarize(list: CashRecord[]): Summary {
  const m = new Map<string, { n: number; sum: number }>();
  let total = 0;
  let fees = 0;
  let count = 0;
  let pendingCount = 0;
  let pendingTotal = 0;
  let oldestPending: number | null = null;
  for (const r of list) {
    if (isPending(r)) {
      pendingCount += 1;
      pendingTotal += r.amount;
      oldestPending = oldestPending == null ? r.savedAt : Math.min(oldestPending, r.savedAt);
      continue;
    }
    count += 1;
    total += r.amount;
    fees += r.fee;
    const p = m.get(r.by) ?? { n: 0, sum: 0 };
    p.n += 1;
    p.sum += r.amount;
    m.set(r.by, p);
  }
  const people = [...m.entries()].map(([name, p]) => ({ name, ...p })).sort((a, b) => b.n - a.n || b.sum - a.sum);
  return { count, total, fees, people, pendingCount, pendingTotal, oldestPending };
}

export function periodLabel(f: Filters, now: number = Date.now()): string {
  if (f.status === 'pending') return 'Pending';
  const short = (ms: number) => new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  switch (f.period) {
    case 'today': return 'Today';
    case 'yesterday': return 'Yesterday';
    case 'week': return 'Last 7 days';
    case 'month': return 'Last 30 days';
    case 'all': return 'All time';
    case 'custom': {
      if (f.from && f.to) return `${short(new Date(`${f.from}T00:00:00`).getTime())} – ${short(new Date(`${f.to}T00:00:00`).getTime())}`;
      if (f.from) return `From ${short(new Date(`${f.from}T00:00:00`).getTime())}`;
      if (f.to) return `Until ${short(new Date(`${f.to}T00:00:00`).getTime())}`;
      return 'Custom range';
    }
  }
}

export function staffNames(records: CashRecord[]): string[] {
  return [...new Set(records.map((r) => r.by))].sort((a, b) => a.localeCompare(b));
}

export function activeFilterCount(f: Filters): number {
  return (f.amount !== 'any' ? 1 : 0) + (f.staff !== 'all' ? 1 : 0) + (f.wallet !== 'all' ? 1 : 0);
}

export function isPeriod(p: string): p is Period {
  return ['today', 'yesterday', 'week', 'month', 'all', 'custom'].includes(p);
}

export { dayKey };

export interface DayGroup {
  key: string;
  /** today, yesterday, or the date. */
  kind: 'today' | 'yesterday' | 'date';
  /** Start of that day (ms). */
  day: number;
  /** Cash given out that day. In the Pending view: the amount still waiting. */
  total: number;
  count: number;
  records: CashRecord[];
}

/** Records grouped by the day the cash went out, newest day first. */
export function groupByDay(list: CashRecord[], now: number = Date.now(), pendingView = false): DayGroup[] {
  const today = dayKey(now);
  const yesterday = dayKey(now - DAY);
  const map = new Map<string, DayGroup>();
  for (const r of [...list].sort((a, b) => whenOf(b) - whenOf(a))) {
    const t = whenOf(r);
    const key = dayKey(t);
    let g = map.get(key);
    if (!g) {
      g = { key, kind: key === today ? 'today' : key === yesterday ? 'yesterday' : 'date', day: startOfDay(t), total: 0, count: 0, records: [] };
      map.set(key, g);
    }
    g.records.push(r);
    g.count += 1;
    if (pendingView ? isPending(r) : !isPending(r)) g.total += r.amount;
  }
  return [...map.values()].sort((a, b) => b.day - a.day);
}

/** The text above a day group, in English. Translate it where it is shown. */
export const dayLabel = (g: DayGroup): string => (g.kind === 'today' ? 'Today' : g.kind === 'yesterday' ? 'Yesterday' : shortDate(g.day));
