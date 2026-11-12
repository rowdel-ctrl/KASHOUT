import { describe, expect, it } from 'vitest';
import { missingFields, fillMissing } from '../src/ui/retry';
import { emptyDraft } from '../src/ui/draft';
import { DEFAULT_SETTINGS } from '../src/lib/types';
import { DEFAULT_FEES } from '../src/lib/fees';
import { WALLETS, sourceOf, walletChoices, walletColor } from '../src/lib/wallets';
import { applyFilters, periodLabel } from '../src/lib/records';
import { DEFAULT_FILTERS, type CashRecord } from '../src/lib/types';

const ctx = { fees: DEFAULT_FEES, settings: DEFAULT_SETTINGS };

describe('what is missing from a read receipt', () => {
  it('an empty draft is missing the reference, amount and date', () => {
    expect(missingFields({ ...emptyDraft(), txAt: null })).toEqual(['reference', 'amount', 'date']);
  });
  it('a complete draft is missing nothing', () => {
    expect(missingFields({ ...emptyDraft(), ref: '6047167885112', amount: '500.00', txAt: Date.now() })).toEqual([]);
  });
});

describe('reading again fills only what is missing', () => {
  it('fills the reference and date, and keeps what was already there', () => {
    const d = { ...emptyDraft(), amount: '500.00', fee: '10.00', txAt: null, name: 'Typed Name' };
    const next = fillMissing(d, 'Ref No. 6047 123 456789\nNov 12, 2026 2:40 PM', ctx);
    expect(next.ref).toBe('6047123456789');
    expect(next.refRead).toBe(true);
    expect(next.txAt).not.toBeNull();
    expect(next.amount).toBe('500.00');
    expect(next.name).toBe('Typed Name');
  });
  it('does not overwrite a reference that is already there', () => {
    const d = { ...emptyDraft(), ref: '1111222233334', amount: '500.00', txAt: Date.now() };
    expect(fillMissing(d, 'Ref No. 6047 123 456789', ctx).ref).toBe('1111222233334');
  });
  it('fills the amount and its charge when the amount was missing', () => {
    const next = fillMissing({ ...emptyDraft(), ref: '1111222233334', txAt: Date.now() }, 'Amount 3,000.00', ctx);
    expect(next.amount).toBe('3000.00');
    expect(next.fee).not.toBe('');
  });
  it('nothing found means nothing changes', () => {
    const d = { ...emptyDraft(), txAt: null };
    const next = fillMissing(d, 'nothing useful here', ctx);
    expect(missingFields(next)).toEqual(['reference', 'amount', 'date']);
  });
});

describe('wallets', () => {
  it('older records came through GCash', () => {
    expect(sourceOf({})).toBe('GCash');
    expect(sourceOf({ source: 'Maya' })).toBe('Maya');
  });
  it('every wallet has a colour, and an unknown one is grey', () => {
    for (const w of WALLETS) expect(walletColor(w.name)).toMatch(/^#/);
    expect(walletColor('BDO')).toBe(walletColor('Ibang bank'));
  });
  it('a detected bank that is not in the list is added before "other"', () => {
    const c = walletChoices('BDO');
    expect(c).toContain('BDO');
    expect(c[c.length - 1]).toBe('Ibang bank');
    expect(walletChoices('Maya')).toEqual(WALLETS.map((w) => w.name));
  });
  it('records can be filtered by wallet', () => {
    const mk = (id: string, source?: string): CashRecord => ({ id, ref: id, amount: 100, fee: 5, name: '', number: '', txAt: null, savedAt: Date.now(), by: 'Ana', byUid: 'a', source });
    const list = [mk('a'), mk('b', 'Maya'), mk('c', 'MariBank')];
    const f = { ...DEFAULT_FILTERS, period: 'all' as const };
    expect(applyFilters(list, f).length).toBe(3);
    expect(applyFilters(list, { ...f, wallet: 'Maya' }).map((r) => r.id)).toEqual(['b']);
    expect(applyFilters(list, { ...f, wallet: 'GCash' }).map((r) => r.id)).toEqual(['a']);
  });
});

describe('the last 30 days', () => {
  it('is a period with a name', () => {
    expect(periodLabel({ ...DEFAULT_FILTERS, period: 'month' })).toBe('Last 30 days');
  });
});
