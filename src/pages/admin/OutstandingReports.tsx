// @ts-nocheck
import { useState, useMemo, useRef, useEffect, Fragment } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { outstandingApi } from '../../services/api/outstandingApi';
import type { OutstandingEntryRequest } from '../../services/api/outstandingApi';
import { regionsApi } from '../../services/api/regionsApi';
import toast from 'react-hot-toast';
import { formatCurrency } from '../../utils/formatters';
import * as XLSX from 'xlsx';
import {
  Upload, Trash2, Search, FileDown, ChevronDown, ChevronRight,
  TrendingUp, RefreshCw, AlertCircle, FileSpreadsheet, ChevronsUpDown
} from 'lucide-react';
import type { OutstandingEntry, OutstandingReportDetail, OutstandingReportSummary } from '../../services/api/outstandingApi';
import ConfirmModal from '../../components/common/ConfirmModal';

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

export default function AdminOutstandingReports() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [selectedRegionId, setSelectedRegionId] = useState<string>('');
  const [reportDate, setReportDate] = useState<string>(new Date().toISOString().substring(0, 10));
  const [search, setSearch] = useState('');
  const [expandedRegion, setExpandedRegion] = useState<string | null>(null);
  // expandedCustomers: only listed names are expanded; empty = all collapsed (default)
  const [expandedCustomers, setExpandedCustomers] = useState<Set<string>>(new Set());
  const [selectedCustomers, setSelectedCustomers] = useState<Set<string>>(new Set());
  const [viewingRegionId, setViewingRegionId] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<{ active: boolean; total: number; processed: number } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ regionId: string; regionName: string } | null>(null);

  // Reset expand + selection whenever the viewed region changes
  useEffect(() => {
    setExpandedCustomers(new Set());
    setSelectedCustomers(new Set());
  }, [viewingRegionId]);

  // Data queries
  const { data: regions = [] } = useQuery({
    queryKey: ['regions'],
    queryFn: () => regionsApi.getAll().then(r => r.data),
  });

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['admin-outstanding-reports'],
    queryFn: () => outstandingApi.getAllReports().then(r => r.data.data),
  });

  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: ['admin-outstanding-detail', viewingRegionId],
    queryFn: () => outstandingApi.getReportByRegion(viewingRegionId!).then(r => r.data.data),
    enabled: !!viewingRegionId,
  });

  // Delete mutation
  const deleteMut = useMutation({
    mutationFn: (regionId: string) => outstandingApi.deleteReport(regionId),
    onSuccess: (_, regionId) => {
      toast.success('Report deleted');
      qc.invalidateQueries({ queryKey: ['admin-outstanding-reports'] });
      if (viewingRegionId === regionId) setViewingRegionId(null);
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Delete failed'),
  });

  // ── Client-side Excel parse ────────────────────────────────────────────────

  const parseExcelClientSide = (file: File): Promise<OutstandingEntryRequest[]> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const wb = XLSX.read(evt.target!.result, { type: 'array', cellDates: true });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: null });

          const getStr = (row: any, ...keys: string[]): string => {
            for (const k of keys) {
              const found = Object.keys(row).find(rk => rk.trim().toLowerCase() === k.toLowerCase());
              if (found !== undefined && row[found] !== null && row[found] !== undefined) {
                const s = String(row[found]).trim();
                if (s) return s;
              }
            }
            return '';
          };

          const getDec = (row: any, ...keys: string[]): number => {
            for (const k of keys) {
              const found = Object.keys(row).find(rk => rk.trim().toLowerCase() === k.toLowerCase());
              if (found !== undefined && row[found] !== null && row[found] !== undefined) {
                const v = row[found];
                if (typeof v === 'number') return v;
                const s = String(v).replace(/,/g, '').trim();
                const n = parseFloat(s);
                if (!isNaN(n)) return n;
              }
            }
            return 0;
          };

          const getDate = (row: any, ...keys: string[]): string | null => {
            for (const k of keys) {
              const found = Object.keys(row).find(rk => rk.trim().toLowerCase() === k.toLowerCase());
              if (found !== undefined && row[found] !== null && row[found] !== undefined) {
                const v = row[found];
                if (v instanceof Date) return v.toISOString();
                const s = String(v).trim();
                if (s) {
                  const d = new Date(s);
                  if (!isNaN(d.getTime())) return d.toISOString();
                }
              }
            }
            return null;
          };

          const entries: OutstandingEntryRequest[] = [];
          let currentCustomer = '';
          let sortOrder = 0;

          for (const row of rows) {
            // ── column extraction — same priority order as server-side parser ──
            const txnType    = getStr(row, 'Txn Type', 'TxnType', 'Trans Type', 'Transaction Type', 'Type', 'Txn');
            const customerName = getStr(row, 'Customer', 'Customer Name', 'CUSTOMER', 'Debtor', 'Client');
            const refNo      = getStr(row, 'Ref No', 'RefNo', 'Ref. No.', 'Ref No.', 'Reference No',
                                          'Doc No', 'Invoice No', 'Invoice #', 'Doc #', 'Trans. No', 'No.', 'Reference');
            const txnDate    = getDate(row, 'Date', 'Txn Date', 'Trans. Date', 'Transaction Date',
                                           'Invoice Date', 'Doc Date');
            const ageDaysRaw = getStr(row, 'Age Days', 'AgeDays', 'Age', 'Age (Days)', 'Due Days', 'Overdue Days', 'Days');
            const ageDays    = ageDaysRaw ? (parseInt(ageDaysRaw) || null) : null;

            const current = getDec(row, 'Current', 'Not Yet Due', 'Not Due');
            const b1_15   = getDec(row, '1-15', '1 - 15', '1 to 15', '1 To 15', '01-15', '1-15 Days');
            const b16_30  = getDec(row, '16-30', '16 - 30', '16 to 30', '16 To 30', '16-30 Days');
            const b31_45  = getDec(row, '31-45', '31 - 45', '31 to 45', '31 To 45', '31-45 Days');
            const above45 = getDec(row, 'Above 45 (F)', 'Above 45', 'Above45', 'Over 45',
                                       '46+', '> 45', '45+', 'Above 45 Days', '46 & Above');
            const balance = getDec(row, 'Balance', 'Outstanding', 'O/S Balance', 'OS Balance', 'Amount Due', 'Total');

            // Skip fully blank rows
            const allBlank = !txnType && !customerName && !refNo
              && current === 0 && b1_15 === 0 && b16_30 === 0
              && b31_45 === 0 && above45 === 0 && balance === 0;
            if (allBlank) continue;

            if (customerName) currentCustomer = customerName;
            const isTotal = !txnType && !refNo;

            entries.push({
              customerName: isTotal
                ? currentCustomer
                : (customerName || currentCustomer),
              txnType: txnType || null,
              refNo: refNo || null,
              txnDate,
              ageDays,
              current,
              bucket1_15: b1_15,
              bucket16_30: b16_30,
              bucket31_45: b31_45,
              above45,
              balance,
              isTotal,
              sortOrder: sortOrder++,
            });
          }

          resolve(entries);
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

    const CHUNK = 150;
    setUploadProgress({ active: true, total: 0, processed: 0 });

    try {
      // 1. Parse Excel on the client
      let entries: OutstandingEntryRequest[];
      try {
        entries = await parseExcelClientSide(file);
      } catch {
        toast.error('Could not read Excel file. Make sure it is a valid .xlsx / .xls file.');
        setUploadProgress(null);
        return;
      }

      if (!entries.length) {
        toast.error('No data rows found in the file.');
        setUploadProgress(null);
        return;
      }

      setUploadProgress({ active: true, total: entries.length, processed: 0 });

      // 2. Create the report header
      const startRes = await outstandingApi.startUpload(selectedRegionId, reportDate || null);
      const reportId: string = startRes.data.data.reportId;

      // 3. Send entries in chunks with retry
      const sendChunk = async (chunk: OutstandingEntryRequest[], retries = 2) => {
        for (let attempt = 0; attempt <= retries; attempt++) {
          try {
            await outstandingApi.appendEntries(reportId, chunk);
            return;
          } catch (err) {
            if (attempt === retries) throw err;
            await new Promise(r => setTimeout(r, 600 * (attempt + 1)));
          }
        }
      };

      let processed = 0;
      for (let i = 0; i < entries.length; i += CHUNK) {
        await sendChunk(entries.slice(i, i + CHUNK));
        processed = Math.min(i + CHUNK, entries.length);
        setUploadProgress({ active: true, total: entries.length, processed });
      }

      // 4. Refresh data
      await qc.invalidateQueries({ queryKey: ['admin-outstanding-reports'] });
      if (viewingRegionId === selectedRegionId)
        await qc.invalidateQueries({ queryKey: ['admin-outstanding-detail', selectedRegionId] });

      toast.success(`Uploaded: ${entries.filter(e => !e.isTotal).length} entries for ${regions.find(r => r.id === selectedRegionId)?.name ?? ''}`);
      setSelectedRegionId('');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Upload failed');
    } finally {
      setUploadProgress(null);
    }
  };

  // Grouped entries for the viewed report
  const groupedEntries = useMemo(() => {
    if (!detail) return [];
    const q = search.trim().toLowerCase();
    const filtered = q
      ? detail.entries.filter(e => e.customerName.toLowerCase().includes(q) || (e.refNo || '').toLowerCase().includes(q))
      : detail.entries;

    const groups = new Map<string, OutstandingEntry[]>();
    for (const e of filtered) {
      if (!groups.has(e.customerName)) groups.set(e.customerName, []);
      groups.get(e.customerName)!.push(e);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [detail, search]);

  // Grand Total computed from all isTotal rows across all groups
  const grandTotal = useMemo(() => {
    let current = 0, bucket1_15 = 0, bucket16_30 = 0, bucket31_45 = 0, above45 = 0, balance = 0;
    for (const [, rows] of groupedEntries) {
      const totalRow = rows.find(r => r.isTotal);
      if (totalRow) {
        current    += totalRow.current    || 0;
        bucket1_15 += totalRow.bucket1_15 || 0;
        bucket16_30+= totalRow.bucket16_30|| 0;
        bucket31_45+= totalRow.bucket31_45|| 0;
        above45    += totalRow.above45    || 0;
        balance    += totalRow.balance    || 0;
      }
    }
    return { current, bucket1_15, bucket16_30, bucket31_45, above45, balance };
  }, [groupedEntries]);

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

  // PDF export — all customers
  const handleExportPdf = async () => {
    if (!detail) return;
    const { jsPDF } = await import('jspdf');
    const autoTable = (await import('jspdf-autotable')).default;

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 10;
    const reportDateStr = detail.reportDate ? fmtDate(detail.reportDate) : fmtDate(new Date().toISOString());

    // Header
    const drawHeader = () => {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(0, 0, 0);
      doc.text('JANASIRI DISTRIBUTORS (PVT) LTD', margin, 10);
      doc.setFontSize(10);
      doc.text(`CUSTOMER AGEING DETAILS / ${detail.regionName.toUpperCase()}`, margin, 16);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
      doc.text(`DATE AS OF :  ${reportDateStr}`, margin, 22);
    };
    drawHeader();

    const YELLOW: [number, number, number] = [255, 204, 0];
    const GREEN: [number, number, number] = [56, 142, 60];
    const WHITE: [number, number, number] = [255, 255, 255];
    const BLACK: [number, number, number] = [0, 0, 0];
    const LGREY: [number, number, number] = [245, 245, 245];

    const head = [['Txn', 'RefNo', 'Date', 'AgeDays', 'Current', '1-15', '16-30', '31-45', 'Above 45', 'Balance']];
    const body: any[][] = [];

    for (const [customer, rows] of groupedEntries) {
      // Customer header
      body.push([{ content: customer, colSpan: 10, styles: { fontStyle: 'bold', fontSize: 8.5, fillColor: LGREY, textColor: BLACK, cellPadding: { top: 1.5, bottom: 1.5, left: 3, right: 3 } } }]);
      for (const row of rows) {
        if (row.isTotal) {
          body.push([
            { content: '', colSpan: 4, styles: { lineWidth: 0, fillColor: WHITE } },
            { content: fmt(row.current), styles: { fontStyle: 'bold', halign: 'right' } },
            { content: fmt(row.bucket1_15), styles: { fontStyle: 'bold', halign: 'right' } },
            { content: fmt(row.bucket16_30), styles: { fontStyle: 'bold', halign: 'right' } },
            { content: fmt(row.bucket31_45), styles: { fontStyle: 'bold', halign: 'right' } },
            { content: fmt(row.above45), styles: { fontStyle: 'bold', halign: 'right' } },
            { content: fmt(row.balance), styles: { fontStyle: 'bold', halign: 'right' } },
          ]);
        } else {
          body.push([
            row.txnType || '',
            row.refNo || '',
            row.txnDate ? fmtShortDate(row.txnDate) : '',
            row.ageDays != null ? String(row.ageDays) : '',
            { content: row.current ? fmt(row.current) : '', styles: { halign: 'right' } },
            { content: row.bucket1_15 ? fmt(row.bucket1_15) : '', styles: { halign: 'right' } },
            { content: row.bucket16_30 ? fmt(row.bucket16_30) : '', styles: { halign: 'right' } },
            { content: row.bucket31_45 ? fmt(row.bucket31_45) : '', styles: { halign: 'right' } },
            { content: row.above45 ? fmt(row.above45) : '', styles: { halign: 'right', textColor: row.above45 > 0 ? [200, 0, 0] : BLACK } },
            { content: fmt(row.balance), styles: { halign: 'right', fontStyle: row.balance < 0 ? 'bold' : 'normal', textColor: row.balance < 0 ? [200, 0, 0] : BLACK } },
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
        doc.text(`JANASIRI DISTRIBUTORS (PVT) LTD  |  Customer Ageing  |  ${detail.regionName}  |  ${reportDateStr}`, margin, pageH - 4);
        doc.text(`Page ${hookData.pageNumber} of ${(doc as any).internal.getNumberOfPages()}`, pageW - margin, pageH - 4, { align: 'right' });
      },
    });

    doc.save(`Outstanding_${detail.regionName.replace(/\s+/g, '_')}_${reportDateStr.replace(/\s/g, '_')}.pdf`);
  };

  // Export selected customers to one PDF
  const exportSelectedPdf = async () => {
    if (!detail || selectedCustomers.size === 0) return;
    const { jsPDF } = await import('jspdf');
    const autoTable = (await import('jspdf-autotable')).default;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 10;
    const reportDateStr = detail.reportDate ? fmtDate(detail.reportDate) : fmtDate(new Date().toISOString());
    const YELLOW: [number,number,number] = [255,204,0];
    const BLACK: [number,number,number]  = [0,0,0];
    const WHITE: [number,number,number]  = [255,255,255];
    const LGREY: [number,number,number]  = [245,245,245];
    const drawHeader = () => {
      doc.setFont('helvetica','bold'); doc.setFontSize(13); doc.setTextColor(0,0,0);
      doc.text('JANASIRI DISTRIBUTORS (PVT) LTD', margin, 10);
      doc.setFontSize(10);
      doc.text(`CUSTOMER AGEING DETAILS / ${detail.regionName.toUpperCase()}`, margin, 16);
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
        doc.text(`JANASIRI DISTRIBUTORS (PVT) LTD  |  Customer Ageing  |  ${detail.regionName}  |  ${reportDateStr}`, margin, pageH-4);
        doc.text(`Page ${hookData.pageNumber} of ${(doc as any).internal.getNumberOfPages()}`, pageW-margin, pageH-4, { align:'right' });
      },
    });
    doc.save(`Outstanding_Selected_${detail.regionName.replace(/\s+/g,'_')}_${reportDateStr.replace(/\s/g,'_')}.pdf`);
  };

  // Regions that already have reports
  const reportMap = new Map((reports as OutstandingReportSummary[]).map(r => [r.regionId, r]));

  return (
    <div className="animate-fade-in space-y-5 pb-10">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Outstanding Reports</h1>
          <p className="text-sm text-slate-500 mt-0.5">Upload & manage customer ageing reports by region</p>
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
          <div className="min-w-[160px]">
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Report Date</label>
            <input type="date" value={reportDate} onChange={e => setReportDate(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 outline-none" />
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
        {/* Upload progress bar */}
        {uploadProgress?.active && (
          <div className="mt-3">
            <div className="flex justify-between text-xs text-slate-500 mb-1">
              <span>Uploading entries…</span>
              <span>{uploadProgress.processed} / {uploadProgress.total}</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
              <div
                className="bg-emerald-500 h-2 rounded-full transition-all duration-300"
                style={{ width: uploadProgress.total > 0 ? `${Math.round((uploadProgress.processed / uploadProgress.total) * 100)}%` : '5%' }}
              />
            </div>
          </div>
        )}
        {reportMap.has(selectedRegionId) && (
          <p className="mt-2 text-xs text-amber-600 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5" />
            A report already exists for this region — uploading will replace it.
          </p>
        )}
      </div>

      {/* Reports Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-violet-600" />
            Uploaded Reports
            {reports.length > 0 && <span className="px-2 py-0.5 bg-violet-100 text-violet-700 text-[10px] font-bold rounded-full">{reports.length}</span>}
          </h2>
        </div>
        {isLoading ? (
          <div className="py-14 text-center"><div className="w-7 h-7 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" /></div>
        ) : reports.length === 0 ? (
          <div className="py-14 text-center">
            <FileSpreadsheet className="w-10 h-10 mx-auto text-slate-200 mb-3" />
            <p className="text-sm text-slate-400">No outstanding reports uploaded yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-[11px] uppercase tracking-wider">
                  <th className="text-left px-4 py-3 font-semibold">Region</th>
                  <th className="text-center px-3 py-3 font-semibold">Report Date</th>
                  <th className="text-center px-3 py-3 font-semibold">Customers</th>
                  <th className="text-center px-3 py-3 font-semibold">Rows</th>
                  <th className="text-center px-3 py-3 font-semibold">Uploaded</th>
                  <th className="text-center px-3 py-3 font-semibold">By</th>
                  <th className="w-32 px-3 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reports.map((r: OutstandingReportSummary) => (
                  <Fragment key={r.id}>
                    <tr className={`transition-colors ${viewingRegionId === r.regionId ? 'bg-violet-50/40' : 'hover:bg-slate-50/60'}`}>
                      <td className="px-4 py-3 font-semibold text-slate-900">{r.regionName}</td>
                      <td className="px-3 py-3 text-center text-slate-600">{fmtDate(r.reportDate)}</td>
                      <td className="px-3 py-3 text-center">
                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-full">{r.customerCount}</span>
                      </td>
                      <td className="px-3 py-3 text-center text-slate-500">{r.entryCount}</td>
                      <td className="px-3 py-3 text-center text-slate-500 text-xs">{fmtDate(r.uploadedAt)}</td>
                      <td className="px-3 py-3 text-center text-slate-500 text-xs truncate max-w-[120px]">{r.uploadedBy || '—'}</td>
                      <td className="px-3 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => setViewingRegionId(viewingRegionId === r.regionId ? null : r.regionId)}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition flex items-center gap-1 ${
                              viewingRegionId === r.regionId
                                ? 'text-violet-700 bg-violet-200 hover:bg-violet-300'
                                : 'text-violet-600 bg-violet-50 hover:bg-violet-100'
                            }`}>
                            {viewingRegionId === r.regionId ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />} View
                          </button>
                          <button onClick={() => setDeleteTarget({ regionId: r.regionId, regionName: r.regionName })}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 transition">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {viewingRegionId === r.regionId && (
                      <tr>
                        <td colSpan={7} className="p-0">
                          <div className="border-t-2 border-violet-200">
                            {/* Toolbar */}
                            <div className="px-4 py-3 bg-violet-50/60 border-b border-slate-200 flex items-center justify-between flex-wrap gap-2">
                              <div>
                                <p className="text-xs font-bold text-slate-800">{detail?.regionName} — Ageing Detail</p>
                                {detail?.reportDate && <p className="text-[10px] text-slate-500 mt-0.5">Date as of: {fmtDate(detail.reportDate)}</p>}
                              </div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <button onClick={selectAll}   className="px-2.5 py-1.5 text-[11px] font-semibold text-violet-600 bg-violet-100 rounded-lg hover:bg-violet-200 transition">Select All</button>
                                <button onClick={deselectAll} className="px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition">Deselect All</button>
                                <button onClick={expandAll}   className="px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition">Expand All</button>
                                <button onClick={collapseAll} className="px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition">Collapse All</button>
                                <div className="relative">
                                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search customer / ref…"
                                    className="pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-sm w-48 focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 outline-none" />
                                </div>
                                {selectedCustomers.size > 0 && (
                                  <button onClick={exportSelectedPdf}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 text-white rounded-lg text-xs font-semibold hover:bg-violet-700 transition">
                                    <FileDown className="w-3.5 h-3.5" /> Export Selected ({selectedCustomers.size})
                                  </button>
                                )}
                                <button onClick={handleExportPdf}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-600 text-white rounded-lg text-xs font-semibold hover:bg-slate-700 transition">
                                  <FileDown className="w-3.5 h-3.5" /> Export All
                                </button>
                              </div>
                            </div>
                            {/* Ageing table */}
                            {detailLoading ? (
                              <div className="py-10 text-center"><div className="w-6 h-6 border-4 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto" /></div>
                            ) : (
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
                                    {groupedEntries.map(([customer, rows]) => {
                                      const isExpanded = expandedCustomers.has(customer);
                                      const isSelected = selectedCustomers.has(customer);
                                      const totalRow = rows.find(r => r.isTotal);
                                      return (
                                        <Fragment key={customer}>
                                          <tr className={`border-y border-emerald-200 cursor-pointer transition ${isSelected ? 'bg-violet-100 hover:bg-violet-200' : 'bg-emerald-100 hover:bg-emerald-200'}`}
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
                                                <td className="px-3 py-2 text-right font-bold text-red-600">{fmt(totalRow.above45)}</td>
                                                <td className="px-3 py-2 text-right font-bold">{fmt(totalRow.balance)}</td>
                                              </>
                                            ) : <td colSpan={6} />}
                                          </tr>
                                          {isExpanded && rows.map(row => (
                                            row.isTotal ? (
                                              <tr key={row.id} className="bg-slate-50 border-t-2 border-slate-300 font-bold">
                                                <td className="px-2 py-2" />
                                                <td colSpan={4} className="px-3 py-2" />
                                                <td className="px-3 py-2 text-right border border-slate-200">{fmt(row.current)}</td>
                                                <td className="px-3 py-2 text-right border border-slate-200">{fmt(row.bucket1_15)}</td>
                                                <td className="px-3 py-2 text-right border border-slate-200">{fmt(row.bucket16_30)}</td>
                                                <td className="px-3 py-2 text-right border border-slate-200">{fmt(row.bucket31_45)}</td>
                                                <td className="px-3 py-2 text-right border border-slate-200 text-red-600">{fmt(row.above45)}</td>
                                                <td className="px-3 py-2 text-right border border-slate-200 font-bold">{fmt(row.balance)}</td>
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
                                        </Fragment>
                                      );
                                    })}
                                    {/* Grand Total row — always visible */}
                                    <tr className="sticky bottom-0 bg-amber-100 border-t-2 border-amber-400 font-bold text-[11px] shadow-[0_-2px_8px_-2px_rgba(0,0,0,0.08)]">
                                      <td className="px-2 py-2.5" />
                                      <td colSpan={4} className="px-3 py-2.5 text-slate-800 font-extrabold uppercase tracking-wide">Grand Total</td>
                                      <td className="px-3 py-2.5 text-right border border-amber-300">{fmt(grandTotal.current)}</td>
                                      <td className="px-3 py-2.5 text-right border border-amber-300">{fmt(grandTotal.bucket1_15)}</td>
                                      <td className="px-3 py-2.5 text-right border border-amber-300">{fmt(grandTotal.bucket16_30)}</td>
                                      <td className="px-3 py-2.5 text-right border border-amber-300">{fmt(grandTotal.bucket31_45)}</td>
                                      <td className="px-3 py-2.5 text-right border border-amber-300 text-red-700">{fmt(grandTotal.above45)}</td>
                                      <td className="px-3 py-2.5 text-right border border-amber-300">{fmt(grandTotal.balance)}</td>
                                    </tr>
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

      {/* Delete confirmation */}
      <ConfirmModal
        open={!!deleteTarget}
        title="Delete Report"
        description={`Delete the outstanding report for "${deleteTarget?.regionName}"? This cannot be undone.`}
        confirmLabel="Delete"
        confirmVariant="red"
        onConfirm={() => { if (deleteTarget) { deleteMut.mutate(deleteTarget.regionId); setDeleteTarget(null); } }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
