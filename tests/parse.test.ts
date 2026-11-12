import { describe, expect, it } from 'vitest';
import { extractRef, parseReceipt } from '../src/lib/parse';

// All numbers and names below are made up.

const EXPRESS = `You have received PHP 300.00 from EX*****S L.
+639171234501 w/ MSG: . Your new balance is PHP 324.63. Ref.
No. 6046809238177.`;

const BANK = `Your Bank Transfer Status
You have sent P310.00 of GCash on 2026-Nov-03 01:01:25 PM to MariBank account ending in 3562.
with GCash Ref. No. 9046837792836 & InstaPay Trace No.
000000005320517.`;

const DETAILS = `Transaction Details
Transfer from 09171234501 to 09181234502
Amount +300.00
Date & Time Nov 2, 2026 4:39 PM
Reference Number 6046809238177`;

const DETAILS_BANK = `Received GCash from MariBank with account ending in 5034 and invno:20261028123456789
Amount +1,000.00
Date & Time Oct 28, 2026 9:05 AM
Reference Number
0046809244410`;

const PHOTO = `Sent via GCash
MA***A R.
+63 9●●●●●●4822
Amount 3,500.00
Total Amount Sent ₱3,500.00
Ref No. 9047 022 665601
Nov 08, 2026 1:23 PM`;

describe('parseReceipt', () => {
  it('reads the inbox Express Send message', () => {
    const r = parseReceipt(EXPRESS);
    expect(r.ref).toBe('6046809238177');
    expect(r.refOk).toBe(true);
    expect(r.amount).toBe(300);
    expect(r.name).toBe('EX*****S L.');
    expect(r.number).toBe('09171234501');
  });

  it('reads the Bank Transfer message and ignores the Trace No.', () => {
    const r = parseReceipt(BANK);
    expect(r.ref).toBe('9046837792836');
    expect(r.amount).toBe(310);
    expect(r.txAt).toBe(new Date(2026, 10, 3, 13, 1).getTime());
  });

  it('reads the Transaction Details screen', () => {
    const r = parseReceipt(DETAILS);
    expect(r.ref).toBe('6046809238177');
    expect(r.amount).toBe(300);
    expect(r.txAt).toBe(new Date(2026, 10, 2, 16, 39).getTime());
  });

  it('ignores the invno and keeps a leading zero', () => {
    const r = parseReceipt(DETAILS_BANK);
    expect(r.ref).toBe('0046809244410');
    expect(r.amount).toBe(1000);
    expect(r.txAt).toBe(new Date(2026, 9, 28, 9, 5).getTime());
  });

  it('reads a photo of another phone with a spaced reference', () => {
    const r = parseReceipt(PHOTO);
    expect(r.ref).toBe('9047022665601');
    expect(r.amount).toBe(3500);
    expect(r.name).toBe('MA***A R.');
    expect(r.number).toBe('+63 9●●●●●●4822');
    expect(r.txAt).toBe(new Date(2026, 10, 8, 13, 23).getTime());
  });

  it('prefers the plain Amount row when the peso sign is misread', () => {
    const r = parseReceipt('Amount 3,500.00\nTotal Amount Sent F3,500.00\nRef No. 9047 022 665601');
    expect(r.amount).toBe(3500);
  });
});

describe('extractRef', () => {
  it('fixes O and l mix-ups', () => {
    expect(extractRef('Ref No. 9O47 O22 665601').ref).toBe('9047022665601');
    expect(extractRef('Ref No. 9l47O22665601').ref).toBe('9147022665601');
  });

  it('does not swallow a time that follows the number', () => {
    expect(extractRef('Ref No. 9047 022 665601 1:23 PM').ref).toBe('9047022665601');
  });

  it('falls back to a standalone 13-digit number', () => {
    expect(extractRef('something\n9047022665601\nother').ref).toBe('9047022665601');
  });

  it('never returns the trace number', () => {
    const r = extractRef('Trace No. 1234567890123');
    expect(r.ok).toBe(false);
  });

  it('flags a reference that is not 13 digits', () => {
    const r = extractRef('Ref No. 9047 022 6656');
    expect(r.ok).toBe(false);
    expect(r.ref).toBe('90470226656');
  });

  it('returns nothing when there is no reference', () => {
    expect(extractRef('hello world')).toEqual({ ref: '', ok: false });
  });
});

