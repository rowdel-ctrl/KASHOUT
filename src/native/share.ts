import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import type { PickedPhoto } from './photo';
import { isNative } from './platform';

/** Something another app shared with Kashawt: a receipt picture, or plain text. */
export interface SharedItem {
  photo?: PickedPhoto;
  text?: string;
}

interface SharedReceiptPlugin {
  /** Returns what was shared and forgets it. Empty if nothing is waiting. */
  getShared(): Promise<{ path?: string; text?: string }>;
  addListener(event: 'shared', cb: () => void): Promise<PluginListenerHandle>;
}

const Shared = registerPlugin<SharedReceiptPlugin>('SharedReceipt');

/** Calls `cb` when a receipt is shared to the app, including one that opened the app. */
export function listenShared(cb: (item: SharedItem) => void): () => void {
  if (!isNative) {
    // Browser tests only: lets a test pretend something was shared.
    (globalThis as { __emitShared?: (i: SharedItem) => void }).__emitShared = cb;
    return () => {
      delete (globalThis as { __emitShared?: unknown }).__emitShared;
    };
  }
  let alive = true;
  let handle: PluginListenerHandle | undefined;
  const check = async () => {
    const r = await Shared.getShared();
    if (!alive) return;
    if (r.path) cb({ photo: { uri: r.path, webPath: Capacitor.convertFileSrc(r.path) } });
    else if (r.text) cb({ text: r.text });
  };
  void check().catch(() => {});
  void Shared.addListener('shared', () => void check().catch(() => {})).then((h) => {
    if (alive) handle = h;
    else void h.remove();
  });
  return () => {
    alive = false;
    void handle?.remove();
  };
}
