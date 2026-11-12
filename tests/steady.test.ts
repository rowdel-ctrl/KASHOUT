import { describe, expect, it } from 'vitest';
import { SteadyTracker, edgeEnergy, motion } from '../src/lib/steady';

const flat = (n: number, v: number) => new Uint8Array(n).fill(v);
/** Stripes, like lines of text. */
const stripes = (w: number, h: number) => {
  const g = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) g[y * w + x] = (x + y) % 2 ? 230 : 20;
  return g;
};

describe('motion and edges', () => {
  it('no change means no motion', () => {
    expect(motion(flat(100, 50), flat(100, 50))).toBe(0);
  });
  it('a different picture means motion', () => {
    expect(motion(flat(100, 50), flat(100, 90))).toBe(40);
  });
  it('pictures of different sizes count as moving', () => {
    expect(motion(flat(10, 1), flat(20, 1))).toBe(255);
  });
  it('a blank wall has no edges, text has many', () => {
    expect(edgeEnergy(flat(64 * 48, 120), 64, 48)).toBe(0);
    expect(edgeEnergy(stripes(64, 48), 64, 48)).toBeGreaterThan(100);
  });
});

describe('SteadyTracker', () => {
  const still = { motion: 1, edge: 30 };
  it('becomes steady only after it has been still for the hold time', () => {
    const t = new SteadyTracker({ motionMax: 6, edgeMin: 5, holdMs: 700 });
    expect(t.push(still, 0)).toEqual({ kind: 'waiting', steady: false });
    expect(t.push(still, 400).steady).toBe(false);
    expect(t.push(still, 700)).toEqual({ kind: 'steady', steady: true });
  });
  it('movement starts the wait again', () => {
    const t = new SteadyTracker({ motionMax: 6, edgeMin: 5, holdMs: 700 });
    t.push(still, 0);
    expect(t.push({ motion: 30, edge: 30 }, 500)).toEqual({ kind: 'moving', steady: false });
    expect(t.push(still, 600).steady).toBe(false);
    expect(t.push(still, 1200).steady).toBe(false);
    expect(t.push(still, 1300).steady).toBe(true);
  });
  it('a picture with nothing in it is never steady', () => {
    const t = new SteadyTracker({ motionMax: 6, edgeMin: 5, holdMs: 700 });
    for (let ms = 0; ms < 3000; ms += 200) expect(t.push({ motion: 0, edge: 1 }, ms)).toEqual({ kind: 'nothing', steady: false });
  });
  it('reset forgets the wait', () => {
    const t = new SteadyTracker({ motionMax: 6, edgeMin: 5, holdMs: 700 });
    t.push(still, 0);
    t.reset();
    expect(t.push(still, 900).steady).toBe(false);
  });
});
