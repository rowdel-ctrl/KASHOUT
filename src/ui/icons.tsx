const PATHS: Record<string, string> = {
  home: 'M3 11l9-8 9 8v10H3z',
  list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  back: 'M15 5l-7 7 7 7',
  right: 'M9 6l6 6-6 6',
  down: 'M6 9l6 6 6-6',
  up: 'M6 15l6-6 6 6',
  search: 'M20 20l-4-4',
  warn: 'M12 3l10 18H2zM12 10v5M12 18h.01',
  clock: 'M12 7v5l3 2',
  gallery: 'M21 16l-5-5-8 8',
  bolt: 'M13 2L4 14h7l-1 8 9-12h-7z',
  camera: 'M4 8h3l2-3h6l2 3h3v11H4z',
  closing: 'M9 4h6v3H9zM9 14l2 2 4-4',
  sliders: 'M4 6h8M18 6h2M4 12h2M12 12h8M4 18h10M20 18h0',
  check: 'M5 12l5 5 9-10',
};

export function Icon({ name, size = 26, color = 'currentColor', stroke = 2.2 }: { name: string; size?: number; color?: string; stroke?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={name === 'more' ? 3 : stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name]} />
      {name === 'search' && <circle cx="11" cy="11" r="7" />}
      {name === 'clock' && <circle cx="12" cy="12" r="9" />}
      {name === 'gallery' && (<><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="1.5" /></>)}
      {name === 'camera' && <circle cx="12" cy="13" r="3.5" />}
      {name === 'closing' && <rect x="6" y="4" width="12" height="17" rx="2" />}
      {name === 'sliders' && (<><circle cx="15" cy="6" r="2" /><circle cx="9" cy="12" r="2" /><circle cx="17" cy="18" r="2" /></>)}
    </svg>
  );
}
