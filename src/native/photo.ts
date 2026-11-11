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

/** Returns null when the person cancels. */
export async function takePhoto(): Promise<PickedPhoto | null> {
  if (!isNative) return pickFileOnWeb();
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
