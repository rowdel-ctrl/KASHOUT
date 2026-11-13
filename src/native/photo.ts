import { Camera, MediaTypeSelection } from '@capacitor/camera';
import { isNative } from './platform';

export interface PickedPhoto {
  /** Native file URI (used by text reading). */
  uri?: string;
  /** URL the web view can show. */
  webPath: string;
}

function pickFilesOnWeb(): Promise<PickedPhoto[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.onchange = () => resolve(Array.from(input.files ?? []).map((f) => ({ webPath: URL.createObjectURL(f) })));
    input.oncancel = () => resolve([]);
    input.click();
  });
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

/** Pick up to `limit` pictures from the gallery. An empty list when the person cancels. */
export async function pickPhotos(limit = 10): Promise<PickedPhoto[]> {
  if (!isNative) return (await pickFilesOnWeb()).slice(0, limit);
  try {
    const r = await Camera.chooseFromGallery({ mediaType: MediaTypeSelection.Photo, allowMultipleSelection: true, limit });
    return r.results.filter((m) => m.webPath).slice(0, limit).map((m) => ({ uri: m.uri, webPath: m.webPath as string }));
  } catch (e) {
    if (isCancel(e)) return [];
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
export function makeTextPhoto(text: string, opts: { title: string; date: string; note: string }): string | undefined {
  if (typeof document === 'undefined') return undefined;
  try {
    // Drawn like the GCash Inbox message screen: blue bar, white card with the envelope, date, blue title, line, message.
    const W = 720;
    const BAR = 96;
    const SIDE = 36;
    const CARD_X = SIDE;
    const CARD_W = W - SIDE * 2;
    const TEXT_X = CARD_X + 40 + 22;
    const TEXT_W = CARD_W - 80 - 44;
    const face = 'Poppins, Nunito, system-ui, sans-serif';
    const msgFont = `400 29px ${face}`;
    const probe = document.createElement('canvas').getContext('2d');
    if (!probe) return undefined;
    probe.font = msgFont;
    // Wrap the words to the card, and break a word that is wider than the card (a long bank reference).
    const lines: string[] = [];
    const push = (l: string) => lines.push(l);
    for (const para of text.replace(/\r/g, '').split('\n')) {
      let line = '';
      for (const word of para.split(/\s+/).filter(Boolean)) {
        let w = word;
        const next = line ? line + ' ' + w : w;
        if (probe.measureText(next).width <= TEXT_W) {
          line = next;
          continue;
        }
        if (line) {
          push(line);
          line = '';
        }
        while (probe.measureText(w).width > TEXT_W) {
          let n = w.length - 1;
          while (n > 1 && probe.measureText(w.slice(0, n)).width > TEXT_W) n -= 1;
          push(w.slice(0, n));
          w = w.slice(n);
        }
        line = w;
      }
      push(line);
      if (lines.length > 24) break;
    }
    const shown = lines.slice(0, 24);
    const lineH = 43.5;
    const cardTop = BAR + 56;
    const msgTop = cardTop + 237;
    const cardBottom = msgTop + shown.length * lineH + 36;
    const H = Math.ceil(cardBottom + 20 + 26 + 28);
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d');
    if (!g) return undefined;

    const icon = (d: string, x: number, y: number, size: number, color: string, width: number) => {
      g.save();
      g.translate(x, y);
      g.scale(size / 24, size / 24);
      g.strokeStyle = color;
      g.lineWidth = width;
      g.lineCap = 'round';
      g.lineJoin = 'round';
      g.stroke(new Path2D(d));
      g.restore();
    };
    const circle = (cx: number, cy: number, r: number) => `M${cx + r} ${cy}A${r} ${r} 0 1 1 ${cx - r} ${cy}A${r} ${r} 0 1 1 ${cx + r} ${cy}`;
    const rrect = (x: number, y: number, w: number, h: number, r: number) => {
      g.beginPath();
      g.moveTo(x + r, y);
      g.arcTo(x + w, y, x + w, y + h, r);
      g.arcTo(x + w, y + h, x, y + h, r);
      g.arcTo(x, y + h, x, y, r);
      g.arcTo(x, y, x + w, y, r);
      g.closePath();
    };

    // Page and blue bar
    g.fillStyle = '#F5F8FD';
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#1A6FFF';
    g.fillRect(0, 0, W, BAR);
    icon('M20 12H4M10 6l-6 6 6 6', 32, 29, 38, '#FFFFFF', 2.4);
    icon('M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6', W - 32 - 38, 29, 38, '#FFFFFF', 2.4);
    g.fillStyle = '#FFFFFF';
    g.font = `500 34px ${face}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('Inbox', W / 2, BAR / 2 + 2);

    // Card
    g.save();
    g.shadowColor = 'rgba(40,60,100,0.16)';
    g.shadowBlur = 10;
    g.shadowOffsetY = 2;
    g.fillStyle = '#FFFFFF';
    rrect(CARD_X, cardTop, CARD_W, cardBottom - cardTop, 12);
    g.fill();
    g.restore();

    // Envelope circle, with a ring in the page colour
    g.fillStyle = '#F5F8FD';
    g.beginPath();
    g.arc(W / 2, cardTop, 56, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#1560F0';
    g.beginPath();
    g.arc(W / 2, cardTop, 48, 0, Math.PI * 2);
    g.fill();
    icon('M5.5 5h13a2.5 2.5 0 0 1 2.5 2.5v9a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 16.5v-9A2.5 2.5 0 0 1 5.5 5zM3.5 7l8.5 6 8.5-6', W / 2 - 23, cardTop - 23, 46, '#FFFFFF', 2.6);

    // Date, share icon, title, line
    g.textAlign = 'center';
    g.textBaseline = 'alphabetic';
    g.fillStyle = '#6B7686';
    g.font = `500 24px ${face}`;
    g.fillText(opts.date, W / 2, cardTop + 70 + 23);
    icon(`${circle(18, 5.5, 2.6)}${circle(6, 12, 2.6)}${circle(18, 18.5, 2.6)}M8.3 10.7l7.4-4M8.3 13.3l7.4 4`, CARD_X + CARD_W - 36 - 34, cardTop + 74, 34, '#1560F0', 2.4);
    g.fillStyle = '#0B3FC4';
    g.font = `500 40px ${face}`;
    g.fillText(opts.title, W / 2, cardTop + 159);
    g.fillStyle = '#DDE2EA';
    g.fillRect(CARD_X + 40, cardTop + 205, CARD_W - 80, 2);

    // Message
    g.textAlign = 'left';
    g.fillStyle = '#2B2F36';
    g.font = msgFont;
    shown.forEach((l, i) => g.fillText(l, TEXT_X, msgTop + 31 + i * lineH));

    // Note under the card: this is a text copy, not a screenshot
    g.textAlign = 'center';
    g.fillStyle = '#7A8494';
    g.font = `400 20px ${face}`;
    g.fillText(opts.note, W / 2, cardBottom + 20 + 18);

    for (const q of [0.85, 0.75, 0.6]) {
      const url = c.toDataURL('image/jpeg', q);
      if (url.length <= 150_000) return url;
    }
    return undefined;
  } catch {
    return undefined;
  }
}
