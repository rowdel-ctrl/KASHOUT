import type { CashRecord } from './types';

/** Normal form used to compare names and numbers. */
export const normName = (s: string) => s.replace(/\s+/g, ' ').trim().toUpperCase();
export const normNumber = (s: string) => s.replace(/\s+/g, '').toUpperCase();

export interface OwnIdentity {
  names: string[];
  numbers: string[];
}

const SAMPLE = 40;
const MIN_SAMPLE = 5;
const MIN_COUNT = 3;
const MIN_SHARE = 0.25;

/**
 * Photos of a customer's phone show who the money was sent to, which is the store.
 * When the same name or number keeps showing up on recent records it is the store's own.
 */
export function detectOwn(records: CashRecord[]): OwnIdentity {
  const recent = records.slice(0, SAMPLE);
  if (recent.length < MIN_SAMPLE) return { names: [], numbers: [] };
  const count = (pick: (r: CashRecord) => string) => {
    const m = new Map<string, number>();
    for (const r of recent) {
      const v = pick(r);
      if (v) m.set(v, (m.get(v) ?? 0) + 1);
    }
    return [...m.entries()].filter(([, n]) => n >= MIN_COUNT && n / recent.length >= MIN_SHARE).map(([v]) => v);
  };
  return { names: count((r) => normName(r.name)), numbers: count((r) => normNumber(r.number)) };
}

/** Adds newly found values to what is already known. Returns the same object if nothing is new. */
export function mergeOwn(known: OwnIdentity, found: OwnIdentity): OwnIdentity {
  const names = [...new Set([...known.names, ...found.names])];
  const numbers = [...new Set([...known.numbers, ...found.numbers])];
  return names.length === known.names.length && numbers.length === known.numbers.length ? known : { names, numbers };
}

/** Blanks the name and number when they belong to the store. */
export function withoutOwn(name: string, number: string, own: OwnIdentity): { name: string; number: string } {
  return {
    name: name && own.names.includes(normName(name)) ? '' : name,
    number: number && own.numbers.includes(normNumber(number)) ? '' : number,
  };
}

/**
 * The name used the last time this number was saved. Newest record first.
 * Needs a real number (at least 4 digits) so a short or empty number never matches.
 */
export function nameForNumber(records: CashRecord[], number: string): string {
  const n = normNumber(number);
  if (n.replace(/\D/g, '').length < 4) return '';
  for (const r of records) {
    if (r.name && normNumber(r.number) === n) return r.name;
  }
  return '';
}
