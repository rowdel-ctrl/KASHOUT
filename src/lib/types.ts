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
  /** Where the money came from: GCash, Maya, MariBank and so on. Older records have none and are GCash. */
  source?: string;
  /** Small JPEG data URL of the receipt photo (older records only). */
  thumb?: string;
  /** "pending" = recorded, cash not given yet. Records without a status are paid. */
  status?: 'paid' | 'pending';
  /** Who gave the cash, and when, for a record that was saved as pending. */
  paidBy?: string;
  paidByUid?: string;
  paidAt?: number;
  /** Every change made after saving, oldest first. Only the person who saved it can edit. */
  history?: EditEntry[];
  editedAt?: number;
}

export interface FieldChange {
  /** ref, amount, fee, txAt, name or number. */
  f: string;
  from: string | number | null;
  to: string | number | null;
}

export interface EditEntry {
  at: number;
  by: string;
  byUid: string;
  changes: FieldChange[];
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

export type Lang = 'tl' | 'en';
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
  /** The store's own name and number, learned from the records. They are left out of new records. */
  ownNames: string[];
  ownNumbers: string[];
  /** Daily reminder at 8 PM to open Closing. */
  closingReminder: boolean;
  /** The camera takes the photo by itself when the receipt is steady. */
  autoCapture: boolean;
  /** App language. tl = Taglish. */
  lang: Lang;
  /** The newest build the person chose to skip with "Later". */
  skipBuild: number;
}

export const DEFAULT_SETTINGS: Settings = {
  textSize: 'large',
  theme: 'system',
  warnOld: true,
  bigLimit: 10000,
  savePhoto: true,
  tourDone: false,
  ownNames: [],
  ownNumbers: [],
  closingReminder: false,
  autoCapture: true,
  lang: 'tl',
  skipBuild: 0,
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
  /** Sharper copy of the photo (about 600 pixels wide) saved with the record. */
  photo?: string;
  /** False when the app could not find a valid 13-digit reference. */
  refRead: boolean;
  /** The name was filled in from an earlier record with the same number. */
  autoName?: boolean;
  /** Where the money came from. Drafts kept by older versions have none. */
  source?: string;
  /** The shared text had no date, so the time of sharing was used. */
  dateGuess?: boolean;
}

export type Period = 'today' | 'yesterday' | 'week' | 'all' | 'custom';
export type AmountBand = 'any' | 'u1k' | 'b1k5k' | 'o5k';
export type StatusFilter = 'all' | 'pending' | 'paid';

export interface Filters {
  period: Period;
  /** YYYY-MM-DD, used when period is "custom". */
  from: string;
  to: string;
  amount: AmountBand;
  /** Staff first name, or "all". */
  staff: string;
  /** Paid, pending, or both. */
  status: StatusFilter;
  /** Search text (reference, name, number or amount). */
  q: string;
}

export const DEFAULT_FILTERS: Filters = { period: 'today', from: '', to: '', amount: 'any', staff: 'all', status: 'all', q: '' };

export type Route =
  | { name: 'home' }
  | { name: 'scan' }
  | { name: 'review'; draft: Draft }
  | { name: 'records'; period?: Period; status?: StatusFilter }
  | { name: 'detail'; id: string }
  | { name: 'saved' }
  | { name: 'edit'; id: string }
  | { name: 'history'; id: string }
  | { name: 'settings' }
  | { name: 'fees' };
