// @ts-nocheck
import { useState, useMemo, useRef, Fragment } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { salesSummaryApi } from '../../services/api/salesSummaryApi';
import type { SalesSummaryEntryRequest, SalesSummaryReportSummary, SalesSummaryEntry } from '../../services/api/salesSummaryApi';
import { regionsApi } from '../../services/api/regionsApi';
import toast from 'react-hot-toast';
import { formatCurrency } from '../../utils/formatters';
import * as XLSX from 'xlsx';
import {
  Upload, Trash2, FileDown, ChevronDown, ChevronRight,
  BarChart3, RefreshCw, AlertCircle, FileSpreadsheet,
} from 'lucide-react';
import ConfirmModal from '../../components/common/ConfirmModal';

const fmt = (n: number) =>
  n === 0 ? '0.00' : n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDate = (d: string | null) => {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const PERIOD_REGEX = /(\d{2}-\d{2}-\d{4})\s*-\s*(\d{2}-\d{2}-\d{4})/;

function parseDdMmYyyy(s: string): string | null {
  const m = s.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  const d = new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd)));
  return isNaN(d.getTime()) ? null : d.toISOString();
}

type SalesSummaryReportListItem = SalesSummaryReportSummary & {
  totalSalesWithTax: number | null;
};

function calculateSalesWithTaxTotal(reportDetail: any): number {
  const entries = reportDetail?.entries ?? [];
  const totalEntry = entries.find((entry: any) => entry.isTotal);

  if (totalEntry) {
    return Number(totalEntry.salesWithTax ?? 0);
  }

  return entries
    .filter((entry: any) => !entry.isTotal)
    .reduce(
      (sum: number, entry: any) =>
        sum + Number(entry.salesWithTax ?? 0),
      0,
    );
}

