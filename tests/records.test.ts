import { describe, expect, it } from 'vitest';
import { applyFilters, inBand, periodLabel, staffNames, summarize } from '../src/lib/records';
import { reviewWarnings } from '../src/lib/warnings';
import { DEFAULT_FILTERS, type CashRecord, type Draft, type Filters } from '../src/lib/types';

const NOW = new Date(2026, 10, 11, 15, 0).getTime(); // Nov 11, 2026 3 PM
const at = (day: number, h = 10) => new Date(2026, 10, day, h, 0).getTime();

const rec = (id: string, over: Partial<CashRecord>): CashRecord => ({
  id, ref: id.padEnd(13, '0'), amount: 500, fee: 10, name: 'EX*****S L.', number: '09171234501',
  txAt: null, savedAt: at(11), by: 'Ana', byUid: 'u-ana', ...over,
});

const R = [
  rec('1000000000001', { amount: 500, savedAt: at(11) }),
  rec('1000000000002', { amount: 3500, savedAt: at(11, 14), by: 'Ben', byUid: 'u-ben', name: 'MA***A R.', number: '09XX4822' }),
  rec('1000000000003', { amount: 1000, savedAt: at(10), by: 'Tita Mel', byUid: 'u-mel' }),
  rec('1000000000004', { amount: 8000, savedAt: at(5), name: 'RO**L S.' }),
  rec('1000000000005', { amount: 250, savedAt: at(11, 9) }),
];

const f = (over: Partial<Filters>): Filters => ({ ...DEFAULT_FILTERS, ...over });

describe('applyFilters', () => {
  it('today / yesterday / last 7 days / all', () => {
    expect(applyFilters(R, f({ period: 'today' }), NOW).map((r) => r.id)).toEqual(['1000000000001', '1000000000002', '1000000000005']);
    expect(applyFilters(R, f({ period: 'yesterday' }), NOW).map((r) => r.id)).toEqual(['1000000000003']);
    // Last 7 days = Nov 5 to Nov 11 (7 calendar days). A record on Nov 4 is out.
    expect(applyFilters(R, f({ period: 'week' }), NOW)).toHaveLength(5);
    expect(applyFilters([...R, rec('1000000000009', { savedAt: at(4, 23) })], f({ period: 'week' }), NOW)).toHaveLength(5);
    expect(applyFilters(R, f({ period: 'all' }), NOW)).toHaveLength(5);
  });

  it('custom range includes both end days', () => {
    expect(applyFilters(R, f({ period: 'custom', from: '2026-11-10', to: '2026-11-11' }), NOW)).toHaveLength(4);
    expect(applyFilters(R, f({ period: 'custom', from: '2026-11-05', to: '2026-11-05' }), NOW)).toHaveLength(1);
    expect(applyFilters(R, f({ period: 'custom', from: '2026-11-11' }), NOW)).toHaveLength(3);
    expect(applyFilters(R, f({ period: 'custom', to: '2026-11-05' }), NOW)).toHaveLength(1);
  });

  it('amount range', () => {
    const all = f({ period: 'all' });
    expect(applyFilters(R, { ...all, amount: 'u1k' }, NOW).map((r) => r.amount)).toEqual([500, 250]);
    expect(applyFilters(R, { ...all, amount: 'b1k5k' }, NOW).map((r) => r.amount)).toEqual([3500, 1000]);
    expect(applyFilters(R, { ...all, amount: 'o5k' }, NOW).map((r) => r.amount)).toEqual([8000]);
    expect(inBand(1000, 'b1k5k')).toBe(true);
    expect(inBand(5000, 'b1k5k')).toBe(true);
    expect(inBand(5000.01, 'o5k')).toBe(true);
  });

  it('staff', () => {
    expect(applyFilters(R, f({ period: 'all', staff: 'Ben' }), NOW)).toHaveLength(1);
  });

  it('search by reference, name, number and amount', () => {
    const all = f({ period: 'all' });
    expect(applyFilters(R, { ...all, q: '1000000000003' }, NOW)).toHaveLength(1);
    expect(applyFilters(R, { ...all, q: '1000 0000 00003' }, NOW)).toHaveLength(1);
    expect(applyFilters(R, { ...all, q: 'ma***a' }, NOW)).toHaveLength(1);
    expect(applyFilters(R, { ...all, q: '4822' }, NOW)).toHaveLength(1);
    expect(applyFilters(R, { ...all, q: '₱3,500' }, NOW)).toHaveLength(1);
    expect(applyFilters(R, { ...all, q: '8000.00' }, NOW)).toHaveLength(1);
    expect(applyFilters(R, { ...all, q: 'nothing' }, NOW)).toHaveLength(0);
  });

  it('combines filters', () => {
    expect(applyFilters(R, f({ period: 'today', staff: 'Ana', amount: 'u1k' }), NOW)).toHaveLength(2);
  });
});

