/**
 * Decides when the receipt is held still in front of the camera.
 * Works on tiny grey pictures (one byte per pixel), so it is quick on any phone.
 */

/** Average change between two pictures of the same size, 0 to 255. Higher means more movement. */
export function motion(a: Uint8Array, b: Uint8Array): number {
  if (a.length !== b.length || a.length === 0) return 255;
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += Math.abs(a[i] - b[i]);
  return sum / a.length;
}

/** Average edge strength, 0 to 255. A page of text has many edges. A blank wall or a blur has few. */
export function edgeEnergy(g: Uint8Array, w: number, h: number): number {
  if (w < 2 || h < 2 || g.length < w * h) return 0;
  let sum = 0;
  let n = 0;
  for (let y = 0; y < h - 1; y++) {
    for (let x = 0; x < w - 1; x++) {
      const i = y * w + x;
      sum += Math.abs(g[i] - g[i + 1]) + Math.abs(g[i] - g[i + w]);
      n++;
    }
  }
  return n ? sum / n : 0;
}

export interface SteadyOptions {
  /** Movement above this means the phone is moving. */
  motionMax: number;
  /** Edge strength below this means there is no receipt in the picture. */
  edgeMin: number;
  /** How long it must stay still before it counts as steady. */
  holdMs: number;
}

export const DEFAULT_STEADY: SteadyOptions = { motionMax: 8, edgeMin: 4, holdMs: 400 };

export type SteadyKind = 'nothing' | 'moving' | 'waiting' | 'steady';

export interface SteadyResult {
  kind: SteadyKind;
  /** True once it has been still, with a receipt in view, for holdMs. */
  steady: boolean;
}

/** Feed one reading at a time. */
export class SteadyTracker {
  private since: number | null = null;
  constructor(private opts: SteadyOptions = DEFAULT_STEADY) {}

  reset() {
    this.since = null;
  }

  push(m: { motion: number; edge: number }, now: number): SteadyResult {
    if (m.edge < this.opts.edgeMin) {
      this.since = null;
      return { kind: 'nothing', steady: false };
    }
    if (m.motion > this.opts.motionMax) {
      this.since = null;
      return { kind: 'moving', steady: false };
    }
    if (this.since === null) this.since = now;
    const steady = now - this.since >= this.opts.holdMs;
    return { kind: steady ? 'steady' : 'waiting', steady };
  }
}
