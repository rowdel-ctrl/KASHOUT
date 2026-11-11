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

export interface Settings {
  textSize: TextSize;
  warnOld: boolean;
  warnBig: boolean;
  bigLimit: number;
  savePhoto: boolean;
  /** Daily reminder at 8 PM to open Closing. */
  closingReminder: boolean;
  /** Secret ntfy.sh topic. Stored on this phone only. */
  ntfyTopic: string;
}

export const DEFAULT_SETTINGS: Settings = {
  textSize: 'large',
  warnOld: true,
  warnBig: true,
  bigLimit: 3000,
  savePhoto: true,
  closingReminder: false,
  ntfyTopic: '',
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
  /** False when the app could not find a valid 13-digit reference. */
  refRead: boolean;
}

export type Route =
  | { name: 'home' }
  | { name: 'scan' }
  | { name: 'review'; draft: Draft }
  | { name: 'records'; filter?: 'today' | 'yesterday' | 'all' }
  | { name: 'detail'; id: string }
  | { name: 'more' }
  | { name: 'closing' }
  | { name: 'settings' }
  | { name: 'fees' };
