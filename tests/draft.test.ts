import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../src/lib/types';
import { DEFAULT_FEES } from '../src/lib/fees';
import { draftFromText } from '../src/ui/draft';

const ctx = { fees: DEFAULT_FEES, settings: DEFAULT_SETTINGS };
const NOW = new Date(2026, 10, 12, 17, 16).getTime();
const SHARED = 'You have received PHP 162.00 from JH*N DR*Y S. +639154721724 w/ MSG: . Your new balance is PHP 417.63. Ref. No. 0046554610929.';

describe('a receipt shared as text', () => {
  it('uses today when the text has no date, and says so', async () => {
    const d = await draftFromText(SHARED, ctx, NOW);
    expect(d.txAt).toBe(NOW);
    expect(d.dateGuess).toBe(true);
    expect(d.amount).toBe('162.00');
    expect(d.ref).toBe('0046554610929');
  });
  it('keeps a date that is in the text', async () => {
    const d = await draftFromText('Nov 08, 2026 1:23 PM\n' + SHARED, ctx, NOW);
    expect(d.txAt).toBe(new Date(2026, 10, 8, 13, 23).getTime());
    expect(d.dateGuess).toBeUndefined();
  });
});