describe('names and numbers in other layouts', () => {
  it('masked number with asterisks and spaces', () => {
    const r = parseReceipt('Express Send\nJU***N D.\n+63 917 *** 4501\nAmount 300.00\nRef No. 6046809238177');
    expect(r.number).toBe('+63 917 *** 4501');
    expect(r.name).toBe('JU***N D.');
  });

  it('number with the dots read as the letter O', () => {
    const r = parseReceipt('MA***A R.\n+63 9OOOOOO4822\nAmount 3,500.00');
    expect(r.number).toBe('+63 9●●●●●●4822');
    expect(r.name).toBe('MA***A R.');
  });

  it('number written 09XX XXX 4822', () => {
    const r = parseReceipt('LU**Y T.\n09XX XXX 4822');
    expect(r.number).toBe('09XX XXX 4822');
    expect(r.name).toBe('LU**Y T.');
  });

  it('name and number on the same line', () => {
    const r = parseReceipt('Received from EX*****S L. +639171234501 Amount 300.00');
    expect(r.name).toBe('EX*****S L.');
    expect(r.number).toBe('09171234501');
  });

  it('name below the number', () => {
    const r = parseReceipt('Sent via GCash\n09171234501\nJOSE D.\nAmount 300.00');
    expect(r.number).toBe('09171234501');
    expect(r.name).toBe('JOSE D.');
  });

  it('name wrapped across two lines before the number', () => {
    const r = parseReceipt('You have received PHP 500.00 from MARIA CLARA\nS. +639171234501 w/ MSG: .');
    expect(r.name).toBe('MARIA CLARA S.');
    expect(r.number).toBe('09171234501');
  });

  it('name from "from" when the number is unreadable', () => {
    const r = parseReceipt('You have received PHP 500.00 from JUAN D. w/ MSG: . Your new balance is PHP 524.63.');
    expect(r.name).toBe('JUAN D.');
    expect(r.number).toBe('');
  });

  it('does not use a bank name or label as the customer name', () => {
    const r = parseReceipt('Received GCash from MariBank with account ending in 5034\nAmount +1,000.00');
    expect(r.name).toBe('');
  });

  it('does not use the phrase "Sent via GCash" as a name', () => {
    const r = parseReceipt('Sent via GCash\n+639171234501\nAmount 300.00');
    expect(r.name).toBe('');
    expect(r.number).toBe('09171234501');
  });
});

describe('dates printed as Today or Yesterday', () => {
  const now = new Date(2026, 10, 12, 12, 40).getTime(); // Nov 12, 2026 12:40 PM
  const INBOX = `12:40 PM\nInbox\nToday, 12:16 PM\nExpress Send Notification\nYou have received PHP 3000.00 from\nAN***S J** L. +639615460508 w/ MSG: .\nYour new balance is PHP 20140.48. Ref.\nNo. 6047167885112.`;

  it('reads "Today, 12:16 PM" as today at that time, and ignores the phone clock', () => {
    const r = parseReceipt(INBOX, now);
    expect(r.txAt).toBe(new Date(2026, 10, 12, 12, 16).getTime());
    expect(r.ref).toBe('6047167885112');
    expect(r.amount).toBe(3000);
  });
  it('reads Yesterday', () => {
    expect(parseReceipt('Yesterday, 9:05 AM\nAmount 500.00', now).txAt).toBe(new Date(2026, 10, 11, 9, 5).getTime());
  });
  it('copes with OCR spacing and punctuation', () => {
    expect(parseReceipt('Today,12:16PM', now).txAt).toBe(new Date(2026, 10, 12, 12, 16).getTime());
    expect(parseReceipt('TODAY 12.16 pm', now).txAt).toBe(new Date(2026, 10, 12, 12, 16).getTime());
  });
  it('a lone time (like the phone clock) is not a receipt date', () => {
    expect(parseReceipt('12:40 PM\nInbox', now).txAt).toBeNull();
  });
  it('a full date still wins when there is no Today', () => {
    expect(parseReceipt('Nov 08, 2026 1:23 PM', now).txAt).toBe(new Date(2026, 10, 8, 13, 23).getTime());
  });
});

describe('GCash inbox message shared as text', () => {
  // Made-up values. The Share button sends only the message, not the date shown above it.
  const SHARED = 'You have received PHP 162.00 from JH*N DR*Y S. +639154721724 w/ MSG: . Your new balance is PHP 417.63. Ref. No. 0046554610929.';
  it('reads the amount, name, number and reference', () => {
    const r = parseReceipt(SHARED);
    expect(r.amount).toBe(162);
    expect(r.name).toBe('JH*N DR*Y S.');
    expect(r.number).toBe('09154721724');
    expect(r.ref).toBe('0046554610929');
    expect(r.refOk).toBe(true);
    expect(r.txAt).toBeNull();
  });
  it('reads a long month name with a leading zero in the hour', () => {
    expect(parseReceipt('October 26, 2026 05:39 PM\n' + SHARED).txAt).toBe(new Date(2026, 9, 26, 17, 39).getTime());
  });
});
