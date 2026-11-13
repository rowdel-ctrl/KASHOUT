import { describe, expect, it } from 'vitest';
import { inboxDate, inboxTitle } from '../src/lib/inbox';

describe('GCash Inbox picture words', () => {
  it('picks the title from the message', () => {
    expect(inboxTitle('You have received PHP 250.00 from AN*A R. +639171234567 w/ MSG: . Ref. No. 0047123456789.')).toBe('Express Send Notification');
    expect(inboxTitle('You have received 100.00 of GCash from MariBank with account ending in 1234.')).toBe('GCash Funds Received');
    expect(inboxTitle('Your cash in is posted.')).toBe('GCash Notification');
  });
  it('writes the date like the Inbox', () => {
    expect(inboxDate(new Date(2026, 9, 26, 17, 39).getTime())).toBe('October 26, 2026 05:39 PM');
    expect(inboxDate(new Date(2026, 10, 3, 0, 5).getTime())).toBe('November 3, 2026 12:05 AM');
    expect(inboxDate(new Date(2026, 10, 3, 12, 0).getTime())).toBe('November 3, 2026 12:00 PM');
  });
});
