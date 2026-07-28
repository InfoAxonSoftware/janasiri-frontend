import * as XLSX from 'xlsx';
import type {
  TargetReportEntryRequest,
  TargetReportSourceRow,
} from '../services/api/targetReportsApi';

function createUtcCalendarDate(year: number, month: number, day: number): Date | null {
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    year < 1900 ||
    year > 2200 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return null;
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}

function excelSerialToDate(serial: number): Date | null {
  if (!Number.isFinite(serial)) return null;
  const decoded = XLSX.SSF.parse_date_code(serial);
  if (!decoded) return null;
  return createUtcCalendarDate(decoded.y, decoded.m, decoded.d);
}

function parseDateFlexible(value: unknown): Date | null {
  if (typeof value === 'number') {
    return excelSerialToDate(value);
  }

  if (value instanceof Date) {
    return createUtcCalendarDate(
      value.getUTCFullYear(),
      value.getUTCMonth() + 1,
      value.getUTCDate(),
    );
  }

  const text = String(value ?? '').trim();
  if (!text) return null;

  let match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (match) {
    const month = Number(match[1]);
    const day = Number(match[2]);
    let year = Number(match[3]);
    if (year < 100) year = year < 70 ? 2000 + year : 1900 + year;
    return createUtcCalendarDate(year, month, day);
  }

  match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return createUtcCalendarDate(
      Number(match[1]),
      Number(match[2]),
      Number(match[3]),
    );
  }

  return null;
}

function toDateOnlyString(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  let text = String(value)
    .replace(/\u00A0/g, ' ')
    .trim();

  if (!text || text === '-' || text === '—') return null;

  const negativeByParentheses = /^\(.*\)$/.test(text);
  const negativeByTrailingMinus = /-$/.test(text);

  text = text
    .replace(/[(),]/g, '')
    .replace(/-$/, '')
    .replace(/[^0-9+\-.]/g, '');

  if (!text || text === '-' || text === '+' || text === '.') return null;

  const parsed = Number(text);
  if (!Number.isFinite(parsed)) return null;

  return negativeByParentheses || negativeByTrailingMinus
    ? -Math.abs(parsed)
    : parsed;
}

