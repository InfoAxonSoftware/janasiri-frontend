// @ts-nocheck
import { formatCurrency } from './formatters';
import type {
  TargetReportDetail,
  TargetReportSourceRow,
} from '../services/api/targetReportsApi';

type PdfReportRow = {
  txnDate: string | null;
  refNo: string;
  customerName: string;
  itemDescription: string;
  qty: number;
  discount: number;
  salesWithTax: number;
  sortOrder: number;
};

const numberValue = (value: unknown) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const fmt = (value: unknown) =>
  numberValue(value).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const cleanText = (value: unknown) =>
  String(value ?? '')
    .replace(/\r?\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const fmtDate = (value: string | null | undefined) => {
  if (!value) return '';

  // Keep date-only values stable without UTC/local timezone shifting.
  const dateOnlyMatch = String(value).match(
    /^(\d{4})-(\d{2})-(\d{2})/,
  );

  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    const date = new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
    );

    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return cleanText(value);
  }

  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const normalizeRowKind = (row: any) => {
  const kind = String(
    row?.rowType || row?.txnType || '',
  )
    .replace(/\s+/g, '')
    .toLowerCase();

  if (kind.includes('grandtotal')) return 'grandtotal';

  if (
    kind === 'totallabel' ||
    kind === 'total'
  ) {
    return 'totallabel';
  }

  if (
    kind.includes('dailytotal') ||
    kind.includes('subtotal')
  ) {
    return 'dailytotal';
  }

  return 'invoice';
};

const getReportRows = (
  report: TargetReportDetail,
): PdfReportRow[] => {
  const sourceRows =
    (report as TargetReportDetail & {
      sourceRows?: TargetReportSourceRow[];
    }).sourceRows || [];

  const sourceInvoiceRows = sourceRows
    .filter(
      (row) => normalizeRowKind(row) === 'invoice',
    )
    .map(
      (row, index): PdfReportRow => ({
        txnDate: row.txnDate || null,
        refNo: cleanText(row.refNo),
        customerName: cleanText(row.customerName),
        itemDescription: cleanText(
          row.itemDescription,
        ),
        qty: numberValue(row.qty),
        discount: numberValue(row.discount),
        salesWithTax: numberValue(
          row.salesWithTax,
        ),
        sortOrder: numberValue(
          row.sortOrder ?? index,
        ),
      }),
    );

  if (sourceInvoiceRows.length > 0) {
    return sourceInvoiceRows.sort(
      (first, second) =>
        first.sortOrder - second.sortOrder,
    );
  }

  return (report.entries || [])
    .map(
      (entry, index): PdfReportRow => ({
        txnDate: entry.txnDate || null,
        refNo: cleanText(entry.refNo),
        customerName: cleanText(
          entry.customerName,
        ),
        itemDescription: cleanText(
          entry.itemDescription,
        ),
        qty: numberValue(entry.qty),
        discount: numberValue(entry.discount),
        salesWithTax: numberValue(
          entry.salesWithTax,
        ),
        sortOrder: numberValue(
          entry.sortOrder ?? index,
        ),
      }),
    )
    .sort(
      (first, second) =>
        first.sortOrder - second.sortOrder,
    );
};

const getReportTotals = (
  report: TargetReportDetail,
  rows: PdfReportRow[],
) => {
  const sourceRows =
    (report as TargetReportDetail & {
      sourceRows?: TargetReportSourceRow[];
    }).sourceRows || [];

  const savedGrandTotal = sourceRows.find(
    (row) =>
      normalizeRowKind(row) === 'grandtotal',
  );

  const calculated = rows.reduce(
    (totals, row) => ({
      qty: totals.qty + numberValue(row.qty),
      discount:
        totals.discount +
        numberValue(row.discount),
      salesWithTax:
        totals.salesWithTax +
        numberValue(row.salesWithTax),
    }),
    {
      qty: 0,
      discount: 0,
      salesWithTax: 0,
    },
  );

  return {
    qty:
      savedGrandTotal?.qty !== null &&
      savedGrandTotal?.qty !== undefined
        ? numberValue(savedGrandTotal.qty)
        : calculated.qty,

    discount:
      savedGrandTotal?.discount !== null &&
      savedGrandTotal?.discount !== undefined
        ? numberValue(
            savedGrandTotal.discount,
          )
        : calculated.discount,

    salesWithTax:
      savedGrandTotal?.salesWithTax !== null &&
      savedGrandTotal?.salesWithTax !==
        undefined
        ? numberValue(
            savedGrandTotal.salesWithTax,
          )
        : numberValue(report.actualSales) ||
          calculated.salesWithTax,
  };
};

