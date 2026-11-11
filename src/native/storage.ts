import { Preferences } from '@capacitor/preferences';
import { DEFAULT_SETTINGS, type Settings } from '../lib/types';

const KEY = 'settings.v1';

export async function loadSettings(): Promise<Settings> {
  try {
    const { value } = await Preferences.get({ key: KEY });
    if (value) return { ...DEFAULT_SETTINGS, ...(JSON.parse(value) as Partial<Settings>) };
  } catch {
    /* fall through to defaults */
  }
  return { ...DEFAULT_SETTINGS };
}

export async function saveSettings(s: Settings): Promise<void> {
  try {
    await Preferences.set({ key: KEY, value: JSON.stringify(s) });
  } catch {
    /* ignore */
  }
}