describe('summarize', () => {
  it('totals, fees and per-person counts', () => {
    const s = summarize(applyFilters(R, f({ period: 'today' }), NOW));
    expect(s.count).toBe(3);
    expect(s.total).toBe(4250);
    expect(s.fees).toBe(30);
    expect(s.people).toEqual([
      { name: 'Ana', n: 2, sum: 750 },
      { name: 'Ben', n: 1, sum: 3500 },
    ]);
  });

  it('handles an empty list', () => {
    expect(summarize([])).toEqual({ count: 0, total: 0, fees: 0, people: [], pendingCount: 0, pendingTotal: 0, oldestPending: null });
  });
});

describe('labels', () => {
  it('names the period', () => {
    expect(periodLabel(f({ period: 'today' }))).toBe('Today');
    expect(periodLabel(f({ period: 'week' }))).toBe('Last 7 days');
    expect(periodLabel(f({ period: 'custom', from: '2026-11-01', to: '2026-11-05' }))).toBe('Nov 1 – Nov 5');
    expect(periodLabel(f({ period: 'custom' }))).toBe('Custom range');
  });
  it('lists staff once, sorted', () => {
    expect(staffNames(R)).toEqual(['Ana', 'Ben', 'Tita Mel']);
  });
});

const draft = (over: Partial<Draft>): Draft => ({
  ref: '9047022665601', amount: '3500', fee: '40', feeTouched: false, name: '', number: '', txAt: NOW, refRead: true, ...over,
});

describe('reviewWarnings', () => {
  const on = { warnOld: true, bigLimit: 10000 };
  it('has none for a clean receipt', () => {
    expect(reviewWarnings(draft({}), on, NOW)).toEqual([]);
  });
  it('old receipt', () => {
    const w = reviewWarnings(draft({ txAt: at(8) }), on, NOW);
    expect(w.map((x) => x.key)).toEqual(['old']);
    expect(w[0].text).toBe('This receipt is from Nov 8.');
  });
  it('missing date', () => {
    expect(reviewWarnings(draft({ txAt: null }), on, NOW).map((x) => x.key)).toEqual(['date']);
  });
  it('big amount only above the limit, and never when off', () => {
    expect(reviewWarnings(draft({ amount: '10000' }), on, NOW)).toEqual([]);
    expect(reviewWarnings(draft({ amount: '10000.01' }), on, NOW).map((x) => x.key)).toEqual(['big']);
    expect(reviewWarnings(draft({ amount: '99999' }), { warnOld: true, bigLimit: 0 }, NOW)).toEqual([]);
  });
  it('reference not 13 digits', () => {
    expect(reviewWarnings(draft({ ref: '9047 022 6656' }), on, NOW).map((x) => x.key)).toEqual(['ref']);
    expect(reviewWarnings(draft({ ref: '9047 022 665601' }), on, NOW)).toEqual([]);
  });
  it('old-receipt warning can be turned off', () => {
    expect(reviewWarnings(draft({ txAt: at(1) }), { warnOld: false, bigLimit: 10000 }, NOW)).toEqual([]);
  });
  it('reports several at once', () => {
    const k = reviewWarnings(draft({ txAt: at(8), amount: '20000', ref: '123' }), on, NOW).map((x) => x.key);
    expect(k).toEqual(['old', 'big', 'ref']);
  });
});

import { detectOwn, mergeOwn, withoutOwn } from '../src/lib/identity';
import { highlight, matchRecord } from '../src/lib/records';

