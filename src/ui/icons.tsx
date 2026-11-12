/**
 * Line icons with a soft colour fill, one style everywhere.
 * 24 x 24 shapes drawn with a thin rounded line and room around them (not cramped).
 * The names are the ones the screens already use.
 */
const SHAPES: Record<string, string> = {
  home: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4.5 6h.01M4.5 12h.01M4.5 18h.01"/>',
  gear: '<path d="M4 8h9M19 8h1M4 16h1M11 16h9"/><circle cx="16" cy="8" r="2.5"/><circle cx="8" cy="16" r="2.5"/>',
  camera: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>',
  image: '<rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>',
  bolt: '<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>',
  text: '<path d="M4 7V4h16v3M9 20h6M12 4v16"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  filter: '<path d="M10 20a1 1 0 0 0 .55.9l2 1A1 1 0 0 0 14 21v-7a2 2 0 0 1 .52-1.34L21.74 4.67A1 1 0 0 0 21 3H3a1 1 0 0 0-.74 1.67l7.22 7.99A2 2 0 0 1 10 14z"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  up: '<path d="m18 15-6-6-6 6"/>',
  right: '<path d="m9 18 6-6-6-6"/>',
  back: '<path d="m15 18-6-6 6-6"/>',
  close: '<path d="M18 6 6 18M6 6l12 12"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  warn: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4M12 17h.01"/>',
  calendar: '<rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5M12 15V3"/>',
  send: '<path d="M14.54 21.69a.5.5 0 0 0 .94-.02l6.5-19a.5.5 0 0 0-.64-.64l-19 6.5a.5.5 0 0 0-.02.94l7.93 3.18a2 2 0 0 1 1.11 1.1z"/><path d="m21.85 2.15-10.94 10.94"/>',
  trash: '<path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2M10 11v6M14 11v6"/>',
  person: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  edit: '<path d="M21.17 6.81a1 1 0 0 0-3.99-3.99L3.84 16.17a2 2 0 0 0-.5.83l-1.32 4.35a.5.5 0 0 0 .62.62l4.35-1.32a2 2 0 0 0 .83-.5z"/><path d="m15 5 4 4"/>',
};

/** These get a soft colour inside. The others are plain lines. */
const SOFT = new Set(['home', 'gear', 'camera', 'image', 'bolt', 'warn', 'person', 'clock', 'send', 'filter']);

export function Icon({ name, size = 24, color = 'currentColor', soft }: { name: string; size?: number; color?: string; soft?: boolean }) {
  const filled = soft ?? SOFT.has(name);
  // The drawing sits inside a bigger box, so there is room around it. The box is scaled up
  // to keep the same visible size, and pulled back with a margin so layouts do not move.
  const box = Math.round(size * 1.25);
  return (
    <svg
      width={box}
      height={box}
      viewBox="-3 -3 30 30"
      fill={filled ? color : 'none'}
      fillOpacity={filled ? 0.18 : undefined}
      stroke={color}
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      style={{ margin: -(box - size) / 2, flex: 'none' }}
      dangerouslySetInnerHTML={{ __html: SHAPES[name] ?? '' }}
    />
  );
}