export default function AdminSalesSummary() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [selectedRegionId, setSelectedRegionId] = useState<string>('');
  const [uploadProgress, setUploadProgress] = useState<{ active: boolean } | null>(null);
  const [viewingReportId, setViewingReportId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; regionName: string } | null>(null);

  const { data: regions = [] } = useQuery({
    queryKey: ['regions'],
    queryFn: () => regionsApi.getAll().then(r => r.data),
  });

  const { data: reports = [], isLoading, isError, refetch } = useQuery<
    SalesSummaryReportListItem[]
  >({
    queryKey: ['admin-sales-summary'],
    queryFn: async () => {
      const summaries: SalesSummaryReportSummary[] =
        await salesSummaryApi
          .getAllReports()
          .then((response) => response.data.data);

      return Promise.all(
        summaries.map(async (summary) => {
          const summarySalesWithTax = Number(
            (summary as any).totalSalesWithTax,
          );

          if (Number.isFinite(summarySalesWithTax)) {
            return {
              ...summary,
              totalSalesWithTax: summarySalesWithTax,
            };
          }

          try {
            const reportDetail = await salesSummaryApi
              .getReportById(summary.id)
              .then((response) => response.data.data);

            qc.setQueryData(
              ['admin-sales-summary-detail', summary.id],
              reportDetail,
            );

            return {
              ...summary,
              totalSalesWithTax:
                calculateSalesWithTaxTotal(reportDetail),
            };
          } catch {
            return {
              ...summary,
              totalSalesWithTax: null,
            };
          }
        }),
      );
    },
  });

  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: ['admin-sales-summary-detail', viewingReportId],
    queryFn: () => salesSummaryApi.getReportById(viewingReportId!).then(r => r.data.data),
    enabled: !!viewingReportId,
  });

  const deleteMut = useMutation({
    mutationFn: (reportId: string) => salesSummaryApi.deleteReport(reportId),
    onSuccess: (_, reportId) => {
      toast.success('Report deleted');
      qc.invalidateQueries({ queryKey: ['admin-sales-summary'] });
      if (viewingReportId === reportId) setViewingReportId(null);
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Delete failed'),
  });

  // ── Client-side Excel parse ────────────────────────────────────────────────

  const parseExcelClientSide = (file: File): Promise<{
    entries: SalesSummaryEntryRequest[];
    periodFrom: string | null;
    periodTo: string | null;
  }> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const wb = XLSX.read(evt.target!.result, { type: 'array' });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' });

          // Find the header row containing "GroupName"
          const headerRowIdx = rows.findIndex(r =>
            r.some(cell => String(cell).trim().toLowerCase() === 'groupname'));
          if (headerRowIdx === -1) {
            reject(new Error('Header row with "GroupName" not found'));
            return;
          }

          const headerRow = rows[headerRowIdx].map(c => String(c).trim().toLowerCase());
          const colIdx = {
            groupName: headerRow.indexOf('groupname'),
            salesWithTax: headerRow.indexOf('sales with tax'),
            tax: headerRow.indexOf('tax'),
            netSales: headerRow.indexOf('net sales'),
            discount: headerRow.indexOf('discount'),
            grossSales: headerRow.indexOf('gross sales'),
          };

          // Look for the "dd-MM-yyyy - dd-MM-yyyy" period range in the rows above the header
          let periodFrom: string | null = null;
          let periodTo: string | null = null;
          for (let i = 0; i < headerRowIdx; i++) {
            const cell = String(rows[i]?.[0] ?? '');
            const m = cell.match(PERIOD_REGEX);
            if (m) {
              periodFrom = parseDdMmYyyy(m[1]);
              periodTo = parseDdMmYyyy(m[2]);
              break;
            }
          }

          const toNumber = (v: any): number => {
            if (v === null || v === undefined || v === '') return 0;
            if (typeof v === 'number') return v;
            const n = parseFloat(String(v).replace(/,/g, '').trim());
            return isNaN(n) ? 0 : n;
          };

          const entries: SalesSummaryEntryRequest[] = [];
          let sortOrder = 0;
          for (let i = headerRowIdx + 1; i < rows.length; i++) {
            const row = rows[i];
            if (!row || row.every(c => c === '' || c === null || c === undefined)) continue;

            const groupName = String(row[colIdx.groupName] ?? '').trim();
            const salesWithTax = toNumber(row[colIdx.salesWithTax]);
            const tax = toNumber(row[colIdx.tax]);
            const netSales = toNumber(row[colIdx.netSales]);
            const discount = toNumber(row[colIdx.discount]);
            const grossSales = toNumber(row[colIdx.grossSales]);

            if (!groupName && salesWithTax === 0 && netSales === 0 && grossSales === 0) continue;

            entries.push({
              groupName: groupName || 'Total',
              salesWithTax,
              tax,
              netSales,
              discount,
              grossSales,
              isTotal: !groupName,
              sortOrder: sortOrder++,
            });
          }

          resolve({ entries, periodFrom, periodTo });
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !selectedRegionId) return;

    setUploadProgress({ active: true });
    try {
      let parsed;
      try {
        parsed = await parseExcelClientSide(file);
      } catch {
        toast.error('Could not read Excel file. Make sure it matches the Sales Summary format.');
        setUploadProgress(null);
        return;
      }

      if (!parsed.entries.length) {
        toast.error('No data rows found in the file.');
        setUploadProgress(null);
        return;
      }

      await salesSummaryApi.upload({
        regionId: selectedRegionId,
        periodFrom: parsed.periodFrom,
        periodTo: parsed.periodTo,
        originalFileName: file.name,
        entries: parsed.entries,
      });

      await qc.invalidateQueries({ queryKey: ['admin-sales-summary'] });
      toast.success(`Uploaded: ${parsed.entries.filter(e => !e.isTotal).length} rows for ${regions.find(r => r.id === selectedRegionId)?.name ?? ''}`);
      setSelectedRegionId('');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Upload failed');
    } finally {
      setUploadProgress(null);
    }
  };

  // Regions that already have a report matching no particular period — used just for the "will replace" hint
  const regionHasReport = useMemo(
    () => new Set((reports as SalesSummaryReportSummary[]).map(r => r.regionId)),
    [reports],
  );

  const dataRows = useMemo(() => (detail?.entries ?? []).filter(e => !e.isTotal), [detail]);
  const totalRow = useMemo(() => (detail?.entries ?? []).find(e => e.isTotal), [detail]);

  const handleExportPdf = async () => {
    if (!detail) return;
    const { jsPDF } = await import('jspdf');
    const autoTable = (await import('jspdf-autotable')).default;

    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const margin = 10;
    const periodStr = detail.periodFrom && detail.periodTo
      ? `${fmtDate(detail.periodFrom)} - ${fmtDate(detail.periodTo)}`
      : '';

    doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
    doc.text('JANASIRI DISTRIBUTORS (PVT) LTD', margin, 10);
    doc.setFontSize(10);
    doc.text(`SALES SUMMARY / ${detail.regionName.toUpperCase()}`, margin, 16);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    doc.text(`PERIOD: ${periodStr}`, margin, 22);

    const head = [['Group', 'Sales With Tax', 'TAX', 'Net Sales', 'Discount', 'Gross Sales']];
    const body = dataRows.map(r => [
      r.groupName,
      { content: fmt(r.salesWithTax), styles: { halign: 'right' } },
      { content: fmt(r.tax), styles: { halign: 'right' } },
      { content: fmt(r.netSales), styles: { halign: 'right' } },
      { content: fmt(r.discount), styles: { halign: 'right' } },
      { content: fmt(r.grossSales), styles: { halign: 'right' } },
    ]);
    if (totalRow) {
      body.push([
        { content: 'TOTAL', styles: { fontStyle: 'bold' } },
        { content: fmt(totalRow.salesWithTax), styles: { fontStyle: 'bold', halign: 'right' } },
        { content: fmt(totalRow.tax), styles: { fontStyle: 'bold', halign: 'right' } },
        { content: fmt(totalRow.netSales), styles: { fontStyle: 'bold', halign: 'right' } },
        { content: fmt(totalRow.discount), styles: { fontStyle: 'bold', halign: 'right' } },
        { content: fmt(totalRow.grossSales), styles: { fontStyle: 'bold', halign: 'right' } },
      ]);
    }

    autoTable(doc, {
      head, body, startY: 27,
      margin: { left: margin, right: margin },
      headStyles: { fillColor: [255, 204, 0], textColor: [0, 0, 0], fontStyle: 'bold' },
      styles: { fontSize: 8 },
    });

    doc.save(`SalesSummary_${detail.regionName.replace(/\s+/g, '_')}.pdf`);
  };

  return (
    <div className="animate-fade-in space-y-5 pb-10">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Sales Summary</h1>
          <p className="text-sm text-slate-500 mt-0.5">Upload & manage daily sales summary reports by region</p>
        </div>
      </div>

      {/* Upload Panel */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 relative z-10">
        <h2 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
          <Upload className="w-4 h-4 text-emerald-600" /> Upload Excel Report
        </h2>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Region *</label>
            <select value={selectedRegionId} onChange={e => setSelectedRegionId(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 outline-none">
              <option value="">Select region…</option>
              {regions.map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <button
            disabled={!selectedRegionId || !!uploadProgress?.active}
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition">
            {uploadProgress?.active ? <RefreshCw className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
            {uploadProgress?.active ? 'Uploading…' : 'Choose Excel File'}
          </button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileSelect} />
        </div>
        {regionHasReport.has(selectedRegionId) && (
          <p className="mt-2 text-xs text-amber-600 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5" />
            A report may already exist for this region and period — uploading will replace it.
          </p>
        )}
      </div>

      {/* Reports Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-violet-600" />
            Uploaded Reports
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
            <FileSpreadsheet className="w-10 h-10 mx-auto text-slate-200 mb-3" />
            <p className="text-sm text-slate-400">No sales summary reports uploaded yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-[11px] uppercase tracking-wider">
                  <th className="text-left px-4 py-3 font-semibold">Region</th>
                  <th className="text-center px-3 py-3 font-semibold">Period</th>
                  <th className="text-center px-3 py-3 font-semibold">Rows</th>
                  <th className="text-right px-3 py-3 font-semibold">Sales With Tax</th>
                  <th className="text-center px-3 py-3 font-semibold">Uploaded</th>
                  <th className="text-center px-3 py-3 font-semibold">By</th>
                  <th className="w-32 px-3 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reports.map((r: SalesSummaryReportListItem) => (
                  <Fragment key={r.id}>
                    <tr className={`transition-colors ${viewingReportId === r.id ? 'bg-violet-50/40' : 'hover:bg-slate-50/60'}`}>
                      <td className="px-4 py-3 font-semibold text-slate-900">{r.regionName}</td>
                      <td className="px-3 py-3 text-center text-slate-600 whitespace-nowrap">
                        {r.periodFrom && r.periodTo ? `${fmtDate(r.periodFrom)} - ${fmtDate(r.periodTo)}` : '—'}
                      </td>
                      <td className="px-3 py-3 text-center text-slate-500">{r.rowCount}</td>
                      <td className="px-3 py-3 text-right font-semibold text-emerald-700">
                        {r.totalSalesWithTax === null
                          ? '—'
                          : formatCurrency(r.totalSalesWithTax)}
                      </td>
                      <td className="px-3 py-3 text-center text-slate-500 text-xs">{fmtDate(r.uploadedAt)}</td>
                      <td className="px-3 py-3 text-center text-slate-500 text-xs truncate max-w-[120px]">{r.uploadedBy || '—'}</td>
                      <td className="px-3 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => setViewingReportId(viewingReportId === r.id ? null : r.id)}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition flex items-center gap-1 ${
                              viewingReportId === r.id
                                ? 'text-violet-700 bg-violet-200 hover:bg-violet-300'
                                : 'text-violet-600 bg-violet-50 hover:bg-violet-100'
                            }`}>
                            {viewingReportId === r.id ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />} View
                          </button>
                          <button onClick={() => setDeleteTarget({ id: r.id, regionName: r.regionName })}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 transition">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {viewingReportId === r.id && (
                      <tr>
                        <td colSpan={7} className="p-0">
                          <div className="border-t-2 border-violet-200">
                            <div className="px-4 py-3 bg-violet-50/60 border-b border-slate-200 flex items-center justify-between flex-wrap gap-2">
                              <div>
                                <p className="text-xs font-bold text-slate-800">{detail?.regionName} — Sales Summary</p>
                                {detail?.originalFileName && <p className="text-[10px] text-slate-500 mt-0.5">Source: {detail.originalFileName}</p>}
                              </div>
                              <button onClick={handleExportPdf}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-600 text-white rounded-lg text-xs font-semibold hover:bg-slate-700 transition">
                                <FileDown className="w-3.5 h-3.5" /> Export PDF
                              </button>
                            </div>
                            {detailLoading ? (
                              <div className="py-10 text-center"><div className="w-6 h-6 border-4 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto" /></div>
                            ) : (
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
                                    {dataRows.map(row => (
                                      <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50/40 transition-colors">
                                        <td className="px-3 py-1.5 font-medium text-slate-700">{row.groupName}</td>
                                        <td className="px-3 py-1.5 text-right">{fmt(row.salesWithTax)}</td>
                                        <td className="px-3 py-1.5 text-right">{fmt(row.tax)}</td>
                                        <td className="px-3 py-1.5 text-right">{fmt(row.netSales)}</td>
                                        <td className={`px-3 py-1.5 text-right ${row.discount < 0 ? 'text-red-600' : ''}`}>{fmt(row.discount)}</td>
                                        <td className="px-3 py-1.5 text-right font-semibold">{fmt(row.grossSales)}</td>
                                      </tr>
                                    ))}
                                    {totalRow && (
                                      <tr className="sticky bottom-0 bg-amber-100 border-t-2 border-amber-400 font-bold text-[11px]">
                                        <td className="px-3 py-2.5 uppercase tracking-wide">Total</td>
                                        <td className="px-3 py-2.5 text-right border border-amber-300">{fmt(totalRow.salesWithTax)}</td>
                                        <td className="px-3 py-2.5 text-right border border-amber-300">{fmt(totalRow.tax)}</td>
                                        <td className="px-3 py-2.5 text-right border border-amber-300">{fmt(totalRow.netSales)}</td>
                                        <td className="px-3 py-2.5 text-right border border-amber-300">{fmt(totalRow.discount)}</td>
                                        <td className="px-3 py-2.5 text-right border border-amber-300">{fmt(totalRow.grossSales)}</td>
                                      </tr>
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmModal
        open={!!deleteTarget}
        title="Delete Report"
        description={`Delete the sales summary report for "${deleteTarget?.regionName}"? This cannot be undone.`}
        confirmLabel="Delete"
        confirmVariant="red"
        onConfirm={() => { if (deleteTarget) { deleteMut.mutate(deleteTarget.id); setDeleteTarget(null); } }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
