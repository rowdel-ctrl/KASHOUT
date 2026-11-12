import { App as CapApp } from '@capacitor/app';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { api } from '../data';
import { DEFAULT_FEES } from '../lib/fees';
import { parseMoney, peso } from '../lib/format';
import { diffFields, fieldsOf, type EditFields } from '../lib/edit';
import {
  type AppUser, type CashRecord, type Draft, type FeeTier, type NewRecord, type Route, type Settings,
} from '../lib/types';
import { sendNtfy } from '../native/alerts';
import {
  cancelDraftReminder, clearDraftCopy, isMeaningful, loadDraft, saveDraftCopy, scheduleDraftReminder, type StoredDraft,
} from '../native/draftStore';
import { translate, type T } from '../lib/i18n';
import { buzzSaved } from '../native/haptics';
import { detectOwn, mergeOwn } from '../lib/identity';
import { isNative } from '../native/platform';
import { listenShared, type SharedItem } from '../native/share';
import { fetchLatest, installedVersion, openDownload, type UpdateInfo } from '../native/update';
import { draftFromPhoto, draftFromText } from './draft';
import type { SyncState } from '../data/api';

export interface Toast { id: number; text: string; err?: boolean; action?: { label: string; run: () => void } }
export interface UndoState { id: string; draft: Draft; status: 'paid' | 'pending' }
/** What the Saved screen shows. */
export interface LastSaved { id: string; amount: number; name: string; status: 'paid' | 'pending' }

interface Ctx {
  user: AppUser;
  records: CashRecord[];
  syncLabel: { text: string; wait: boolean };
  alertTopic: string;
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => void;
  fees: FeeTier[];
  route: Route;
  go: (r: Route) => void;
  replace: (r: Route) => void;
  back: () => void;
  tab: (r: Route) => void;
  toast: (text: string, err?: boolean, action?: Toast['action']) => void;
  undo: UndoState | null;
  lastSaved: LastSaved | null;
  editRecord: (r: CashRecord, next: EditFields) => boolean;
  /** Words on screen, in the chosen language. */
  t: T;
  /** A scan that was read but not saved yet. Kept on this phone for 24 hours. */
  unsaved: StoredDraft | null;
  keepDraft: (d: Draft) => void;
  dropDraft: () => void;
  resumeDraft: () => void;
  /** A screen can ask to be told before Back leaves it. Return true when it handled Back. */
  setLeaveGuard: (fn: (() => boolean) | null) => void;
  /** A newer app version is published. Null when this phone is up to date. */
  update: UpdateInfo | null;
  /** This phone's version, like "1.0.21". Empty in the browser. */
  appVersion: string;
  checkUpdate: (manual?: boolean) => Promise<'new' | 'latest' | 'error'>;
  downloadUpdate: () => void;
  laterUpdate: () => void;
  saveDraft: (d: Draft, allowDuplicate: boolean, status?: 'paid' | 'pending') => void;
  markPaid: (r: CashRecord) => void;
  undoSave: () => void;
  signOut: () => void;
}

const AppCtx = createContext<Ctx | null>(null);

export function useApp(): Ctx {
  const c = useContext(AppCtx);
  if (!c) throw new Error('useApp outside provider');
  return c;
}

interface Props {
  user: AppUser;
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => void;
  children: (state: { route: Route; toasts: Toast[]; denied: boolean }) => ReactNode;
}

