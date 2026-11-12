import { Camera, MediaTypeSelection } from '@capacitor/camera';
import { isNative } from './platform';

export interface PickedPhoto {
  /** Native file URI (used by text reading). */
  uri?: string;
  /** URL the web view can show. */
  webPath: string;
}

function pickFileOnWeb(): Promise<PickedPhoto | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => {
      const f = input.files?.[0];
      resolve(f ? { webPath: URL.createObjectURL(f) } : null);
    };
    input.oncancel = () => resolve(null);
    input.click();
  });
}

/** Asks for camera permission if needed. Throws a clear message if it is refused. */
async function ensureCamera(): Promise<void> {
  let st = await Camera.checkPermissions();
  if (st.camera !== 'granted') st = await Camera.requestPermissions({ permissions: ['camera'] });
  if (st.camera !== 'granted') {
    throw new Error('The camera is off. Turn it on in phone Settings > Apps > Kashawt > Permissions > Camera.');
  }
}

/** Returns null when the person cancels. */
export async function takePhoto(): Promise<PickedPhoto | null> {
  if (!isNative) return pickFileOnWeb();
  await ensureCamera();
  try {
    const r = await Camera.takePhoto({ quality: 90, correctOrientation: true });
    if (!r.webPath) return null;
    return { uri: r.uri, webPath: r.webPath };
  } catch (e) {
    if (isCancel(e)) return null;
    throw e;
  }
}

export async function pickPhoto(): Promise<PickedPhoto | null> {
  if (!isNative) return pickFileOnWeb();
  try {
    const r = await Camera.chooseFromGallery({ mediaType: MediaTypeSelection.Photo, allowMultipleSelection: false });
    const m = r.results[0];
    if (!m?.webPath) return null;
    return { uri: m.uri, webPath: m.webPath };
  } catch (e) {
    if (isCancel(e)) return null;
    throw e;
  }
}

function isCancel(e: unknown): boolean {
  const msg = String((e as { message?: string })?.message ?? e).toLowerCase();
  return msg.includes('cancel') || msg.includes('dismiss') || msg.includes('no image');
}

/** Small JPEG (about 10 to 20 KB) kept with the record so disputes can be checked later. */
export async function makeThumb(webPath: string, maxWidth = 240): Promise<string | undefined> {
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error('image'));
      i.src = webPath;
    });
    const scale = Math.min(1, maxWidth / img.width);
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * scale);
    c.height = Math.round(img.height * scale);
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.55);
  } catch {
    return undefined;
  }
}

/** A sharper copy (about 600 pixels wide, under 150 KB) that is saved with the record. */
export async function makePhoto(webPath: string, maxWidth = 640): Promise<string | undefined> {
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error('image'));
      i.src = webPath;
    });
    const scale = Math.min(1, maxWidth / img.width);
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * scale);
    c.height = Math.round(img.height * scale);
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    for (const q of [0.62, 0.5, 0.4, 0.3]) {
      const url = c.toDataURL('image/jpeg', q);
      if (url.length <= 150_000) return url;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * A picture of a shared message, so the record still has something to look at later.
 * GCash's Share button sends only text, not a screenshot. This draws that text on a clean card.
 * Returns undefined where there is no page to draw on.
 */
export function makeTextPhoto(text: string, title: string, footer: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  try {
    const W = 720;
    const pad = 36;
    const font = '600 28px Nunito, system-ui, sans-serif';
    const probe = document.createElement('canvas').getContext('2d');
    if (!probe) return undefined;
    probe.font = font;
    // Wrap the words to the card width.
    const lines: string[] = [];
    for (const para of text.replace(/\r/g, '').split('\n')) {
      let line = '';
      for (const word of para.split(/\s+/).filter(Boolean)) {
        const next = line ? line + ' ' + word : word;
        if (probe.measureText(next).width > W - pad * 2 && line) {
          lines.push(line);
          line = word;
        } else line = next;
      }
      lines.push(line);
      if (lines.length > 24) break;
    }
    const shown = lines.slice(0, 24);
    const lineH = 42;
    const head = 84;
    const foot = 64;
    const H = head + pad + shown.length * lineH + foot;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d');
    if (!g) return undefined;
    g.fillStyle = '#FFFFFF';
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#1F7A4A';
    g.fillRect(0, 0, W, head);
    g.fillStyle = '#FFFFFF';
    g.font = '800 30px Nunito, system-ui, sans-serif';
    g.textBaseline = 'middle';
    g.fillText(title, pad, head / 2);
    g.fillStyle = '#1D1B16';
    g.font = font;
    g.textBaseline = 'alphabetic';
    shown.forEach((l, i) => g.fillText(l, pad, head + pad + 30 + i * lineH));
    g.fillStyle = '#6B604F';
    g.font = '700 22px Nunito, system-ui, sans-serif';
    g.fillText(footer, pad, H - 26);
    for (const q of [0.8, 0.7, 0.55]) {
      const url = c.toDataURL('image/jpeg', q);
      if (url.length <= 150_000) return url;
    }
    return undefined;
  } catch {
    return undefined;
  }
}
