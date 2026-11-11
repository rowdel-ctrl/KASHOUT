import type { AppUser, CashRecord, FeeTier, NewRecord } from '../lib/types';

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
  onWriteError(cb: (message: string, ref: string) => void): () => void;
  /** Deletes records older than one year. */
  purgeOld(): Promise<void>;

  /** The shared alert topic for this store. Created once, then the same on every phone. Empty if not ready. */
  getAlertTopic(): Promise<string>;

  subscribeFees(cb: (table: FeeTier[] | null) => void): () => void;
  saveFees(table: FeeTier[]): Promise<void>;
}
