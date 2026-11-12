import { businessDayStart } from './format';
import { isPending, whenOf } from './records';
import type { CashRecord } from './types';

export type InsightRange = '7' | '30' | '90';

export interface Bucket {
  /** Start of the day (or week). */
  start: number;
  /** Cash given out in this bucket (paid records only). */
  cash: number;
  /** Charge earned in this bucket (paid records only). */
  charge: number;
  count: number;
}

export interface Insights {
  buckets: Bucket[];
  cash: number;
  charge: number;
  count: number;
  /** Average cash-out amount. 0 when there is none. */
  average: number;
  /** The bucket with the most charge, or null when there is no cash-out. */
  best: Bucket | null;
  /** Percent change of Charge against the period before, or null when the period before had none. */
  chargeDelta: number | null;
  cashDelta: number | null;
}

const DAY = 86_400_000;

/** How many buckets and how long each is. 7 and 30 days are daily bars, 3 months is 13 weekly bars. */
export const RANGES: Record<InsightRange, { n: number; step: number }> = {
  '7': { n: 7, step: DAY },
  '30': { n: 30, step: DAY },
  '90': { n: 13, step: 7 * DAY },
};

const pct = (now: number, before: number): number | null => (before > 0 ? Math.round(((now - before) / before) * 100) : null);

/** Charge and cash-out over time. Days start at 2:00 AM and only paid records count, like the rest of the app. */
export function insightsFor(records: CashRecord[], range: InsightRange, now: number = Date.now()): Insights {
  const { n, step } = RANGES[range];
  // The last bucket is the business day (or week) that contains now. Add a day ahead of it, then count back.
  const end = businessDayStart(now) + DAY;
  const first = end - n * step;
  const prevFirst = first - n * step;
  const buckets: Bucket[] = Array.from({ length: n }, (_, i) => ({ start: first + i * step, cash: 0, charge: 0, count: 0 }));
  let prevCash = 0;
  let prevCharge = 0;
  for (const r of records) {
    if (isPending(r)) continue;
    const t = whenOf(r);
    if (t >= first && t < end) {
      const b = buckets[Math.min(n - 1, Math.floor((t - first) / step))];
      b.cash += r.amount;
      b.charge += r.fee;
      b.count += 1;
    } else if (t >= prevFirst && t < first) {
      prevCash += r.amount;
      prevCharge += r.fee;
    }
  }
  const cash = buckets.reduce((s, b) => s + b.cash, 0);
  const charge = buckets.reduce((s, b) => s + b.charge, 0);
  const count = buckets.reduce((s, b) => s + b.count, 0);
  let best: Bucket | null = null;
  for (const b of buckets) if (b.charge > 0 && (!best || b.charge > best.charge)) best = b;
  return { buckets, cash, charge, count, average: count ? cash / count : 0, best, chargeDelta: pct(charge, prevCharge), cashDelta: pct(cash, prevCash) };
}
