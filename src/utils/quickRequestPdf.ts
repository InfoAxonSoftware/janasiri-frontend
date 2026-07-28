import { formatDate } from './formatters';
import type { QuickRequestDto } from '../services/api/quickRequestApi';
import { downloadPrivateFile } from './fileAccess';

/**
 * Downloads a file served by one of the backend's authenticated private-file endpoints
 * (payment evidence, quick-request images, KYC documents). `src` may be a full URL or a bare
 * "/api/..." path — either way only the API path onward is kept and fetched with the app's
 * Bearer token (see utils/fileAccess.ts); these are never plain, unauthenticated downloads.
 */
export async function downloadImage(src: string, filename: string) {
  let pathPart: string;
  try {
    pathPart = new URL(src).pathname; // e.g. /api/rep-payments/{id}/evidence
  } catch {
    pathPart = src.startsWith('/') ? src : `/${src}`;
  }

  await downloadPrivateFile(pathPart, filename);
}

export async function downloadQuickRequestPdf(req: QuickRequestDto) {
  const { jsPDF } = await import('jspdf');
  const autoTableModule = await import('jspdf-autotable');
  const autoTable = autoTableModule.default || (autoTableModule as any);

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const DARK: [number, number, number] = [0, 0, 0];
  const title = req.type === 'Order' ? 'QUICK ORDER' : 'QUICK QUOTATION';

  // ── Header ────────────────────────────────────────────────────────────────
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...DARK);
  doc.text('JANASIRI DISTRIBUTORS (PVT) LTD', 14, 16);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('Reg Address: No 205 Wattarantenna Passage, Kandy.', 14, 21);
  doc.text('TP: 0814 950206 / Hotline: 0777 675322', 14, 25);
  doc.text('Email: janasiridistributors@yahoo.com / Vat 114608394-7000', 14, 29);
  doc.text('Bank AC: Sampath Bank PLC / Kandy Super Grade Branch / AC: 0007 1002 3131', 14, 33);

  // ── Title box ─────────────────────────────────────────────────────────────
  const gridX = 135;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(title, gridX + 15, 15, { align: 'center' });

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.2);

  // Date row
  doc.rect(gridX, 17, 25, 6);
  doc.text('Date', gridX + 2, 21);
  doc.rect(gridX + 25, 17, 36, 6);
  doc.text(formatDate(req.createdAt), gridX + 27, 21);

  // Request No row
  doc.rect(gridX, 23, 25, 6);
  doc.text('Request No', gridX + 2, 27);
  doc.rect(gridX + 25, 23, 36, 6);
  doc.text(req.requestNumber, gridX + 27, 27);

  // Status row
  doc.rect(gridX, 29, 25, 6);
  doc.text('Status', gridX + 2, 33);
  doc.rect(gridX + 25, 29, 36, 6);
  doc.text(req.status, gridX + 27, 33);

  // Horizontal rule
  doc.setLineWidth(0.5);
  doc.line(14, 37, pageWidth - 14, 37);

  // ── Info table ────────────────────────────────────────────────────────────
  autoTable(doc, {
    startY: 40,
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: 2 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 40 } },
    body: [
      ['Customer', req.customerName],
      ['Sales Rep', req.repName || '—'],
      ['Type', req.type],
    ],
  });

  // ── Details ───────────────────────────────────────────────────────────────
  const afterInfo = (doc as any).lastAutoTable.finalY + 6;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Order / Quotation Details:', 14, afterInfo);
  doc.setFont('helvetica', 'normal');

  const detailLines = doc.splitTextToSize(req.details, pageWidth - 28);
  doc.text(detailLines, 14, afterInfo + 6);

  const afterDetails = afterInfo + 6 + detailLines.length * 5;

  // ── Admin notes ───────────────────────────────────────────────────────────
  if (req.adminNotes) {
    doc.setFont('helvetica', 'bold');
    doc.text('Admin Notes:', 14, afterDetails + 6);
    doc.setFont('helvetica', 'normal');
    const noteLines = doc.splitTextToSize(req.adminNotes, pageWidth - 28);
    doc.text(noteLines, 14, afterDetails + 12);
  }

  // ── Footer ────────────────────────────────────────────────────────────────
  const pageH = doc.internal.pageSize.getHeight();
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.3);
  doc.line(14, pageH - 15, pageWidth - 14, pageH - 15);
  doc.setFontSize(7);
  doc.setTextColor(120, 120, 120);
  doc.text('JANASIRI DISTRIBUTORS (PVT) LTD — Confidential', 14, pageH - 10);
  doc.text(`Printed: ${new Date().toLocaleString()}`, pageWidth - 14, pageH - 10, { align: 'right' });

  doc.save(`${req.requestNumber}.pdf`);
}

export async function downloadQuickRequestExcel(req: QuickRequestDto) {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  const title = req.type === 'Order' ? 'QUICK ORDER REQUEST' : 'QUICK QUOTATION REQUEST';
  const rows: any[][] = [
    [title],
    [],
    ['Request #', req.requestNumber, 'Date', formatDate(req.createdAt)],
    ['Customer', req.customerName, 'Status', req.status],
    ['Sales Rep', req.repName || '—'],
    ['Type', req.type],
    [],
    ['Request Details'],
    [req.details || '—'],
  ];
  if (req.adminNotes) {
    rows.push([], ['Admin Notes'], [req.adminNotes]);
  }
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 20 }, { wch: 40 }, { wch: 20 }, { wch: 40 }];
  const safeName = req.requestNumber.replace(/[:/\\?*[\]]/g, '-').substring(0, 31);
  XLSX.utils.book_append_sheet(wb, ws, safeName);
  XLSX.writeFile(wb, `${req.requestNumber}.xlsx`);
}
