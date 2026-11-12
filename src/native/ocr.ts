import { Directory, Filesystem } from '@capacitor/filesystem';
import { TextRecognition } from '@capacitor-mlkit/text-recognition';
import type { PickedPhoto } from './photo';
import { isNative } from './platform';

/** Reads all text in the photo with Google ML Kit (on the phone, free, works offline). */
export async function readText(photo: PickedPhoto): Promise<string> {
  if (!isNative) {
    // Browser demo and tests only. A queue gives each picture its own text.
    const g = globalThis as { __ocrText?: string; __ocrQueue?: string[] };
    if (g.__ocrQueue && g.__ocrQueue.length) return g.__ocrQueue.shift() ?? '';
    return g.__ocrText ?? '';
  }
  if (photo.uri) {
    try {
      const r = await TextRecognition.processImage({ path: photo.uri });
      if (r.text) return r.text;
    } catch {
      /* try the copy below */
    }
  }
  // Fallback: copy the picture into the app's cache and read that file.
  const blob = await (await fetch(photo.webPath)).blob();
  const base64 = await blobToBase64(blob);
  const file = await Filesystem.writeFile({ path: `ocr-${Date.now()}.jpg`, data: base64, directory: Directory.Cache });
  const r = await TextRecognition.processImage({ path: file.uri });
  return r.text;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(String(fr.result).split(',')[1] ?? '');
    fr.onerror = () => rej(fr.error);
    fr.readAsDataURL(blob);
  });
}
