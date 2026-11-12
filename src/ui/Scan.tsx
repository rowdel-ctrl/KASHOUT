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
type Look = { kind: 'nothing' | 'moving' | 'steady' | 'noref' | 'found' };

/** Still for this long, then the Ref No. is checked. Short on purpose: it must feel instant. */
const RECHECK_MS = 900;

export function Scan() {
  const { fees, replace, back, toast, settings, t } = useApp();
  const cam = useLiveCamera();
  const [busy, setBusy] = useState(false);
  const [look, setLook] = useState<Look>({ kind: 'nothing' });

  /** `knownText`: the picture was already read (auto capture), so it is not read again. */
  async function handle(get: () => Promise<PickedPhoto | null>, knownText?: string, live = false) {
    try {
      const photo = await get();
      if (!photo) return;
      setBusy(true);
      const draft = await draftFromPhoto(photo, { fees, settings }, knownText);
      if (!draft.rawText) toast(t('Could not read the photo. Please type the details.'), true);
      else if (live && !draft.refRead) {
        // The live picture was not clear enough. The phone's own camera app takes a sharper one.
        toast(t('Could not read the Ref No. Try the phone camera app.'), true, { label: t('Camera app'), run: () => void handleRef.current(takePhoto) });
      }
      replace({ name: 'review', draft });
    } catch (e) {
      setBusy(false);
      const msg = (e as Error)?.message;
      toast(msg && msg.length < 160 ? msg : t('Something went wrong with the photo. Please try again.'), true);
    }
  }
  const handleRef = useRef(handle);
  handleRef.current = handle;

  const shoot = () => (cam.state === 'ready' ? handle(() => cam.captureSharp(), undefined, true) : handle(takePhoto));

  // Take the photo by itself when the receipt is held still. Nothing is saved: Check and save opens next.
  // On the phone the Ref No. is read first, and that same picture is used, so it is read only once.
  const auto = settings.autoCapture && cam.state === 'ready' && !busy;
  const grab = cam.grab;
  const capture = cam.capture;
  useEffect(() => {
    if (!auto) return;
    const tracker = new SteadyTracker();
    let checking = false;
    let lastCheck = 0;
    let prev: Uint8Array | null = null;
    let stopped = false;
    const show = (next: Look) => setLook((l) => (l.kind === next.kind ? l : next));

    const id = window.setInterval(async () => {
      if (stopped || checking) return;
      const f = grab();
      if (!f) return;
      const m = prev && prev.length === f.gray.length ? motion(prev, f.gray) : 255;
      prev = f.gray;
      const r = tracker.push({ motion: m, edge: edgeEnergy(f.gray, f.w, f.h) }, Date.now());
      if (!r.steady) {
        show({ kind: r.kind === 'nothing' ? 'nothing' : 'moving' });
        return;
      }
      const now = Date.now();
      if (now - lastCheck < RECHECK_MS) return; // keep showing the last hint
      lastCheck = now;
      checking = true;
      show({ kind: 'steady' });
      if (!isNative) {
        // The browser cannot read text, so a steady picture is enough.
        stopped = true;
        void handleRef.current(() => capture());
        return;
      }
      try {
        const shot = await capture();
        if (!shot || stopped) {
          checking = false;
          return;
        }
        const text = await readText(shot).catch(() => '');
        if (stopped) return;
        if (parseReceipt(text).refOk) {
          stopped = true;
          show({ kind: 'found' });
          void handleRef.current(() => Promise.resolve(shot), text);
          return;
        }
        URL.revokeObjectURL(shot.webPath);
        show({ kind: 'noref' });
      } catch {
        show({ kind: 'noref' });
      }
      checking = false;
    }, 150);
    return () => {
      stopped = true;
      window.clearInterval(id);
    };
  }, [auto, grab, capture]);

  const ok = look.kind === 'steady' || look.kind === 'found';
  const chip =
    look.kind === 'found'
      ? t('Ref No. found ✓')
      : look.kind === 'nothing'
        ? t('Looking for the receipt…')
        : look.kind === 'noref'
          ? t("Can't read the Ref No. Move closer.")
          : t('Hold steady…');

  return (
    <main className="scan">
      <div className="bar">
        <button className="round" aria-label={t('Close')} onClick={back}>
          <Icon name="close" size={22} />
        </button>
        <b>{t('Scan receipt')}</b>
        <button className={`round`} aria-label={t('Flash')} aria-pressed={cam.torch} disabled={!cam.torchOk} style={{ opacity: cam.torchOk ? 1 : 0.4, background: cam.torch ? 'var(--live)' : undefined, color: cam.torch ? '#0E1F12' : undefined }} onClick={cam.toggleTorch}>
          <Icon name="bolt" size={22} />
        </button>
      </div>
      <div className="tip">{settings.autoCapture ? t('Hold the receipt inside the frame. The photo is taken for you.') : t('Fit the whole receipt inside the frame.')}</div>

      <div className={`viewport${settings.autoCapture ? ' auto' : ''}${ok ? ' ok' : ''}`} data-look={look.kind}>
        <video ref={cam.videoRef} playsInline muted autoPlay aria-label={t('Camera preview')} style={{ visibility: cam.state === 'ready' ? 'visible' : 'hidden' }} />
        <div className="guide" aria-hidden="true" />
        <i className="c tl" />
        <i className="c tr" />
        <i className="c bl" />
        <i className="c br" />
        {cam.state === 'ready' && (
          <div className="status">
            <span className={settings.autoCapture ? (ok ? 'ok' : 'wait') : undefined}>{settings.autoCapture ? chip : t('Keep the Ref No. sharp')}</span>
          </div>
        )}
        {cam.state === 'starting' && <div className="nocam">{t('Starting the camera…')}</div>}
        {cam.state === 'unavailable' && (
          <div className="nocam">
            <div>{t("The live camera did not start. You can use your phone's camera app instead.")}</div>
            <button className="btn btn-primary" style={{ width: 'auto', padding: '0 24px', height: 52, fontSize: 16 }} onClick={() => handle(takePhoto)}>
              {t('Open camera app')}
            </button>
            <button className="btn btn-text" style={{ color: '#EADFCB', height: 44 }} onClick={cam.retry}>
              {t('Try live camera again')}
            </button>
          </div>
        )}
      </div>

      <div className="shoot">
        <button className="side" onClick={() => handle(pickPhoto)}>
          <span>
            <Icon name="image" size={26} color="#fff" />
          </span>
          {t('Gallery')}
        </button>
        <button className="shutter" aria-label={t('Take photo')} disabled={cam.state === 'starting'} onClick={shoot} />
        <button className="side" onClick={() => replace({ name: 'review', draft: emptyDraft() })}>
          <span>
            <Icon name="text" size={26} color="#fff" />
          </span>
          {t('Type')}
        </button>
      </div>

      {busy && (
        <div className="busy" role="alert">
          <div className="spin" />
          {look.kind === 'found' || look.kind === 'steady' ? t('Photo taken. Opening…') : t('Reading your receipt…')}
        </div>
      )}
    </main>
  );
}
