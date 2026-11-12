export function peso(n: number): string {
  const whole = Number.isInteger(n);
  return '₱' + n.toLocaleString('en-US', { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 });
}

export function peso2(n: number): string {
  return '₱' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function timeOf(ms: number): string {
  return new Date(ms).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export function dayKey(ms: number): string {
  const d = new Date(ms);
  const p = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function isToday(ms: number): boolean {
  return dayKey(ms) === dayKey(Date.now());
}

export function isYesterday(ms: number): boolean {
  return dayKey(ms) === dayKey(Date.now() - 86_400_000);
}

export function shortDate(ms: number): string {
  return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function dateTime(ms: number): string {
  return `${shortDate(ms)}, ${timeOf(ms)}`;
}

/** Value for <input type="datetime-local"> in local time. */
export function toLocalInput(ms: number | null): string {
  if (ms == null) return '';
  const d = new Date(ms);
  const p = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function fromLocalInput(v: string): number | null {
  if (!v) return null;
  const t = new Date(v).getTime();
  return Number.isNaN(t) ? null : t;
}

export function parseMoney(s: string): number {
  const n = Number(String(s).replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

/** 13-digit references are shown in groups of 4, 4 and 5 so they are easy to compare: 0046 2760 76549. */
export function formatRef(ref: string): string {
  const d = ref.replace(/\s+/g, '');
  return /^\d{13}$/.test(d) ? `${d.slice(0, 4)} ${d.slice(4, 8)} ${d.slice(8)}` : ref;
}

/** How long something has been waiting: "25 min", "3 h", "2 d". */
export function waitText(ms: number): string {
  const min = Math.max(0, Math.floor(ms / 60_000));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h`;
  return `${Math.floor(h / 24)} d`;
}
