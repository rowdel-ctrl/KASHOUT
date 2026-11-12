import type { CashRecord } from './types';

/** Wallets and banks money can come from. The colour is only a small dot next to the name. */
export const WALLETS: { name: string; color: string }[] = [
  { name: 'GCash', color: '#0B6BFF' },
  { name: 'Maya', color: '#7B3FE4' },
  { name: 'MariBank', color: '#E0457B' },
  { name: 'GoTyme', color: '#0E8F8A' },
  { name: 'SeaBank', color: '#E8671B' },
  { name: 'Ibang bank', color: '#8A8273' },
];

export const DEFAULT_SOURCE = 'GCash';

const OTHER_COLOR = '#8A8273';

export const walletColor = (name: string | undefined): string => WALLETS.find((w) => w.name === (name || DEFAULT_SOURCE))?.color ?? OTHER_COLOR;

/** Where the money came from. Records saved before this existed came through GCash. */
export const sourceOf = (r: Pick<CashRecord, 'source'>): string => r.source || DEFAULT_SOURCE;

/** The choices in the picker: the usual ones, plus the detected one when it is a bank not in the list. */
export function walletChoices(current: string): string[] {
  const base = WALLETS.map((w) => w.name);
  return !current || base.includes(current) ? base : [...base.slice(0, -1), current, base[base.length - 1]];
}