export function AppProvider({ user, settings, updateSettings, children }: Props) {
  const [records, setRecords] = useState<CashRecord[]>([]);
  const [sync, setSync] = useState<SyncState>({ pending: false, fromCache: true });
  const [online, setOnline] = useState(navigator.onLine);
  const [denied, setDenied] = useState(false);
  const [fees, setFees] = useState<FeeTier[]>(DEFAULT_FEES);
  const [alertTopic, setAlertTopic] = useState('');
  const topicRef = useRef('');
  topicRef.current = alertTopic;
  const [stack, setStack] = useState<Route[]>([{ name: 'home' }]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [undo, setUndo] = useState<UndoState | null>(null);
  const toastId = useRef(0);
  const [lastSaved, setLastSaved] = useState<LastSaved | null>(null);
  const [update, setUpdate] = useState<UpdateInfo | null>(null);
  const [appVersion, setAppVersion] = useState('');
  const lastUpdateCheck = useRef(0);
  const [unsaved, setUnsaved] = useState<StoredDraft | null>(null);
  const leaveGuard = useRef<(() => boolean) | null>(null);
  const undoTimer = useRef<number | undefined>(undefined);
  const paidTimers = useRef(new Map<string, number>());
  const recordsRef = useRef(records);
  recordsRef.current = records;
  const feesRef = useRef(fees);
  feesRef.current = fees;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const lang = settings.lang;
  const t = useCallback<T>((text, vars) => translate(lang, text, vars), [lang]);
  const tr = useCallback<T>((text, vars) => translate(settingsRef.current.lang, text, vars), []);

  const toast = useCallback((text: string, err?: boolean, action?: Toast['action']) => {
    const id = ++toastId.current;
    setToasts((t) => [...t, { id, text, err, action }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), action ? 6500 : 4500);
  }, []);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  useEffect(() => {
    const offRecords = api.subscribeRecords(
      (u) => {
        setDenied(false);
        setRecords(u.records);
        setSync(u.sync);
        if (u.fresh.length === 1) toast(tr(u.fresh[0].status === 'pending' ? '{name} saved {amount} (pending)' : '{name} saved {amount}', { name: u.fresh[0].by, amount: peso(u.fresh[0].amount) }));
        else if (u.fresh.length > 1) toast(tr('{n} new cash-outs saved by others', { n: u.fresh.length }));
        if (u.paidNow.length === 1) toast(tr('{name} marked {amount} as paid', { name: u.paidNow[0].paidBy ?? '', amount: peso(u.paidNow[0].amount) }));
        else if (u.paidNow.length > 1) toast(tr('{n} records marked as paid by others', { n: u.paidNow.length }));
      },
      (code) => {
        if (code === 'permission-denied') setDenied(true);
        else toast(tr('Could not load records. Check your internet.'), true);
      },
    );
    const offFees = api.subscribeFees((t) => setFees(t ?? DEFAULT_FEES));
    const offErr = api.onWriteError((m) => toast(m, true));
    api.purgeOld().catch(() => {});
    void api.getAlertTopic().then(setAlertTopic);
    return () => {
      offRecords();
      offFees();
      offErr();
    };
  }, [toast, tr]);

  // Learn the store's own name and number from the records, and remember them.
  const updateRef = useRef(updateSettings);
  updateRef.current = updateSettings;
  useEffect(() => {
    if (records.length < 5) return;
    const known = { names: settingsRef.current.ownNames, numbers: settingsRef.current.ownNumbers };
    const next = mergeOwn(known, detectOwn(records));
    if (next !== known) updateRef.current({ ownNames: next.names, ownNumbers: next.numbers });
  }, [records]);

  const route = stack[stack.length - 1];
  const go = useCallback((r: Route) => setStack((s) => [...s, r]), []);
  const replace = useCallback((r: Route) => setStack((s) => [...s.slice(0, -1), r]), []);
  const back = useCallback(() => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s)), []);
  const tab = useCallback((r: Route) => setStack([r]), []);

  useEffect(() => {
    if (!isNative) return;
    const h = CapApp.addListener('backButton', () => {
      if (leaveGuard.current?.()) return;
      if (stack.length > 1) back();
      else void CapApp.exitApp();
    });
    return () => {
      void h.then((x) => x.remove());
    };
  }, [stack.length, back]);

  const saveDraft = useCallback(
    (d: Draft, allowDuplicate: boolean, status: 'paid' | 'pending' = 'paid') => {
      const s = settingsRef.current;
      const amount = parseMoney(d.amount);
      const rec: NewRecord = {
        ref: d.ref.replace(/\s+/g, ''),
        amount,
        fee: parseMoney(d.fee),
        name: d.name.trim(),
        number: d.number.trim(),
        txAt: d.txAt,
        savedAt: Date.now(),
        by: user.name,
        byUid: user.uid,
        status,
      };
      // An id can be taken by a record whose reference was corrected later. Then use a fresh id.
      const idTaken = recordsRef.current.some((r) => r.id === rec.ref);
      const { id } = api.saveRecord(rec, { allowDuplicate: allowDuplicate || idTaken });
      if (s.savePhoto && d.photo) api.savePhoto(id, d.photo);
      setUndo({ id, draft: d, status });
      window.clearTimeout(undoTimer.current);
      undoTimer.current = window.setTimeout(() => setUndo(null), 5000);
      void buzzSaved();
      void sendNtfy(topicRef.current, `${user.name}: ${peso(amount)} ${status === 'pending' ? 'pending' : 'cashed out'}`);
      setLastSaved({ id, amount, name: rec.name, status });
      setUnsaved(null);
      void clearDraftCopy();
      void cancelDraftReminder();
      setStack([{ name: 'home' }, { name: 'saved' }]);
    },
    [user],
  );

  const markPaid = useCallback(
    (r: CashRecord) => {
      api.markPaid(r.id, { uid: user.uid, name: user.name });
      void buzzSaved();
      // Tell the other phones after the undo time is over.
      window.clearTimeout(paidTimers.current.get(r.id));
      paidTimers.current.set(
        r.id,
        window.setTimeout(() => {
          paidTimers.current.delete(r.id);
          void sendNtfy(topicRef.current, `${r.by}: ${peso(r.amount)} cashed out\nPaid by ${user.name}.`);
        }, 6500),
      );
      toast(tr('Marked as paid'), false, {
        label: tr('Undo'),
        run: () => {
          window.clearTimeout(paidTimers.current.get(r.id));
          paidTimers.current.delete(r.id);
          api.undoPaid(r.id);
        },
      });
    },
    [user, toast, tr],
  );

  const editRecord = useCallback(
    (r: CashRecord, next: EditFields): boolean => {
      const changes = diffFields(fieldsOf(r), next);
      if (changes.length === 0) {
        toast(tr('Nothing was changed'));
        return false;
      }
      api.editRecord(r.id, next, [...(r.history ?? []), { at: Date.now(), by: user.name, byUid: user.uid, changes }]);
      toast(tr('Changes saved'));
      return true;
    },
    [user, toast, tr],
  );

  // A receipt shared from GCash (or any app) opens Check and save.
  useEffect(() => {
    return listenShared(async (item: SharedItem) => {
      try {
        const ctx = { fees: feesRef.current, settings: settingsRef.current };
        const draft = item.photo ? await draftFromPhoto(item.photo, ctx) : await draftFromText(item.text ?? '', ctx);
        setStack([{ name: 'home' }, { name: 'review', draft }]);
      } catch {
        toast(tr('Could not open the shared receipt.'), true);
      }
    });
  }, [toast, tr]);

  // A scan that was read but not saved is kept on this phone, so it is not lost.
  useEffect(() => {
    void loadDraft().then((d) => d && setUnsaved(d));
  }, []);

  const keepDraft = useCallback(
    (d: Draft) => {
      if (!isMeaningful(d)) return;
      const at = Date.now();
      setUnsaved({ draft: d, at });
      void saveDraftCopy(d, at);
      void scheduleDraftReminder(tr('Kashawt'), tr('You have a scan that is not saved yet. Tap to continue.'));
    },
    [tr],
  );
  const dropDraft = useCallback(() => {
    setUnsaved(null);
    void clearDraftCopy();
    void cancelDraftReminder();
  }, []);
  const unsavedRef = useRef(unsaved);
  unsavedRef.current = unsaved;
  const resumeDraft = useCallback(() => {
    const u = unsavedRef.current;
    if (u) setStack((s) => [...s, { name: 'review', draft: u.draft }]);
  }, []);
  const checkUpdate = useCallback(async (manual = false): Promise<'new' | 'latest' | 'error'> => {
    // Browser tests only: pretend a newer version exists.
    const fake = !isNative ? (globalThis as { __fakeUpdate?: UpdateInfo }).__fakeUpdate : undefined;
    if (fake) {
      setUpdate(fake);
      return 'new';
    }
    const mine = await installedVersion();
    if (!mine) return 'latest';
    setAppVersion(mine.version);
    lastUpdateCheck.current = Date.now();
    try {
      const latest = await fetchLatest();
      if (!latest || latest.build <= mine.build) {
        setUpdate(null);
        return 'latest';
      }
      if (manual || latest.build > settingsRef.current.skipBuild) setUpdate(latest);
      return 'new';
    } catch {
      return 'error';
    }
  }, []);
  const updateNow = useRef<UpdateInfo | null>(null);
  updateNow.current = update;
  const laterUpdate = useCallback(() => {
    const u = updateNow.current;
    if (u) updateRef.current({ skipBuild: u.build });
    setUpdate(null);
  }, []);
  const downloadUpdate = useCallback(() => {
    if (updateNow.current) void openDownload(updateNow.current.url);
  }, []);

  // Look for a newer version a few seconds after opening, and again when the app comes back after 6 hours.
  useEffect(() => {
    void installedVersion().then((v) => v && setAppVersion(v.version));
    const first = window.setTimeout(() => void checkUpdate(false), 4000);
    let handle: { remove: () => Promise<void> } | undefined;
    if (isNative) {
      void CapApp.addListener('appStateChange', ({ isActive }) => {
        if (isActive && Date.now() - lastUpdateCheck.current > 6 * 3_600_000) void checkUpdate(false);
      }).then((h) => (handle = h));
    }
    return () => {
      window.clearTimeout(first);
      void handle?.remove();
    };
  }, [checkUpdate]);

  const setLeaveGuard = useCallback((fn: (() => boolean) | null) => {
    leaveGuard.current = fn;
  }, []);

  const undoSave = useCallback(() => {
    if (!undo) return;
    api.deleteRecord(undo.id);
    window.clearTimeout(undoTimer.current);
    const d = undo.draft;
    setUndo(null);
    setStack([{ name: 'home' }, { name: 'review', draft: d }]);
  }, [undo]);

  const signOut = useCallback(() => {
    void api.signOut();
  }, []);

  const syncLabel = !online
    ? { text: t('Offline'), wait: true }
    : sync.pending
      ? { text: t('Waiting to sync'), wait: true }
      : { text: api.mode === 'demo' ? t('Demo') : t('Synced'), wait: false };

  return (
    <AppCtx.Provider
      value={{ user, records, syncLabel, alertTopic, settings, updateSettings, fees, route, go, replace, back, tab, toast, undo, lastSaved, editRecord, t, unsaved, keepDraft, dropDraft, resumeDraft, setLeaveGuard, update, appVersion, checkUpdate, downloadUpdate, laterUpdate, saveDraft, markPaid, undoSave, signOut }}
    >
      {children({ route, toasts, denied })}
    </AppCtx.Provider>
  );
}
