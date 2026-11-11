import { useState } from 'react';
import { feeFor } from '../lib/fees';
import { parseReceipt } from '../lib/parse';
import type { Draft } from '../lib/types';
import { readText } from '../native/ocr';
import { makeThumb, pickPhoto, takePhoto, type PickedPhoto } from '../native/photo';
import { Icon } from './icons';
import { TopBar } from './components';
import { useApp } from './context';

export function emptyDraft(): Draft {
  return { ref: '', amount: '', fee: '', feeTouched: false, name: '', number: '', txAt: Date.now(), refRead: false };
}

export function Scan() {
  const { fees, replace, toast } = useApp();
  const [busy, setBusy] = useState(false);

  async function handle(get: () => Promise<PickedPhoto | null>) {
    try {
      const photo = await get();
      if (!photo) return;
      setBusy(true);
      const [text, thumb] = await Promise.all([readText(photo).catch(() => ''), makeThumb(photo.webPath)]);
      const p = parseReceipt(text);
      const fee = p.amount != null ? feeFor(p.amount, fees) : null;
      const draft: Draft = {
        ref: p.ref,
        amount: p.amount != null ? p.amount.toFixed(2) : '',
        fee: fee != null ? fee.toFixed(2) : '',
        feeTouched: false,
        name: p.name,
        number: p.number,
        txAt: p.txAt,
        thumb,
        refRead: p.refOk,
      };
      if (!text) toast('Could not read the photo. Please type the details.', true);
      replace({ name: 'review', draft });
    } catch {
      setBusy(false);
      toast('Something went wrong with the photo. Please try again.', true);
    }
  }

  return (
    <main className="screen dark">
      <TopBar title="Take a photo" />
      <div className="scan-tip">Fit the whole receipt in the box.</div>

      <div className="frame-wrap">
        <div className="frame" aria-hidden="true">
          <i style={{ width: '60%' }} />
          <i style={{ width: '85%' }} />
          <i style={{ width: '100%', height: 14 }} />
          <i style={{ width: '45%' }} />
        </div>
        <div className="frame-note">Make sure the Ref No. is clear</div>
      </div>

      <div className="shoot">
        <button className="side" onClick={() => handle(pickPhoto)}>
          <span>
            <Icon name="gallery" size={28} color="#fff" stroke={2} />
          </span>
          Gallery
        </button>
        <button className="shutter" aria-label="Take photo" onClick={() => handle(takePhoto)} />
        <div className="side" style={{ visibility: 'hidden' }} aria-hidden="true" />
      </div>

      <button className="manual" onClick={() => replace({ name: 'review', draft: emptyDraft() })}>
        No photo? Type it yourself
      </button>

      {busy && (
        <div className="busy" role="alert">
          <div className="spin" />
          Reading your receipt…
        </div>
      )}
    </main>
  );
}
