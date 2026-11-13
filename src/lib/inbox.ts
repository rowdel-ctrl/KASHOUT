/** Words for the picture the app draws from a shared GCash message. They copy the GCash Inbox, so they stay in English. */

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** The title GCash shows on the message: "Express Send Notification", "GCash Funds Received" for bank transfers. */
export function inboxTitle(text: string): string {
  if (/\bof\s+GCash\s+from\b/i.test(text) || /funds\s+received/i.test(text)) return 'GCash Funds Received';
  if (/you\s+have\s+received\b/i.test(text) || /\bexpress\s*send\b/i.test(text)) return 'Express Send Notification';
  return 'GCash Notification';
}

/** "October 26, 2026 05:39 PM", the way the Inbox writes the time of a message. */
export function inboxDate(ms: number): string {
  const d = new Date(ms);
  const h = d.getHours() % 12 || 12;
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()} ${String(h).padStart(2, '0')}:${mm} ${d.getHours() < 12 ? 'AM' : 'PM'}`;
}
