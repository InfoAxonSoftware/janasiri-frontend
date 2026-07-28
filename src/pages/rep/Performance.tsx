// @ts-nocheck
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  CalendarDays,
  ChevronDown,
  ChevronRight,
  ChevronsDown,
  ChevronsUp,
  FileDown,
  FileSpreadsheet,
  FileText,
  Loader2,
  Target,
} from 'lucide-react';
import { repsApi } from '../../services/api/repsApi';
import { targetReportsApi } from '../../services/api/targetReportsApi';
import { exportTargetReportPdf } from '../../utils/targetReportExport';
import { formatCurrency, formatDate } from '../../utils/formatters';
import type { SalesTarget } from '../../types/common.types';

const statusStyles: Record<string, string> = {
  'Target Exceeded':
    'border-blue-200 bg-blue-50 text-blue-700',
  'Target Achieved':
    'border-emerald-200 bg-emerald-50 text-emerald-700',
  'On Track':
    'border-teal-200 bg-teal-50 text-teal-700',
  'Below Target':
    'border-amber-200 bg-amber-50 text-amber-700',
};

const numeric = (value: unknown) => {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
};

const fmt = (value: unknown) =>
  numeric(value).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const normalizeRowKind = (row: any) => {
  const value = String(row?.rowType || row?.txnType || '')
    .replace(/\s+/g, '')
    .toLowerCase();

  if (value.includes('grandtotal')) return 'grandtotal';

  if (
    value === 'totallabel' ||
    value === 'total'
  ) {
    return 'totallabel';
  }

  if (
    value.includes('dailytotal') ||
    value.includes('subtotal')
  ) {
    return 'dailytotal';
  }

  return 'invoice';
};

const sumRows = (rows: any[]) => ({
  qty: rows.reduce(
    (total, row) => total + numeric(row.qty),
    0,
  ),
  discount: rows.reduce(
    (total, row) => total + numeric(row.discount),
    0,
  ),
  salesWithTax: rows.reduce(
    (total, row) => total + numeric(row.salesWithTax),
    0,
  ),
});

function StatusPill({ status }: { status?: string }) {
  const value = status || 'Not Available';

  return (
    <span
      className={`inline-flex max-w-full items-center rounded-full border px-2.5 py-1 text-[10px] font-bold ${
        statusStyles[value] ||
        'border-slate-200 bg-slate-50 text-slate-600'
      }`}
    >
      <span className="truncate">{value}</span>
    </span>
  );
}

