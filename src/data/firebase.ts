import { Capacitor } from '@capacitor/core';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { initializeApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  getAuth,
  onAuthStateChanged,
  signInWithCredential,
  signInWithPopup,
  signOut as fbSignOut,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  initializeFirestore,
  limit,
  onSnapshot,
  orderBy,
  persistentLocalCache,
  query,
  setDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import type { AppUser, CashRecord, FeeTier, NewRecord } from '../lib/types';
import type { DataApi } from './api';

export interface FirebaseSettings {
  apiKey: string;
  appId: string;
  projectId: string;
  authDomain: string;
}

/** Newest records kept on the phone. Keeps reads inside the free daily quota. */
const LOAD_LIMIT = 3000;
const YEAR_MS = 365 * 86_400_000;
const FRESH_MS = 10 * 60_000;

export function createFirebaseApi(cfg: FirebaseSettings): DataApi {
  const app = initializeApp(cfg);
  const auth = getAuth(app);
  // Offline copy: saves work without internet and sync when it comes back.
  const db = initializeFirestore(app, { localCache: persistentLocalCache() });
  const errCbs = new Set<(m: string, ref: string) => void>();

  const toUser = (u: { uid: string; email: string | null; displayName: string | null }): AppUser => ({
    uid: u.uid,
    email: u.email ?? '',
    name: (u.displayName ?? u.email ?? 'Staff').split(' ')[0],
  });

  return {
    mode: 'firebase',

    onAuth(cb) {
      return onAuthStateChanged(auth, (u) => cb(u ? toUser(u) : null));
    },

    async signIn() {
      if (Capacitor.isNativePlatform()) {
        const res = await FirebaseAuthentication.signInWithGoogle({ skipNativeAuth: true });
        const idToken = res.credential?.idToken;
        if (!idToken) throw new Error('Google sign-in did not return a token.');
        await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
      } else {
        await signInWithPopup(auth, new GoogleAuthProvider());
      }
    },

    async signOut() {
      if (Capacitor.isNativePlatform()) await FirebaseAuthentication.signOut().catch(() => {});
      await fbSignOut(auth);
    },

    subscribeRecords(cb, onError) {
      const q = query(collection(db, 'records'), orderBy('savedAt', 'desc'), limit(LOAD_LIMIT));
      let first = true;
      return onSnapshot(
        q,
        { includeMetadataChanges: true },
        (snap) => {
          const records = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<CashRecord, 'id'>) }));
          const fresh: CashRecord[] = [];
          if (!first && !snap.metadata.fromCache) {
            for (const ch of snap.docChanges()) {
              if (ch.type !== 'added' || ch.doc.metadata.hasPendingWrites) continue;
              const r = { id: ch.doc.id, ...(ch.doc.data() as Omit<CashRecord, 'id'>) };
              if (r.byUid !== auth.currentUser?.uid && Date.now() - r.savedAt < FRESH_MS) fresh.push(r);
            }
          }
          first = false;
          cb({ records, sync: { pending: snap.metadata.hasPendingWrites, fromCache: snap.metadata.fromCache }, fresh });
        },
        (err) => onError((err as { code?: string }).code ?? 'unknown'),
      );
    },

    saveRecord(rec: NewRecord, opts) {
      const rand = Math.random().toString(36).slice(2, 8);
      // First save of a reference uses the reference as the id, so two phones
      // saving the same one offline cannot both win.
      const id = opts.allowDuplicate || !rec.ref ? `${rec.ref || 'x'}-${rand}` : rec.ref;
      const data: Record<string, unknown> = { ...rec };
      if (data.thumb === undefined) delete data.thumb;
      // Not awaited: offline, the promise only settles when the server answers.
      setDoc(doc(db, 'records', id), data).catch((e: { code?: string }) => {
        const msg =
          e.code === 'permission-denied'
            ? 'Not saved. This reference may already be saved by someone else.'
            : 'Could not save. Please try again.';
        errCbs.forEach((cb) => cb(msg, rec.ref));
      });
      return { id };
    },

    deleteRecord(id) {
      deleteDoc(doc(db, 'records', id)).catch(() => {});
    },

    onWriteError(cb) {
      errCbs.add(cb);
      return () => errCbs.delete(cb);
    },

    async purgeOld() {
      const cutoff = Date.now() - YEAR_MS;
      const snap = await getDocs(query(collection(db, 'records'), where('savedAt', '<', cutoff), orderBy('savedAt'), limit(100)));
      if (snap.empty) return;
      const batch = writeBatch(db);
      snap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    },

    async getAlertTopic() {
      const ref = doc(db, 'shared', 'alerts');
      const read = async () => {
        try {
          const t = (await getDoc(ref)).data()?.topic;
          return typeof t === 'string' && t.length >= 16 ? t : '';
        } catch {
          return '';
        }
      };
      const existing = await read();
      if (existing) return existing;
      // First phone to open the app creates the topic. Everyone else reads it.
      const bytes = crypto.getRandomValues(new Uint8Array(12));
      const topic = 'kashawt-' + [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
      const created = await Promise.race([
        setDoc(ref, { topic }).then(() => true).catch(() => false),
        new Promise<boolean>((res) => setTimeout(() => res(false), 8000)),
      ]);
      return created ? topic : await read();
    },

    subscribeFees(cb) {
      return onSnapshot(
        doc(db, 'shared', 'settings'),
        (snap) => {
          const raw = snap.data()?.feeTable as FeeTier[] | undefined;
          const ok = Array.isArray(raw) && raw.length > 0 && raw.every((t) => typeof t.upTo === 'number' && typeof t.fee === 'number');
          cb(ok ? raw! : null);
        },
        () => cb(null),
      );
    },

    async saveFees(table) {
      await setDoc(doc(db, 'shared', 'settings'), { feeTable: table });
    },
  };
}
