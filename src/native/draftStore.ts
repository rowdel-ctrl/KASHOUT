import { LocalNotifications } from '@capacitor/local-notifications';
import { Preferences } from '@capacitor/preferences';
import type { Batch, Draft } from '../lib/types';
import { isNative } from './platform';

const KEY = 'draft.v1';
const REMINDER_ID = 7001;
/** A kept scan is forgotten after this long. */
export const DRAFT_MAX_AGE_MS = 24 * 3_600_000;
/** Phone reminder if a scan sits unsaved this long. */
export const DRAFT_REMIND_MS = 10 * 60_000;

export interface StoredDraft {
  draft: Draft;
  /** When it was last changed. */
  at: number;
}

/** What is worth keeping: a reference or an amount was filled in. */
export const isMeaningful = (d: Draft) => d.ref.replace(/\s+/g, '').length > 0 || parseFloat(d.amount.replace(/,/g, '')) > 0;

/** The big picture links only work in the running app, so they are not kept. */
const slim = (d: Draft): Draft => {
  const { photoUrl: _gone, ...rest } = d;
  return rest;
};

export async function loadDraft(now: number = Date.now()): Promise<StoredDraft | null> {
  try {
    const { value } = await Preferences.get({ key: KEY });
    if (!value) return null;
    const s = JSON.parse(value) as StoredDraft;
    if (!s?.draft || typeof s.at !== 'number') return null;
    if (now - s.at > DRAFT_MAX_AGE_MS) {
      await Preferences.remove({ key: KEY });
      return null;
    }
    return s;
  } catch {
    return null;
  }
}

export async function saveDraftCopy(d: Draft, at: number): Promise<void> {
  try {
    await Preferences.set({ key: KEY, value: JSON.stringify({ draft: slim(d), at } satisfies StoredDraft) });
  } catch {
    /* too big or blocked: the draft only stays in memory */
  }
}

export async function clearDraftCopy(): Promise<void> {
  try {
    await Preferences.remove({ key: KEY });
  } catch {
    /* ignore */
  }
}

/** Phone reminder a few minutes from now. Replaces the one before. */
export async function scheduleDraftReminder(title: string, body: string): Promise<void> {
  if (!isNative) return;
  try {
    await LocalNotifications.cancel({ notifications: [{ id: REMINDER_ID }] });
    let perm = await LocalNotifications.checkPermissions();
    if (perm.display !== 'granted') perm = await LocalNotifications.requestPermissions();
    if (perm.display !== 'granted') return;
    await LocalNotifications.schedule({
      notifications: [{ id: REMINDER_ID, title, body, schedule: { at: new Date(Date.now() + DRAFT_REMIND_MS) } }],
    });
  } catch {
    /* no reminder */
  }
}

export async function cancelDraftReminder(): Promise<void> {
  if (!isNative) return;
  try {
    await LocalNotifications.cancel({ notifications: [{ id: REMINDER_ID }] });
  } catch {
    /* ignore */
  }
}

const BATCH_KEY = 'batch.v1';

export interface StoredBatch {
  batch: Batch;
  at: number;
}

const slimBatch = (b: Batch): Batch => ({
  ...b,
  ready: b.ready.map(slim),
  skipped: b.skipped.map((x) => ({ ...x, draft: slim(x.draft) })),
});

/** A batch that was set aside halfway. Kept like a single draft, for 24 hours. */
export async function loadBatch(now: number = Date.now()): Promise<StoredBatch | null> {
  try {
    const { value } = await Preferences.get({ key: BATCH_KEY });
    if (!value) return null;
    const s = JSON.parse(value) as StoredBatch;
    if (!s?.batch || typeof s.at !== 'number') return null;
    if (now - s.at > DRAFT_MAX_AGE_MS) {
      await Preferences.remove({ key: BATCH_KEY });
      return null;
    }
    return s;
  } catch {
    return null;
  }
}

export async function saveBatchCopy(b: Batch, at: number): Promise<void> {
  try {
    await Preferences.set({ key: BATCH_KEY, value: JSON.stringify({ batch: slimBatch(b), at } satisfies StoredBatch) });
  } catch {
    /* too big or blocked */
  }
}

export async function clearBatchCopy(): Promise<void> {
  try {
    await Preferences.remove({ key: BATCH_KEY });
  } catch {
    /* ignore */
  }
}
