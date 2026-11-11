import type { AppUser, CashRecord, FeeTier, NewRecord } from '../lib/types';
import type { DataApi, RecordsUpdate } from './api';

/** Demo mode: everything lives in memory. All data below is made up. */
export function createMemoryApi(): DataApi {
  const user: AppUser = { uid: 'demo-ana', email: 'ana@example.com', name: 'Ana' };
  let signedIn = false;
  let records: CashRecord[] = seed();
  let fees: FeeTier[] | null = null;
  const authCbs = new Set<(u: AppUser | null) => void>();
  const recCbs = new Set<(u: RecordsUpdate) => void>();
  const feeCbs = new Set<(t: FeeTier[] | null) => void>();
  const errCbs = new Set<(m: string, ref: string) => void>();

  const emit = (fresh: CashRecord[] = []) => {
    const sorted = [...records].sort((a, b) => b.savedAt - a.savedAt);
    recCbs.forEach((cb) => cb({ records: sorted, sync: { pending: false, fromCache: false }, fresh }));
  };

  return {
    mode: 'demo',
    onAuth(cb) {
      authCbs.add(cb);
      cb(signedIn ? user : null);
      return () => authCbs.delete(cb);
    },
    async signIn() {
      signedIn = true;
      authCbs.forEach((cb) => cb(user));
    },
    async signOut() {
      signedIn = false;
      authCbs.forEach((cb) => cb(null));
    },
    subscribeRecords(cb) {
      recCbs.add(cb);
      queueMicrotask(() => emit());
      return () => recCbs.delete(cb);
    },
    saveRecord(rec: NewRecord, opts) {
      const id = opts.allowDuplicate ? `${rec.ref}-${Math.random().toString(36).slice(2, 8)}` : rec.ref || crypto.randomUUID();
      if (!opts.allowDuplicate && records.some((r) => r.id === id)) {
        errCbs.forEach((cb) => cb('This reference was already saved.', rec.ref));
        return { id };
      }
      records = [...records, { ...rec, id }];
      emit();
      return { id };
    },
    deleteRecord(id) {
      records = records.filter((r) => r.id !== id);
      emit();
    },
    onWriteError(cb) {
      errCbs.add(cb);
      return () => errCbs.delete(cb);
    },
    async purgeOld() {},
    async getAlertTopic() {
      return 'kashawt-demo-0000000000000000';
    },
    subscribeFees(cb) {
      feeCbs.add(cb);
      cb(fees);
      return () => feeCbs.delete(cb);
    },
    async saveFees(t) {
      fees = t;
      feeCbs.forEach((cb) => cb(t));
    },
  };
}

function seed(): CashRecord[] {
  const at = (h: number, m: number, dayOffset = 0) => {
    const d = new Date();
    d.setDate(d.getDate() + dayOffset);
    d.setHours(h, m, 0, 0);
    return d.getTime();
  };
  const mk = (ref: string, amount: number, fee: number, name: string, number: string, h: number, m: number, by: string, day = 0): CashRecord => ({
    id: ref, ref, amount, fee, name, number, txAt: at(h, m - 1, day), savedAt: at(h, m, day), by, byUid: 'demo-' + by.toLowerCase(),
  });
  return [
    mk('6046809238177', 500, 10, 'EX*****S L.', '09171234501', 15, 42, 'Ana'),
    mk('9046837792836', 300, 10, 'JO**N D.', '09181234502', 14, 55, 'Ana'),
    mk('0046809244410', 1000, 15, 'LU**Y T.', '09171234503', 14, 31, 'Tita Mel'),
    mk('6046809238188', 250, 10, 'AN***O P.', '09171234504', 13, 40, 'Ben'),
    mk('6046809238199', 2000, 25, 'RO**L S.', '09171234505', 11, 12, 'Ben'),
    mk('6046809238200', 800, 15, 'MI**A C.', '09171234506', 10, 5, 'Ana'),
    mk('6046809238211', 1500, 20, 'JU**N B.', '09171234507', 17, 20, 'Ana', -1),
    mk('6046809238222', 600, 10, 'CA**S D.', '09171234508', 12, 3, 'Tita Mel', -1),
  ];
}