const safeFilePart = (value: string) =>
  cleanText(value)
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_');

export async function exportTargetReportPdf(
  report: TargetReportDetail,
) {
  const { jsPDF } = await import('jspdf');
  const autoTable = (
    await import('jspdf-autotable')
  ).default;

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  const rows = getReportRows(report);
  const totals = getReportTotals(report, rows);

  const pageWidth =
    doc.internal.pageSize.getWidth();
  const pageHeight =
    doc.internal.pageSize.getHeight();

  const margin = {
    left: 8,
    right: 8,
    top: 14,
    bottom: 11,
  };

  const repName = cleanText(report.repName);
  const uppercaseRepName =
    repName.toUpperCase();

  const targetPeriod =
    `${fmtDate(report.targetStartDate)} - ` +
    `${fmtDate(report.targetEndDate)}`;

  const reportPeriod =
    `${fmtDate(report.fromDate)} - ` +
    `${fmtDate(report.asAtDate)}`;

  // First-page report header.
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(
    'JANASIRI DISTRIBUTORS (PVT) LTD',
    margin.left,
    10,
  );

  doc.setFontSize(10.5);
  doc.text(
    `DETAILED SALES REPORT / ${uppercaseRepName}`,
    margin.left,
    16,
  );

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);

  doc.text(
    `TARGET PERIOD: ${targetPeriod}`,
    margin.left,
    22,
  );

  doc.text(
    `REPORT PERIOD: ${reportPeriod}`,
    pageWidth / 2,
    22,
  );

  doc.setFont('helvetica', 'bold');

  doc.text(
    `TARGET: ${formatCurrency(
      report.targetAmount,
    )}`,
    margin.left,
    27.5,
  );

  doc.setTextColor(4, 120, 87);
  doc.text(
    `ACTUAL SALES: ${formatCurrency(
      report.actualSales,
    )}`,
    pageWidth / 2,
    27.5,
  );

  doc.setTextColor(15, 23, 42);

  const tableHead = [
    [
      'Date',
      'Ref No',
      'Customer',
      'Item / Description',
      'Qty',
      'Discount',
      'Sales With Tax',
    ],
  ];

  const tableBody: any[] = rows.map(
    (row) => [
      {
        content: fmtDate(row.txnDate),
        styles: {
          halign: 'left',
          overflow: 'hidden',
        },
      },
      cleanText(row.refNo),
      cleanText(row.customerName),
      cleanText(row.itemDescription),
      {
        content: fmt(row.qty),
        styles: {
          halign: 'right',
        },
      },
      {
        // Always display the value, including 0.00.
        content: fmt(row.discount),
        styles: {
          halign: 'right',
          textColor:
            row.discount < 0
              ? [190, 24, 93]
              : [51, 65, 85],
        },
      },
      {
        content: fmt(row.salesWithTax),
        styles: {
          halign: 'right',
          fontStyle: 'bold',
        },
      },
    ],
  );

  tableBody.push([
    {
      content: 'TOTAL',
      colSpan: 4,
      styles: {
        halign: 'right',
        fontStyle: 'bold',
        fillColor: [226, 232, 240],
        textColor: [15, 23, 42],
      },
    },
    {
      content: fmt(totals.qty),
      styles: {
        halign: 'right',
        fontStyle: 'bold',
        fillColor: [226, 232, 240],
        textColor: [15, 23, 42],
      },
    },
    {
      content: fmt(totals.discount),
      styles: {
        halign: 'right',
        fontStyle: 'bold',
        fillColor: [226, 232, 240],
        textColor:
          totals.discount < 0
            ? [190, 24, 93]
            : [15, 23, 42],
      },
    },
    {
      content: fmt(totals.salesWithTax),
      styles: {
        halign: 'right',
        fontStyle: 'bold',
        fillColor: [226, 232, 240],
        textColor: [4, 120, 87],
      },
    },
  ]);

  autoTable(doc, {
    head: tableHead,
    body: tableBody,

    startY: 32,
    theme: 'grid',
    showHead: 'everyPage',
    pageBreak: 'auto',
    rowPageBreak: 'avoid',

    margin,

    styles: {
      font: 'helvetica',
      fontSize: 7.2,
      textColor: [51, 65, 85],
      lineColor: [226, 232, 240],
      lineWidth: 0.12,
      cellPadding: {
        top: 1.5,
        right: 1.4,
        bottom: 1.5,
        left: 1.4,
      },
      overflow: 'linebreak',
      valign: 'middle',
      minCellHeight: 6.2,
    },

    headStyles: {
      fillColor: [255, 196, 0],
      textColor: [15, 23, 42],
      fontStyle: 'bold',
      fontSize: 7.4,
      halign: 'left',
      valign: 'middle',
      minCellHeight: 7.5,
      lineColor: [255, 196, 0],
    },

    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },

    // Landscape A4 usable width:
    // 297mm - 16mm margins = 281mm.
    columnStyles: {
      0: {
        cellWidth: 21,
        overflow: 'hidden',
      },
      1: {
        cellWidth: 23,
        overflow: 'hidden',
      },
      2: {
        cellWidth: 76,
      },
      3: {
        cellWidth: 82,
      },
      4: {
        cellWidth: 18,
        halign: 'right',
      },
      5: {
        cellWidth: 25,
        halign: 'right',
      },
      6: {
        cellWidth: 28,
        halign: 'right',
      },
    },

    didParseCell: (data: any) => {
      if (data.section === 'head') {
        if ([4, 5, 6].includes(data.column.index)) {
          data.cell.styles.halign = 'right';
        }

        return;
      }

      // Keep date and reference values on one line.
      if (
        data.section === 'body' &&
        [0, 1].includes(data.column.index)
      ) {
        data.cell.styles.overflow = 'hidden';
      }

      if (
        data.section === 'body' &&
        [4, 5, 6].includes(data.column.index)
      ) {
        data.cell.styles.halign = 'right';
      }
    },

    didDrawPage: (data: any) => {
      const currentPage =
        doc.getCurrentPageInfo().pageNumber;
      const totalPages =
        doc.getNumberOfPages();

      // Compact continuation heading above pages 2+.
      if (currentPage > 1) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(71, 85, 105);
        doc.text(
          `DETAILED SALES REPORT / ${uppercaseRepName}`,
          margin.left,
          8,
        );
      }

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);

      doc.text(
        `Page ${currentPage} of ${totalPages}`,
        pageWidth - margin.right,
        pageHeight - 5,
        {
          align: 'right',
        },
      );

      if (report.originalFileName) {
        doc.text(
          `Source: ${cleanText(
            report.originalFileName,
          )}`,
          margin.left,
          pageHeight - 5,
        );
      }

      // Restore the table text color after footer drawing.
      doc.setTextColor(51, 65, 85);
    },
  });

  const fileDate =
    fmtDate(report.asAtDate)
      .replace(/\s+/g, '_') ||
    'Report';

  doc.save(
    `SalesReport_${safeFilePart(
      repName || 'Sales_Rep',
    )}_${fileDate}.pdf`,
  );
}