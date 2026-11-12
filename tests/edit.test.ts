import { describe, expect, it } from 'vitest';
import { diffFields, fieldLabel, fieldsOf, showValue } from '../src/lib/edit';
import { nameForNumber } from '../src/lib/identity';
import type { CashRecord } from '../src/lib/types';

const mk = (over: Partial<CashRecord> = {}): CashRecord => ({
  id: 'a', ref: '9047022665601', amount: 500, fee: 10, name: 'ANA R.', number: '0917 *** 1234', txAt: 1_700_000_000_000,
  savedAt: 1_700_000_100_000, by: 'Ben', byUid: 'ben', ...over,
});

describe('diffFields', () => {
  it('lists only what changed, in a fixed order', () => {
    const r = mk();
    const next = { ...fieldsOf(r), amount: 5000, name: 'ANA R. S.' };
    expect(diffFields(fieldsOf(r), next)).toEqual([
      { f: 'amount', from: 500, to: 5000 },
      { f: 'name', from: 'ANA R.', to: 'ANA R. S.' },
    ]);
  });
  it('nothing changed gives an empty list', () => {
    const r = mk();
    expect(diffFields(fieldsOf(r), fieldsOf(r))).toEqual([]);
  });
  it('a missing date is kept as null, never undefined (the database refuses undefined)', () => {
    const r = mk({ txAt: null });
    const [c] = diffFields(fieldsOf(r), { ...fieldsOf(r), txAt: 5 });
    expect(c).toEqual({ f: 'txAt', from: null, to: 5 });
  });
});

describe('showing a change', () => {
  it('has simple labels and readable values', () => {
    expect(fieldLabel('ref')).toBe('Reference number');
    expect(showValue('amount', 5000)).toBe('₱5,000.00');
    expect(showValue('ref', '9047022665601')).toBe('9047 0226 65601');
    expect(showValue('name', '')).toBe('empty');
    expect(showValue('txAt', null)).toBe('empty');
  });
});

describe('nameForNumber', () => {
  const records = [mk({ id: 'n', name: '', number: '0917 *** 1234' }), mk({ id: 'm', name: 'ANA R.', number: '0917 *** 1234' }), mk({ id: 'o', name: 'OLD', number: '0917 *** 1234', savedAt: 1 })];
  it('uses the newest record that has a name for the same number', () => {
    expect(nameForNumber(records, '0917***1234')).toBe('ANA R.');
  });
  it('gives nothing for an unknown, empty or too short number', () => {
    expect(nameForNumber(records, '0999 *** 0000')).toBe('');
    expect(nameForNumber(records, '')).toBe('');
    expect(nameForNumber(records, '12')).toBe('');
  });
});
