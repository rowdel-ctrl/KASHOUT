import { registerPlugin } from '@capacitor/core';
import { isNative } from './platform';

interface AppBarsPlugin {
  apply(options: { dark: boolean; color: string }): Promise<void>;
}
const AppBars = registerPlugin<AppBarsPlugin>('AppBars');

/** "rgb(251, 247, 241)" to "#FBF7F1". */
export function toHex(rgb: string): string {
  const m = /(\d+)[,\s]+(\d+)[,\s]+(\d+)/.exec(rgb);
  if (!m) return '#FBF7F1';
  return '#' + [m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, '0')).join('').toUpperCase();
}

/**
 * Colours the status bar and navigation bar like the screen, with icons that can be read.
 * `dark` is true when the screen behind them is dark.
 */
export async function syncBars(dark: boolean, color?: string): Promise<void> {
  if (!isNative) return;
  try {
    await AppBars.apply({ dark, color: color ?? toHex(getComputedStyle(document.body).backgroundColor) });
  } catch {
    /* an older build without this plugin */
  }
}

/** True when the app is showing its dark colours right now. */
export function isDarkNow(): boolean {
  const t = document.documentElement.dataset.theme;
  if (t === 'dark') return true;
  if (t === 'light') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}