function normalizeHeader(raw: unknown): string {
  return String(raw ?? '')
    .replace(/[\r\n]+/g, ' ')
    .replace(/\./g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function cellText(value: unknown): string | null {
  const text = String(value ?? '').trim();
  return text || null;
}

function isBlank(value: unknown): boolean {
  return value === null || value === undefined || String(value).trim() === '';
}

type ColumnKey =
  | 'txnType'
  | 'date'
  | 'refNo'
  | 'customer'
  | 'item'
  | 'qty'
  | 'discount'
  | 'salesWithTax';

const HEADER_ALIASES: Record<string, ColumnKey> = {
  'txn type': 'txnType',
  'transaction type': 'txnType',

  'date': 'date',
  'txn date': 'date',

  'ref no': 'refNo',
  'reference no': 'refNo',
  'reference number': 'refNo',
  'ref number': 'refNo',

  'customer': 'customer',
  'customer name': 'customer',

  'item sales description': 'item',
  'item description': 'item',
  'sales description': 'item',
  'item / sales description': 'item',
  'item / description': 'item',
  'item': 'item',

  'qty': 'qty',
  'quantity': 'qty',

  'discount': 'discount',

  'sales with tax': 'salesWithTax',
  'sales incl tax': 'salesWithTax',
  'sales including tax': 'salesWithTax',
  'saleswithtax': 'salesWithTax',
};

const REQUIRED_COLUMNS: ColumnKey[] = [
  'txnType',
  'date',
  'refNo',
  'customer',
  'item',
  'qty',
  'discount',
  'salesWithTax',
];

export interface ParsedTargetReport {
  entries: TargetReportEntryRequest[];
  sourceRows: TargetReportSourceRow[];
  fromDate: Date | null;
  asAtDate: Date | null;
  actualSales: number;
}

/**
 * Preserves the worksheet rows exactly enough to reproduce the report UI:
 * Invoice rows, each source daily subtotal row, blank separators, the "Total"
 * label row, and the final worksheet grand-total row.
 *
 * No daily subtotal is calculated in the UI. Values shown for DailyTotal and
 * GrandTotal rows are copied from the Excel cells themselves.
 */
export function parseDetailedSalesReport(buffer: ArrayBuffer): ParsedTargetReport {
  const workbook = XLSX.read(buffer, {
    type: 'array',
    cellDates: false,
  });

  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!worksheet) {
    throw new Error('The Excel file does not contain a readable worksheet.');
  }

  const rows: unknown[][] = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    raw: true,
    defval: '',
    blankrows: true,
  });

  const headerRowIndex = rows.findIndex((row) =>
    row.some((cell) => {
      const normalized = normalizeHeader(cell);
      return normalized === 'txn type' || normalized === 'transaction type';
    }),
  );

  if (headerRowIndex === -1) {
    throw new Error(
      'Header row with "Txn Type" was not found. Select a Detailed Sales Report Excel file.',
    );
  }

  const columnIndexes: Partial<Record<ColumnKey, number>> = {};
  rows[headerRowIndex].forEach((cell, index) => {
    const canonical = HEADER_ALIASES[normalizeHeader(cell)];
    if (canonical && columnIndexes[canonical] === undefined) {
      columnIndexes[canonical] = index;
    }
  });

  const missingColumns = REQUIRED_COLUMNS.filter(
    (key) => columnIndexes[key] === undefined,
  );

  if (missingColumns.length > 0) {
    throw new Error(
      `The Excel header is missing required column(s): ${missingColumns.join(', ')}.`,
    );
  }

  const valueAt = (row: unknown[], key: ColumnKey): unknown =>
    row[columnIndexes[key]!];

  const entries: TargetReportEntryRequest[] = [];
  const sourceRows: TargetReportSourceRow[] = [];
  let totalLabelSeen = false;
  let sourceSortOrder = 0;
  let invoiceSortOrder = 0;

  for (let index = headerRowIndex + 1; index < rows.length; index += 1) {
    const row = rows[index] ?? [];
    const rowIsBlank = row.every(isBlank);

    if (rowIsBlank) {
      sourceRows.push({
        rowType: 'Spacer',
        txnType: null,
        txnDate: null,
        refNo: null,
        customerName: null,
        itemDescription: null,
        qty: null,
        discount: null,
        salesWithTax: null,
        sortOrder: sourceSortOrder++,
      });
      continue;
    }

    const txnTypeText = cellText(valueAt(row, 'txnType'));
    const normalizedTxnType = normalizeHeader(txnTypeText);

    if (normalizedTxnType === 'invoice') {
      const parsedDate = parseDateFlexible(valueAt(row, 'date'));
      if (!parsedDate) {
        throw new Error(
          `Invalid Invoice date at Excel row ${index + 1}. Please correct the Date cell and upload again.`,
        );
      }

      const txnDate = toDateOnlyString(parsedDate);
      const refNo = cellText(valueAt(row, 'refNo'));
      const customerName = cellText(valueAt(row, 'customer'));
      const itemDescription = cellText(valueAt(row, 'item'));
      const qty = toNumberOrNull(valueAt(row, 'qty')) ?? 0;
      const discount = toNumberOrNull(valueAt(row, 'discount')) ?? 0;
      const salesWithTax = toNumberOrNull(valueAt(row, 'salesWithTax')) ?? 0;

      sourceRows.push({
        rowType: 'Invoice',
        txnType: txnTypeText ?? 'Invoice',
        txnDate,
        refNo,
        customerName,
        itemDescription,
        qty,
        discount,
        salesWithTax,
        sortOrder: sourceSortOrder++,
      });

      entries.push({
        txnDate,
        refNo,
        customerName,
        itemDescription,
        qty,
        discount,
        salesWithTax,
        sortOrder: invoiceSortOrder++,
      });
      continue;
    }

    if (normalizedTxnType === 'total') {
      totalLabelSeen = true;
      sourceRows.push({
        rowType: 'TotalLabel',
        txnType: txnTypeText ?? 'Total',
        txnDate: null,
        refNo: null,
        customerName: null,
        itemDescription: null,
        qty: toNumberOrNull(valueAt(row, 'qty')),
        discount: toNumberOrNull(valueAt(row, 'discount')),
        salesWithTax: toNumberOrNull(valueAt(row, 'salesWithTax')),
        sortOrder: sourceSortOrder++,
      });
      continue;
    }

    const hasTextInFirstFiveColumns = [
      'txnType',
      'date',
      'refNo',
      'customer',
      'item',
    ].some((key) => !isBlank(valueAt(row, key as ColumnKey)));

    const qty = toNumberOrNull(valueAt(row, 'qty'));
    const discount = toNumberOrNull(valueAt(row, 'discount'));
    const salesWithTax = toNumberOrNull(valueAt(row, 'salesWithTax'));
    const hasNumericTotals = qty !== null || discount !== null || salesWithTax !== null;

    if (!hasTextInFirstFiveColumns && hasNumericTotals) {
      sourceRows.push({
        rowType: totalLabelSeen ? 'GrandTotal' : 'DailyTotal',
        txnType: null,
        txnDate: null,
        refNo: null,
        customerName: null,
        itemDescription: null,
        qty,
        discount,
        salesWithTax,
        sortOrder: sourceSortOrder++,
      });
      continue;
    }

    // Preserve any unexpected non-empty source row rather than silently losing it.
    sourceRows.push({
      rowType: 'Other',
      txnType: txnTypeText,
      txnDate: parseDateFlexible(valueAt(row, 'date'))
        ? toDateOnlyString(parseDateFlexible(valueAt(row, 'date'))!)
        : null,
      refNo: cellText(valueAt(row, 'refNo')),
      customerName: cellText(valueAt(row, 'customer')),
      itemDescription: cellText(valueAt(row, 'item')),
      qty,
      discount,
      salesWithTax,
      sortOrder: sourceSortOrder++,
    });
  }

  if (entries.length === 0) {
    return {
      entries,
      sourceRows,
      fromDate: null,
      asAtDate: null,
      actualSales: 0,
    };
  }

  const detectedMonths = [
    ...new Set(entries.map((entry) => entry.txnDate.slice(0, 7))),
  ].sort();

  if (detectedMonths.length > 1) {
    throw new Error(
      `The Excel Invoice dates contain more than one month (${detectedMonths.join(', ')}).`,
    );
  }

  const invoiceDates = entries.map((entry) => entry.txnDate).sort();
  const fromDate = new Date(`${invoiceDates[0]}T00:00:00.000Z`);
  const asAtDate = new Date(
    `${invoiceDates[invoiceDates.length - 1]}T00:00:00.000Z`,
  );

  const sourceGrandTotal = [...sourceRows]
    .reverse()
    .find(
      (row) =>
        row.rowType === 'GrandTotal' &&
        row.salesWithTax !== null &&
        row.salesWithTax !== undefined,
    );

  const actualSales =
    sourceGrandTotal?.salesWithTax ??
    entries.reduce((sum, entry) => sum + entry.salesWithTax, 0);

  return {
    entries,
    sourceRows,
    fromDate,
    asAtDate,
    actualSales,
  };
}
