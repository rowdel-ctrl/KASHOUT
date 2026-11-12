import { dayKey, parseMoney, peso, shortDate } from './format';
import type { Draft, Settings } from './types';

export interface ReviewWarning {
  key: 'old' | 'big' | 'ref' | 'date';
  text: string;
}

/** Warnings shown above Save. They never block saving. */
export function reviewWarnings(d: Draft, s: Pick<Settings, 'warnOld' | 'bigLimit'>, now: number = Date.now()): ReviewWarning[] {
  const w: ReviewWarning[] = [];
  const amount = parseMoney(d.amount);
  const refDigits = d.ref.replace(/\s+/g, '');

  if (s.warnOld) {
    if (d.txAt == null) w.push({ key: 'date', text: 'We could not read the date.' });
    else if (dayKey(d.txAt) !== dayKey(now) && now - d.txAt >= 0) w.push({ key: 'old', text: `This receipt is from ${shortDate(d.txAt)}.` });
  }
  if (s.bigLimit > 0 && amount > s.bigLimit) w.push({ key: 'big', text: `${peso(amount)} is a big amount.` });
  if (!/^\d{13}$/.test(refDigits)) w.push({ key: 'ref', text: 'The reference number is not 13 digits.' });
  return w;
}
