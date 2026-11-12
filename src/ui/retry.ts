import { feeFor } from '../lib/fees';
import { parseReceipt } from '../lib/parse';
import { parseMoney } from '../lib/format';
import type { Draft } from '../lib/types';
import { readText } from '../native/ocr';
import type { DraftContext } from './draft';

/** What is still missing from a draft. Only the things that can be read from a receipt. */
export function missingFields(d: Draft): ('reference' | 'amount' | 'date')[] {
  const out: ('reference' | 'amount' | 'date')[] = [];
  if (!d.ref.replace(/\s+/g, '')) out.push('reference');
  if (!(parseMoney(d.amount) > 0)) out.push('amount');
  if (d.txAt == null) out.push('date');
  return out;
}

/** The picture drawn bigger and with more contrast, which helps the reader with small grey text. */
async function enhanced(src: string): Promise<{ webPath: string } | null> {
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error('image'));
      i.src = src;
    });
    const scale = Math.min(2, 2400 / img.width);
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * scale);
    c.height = Math.round(img.height * scale);
    const g = c.getContext('2d');
    if (!g) return null;
    g.filter = 'grayscale(1) contrast(1.45)';
    g.drawImage(img, 0, 0, c.width, c.height);
    const blob = await new Promise<Blob | null>((res) => c.toBlob(res, 'image/jpeg', 0.92));
    return blob ? { webPath: URL.createObjectURL(blob) } : null;
  } catch {
    return null;
  }
}

/** Fill the missing fields of a draft from newly read text. Fields that already have a value are left alone. */
export function fillMissing(d: Draft, text: string, ctx: DraftContext): Draft {
  const p = parseReceipt(text);
  const next: Draft = { ...d, rawText: [d.rawText, text].filter(Boolean).join('\n') };
  if (!d.ref.replace(/\s+/g, '') && p.ref) {
    next.ref = p.ref;
    next.refRead = p.refOk;
  }
  if (!(parseMoney(d.amount) > 0) && p.amount != null) {
    next.amount = p.amount.toFixed(2);
    if (!d.feeTouched) {
      const f = feeFor(p.amount, ctx.fees);
      next.fee = f != null ? f.toFixed(2) : next.fee;
    }
  }
  if (d.txAt == null && p.txAt != null) {
    next.txAt = p.txAt;
    next.dateGuess = false;
  }
  return next;
}

/** Read the same picture again, with a sharper copy. Returns the draft with whatever was found. */
export async function rereadSamePicture(d: Draft, ctx: DraftContext): Promise<Draft> {
  const src = d.photoUrl ?? d.photo;
  let text = '';
  if (src) {
    const big = await enhanced(src);
    if (big) text = await readText(big).catch(() => '');
    if (big) URL.revokeObjectURL(big.webPath);
  } else {
    text = await readText({ webPath: '' }).catch(() => '');
  }
  // In the browser demo and tests the reader is a hook, so a second hook can give a different answer.
  const hook = (globalThis as { __ocrRetryText?: string }).__ocrRetryText;
  if (hook !== undefined) text = hook;
  return fillMissing(d, text, ctx);
}
