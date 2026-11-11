import { useEffect, useState } from 'react';

/** True on tablets and wide screens (two-column layout). */
export function useWide(): boolean {
  const q = '(min-width: 768px)';
  const [wide, setWide] = useState(() => window.matchMedia(q).matches);
  useEffect(() => {
    const m = window.matchMedia(q);
    const h = () => setWide(m.matches);
    m.addEventListener('change', h);
    return () => m.removeEventListener('change', h);
  }, []);
  return wide;
}
