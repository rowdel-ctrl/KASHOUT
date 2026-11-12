import { App as CapApp } from '@capacitor/app';
import { AppLauncher } from '@capacitor/app-launcher';
import { isNative } from './platform';

/** The releases page the app builds are published to. */
const LATEST = 'https://api.github.com/repos/rowdel-ctrl/KASHOUT/releases/latest';

export interface UpdateInfo {
  /** For example "1.0.22". */
  version: string;
  /** The build number, the last part of the version. Bigger means newer. */
  build: number;
  /** Where the APK can be downloaded. */
  url: string;
}

/** Reads the GitHub "latest release" answer. Null if it is not a Kashawt build. */
export function parseRelease(json: unknown): UpdateInfo | null {
  const j = json as { tag_name?: string; html_url?: string; assets?: { name?: string; browser_download_url?: string }[] } | null;
  const tag = j?.tag_name;
  if (typeof tag !== 'string') return null;
  const m = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(tag.trim());
  if (!m) return null;
  const apk = j?.assets?.find((a) => typeof a?.name === 'string' && a.name.toLowerCase().endsWith('.apk'));
  const url = apk?.browser_download_url ?? j?.html_url;
  if (typeof url !== 'string' || !url.startsWith('https://')) return null;
  return { version: `${m[1]}.${m[2]}.${m[3]}`, build: Number(m[3]), url };
}

export const isNewer = (latestBuild: number, currentBuild: number) => latestBuild > currentBuild;

/** This phone's installed version and build number. Null in the browser. */
export async function installedVersion(): Promise<{ version: string; build: number } | null> {
  if (!isNative) return null;
  try {
    const i = await CapApp.getInfo();
    return { version: i.version, build: parseInt(i.build, 10) || 0 };
  } catch {
    return null;
  }
}

/** The newest published build. Throws if the internet or GitHub does not answer. */
export async function fetchLatest(): Promise<UpdateInfo | null> {
  const res = await fetch(LATEST, { headers: { Accept: 'application/vnd.github+json' } });
  if (!res.ok) throw new Error('github ' + res.status);
  return parseRelease(await res.json());
}

/** Opens the download. The phone's browser downloads the APK, then the person taps it to install. */
export async function openDownload(url: string): Promise<void> {
  if (isNative) {
    try {
      const r = await AppLauncher.openUrl({ url });
      if (r.completed) return;
    } catch {
      /* fall through */
    }
  }
  window.open(url, '_blank');
}
