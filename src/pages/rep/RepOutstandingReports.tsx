// @ts-nocheck
import { useState, useMemo, Fragment } from 'react';
import { useQuery } from '@tanstack/react-query';
import { outstandingApi } from '../../services/api/outstandingApi';
import { formatCurrency } from '../../utils/formatters';
import { Search, FileDown, TrendingUp, ChevronDown, ChevronRight } from 'lucide-react';
import type { OutstandingEntry, OutstandingReportDetail } from '../../services/api/outstandingApi';

const fmt = (n: number) =>
  n === 0 ? '0.00' : n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDate = (d: string | null) => {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const fmtShortDate = (d: string | null) => {
  if (!d) return '';
  const dt = new Date(d);
  return `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()}`;
};

function RegionReportPanel({ report, isInline = false }: { report: OutstandingReportDetail; isInline?: boolean }) {
  const [search, setSearch] = useState('');
  // expandedCustomers: only listed names are expanded; empty Set = all collapsed (default)
  const [expandedCustomers, setExpandedCustomers] = useState<Set<string>>(new Set());
  const [selectedCustomers, setSelectedCustomers] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);

  const groupedEntries = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q
      ? report.entries.filter(e => e.customerName.toLowerCase().includes(q) || (e.refNo || '').toLowerCase().includes(q))
      : report.entries;
    const groups = new Map<string, OutstandingEntry[]>();
    for (const e of filtered) {
      if (!groups.has(e.customerName)) groups.set(e.customerName, []);
      groups.get(e.customerName)!.push(e);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [report.entries, search]);

  const toggleCustomer = (name: string) => {
    setExpandedCustomers(prev => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  };
  const expandAll    = () => setExpandedCustomers(new Set(groupedEntries.map(([n]) => n)));
  const collapseAll  = () => setExpandedCustomers(new Set());
  const toggleSelect = (name: string) => setSelectedCustomers(prev => {
    const next = new Set(prev); next.has(name) ? next.delete(name) : next.add(name); return next;
  });
  const selectAll   = () => setSelectedCustomers(new Set(groupedEntries.map(([n]) => n)));
  const deselectAll = () => setSelectedCustomers(new Set());

  const handleExportPdf = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const { jsPDF } = await import('jspdf');
      const autoTable = (await import('jspdf-autotable')).default;

      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 10;
      const reportDateStr = report.reportDate ? fmtDate(report.reportDate) : fmtDate(new Date().toISOString());

      const drawHeader = () => {
        doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(0, 0, 0);
        doc.text('JANASIRI DISTRIBUTORS (PVT) LTD', margin, 10);
        doc.setFontSize(10);
        doc.text(`CUSTOMER AGEING DETAILS / ${report.regionName.toUpperCase()}`, margin, 16);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
        doc.text(`DATE AS OF :  ${reportDateStr}`, margin, 22);
      };
      drawHeader();

      const YELLOW: [number, number, number] = [255, 204, 0];
      const BLACK: [number, number, number] = [0, 0, 0];
      const WHITE: [number, number, number] = [255, 255, 255];
      const LGREY: [number, number, number] = [245, 245, 245];

      const head = [['Txn', 'RefNo', 'Date', 'AgeDays', 'Current', '1-15', '16-30', '31-45', 'Above 45', 'Balance']];
      const body: any[][] = [];

      for (const [customer, rows] of groupedEntries) {
        body.push([{ content: customer, colSpan: 10, styles: { fontStyle: 'bold', fontSize: 8.5, fillColor: LGREY, textColor: BLACK, cellPadding: { top: 1.5, bottom: 1.5, left: 3, right: 3 } } }]);
        for (const row of rows) {
          if (row.isTotal) {
            body.push([
              { content: '', colSpan: 4, styles: { lineWidth: 0, fillColor: WHITE } },
              ...[row.current, row.bucket1_15, row.bucket16_30, row.bucket31_45, row.above45, row.balance].map((v, i) => ({
                content: fmt(v), styles: { fontStyle: 'bold', halign: 'right', textColor: (i === 4 && v > 0) || (i === 5 && v < 0) ? [200, 0, 0] : BLACK }
              })),
            ]);
          } else {
            body.push([
              row.txnType || '', row.refNo || '',
              row.txnDate ? fmtShortDate(row.txnDate) : '',
              row.ageDays != null ? String(row.ageDays) : '',
              { content: row.current ? fmt(row.current) : '', styles: { halign: 'right' } },
              { content: row.bucket1_15 ? fmt(row.bucket1_15) : '', styles: { halign: 'right' } },
              { content: row.bucket16_30 ? fmt(row.bucket16_30) : '', styles: { halign: 'right' } },
              { content: row.bucket31_45 ? fmt(row.bucket31_45) : '', styles: { halign: 'right' } },
              { content: row.above45 ? fmt(row.above45) : '', styles: { halign: 'right', textColor: row.above45 > 0 ? [200, 0, 0] : BLACK } },
              { content: fmt(row.balance), styles: { halign: 'right', textColor: row.balance < 0 ? [200, 0, 0] : BLACK } },
            ]);
          }
        }
      }

      autoTable(doc, {
        head, body, startY: 27,
        margin: { left: margin, right: margin, top: 27, bottom: 10 },
        tableWidth: pageW - margin * 2,
        styles: { fontSize: 7, cellPadding: { top: 1.2, bottom: 1.2, left: 1.5, right: 1.5 }, lineColor: [200, 200, 200], lineWidth: 0.15, textColor: BLACK, fillColor: WHITE, overflow: 'linebreak' },
        headStyles: { fillColor: YELLOW, textColor: BLACK, fontStyle: 'bold', fontSize: 7.5, halign: 'center', lineColor: [120, 120, 120], lineWidth: 0.2, cellPadding: { top: 1.8, bottom: 1.8, left: 1.5, right: 1.5 } },
        alternateRowStyles: { fillColor: WHITE },
        columnStyles: {
          0: { cellWidth: 22 }, 1: { cellWidth: 22 }, 2: { cellWidth: 20, halign: 'center' },
          3: { cellWidth: 16, halign: 'center' }, 4: { cellWidth: 30, halign: 'right' },
          5: { cellWidth: 30, halign: 'right' }, 6: { cellWidth: 30, halign: 'right' },
          7: { cellWidth: 30, halign: 'right' }, 8: { cellWidth: 30, halign: 'right' },
          9: { cellWidth: 'auto', halign: 'right' },
        },
        didDrawPage: (hookData) => {
          if (hookData.pageNumber > 1) drawHeader();
          doc.setFontSize(6.5); doc.setTextColor(100, 100, 100);
          doc.text(`JANASIRI DISTRIBUTORS (PVT) LTD  |  Customer Ageing  |  ${report.regionName}  |  ${reportDateStr}`, margin, pageH - 4);
          doc.text(`Page ${hookData.pageNumber} of ${(doc as any).internal.getNumberOfPages()}`, pageW - margin, pageH - 4, { align: 'right' });
        },
      });

      doc.save(`Outstanding_${report.regionName.replace(/\s+/g, '_')}_${reportDateStr.replace(/\s/g, '_')}.pdf`);
    } catch (err) {
      console.error('PDF export failed', err);
    } finally {
      setExporting(false);
    }
  };

  // Export selected customers to one PDF
  const exportSelectedPdf = async () => {
    if (selectedCustomers.size === 0) return;
    try {
      const { jsPDF } = await import('jspdf');
      const autoTable = (await import('jspdf-autotable')).default;
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 10;
      const reportDateStr = report.reportDate ? fmtDate(report.reportDate) : fmtDate(new Date().toISOString());
      const YELLOW: [number,number,number] = [255,204,0];
      const BLACK: [number,number,number]  = [0,0,0];
      const WHITE: [number,number,number]  = [255,255,255];
      const LGREY: [number,number,number]  = [245,245,245];
      const drawHeader = () => {
        doc.setFont('helvetica','bold'); doc.setFontSize(13); doc.setTextColor(0,0,0);
        doc.text('JANASIRI DISTRIBUTORS (PVT) LTD', margin, 10);
        doc.setFontSize(10);
        doc.text(`CUSTOMER AGEING DETAILS / ${report.regionName.toUpperCase()}`, margin, 16);
        doc.setFont('helvetica','normal'); doc.setFontSize(9);
        doc.text(`DATE AS OF: ${reportDateStr}`, margin, 22);
      };
      drawHeader();
      const head = [['Txn','RefNo','Date','AgeDays','Current','1-15','16-30','31-45','Above 45','Balance']];
      const body: any[][] = [];
      for (const [customer, rows] of groupedEntries) {
        if (!selectedCustomers.has(customer)) continue;
        body.push([{ content: customer, colSpan: 10, styles: { fontStyle: 'bold', fontSize: 8.5, fillColor: LGREY, textColor: BLACK, cellPadding: { top: 1.5, bottom: 1.5, left: 3, right: 3 } } }]);
        for (const row of rows) {
          if (row.isTotal) {
            body.push([
              { content: '', colSpan: 4, styles: { lineWidth: 0, fillColor: WHITE } },
              { content: fmt(row.current),    styles: { fontStyle: 'bold', halign: 'right' } },
              { content: fmt(row.bucket1_15), styles: { fontStyle: 'bold', halign: 'right' } },
              { content: fmt(row.bucket16_30),styles: { fontStyle: 'bold', halign: 'right' } },
              { content: fmt(row.bucket31_45),styles: { fontStyle: 'bold', halign: 'right' } },
              { content: fmt(row.above45),    styles: { fontStyle: 'bold', halign: 'right', textColor: row.above45>0?[200,0,0]:BLACK } },
              { content: fmt(row.balance),    styles: { fontStyle: 'bold', halign: 'right', textColor: row.balance<0?[200,0,0]:BLACK } },
            ]);
          } else {
            body.push([
              row.txnType||'', row.refNo||'',
              row.txnDate ? fmtShortDate(row.txnDate) : '',
              row.ageDays!=null ? String(row.ageDays) : '',
              { content: row.current     ? fmt(row.current)    : '', styles: { halign: 'right' } },
              { content: row.bucket1_15  ? fmt(row.bucket1_15) : '', styles: { halign: 'right' } },
              { content: row.bucket16_30 ? fmt(row.bucket16_30): '', styles: { halign: 'right' } },
              { content: row.bucket31_45 ? fmt(row.bucket31_45): '', styles: { halign: 'right' } },
              { content: row.above45     ? fmt(row.above45)    : '', styles: { halign: 'right', textColor: row.above45>0?[200,0,0]:BLACK } },
              { content: fmt(row.balance), styles: { halign: 'right', textColor: row.balance<0?[200,0,0]:BLACK } },
            ]);
          }
        }
      }
      autoTable(doc, {
        head, body, startY: 27,
        margin: { left: margin, right: margin, top: 27, bottom: 10 },
        tableWidth: pageW - margin * 2,
        styles: { fontSize: 7, cellPadding: { top: 1.2, bottom: 1.2, left: 1.5, right: 1.5 }, lineColor: [200,200,200], lineWidth: 0.15, textColor: BLACK, fillColor: WHITE, overflow: 'linebreak' },
        headStyles: { fillColor: YELLOW, textColor: BLACK, fontStyle: 'bold', fontSize: 7.5, halign: 'center', lineColor: [120,120,120], lineWidth: 0.2, cellPadding: { top: 1.8, bottom: 1.8, left: 1.5, right: 1.5 } },
        alternateRowStyles: { fillColor: WHITE },
        columnStyles: {
          0:{cellWidth:22},1:{cellWidth:22},2:{cellWidth:20,halign:'center'},
          3:{cellWidth:16,halign:'center'},4:{cellWidth:30,halign:'right'},
          5:{cellWidth:30,halign:'right'},6:{cellWidth:30,halign:'right'},
          7:{cellWidth:30,halign:'right'},8:{cellWidth:30,halign:'right'},
          9:{cellWidth:'auto',halign:'right'},
        },
        didDrawPage: (hookData) => {
          if (hookData.pageNumber > 1) drawHeader();
          doc.setFontSize(6.5); doc.setTextColor(100,100,100);
          doc.text(`JANASIRI DISTRIBUTORS (PVT) LTD  |  Customer Ageing  |  ${report.regionName}  |  ${reportDateStr}`, margin, pageH-4);
          doc.text(`Page ${hookData.pageNumber} of ${(doc as any).internal.getNumberOfPages()}`, pageW-margin, pageH-4, { align:'right' });
        },
      });
      doc.save(`Outstanding_Selected_${report.regionName.replace(/\s+/g,'_')}_${reportDateStr.replace(/\s/g,'_')}.pdf`);
    } catch (err) {
      console.error('Export selected PDF failed', err);
    }
  };

  return (
    <div className={isInline ? '' : 'bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden'}>
      {/* Panel header — hidden in inline mode (region shown in summary row) */}
      {!isInline && (
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3 bg-gradient-to-r from-violet-50 to-white">
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-violet-600" />
              {report.regionName}
            </h2>
            {report.reportDate && (
              <p className="text-xs text-slate-500 mt-0.5">Date as of: {fmtDate(report.reportDate)}</p>
            )}
          </div>
        </div>
      )}
      {/* Toolbar */}
      <div className={`px-4 py-3 border-b border-slate-200 flex items-center justify-between flex-wrap gap-2 ${isInline ? 'bg-violet-50/60' : 'bg-gradient-to-r from-violet-50 to-white'}`}>
        <div className="flex items-center gap-2 flex-wrap">
            <button onClick={selectAll}   className="px-2.5 py-1.5 text-[11px] font-semibold text-violet-600 bg-violet-50 rounded-lg hover:bg-violet-100 transition">Select All</button>
            <button onClick={deselectAll} className="px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition">Deselect All</button>
            <button onClick={expandAll}   className="px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition">Expand All</button>
            <button onClick={collapseAll} className="px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition">Collapse All</button>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search customer / ref…"
                className="pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm w-52 focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 outline-none" />
            </div>
            {selectedCustomers.size > 0 && (
              <button onClick={exportSelectedPdf}
                className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-xl text-sm font-semibold hover:bg-violet-700 transition">
                <FileDown className="w-4 h-4" /> Export Selected ({selectedCustomers.size})
              </button>
            )}
            <button onClick={handleExportPdf} disabled={exporting}
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-600 text-white rounded-xl text-sm font-semibold hover:bg-slate-700 disabled:opacity-50 transition">
              <FileDown className="w-4 h-4" /> {exporting ? 'Exporting…' : 'Export All'}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-amber-400 text-slate-900">
              <th className="w-8 px-2 py-2.5 border border-amber-300 text-center">
                <input type="checkbox" className="w-3.5 h-3.5 accent-violet-600 cursor-pointer"
                  checked={selectedCustomers.size === groupedEntries.length && groupedEntries.length > 0}
                  onChange={() => selectedCustomers.size === groupedEntries.length ? deselectAll() : selectAll()} />
              </th>
              {['Txn Type', 'RefNo', 'Date', 'Age Days', 'Current', '1-15', '16-30', '31-45', 'Above 45', 'Balance'].map(h => (
                <th key={h} className={`px-3 py-2.5 font-bold text-[11px] border border-amber-300 ${['Current', '1-15', '16-30', '31-45', 'Above 45', 'Balance'].includes(h) ? 'text-right' : 'text-left'}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groupedEntries.length === 0 ? (
              <tr><td colSpan={10} className="py-10 text-center text-slate-400">No matching results</td></tr>
            ) : groupedEntries.map(([customer, rows]) => {
              const isExpanded = expandedCustomers.has(customer);
              const isSelected = selectedCustomers.has(customer);
              const totalRow = rows.find(r => r.isTotal);
              return (
                <>
                  <tr key={`hdr-${customer}`}
                    className={`border-y border-emerald-200 cursor-pointer transition ${isSelected ? 'bg-violet-100 hover:bg-violet-200' : 'bg-emerald-50 hover:bg-emerald-100'}`}
                    onClick={() => toggleCustomer(customer)}>
                    <td className="px-2 py-2 text-center" onClick={e => e.stopPropagation()}>
                      <input type="checkbox" className="w-3.5 h-3.5 accent-violet-600 cursor-pointer"
                        checked={isSelected} onChange={() => toggleSelect(customer)} />
                    </td>
                    <td colSpan={4} className="px-3 py-2 font-bold text-slate-800 text-[11px]">
                      <span className="mr-2 text-emerald-600">{isExpanded ? '▼' : '▶'}</span>{customer}
                    </td>
                    {!isExpanded && totalRow ? (
                      <>
                        <td className="px-3 py-2 text-right font-bold">{fmt(totalRow.current)}</td>
                        <td className="px-3 py-2 text-right font-bold">{fmt(totalRow.bucket1_15)}</td>
                        <td className="px-3 py-2 text-right font-bold">{fmt(totalRow.bucket16_30)}</td>
                        <td className="px-3 py-2 text-right font-bold">{fmt(totalRow.bucket31_45)}</td>
                        <td className={`px-3 py-2 text-right font-bold ${totalRow.above45 > 0 ? 'text-red-600' : ''}`}>{fmt(totalRow.above45)}</td>
                        <td className={`px-3 py-2 text-right font-bold ${totalRow.balance < 0 ? 'text-red-600' : ''}`}>{fmt(totalRow.balance)}</td>
                      </>
                    ) : <td colSpan={6} />}
                  </tr>
                  {isExpanded && rows.map(row => (
                    row.isTotal ? (
                      <tr key={row.id} className="bg-slate-50 border-t-2 border-slate-300 font-bold">
                        <td className="px-2 py-1.5" />
                        <td colSpan={4} className="px-3 py-1.5" />
                        <td className="px-3 py-1.5 text-right border border-slate-200">{fmt(row.current)}</td>
                        <td className="px-3 py-1.5 text-right border border-slate-200">{fmt(row.bucket1_15)}</td>
                        <td className="px-3 py-1.5 text-right border border-slate-200">{fmt(row.bucket16_30)}</td>
                        <td className="px-3 py-1.5 text-right border border-slate-200">{fmt(row.bucket31_45)}</td>
                        <td className={`px-3 py-1.5 text-right border border-slate-200 ${row.above45 > 0 ? 'text-red-600' : ''}`}>{fmt(row.above45)}</td>
                        <td className={`px-3 py-1.5 text-right border border-slate-200 ${row.balance < 0 ? 'text-red-600' : ''}`}>{fmt(row.balance)}</td>
                      </tr>
                    ) : (
                      <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50/40 transition-colors">
                        <td className="px-2 py-1.5" />
                        <td className="px-3 py-1.5 text-slate-600">{row.txnType}</td>
                        <td className="px-3 py-1.5 font-mono text-slate-700">{row.refNo}</td>
                        <td className="px-3 py-1.5 text-slate-500 whitespace-nowrap">{row.txnDate ? fmtShortDate(row.txnDate) : ''}</td>
                        <td className="px-3 py-1.5 text-center text-slate-500">{row.ageDays}</td>
                        <td className="px-3 py-1.5 text-right">{row.current ? fmt(row.current) : ''}</td>
                        <td className="px-3 py-1.5 text-right">{row.bucket1_15 ? fmt(row.bucket1_15) : ''}</td>
                        <td className="px-3 py-1.5 text-right">{row.bucket16_30 ? fmt(row.bucket16_30) : ''}</td>
                        <td className="px-3 py-1.5 text-right">{row.bucket31_45 ? fmt(row.bucket31_45) : ''}</td>
                        <td className={`px-3 py-1.5 text-right ${row.above45 > 0 ? 'text-red-600 font-semibold' : ''}`}>{row.above45 ? fmt(row.above45) : ''}</td>
                        <td className={`px-3 py-1.5 text-right font-semibold ${row.balance < 0 ? 'text-red-600' : 'text-slate-900'}`}>{fmt(row.balance)}</td>
                      </tr>
                    )
                  ))}
                </>
              );
            })}
            {/* no grand total row - not in source data */}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function RepOutstandingReports() {
  const [expandedReportId, setExpandedReportId] = useState<string | null>(null);

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['rep-outstanding-reports'],
    queryFn: () => outstandingApi.getRepReports().then(r => r.data.data),
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="animate-fade-in space-y-5 pb-10">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Outstanding Reports</h1>
          <p className="text-sm text-slate-500 mt-0.5">Customer ageing reports for your regions</p>
        </div>
        <div className="py-20 text-center">
          <div className="w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-slate-500 mt-4">Loading reports…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-5 pb-10">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Outstanding Reports</h1>
        <p className="text-sm text-slate-500 mt-0.5">Customer ageing reports for your assigned regions</p>
      </div>

      {reports.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-200 py-20 text-center">
          <TrendingUp className="w-12 h-12 mx-auto text-slate-200 mb-4" />
          <p className="text-lg font-semibold text-slate-700">No reports available</p>
          <p className="text-sm text-slate-400 mt-1">Outstanding reports for your regions will appear here once uploaded by admin</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-violet-600" />
            <h2 className="text-sm font-bold text-slate-800">Uploaded Reports</h2>
            <span className="px-2 py-0.5 bg-violet-100 text-violet-700 text-[10px] font-bold rounded-full">{reports.length}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-[11px] uppercase tracking-wider">
                  <th className="text-left px-4 py-3 font-semibold">Region</th>
                  <th className="text-center px-3 py-3 font-semibold">Report Date</th>
                  <th className="text-center px-3 py-3 font-semibold">Customers</th>
                  <th className="text-center px-3 py-3 font-semibold">Rows</th>
                  <th className="w-24 px-3 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reports.map((report: OutstandingReportDetail) => (
                  <Fragment key={report.id}>
                    <tr className={`transition-colors ${expandedReportId === report.id ? 'bg-violet-50/40' : 'hover:bg-slate-50/60'}`}>
                      <td className="px-4 py-3 font-semibold text-slate-900">{report.regionName}</td>
                      <td className="px-3 py-3 text-center text-slate-600">{fmtDate(report.reportDate)}</td>
                      <td className="px-3 py-3 text-center">
                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-full">
                          {new Set(report.entries.map(e => e.customerName)).size}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center text-slate-500">{report.entries.length}</td>
                      <td className="px-3 py-3 text-right">
                        <button onClick={() => setExpandedReportId(expandedReportId === report.id ? null : report.id)}
                          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition flex items-center gap-1 ml-auto ${
                            expandedReportId === report.id
                              ? 'text-violet-700 bg-violet-200 hover:bg-violet-300'
                              : 'text-violet-600 bg-violet-50 hover:bg-violet-100'
                          }`}>
                          {expandedReportId === report.id ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />} View
                        </button>
                      </td>
                    </tr>
                    {expandedReportId === report.id && (
                      <tr>
                        <td colSpan={5} className="p-0">
                          <div className="border-t-2 border-violet-200">
                            <RegionReportPanel report={report} isInline={true} />
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
