import { describe, expect, it } from 'vitest';
import { DEFAULT_FEES, feeFor, tierLabel } from '../src/lib/fees';

describe('feeFor', () => {
  it.each([
    [20, 5], [200, 5], [200.5, 10], [201, 10], [600, 10], [601, 15], [1000, 15],
    [3000, 35], [3001, 40], [3500, 40], [3501, 45], [9500, 100], [9501, 110], [10000, 110],
  ])('amount %d costs %d', (amount, fee) => {
    expect(feeFor(amount, DEFAULT_FEES)).toBe(fee);
  });

  it('returns null above the table and for zero', () => {
    expect(feeFor(10001, DEFAULT_FEES)).toBeNull();
    expect(feeFor(0, DEFAULT_FEES)).toBeNull();
  });

  it('has 21 tiers and readable labels', () => {
    expect(DEFAULT_FEES).toHaveLength(21);
    expect(tierLabel(DEFAULT_FEES, 0)).toBe('20–200');
    expect(tierLabel(DEFAULT_FEES, 20)).toBe('9,501–10,000');
  });
});