describe('search', () => {
  const S = [
    rec('7046654574311', { amount: 150, name: 'NO••E L.', number: '09464007988', by: 'Rodel', savedAt: at(11, 8) }),
    rec('9047022665601', { amount: 3500, name: 'MARIA S.', number: '09171234501', by: 'Ana', savedAt: at(10) }),
    rec('6046809238177', { amount: 3500, name: 'JOSE D.', number: '+63 9●●●●●●4822', by: 'Ben', savedAt: at(2) }),
    rec('0046809244410', { amount: 35, name: 'MARK T.', number: '09181234502', by: 'Ana', savedAt: at(9) }),
  ];
  const q = (text: string, over: Partial<Filters> = {}) => applyFilters(S, f({ q: text, ...over }), NOW).map((r) => r.ref);

  it('ignores the date choice while searching (looks through all dates)', () => {
    expect(q('9047', { period: 'today' })).toEqual(['9047022665601']);
    expect(q('4822', { period: 'yesterday' })).toEqual(['6046809238177']);
  });

  it('comes back to the chosen dates when the search is cleared', () => {
    expect(applyFilters(S, f({ q: '', period: 'today' }), NOW)).toHaveLength(1);
  });

  it('finds a reference by its last 4 or 6 digits, and ranks endings first', () => {
    expect(q('4311')).toEqual(['7046654574311']);
    expect(q('665601')).toEqual(['9047022665601']);
    expect(q('046')).toEqual(['7046654574311', '0046809244410', '6046809238177']); // inside all three, none ends with it: newest first
    expect(q('4410')).toEqual(['0046809244410']);
  });

  it('finds a reference typed with spaces', () => {
    expect(q('9047 0226 65601')).toEqual(['9047022665601']);
  });

  it('finds amounts typed with or without the peso sign and commas', () => {
    for (const t of ['3500', '3,500', '₱3,500', '3500.00', '₱ 3,500.00']) expect(q(t, { period: 'all' }).sort()).toEqual(['6046809238177', '9047022665601']);
    expect(q('35')[0]).toBe('0046809244410'); // exact 35 first, then 3500s
  });

  it('finds names by part, any case', () => {
    expect(q('mar').sort()).toEqual(['0046809244410', '9047022665601']);
    expect(q('MARIA')).toEqual(['9047022665601']);
    expect(q('no••')).toEqual(['7046654574311']);
  });

  it('finds a phone number by part, including masked ones', () => {
    expect(q('1234501')).toEqual(['9047022665601']);
    expect(q('0917 123')).toEqual(['9047022665601']);
    expect(q('●●4822')).toEqual(['6046809238177']);
  });

  it('finds who saved it', () => {
    expect(q('ben')).toEqual(['6046809238177']);
    expect(q('rodel')).toEqual(['7046654574311']);
  });

  it('still applies the amount and staff choices', () => {
    expect(q('mar', { staff: 'Ana' }).sort()).toEqual(['0046809244410', '9047022665601']);
    expect(q('3500', { amount: 'u1k' })).toEqual([]);
  });

  it('says which field matched', () => {
    expect(matchRecord(S[0], '4311')).toBe('ref');
    expect(matchRecord(S[0], '7988')).toBe('number');
    expect(matchRecord(S[0], '150')).toBe('amount');
    expect(matchRecord(S[0], 'no')).toBe('name');
    expect(matchRecord(S[0], 'rod')).toBe('staff');
    expect(matchRecord(S[0], 'zzz')).toBeNull();
  });

  it('marks the matching text', () => {
    expect(highlight('MARIA S.', 'ria')).toEqual([{ t: 'MA', hit: false }, { t: 'RIA', hit: true }, { t: ' S.', hit: false }]);
    expect(highlight('9047022665601', '5601')).toEqual([{ t: '904702266', hit: false }, { t: '5601', hit: true }]);
    expect(highlight('abc', '')).toEqual([{ t: 'abc', hit: false }]);
  });
});

describe('the store\'s own name and number', () => {
  const mk = (i: number, name: string, number: string) => rec(String(1000000000000 + i), { name, number, savedAt: at(11, 23 - (i % 20)) });
  const many = [
    ...Array.from({ length: 10 }, (_, i) => mk(i, 'AUNT A.', '09999999999')),
    ...Array.from({ length: 10 }, (_, i) => mk(20 + i, `CUST ${i}`, `0917000000${i}`)),
  ];

  it('learns a name and number that repeat on many recent records', () => {
    const own = detectOwn(many);
    expect(own.names).toEqual(['AUNT A.']);
    expect(own.numbers).toEqual(['09999999999']);
  });

  it('learns nothing from too few records, or when nothing repeats', () => {
    expect(detectOwn(many.slice(0, 4))).toEqual({ names: [], numbers: [] });
    expect(detectOwn(many.slice(10))).toEqual({ names: [], numbers: [] });
  });

  it('does not flag a regular customer who is a small share of the records', () => {
    const list = [...Array.from({ length: 3 }, (_, i) => mk(i, 'REGULAR R.', '09170000001')), ...Array.from({ length: 17 }, (_, i) => mk(50 + i, `X ${i}`, `0918000000${i}`))];
    expect(detectOwn(list)).toEqual({ names: [], numbers: [] });
  });

  it('blanks them on a new receipt and keeps other values', () => {
    const own = { names: ['AUNT A.'], numbers: ['09999999999'] };
    expect(withoutOwn('aunt  a.', '0999 999 9999', own)).toEqual({ name: '', number: '' });
    expect(withoutOwn('MARIA S.', '09171234501', own)).toEqual({ name: 'MARIA S.', number: '09171234501' });
  });

  it('keeps what it learned after those records age out', () => {
    const known = mergeOwn({ names: [], numbers: [] }, detectOwn(many));
    expect(mergeOwn(known, { names: [], numbers: [] })).toBe(known);
    expect(known.names).toEqual(['AUNT A.']);
  });
});

