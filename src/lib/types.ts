export interface CashRecord {
  id: string;
  ref: string;
  amount: number;
  fee: number;
  name: string;
  number: string;
  /** Date/time printed on the receipt (ms), or null if it could not be read. */
  txAt: number | null;
  /** When the staff tapped Save (ms). */
  savedAt: number;
  by: string;
  byUid: string;
  /** Small JPEG data URL of the receipt photo (optional). */
  thumb?: string;
}

export type NewRecord = Omit<CashRecord, 'id'>;

export interface AppUser {
  uid: string;
  email: string;
  /** First name, shown in "Hi, Ana" and saved as "by". */
  name: string;
}

export interface FeeTier {
  /** Highest amount (inclusive) this tier covers. */
  upTo: number;
  fee: number;
}

export type TextSize = 'normal' | 'large' | 'xl';
export type Theme = 'system' | 'light' | 'dark';

export interface Settings {
  textSize: TextSize;
  theme: Theme;
  warnOld: boolean;
  /** Amount that triggers the "big amount" warning. 0 turns the warning off. */
  bigLimit: number;
  savePhoto: boolean;
  /** The 3-card tour has been seen (or skipped). */
  tourDone: boolean;
  /** Daily reminder at 8 PM to open Closing. */
  closingReminder: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  textSize: 'large',
  theme: 'system',
  warnOld: true,
  bigLimit: 10000,
  savePhoto: true,
  tourDone: false,
  closingReminder: false,
};

export interface Draft {
  ref: string;
  amount: string;
  fee: string;
  feeTouched: boolean;
  name: string;
  number: string;
  txAt: number | null;
  thumb?: string;
  /** Full-size picture for "View photo" (this phone only, not saved). */
  photoUrl?: string;
  /** The text the app read from the photo (for "What the app read"). */
  rawText?: string;
  /** False when the app could not find a valid 13-digit reference. */
  refRead: boolean;
}

export type Period = 'today' | 'yesterday' | 'week' | 'all' | 'custom';
export type AmountBand = 'any' | 'u1k' | 'b1k5k' | 'o5k';

export interface Filters {
  period: Period;
  /** YYYY-MM-DD, used when period is "custom". */
  from: string;
  to: string;
  amount: AmountBand;
  /** Staff first name, or "all". */
  staff: string;
  /** Search text (reference, name, number or amount). */
  q: string;
}

export const DEFAULT_FILTERS: Filters = { period: 'today', from: '', to: '', amount: 'any', staff: 'all', q: '' };

export type Route =
  | { name: 'home' }
  | { name: 'scan' }
  | { name: 'review'; draft: Draft }
  | { name: 'records'; period?: Period }
  | { name: 'detail'; id: string }
  | { name: 'settings' }
  | { name: 'fees' };
