import { feeFor } from '../lib/fees';
import { withoutOwn } from '../lib/identity';
import { parseReceipt, type ParsedReceipt } from '../lib/parse';
import type { Draft, FeeTier, Settings } from '../lib/types';
import { readText } from '../native/ocr';
import { makePhoto, makeTextPhoto, makeThumb, type PickedPhoto } from '../native/photo';
import { translate } from '../lib/i18n';
import { dateTime } from '../lib/format';

export interface DraftContext {
  fees: FeeTier[];
  settings: Settings;
}

export function emptyDraft(): Draft {
  return { ref: '', amount: '', fee: '', feeTouched: false, name: '', number: '', txAt: Date.now(), refRead: false };
}

function fromParsed(p: ParsedReceipt, ctx: DraftContext): Draft {
  const fee = p.amount != null ? feeFor(p.amount, ctx.fees) : null;
  // Photos of a customer's phone show the store's own name and number. Leave those out.
  const who = withoutOwn(p.name, p.number, { names: ctx.settings.ownNames, numbers: ctx.settings.ownNumbers });
  return {
    ref: p.ref,
    amount: p.amount != null ? p.amount.toFixed(2) : '',
    fee: fee != null ? fee.toFixed(2) : '',
    feeTouched: false,
    name: who.name,
    number: who.number,
    txAt: p.txAt,
    refRead: p.refOk,
  };
}

/**
 * Reads a receipt picture and fills in a draft. `rawText` is empty when nothing could be read.
 * Pass `knownText` when the picture was already read, so it is not read twice.
 */
export async function draftFromPhoto(photo: PickedPhoto, ctx: DraftContext, knownText?: string, sharedText?: string): Promise<Draft> {
  const [read, thumb, sharp] = await Promise.all([
    knownText !== undefined ? Promise.resolve(knownText) : readText(photo).catch(() => ''),
    makeThumb(photo.webPath),
    makePhoto(photo.webPath),
  ]);
  // The message text sent along with the picture is clean, so it goes first. The picture adds what the text lacks, like the date.
  const text = [sharedText?.trim(), read].filter(Boolean).join('\n');
  const d: Draft = { ...fromParsed(parseReceipt(text), ctx), thumb, photo: sharp, photoUrl: photo.webPath, rawText: text };
  // The small grey date is the part the reader misses most. Use today, and say so, instead of leaving it empty.
  if (text && d.txAt == null) return { ...d, txAt: Date.now(), dateGuess: true };
  return d;
}

/**
 * A receipt shared as text. GCash sends only the message, so a picture of that message is made
 * and kept with the record, the same as a photo would be.
 */
export async function draftFromText(text: string, ctx: DraftContext, now: number = Date.now()): Promise<Draft> {
  const d: Draft = { ...fromParsed(parseReceipt(text, now), ctx), rawText: text };
  // GCash's Share button sends only the message, and the date is not part of it. Use today, and say so.
  const out = d.txAt == null ? { ...d, txAt: now, dateGuess: true } : d;
  const lang = ctx.settings.lang;
  const img = makeTextPhoto(text.trim(), translate(lang, 'GCash message'), translate(lang, 'Shared {when} · text copy, not a screenshot', { when: dateTime(now) }));
  if (!img) return out;
  return { ...out, photo: img, photoUrl: img, thumb: await makeThumb(img) };
}
