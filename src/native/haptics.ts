import { Haptics, NotificationType } from '@capacitor/haptics';
import { isNative } from './platform';

/** A short buzz when a cash-out is saved. Does nothing in the browser or if the phone has no vibration. */
export async function buzzSaved(): Promise<void> {
  if (!isNative) return;
  try {
    await Haptics.notification({ type: NotificationType.Success });
  } catch {
    /* ignore */
  }
}
