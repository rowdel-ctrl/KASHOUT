import { dateTime, formatRef, peso2 } from './format';
import type { CashRecord, FieldChange } from './types';

export interface EditFields {
  ref: string;
  amount: number;
  fee: number;
  txAt: number | null;
  name: string;
  number: string;
  source: string;
}

const LABELS: Record<string, string> = {
  ref: 'Reference number',
  amount: 'Amount',
  fee: 'Charge',
  txAt: 'Date and time',
  name: 'Name',
  number: 'Number',
  source: 'From',
};

export const fieldsOf = (r: CashRecord): EditFields => ({
  ref: r.ref, amount: r.amount, fee: r.fee, txAt: r.txAt, name: r.name, number: r.number, source: r.source || 'GCash',
});

/** What changed between the saved record and the new values. Empty if nothing changed. */
export function diffFields(before: EditFields, after: EditFields): FieldChange[] {
  const out: FieldChange[] = [];
  for (const f of Object.keys(LABELS) as (keyof EditFields)[]) {
    if (before[f] !== after[f]) out.push({ f, from: before[f] ?? null, to: after[f] ?? null });
  }
  return out;
}

export const fieldLabel = (f: string) => LABELS[f] ?? f;

/** A value as it is shown in the history. */
export function showValue(f: string, v: string | number | null): string {
  if (v === null || v === '') return 'empty';
  if (f === 'amount' || f === 'fee') return peso2(Number(v));
  if (f === 'txAt') return dateTime(Number(v));
  if (f === 'ref') return formatRef(String(v));
  return String(v);
}
