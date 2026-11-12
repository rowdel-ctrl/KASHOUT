import { describe, expect, it } from 'vitest';
import { insightsFor } from '../src/lib/insights';
import type { CashRecord } from '../src/lib/types';

const at = (d: number, h = 12, m = 0) => new Date(2026, 10, d, h, m).getTime();
const mk = (id: string, savedAt: number, amount: number, fee: number, extra: Partial<CashRecord> = {}): CashRecord => ({
  id, ref: id, amount, fee, name: '', number: '', txAt: null, savedAt, by: 'Ana', byUid: 'a', ...extra,
});
const NOW = at(12, 15);

describe('insights', () => {
  it('7 days: one bar per day, the last one is today', () => {
    const r = insightsFor([mk('a', at(12, 9), 500, 10), mk('b', at(11, 9), 1000, 15), mk('c', at(6, 9), 200, 5)], '7', NOW);
    expect(r.buckets).toHaveLength(7);
    expect(r.buckets[6].charge).toBe(10);
    expect(r.buckets[5].charge).toBe(15);
    expect(r.buckets[0].charge).toBe(5); // Nov 6 is the first of the 7 days
    expect(r.charge).toBe(30);
    expect(r.cash).toBe(1700);
    expect(r.count).toBe(3);
    expect(Math.round(r.average)).toBe(567);
  });
  it('pending records are not counted, a paid one counts on the day it was paid', () => {
    const r = insightsFor([mk('p', at(12, 9), 900, 20, { status: 'pending' }), mk('x', at(10, 9), 400, 10, { status: 'paid', paidAt: at(12, 11), paidBy: 'Ben', paidByUid: 'b' })], '7', NOW);
    expect(r.count).toBe(1);
    expect(r.buckets[6].cash).toBe(400);
  });
  it('after-midnight cash-outs belong to the night before (the day starts at 2 AM)', () => {
    const r = insightsFor([mk('n', at(13, 0, 40), 300, 5)], '7', at(13, 1, 0));
    expect(r.buckets[6].count).toBe(1); // still the Nov 12 business day
    const later = insightsFor([mk('n', at(13, 0, 40), 300, 5)], '7', at(13, 3, 0));
    expect(later.buckets[6].count).toBe(0);
    expect(later.buckets[5].count).toBe(1);
  });
  it('the change against the period before, and null when there was nothing before', () => {
    const recs = [mk('a', at(12, 9), 500, 20), mk('b', at(5, 9), 500, 10)]; // this week 20, the week before 10
    expect(insightsFor(recs, '7', NOW).chargeDelta).toBe(100);
    expect(insightsFor([mk('a', at(12, 9), 500, 20)], '7', NOW).chargeDelta).toBeNull();
  });
  it('the best day is the day with the most charge, and null with no cash-out', () => {
    const r = insightsFor([mk('a', at(12, 9), 500, 10), mk('b', at(9, 9), 500, 40)], '7', NOW);
    expect(r.best?.charge).toBe(40);
    expect(insightsFor([], '7', NOW).best).toBeNull();
    expect(insightsFor([], '7', NOW).average).toBe(0);
  });
  it('30 days has 30 bars and 3 months has 13 weekly bars', () => {
    expect(insightsFor([], '30', NOW).buckets).toHaveLength(30);
    const w = insightsFor([mk('a', at(12, 9), 500, 10), mk('b', at(3, 9), 500, 5)], '90', NOW);
    expect(w.buckets).toHaveLength(13);
    expect(w.buckets[12].charge).toBe(10); // the last 7 days
    expect(w.buckets[11].charge).toBe(5); // Nov 3 is 9 days back, so one week earlier
  });
});