function AmountCard({
  label,
  value,
  emerald = false,
}: {
  label: string;
  value: string;
  emerald?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-slate-200 bg-white px-4 py-3">
      <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-400">
        {label}
      </p>

      <p
        className={`mt-1 break-words text-base font-black leading-tight tabular-nums sm:text-lg lg:text-xl ${
          emerald ? 'text-emerald-700' : 'text-slate-900'
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function ReportMetric({
  label,
  value,
  tone = 'normal',
  wide = false,
}: {
  label: string;
  value: string;
  tone?: 'normal' | 'emerald' | 'amber' | 'blue';
  wide?: boolean;
}) {
  const color = {
    normal: 'text-slate-900',
    emerald: 'text-emerald-700',
    amber: 'text-amber-700',
    blue: 'text-blue-700',
  }[tone];

  return (
    <div
      className={`min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-3 ${
        wide ? 'col-span-2 sm:col-span-1' : ''
      }`}
    >
      <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <p
        className={`mt-1 break-words text-xs font-black leading-5 tabular-nums sm:text-sm ${color}`}
      >
        {value}
      </p>
    </div>
  );
}

function SmallValue({
  label,
  value,
  negative = false,
}: {
  label: string;
  value: string;
  negative?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-lg bg-slate-50 px-2.5 py-2">
      <p className="text-[8px] font-bold uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <p
        className={`mt-1 break-words text-[11px] font-bold tabular-nums ${
          negative ? 'text-red-600' : 'text-slate-700'
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function MobileInvoiceTable({
  rows,
  subtotal,
}: {
  rows: any[];
  subtotal: ReturnType<typeof sumRows>;
}) {
  return (
    <div className="border-t border-slate-200 bg-white lg:hidden">
      <div className="overflow-x-auto overscroll-x-contain">
        <table className="w-full min-w-[760px] border-collapse text-[11px]">
          <thead>
            <tr className="bg-slate-100 text-slate-700">
              <th className="sticky left-0 z-10 min-w-[170px] border-b border-r border-slate-300 bg-slate-100 px-2.5 py-2 text-left font-extrabold">
                Customer
              </th>
              <th className="w-24 border-b border-r border-slate-300 px-2.5 py-2 text-left font-extrabold">
                Type
              </th>
              <th className="w-28 border-b border-r border-slate-300 px-2.5 py-2 text-left font-extrabold">
                Ref No
              </th>
              <th className="min-w-[190px] border-b border-r border-slate-300 px-2.5 py-2 text-left font-extrabold">
                Item / Description
              </th>
              <th className="w-20 border-b border-r border-slate-300 px-2.5 py-2 text-right font-extrabold">
                Qty
              </th>
              <th className="w-24 border-b border-r border-slate-300 px-2.5 py-2 text-right font-extrabold">
                Discount
              </th>
              <th className="w-28 border-b border-slate-300 px-2.5 py-2 text-right font-extrabold">
                Sales
              </th>
            </tr>
          </thead>

          <tbody>
            {rows.map((row, index) => (
              <tr
                key={`${row.sortOrder}-${row.refNo || index}`}
                className="odd:bg-white even:bg-slate-50/70"
              >
                <td className="sticky left-0 z-[5] min-w-[170px] border-b border-r border-slate-200 bg-inherit px-2.5 py-2 font-semibold text-slate-800 shadow-[2px_0_0_rgba(148,163,184,0.16)]">
                  <span className="block max-w-[170px] break-words">
                    {row.customerName || '—'}
                  </span>
                </td>
                <td className="whitespace-nowrap border-b border-r border-slate-200 px-2.5 py-2 font-semibold text-slate-700">
                  {row.txnType || 'Invoice'}
                </td>
                <td className="whitespace-nowrap border-b border-r border-slate-200 px-2.5 py-2 font-mono text-[10px] text-slate-600">
                  {row.refNo || '—'}
                </td>
                <td className="border-b border-r border-slate-200 px-2.5 py-2 text-slate-600">
                  <span className="block max-w-[190px] break-words">
                    {row.itemDescription || '—'}
                  </span>
                </td>
                <td className="border-b border-r border-slate-200 px-2.5 py-2 text-right tabular-nums text-slate-700">
                  {fmt(row.qty)}
                </td>
                <td
                  className={`border-b border-r border-slate-200 px-2.5 py-2 text-right tabular-nums ${
                    numeric(row.discount) < 0
                      ? 'font-bold text-red-600'
                      : 'text-slate-700'
                  }`}
                >
                  {fmt(row.discount)}
                </td>
                <td className="border-b border-slate-200 px-2.5 py-2 text-right font-black tabular-nums text-emerald-700">
                  {fmt(row.salesWithTax)}
                </td>
              </tr>
            ))}

            <tr className="bg-slate-800 font-black text-white">
              <td
                colSpan={4}
                className="border-r border-slate-600 bg-slate-800 px-3 py-2.5 text-right text-[10px] uppercase tracking-wide"
              >
                Daily Total
              </td>
              <td className="border-r border-slate-600 px-2.5 py-2.5 text-right tabular-nums">
                {fmt(subtotal.qty)}
              </td>
              <td className="border-r border-slate-600 px-2.5 py-2.5 text-right tabular-nums">
                {fmt(subtotal.discount)}
              </td>
              <td className="px-2.5 py-2.5 text-right text-emerald-300 tabular-nums">
                {fmt(subtotal.salesWithTax)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-3 py-2 text-[10px] text-slate-500 sm:hidden">
        <span>Swipe horizontally to view all columns</span>
        <span className="font-bold text-slate-600">← →</span>
      </div>
    </div>
  );
}

function DesktopInvoiceTable({
  rows,
  subtotal,
}: {
  rows: any[];
  subtotal: ReturnType<typeof sumRows>;
}) {
  return (
    <div className="hidden overflow-x-auto border-t border-slate-200 lg:block">
      <table className="w-full min-w-[1040px] border-collapse bg-white text-xs">
        <thead>
          <tr className="bg-slate-100 text-slate-800">
            {[
              'Txn Type',
              'Date',
              'Ref No',
              'Customer',
              'Item / Description',
              'Qty',
              'Discount',
              'Sales With Tax',
            ].map((header) => (
              <th
                key={header}
                className={`border border-slate-300 px-3 py-2 font-extrabold ${
                  ['Qty', 'Discount', 'Sales With Tax'].includes(
                    header,
                  )
                    ? 'text-right'
                    : 'text-left'
                }`}
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {rows.map((row, index) => (
            <tr
              key={`${row.sortOrder}-${row.refNo || index}`}
              className="hover:bg-slate-50"
            >
              <td className="border border-slate-200 px-3 py-2 font-medium text-slate-700">
                {row.txnType || 'Invoice'}
              </td>

              <td className="whitespace-nowrap border border-slate-200 px-3 py-2 text-slate-600">
                {row.txnDate
                  ? formatDate(row.txnDate)
                  : '—'}
              </td>

              <td className="whitespace-nowrap border border-slate-200 px-3 py-2 font-mono text-slate-700">
                {row.refNo || '—'}
              </td>

              <td className="border border-slate-200 px-3 py-2 text-slate-700">
                {row.customerName || '—'}
              </td>

              <td className="border border-slate-200 px-3 py-2 text-slate-600">
                {row.itemDescription || '—'}
              </td>

              <td className="border border-slate-200 px-3 py-2 text-right tabular-nums">
                {fmt(row.qty)}
              </td>

              <td
                className={`border border-slate-200 px-3 py-2 text-right tabular-nums ${
                  numeric(row.discount) < 0
                    ? 'font-semibold text-red-600'
                    : ''
                }`}
              >
                {fmt(row.discount)}
              </td>

              <td className="border border-slate-200 px-3 py-2 text-right font-bold tabular-nums text-slate-900">
                {fmt(row.salesWithTax)}
              </td>
            </tr>
          ))}

          <tr className="bg-slate-100 font-black text-slate-900">
            <td
              colSpan={5}
              className="border border-slate-300 px-3 py-2 text-right text-[10px] uppercase tracking-wide text-slate-500"
            >
              Daily Total
            </td>

            <td className="border border-slate-300 px-3 py-2 text-right tabular-nums">
              {fmt(subtotal.qty)}
            </td>

            <td className="border border-slate-300 px-3 py-2 text-right tabular-nums">
              {fmt(subtotal.discount)}
            </td>

            <td className="border border-slate-300 px-3 py-2 text-right tabular-nums text-emerald-700">
              {fmt(subtotal.salesWithTax)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function GrandTotalCard({
  total,
  label,
}: {
  total: {
    qty: number;
    discount: number;
    salesWithTax: number;
  };
  label: string;
}) {
  return (
    <section className="mt-4 overflow-hidden rounded-xl border-2 border-slate-600 bg-white shadow-sm">
      <div className="bg-slate-700 px-4 py-3 text-sm font-black text-white">
        {label || 'Total'}
      </div>

      <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3 sm:p-4">
        <ReportMetric
          label="Qty"
          value={fmt(total.qty)}
        />

        <ReportMetric
          label="Discount"
          value={fmt(total.discount)}
          tone={
            total.discount < 0
              ? 'amber'
              : 'normal'
          }
        />

        <div className="col-span-2 min-w-0 rounded-xl bg-emerald-50 px-4 py-3 sm:col-span-1">
          <p className="text-[9px] font-bold uppercase tracking-wide text-emerald-600">
            Sales With Tax
          </p>

          <p className="mt-1 break-words text-lg font-black leading-tight tabular-nums text-emerald-700">
            {fmt(total.salesWithTax)}
          </p>
        </div>
      </div>
    </section>
  );
}

function CurrentReportDetail({
  report,
  isLoading,
}: {
  report: any;
  isLoading: boolean;
}) {
  const [expandedDates, setExpandedDates] =
    useState<Set<string>>(new Set());

  const normalizedRows = useMemo(() => {
    if (report?.sourceRows?.length) {
      return report.sourceRows
        .slice()
        .sort(
          (first: any, second: any) =>
            first.sortOrder - second.sortOrder,
        );
    }

    return (report?.entries || [])
      .map((entry: any) => ({
        ...entry,
        rowType: 'Invoice',
        txnType: 'Invoice',
      }))
      .sort(
        (first: any, second: any) =>
          first.sortOrder - second.sortOrder,
      );
  }, [report]);

  const {
    dateGroups,
    totalLabelRow,
    grandTotalRow,
  } = useMemo(() => {
    const groups: any[] = [];
    const groupsByDate = new Map<string, any>();
    let totalLabel: any;
    let grandTotal: any;

    normalizedRows.forEach((row: any) => {
      const kind = normalizeRowKind(row);

      if (kind === 'totallabel') {
        totalLabel = row;
        return;
      }

      if (kind === 'grandtotal') {
        grandTotal = row;
        return;
      }

      if (kind === 'dailytotal') {
        const key =
          row.txnDate ||
          groups[groups.length - 1]?.key;

        if (key && groupsByDate.has(String(key))) {
          groupsByDate.get(String(key)).subtotalRow = row;
        } else if (groups.length > 0) {
          groups[groups.length - 1].subtotalRow = row;
        }

        return;
      }

      if (!row.txnDate) return;

      const key = String(row.txnDate);
      let group = groupsByDate.get(key);

      if (!group) {
        group = {
          key,
          txnDate: key,
          invoiceRows: [],
        };

        groupsByDate.set(key, group);
        groups.push(group);
      }

      group.invoiceRows.push(row);
    });

    return {
      dateGroups: groups,
      totalLabelRow: totalLabel,
      grandTotalRow: grandTotal,
    };
  }, [normalizedRows]);

  if (isLoading) {
    return (
      <div className="border-t border-violet-200 py-12 text-center">
        <Loader2 className="mx-auto h-7 w-7 animate-spin text-violet-500" />
        <p className="mt-3 text-xs text-slate-500">
          Loading report data…
        </p>
      </div>
    );
  }

  if (!report) {
    return (
      <p className="border-t border-violet-200 px-4 py-10 text-center text-sm text-slate-400">
        No sales report available.
      </p>
    );
  }

  const balance = Math.max(
    numeric(report.targetAmount) -
      numeric(report.actualSales),
    0,
  );

  const exceededBy = Math.max(
    numeric(report.actualSales) -
      numeric(report.targetAmount),
    0,
  );

  const achievement =
    numeric(report.targetAmount) > 0
      ? (numeric(report.actualSales) /
          numeric(report.targetAmount)) *
        100
      : 0;

  const allInvoiceRows = dateGroups.flatMap(
    (group) => group.invoiceRows,
  );

  const calculatedGrandTotal = sumRows(allInvoiceRows);

  const grandTotal = {
    qty:
      grandTotalRow?.qty !== undefined &&
      grandTotalRow?.qty !== null
        ? numeric(grandTotalRow.qty)
        : calculatedGrandTotal.qty,

    discount:
      grandTotalRow?.discount !== undefined &&
      grandTotalRow?.discount !== null
        ? numeric(grandTotalRow.discount)
        : calculatedGrandTotal.discount,

    salesWithTax:
      grandTotalRow?.salesWithTax !== undefined &&
      grandTotalRow?.salesWithTax !== null
        ? numeric(grandTotalRow.salesWithTax)
        : numeric(report.actualSales) ||
          calculatedGrandTotal.salesWithTax,
  };

  const allExpanded =
    dateGroups.length > 0 &&
    dateGroups.every((group) =>
      expandedDates.has(group.key),
    );

  const toggleDate = (key: string) => {
    setExpandedDates((current) => {
      const next = new Set(current);

      if (next.has(key)) next.delete(key);
      else next.add(key);

      return next;
    });
  };

  return (
    <div className="min-w-0 border-t-2 border-violet-200">
      <div className="border-b border-slate-200 bg-violet-50/60 px-3 py-4 sm:px-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-black text-slate-900">
              Sales Report
            </p>

            {report.originalFileName && (
              <p className="mt-1 break-words text-[11px] text-slate-500">
                {report.originalFileName}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={() =>
              exportTargetReportPdf(report)
            }
            className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl bg-slate-700 px-4 text-xs font-bold text-white transition hover:bg-slate-800 sm:w-auto"
          >
            <FileDown className="h-4 w-4" />
            Export PDF
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
          <ReportMetric
            label="Target Period"
            value={`${formatDate(
              report.targetStartDate,
            )} – ${formatDate(
              report.targetEndDate,
            )}`}
            wide
          />

          <ReportMetric
            label="Report Period"
            value={`${formatDate(
              report.fromDate,
            )} – ${formatDate(report.asAtDate)}`}
            wide
          />

          <ReportMetric
            label="Target"
            value={formatCurrency(
              report.targetAmount,
            )}
          />

          <ReportMetric
            label="Actual Sales"
            value={formatCurrency(
              report.actualSales,
            )}
            tone="emerald"
          />

          <ReportMetric
            label={
              exceededBy > 0
                ? 'Exceeded By'
                : 'Balance'
            }
            value={formatCurrency(
              exceededBy > 0
                ? exceededBy
                : balance,
            )}
            tone={
              exceededBy > 0
                ? 'blue'
                : 'amber'
            }
          />

          <ReportMetric
            label="Achievement"
            value={`${achievement.toFixed(1)}%`}
          />
        </div>
      </div>

      {dateGroups.length === 0 ? (
        <div className="bg-amber-50 px-4 py-8 text-center">
          <p className="text-sm font-bold text-amber-800">
            No invoice rows are available in this report.
          </p>
        </div>
      ) : (
        <div className="min-w-0 bg-slate-100 p-2.5 sm:p-4">
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-black text-slate-900">
                Daily Excel Report
              </p>

              <p className="mt-0.5 text-[11px] text-slate-500">
                Select a date to view invoice rows.
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                setExpandedDates(
                  allExpanded
                    ? new Set()
                    : new Set(
                        dateGroups.map(
                          (group) => group.key,
                        ),
                      ),
                )
              }
              className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold text-slate-700 sm:w-auto"
            >
              {allExpanded ? (
                <ChevronsUp className="h-4 w-4" />
              ) : (
                <ChevronsDown className="h-4 w-4" />
              )}

              {allExpanded
                ? 'Collapse All'
                : 'Expand All'}
            </button>
          </div>

          <div className="space-y-2.5">
            {dateGroups.map((group) => {
              const expanded =
                expandedDates.has(group.key);

              const calculatedSubtotal =
                sumRows(group.invoiceRows);

              const subtotal = group.subtotalRow
                ? {
                    qty: numeric(
                      group.subtotalRow.qty,
                    ),
                    discount: numeric(
                      group.subtotalRow.discount,
                    ),
                    salesWithTax: numeric(
                      group.subtotalRow.salesWithTax,
                    ),
                  }
                : calculatedSubtotal;

              return (
                <section
                  key={group.key}
                  className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
                >
                  <button
                    type="button"
                    onClick={() =>
                      toggleDate(group.key)
                    }
                    className="flex min-h-16 w-full items-center gap-2.5 px-3 py-3 text-left transition hover:bg-slate-50 sm:px-4"
                  >
                    {expanded ? (
                      <ChevronDown className="h-5 w-5 flex-shrink-0 text-slate-500" />
                    ) : (
                      <ChevronRight className="h-5 w-5 flex-shrink-0 text-slate-500" />
                    )}

                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-black text-slate-900 sm:text-base">
                        {formatDate(group.txnDate)}
                      </p>

                      <p className="mt-0.5 text-[11px] text-slate-500">
                        {group.invoiceRows.length}{' '}
                        invoice row
                        {group.invoiceRows.length === 1
                          ? ''
                          : 's'}
                      </p>
                    </div>

                    <div className="min-w-0 max-w-[45%] flex-shrink-0 text-right">
                      <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">
                        Daily Total
                      </p>

                      <p className="break-words text-sm font-black leading-tight tabular-nums text-emerald-700 sm:text-base">
                        {fmt(
                          subtotal.salesWithTax,
                        )}
                      </p>
                    </div>
                  </button>

                  {expanded && (
                    <>
                      <MobileInvoiceTable
                        rows={group.invoiceRows}
                        subtotal={subtotal}
                      />

                      <DesktopInvoiceTable
                        rows={group.invoiceRows}
                        subtotal={subtotal}
                      />
                    </>
                  )}
                </section>
              );
            })}
          </div>

          <GrandTotalCard
            label={
              totalLabelRow?.txnType ||
              totalLabelRow?.itemDescription ||
              'Total'
            }
            total={grandTotal}
          />
        </div>
      )}
    </div>
  );
}

function CurrentTargetCard({
  target,
}: {
  target?: SalesTarget;
}) {
  const [reportOpen, setReportOpen] =
    useState(false);

  const {
    data: report,
    isLoading: reportLoading,
  } = useQuery({
    queryKey: [
      'rep-current-target-report',
      target?.id,
    ],
    queryFn: () =>
      targetReportsApi
        .repGetCurrent(target!.id)
        .then(
          (response) => response.data.data,
        ),
    enabled: Boolean(
      reportOpen &&
        target?.hasReport &&
        target?.id,
    ),
  });

  if (!target) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white px-5 py-14 text-center shadow-sm">
        <Target className="mx-auto h-10 w-10 text-slate-300" />
        <p className="mt-3 text-sm font-bold text-slate-700">
          No target assigned
        </p>
      </section>
    );
  }

  const percentage = Number(
    target.achievementPercentage || 0,
  );

  const exceeded =
    Number(target.exceededBy || 0) > 0;

  return (
    <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5 lg:px-6">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-emerald-600">
            Sales Target
          </p>

          <h2 className="mt-1 break-words text-lg font-black text-slate-900 sm:text-xl">
            {target.targetName?.trim() || `${target.targetPeriod} Target`}
          </h2>

          <p className="mt-1 inline-flex items-center gap-1.5 text-[11px] text-slate-500 sm:text-xs">
            <CalendarDays className="h-3.5 w-3.5" />
            {formatDate(target.startDate)} –{' '}
            {formatDate(target.endDate)}
          </p>
        </div>

        <StatusPill
          status={target.performanceStatus}
        />
      </div>

      <div className="px-4 py-5 sm:px-5 lg:px-6">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <AmountCard
            label="Sales Target"
            value={formatCurrency(
              target.targetAmount,
            )}
          />

          <AmountCard
            label="Actual Sales"
            value={formatCurrency(
              target.achievedAmount,
            )}
            emerald
          />

          <AmountCard
            label={
              exceeded
                ? 'Exceeded By'
                : 'Balance'
            }
            value={formatCurrency(
              exceeded
                ? target.exceededBy
                : target.balanceRemaining,
            )}
          />
        </div>

        <div className="mt-4 rounded-xl bg-slate-50 px-3 py-3 sm:px-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-semibold text-slate-600">
              Achievement
            </span>

            <span className="text-sm font-black text-slate-900">
              {percentage.toFixed(1)}%
            </span>
          </div>

          <div className="mt-2.5 h-2.5 overflow-hidden rounded-full bg-slate-200">
            <div
              className={`h-full rounded-full ${
                percentage > 100
                  ? 'bg-blue-500'
                  : 'bg-emerald-500'
              }`}
              style={{
                width: `${Math.min(
                  Math.max(percentage, 0),
                  100,
                )}%`,
              }}
            />
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="inline-flex items-center gap-1.5 text-[11px] text-slate-500">
            <FileText className="h-3.5 w-3.5 text-emerald-600" />

            {target.hasReport
              ? `Updated ${formatDate(
                  target.reportAsAtDate,
                )}`
              : 'No sales report yet'}
          </p>

          {target.hasReport && (
            <button
              type="button"
              onClick={() =>
                setReportOpen(
                  (current) => !current,
                )
              }
              className={`inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-4 text-xs font-bold transition sm:w-auto ${
                reportOpen
                  ? 'bg-violet-600 text-white'
                  : 'bg-violet-50 text-violet-700'
              }`}
            >
              <FileSpreadsheet className="h-4 w-4" />

              {reportOpen
                ? 'Hide Current Report'
                : 'View Current Report'}

              {reportOpen ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
          )}
        </div>
      </div>

      {reportOpen && (
        <CurrentReportDetail
          report={report}
          isLoading={reportLoading}
        />
      )}
    </section>
  );
}

export default function RepPerformancePage() {
  const {
    data: targets = [],
    isLoading,
  } = useQuery({
    queryKey: ['rep-targets'],
    queryFn: () =>
      repsApi
        .repGetTargets()
        .then(
          (response) => response.data.data,
        ),
  });

  const sortedTargets = useMemo(() => {
    const now = Date.now();

    return [...targets].sort(
      (first: SalesTarget, second: SalesTarget) => {
        const firstStart = new Date(first.startDate).getTime();
        const firstEnd = new Date(first.endDate).getTime();
        const secondStart = new Date(second.startDate).getTime();
        const secondEnd = new Date(second.endDate).getTime();

        const firstIsCurrent =
          firstStart <= now && now <= firstEnd;
        const secondIsCurrent =
          secondStart <= now && now <= secondEnd;

        if (firstIsCurrent !== secondIsCurrent) {
          return firstIsCurrent ? -1 : 1;
        }

        return secondStart - firstStart;
      },
    );
  }, [targets]);

  return (
    <div className="mx-auto flex w-full max-w-[1600px] animate-fade-in flex-col gap-4 px-3 pb-28 pt-2 sm:px-5 sm:pt-4 lg:px-0 lg:pt-0">
      <header className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-700 via-emerald-600 to-teal-600 px-4 py-5 text-white shadow-sm sm:px-5 sm:py-6 lg:px-6">
        <div className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-white/10 blur-3xl" />

        <div className="relative">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-100">
            Sales Performance
          </p>

          <h1 className="mt-1 text-xl font-bold sm:text-2xl">
            My Performance
          </h1>

          <p className="mt-1 text-xs text-emerald-100 sm:text-sm">
            View each target, progress and its current report
          </p>
        </div>
      </header>

      {isLoading ? (
        <section className="rounded-2xl border border-slate-200 bg-white px-4 py-16 text-center shadow-sm">
          <Loader2 className="mx-auto h-7 w-7 animate-spin text-emerald-500" />

          <p className="mt-3 text-sm text-slate-500">
            Loading performance…
          </p>
        </section>
      ) : sortedTargets.length === 0 ? (
        <CurrentTargetCard />
      ) : (
        <div className="space-y-4">
          {sortedTargets.map(
            (target: SalesTarget) => (
              <CurrentTargetCard
                key={target.id}
                target={target}
              />
            ),
          )}
        </div>
      )}
    </div>
  );
}