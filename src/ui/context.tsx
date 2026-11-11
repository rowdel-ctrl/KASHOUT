import { App as CapApp } from '@capacitor/app';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { api } from '../data';
import { DEFAULT_FEES } from '../lib/fees';
import { parseMoney, peso } from '../lib/format';
import {
  type AppUser, type CashRecord, type Draft, type FeeTier, type NewRecord, type Route, type Settings,
} from '../lib/types';
import { sendNtfy } from '../native/alerts';
import { isNative } from '../native/platform';
import type { SyncState } from '../data/api';

export interface Toast { id: number; text: string; err?: boolean }
export interface UndoState { id: string; draft: Draft }

interface Ctx {
  user: AppUser;
  records: CashRecord[];
  syncLabel: { text: string; wait: boolean };
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => void;
  fees: FeeTier[];
  route: Route;
  go: (r: Route) => void;
  replace: (r: Route) => void;
  back: () => void;
  tab: (r: Route) => void;
  toast: (text: string, err?: boolean) => void;
  undo: UndoState | null;
  saveDraft: (d: Draft, allowDuplicate: boolean) => void;
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
  const [stack, setStack] = useState<Route[]>([{ name: 'home' }]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [undo, setUndo] = useState<UndoState | null>(null);
  const toastId = useRef(0);
  const undoTimer = useRef<number | undefined>(undefined);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const toast = useCallback((text: string, err?: boolean) => {
    const id = ++toastId.current;
    setToasts((t) => [...t, { id, text, err }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
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
        if (u.fresh.length === 1) toast(`${u.fresh[0].by} saved ${peso(u.fresh[0].amount)}`);
        else if (u.fresh.length > 1) toast(`${u.fresh.length} new cash-outs saved by others`);
      },
      (code) => {
        if (code === 'permission-denied') setDenied(true);
        else toast('Could not load records. Check your internet.', true);
      },
    );
    const offFees = api.subscribeFees((t) => setFees(t ?? DEFAULT_FEES));
    const offErr = api.onWriteError((m) => toast(m, true));
    api.purgeOld().catch(() => {});
    return () => {
      offRecords();
      offFees();
      offErr();
    };
  }, [toast]);

  const route = stack[stack.length - 1];
  const go = useCallback((r: Route) => setStack((s) => [...s, r]), []);
  const replace = useCallback((r: Route) => setStack((s) => [...s.slice(0, -1), r]), []);
  const back = useCallback(() => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s)), []);
  const tab = useCallback((r: Route) => setStack([r]), []);

  useEffect(() => {
    if (!isNative) return;
    const h = CapApp.addListener('backButton', () => {
      if (stack.length > 1) back();
      else void CapApp.exitApp();
    });
    return () => {
      void h.then((x) => x.remove());
    };
  }, [stack.length, back]);

  const saveDraft = useCallback(
    (d: Draft, allowDuplicate: boolean) => {
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
        ...(s.savePhoto && d.thumb ? { thumb: d.thumb } : {}),
      };
      const { id } = api.saveRecord(rec, { allowDuplicate });
      setUndo({ id, draft: d });
      window.clearTimeout(undoTimer.current);
      undoTimer.current = window.setTimeout(() => setUndo(null), 5000);
      void sendNtfy(s.ntfyTopic, `${user.name}: ${peso(amount)} cashed out`);
      setStack([{ name: 'home' }]);
    },
    [user],
  );

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
    ? { text: 'Offline', wait: true }
    : sync.pending
      ? { text: 'Waiting to sync', wait: true }
      : { text: api.mode === 'demo' ? 'Demo' : 'Synced', wait: false };

  return (
    <AppCtx.Provider
      value={{ user, records, syncLabel, settings, updateSettings, fees, route, go, replace, back, tab, toast, undo, saveDraft, undoSave, signOut }}
    >
      {children({ route, toasts, denied })}
    </AppCtx.Provider>
  );
}
