import type { FeeTier } from './types';

/** From the store's "GCash Cash In / Cash Out" rate sheet. */
export const DEFAULT_FEES: FeeTier[] = [
  [200, 5], [600, 10], [1000, 15], [1500, 20], [2000, 25], [2500, 30], [3000, 35],
  [3500, 40], [4000, 45], [4500, 50], [5000, 55], [5500, 60], [6000, 65], [6500, 70],
  [7000, 75], [7500, 80], [8000, 85], [8500, 90], [9000, 95], [9500, 100], [10000, 110],
].map(([upTo, fee]) => ({ upTo, fee }));

/** Fee for an amount, or null when the amount is above the last tier (type it by hand). */
export function feeFor(amount: number, table: FeeTier[]): number | null {
  if (!(amount > 0)) return null;
  const sorted = [...table].sort((a, b) => a.upTo - b.upTo);
  for (const t of sorted) if (amount <= t.upTo) return t.fee;
  return null;
}

/** Label such as "201–600" for tier i. */
export function tierLabel(table: FeeTier[], i: number): string {
  const lo = i === 0 ? 20 : table[i - 1].upTo + 1;
  const n = (v: number) => v.toLocaleString('en-US');
  return `${n(lo)}–${n(table[i].upTo)}`;
}
