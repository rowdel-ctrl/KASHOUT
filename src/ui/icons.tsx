/** Filled icons, one style everywhere. */
const FILL: Record<string, string> = {
  home: 'M12 2.5L2.5 10.5V21h6.5v-6h6v6h6.5V10.5z',
  list: 'M3 5h18v3H3zM3 10.5h18v3H3zM3 16h18v3H3z',
  gear: 'M12 8.5a3.5 3.5 0 100 7 3.5 3.5 0 000-7zM10.2 2h3.6l.5 2.6a7.7 7.7 0 011.8.8l2.3-1.3 1.8 3.1-2 1.8c.1.6.1 1.3 0 1.9l2 1.8-1.8 3.1-2.3-1.3a7.7 7.7 0 01-1.8.8L13.8 22h-3.6l-.5-2.6a7.7 7.7 0 01-1.8-.8l-2.3 1.3-1.8-3.1 2-1.8a6.9 6.9 0 010-1.9l-2-1.8 1.8-3.1 2.3 1.3c.6-.3 1.2-.6 1.8-.8z',
  camera: 'M9 3.5L7.6 5H4.5A2.5 2.5 0 002 7.5v10A2.5 2.5 0 004.5 20h15a2.5 2.5 0 002.5-2.5v-10A2.5 2.5 0 0019.5 5h-3.1L15 3.5H9zM12 8.5a4.5 4.5 0 110 9 4.5 4.5 0 010-9z',
  image: 'M4 4h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2zm0 2v9.6l4.3-4.3a1 1 0 011.4 0L14 16l2.3-2.3a1 1 0 011.4 0L20 16V6H4zm13 2.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3z',
  bolt: 'M13.5 2L4 14h6.5L9 22l10.5-12.5H13z',
  text: 'M4 6h16v3H4zm0 5h10v3H4zm0 5h7v3H4z',
  search: 'M10 2a8 8 0 016.3 12.9l5.4 5.4-1.4 1.4-5.4-5.4A8 8 0 1110 2zm0 2a6 6 0 100 12 6 6 0 000-12z',
  filter: 'M3 5h18l-7 8v6l-4 2v-8z',
  down: 'M6 9l6 6 6-6z',
  up: 'M6 15l6-6 6 6z',
  right: 'M9 6l6 6-6 6z',
  back: 'M15 5l-7 7 7 7z',
  close: 'M5.6 4.2L12 10.6l6.4-6.4 1.4 1.4-6.4 6.4 6.4 6.4-1.4 1.4-6.4-6.4-6.4 6.4-1.4-1.4 6.4-6.4-6.4-6.4z',
  check: 'M9 16.2l-4.2-4.2-1.4 1.4L9 19l12-12-1.4-1.4z',
  warn: 'M12 2L1 21h22L12 2zm-1 7h2v6h-2zm0 8h2v2h-2z',
  calendar: 'M7 2h2v2h6V2h2v2h3v18H4V4h3zm-1 8v10h12V10z',
  share: 'M12 3l5 5-1.4 1.4L13 6.8V16h-2V6.8L8.4 9.4 7 8l5-5zM5 14h2v5h10v-5h2v7H5z',
  download: 'M11 3h2v9.2l2.6-2.6L17 11l-5 5-5-5 1.4-1.4L11 12.2zM5 18h14v3H5z',
  send: 'M2 21l21-9L2 3v7l15 2-15 2z',
  trash: 'M9 3h6l1 2h4v2H4V5h4zM6 9h12l-1 12H7z',
  person: 'M12 12a4.5 4.5 0 100-9 4.5 4.5 0 000 9zm0 2c-4.4 0-8 2.2-8 5v2h16v-2c0-2.8-3.6-5-8-5z',
  edit: 'M3 17.25V21h3.75L17.8 9.94l-3.75-3.75L3 17.25zM20.7 7.04a1 1 0 000-1.41l-2.34-2.34a1 1 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z',
  clock: 'M12 2a10 10 0 100 20 10 10 0 000-20zm1 5v5.4l3.6 2.1-1 1.7L11 13V7z',
};

export function Icon({ name, size = 24, color = 'currentColor' }: { name: string; size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path fill={color} d={FILL[name]} />
    </svg>
  );
}
