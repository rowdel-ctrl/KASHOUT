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

import { isNewer, parseRelease } from '../src/native/update';
import { toHex } from '../src/native/bars';

describe('new version check', () => {
  const release = { tag_name: 'v1.0.22', html_url: 'https://github.com/x/y/releases/tag/v1.0.22', assets: [{ name: 'cashout-log.apk', browser_download_url: 'https://github.com/x/y/releases/download/v1.0.22/cashout-log.apk' }] };
  it('reads the version, build and APK link', () => {
    expect(parseRelease(release)).toEqual({ version: '1.0.22', build: 22, url: 'https://github.com/x/y/releases/download/v1.0.22/cashout-log.apk' });
  });
  it('falls back to the release page when there is no APK', () => {
    expect(parseRelease({ ...release, assets: [] })?.url).toBe(release.html_url);
  });
  it('ignores answers that are not a Kashawt build', () => {
    expect(parseRelease(null)).toBeNull();
    expect(parseRelease({ tag_name: 'nightly' })).toBeNull();
    expect(parseRelease({ tag_name: 'v1.0.9-private', html_url: 'https://x' })).toBeNull();
    expect(parseRelease({ tag_name: 'v1.0.9', html_url: 'http://not-secure' })).toBeNull();
  });
  it('only a bigger build is newer', () => {
    expect(isNewer(22, 21)).toBe(true);
    expect(isNewer(21, 21)).toBe(false);
    expect(isNewer(20, 21)).toBe(false);
  });
  it('turns a colour into hex for the system bars', () => {
    expect(toHex('rgb(251, 247, 241)')).toBe('#FBF7F1');
    expect(toHex('rgba(20, 17, 13, 1)')).toBe('#14110D');
    expect(toHex('nonsense')).toBe('#FBF7F1');
  });
});
