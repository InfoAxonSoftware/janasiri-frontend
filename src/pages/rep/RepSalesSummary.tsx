// @ts-nocheck
import { useState, useMemo, Fragment } from 'react';
import { useQuery } from '@tanstack/react-query';
import { salesSummaryApi } from '../../services/api/salesSummaryApi';
import { formatCurrency } from '../../utils/formatters';
import {
  FileDown, ChevronDown, ChevronRight,
  BarChart3, AlertCircle,
} from 'lucide-react';
import type { SalesSummaryReportDetail } from '../../services/api/salesSummaryApi';

const fmt = (n: number) =>
  n === 0 ? '0.00' : n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDate = (d: string | null) => {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

export default function RepSalesSummary() {
  const [viewingReportId, setViewingReportId] = useState<string | null>(null);

  const { data: reports = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['rep-sales-summary'],
    queryFn: () => salesSummaryApi.getRepReports().then(r => r.data.data),
    staleTime: 5 * 60 * 1000,
  });

  const viewingReport = useMemo(
    () => reports.find((r: SalesSummaryReportDetail) => r.id === viewingReportId) ?? null,
    [reports, viewingReportId],
  );
  const dataRows = useMemo(() => (viewingReport?.entries ?? []).filter(e => !e.isTotal), [viewingReport]);
  const totalRow = useMemo(() => (viewingReport?.entries ?? []).find(e => e.isTotal), [viewingReport]);

  const handleExportPdf = async (report: SalesSummaryReportDetail) => {
    const dRows = report.entries.filter(e => !e.isTotal);
    const tRow = report.entries.find(e => e.isTotal);

    const { jsPDF } = await import('jspdf');
    const autoTable = (await import('jspdf-autotable')).default;

    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const margin = 10;
    const periodStr = report.periodFrom && report.periodTo
      ? `${fmtDate(report.periodFrom)} - ${fmtDate(report.periodTo)}`
      : '';

    doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
    doc.text('JANASIRI DISTRIBUTORS (PVT) LTD', margin, 10);
    doc.setFontSize(10);
    doc.text(`SALES SUMMARY / ${report.regionName.toUpperCase()}`, margin, 16);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    doc.text(`PERIOD: ${periodStr}`, margin, 22);

    const head = [['Group', 'Sales With Tax', 'TAX', 'Net Sales', 'Discount', 'Gross Sales']];
    const body = dRows.map(r => [
      r.groupName,
      { content: fmt(r.salesWithTax), styles: { halign: 'right' } },
      { content: fmt(r.tax), styles: { halign: 'right' } },
      { content: fmt(r.netSales), styles: { halign: 'right' } },
      { content: fmt(r.discount), styles: { halign: 'right' } },
      { content: fmt(r.grossSales), styles: { halign: 'right' } },
    ]);
    if (tRow) {
      body.push([
        { content: 'TOTAL', styles: { fontStyle: 'bold' } },
        { content: fmt(tRow.salesWithTax), styles: { fontStyle: 'bold', halign: 'right' } },
        { content: fmt(tRow.tax), styles: { fontStyle: 'bold', halign: 'right' } },
        { content: fmt(tRow.netSales), styles: { fontStyle: 'bold', halign: 'right' } },
        { content: fmt(tRow.discount), styles: { fontStyle: 'bold', halign: 'right' } },
        { content: fmt(tRow.grossSales), styles: { fontStyle: 'bold', halign: 'right' } },
      ]);
    }

    autoTable(doc, {
      head, body, startY: 27,
      margin: { left: margin, right: margin },
      headStyles: { fillColor: [255, 204, 0], textColor: [0, 0, 0], fontStyle: 'bold' },
      styles: { fontSize: 8 },
    });

    doc.save(`SalesSummary_${report.regionName.replace(/\s+/g, '_')}.pdf`);
  };

  const toggleView = (id: string) => setViewingReportId(viewingReportId === id ? null : id);

  const DetailTable = ({ report }: { report: SalesSummaryReportDetail }) => {
    const rows = report.entries.filter(e => !e.isTotal);
    const total = report.entries.find(e => e.isTotal);
    return (
      <div className="border-t-2 border-violet-200">
        <div className="px-4 py-3 bg-violet-50/60 border-b border-slate-200 flex items-center justify-between flex-wrap gap-2">
          <div>
            <p className="text-xs font-bold text-slate-800">{report.regionName} — Sales Summary</p>
            {report.originalFileName && <p className="text-[10px] text-slate-500 mt-0.5">Source: {report.originalFileName}</p>}
          </div>
          <button onClick={() => handleExportPdf(report)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-600 text-white rounded-lg text-xs font-semibold hover:bg-slate-700 transition">
            <FileDown className="w-3.5 h-3.5" /> Export PDF
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-amber-400 text-slate-900">
                {['Group', 'Sales With Tax', 'TAX', 'Net Sales', 'Discount', 'Gross Sales'].map(h => (
                  <th key={h} className={`px-3 py-2.5 font-bold text-[11px] border border-amber-300 ${h === 'Group' ? 'text-left' : 'text-right'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50/40 transition-colors">
                  <td className="px-3 py-1.5 font-medium text-slate-700">{row.groupName}</td>
                  <td className="px-3 py-1.5 text-right">{fmt(row.salesWithTax)}</td>
                  <td className="px-3 py-1.5 text-right">{fmt(row.tax)}</td>
                  <td className="px-3 py-1.5 text-right">{fmt(row.netSales)}</td>
                  <td className={`px-3 py-1.5 text-right ${row.discount < 0 ? 'text-red-600' : ''}`}>{fmt(row.discount)}</td>
                  <td className="px-3 py-1.5 text-right font-semibold">{fmt(row.grossSales)}</td>
                </tr>
              ))}
              {total && (
                <tr className="sticky bottom-0 bg-amber-100 border-t-2 border-amber-400 font-bold text-[11px]">
                  <td className="px-3 py-2.5 uppercase tracking-wide">Total</td>
                  <td className="px-3 py-2.5 text-right border border-amber-300">{fmt(total.salesWithTax)}</td>
                  <td className="px-3 py-2.5 text-right border border-amber-300">{fmt(total.tax)}</td>
                  <td className="px-3 py-2.5 text-right border border-amber-300">{fmt(total.netSales)}</td>
                  <td className="px-3 py-2.5 text-right border border-amber-300">{fmt(total.discount)}</td>
                  <td className="px-3 py-2.5 text-right border border-amber-300">{fmt(total.grossSales)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="animate-fade-in space-y-5 pb-10">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Sales Summary</h1>
        <p className="text-sm text-slate-500 mt-0.5">Daily sales summary reports for your assigned regions</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-violet-600" />
            Reports
            {reports.length > 0 && <span className="px-2 py-0.5 bg-violet-100 text-violet-700 text-[10px] font-bold rounded-full">{reports.length}</span>}
          </h2>
        </div>

        {isLoading ? (
          <div className="py-14 text-center"><div className="w-7 h-7 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" /></div>
        ) : isError ? (
          <div className="py-14 text-center space-y-2">
            <AlertCircle className="w-8 h-8 mx-auto text-red-300" />
            <p className="text-sm text-slate-400">Failed to load reports.</p>
            <button onClick={() => refetch()} className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 hover:bg-slate-50">Retry</button>
          </div>
        ) : reports.length === 0 ? (
          <div className="py-14 text-center">
            <BarChart3 className="w-10 h-10 mx-auto text-slate-200 mb-3" />
            <p className="text-sm text-slate-400">No sales summary reports available</p>
            <p className="text-xs text-slate-400 mt-1 px-4">Reports for your regions will appear here once uploaded by admin</p>
          </div>
        ) : (
          <>
            {/* Desktop / tablet — same table layout as Admin Sales Summary */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-[11px] uppercase tracking-wider">
                    <th className="text-left px-4 py-3 font-semibold">Region</th>
                    <th className="text-center px-3 py-3 font-semibold">Period</th>
                    <th className="text-center px-3 py-3 font-semibold">Rows</th>
                    <th className="text-right px-3 py-3 font-semibold">Sales With Tax</th>
                    <th className="text-center px-3 py-3 font-semibold">Uploaded</th>
                    <th className="w-24 px-3 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {reports.map((r: SalesSummaryReportDetail) => {
                    const total = r.entries.find(e => e.isTotal);
                    const rowCount = r.entries.filter(e => !e.isTotal).length;
                    return (
                      <Fragment key={r.id}>
                        <tr className={`transition-colors ${viewingReportId === r.id ? 'bg-violet-50/40' : 'hover:bg-slate-50/60'}`}>
                          <td className="px-4 py-3 font-semibold text-slate-900">{r.regionName}</td>
                          <td className="px-3 py-3 text-center text-slate-600 whitespace-nowrap">
                            {r.periodFrom && r.periodTo ? `${fmtDate(r.periodFrom)} - ${fmtDate(r.periodTo)}` : '—'}
                          </td>
                          <td className="px-3 py-3 text-center text-slate-500">{rowCount}</td>
                          <td className="px-3 py-3 text-right font-semibold text-emerald-700">{formatCurrency(total?.salesWithTax ?? 0)}</td>
                          <td className="px-3 py-3 text-center text-slate-500 text-xs whitespace-nowrap">
                            {fmtDate(r.uploadedAt)}
                          </td>
                          <td className="px-3 py-3 text-right">
                            <button onClick={() => toggleView(r.id)}
                              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition flex items-center gap-1 ml-auto ${
                                viewingReportId === r.id
                                  ? 'text-violet-700 bg-violet-200 hover:bg-violet-300'
                                  : 'text-violet-600 bg-violet-50 hover:bg-violet-100'
                              }`}>
                              {viewingReportId === r.id ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />} View
                            </button>
                          </td>
                        </tr>
                        {viewingReportId === r.id && (
                          <tr>
                            <td colSpan={6} className="p-0">
                              <DetailTable report={r} />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile — stacked region cards */}
            <div className="sm:hidden divide-y divide-slate-100">
              {reports.map((r: SalesSummaryReportDetail) => {
                const total = r.entries.find(e => e.isTotal);
                const rowCount = r.entries.filter(e => !e.isTotal).length;
                return (
                  <div key={r.id}>
                    <div className="px-4 py-4 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">{r.regionName}</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {r.periodFrom && r.periodTo ? `${fmtDate(r.periodFrom)} - ${fmtDate(r.periodTo)}` : '—'}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">{rowCount} rows</p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Uploaded: {fmtDate(r.uploadedAt)}
                        </p>
                        <p className="text-base font-bold text-emerald-700 mt-1">{formatCurrency(total?.salesWithTax ?? 0)}</p>
                      </div>
                      <button onClick={() => toggleView(r.id)}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition flex items-center gap-1 flex-shrink-0 ${
                          viewingReportId === r.id
                            ? 'text-violet-700 bg-violet-200 hover:bg-violet-300'
                            : 'text-violet-600 bg-violet-50 hover:bg-violet-100'
                        }`}>
                        {viewingReportId === r.id ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />} View
                      </button>
                    </div>
                    {viewingReportId === r.id && <DetailTable report={r} />}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}