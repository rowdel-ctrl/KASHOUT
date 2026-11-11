import { AppLauncher } from '@capacitor/app-launcher';
import { LocalNotifications } from '@capacitor/local-notifications';
import { isNative } from './platform';

/** Posts a short generic message to ntfy.sh. Never includes a reference number or customer data. */
export async function sendNtfy(topic: string, message: string): Promise<boolean> {
  const t = topic.trim();
  if (!t) return false;
  try {
    const res = await fetch(`https://ntfy.sh/${encodeURIComponent(t)}`, {
      method: 'POST',
      body: message,
      headers: { Title: 'Kashawt' },
    });
    return res.ok;
  } catch {
    return false;
  }
}

const REMINDER_ID = 8001;

/** Daily reminder at 8 PM to open Closing. */
export async function setClosingReminder(on: boolean): Promise<boolean> {
  if (!isNative) return on;
  try {
    await LocalNotifications.cancel({ notifications: [{ id: REMINDER_ID }] });
    if (!on) return true;
    const perm = await LocalNotifications.requestPermissions();
    if (perm.display !== 'granted') return false;
    await LocalNotifications.schedule({
      notifications: [
        {
          id: REMINDER_ID,
          title: 'Time to close',
          body: 'Open Kashawt and check today’s totals.',
          schedule: { on: { hour: 20, minute: 0 } },
        },
      ],
    });
    return true;
  } catch {
    return false;
  }
}

/** Opens the ntfy app already subscribed to this store's topic. Falls back to the Play Store, or the ntfy website. */
export async function openAlertsApp(topic: string): Promise<void> {
  if (!isNative) {
    window.open(`https://ntfy.sh/${encodeURIComponent(topic)}`, '_blank');
    return;
  }
  try {
    const r = await AppLauncher.openUrl({ url: `ntfy://ntfy.sh/${encodeURIComponent(topic)}` });
    if (r.completed) return;
  } catch {
    /* ntfy is not installed */
  }
  try {
    await AppLauncher.openUrl({ url: 'market://details?id=io.heckel.ntfy' });
  } catch {
    window.open('https://play.google.com/store/apps/details?id=io.heckel.ntfy', '_blank');
  }
}
