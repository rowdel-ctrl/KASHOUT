import type { AppUser, CashRecord, FeeTier, NewRecord } from '../lib/types';
import type { DataApi, RecordsUpdate } from './api';

/** Demo mode: everything lives in memory. All data below is made up. */
export function createMemoryApi(): DataApi {
  const user: AppUser = { uid: 'demo-ana', email: 'ana@example.com', name: 'Ana' };
  let signedIn = false;
  let records: CashRecord[] = seed();
  let fees: FeeTier[] | null = null;
  const photos = new Map<string, string>();
  const authCbs = new Set<(u: AppUser | null) => void>();
  const recCbs = new Set<(u: RecordsUpdate) => void>();
  const feeCbs = new Set<(t: FeeTier[] | null) => void>();
  const errCbs = new Set<(m: string, ref: string) => void>();

  const emit = (fresh: CashRecord[] = [], paidNow: CashRecord[] = []) => {
    const sorted = [...records].sort((a, b) => b.savedAt - a.savedAt);
    recCbs.forEach((cb) => cb({ records: sorted, sync: { pending: false, fromCache: false }, fresh, paidNow }));
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
    markPaid(id, by) {
      records = records.map((r) => (r.id === id && r.status === 'pending' ? { ...r, status: 'paid' as const, paidBy: by.name, paidByUid: by.uid, paidAt: Date.now() } : r));
      emit();
    },
    savePhoto(id, dataUrl) {
      photos.set(id, dataUrl);
    },
    async getPhoto(id) {
      return photos.get(id) ?? null;
    },
    deleteRecord(id) {
      photos.delete(id);
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
  const now = Date.now();
  const startOfToday = new Date(now).setHours(0, 0, 0, 0);
  // Sample records from earlier today (always in the past), and two from yesterday.
  const ago = (mins: number) => Math.max(startOfToday + 60_000, now - mins * 60_000);
  const yesterday = (h: number, m: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() - 1);
    d.setHours(h, m, 0, 0);
    return d.getTime();
  };
  const mk = (ref: string, amount: number, fee: number, name: string, number: string, savedAt: number, by: string): CashRecord => ({
    id: ref, ref, amount, fee, name, number, txAt: savedAt - 60_000, savedAt, by, byUid: 'demo-' + by.toLowerCase(),
  });
  return [
    mk('6046809238177', 500, 10, 'EX*****S L.', '09171234501', ago(20), 'Ana'),
    mk('9046837792836', 300, 10, 'JO**N D.', '09181234502', ago(80), 'Ana'),
    mk('0046809244410', 1000, 15, 'LU**Y T.', '09171234503', ago(140), 'Tita Mel'),
    mk('6046809238188', 250, 10, 'AN***O P.', '09171234504', ago(200), 'Ben'),
    mk('6046809238199', 2000, 25, 'RO**L S.', '09171234505', ago(260), 'Ben'),
    mk('6046809238200', 800, 15, 'MI**A C.', '09171234506', ago(320), 'Ana'),
    mk('6046809238211', 1500, 20, 'JU**N B.', '09171234507', yesterday(17, 20), 'Ana'),
    mk('6046809238222', 600, 10, 'CA**S D.', '09171234508', yesterday(12, 3), 'Tita Mel'),
    // Recorded, cash not given yet. One has been waiting more than 2 hours.
    { ...mk('7000000000001', 285, 10, 'PE***O R.', '09171234509', now - 25 * 60_000, 'Ana'), status: 'pending' as const },
    { ...mk('7000000000002', 1015, 20, '', '', now - 190 * 60_000, 'Ben'), status: 'pending' as const },
  ];
}
