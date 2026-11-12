import { feeFor } from '../lib/fees';
import { withoutOwn } from '../lib/identity';
import { parseReceipt, type ParsedReceipt } from '../lib/parse';
import type { Draft, FeeTier, Settings } from '../lib/types';
import { readText } from '../native/ocr';
import { makePhoto, makeThumb, type PickedPhoto } from '../native/photo';

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
export async function draftFromPhoto(photo: PickedPhoto, ctx: DraftContext, knownText?: string): Promise<Draft> {
  const [text, thumb, sharp] = await Promise.all([
    knownText !== undefined ? Promise.resolve(knownText) : readText(photo).catch(() => ''),
    makeThumb(photo.webPath),
    makePhoto(photo.webPath),
  ]);
  const d: Draft = { ...fromParsed(parseReceipt(text), ctx), thumb, photo: sharp, photoUrl: photo.webPath, rawText: text };
  // The small grey date is the part the reader misses most. Use today, and say so, instead of leaving it empty.
  if (text && d.txAt == null) return { ...d, txAt: Date.now(), dateGuess: true };
  return d;
}

/** A receipt shared as text. There is no photo to keep. */
export function draftFromText(text: string, ctx: DraftContext, now: number = Date.now()): Draft {
  const d = { ...fromParsed(parseReceipt(text, now), ctx), rawText: text };
  // GCash's Share button sends only the message, and the date is not part of it. Use today, and say so.
  if (d.txAt == null) return { ...d, txAt: now, dateGuess: true };
  return d;
}
