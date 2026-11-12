import type { EditFields } from '../lib/edit';
import type { AppUser, CashRecord, EditEntry, FeeTier, NewRecord } from '../lib/types';

export interface SyncState {
  /** Writes made on this phone that have not reached the server yet. */
  pending: boolean;
  /** Data came from this phone's saved copy, not the server. */
  fromCache: boolean;
}

export interface RecordsUpdate {
  records: CashRecord[];
  sync: SyncState;
  /** Records other people just saved (for the in-app toast). */
  fresh: CashRecord[];
  /** Records other people just marked as paid. */
  paidNow: CashRecord[];
}

export interface DataApi {
  mode: 'firebase' | 'demo';
  onAuth(cb: (user: AppUser | null) => void): () => void;
  signIn(): Promise<void>;
  signOut(): Promise<void>;

  /** `onError` gets code "permission-denied" when the account is not on the allowlist. */
  subscribeRecords(cb: (u: RecordsUpdate) => void, onError: (code: string) => void): () => void;
  /** Does not wait for the network. Problems arrive through onWriteError. */
  saveRecord(rec: NewRecord, opts: { allowDuplicate: boolean }): { id: string };
  deleteRecord(id: string): void;
  /** Marks a pending record as paid (cash given). Anyone on the list can do it. Not awaited. */
  markPaid(id: string, by: { uid: string; name: string }): void;
  /** Puts a record back to pending. Only works right after it was marked paid, by the same person. Not awaited. */
  undoPaid(id: string): void;
  /** Changes a record. `history` is the whole list, with the new entry last. Only the person who saved it can do this. Not awaited. */
  editRecord(id: string, fields: EditFields, history: EditEntry[]): void;
  /** Saves the sharper photo for a record, kept apart from the list so the list stays fast. Not awaited. */
  savePhoto(id: string, dataUrl: string): void;
  /** Loads a record's photo when it is opened. Null if there is none. */
  getPhoto(id: string): Promise<string | null>;
  onWriteError(cb: (message: string, ref: string) => void): () => void;
  /** Deletes records older than one year. */
  purgeOld(): Promise<void>;

  /** The shared alert topic for this store. Created once, then the same on every phone. Empty if not ready. */
  getAlertTopic(): Promise<string>;

  subscribeFees(cb: (table: FeeTier[] | null) => void): () => void;
  saveFees(table: FeeTier[]): Promise<void>;
}
