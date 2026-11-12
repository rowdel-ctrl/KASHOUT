import { describe, expect, it } from 'vitest';
import { toCsv } from '../src/lib/export';
import type { CashRecord } from '../src/lib/types';

const r: CashRecord = {
  id: 'a', ref: '0046809244410', amount: 1000, fee: 15, name: 'LU**Y, T.', number: '09171234503',
  txAt: new Date(2026, 10, 2, 16, 39).getTime(), savedAt: new Date(2026, 10, 2, 16, 41).getTime(), by: 'Ana', byUid: 'u1',
};

describe('toCsv', () => {
  it('keeps the leading zero and all 13 digits for Excel', () => {
    const csv = toCsv([r]);
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv).toContain('="0046809244410"');
  });

  it('quotes cells that contain commas', () => {
    expect(toCsv([r])).toContain('"LU**Y, T."');
  });

  it('has one header line and one row per record', () => {
    expect(toCsv([r, r]).trim().split('\r\n')).toHaveLength(3);
  });

  it('has Status, Paid by and Paid at columns', () => {
    const pending = toCsv([{ ...r, status: 'pending' as const }]);
    expect(pending.split('\r\n')[0]).toContain('Status,Paid by,Paid at');
    expect(pending.split('\r\n')[1]).toContain(',Pending,,');
    const paid = toCsv([{ ...r, status: 'paid' as const, paidBy: 'Ben', paidAt: new Date(2026, 10, 2, 17, 0).getTime() }]);
    expect(paid.split('\r\n')[1]).toContain(',Paid,Ben,');
    expect(toCsv([r]).split('\r\n')[1]).toContain(',Paid,,');
  });
});
