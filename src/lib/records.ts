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

export function applyFilters(records: CashRecord[], f: Filters, now: number = Date.now()): CashRecord[] {
  const { from, to } = periodRange(f, now);
  const term = f.q.trim().toLowerCase();
  const digits = term.replace(/\s+/g, '');
  return records.filter((r) => {
    if (from != null && r.savedAt < from) return false;
    if (to != null && r.savedAt >= to) return false;
    if (!inBand(r.amount, f.amount)) return false;
    if (f.staff !== 'all' && r.by !== f.staff) return false;
    if (!term) return true;
    return (
      r.ref.includes(digits) ||
      r.name.toLowerCase().includes(term) ||
      r.number.replace(/\s+/g, '').includes(digits) ||
      String(r.amount).includes(term.replace(/[₱,]/g, '')) ||
      r.amount.toFixed(2).includes(term.replace(/[₱,]/g, ''))
    );
  });
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
