import { useEffect, useRef, useState } from 'react';
import { Icon } from './icons';
import { useApp } from './context';

const MAX = 6;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Full-screen photo. Pinch to zoom, drag to move, double-tap to zoom in and out. */
export function PhotoViewer({ src, onClose }: { src: string; onClose: () => void }) {
  const { t: tr } = useApp();
  const [t, setT] = useState({ s: 1, x: 0, y: 0 });
  const pts = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ d: number; s: number } | null>(null);
  const lastTap = useRef(0);
  const moved = useRef(false);

  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const dist = () => {
    const [a, b] = [...pts.current.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };

  function down(e: React.PointerEvent) {
    e.currentTarget.setPointerCapture(e.pointerId);
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    moved.current = false;
    if (pts.current.size === 2) pinch.current = { d: dist(), s: t.s };
  }

  function move(e: React.PointerEvent) {
    const prev = pts.current.get(e.pointerId);
    if (!prev) return;
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (Math.abs(e.clientX - prev.x) + Math.abs(e.clientY - prev.y) > 1) moved.current = true;
    if (pts.current.size === 2 && pinch.current) {
      const s = clamp((pinch.current.s * dist()) / pinch.current.d, 1, MAX);
      setT((p) => ({ s, x: s === 1 ? 0 : p.x, y: s === 1 ? 0 : p.y }));
    } else if (pts.current.size === 1) {
      setT((p) => (p.s > 1 ? { ...p, x: p.x + (e.clientX - prev.x), y: p.y + (e.clientY - prev.y) } : p));
    }
  }

  function up(e: React.PointerEvent) {
    pts.current.delete(e.pointerId);
    pinch.current = null;
    if (pts.current.size === 0 && !moved.current) {
      const now = Date.now();
      if (now - lastTap.current < 300) setT((p) => (p.s > 1 ? { s: 1, x: 0, y: 0 } : { s: 2.5, x: 0, y: 0 }));
      lastTap.current = now;
    }
  }

  function wheel(e: React.WheelEvent) {
    const s = clamp(t.s * (e.deltaY < 0 ? 1.2 : 1 / 1.2), 1, MAX);
    setT((p) => ({ s, x: s === 1 ? 0 : p.x, y: s === 1 ? 0 : p.y }));
  }

  return (
    <div className="viewer" role="dialog" aria-modal="true" aria-label={tr('Receipt photo')}>
      <div className="stage" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onWheel={wheel}>
        <img src={src} alt={tr('Receipt')} draggable={false} style={{ transform: `translate(${t.x}px, ${t.y}px) scale(${t.s})` }} />
      </div>
      <button className="round" aria-label={tr('Close photo')} onClick={onClose}>
        <Icon name="close" size={22} />
      </button>
      <div className="vhint">{t.s > 1 ? `${t.s.toFixed(1)}×  ·  ${tr('double-tap to reset')}` : tr('Pinch or double-tap to zoom')}</div>
    </div>
  );
}
