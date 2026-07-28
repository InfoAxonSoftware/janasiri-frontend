import type {
  PagedResult,
  RepPaymentDto,
  RepPaymentQueryParams,
} from '../services/api/repPaymentsApi';
import { formatDateTime } from './formatters';

const EXPORT_PAGE_SIZE = 500;

type PageFetcher = (
  params: RepPaymentQueryParams,
) => Promise<PagedResult<RepPaymentDto>>;

export async function fetchAllPaymentReports(
  fetchPage: PageFetcher,
  params: RepPaymentQueryParams,
): Promise<RepPaymentDto[]> {
  const firstPage = await fetchPage({
    ...params,
    page: 1,
    pageSize: EXPORT_PAGE_SIZE,
  });

  const rows = [...(firstPage.items ?? [])];
  const totalPages = Math.max(
    1,
    firstPage.totalPages
      ?? Math.ceil((firstPage.totalCount ?? rows.length) / EXPORT_PAGE_SIZE),
  );

  if (totalPages <= 1) return rows;

  const remainingPages = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, index) =>
      fetchPage({
        ...params,
        page: index + 2,
        pageSize: EXPORT_PAGE_SIZE,
      }),
    ),
  );

  for (const page of remainingPages) {
    rows.push(...(page.items ?? []));
  }

  return rows;
}

export async function downloadPaymentReportsPdf(
  rows: RepPaymentDto[],
  options: {
    title?: string;
    view?: 'active' | 'trash';
    fileName?: string;
    scopeLabel?: string;
  } = {},
) {
  const { jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;

  const title = options.title ?? 'PAYMENT REPORTS';
  const view = options.view === 'trash' ? 'Trash' : 'Active';
  const totalAmount = rows.reduce(
    (sum, payment) => sum + Number(payment.amount || 0),
    0,
  );
  const awaitingCount = rows.filter(
    (payment) => payment.status === 'AwaitingConfirmation',
  ).length;
  const confirmedCount = rows.filter(
    (payment) => payment.status === 'Confirmed',
  ).length;
  const approvedCount = rows.filter(
    (payment) => payment.status === 'Approved',
  ).length;
  const rejectedCount = rows.filter(
    (payment) => payment.status === 'Rejected',
  ).length;

  const formatAmount = (amount: number) =>
    Number(amount || 0).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('JANASIRI DISTRIBUTORS (PVT) LTD', margin, 17);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('Reg Address: No 205 Wattarantenna Passage, Kandy.', margin, 22);
  doc.text('TP: 0814 950206 / Hotline: 0777 675322', margin, 26);
  doc.text(
    'Email: janasiridistributors@yahoo.com / Vat 114608394-7000',
    margin,
    30,
  );
  doc.text(
    'Bank AC: Sampath Bank PLC / Kandy Super Grade Branch / AC: 0007 1002 3131',
    margin,
    34,
  );

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(title, pageWidth - margin, 17, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(
    `Generated: ${formatDateTime(new Date())} | View: ${view} | Records: ${rows.length}`,
    margin,
    43,
  );

  if (options.scopeLabel) {
    doc.text(`Scope: ${options.scopeLabel}`, margin, 47);
  }

  autoTable(doc, {
    startY: options.scopeLabel ? 51 : 48,
    head: [[
      '#',
      'Report #',
      'Submitted Date',
      'Sales Rep',
      'Customer',
      'Reference #',
      'Evidence',
      'Status',
      'Amount (LKR)',
    ]],
    body: rows.map((payment, index) => [
      index + 1,
      payment.reportNumber || '—',
      formatDateTime(payment.createdAt),
      payment.repName || '—',
      payment.customerName || '—',
      payment.referenceNumber || '—',
      payment.hasEvidence ? 'Yes' : 'No',
      payment.status.replace(/([a-z])([A-Z])/g, '$1 $2'),
      formatAmount(payment.amount),
    ]),
    theme: 'grid',
    margin: { left: margin, right: margin, bottom: 18 },
    styles: {
      font: 'helvetica',
      fontSize: 7.5,
      cellPadding: 2.2,
      lineColor: [0, 0, 0],
      lineWidth: 0.15,
      textColor: [0, 0, 0],
      valign: 'middle',
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      halign: 'center',
      lineColor: [0, 0, 0],
      lineWidth: 0.2,
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 9, halign: 'center' },
      1: { cellWidth: 29 },
      2: { cellWidth: 39 },
      3: { cellWidth: 35 },
      4: { cellWidth: 'auto' },
      5: { cellWidth: 24 },
      6: { cellWidth: 17, halign: 'center' },
      7: { cellWidth: 34, halign: 'center' },
      8: { cellWidth: 30, halign: 'right' },
    },
    didParseCell: (data) => {
      if (data.section !== 'body' || data.column.index !== 7) return;
      const status = String(data.cell.raw || '');
      data.cell.styles.fontStyle = 'bold';
      if (status === 'Approved') data.cell.styles.textColor = [4, 120, 87];
      else if (status === 'Confirmed') data.cell.styles.textColor = [29, 78, 216];
      else if (status === 'Rejected') data.cell.styles.textColor = [185, 28, 28];
      else data.cell.styles.textColor = [180, 83, 9];
    },
    didDrawPage: () => {
      doc.setDrawColor(148, 163, 184);
      doc.setLineWidth(0.15);
      doc.line(margin, pageHeight - 11, pageWidth - margin, pageHeight - 11);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(71, 85, 105);
      doc.text(
        'Janasiri Distribution System — Payment Reports',
        margin,
        pageHeight - 7,
      );
      doc.text(
        `Page ${doc.getNumberOfPages()}`,
        pageWidth - margin,
        pageHeight - 7,
        { align: 'right' },
      );
    },
  });

  const finalTableY = (doc as any).lastAutoTable.finalY;
  const summaryRows = [
    ['Awaiting Confirmation', String(awaitingCount)],
    ['Confirmed', String(confirmedCount)],
    ['Approved', String(approvedCount)],
    ['Rejected', String(rejectedCount)],
    ['Total Amount', `LKR ${formatAmount(totalAmount)}`],
  ];
  const summaryWidth = 95;
  const summaryHeight = 6.2 * summaryRows.length;
  let summaryY = finalTableY + 5;

  if (summaryY + summaryHeight > pageHeight - 16) {
    doc.addPage();
    summaryY = 18;
  }

  const summaryX = pageWidth - margin - summaryWidth;
  doc.setTextColor(0, 0, 0);
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.2);
  doc.rect(summaryX, summaryY, summaryWidth, summaryHeight);

  summaryRows.forEach(([label, value], index) => {
    const rowY = summaryY + 6.2 * index;
    if (index > 0) doc.line(summaryX, rowY, summaryX + summaryWidth, rowY);
    doc.line(summaryX + 52, rowY, summaryX + 52, rowY + 6.2);
    const total = label === 'Total Amount';
    doc.setFont('helvetica', total ? 'bold' : 'normal');
    doc.setFontSize(total ? 8.5 : 8);
    doc.text(label, summaryX + 2, rowY + 4.2);
    doc.text(value, summaryX + summaryWidth - 2, rowY + 4.2, {
      align: 'right',
    });
  });

  doc.save(options.fileName ?? 'payment-reports.pdf');
}
