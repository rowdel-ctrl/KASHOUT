import { useState } from 'react';
import { feeFor } from '../lib/fees';
import { parseReceipt } from '../lib/parse';
import type { Draft } from '../lib/types';
import { useLiveCamera } from '../native/liveCamera';
import { readText } from '../native/ocr';
import { makePhoto, makeThumb, pickPhoto, takePhoto, type PickedPhoto } from '../native/photo';
import { withoutOwn } from '../lib/identity';
import { Icon } from './icons';
import { useApp } from './context';

export function emptyDraft(): Draft {
  return { ref: '', amount: '', fee: '', feeTouched: false, name: '', number: '', txAt: Date.now(), refRead: false };
}

export function Scan() {
  const { fees, replace, back, toast, settings } = useApp();
  const cam = useLiveCamera();
  const [busy, setBusy] = useState(false);

  async function handle(get: () => Promise<PickedPhoto | null>) {
    try {
      const photo = await get();
      if (!photo) return;
      setBusy(true);
      const [text, thumb, sharp] = await Promise.all([readText(photo).catch(() => ''), makeThumb(photo.webPath), makePhoto(photo.webPath)]);
      const p = parseReceipt(text);
      const fee = p.amount != null ? feeFor(p.amount, fees) : null;
      // Photos of a customer's phone show the store's own name and number. Leave those out.
      const who = withoutOwn(p.name, p.number, { names: settings.ownNames, numbers: settings.ownNumbers });
      const draft: Draft = {
        ref: p.ref,
        amount: p.amount != null ? p.amount.toFixed(2) : '',
        fee: fee != null ? fee.toFixed(2) : '',
        feeTouched: false,
        name: who.name,
        number: who.number,
        txAt: p.txAt,
        thumb,
        photo: sharp,
        photoUrl: photo.webPath,
        rawText: text,
        refRead: p.refOk,
      };
      if (!text) toast('Could not read the photo. Please type the details.', true);
      replace({ name: 'review', draft });
    } catch (e) {
      setBusy(false);
      const msg = (e as Error)?.message;
      toast(msg && msg.length < 160 ? msg : 'Something went wrong with the photo. Please try again.', true);
    }
  }

  const shoot = () => (cam.state === 'ready' ? handle(() => cam.capture()) : handle(takePhoto));

  return (
    <main className="scan">
      <div className="bar">
        <button className="round" aria-label="Close" onClick={back}>
          <Icon name="close" size={22} />
        </button>
        <b>Scan receipt</b>
        <button className={`round`} aria-label="Flash" aria-pressed={cam.torch} disabled={!cam.torchOk} style={{ opacity: cam.torchOk ? 1 : 0.4, background: cam.torch ? 'var(--live)' : undefined, color: cam.torch ? '#0E1F12' : undefined }} onClick={cam.toggleTorch}>
          <Icon name="bolt" size={22} />
        </button>
      </div>
      <div className="tip">Fit the whole receipt inside the frame.</div>

      <div className="viewport">
        <video ref={cam.videoRef} playsInline muted autoPlay aria-label="Camera preview" style={{ visibility: cam.state === 'ready' ? 'visible' : 'hidden' }} />
        <div className="guide" aria-hidden="true" />
        <i className="c tl" />
        <i className="c tr" />
        <i className="c bl" />
        <i className="c br" />
        {cam.state === 'ready' && (
          <div className="status">
            <span>Keep the Ref No. sharp</span>
          </div>
        )}
        {cam.state === 'starting' && <div className="nocam">Starting the camera…</div>}
        {cam.state === 'unavailable' && (
          <div className="nocam">
            <div>The live camera did not start. You can use your phone's camera app instead.</div>
            <button className="btn btn-primary" style={{ width: 'auto', padding: '0 24px', height: 52, fontSize: 16 }} onClick={() => handle(takePhoto)}>
              Open camera app
            </button>
            <button className="btn btn-text" style={{ color: '#EADFCB', height: 44 }} onClick={cam.retry}>
              Try live camera again
            </button>
          </div>
        )}
      </div>

      <div className="shoot">
        <button className="side" onClick={() => handle(pickPhoto)}>
          <span>
            <Icon name="image" size={26} color="#fff" />
          </span>
          Gallery
        </button>
        <button className="shutter" aria-label="Take photo" disabled={cam.state === 'starting'} onClick={shoot} />
        <button className="side" onClick={() => replace({ name: 'review', draft: emptyDraft() })}>
          <span>
            <Icon name="text" size={26} color="#fff" />
          </span>
          Type
        </button>
      </div>

      {busy && (
        <div className="busy" role="alert">
          <div className="spin" />
          Reading your receipt…
        </div>
      )}
    </main>
  );
}
