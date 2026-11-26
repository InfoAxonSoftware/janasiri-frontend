import { formatDate } from './formatters';
import type { QuickRequestDto } from '../services/api/quickRequestApi';
import { downloadPrivateFile } from './fileAccess';
import { parseGuestQuickOrderDetails } from './guestQuickOrderDetails';

export async function downloadImage(src: string, filename: string) {
  let pathPart: string;
  try {
    pathPart = new URL(src).pathname;
  } catch {
    pathPart = src.startsWith('/') ? src : '/' + src;
  }
  await downloadPrivateFile(pathPart, filename);
}

export async function downloadQuickRequestPdf(req: QuickRequestDto) {
  const { jsPDF } = await import('jspdf');
  const autoTableModule = await import('jspdf-autotable');
  const autoTable = autoTableModule.default || (autoTableModule as any);
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - 28;
  const dark: [number, number, number] = [34, 42, 35];
  const light: [number, number, number] = [247, 247, 242];
  const grid: [number, number, number] = [222, 224, 216];
  const title = req.type === 'Order' ? 'QUICK ORDER' : 'QUICK QUOTATION';
  const isGuestOrder =
    req.type === 'Order' &&
    (req.createdBy || '').trim().toLowerCase() === 'quick order portal';

  const commonStyles = {
    font: 'helvetica' as const,
    fontSize: 8,
    cellPadding: 2.6,
    overflow: 'linebreak' as const,
    valign: 'middle' as const,
    lineColor: grid,
    lineWidth: 0.15,
    textColor: dark,
  };

  // Company header
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...dark);
  doc.text('JANASIRI DISTRIBUTORS (PVT) LTD', 14, 16);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('Reg Address: No 205 Wattarantenna Passage, Kandy.', 14, 21);
  doc.text('TP: 0814 950206 / Hotline: 0777 675322', 14, 25);
  doc.text('Email: janasiridistributors@yahoo.com / Vat 114608394-7000', 14, 29);
  doc.text('Bank AC: Sampath Bank PLC / Kandy Super Grade Branch / AC: 0007 1002 3131', 14, 33);

  // Request summary box
  const gridX = 135;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(title, gridX + 30.5, 15, { align: 'center' });
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setDrawColor(...dark);
  doc.setLineWidth(0.2);
  [
    ['Date', formatDate(req.createdAt)],
    ['Request No', req.requestNumber],
    ['Status', req.status],
  ].forEach(([label, value], index) => {
    const y = 17 + index * 6;
    doc.rect(gridX, y, 25, 6);
    doc.text(label, gridX + 2, y + 4);
    doc.rect(gridX + 25, y, 36, 6);
    doc.text(String(value || '—'), gridX + 27, y + 4);
  });
  doc.setLineWidth(0.5);
  doc.line(14, 37, pageWidth - 14, 37);

  // Customer summary table
  autoTable(doc, {
    startY: 40,
    theme: 'grid',
    styles: commonStyles,
    columnStyles: {
      0: { cellWidth: 40, fontStyle: 'bold', fillColor: light },
      1: { cellWidth: contentWidth - 40 },
    },
    body: [
      ['Customer', req.customerName || '—'],
      ['Sales Rep', req.repName || '—'],
      ['Type', req.type || '—'],
    ],
    margin: { left: 14, right: 14 },
  });

  let cursorY = (doc as any).lastAutoTable.finalY + 5;

  if (isGuestOrder) {
    const guest = parseGuestQuickOrderDetails(req.details || '');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('Guest Order Details', 14, cursorY);
    autoTable(doc, {
      startY: cursorY + 2,
      theme: 'grid',
      styles: commonStyles,
      headStyles: { fillColor: dark, textColor: [255, 255, 255], fontStyle: 'bold' },
      head: [['Contact Person', 'Contact Number', 'Submitted Via']],
      body: [[
        guest.contactPerson || '—',
        guest.contactNumber || '—',
        guest.submittedVia || 'Guest Order Form',
      ]],
      columnStyles: {
        0: { cellWidth: 52 },
        1: { cellWidth: 52 },
        2: { cellWidth: contentWidth - 104 },
      },
      margin: { left: 14, right: 14 },
    });

    cursorY = (doc as any).lastAutoTable.finalY + 5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('Order Items', 14, cursorY);
    const itemRows = guest.items.length
      ? guest.items.map((item, index) => [
          String(index + 1),
          item.description || '—',
          item.size || '—',
          item.brand || '—',
          item.quantity.toLocaleString(),
        ])
      : [['—', 'No item details available', '—', '—', '—']];

    autoTable(doc, {
      startY: cursorY + 2,
      theme: 'grid',
      styles: commonStyles,
      headStyles: { fillColor: dark, textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: light },
      head: [['S/N', 'Item Description', 'Size', 'Brand', 'Qty']],
      body: itemRows,
      columnStyles: {
        0: { cellWidth: 12, halign: 'center' },
        1: { cellWidth: 65 },
        2: { cellWidth: 24 },
        3: { cellWidth: 42 },
        4: { cellWidth: contentWidth - 143, halign: 'right' },
      },
      margin: { left: 14, right: 14 },
      showHead: 'everyPage',
    });
    cursorY = (doc as any).lastAutoTable.finalY + 5;
  } else {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('Order / Quotation Details', 14, cursorY);
    autoTable(doc, {
      startY: cursorY + 2,
      theme: 'grid',
      styles: { ...commonStyles, cellPadding: 3.2 },
      body: [[req.details || '—']],
      columnStyles: { 0: { cellWidth: contentWidth } },
      margin: { left: 14, right: 14 },
    });
    cursorY = (doc as any).lastAutoTable.finalY + 5;
  }

  if (req.adminNotes?.trim()) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('Admin Notes', 14, cursorY);
    autoTable(doc, {
      startY: cursorY + 2,
      theme: 'grid',
      styles: { ...commonStyles, cellPadding: 3.2 },
      body: [[req.adminNotes.trim()]],
      columnStyles: { 0: { cellWidth: contentWidth } },
      margin: { left: 14, right: 14 },
    });
  }

  // Footer on every page
  const printedAt = new Date().toLocaleString();
  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.3);
    doc.line(14, pageHeight - 15, pageWidth - 14, pageHeight - 15);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(120, 120, 120);
    doc.text('JANASIRI DISTRIBUTORS (PVT) LTD — Confidential', 14, pageHeight - 10);
    doc.text('Printed: ' + printedAt, pageWidth - 14, pageHeight - 10, { align: 'right' });
  }

  doc.save(req.requestNumber + '.pdf');
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
  if (req.adminNotes) rows.push([], ['Admin Notes'], [req.adminNotes]);
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 20 }, { wch: 40 }, { wch: 20 }, { wch: 40 }];
  const safeName = req.requestNumber.replace(/[:/\\?*[\]]/g, '-').substring(0, 31);
  XLSX.utils.book_append_sheet(wb, ws, safeName);
  XLSX.writeFile(wb, req.requestNumber + '.xlsx');
}
