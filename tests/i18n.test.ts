import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { translate } from '../src/lib/i18n';
import { TL } from '../src/lib/tl';

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(f) ? [p] : [];
  });
}

/** Every text passed to t('...') or tr('...') in the app. */
function usedTexts(): Set<string> {
  const out = new Set<string>();
  const re = /\bt(?:r)?\(\s*(['"])((?:\\.|(?!\1)[^\\])*)\1/g;
  for (const f of files('src')) {
    if (f.endsWith('tl.ts') || f.endsWith('i18n.ts')) continue;
    const src = readFileSync(f, 'utf8');
    for (const m of src.matchAll(re)) out.add(m[2].replace(/\\'/g, "'").replace(/\\"/g, '"'));
  }
  return out;
}

/** Texts that are kept in lists and translated when shown. */
const LISTED = [
  'Normal', 'Large', 'Extra large', 'System', 'follows your phone', 'Light', 'Dark', 'Off', '₱3,000', '₱5,000', '₱10,000', '₱20,000', '₱50,000',
  'Today', 'Yesterday', 'Last 7 days', 'All time', 'Custom range', 'Pending', 'Search results',
  'Any amount', 'Under ₱1,000', '₱1,000 to ₱5,000', 'Over ₱5,000',
  'Take a photo of the receipt', 'Fit the whole receipt inside the frame. The app reads the details for you.',
  'Check the details', 'Look at the reference number and amount. Tap any box to fix it. Yellow notes mean please check.',
  'Save, and undo if needed', 'Tap Save when the cash is given. You have 5 seconds to undo. Other staff see it right away.',
  'Reference number', 'Amount', 'Fee', 'Date and time', 'Name', 'Number',
  'We could not read the date.', 'This receipt is from {date}.', '{amount} is a big amount.', 'The reference number is not 13 digits.',
];

describe('Taglish', () => {
  it('has a translation for every text on screen', () => {
    const missing = [...usedTexts(), ...LISTED].filter((k) => !(k in TL));
    expect(missing).toEqual([]);
  });

  it('keeps the same {holes} as the English text', () => {
    const holes = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
    const bad = Object.entries(TL).filter(([k, v]) => holes(k) !== holes(v)).map(([k]) => k);
    expect(bad).toEqual([]);
  });

  it('English stays English, and holes are filled', () => {
    expect(translate('en', 'Hi, {name}', { name: 'Ana' })).toBe('Hi, Ana');
    expect(translate('tl', 'Hi, {name}', { name: 'Ana' })).toBe('Hi, Ana');
    expect(translate('en', 'Save · Paid')).toBe('Save · Paid');
  });

  it('uses the words the owner chose for paid and pending', () => {
    expect(translate('tl', 'Save · Paid')).toBe('Nakuha na');
    expect(translate('tl', 'Save · Pending')).toBe('Hindi pa nakuha');
    expect(translate('tl', 'Mark as paid')).toBe('Nakuha na');
  });

  it('a text with no entry stays in English', () => {
    expect(translate('tl', 'Some new text')).toBe('Some new text');
  });

  it('no button text starts with a check mark or other symbol', () => {
    for (const [k, v] of Object.entries(TL)) if (/^[✓✔]/.test(k) || /^[✓✔]/.test(v)) throw new Error(`symbol at start: ${k}`);
  });
});
