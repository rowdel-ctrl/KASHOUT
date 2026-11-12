import { useEffect, useRef, useState } from 'react';
import { parseReceipt } from '../lib/parse';
import { SteadyTracker, edgeEnergy, motion } from '../lib/steady';
import { useLiveCamera } from '../native/liveCamera';
import { readText } from '../native/ocr';
import { pickPhoto, takePhoto, type PickedPhoto } from '../native/photo';
import { isNative } from '../native/platform';
import { draftFromPhoto, emptyDraft } from './draft';
import { Icon } from './icons';
import { useApp } from './context';

export { emptyDraft };

/** What the live camera tells the person right now. */
type Look = { kind: 'nothing' | 'moving' | 'steady' | 'noref' } | { kind: 'counting'; count: number; refSeen: boolean };

const COUNT_STEP_MS = 500;
const RECHECK_MS = 1600;

export function Scan() {
  const { fees, replace, back, toast, settings } = useApp();
  const cam = useLiveCamera();
  const [busy, setBusy] = useState(false);
  const [look, setLook] = useState<Look>({ kind: 'nothing' });

  async function handle(get: () => Promise<PickedPhoto | null>) {
    try {
      const photo = await get();
      if (!photo) return;
      setBusy(true);
      const draft = await draftFromPhoto(photo, { fees, settings });
      if (!draft.rawText) toast('Could not read the photo. Please type the details.', true);
      replace({ name: 'review', draft });
    } catch (e) {
      setBusy(false);
      const msg = (e as Error)?.message;
      toast(msg && msg.length < 160 ? msg : 'Something went wrong with the photo. Please try again.', true);
    }
  }
  const handleRef = useRef(handle);
  handleRef.current = handle;

  const shoot = () => (cam.state === 'ready' ? handle(() => cam.capture()) : handle(takePhoto));

  // Take the photo by itself when the receipt is held still. Nothing is saved: Check and save opens next.
  const auto = settings.autoCapture && cam.state === 'ready' && !busy;
  const grab = cam.grab;
  const capture = cam.capture;
  useEffect(() => {
    if (!auto) return;
    const tracker = new SteadyTracker();
    let phase: 'idle' | 'checking' | 'counting' = 'idle';
    let countStart = 0;
    let lastCheck = 0;
    let refSeen = false;
    let prev: Uint8Array | null = null;
    let stopped = false;
    const show = (next: Look) =>
      setLook((l) => (l.kind === next.kind && (l.kind !== 'counting' || (next.kind === 'counting' && l.count === next.count)) ? l : next));

    // Native: make sure the Ref No. can really be read before counting down.
    async function refReadable(): Promise<boolean> {
      const shot = await capture();
      if (!shot) return false;
      try {
        return parseReceipt(await readText(shot)).refOk;
      } catch {
        return false;
      } finally {
        URL.revokeObjectURL(shot.webPath);
      }
    }

    const id = window.setInterval(async () => {
      if (stopped) return;
      const f = grab();
      if (!f) return;
      const m = prev && prev.length === f.gray.length ? motion(prev, f.gray) : 255;
      prev = f.gray;
      const r = tracker.push({ motion: m, edge: edgeEnergy(f.gray, f.w, f.h) }, Date.now());
      if (phase === 'checking') return;
      if (phase === 'counting') {
        if (!r.steady) {
          phase = 'idle';
          show({ kind: r.kind === 'nothing' ? 'nothing' : 'moving' });
          return;
        }
        const n = 2 - Math.floor((Date.now() - countStart) / COUNT_STEP_MS);
        if (n <= 0) {
          phase = 'checking';
          void handleRef.current(() => capture());
          return;
        }
        show({ kind: 'counting', count: n, refSeen });
        return;
      }
      if (!r.steady) {
        show({ kind: r.kind === 'nothing' ? 'nothing' : 'moving' });
        return;
      }
      const now = Date.now();
      if (now - lastCheck < RECHECK_MS) return; // keep showing the last hint
      lastCheck = now;
      if (isNative) {
        phase = 'checking';
        show({ kind: 'steady' });
        const ok = await refReadable();
        if (stopped) return;
        if (ok) {
          phase = 'counting';
          refSeen = true;
          countStart = Date.now();
          show({ kind: 'counting', count: 2, refSeen });
        } else {
          phase = 'idle';
          show({ kind: 'noref' });
        }
      } else {
        phase = 'counting';
        refSeen = false;
        countStart = now;
        show({ kind: 'counting', count: 2, refSeen });
      }
    }, 200);
    return () => {
      stopped = true;
      window.clearInterval(id);
    };
  }, [auto, grab, capture]);

  const ok = look.kind === 'counting' || look.kind === 'steady';
  const chip =
    look.kind === 'counting'
      ? look.refSeen
        ? 'Ref No. found ✓'
        : 'Hold steady…'
      : look.kind === 'nothing'
        ? 'Looking for the receipt…'
        : look.kind === 'noref'
          ? "Can't read the Ref No. Move closer."
          : 'Hold steady…';

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
      <div className="tip">{settings.autoCapture ? 'Hold the receipt inside the frame. The photo is taken for you.' : 'Fit the whole receipt inside the frame.'}</div>

      <div className={`viewport${settings.autoCapture ? ' auto' : ''}${ok ? ' ok' : ''}`} data-look={look.kind}>
        <video ref={cam.videoRef} playsInline muted autoPlay aria-label="Camera preview" style={{ visibility: cam.state === 'ready' ? 'visible' : 'hidden' }} />
        <div className="guide" aria-hidden="true" />
        <i className="c tl" />
        <i className="c tr" />
        <i className="c bl" />
        <i className="c br" />
        {cam.state === 'ready' && look.kind === 'counting' && (
          <div className="countdown" aria-live="polite">
            <b>{look.count}</b>
            <span>Hold steady…</span>
          </div>
        )}
        {cam.state === 'ready' && (
          <div className="status">
            <span className={settings.autoCapture ? (ok ? 'ok' : 'wait') : undefined}>{settings.autoCapture ? chip : 'Keep the Ref No. sharp'}</span>
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
          {look.kind === 'counting' || look.kind === 'steady' ? 'Photo taken. Reading your receipt…' : 'Reading your receipt…'}
        </div>
      )}
    </main>
  );
}
