// @ts-nocheck
import { useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  ChevronsDown,
  ChevronsUp,
  FileDown,
  Loader2,
} from 'lucide-react';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { exportTargetReportPdf } from '../../utils/targetReportExport';
import type {
  TargetReportDetail,
  TargetReportSourceRow,
} from '../../services/api/targetReportsApi';

const fmt = (value: number | null | undefined) => {
  if (value === null || value === undefined) return '';
  return Number(value).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

interface TargetReportDetailPanelProps {
  report: TargetReportDetail | undefined;
  isLoading: boolean;
  showRepName?: boolean;
}

interface DateGroup {
  key: string;
  txnDate: string;
  invoiceRows: TargetReportSourceRow[];
  subtotalRow?: TargetReportSourceRow;
}

function ExactExcelTable({
  rows,
  subtotal,
}: {
  rows: TargetReportSourceRow[];
  subtotal?: TargetReportSourceRow;
}) {
  return (
    <div className="overflow-x-auto border-t border-slate-300">
      <table className="min-w-[1120px] w-full border-collapse text-xs bg-white">
        <thead>
          <tr className="bg-slate-100 text-slate-950">
            {[
              'Txn Type',
              'Date',
              'Ref No',
              'Customer',
              'Item Sales Description',
              'Qty',
              'Discount',
              'Sales With Tax',
            ].map((header) => (
              <th
                key={header}
                className={`border border-slate-400 px-2.5 py-2 font-extrabold whitespace-nowrap ${
                  ['Qty', 'Discount', 'Sales With Tax'].includes(header)
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
          {rows.map((row) => (
            <tr
              key={`${row.sortOrder}-${row.refNo ?? ''}`}
              className="bg-white hover:bg-slate-50"
            >
              <td className="border border-slate-300 px-2.5 py-1.5 font-medium text-slate-800">
                {row.txnType ?? ''}
              </td>
              <td className="border border-slate-300 px-2.5 py-1.5 whitespace-nowrap text-slate-700">
                {row.txnDate ? formatDate(row.txnDate) : ''}
              </td>
              <td className="border border-slate-300 px-2.5 py-1.5 font-mono text-slate-800 whitespace-nowrap">
                {row.refNo ?? ''}
              </td>
              <td className="border border-slate-300 px-2.5 py-1.5 text-slate-800">
                {row.customerName ?? ''}
              </td>
              <td className="border border-slate-300 px-2.5 py-1.5 text-slate-800">
                {row.itemDescription ?? ''}
              </td>
              <td className="border border-slate-300 px-2.5 py-1.5 text-right tabular-nums">
                {fmt(row.qty)}
              </td>
              <td
                className={`border border-slate-300 px-2.5 py-1.5 text-right tabular-nums ${
                  Number(row.discount ?? 0) < 0
                    ? 'font-semibold text-red-600'
                    : ''
                }`}
              >
                {fmt(row.discount)}
              </td>
              <td className="border border-slate-300 px-2.5 py-1.5 text-right font-semibold tabular-nums">
                {fmt(row.salesWithTax)}
              </td>
            </tr>
          ))}

          {subtotal && (
            <tr className="bg-slate-50 font-extrabold text-slate-950">
              <td className="border border-slate-300 px-2.5 py-2" />
              <td className="border border-slate-300 px-2.5 py-2" />
              <td className="border border-slate-300 px-2.5 py-2" />
              <td className="border border-slate-300 px-2.5 py-2" />
              <td className="border border-slate-300 px-2.5 py-2" />
              <td className="border border-slate-400 px-2.5 py-2 text-right tabular-nums">
                {fmt(subtotal.qty)}
              </td>
              <td className="border border-slate-400 px-2.5 py-2 text-right tabular-nums">
                {fmt(subtotal.discount)}
              </td>
              <td className="border border-slate-400 px-2.5 py-2 text-right tabular-nums">
                {fmt(subtotal.salesWithTax)}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default function TargetReportDetailPanel({
  report,
  isLoading,
  showRepName = true,
}: TargetReportDetailPanelProps) {
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());

  const exactRows = report?.sourceRows ?? [];

  const { dateGroups, totalLabelRow, grandTotalRow } = useMemo(() => {
    const groups: DateGroup[] = [];
    let currentGroup: DateGroup | null = null;
    let totalLabel: TargetReportSourceRow | undefined;
    let grandTotal: TargetReportSourceRow | undefined;

    exactRows
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .forEach((row) => {
        if (row.rowType === 'Invoice' && row.txnDate) {
          if (!currentGroup || currentGroup.key !== row.txnDate) {
            currentGroup = {
              key: row.txnDate,
              txnDate: row.txnDate,
              invoiceRows: [],
            };
            groups.push(currentGroup);
          }
          currentGroup.invoiceRows.push(row);
          return;
        }

        if (row.rowType === 'DailyTotal' && currentGroup) {
          currentGroup.subtotalRow = row;
          return;
        }

        if (row.rowType === 'TotalLabel') {
          totalLabel = row;
          currentGroup = null;
          return;
        }

        if (row.rowType === 'GrandTotal') {
          grandTotal = row;
          currentGroup = null;
        }
      });

    return {
      dateGroups: groups,
      totalLabelRow: totalLabel,
      grandTotalRow: grandTotal,
    };
  }, [exactRows]);

  if (isLoading) {
    return (
      <div className="py-10 text-center">
        <Loader2 className="mx-auto h-6 w-6 animate-spin text-violet-500" />
      </div>
    );
  }

  if (!report) {
    return (
      <p className="py-8 text-center text-sm text-slate-400">
        No sales report uploaded yet.
      </p>
    );
  }

  const balance = Math.max(report.targetAmount - report.actualSales, 0);
  const exceededBy = Math.max(report.actualSales - report.targetAmount, 0);
  const achievementPct =
    report.targetAmount > 0
      ? (report.actualSales / report.targetAmount) * 100
      : 0;

  const toggleDate = (key: string) => {
    setExpandedDates((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const allExpanded =
    dateGroups.length > 0 && expandedDates.size === dateGroups.length;

  return (
    <div className="min-w-0 border-t-2 border-violet-200">
      <div className="border-b border-slate-200 bg-violet-50/60 px-4 py-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-bold text-slate-800">
            {showRepName ? `${report.repName} — ` : ''}
            Sales Report
          </p>

          <button
            onClick={() => exportTargetReportPdf(report)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-700"
          >
            <FileDown className="h-3.5 w-3.5" />
            Export PDF
          </button>
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs sm:grid-cols-4">
          <div>
            <span className="text-slate-500">Target Period: </span>
            <span className="font-medium text-slate-800">
              {formatDate(report.targetStartDate)} –{' '}
              {formatDate(report.targetEndDate)}
            </span>
          </div>
          <div>
            <span className="text-slate-500">Report Period: </span>
            <span className="font-medium text-slate-800">
              {formatDate(report.fromDate)} – {formatDate(report.asAtDate)}
            </span>
          </div>
          <div>
            <span className="text-slate-500">Target: </span>
            <span className="font-medium text-slate-800">
              {formatCurrency(report.targetAmount)}
            </span>
          </div>
          <div>
            <span className="text-slate-500">Actual Sales: </span>
            <span className="font-semibold text-emerald-700">
              {formatCurrency(report.actualSales)}
            </span>
          </div>
          <div>
            {exceededBy > 0 ? (
              <>
                <span className="text-slate-500">Exceeded By: </span>
                <span className="font-medium text-blue-700">
                  {formatCurrency(exceededBy)}
                </span>
              </>
            ) : (
              <>
                <span className="text-slate-500">Balance: </span>
                <span className="font-medium text-amber-700">
                  {formatCurrency(balance)}
                </span>
              </>
            )}
          </div>
          <div>
            <span className="text-slate-500">Achievement: </span>
            <span className="font-medium text-slate-800">
              {achievementPct.toFixed(1)}%
            </span>
          </div>
          {report.originalFileName && (
            <div className="col-span-2 truncate">
              <span className="text-slate-500">Source: </span>
              <span className="font-medium text-slate-700">
                {report.originalFileName}
              </span>
            </div>
          )}
        </div>
      </div>

      {exactRows.length === 0 ? (
        <div className="border-t border-amber-200 bg-amber-50 px-4 py-5">
          <p className="text-sm font-semibold text-amber-800">
            Exact Excel rows are not available for this older upload.
          </p>
          <p className="mt-1 text-xs text-amber-700">
            Upload the Excel report again to preserve Txn Type, daily subtotal
            rows, blank separators and the final Total rows exactly.
          </p>
        </div>
      ) : (
        <div className="bg-slate-100 p-3 sm:p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-slate-900">
                Daily Excel Report
              </p>
              <p className="text-xs text-slate-500">
                Daily totals below are read from the Excel subtotal rows; they
                are not recalculated by this screen.
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                setExpandedDates(
                  allExpanded
                    ? new Set()
                    : new Set(dateGroups.map((group) => group.key)),
                )
              }
              className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-bold text-slate-700"
            >
              {allExpanded ? (
                <ChevronsUp className="h-4 w-4" />
              ) : (
                <ChevronsDown className="h-4 w-4" />
              )}
              {allExpanded ? 'Collapse All' : 'Expand All'}
            </button>
          </div>

          <div className="space-y-3">
            {dateGroups.map((group) => {
              const expanded = expandedDates.has(group.key);

              return (
                <section
                  key={group.key}
                  className="overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm"
                >
                  <button
                    type="button"
                    onClick={() => toggleDate(group.key)}
                    className="flex min-h-14 w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-slate-50 sm:px-4"
                  >
                    {expanded ? (
                      <ChevronDown className="h-5 w-5 shrink-0 text-slate-500" />
                    ) : (
                      <ChevronRight className="h-5 w-5 shrink-0 text-slate-500" />
                    )}

                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-slate-900">
                        {formatDate(group.txnDate)}
                      </p>
                      <p className="text-xs text-slate-500">
                        {group.invoiceRows.length} Excel Invoice row
                        {group.invoiceRows.length === 1 ? '' : 's'}
                      </p>
                    </div>

                    {group.subtotalRow && (
                      <div className="hidden shrink-0 items-center gap-6 text-right md:flex">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                            Qty
                          </p>
                          <p className="text-sm font-bold text-slate-800">
                            {fmt(group.subtotalRow.qty)}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                            Discount
                          </p>
                          <p className="text-sm font-bold text-slate-800">
                            {fmt(group.subtotalRow.discount)}
                          </p>
                        </div>
                        <div className="min-w-28">
                          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                            Sales With Tax
                          </p>
                          <p className="text-sm font-extrabold text-emerald-700">
                            {fmt(group.subtotalRow.salesWithTax)}
                          </p>
                        </div>
                      </div>
                    )}

                    {group.subtotalRow && (
                      <div className="shrink-0 text-right md:hidden">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                          Daily Total
                        </p>
                        <p className="text-sm font-extrabold text-emerald-700">
                          {fmt(group.subtotalRow.salesWithTax)}
                        </p>
                      </div>
                    )}
                  </button>

                  {expanded && (
                    <ExactExcelTable
                      rows={group.invoiceRows}
                      subtotal={group.subtotalRow}
                    />
                  )}
                </section>
              );
            })}
          </div>

          {grandTotalRow && (
            <section className="mt-4 overflow-hidden rounded-xl border-2 border-slate-500 bg-white shadow-sm">
              <div className="bg-slate-700 px-4 py-3 text-white">
                <h3 className="text-sm font-extrabold">
                  Total
                </h3>
              </div>

              <div className="grid grid-cols-1 gap-2.5 bg-slate-50 p-3 sm:grid-cols-3">
                <div className="min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-3">
                  <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">
                    Qty
                  </p>

                  <p className="mt-1 break-words text-lg font-black tabular-nums text-slate-900">
                    {fmt(grandTotalRow.qty)}
                  </p>
                </div>

                <div className="min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-3">
                  <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">
                    Discount
                  </p>

                  <p
                    className={`mt-1 break-words text-lg font-black tabular-nums ${
                      Number(grandTotalRow.discount ?? 0) < 0
                        ? 'text-red-600'
                        : 'text-slate-900'
                    }`}
                  >
                    {fmt(grandTotalRow.discount)}
                  </p>
                </div>

                <div className="min-w-0 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3">
                  <p className="text-[9px] font-bold uppercase tracking-wide text-emerald-600">
                    Sales With Tax
                  </p>

                  <p className="mt-1 break-words text-lg font-black tabular-nums text-emerald-700">
                    {fmt(grandTotalRow.salesWithTax)}
                  </p>
                </div>
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}