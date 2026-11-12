import { useCallback, useEffect, useRef, useState } from 'react';

export type CamState = 'starting' | 'ready' | 'unavailable';

/**
 * Live camera preview with a capture function.
 * Works in the Android web view (after the camera permission) and in the browser.
 */
export function useLiveCamera() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [state, setState] = useState<CamState>('starting');
  const [torch, setTorch] = useState(false);
  const [torchOk, setTorchOk] = useState(false);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const start = useCallback(async () => {
    setState('starting');
    stop();
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('no camera api');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      const v = videoRef.current;
      if (v) {
        v.srcObject = stream;
        await v.play().catch(() => {});
      }
      const caps = (stream.getVideoTracks()[0]?.getCapabilities?.() ?? {}) as { torch?: boolean };
      setTorchOk(!!caps.torch);
      setState('ready');
    } catch {
      setState('unavailable');
    }
  }, [stop]);

  useEffect(() => {
    void start();
    return stop;
  }, [start, stop]);

  const toggleTorch = useCallback(async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const next = !torch;
    try {
      await track.applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] });
      setTorch(next);
    } catch {
      setTorchOk(false);
    }
  }, [torch]);

  const small = useRef<HTMLCanvasElement | null>(null);

  /** A tiny grey copy of the current frame (one byte per pixel), used to tell when the receipt is still. */
  const grab = useCallback((width = 160): { gray: Uint8Array; w: number; h: number } | null => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return null;
    const w = width;
    const h = Math.max(1, Math.round((width * v.videoHeight) / v.videoWidth));
    const c = (small.current ??= document.createElement('canvas'));
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(v, 0, 0, w, h);
    const px = ctx.getImageData(0, 0, w, h).data;
    const gray = new Uint8Array(w * h);
    for (let i = 0; i < gray.length; i++) gray[i] = (px[i * 4] * 77 + px[i * 4 + 1] * 150 + px[i * 4 + 2] * 29) >> 8;
    return { gray, w, h };
  }, []);

  /** Grabs the current frame as a JPEG picture. Returns null if the camera is not ready. */
  const capture = useCallback(async (): Promise<{ webPath: string } | null> => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return null;
    const c = document.createElement('canvas');
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext('2d')!.drawImage(v, 0, 0, c.width, c.height);
    const blob = await new Promise<Blob | null>((res) => c.toBlob(res, 'image/jpeg', 0.92));
    if (!blob) return null;
    return { webPath: URL.createObjectURL(blob) };
  }, []);

  return { videoRef, state, retry: start, torch, torchOk, toggleTorch, capture, grab };
}
