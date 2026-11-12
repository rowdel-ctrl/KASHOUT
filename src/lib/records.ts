import { dayKey } from './format';
import type { AmountBand, CashRecord, Filters, Period } from './types';

const DAY = 86_400_000;

function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Start and end (exclusive) of a period, in ms. null means no limit. */
export function periodRange(f: Pick<Filters, 'period' | 'from' | 'to'>, now: number): { from: number | null; to: number | null } {
  const today = startOfDay(now);
  switch (f.period) {
    case 'today': return { from: today, to: today + DAY };
    case 'yesterday': return { from: today - DAY, to: today };
    case 'week': return { from: today - 6 * DAY, to: today + DAY };
    case 'custom': {
      const from = f.from ? startOfDay(new Date(`${f.from}T00:00:00`).getTime()) : null;
      const to = f.to ? startOfDay(new Date(`${f.to}T00:00:00`).getTime()) + DAY : null;
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
  const byAmountStaff = (r: CashRecord) => inBand(r.amount, f.amount) && (f.staff === 'all' || r.by === f.staff);

  if (term) {
    const hits: { r: CashRecord; s: number }[] = [];
    for (const r of records) {
      if (!byAmountStaff(r)) continue;
      const field = matchRecord(r, term);
      if (field) hits.push({ r, s: score(r, term, field) });
    }
    hits.sort((a, b) => a.s - b.s || b.r.savedAt - a.r.savedAt);
    return hits.map((h) => h.r);
  }

  const { from, to } = periodRange(f, now);
  return records.filter((r) => (from == null || r.savedAt >= from) && (to == null || r.savedAt < to) && byAmountStaff(r));
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
  count: number;
  total: number;
  fees: number;
  people: { name: string; n: number; sum: number }[];
}

export function summarize(list: CashRecord[]): Summary {
  const m = new Map<string, { n: number; sum: number }>();
  let total = 0;
  let fees = 0;
  for (const r of list) {
    total += r.amount;
    fees += r.fee;
    const p = m.get(r.by) ?? { n: 0, sum: 0 };
    p.n += 1;
    p.sum += r.amount;
    m.set(r.by, p);
  }
  const people = [...m.entries()].map(([name, p]) => ({ name, ...p })).sort((a, b) => b.n - a.n || b.sum - a.sum);
  return { count: list.length, total, fees, people };
}

export function periodLabel(f: Filters, now: number = Date.now()): string {
  const short = (ms: number) => new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  switch (f.period) {
    case 'today': return 'Today';
    case 'yesterday': return 'Yesterday';
    case 'week': return 'Last 7 days';
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
  return (f.amount !== 'any' ? 1 : 0) + (f.staff !== 'all' ? 1 : 0);
}

export function isPeriod(p: string): p is Period {
  return ['today', 'yesterday', 'week', 'all', 'custom'].includes(p);
}

export { dayKey };
