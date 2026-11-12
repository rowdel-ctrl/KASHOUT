import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { jsPDF } from 'jspdf';
import { isNative } from '../native/platform';
import { dateTime, peso2, shortDate } from './format';
import type { CashRecord } from './types';
import { sourceOf } from './wallets';

function csvCell(v: string | number): string {
  const s = String(v);
  if (/^="[\d+●•*xX -]*"$/.test(s)) return s; // text-forcing cell, must stay unquoted
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Excel opens this directly. The reference is written as ="..." so Excel keeps all 13 digits. */
export function toCsv(records: CashRecord[]): string {
  const head = ['Saved', 'Reference', 'Amount', 'Charge', 'From', 'Name', 'Number', 'Receipt date', 'Saved by', 'Status', 'Paid by', 'Paid at'];
  const rows = records.map((r) => [
    dateTime(r.savedAt),
    `="${r.ref}"`,
    r.amount.toFixed(2),
    r.fee.toFixed(2),
    sourceOf(r),
    r.name,
    r.number ? `="${r.number.replace(/"/g, '')}"` : '',
    r.txAt ? dateTime(r.txAt) : '',
    r.by,
    r.status === 'pending' ? 'Pending' : 'Paid',
    r.paidBy ?? '',
    r.paidAt ? dateTime(r.paidAt) : '',
  ]);
  return '﻿' + [head, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

export function buildPdf(records: CashRecord[], title: string): jsPDF {
  // Landscape, so a long bank reference fits on one line.
  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'landscape' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 36;
  const paid = records.filter((r) => r.status !== 'pending');
  const total = paid.reduce((s, r) => s + r.amount, 0);
  const fees = paid.reduce((s, r) => s + r.fee, 0);
  const waiting = records.length - paid.length;
  const widths: [string, number][] = [['Saved', 100], ['Reference', 170], ['Amount', 66], ['Charge', 48], ['From', 64], ['Name', 108], ['Number', 84], ['By', 50], ['Status', 52]];
  let x = M;
  const cols = widths.map(([h, w]) => {
    const c = { h, x, w };
    x += w;
    return c;
  });
  let y = M;
  const header = () => {
    doc.setFont('helvetica', 'bold').setFontSize(9);
    cols.forEach((c) => doc.text(c.h, c.x, y));
    y += 6;
    doc.line(M, y, W - M, y);
    y += 12;
    doc.setFont('helvetica', 'normal');
  };

  doc.setFont('helvetica', 'bold').setFontSize(16).text(title, M, y);
  y += 20;
  doc.setFont('helvetica', 'normal').setFontSize(10);
  doc.text(`${paid.length} paid   ${waiting} pending   Given out: ${peso2(total).replace('₱', 'PHP ')}   Charge: ${peso2(fees).replace('₱', 'PHP ')}`, M, y);
  y += 22;
  header();
  doc.setFontSize(9);
  for (const r of records) {
    if (y > H - M) {
      doc.addPage();
      y = M;
      header();
      doc.setFontSize(9);
    }
    const cells = [dateTime(r.savedAt), r.ref, r.amount.toFixed(2), r.fee.toFixed(2), sourceOf(r), r.name, r.number, r.by, r.status === 'pending' ? 'Pending' : 'Paid'];
    cells.forEach((t, i) => doc.text(doc.splitTextToSize(t, cols[i].w - 4)[0] ?? '', cols[i].x, y));
    y += 14;
  }
  return doc;
}

/** Saves a file and opens the phone's share sheet (WhatsApp, Drive, email, ...). */
async function deliver(filename: string, mime: string, base64: string, plainText?: string): Promise<void> {
  if (!isNative) {
    const bytes = plainText !== undefined ? new TextEncoder().encode(plainText) : Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    return;
  }
  const file = await Filesystem.writeFile({ path: filename, data: base64, directory: Directory.Cache });
  await Share.share({ title: filename, files: [file.uri] });
}

function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin);
}

export function exportName(scope: string, ext: string): string {
  return `cashouts-${scope}-${new Date().toISOString().slice(0, 10)}.${ext}`;
}

export async function shareCsv(records: CashRecord[], scope: string): Promise<void> {
  const csv = toCsv(records);
  await deliver(exportName(scope, 'csv'), 'text/csv', toBase64(csv), csv);
}

export async function sharePdf(records: CashRecord[], scope: string, title: string): Promise<void> {
  const doc = buildPdf(records, title);
  const base64 = doc.output('datauristring').split(',')[1];
  await deliver(exportName(scope, 'pdf'), 'application/pdf', base64);
}

export { shortDate };