import { formatRef } from '../src/lib/format';
import { highlightRef } from '../src/lib/records';

describe('grouped reference', () => {
  it('groups 13 digits as 4-4-5 and leaves other values alone', () => {
    expect(formatRef('0046276076549')).toBe('0046 2760 76549');
    expect(formatRef('9047 0226 65601')).toBe('9047 0226 65601');
    expect(formatRef('1234')).toBe('1234');
    expect(formatRef('')).toBe('');
  });

  it('marks the typed digits in the grouped reference', () => {
    expect(highlightRef('0046276076549', '76549')).toEqual([{ t: '0046 2760 ', hit: false }, { t: '76549', hit: true }]);
    expect(highlightRef('0046276076549', '0046')).toEqual([{ t: '0046', hit: true }, { t: ' 2760 76549', hit: false }]);
  });

  it('marks across a space between groups', () => {
    expect(highlightRef('0046276076549', '276076')).toEqual([{ t: '0046 ', hit: false }, { t: '2760 76', hit: true }, { t: '549', hit: false }]);
  });

  it('shows the plain reference when nothing matches', () => {
    expect(highlightRef('0046276076549', '999')).toEqual([{ t: '0046 2760 76549', hit: false }]);
  });
});


import { isPending, whenOf, LATE_MS } from '../src/lib/records';
import { waitText } from '../src/lib/format';

describe('pending and paid', () => {
  const P = [
    rec('2000000000001', { amount: 1015, fee: 20, status: 'pending', savedAt: at(11, 9), by: 'Rodel' }),
    rec('2000000000002', { amount: 285, fee: 10, status: 'pending', savedAt: at(11, 14), by: 'Ana' }),
    rec('2000000000003', { amount: 500, fee: 10, status: 'paid', savedAt: at(11, 8), by: 'Ana' }),
    rec('2000000000004', { amount: 300, fee: 10, savedAt: at(11, 10), by: 'Ben' }), // old record: no status = paid
    // saved yesterday as pending, paid today
    rec('2000000000005', { amount: 1000, fee: 15, status: 'paid', savedAt: at(10, 16), paidAt: at(11, 12), paidBy: 'Ben', paidByUid: 'u-ben', by: 'Ana' }),
  ];

  it('knows what is pending; records without a status are paid', () => {
    expect(P.map(isPending)).toEqual([true, true, false, false, false]);
  });

  it('a record paid later counts on the day the cash went out', () => {
    expect(whenOf(P[4])).toBe(at(11, 12));
    expect(whenOf(P[0])).toBe(at(11, 9));
    const today = applyFilters(P, f({ period: 'today' }), NOW).map((r) => r.ref);
    expect(today).toContain('2000000000005'); // saved yesterday, paid today
    const yesterday = applyFilters(P, f({ period: 'yesterday' }), NOW).map((r) => r.ref);
    expect(yesterday).not.toContain('2000000000005');
  });

  it('totals and fees count only paid records, and pending ones are listed apart', () => {
    const s = summarize(applyFilters(P, f({ period: 'today' }), NOW));
    expect(s.count).toBe(3);
    expect(s.total).toBe(500 + 300 + 1000);
    expect(s.fees).toBe(10 + 10 + 15);
    expect(s.pendingCount).toBe(2);
    expect(s.pendingTotal).toBe(1015 + 285);
    expect(s.oldestPending).toBe(at(11, 9));
    expect(s.people.map((p) => p.name).sort()).toEqual(['Ana', 'Ben']);
  });

  it('the Pending view shows every pending record, whatever the date', () => {
    const old = rec('2000000000006', { status: 'pending', savedAt: at(1, 9), amount: 50 });
    expect(applyFilters([...P, old], f({ period: 'today', status: 'pending' }), NOW)).toHaveLength(3);
  });

  it('the Paid view hides pending records', () => {
    const paid = applyFilters(P, f({ period: 'all', status: 'paid' }), NOW);
    expect(paid.map((r) => r.ref).sort()).toEqual(['2000000000003', '2000000000004', '2000000000005']);
  });

  it('search finds pending records too, and respects the status choice', () => {
    expect(applyFilters(P, f({ q: '0001' }), NOW).map((r) => r.ref)).toEqual(['2000000000001']);
    expect(applyFilters(P, f({ q: '2000000', status: 'pending' }), NOW)).toHaveLength(2);
  });

  it('reminder after 2 hours and readable waiting time', () => {
    expect(LATE_MS).toBe(7_200_000);
    expect(waitText(25 * 60_000)).toBe('25 min');
    expect(waitText(3 * 3_600_000 + 10 * 60_000)).toBe('3 h');
    expect(waitText(50 * 3_600_000)).toBe('2 d');
    expect(waitText(-5)).toBe('0 min');
  });
});
