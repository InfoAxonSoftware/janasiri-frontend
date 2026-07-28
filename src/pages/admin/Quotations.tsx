// @ts-nocheck
import { Fragment, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { PrivateImage } from '../../components/common/PrivateImage';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminApproveQuotation, adminGetQuotations, adminRejectQuotation, adminSoftDeleteQuotation, adminGetQuotationsTrash, adminRestoreQuotation } from '../../services/api/quotationApi';
import { repsApi } from '../../services/api/repsApi';
import { customersApi } from '../../services/api/customersApi';
import { formatCurrency, formatDate, formatDateTime } from '../../utils/formatters';
import { taxCodeToRate } from '../../utils/calculations';
import { downloadQuotationPdf, downloadQuotationsExcel, downloadQuotationsPdf } from '../../utils/quotationPdf';
import { downloadQuickRequestPdf, downloadQuickRequestExcel, downloadImage } from '../../utils/quickRequestPdf';
import type { Quotation } from '../../types/quotation.types';
import { QUOTATION_STATUSES, FILTER_QUOTATION_STATUSES } from '../../types/quotation.types';
import {
  FileText, Search, X, SlidersHorizontal, ArrowUp, ArrowDown, ArrowUpDown,
  Check, ChevronRight, FileSpreadsheet, CheckCircle, XCircle, Trash2, RotateCcw, Download,
} from 'lucide-react';
import StatusBadge from '../../components/common/StatusBadge';
import { quickRequestApi } from '../../services/api/quickRequestApi';
import toast from 'react-hot-toast';

export default function AdminQuotations() {
  // ── Pagination & filters ──────────────────────────────────────────────────
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [repIdFilter, setRepIdFilter] = useState('');
  const [customerIdFilter, setCustomerIdFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // ── Sort ─────────────────────────────────────────────────────────────────
  const [sortField, setSortField] = useState<string>('createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // ── Selection (universal pattern) ────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectAllPages, setSelectAllPages] = useState(false);

  // ── UI state ─────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'active' | 'trash'>('active');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<Quotation | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [filterSubPanel, setFilterSubPanel] = useState<'status' | 'rep' | 'customer' | 'date' | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [quickLightbox, setQuickLightbox] = useState<string | null>(null);

  const queryClient = useQueryClient();

  // Reset selection when filters/page change
  useEffect(() => {
    setSelectedIds(new Set());
    setSelectAllPages(false);
  }, [page, statusFilter, fromDate, toDate, repIdFilter, customerIdFilter]);

  // Esc exits selection
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setSelectedIds(new Set()); setSelectAllPages(false); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // ── Queries ───────────────────────────────────────────────────────────────
  const { data: repsData } = useQuery({
    queryKey: ['reps-all'],
    queryFn: () => repsApi.adminGetAll({ pageSize: 500 }).then((r) => r.data.data?.items || []),
    staleTime: 5 * 60 * 1000,
  });

  const { data: customersData } = useQuery({
    queryKey: ['customers-all'],
    queryFn: () => customersApi.adminGetAll({ pageSize: 500 }).then((r) => r.data.data?.items || []),
    staleTime: 5 * 60 * 1000,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['admin-quotations', page, statusFilter],
    queryFn: () => adminGetQuotations(page, 20, statusFilter || undefined),
  });

  // ── Mutations ─────────────────────────────────────────────────────────────
  const approveMut = useMutation({
    mutationFn: (id: string) => adminApproveQuotation(id, {}),
    onSuccess: () => {
      toast.success('Quotation approved');
      setExpandedId(null);
      queryClient.invalidateQueries({ queryKey: ['admin-quotations'] });
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
    },
    onError: () => toast.error('Failed to approve quotation'),
  });

  const rejectMut = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => adminRejectQuotation(id, { reason }),
    onSuccess: () => {
      toast.success('Quotation rejected');
      setRejectTarget(null);
      setRejectReason('');
      setExpandedId(null);
      queryClient.invalidateQueries({ queryKey: ['admin-quotations'] });
    },
    onError: () => toast.error('Failed to reject quotation'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => adminSoftDeleteQuotation(id),
    onSuccess: (_, id) => {
      toast.success('Moved to trash');
      // Immediately remove from cache for instant UI update
      queryClient.setQueriesData({ queryKey: ['admin-quotations'] }, (old: any) =>
        old ? { ...old, items: old.items?.filter((q: any) => q.id !== id), totalCount: Math.max(0, (old.totalCount ?? 0) - 1) } : old
      );
      setSelectedIds(new Set());
      setSelectAllPages(false);
      setDeleteConfirmOpen(false);
      setExpandedId(null);
      queryClient.invalidateQueries({ queryKey: ['admin-quotations'] });
      queryClient.invalidateQueries({ queryKey: ['admin-quotations-trash'] });
    },
    onError: () => toast.error('Failed to delete'),
  });

  const restoreMut = useMutation({
    mutationFn: (id: string) => adminRestoreQuotation(id),
    onSuccess: () => {
      toast.success('Quotation restored');
      queryClient.invalidateQueries({ queryKey: ['admin-quotations'] });
      queryClient.invalidateQueries({ queryKey: ['admin-quotations-trash'] });
    },
    onError: () => toast.error('Failed to restore'),
  });

  const quickUpdateMut = useMutation({
    mutationFn: ({ id, status, notes }: { id: string; status: string; notes: string }) =>
      quickRequestApi.adminUpdateStatus(id, { status, adminNotes: notes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-quick-quotations'] });
      toast.success('Quick quotation updated');
    },
    onError: () => toast.error('Failed to update'),
  });

  const { data: trashData, isLoading: trashLoading } = useQuery({
    queryKey: ['admin-quotations-trash', page],
    queryFn: () => adminGetQuotationsTrash(page, 20),
    enabled: activeTab === 'trash',
  });

  const { data: quickData = [] } = useQuery({
    queryKey: ['admin-quick-quotations'],
    queryFn: () => quickRequestApi.adminGetAll('Quotation').then(r => r.data.data),
    staleTime: 30_000,
    enabled: activeTab === 'active',
  });

  // ── Derived data ──────────────────────────────────────────────────────────
  const allItems: Quotation[] = (data as any)?.items || [];
  const reps: { id: string; fullName: string }[] = repsData || [];
  const customers: { id: string; shopName: string; customerType?: string }[] = customersData || [];

  const customerTaxMap = useMemo(() => new Map<string, boolean>(
    (customersData || []).map((c: any) => [
      c.id,
      (c.customerType || '').toLowerCase().replace(/[-\s]/g, '') !== 'nontax',
    ])
  ), [customersData]);

  const getIsTax = (q: Quotation) => {
    const val = customerTaxMap.get(q.customerId);
    return val === undefined ? true : val;
  };

  const applyFilters = (items: Quotation[]) => items.filter(q => {
    if (search) {
      const s = search.toLowerCase();
      const shopName = (customers.find(c => c.id === q.customerId)?.shopName || q.customerName || '').toLowerCase();
      if (!q.quotationNumber.toLowerCase().includes(s) && !shopName.includes(s)) return false;
    }
    if (statusFilter && q.status !== statusFilter) return false;
    if (repIdFilter && q.repId !== repIdFilter) return false;
    if (customerIdFilter && q.customerId !== customerIdFilter) return false;
    if (fromDate && q.createdAt < fromDate) return false;
    if (toDate && q.createdAt > toDate + 'T23:59:59') return false;
    return true;
  });

  const filteredItems = useMemo(
    () => applyFilters(allItems),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allItems, search, statusFilter, repIdFilter, customerIdFilter, fromDate, toDate, customers]
  );

  const filteredTrashItems: Quotation[] = useMemo(
    () => applyFilters((trashData as any)?.items || []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [trashData, search, statusFilter, repIdFilter, customerIdFilter, fromDate, toDate, customers]
  );

  const sortedItems = useMemo(() => {
    return [...filteredItems].sort((a, b) => {
      let av: any, bv: any;
      switch (sortField) {
        case 'quotationNumber': av = a.quotationNumber;   bv = b.quotationNumber;   break;
        case 'customerName':    av = a.customerName;      bv = b.customerName;      break;
        case 'repName':         av = a.repName ?? '';     bv = b.repName ?? '';     break;
        case 'status':          av = a.status;            bv = b.status;            break;
        case 'validUntil':      av = a.validUntil ?? '';  bv = b.validUntil ?? '';  break;
        default:                av = a.createdAt || '';   bv = b.createdAt || '';   break;
      }
      if (typeof av === 'string') av = av.toLowerCase();
      if (typeof bv === 'string') bv = bv.toLowerCase();
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredItems, sortField, sortDir]);

  const quickQuotationRows = useMemo(() => {
    let rows = (quickData as any[]).map((r: any) => ({
      _isQuick: true, _quick: r,
      id: r.id, quotationNumber: r.requestNumber,
      customerName: r.customerName, repName: r.repName,
      createdAt: r.createdAt, status: r.status,
      items: [] as any[], totalAmount: 0,
    }));
    if (statusFilter)       rows = rows.filter(r => r.status === statusFilter);
    if (repIdFilter)        rows = rows.filter(r => r._quick.repId === repIdFilter);
    if (customerIdFilter) {
      const custName = customers.find(c => c.id === customerIdFilter)?.shopName?.toLowerCase();
      if (custName) rows = rows.filter(r => (r.customerName || '').toLowerCase() === custName);
    }
    if (fromDate)  rows = rows.filter(r => r.createdAt && r.createdAt >= fromDate);
    if (toDate)    rows = rows.filter(r => r.createdAt && r.createdAt.slice(0, 10) <= toDate);
    if (search.trim()) { const sq = search.toLowerCase(); rows = rows.filter(r => (r.quotationNumber || '').toLowerCase().includes(sq) || (r.customerName || '').toLowerCase().includes(sq)); }
    return rows;
  }, [quickData, statusFilter, repIdFilter, customerIdFilter, customers, fromDate, toDate, search]);

  const allRows: any[] = useMemo(() => {
    const merged = [...filteredItems, ...quickQuotationRows];
    return merged.sort((a, b) => {
      let av: any, bv: any;
      switch (sortField) {
        case 'quotationNumber': av = a.quotationNumber ?? ''; bv = b.quotationNumber ?? ''; break;
        case 'customerName':    av = a.customerName;          bv = b.customerName;          break;
        case 'repName':         av = a.repName ?? '';         bv = b.repName ?? '';         break;
        case 'status':          av = a.status;                bv = b.status;                break;
        default:                av = a.createdAt || '';       bv = b.createdAt || '';       break;
      }
      if (typeof av === 'string') av = av.toLowerCase();
      if (typeof bv === 'string') bv = bv.toLowerCase();
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredItems, quickQuotationRows, sortField, sortDir]);

  const activeFilterCount =
    (statusFilter ? 1 : 0) + (repIdFilter ? 1 : 0) +
    (customerIdFilter ? 1 : 0) + ((fromDate || toDate) ? 1 : 0);

  // ── Selection helpers ─────────────────────────────────────────────────────
  const selectionMode = selectedIds.size > 0 || selectAllPages;

  const toggleSelection = (id: string) => {
    setSelectAllPages(false);
    setSelectedIds(prev => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id); else s.add(id);
      return s;
    });
  };

  const handleHeaderCheckbox = () => {
    if (selectAllPages) {
      setSelectAllPages(false);
      setSelectedIds(new Set());
    } else if (selectedIds.size === allRows.length && allRows.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allRows.map((q: any) => q.id)));
      setSelectAllPages(false);
    }
  };

  const clearSelection = () => { setSelectedIds(new Set()); setSelectAllPages(false); };

  // ── Sort helper ───────────────────────────────────────────────────────────
  const handleSort = (field: string) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-40" />;
    return sortDir === 'asc'
      ? <ArrowUp className="w-3 h-3 text-white" />
      : <ArrowDown className="w-3 h-3 text-white" />;
  };

  // ── Export ────────────────────────────────────────────────────────────────
  const exportQuotations = async (format: 'excel' | 'pdf', single?: any) => {
    // Handle single quick quotation
    if ((single as any)?._isQuick) {
      if (format === 'pdf') await downloadQuickRequestPdf((single as any)._quick);
      else { await downloadQuickRequestExcel((single as any)._quick); toast.success('Excel exported'); }
      return;
    }
    if (single?._quick === undefined && single) {
      // regular single quotation
    }

    let items: any[];
    let quickItems: any[] = [];
    if (single && !(single as any)._isQuick) {
      items = [single];
    } else if (selectAllPages) {
      const toastId = toast.loading('Fetching all quotations…');
      try {
        const allData = await adminGetQuotations(1, (data as any)?.totalCount || 9999, statusFilter || undefined);
        items = (allData as any)?.items || [];
        toast.dismiss(toastId);
      } catch {
        toast.error('Failed to fetch all quotations', { id: toastId });
        return;
      }
    } else if (selectedIds.size > 0) {
      items = sortedItems.filter(q => selectedIds.has(q.id));
      quickItems = quickQuotationRows.filter((r: any) => selectedIds.has(r.id)).map((r: any) => r._quick);
    } else {
      items = sortedItems;
    }
    if (!items.length && !quickItems.length) { toast.error('No quotations to export'); return; }
    try {
      if (format === 'excel') {
        if (items.length) downloadQuotationsExcel(items, customerTaxMap);
        for (const qr of quickItems) await downloadQuickRequestExcel(qr);
        toast.success(`Exported to Excel`);
      } else {
        if (items.length) await downloadQuotationsPdf(items, customerTaxMap);
        for (const qr of quickItems) await downloadQuickRequestPdf(qr);
        toast.success(`Exported to PDF`);
      }
    } catch {
      toast.error('Export failed');
    }
  };

  const excelLabel = selectAllPages
    ? `Excel (all ${(data as any)?.totalCount ?? '…'})`
    : selectedIds.size > 0 ? `Excel (${selectedIds.size})` : 'Excel';
  const pdfLabel = selectAllPages
    ? `PDF (all ${(data as any)?.totalCount ?? '…'})`
    : selectedIds.size > 0 ? `PDF (${selectedIds.size})` : 'PDF';
  const deleteLabel = selectAllPages
    ? `Delete (all ${(data as any)?.totalCount ?? '…'})`
    : selectedIds.size > 0 ? `Delete (${selectedIds.size})` : 'Delete';

  // Strip LKR prefix for compact table display
  const fmtAmt = (n: number) => formatCurrency(n).replace(/^LKR[\s\u00A0]*/i, '');
  const BASE = import.meta.env.VITE_API_URL?.replace('/api', '') || '';
  const QUICK_STATUSES = ['Pending', 'Approved', 'Rejected', 'Completed'];

  const headerCheckboxChecked = selectAllPages || (allRows.length > 0 && selectedIds.size === allRows.length);
  const headerCheckboxIndeterminate = !selectAllPages && selectedIds.size > 0 && selectedIds.size < allRows.length;

  return (
    <div className="animate-fade-in flex flex-col gap-4 pb-28">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Quotations</h1>
        <p className="text-slate-500 text-sm mt-1">Manage and track customer quotations</p>
      </div>

      {/* ── Unified Sticky Bar ───────────────────────────────────────────── */}
      <div className="sticky top-0 z-30">
        <div className="bg-white/95 backdrop-blur-sm border border-slate-200 rounded-2xl shadow-sm overflow-hidden">

          {/* ── Single toolbar row: Tabs + Search + Actions ── */}
          <div className="px-3 py-2.5 flex flex-wrap sm:flex-nowrap items-center gap-x-2 gap-y-2">

            {/* Tabs pill */}
            <div className="flex gap-0.5 bg-slate-100 p-0.5 rounded-lg shrink-0 order-1">
              <button
                onClick={() => { setActiveTab('active'); setPage(1); setSelectedIds(new Set()); setSelectAllPages(false); }}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  activeTab === 'active' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'
                }`}
              >Active</button>
              <button
                onClick={() => { setActiveTab('trash'); setPage(1); setSelectedIds(new Set()); setSelectAllPages(false); }}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  activeTab === 'trash' ? 'bg-white shadow-sm text-rose-600' : 'text-slate-500 hover:text-slate-700'
                }`}
              ><Trash2 className="w-3 h-3" />Trash</button>

            </div>

            <div className="hidden sm:block w-px h-5 bg-slate-200 shrink-0 order-1" />

            {/* Search — full-width second row on mobile, flex-1 middle on sm+ */}
            <div className="relative order-3 sm:order-2 w-full sm:w-auto sm:flex-1 min-w-0 group">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 group-focus-within:text-indigo-500 transition-colors pointer-events-none" />
              <input
                type="text"
                placeholder="Search quotation # or customer…"
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                className="w-full pl-8 pr-7 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm placeholder-slate-400 focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/15 outline-none transition-all"
              />
              {search && (
                <button onClick={() => { setSearch(''); setPage(1); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Right-side action buttons — right side of row 1 on mobile, end of row on sm+ */}
            <div className="flex items-center gap-1 shrink-0 order-2 sm:order-3 ml-auto sm:ml-0">
              {/* Filter */}
              <button
                onClick={() => setFilterPanelOpen(p => !p)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                  filterPanelOpen
                    ? 'bg-indigo-600 text-white'
                    : activeFilterCount > 0
                    ? 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Filter</span>
                {activeFilterCount > 0 && (
                  <span className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold ${filterPanelOpen ? 'bg-white/30 text-white' : 'bg-indigo-600 text-white'}`}>{activeFilterCount}</span>
                )}
              </button>

              <div className="w-px h-5 bg-slate-200 mx-0.5" />

              {/* Excel */}
              <button
                onClick={() => exportQuotations('excel')}
                title={excelLabel}
                className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 transition-all"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">{excelLabel}</span>
              </button>

              {/* PDF */}
              <button
                onClick={() => exportQuotations('pdf')}
                title={pdfLabel}
                className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-rose-50 hover:text-rose-600 transition-all"
              >
                <FileText className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">{pdfLabel}</span>
              </button>

              {/* Selection actions — appear inline when rows are checked */}
              {selectionMode && (
                <>
                  <div className="w-px h-5 bg-slate-200 mx-0.5" />
                  {!selectAllPages && selectedIds.size === sortedItems.length && sortedItems.length > 0 && ((data as any)?.totalPages ?? 1) > 1 && (
                    <button onClick={() => setSelectAllPages(true)} className="hidden md:inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold text-indigo-600 hover:bg-indigo-50 transition-all">
                      Select all {(data as any)?.totalCount}
                    </button>
                  )}
                  {selectAllPages && (
                    <span className="hidden md:inline text-[10px] font-semibold text-indigo-600 px-2">All {(data as any)?.totalCount} selected</span>
                  )}
                  <button
                    onClick={() => setDeleteConfirmOpen(true)}
                    title={deleteLabel}
                    className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-semibold text-red-600 hover:bg-red-50 hover:text-red-700 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span className="hidden lg:inline">{deleteLabel}</span>
                  </button>
                  <button onClick={clearSelection} title="Clear selection (Esc)" className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* ── Filter Panel ─────────────────────────────────────────────── */}
          {filterPanelOpen && (
            <div className="border-t border-slate-100">
              {/* Category tabs */}
              <div className="flex flex-wrap bg-slate-50 px-3 pt-3 gap-1">
                {([
                  { key: 'status',   label: 'Status',   count: statusFilter ? 1 : 0 },
                  { key: 'rep',      label: 'Rep',      count: repIdFilter ? 1 : 0 },
                  { key: 'customer', label: 'Customer', count: customerIdFilter ? 1 : 0 },
                  { key: 'date',     label: 'Date',     count: (fromDate || toDate) ? 1 : 0 },
                ] as { key: 'status'|'rep'|'customer'|'date'; label: string; count: number }[]).map(({ key, label, count }) => (
                  <button
                    key={key}
                    onClick={() => setFilterSubPanel(p => p === key ? null : key)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-t-lg text-xs font-semibold border border-b-0 transition-all ${
                      filterSubPanel === key
                        ? 'bg-white border-slate-200 text-slate-800 -mb-px pb-[7px] z-10 relative'
                        : count > 0
                        ? 'bg-indigo-50 border-indigo-100 text-indigo-700'
                        : 'bg-transparent border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {label}
                    {count > 0 && (
                      <span className="w-4 h-4 rounded-full bg-indigo-600 text-white text-[9px] font-bold inline-flex items-center justify-center">{count}</span>
                    )}
                  </button>
                ))}
                {activeFilterCount > 0 && (
                  <button
                    onClick={() => { setStatusFilter(''); setRepIdFilter(''); setCustomerIdFilter(''); setFromDate(''); setToDate(''); setPage(1); }}
                    className="ml-auto inline-flex items-center gap-1 px-2.5 py-1.5 rounded-t-lg text-xs font-semibold text-red-500 hover:text-red-700 hover:bg-red-50 transition-all border border-transparent"
                  >
                    <X className="w-3 h-3" /> Clear all
                  </button>
                )}
              </div>

              {/* Filter content panel */}
              <div className="bg-white border-t border-slate-200 px-4 py-4">
                {!filterSubPanel && (
                  <p className="text-xs text-slate-400 text-center py-2">Select a filter category above</p>
                )}

                {filterSubPanel === 'status' && (
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2.5">Filter by Status</p>
                    <div className="flex flex-wrap gap-2">
                      {FILTER_QUOTATION_STATUSES.map(s => (
                        <button key={s}
                          onClick={() => { setStatusFilter(prev => prev === s ? '' : s); setPage(1); }}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                            statusFilter === s
                              ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                              : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-700 hover:bg-indigo-50'
                          }`}
                        >
                          {statusFilter === s && <Check className="w-3 h-3" />}
                          {s.replace(/([a-z])([A-Z])/g, '$1 $2')}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {filterSubPanel === 'rep' && (
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2.5">Filter by Sales Rep</p>
                    <div className="flex flex-wrap gap-2">
                      {reps.length === 0
                        ? <span className="text-xs text-slate-400 italic">No reps loaded</span>
                        : reps.map(r => (
                          <button key={r.id}
                            onClick={() => { setRepIdFilter(prev => prev === r.id ? '' : r.id); setPage(1); }}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                              repIdFilter === r.id
                                ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                                : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-700 hover:bg-indigo-50'
                            }`}
                          >
                            {repIdFilter === r.id && <Check className="w-3 h-3" />}
                            {r.fullName}
                          </button>
                        ))
                      }
                    </div>
                  </div>
                )}

                {filterSubPanel === 'customer' && (
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2.5">Filter by Customer</p>
                    <div className="flex items-center gap-2 max-w-sm">
                      <div className="relative flex-1">
                        <select
                          value={customerIdFilter}
                          onChange={e => { setCustomerIdFilter(e.target.value); setPage(1); }}
                          className="w-full appearance-none px-3 py-2 pr-8 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 focus:bg-white transition cursor-pointer"
                        >
                          <option value="">All Customers</option>
                          {customers.map(c => <option key={c.id} value={c.id}>{c.shopName}</option>)}
                        </select>
                        <ChevronRight className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 rotate-90 pointer-events-none" />
                      </div>
                      {customerIdFilter && (
                        <button onClick={() => { setCustomerIdFilter(''); setPage(1); }} className="p-2 text-red-400 hover:text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition shrink-0">
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {filterSubPanel === 'date' && (
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2.5">Filter by Date Range</p>
                    <div className="flex items-center gap-3 max-w-sm">
                      <div className="flex-1">
                        <label className="block text-[10px] text-slate-400 font-semibold mb-1">FROM</label>
                        <input type="date" value={fromDate} onChange={e => { setFromDate(e.target.value); setPage(1); }}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 focus:bg-white transition"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="block text-[10px] text-slate-400 font-semibold mb-1">TO</label>
                        <input type="date" value={toDate} onChange={e => { setToDate(e.target.value); setPage(1); }}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 focus:bg-white transition"
                        />
                      </div>
                      {(fromDate || toDate) && (
                        <div className="pt-4">
                          <button onClick={() => { setFromDate(''); setToDate(''); setPage(1); }} className="p-2 text-red-400 hover:text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Active tab content ───────────────────────────────────────────── */}
      {activeTab === 'active' && (<>

      {/* ── Mobile card list (< lg) ──────────────────────────────────────── */}
      <div className="lg:hidden bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-10 text-center text-slate-400 text-sm">Loading quotations…</div>
        ) : allRows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <FileText className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-sm font-medium">No quotations found</p>
          </div>
        ) : (
          <>
            {allRows.map(q => {
              if ((q as any)._isQuick) {
                const qr = (q as any)._quick;
                const isExpanded = expandedId === qr.id;
                return (
                  <div key={qr.id}>
                    <div
                      onClick={() => { if (selectedIds.size > 0) toggleSelection(qr.id); else setExpandedId(p => p === qr.id ? null : qr.id); }}
                      className={`flex items-center gap-3 px-4 py-3 border-b border-slate-100 cursor-pointer transition-colors select-none ${selectedIds.has(qr.id) ? 'bg-emerald-50' : isExpanded ? 'bg-emerald-50/40' : 'bg-white active:bg-slate-50'}`}
                    >
                      <div className="shrink-0" onClick={e => { e.stopPropagation(); toggleSelection(qr.id); }}>
                        <div className={`w-5 h-5 rounded flex items-center justify-center border-2 transition-colors cursor-pointer ${selectedIds.has(qr.id) ? 'bg-emerald-600 border-emerald-600' : 'border-slate-300 bg-white'}`}>
                          {selectedIds.has(qr.id) && <Check className="w-3 h-3 text-white" />}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800">{qr.requestNumber}</p>
                        <span className="inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">Quick Quotation</span>
                        <p className="text-xs text-slate-500 mt-1 truncate">{qr.customerName}{qr.repName ? ` · ${qr.repName}` : ''}</p>
                      </div>
                      <StatusBadge status={qr.status} />
                      <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                    </div>
                    {isExpanded && (
                      <div className="px-4 pb-4 pt-2 space-y-3 bg-emerald-50/20 border-b border-emerald-100">
                        <div>
                          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Quotation Details</p>
                          <pre className="text-sm text-slate-800 whitespace-pre-wrap font-sans bg-white border border-slate-100 rounded-xl p-3">{qr.details}</pre>
                        </div>
                        {qr.adminNotes && (
                          <div>
                            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Admin Notes</p>
                            <p className="text-sm text-slate-700 bg-amber-50 border border-amber-100 rounded-xl p-3">{qr.adminNotes}</p>
                          </div>
                        )}
                        {qr.imageUrls?.length > 0 && (
                          <div>
                            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-2">Photos ({qr.imageUrls.length})</p>
                            <div className="flex flex-wrap gap-2">
                              {qr.imageUrls.map((url: string, i: number) => (
                                <div key={i} className="relative group w-20 h-20">
                                  <PrivateImage apiPath={url} alt={`Photo ${i+1}`}
                                    onClick={() => setQuickLightbox(url)}
                                    className="w-20 h-20 rounded-xl object-cover border border-slate-200 cursor-pointer hover:opacity-90 transition"
                                    onError={e => { (e.target as any).style.display = 'none'; }}
                                  />
                                  <button
                                    onClick={async e => { e.stopPropagation(); await downloadImage(`${BASE}${url}`, `photo-${i+1}`); }}
                                    className="absolute bottom-1 right-1 w-6 h-6 rounded-lg bg-black/60 hover:bg-black/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                                    title="Download photo"
                                  >
                                    <Download className="w-3 h-3" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        <div className="space-y-2">
                          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Update Status</p>
                          <div className="flex flex-wrap gap-1.5">
                            {QUICK_STATUSES.map(s => (
                              <button key={s}
                                onClick={e => { e.stopPropagation(); quickUpdateMut.mutate({ id: qr.id, status: s, notes: qr.adminNotes || '' }); }}
                                disabled={quickUpdateMut.isPending}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${s === qr.status ? 'bg-slate-800 text-white border-slate-800' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'} disabled:opacity-50`}
                              >{s === qr.status ? `✓ ${s}` : s}</button>
                            ))}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={e => { e.stopPropagation(); exportQuotations('pdf', q); }} className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg text-red-600 hover:bg-red-50 transition">
                            <FileText className="w-3.5 h-3.5" /> PDF
                          </button>
                          <button onClick={e => { e.stopPropagation(); exportQuotations('excel', q); }} className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg text-emerald-600 hover:bg-emerald-50 transition">
                            <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              }
              return (
              <div key={q.id}>
                <div
                  onClick={() => {
                    if (selectionMode) toggleSelection(q.id);
                    else setExpandedId(p => p === q.id ? null : q.id);
                  }}
                  className={`flex items-center gap-3 px-4 py-3 border-b border-slate-100 transition-colors cursor-pointer select-none ${
                    selectedIds.has(q.id) ? 'bg-indigo-50' : expandedId === q.id ? 'bg-blue-50/40' : 'bg-white active:bg-slate-50'
                  }`}
                >
                  {/* Checkbox always visible */}
                  <div
                    onClick={e => { e.stopPropagation(); toggleSelection(q.id); }}
                    className={`shrink-0 w-5 h-5 rounded flex items-center justify-center border-2 transition-colors cursor-pointer ${
                      selectedIds.has(q.id) ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 bg-white'
                    }`}
                  >
                    {selectedIds.has(q.id) && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate leading-snug">{q.quotationNumber}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5 truncate">{customers.find(c => c.id === q.customerId)?.shopName || q.customerName}</p>
                    {q.repName && <p className="text-[10px] text-slate-300 mt-0.5 truncate">{q.repName}</p>}
                  </div>
                  <div className="shrink-0 text-right flex flex-col items-end gap-1">
                    <StatusBadge status={q.status} />
                    <p className="text-sm font-bold text-slate-900 tabular-nums">{fmtAmt(q.totalAmount)}</p>
                  </div>
                  <ChevronRight className={`shrink-0 w-4 h-4 text-slate-300 transition-transform duration-200 ${expandedId === q.id && !selectionMode ? 'rotate-90 text-blue-400' : ''}`} />
                </div>
                {expandedId === q.id && !selectionMode && (() => {
                  const isTaxM = getIsTax(q);
                  let mSubtotal = 0, mTax = 0, mDiscount = 0;
                  (q.items || []).forEach(item => {
                    const r = item.unitPrice || 0, qt = item.quantity || 0, dp = item.discountPercent || 0;
                    const ltr = taxCodeToRate(item.taxCode);
                    const allIncR = Math.round(r * (1 + ltr) * 100) / 100;
                    const base = r * qt;
                    const net = base - base * dp / 100;
                    mSubtotal += isTaxM !== false ? base : allIncR * qt;
                    mTax += isTaxM !== false ? net * ltr : 0;
                    mDiscount += isTaxM !== false ? base * dp / 100 : allIncR * qt * dp / 100;
                  });
                  const mTotal = mSubtotal + mTax - mDiscount;
                  return (
                    <div className="bg-blue-50/30 px-4 py-3 border-b border-blue-100 space-y-2.5">
                      {q.items?.map(item => {
                        const rate = item.unitPrice || 0;
                        const qty = item.quantity || 0;
                        const lineTaxRate = taxCodeToRate(item.taxCode);
                        const allIncRate = Math.round(rate * (1 + lineTaxRate) * 100) / 100;
                        const lineGross = isTaxM === false ? allIncRate * qty : rate * qty;
                        return (
                          <div key={item.id} className="flex justify-between text-xs bg-white rounded-lg p-2.5 shadow-sm">
                            <div><span className="font-medium text-slate-800">{item.productName}</span><span className="text-slate-400 ml-2">x{item.quantity}</span></div>
                            <span className="font-semibold">{fmtAmt(lineGross)}</span>
                          </div>
                        );
                      })}
                      <div className="text-xs space-y-1 bg-white border border-slate-100 rounded-xl p-3">
                        <div className="flex justify-between text-slate-500"><span>Gross Amount</span><span>{fmtAmt(mSubtotal)}</span></div>
                        <div className="flex justify-between text-orange-500 pb-1 border-b border-slate-100"><span>Discount</span><span>-{fmtAmt(mDiscount)}</span></div>
                        {isTaxM !== false && (
                          <>
                            <div className="flex justify-between text-slate-500"><span>Net Amount</span><span>{fmtAmt(mSubtotal - mDiscount)}</span></div>
                            <div className="flex justify-between text-slate-500 pb-1 border-b border-slate-100"><span>Tax</span><span>{fmtAmt(mTax)}</span></div>
                          </>
                        )}
                        <div className="flex justify-between font-bold text-orange-600 pt-1"><span>Total</span><span>{fmtAmt(mTotal)}</span></div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={e => { e.stopPropagation(); exportQuotations('pdf', q); }} className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-lg bg-indigo-50 text-indigo-700 active:scale-95">
                          <FileText className="w-3.5 h-3.5" /> PDF
                        </button>
                        <button onClick={e => { e.stopPropagation(); exportQuotations('excel', q); }} className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-lg bg-emerald-50 text-emerald-700 active:scale-95">
                          <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
                        </button>
                        <button onClick={e => { e.stopPropagation(); setSelectedIds(new Set([q.id])); setDeleteConfirmOpen(true); }} className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-lg bg-red-50 text-red-600 border border-red-100 active:scale-95">
                          <Trash2 className="w-3.5 h-3.5" /> Delete
                        </button>
                      </div>
                      {(q.status === 'Submitted' || q.status === 'UnderReview') && (
                        <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                          <button onClick={() => { setRejectTarget(q); setRejectReason(''); }} className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg bg-red-50 text-red-600 border border-red-200">
                            <XCircle className="w-3.5 h-3.5" /> Reject
                          </button>
                          <button onClick={() => approveMut.mutate(q.id)} disabled={approveMut.isPending} className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 disabled:opacity-50">
                            <CheckCircle className="w-3.5 h-3.5" /> Approve
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
              );
            })}
            {selectionMode && (
              <p className="text-center text-[11px] text-indigo-500 py-3 font-medium select-none">
                {selectedIds.size} selected &mdash; <button onClick={clearSelection} className="underline underline-offset-2">Clear (Esc)</button>
              </p>
            )}
          </>
        )}
        {(data as any)?.totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-500">{(data as any).totalCount} total · p{(data as any).page}/{(data as any).totalPages}</span>
            <div className="flex gap-1">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition">Prev</button>
              <button onClick={() => setPage(p => Math.min((data as any).totalPages, p + 1))} disabled={page >= (data as any).totalPages} className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition">Next</button>
            </div>
          </div>
        )}
      </div>

      {/* ── Desktop table (>= lg) ────────────────────────────────────────── */}
      <div className="hidden lg:block bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-10 text-center text-slate-400 text-sm">Loading quotations…</div>
        ) : allRows.length === 0 ? (
          <div className="p-14 text-center">
            <FileText className="w-10 h-10 text-slate-200 mx-auto mb-2" />
            <p className="text-slate-400 text-sm">No quotations found</p>
          </div>
        ) : (
          <>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-slate-800 text-white">
                  <th className="w-10 px-3 py-3.5 text-center border-r border-slate-600">
                    <input
                      type="checkbox"
                      checked={headerCheckboxChecked}
                      ref={el => { if (el) el.indeterminate = headerCheckboxIndeterminate; }}
                      onChange={handleHeaderCheckbox}
                      className="accent-indigo-400 w-3.5 h-3.5 cursor-pointer"
                    />
                  </th>
                  <th className="w-8 px-2 py-3.5 border-r border-slate-600" />
                  <th onClick={() => handleSort('quotationNumber')} className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider border-r border-slate-600 cursor-pointer hover:bg-slate-700 transition-colors whitespace-nowrap select-none w-60">
                    <span className="flex items-center gap-1.5">Quotation Number <SortIcon field="quotationNumber" /></span>
                  </th>
                  <th onClick={() => handleSort('customerName')} className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider border-r border-slate-600 cursor-pointer hover:bg-slate-700 transition-colors select-none w-48">
                    <span className="flex items-center gap-1.5">Shop <SortIcon field="customerName" /></span>
                  </th>
                  <th onClick={() => handleSort('repName')} className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider border-r border-slate-600 cursor-pointer hover:bg-slate-700 transition-colors select-none w-32">
                    <span className="flex items-center gap-1.5">Rep <SortIcon field="repName" /></span>
                  </th>
                  <th className="px-3 py-3.5 text-center text-xs font-semibold uppercase tracking-wider border-r border-slate-600 w-16">Items</th>
                  <th className="px-4 py-3.5 text-right text-xs font-semibold uppercase tracking-wider border-r border-slate-600 w-28 whitespace-nowrap">Total</th>
                  <th onClick={() => handleSort('createdAt')} className="px-4 py-3.5 text-right text-xs font-semibold uppercase tracking-wider border-r border-slate-600 cursor-pointer hover:bg-slate-700 transition-colors select-none w-28 whitespace-nowrap">
                    <span className="flex items-center justify-end gap-1.5">Date <SortIcon field="createdAt" /></span>
                  </th>
                  <th onClick={() => handleSort('validUntil')} className="px-4 py-3.5 text-right text-xs font-semibold uppercase tracking-wider border-r border-slate-600 cursor-pointer hover:bg-slate-700 transition-colors select-none w-28 whitespace-nowrap">
                    <span className="flex items-center justify-end gap-1.5">Valid Until <SortIcon field="validUntil" /></span>
                  </th>
                  <th onClick={() => handleSort('status')} className="px-4 py-3.5 text-center text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-slate-700 transition-colors select-none w-32">
                    <span className="flex items-center justify-center gap-1.5">Status <SortIcon field="status" /></span>
                  </th>
                </tr>

                {/* Select-all-pages prompt */}
                {!selectAllPages && selectedIds.size === sortedItems.length && sortedItems.length > 0 && ((data as any)?.totalPages ?? 1) > 1 && (
                  <tr className="bg-indigo-50 border-b border-indigo-100">
                    <td colSpan={10} className="px-4 py-1.5 text-center text-xs text-indigo-600">
                      All {sortedItems.length} on this page selected —{' '}
                      <button onClick={() => setSelectAllPages(true)} className="font-semibold underline underline-offset-2 hover:text-indigo-800">
                        Select all {(data as any)?.totalCount} across all pages
                      </button>
                    </td>
                  </tr>
                )}
              </thead>

              <tbody>
                {allRows.map(q => {
                if ((q as any)._isQuick) {
                  const qr = (q as any)._quick;
                  const isExpanded = expandedId === qr.id;
                  return (
                    <Fragment key={qr.id}>
                      <tr onClick={() => { if (selectedIds.size > 0) toggleSelection(qr.id); else setExpandedId(p => p === qr.id ? null : qr.id); }}
                        className={`border-b border-slate-100 cursor-pointer transition-colors select-none text-sm ${selectedIds.has(qr.id) ? 'bg-emerald-50/60' : isExpanded ? 'bg-emerald-50/50 border-emerald-100' : 'hover:bg-slate-50/70'}`}>
                        <td className="px-3 py-3 text-center border-r border-slate-100" onClick={e => { e.stopPropagation(); toggleSelection(qr.id); }}>
                          <input type="checkbox" readOnly checked={selectedIds.has(qr.id)} className="pointer-events-none accent-emerald-500 w-3.5 h-3.5" />
                        </td>
                        <td className="px-2 py-3 border-r border-slate-100">
                          <ChevronRight className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-90 text-emerald-500' : 'text-slate-400'}`} />
                        </td>
                        <td className="px-4 py-3 border-r border-slate-100 whitespace-nowrap">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-bold text-slate-900">{qr.requestNumber}</span>
                            <span className="inline-flex w-fit px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-emerald-100 text-emerald-700">Quick Quotation</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 border-r border-slate-100">
                          <span className="text-slate-700 truncate block">{qr.customerName}</span>
                        </td>
                        <td className="px-4 py-3 border-r border-slate-100">
                          <span className="text-slate-500">{qr.repName || '—'}</span>
                        </td>
                        <td className="px-3 py-3 text-center border-r border-slate-100"><span className="text-slate-400">—</span></td>
                        <td className="px-4 py-3 text-right border-r border-slate-100"><span className="text-slate-400">—</span></td>
                        <td className="px-4 py-3 text-right border-r border-slate-100 whitespace-nowrap">
                          <span className="text-slate-500">{qr.createdAt ? formatDateTime(qr.createdAt) : '—'}</span>
                        </td>
                        <td className="px-4 py-3 text-right border-r border-slate-100"><span className="text-slate-400">—</span></td>
                        <td className="px-4 py-3 text-center"><StatusBadge status={qr.status} /></td>
                      </tr>
                      {isExpanded && (
                        <tr className="border-b border-emerald-100">
                          <td colSpan={10} className="p-0">
                            <div className="bg-gradient-to-b from-emerald-50/40 to-white px-8 py-5">
                              <div className="flex items-start gap-6">
                                <div className="flex-1 space-y-3">
                                  <div>
                                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">Quotation Details</p>
                                    <pre className="text-sm text-slate-800 whitespace-pre-wrap font-sans bg-white border border-slate-100 rounded-xl p-3">{qr.details}</pre>
                                  </div>
                                  {qr.adminNotes && (
                                    <div>
                                      <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Admin Notes</p>
                                      <p className="text-sm text-slate-700 bg-amber-50 border border-amber-100 rounded-xl p-3">{qr.adminNotes}</p>
                                    </div>
                                  )}
                                  {qr.imageUrls?.length > 0 && (
                                    <div>
                                      <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-2">Photos ({qr.imageUrls.length})</p>
                                      <div className="flex flex-wrap gap-2">
                                        {qr.imageUrls.map((url: string, i: number) => (
                                          <div key={i} className="relative group w-20 h-20">
                                            <PrivateImage apiPath={url} alt={`Photo ${i+1}`}
                                              onClick={e => { e.stopPropagation(); setQuickLightbox(url); }}
                                              className="w-20 h-20 rounded-xl object-cover border border-slate-200 cursor-pointer hover:opacity-90 transition"
                                              onError={e => { (e.target as any).style.display = 'none'; }}
                                            />
                                            <button
                                              onClick={async e => { e.stopPropagation(); await downloadImage(`${BASE}${url}`, `photo-${i+1}`); }}
                                              className="absolute bottom-1 right-1 w-6 h-6 rounded-lg bg-black/60 hover:bg-black/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                                              title="Download photo"
                                            >
                                              <Download className="w-3 h-3" />
                                            </button>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                                <div className="shrink-0 space-y-2 min-w-[190px]">
                                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Update Status</p>
                                  <div className="flex flex-col gap-1.5" onClick={e => e.stopPropagation()}>
                                    {QUICK_STATUSES.map(s => (
                                      <button key={s}
                                        onClick={() => quickUpdateMut.mutate({ id: qr.id, status: s, notes: qr.adminNotes || '' })}
                                        disabled={quickUpdateMut.isPending}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition text-left ${s === qr.status ? 'bg-slate-800 text-white border-slate-800' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'} disabled:opacity-50`}
                                      >{s === qr.status ? `✓ ${s}` : s}</button>
                                    ))}
                                  </div>
                                  <div className="flex gap-1.5 mt-1" onClick={e => e.stopPropagation()}>
                                    <button onClick={() => exportQuotations('pdf', q)} className="flex-1 inline-flex items-center justify-center gap-1 py-1.5 text-xs font-semibold rounded-lg text-red-600 hover:bg-red-50 border border-red-100 transition">
                                      <FileText className="w-3 h-3" /> PDF
                                    </button>
                                    <button onClick={() => exportQuotations('excel', q)} className="flex-1 inline-flex items-center justify-center gap-1 py-1.5 text-xs font-semibold rounded-lg text-emerald-600 hover:bg-emerald-50 border border-emerald-100 transition">
                                      <FileSpreadsheet className="w-3 h-3" /> Excel
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                }
                  const isTax = getIsTax(q);
                  let calcSubtotal = 0, calcTotalTax = 0, calcTotalDiscount = 0;
                  (q.items || []).forEach(item => {
                    const r = item.unitPrice || 0, qt = item.quantity || 0, dp = item.discountPercent || 0;
                    const ltr = taxCodeToRate(item.taxCode);
                    const allIncR = Math.round(r * (1 + ltr) * 100) / 100;
                    const base = r * qt, net = base - base * dp / 100;
                    calcSubtotal += isTax !== false ? base : allIncR * qt;
                    calcTotalTax += isTax !== false ? net * ltr : 0;
                    calcTotalDiscount += isTax !== false ? base * dp / 100 : allIncR * qt * dp / 100;
                  });
                  const calcGrandTotal = calcSubtotal + calcTotalTax - calcTotalDiscount;
                  const isSelected = selectedIds.has(q.id);
                  return (
                    <Fragment key={q.id}>
                      <tr
                        onClick={() => { if (selectionMode) toggleSelection(q.id); else setExpandedId(p => p === q.id ? null : q.id); }}
                        className={`border-b border-slate-100 cursor-pointer transition-colors select-none text-sm ${
                          isSelected ? 'bg-indigo-50/70' : expandedId === q.id ? 'bg-blue-50/50 border-blue-100' : 'hover:bg-slate-50/70'
                        }`}
                      >
                        <td className="px-3 py-3 text-center border-r border-slate-100" onClick={e => { e.stopPropagation(); toggleSelection(q.id); }}>
                          <input type="checkbox" readOnly checked={isSelected} className="pointer-events-none accent-indigo-500 w-3.5 h-3.5" />
                        </td>
                        <td className="px-2 py-3 border-r border-slate-100">
                          <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${expandedId === q.id ? 'rotate-90 text-blue-500' : ''}`} />
                        </td>
                        <td className="px-4 py-3 border-r border-slate-100 whitespace-nowrap">
                          <span className="font-bold text-slate-900">{q.quotationNumber}</span>
                        </td>
                        <td className="px-4 py-3 border-r border-slate-100 max-w-[180px]">
                          <span className="text-slate-700 truncate block" title={customers.find(c => c.id === q.customerId)?.shopName || q.customerName || ''}>
                            {customers.find(c => c.id === q.customerId)?.shopName || (q as any).shopName || q.customerName || '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3 border-r border-slate-100">
                          <span className="text-slate-500">{q.repName || '—'}</span>
                        </td>
                        <td className="px-3 py-3 text-center border-r border-slate-100">
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-600 text-xs font-bold">{q.items?.length || 0}</span>
                        </td>
                        <td className="px-4 py-3 text-right border-r border-slate-100 whitespace-nowrap">
                          <span className="font-bold text-slate-900">{fmtAmt(q.totalAmount)}</span>
                        </td>
                        <td className="px-4 py-3 text-right border-r border-slate-100 whitespace-nowrap">
                          <span className="text-slate-500">{q.createdAt ? formatDateTime(q.createdAt) : '—'}</span>
                        </td>
                        <td className="px-4 py-3 text-right border-r border-slate-100 whitespace-nowrap">
                          <span className="text-slate-500">{q.validUntil ? formatDate(q.validUntil) : '—'}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <StatusBadge status={q.status} />
                        </td>
                      </tr>

                      {/* Expanded detail row */}
                      {expandedId === q.id && (
                        <tr className="border-b border-blue-100">
                          <td colSpan={10} className="p-0">
                            <div className="bg-gradient-to-b from-slate-50 to-white px-8 py-5">
                              {/* Header bar — info left, actions right */}
                              <div className="flex items-center justify-between gap-4 flex-wrap mb-4" onClick={e => e.stopPropagation()}>
                                <div className="flex items-center gap-2 text-sm flex-wrap">
                                  <span className="font-semibold text-slate-700">{q.quotationNumber}</span>
                                    <div className="w-px h-5 bg-slate-200 mx-0.5" />
                                  <span className="text-slate-500">{customers.find(c => c.id === q.customerId)?.shopName || q.customerName || '—'}</span>
                                  {q.notes && <><span className="text-slate-300">|</span><span className="text-xs text-slate-400 italic truncate max-w-[300px]">{q.notes}</span></>}
                                  {q.validUntil && <>   <div className="w-px h-5 bg-slate-200 mx-0.5" /><span className="text-xs text-slate-400">Valid until {formatDate(q.validUntil)}</span></>}
                                </div>
                                <div className="flex items-center gap-1 flex-wrap shrink-0">
                                 
                               
                                  {/* Reject / Approve */}
                                  <button
                                    onClick={() => { setRejectTarget(q); setRejectReason(''); }}
                                    disabled={q.status === 'Rejected' || q.status === 'ConvertedToOrder'}
                                    title={q.status === 'Rejected' ? 'Already rejected' : q.status === 'ConvertedToOrder' ? 'Converted to order' : 'Reject this quotation'}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-semibold text-red-600 hover:bg-red-50 hover:text-red-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                                  >
                                    <XCircle className="w-3.5 h-3.5" /> Reject
                                  </button>
                                     <div className="w-px h-5 bg-slate-200 mx-0.5" />
                                  <button
                                    onClick={() => approveMut.mutate(q.id)}
                                    disabled={approveMut.isPending || q.status === 'Approved' || q.status === 'ConvertedToOrder'}
                                    title={q.status === 'Approved' ? 'Already approved' : q.status === 'ConvertedToOrder' ? 'Converted to order' : 'Approve this quotation'}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-semibold text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                                  >
                                    <CheckCircle className="w-3.5 h-3.5" /> {approveMut.isPending ? 'Approving…' : 'Approve'}
                                  </button>
                                  <div className="w-px h-5 bg-slate-200 mx-0.5" />
                                  {/* Export */}
                                  <button
                                    onClick={() => downloadQuotationPdf(q, isTax)}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-rose-50 hover:text-rose-600 transition-all"
                                  >
                                    <FileText className="w-3.5 h-3.5" /> PDF
                                  </button>
                                     <div className="w-px h-5 bg-slate-200 mx-0.5" />
                                  <button
                                    onClick={() => { downloadQuotationsExcel([q], customerTaxMap); toast.success('Excel exported'); }}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 transition-all"
                                  >
                                    <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
                                  </button>
                                  <div className="w-px h-5 bg-slate-200 mx-0.5" />
                                  {/* Delete */}
                                  <button
                                    onClick={() => { setSelectedIds(new Set([q.id])); setDeleteConfirmOpen(true); }}
                                    title="Move to trash"
                                    className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-red-50 hover:text-red-600 transition-all"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" /> Delete
                                  </button>
                                </div>
                              </div>

                              {/* Items table */}
                              {q.items && q.items.length > 0 && (
                                <div className="rounded-xl overflow-hidden border border-slate-200 mb-4">
                                  <table className="w-full text-sm border-collapse">
                                    <thead>
                                      <tr className="bg-slate-200 text-black">
                                        <th className="px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wider border-r border-slate-300 w-10">#</th>
                                        <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider border-r border-slate-300 w-28 whitespace-nowrap">Item Code</th>
                                        <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider border-r border-slate-300">Item Description</th>
                                        <th className="px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wider border-r border-slate-300 w-14">Qty</th>
                                        <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wider border-r border-slate-300 w-36">Rate</th>
                                        <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wider border-r border-slate-300 w-16">Disc%</th>
                                        <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wider border-r border-slate-300 w-36">Disc Amt</th>
                                        {isTax !== false && <th className="px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wider border-r border-slate-300 w-16">Tax</th>}
                                        <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wider border-r border-slate-300 w-36">Line Gross</th>
                                        <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wider w-36">Req. Price</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {q.items.map((item, i) => {
                                        const rate = item.unitPrice || 0;
                                        const qty = item.quantity || 0;
                                        const discPct = item.discountPercent || 0;
                                        const lineTaxRate = taxCodeToRate(item.taxCode);
                                        const allIncRate = Math.round(rate * (1 + lineTaxRate) * 100) / 100;
                                        const displayRate = isTax === false ? allIncRate : rate;
                                        const lineGross = isTax === false ? allIncRate * qty : rate * qty;
                                        const discAmt = isTax === false ? allIncRate * qty * discPct / 100 : rate * qty * discPct / 100;
                                        return (
                                          <tr key={item.id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                                            <td className="px-3 py-2.5 text-center text-xs text-slate-400 font-medium border border-slate-100">{i + 1}</td>
                                            <td className="px-3 py-2.5 text-slate-400 text-xs font-mono border border-slate-100">{item.productSKU || '—'}</td>
                                            <td className="px-4 py-2.5 font-medium text-slate-900 text-sm border border-slate-100">{item.productName}</td>
                                            <td className="px-3 py-2.5 text-center text-slate-700 font-semibold border border-slate-100">{qty}</td>
                                            <td className="px-3 py-2.5 text-right text-slate-700 border border-slate-100">{fmtAmt(displayRate)}</td>
                                            <td className="px-3 py-2.5 text-right text-slate-500 border border-slate-100">{discPct ? `${discPct}%` : <span className="text-slate-300">—</span>}</td>
                                            <td className="px-3 py-2.5 text-right text-slate-500 border border-slate-100">{discAmt ? fmtAmt(discAmt) : <span className="text-slate-300">—</span>}</td>
                                            {isTax !== false && <td className="px-3 py-2.5 text-center text-slate-500 border border-slate-100">{item.taxCode || <span className="text-slate-300">—</span>}</td>}
                                            <td className="px-3 py-2.5 text-right font-bold text-slate-900 border border-slate-100">{fmtAmt(lineGross)}</td>
                                            <td className="px-3 py-2.5 text-right text-slate-500 border border-slate-100">{item.expectedPrice != null ? fmtAmt(item.expectedPrice) : <span className="text-slate-300">—</span>}</td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              )}

                              {/* Totals */}
                              <div className="flex items-start gap-4 flex-wrap">
                                {q.notes && (
                                  <div className="flex-1 min-w-[180px] max-w-sm bg-violet-50 border border-violet-200 rounded-xl p-3.5">
                                    <p className="text-[10px] font-bold text-violet-600 uppercase tracking-wider mb-1.5">Special Notes</p>
                                    <p className="text-sm text-slate-700 whitespace-pre-wrap break-words leading-relaxed">{q.notes}</p>
                                  </div>
                                )}
                                <div className="w-full max-w-md space-y-1.5 text-sm bg-white border border-slate-200 rounded-xl p-3 shadow-sm ml-auto">
                                  <div className="flex items-center justify-between gap-8 font-medium text-slate-500"><span>Gross Amount</span><span className="whitespace-nowrap tabular-nums">{fmtAmt(calcSubtotal)}</span></div>
                                  <div className="flex items-center justify-between gap-8 font-medium text-orange-500 pb-3 border-b border-slate-100"><span>Discount Amount</span><span className="whitespace-nowrap tabular-nums">-{fmtAmt(calcTotalDiscount)}</span></div>
                                  {isTax !== false && (
                                    <>
                                      <div className="flex items-center justify-between gap-8 font-medium text-slate-500"><span>Net Amount</span><span className="whitespace-nowrap tabular-nums">{fmtAmt(calcSubtotal - calcTotalDiscount)}</span></div>
                                      <div className="flex items-center justify-between gap-8 font-medium text-slate-500 pb-3 border-b border-slate-100"><span>Total Tax Amount</span><span className="whitespace-nowrap tabular-nums">{fmtAmt(calcTotalTax)}</span></div>
                                    </>
                                  )}
                                  <div className="flex items-center justify-between gap-8 font-bold pt-1">
                                    <span className="text-slate-800 uppercase tracking-wider text-sm">Total Invoice Value</span>
                                    <span className="text-sm text-orange-600 whitespace-nowrap tabular-nums">{fmtAmt(calcGrandTotal)}</span>
                                  </div>
                                </div>
                              </div>


                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>

            {/* Bottom hint */}
            {!selectionMode && sortedItems.length > 0 && (
              <p className="text-center text-[11px] text-slate-400 py-3 border-t border-slate-100 italic select-none">
                Click a checkbox to enter selection mode
              </p>
            )}
            {selectionMode && (
              <p className="text-center text-[11px] text-slate-400 py-3 border-t border-slate-100 select-none">
                {selectAllPages ? `All ${(data as any)?.totalCount} quotations selected` : `${selectedIds.size} selected`}
                {' '}&mdash;{' '}
                <button onClick={clearSelection} className="text-red-400 hover:text-red-600 font-medium transition-colors">Clear (Esc)</button>
              </p>
            )}

            {/* Pagination */}
            {(data as any)?.totalPages > 1 && (
              <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs text-slate-500">
                  {(data as any).totalCount} total · page {(data as any).page} of {(data as any).totalPages}
                </span>
                <div className="flex gap-1">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition">Prev</button>
                  <button onClick={() => setPage(p => Math.min((data as any).totalPages, p + 1))} disabled={page >= (data as any).totalPages} className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition">Next</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      </>)} {/* end active tab */}

      {/* ── Trash tab content ────────────────────────────────────────────── */}
      {activeTab === 'trash' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {trashLoading ? (
            <div className="p-10 text-center text-slate-400 text-sm">Loading trash…</div>
          ) : filteredTrashItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <Trash2 className="w-10 h-10 mb-3 opacity-20" />
              {(trashData as any)?.items?.length > 0
                ? <><p className="text-sm font-medium">No matches</p><p className="text-xs mt-1 text-slate-300">Try adjusting or clearing the filters</p></>
                : <><p className="text-sm font-medium">Trash is empty</p><p className="text-xs mt-1 text-slate-300">Deleted quotations appear here for 30 days</p></>
              }
            </div>
          ) : (<>
            {/* ── Mobile / tablet cards (< lg) ── */}
            <div className="lg:hidden divide-y divide-slate-100">
              {filteredTrashItems.map((q: Quotation) => (
                <div key={q.id} className="px-4 py-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-slate-700 truncate">{q.quotationNumber}</p>
                      <p className="text-xs text-slate-400 mt-0.5 truncate">{q.shopName || q.customerName || '—'}</p>
                      <p className="text-[10px] text-slate-300 mt-0.5">Deleted {q.deletedAt ? formatDateTime(q.deletedAt) : '—'}</p>
                    </div>
                    <p className="text-sm font-bold text-slate-900 tabular-nums shrink-0">{fmtAmt(q.totalAmount)}</p>
                  </div>
                  <div className="flex items-center justify-between mt-2.5">
                    <StatusBadge status={q.status} />
                    <button
                      onClick={() => restoreMut.mutate(q.id)}
                      disabled={restoreMut.isPending}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 border border-indigo-200 rounded-lg text-xs font-medium hover:bg-indigo-600 hover:text-white hover:border-indigo-600 transition disabled:opacity-50"
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> Restore
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* ── Desktop table (>= lg) ── */}
            <div className="hidden lg:block">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-800 text-white">
                    <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider border-r border-slate-600">Quotation #</th>
                    <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider border-r border-slate-600">Customer</th>
                    <th className="px-4 py-3.5 text-right text-xs font-semibold uppercase tracking-wider border-r border-slate-600">Total</th>
                    <th className="px-4 py-3.5 text-center text-xs font-semibold uppercase tracking-wider border-r border-slate-600">Status</th>
                    <th className="px-4 py-3.5 text-right text-xs font-semibold uppercase tracking-wider border-r border-slate-600">Deleted At</th>
                    <th className="px-4 py-3.5 text-center text-xs font-semibold uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTrashItems.map((q: Quotation, i: number) => (
                    <tr key={q.id} className={`border-b border-slate-100 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}>
                      <td className="px-4 py-3 border-r border-slate-100 font-bold text-slate-700">{q.quotationNumber}</td>
                      <td className="px-4 py-3 border-r border-slate-100 text-slate-500">{q.shopName || q.customerName || '—'}</td>
                      <td className="px-4 py-3 border-r border-slate-100 text-right font-bold text-slate-900">{fmtAmt(q.totalAmount)}</td>
                      <td className="px-4 py-3 border-r border-slate-100 text-center"><StatusBadge status={q.status} /></td>
                      <td className="px-4 py-3 border-r border-slate-100 text-right text-slate-400 text-xs">{q.deletedAt ? formatDateTime(q.deletedAt) : '—'}</td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => restoreMut.mutate(q.id)}
                          disabled={restoreMut.isPending}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 border border-indigo-200 rounded-lg text-xs font-medium hover:bg-indigo-600 hover:text-white hover:border-indigo-600 transition disabled:opacity-50"
                        >
                          <RotateCcw className="w-3.5 h-3.5" /> Restore
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>)}
          {(trashData as any)?.totalPages > 1 && (
            <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500">{(trashData as any).totalCount} total · page {(trashData as any).page} of {(trashData as any).totalPages}</span>
              <div className="flex gap-1">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition">Prev</button>
                <button onClick={() => setPage(p => Math.min((trashData as any).totalPages, p + 1))} disabled={page >= (trashData as any).totalPages} className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition">Next</button>
              </div>
            </div>
          )}
        </div>
      )}

      {quickLightbox && createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center" onClick={() => setQuickLightbox(null)}>
          <button className="absolute top-4 right-4 text-white bg-white/10 rounded-full p-2.5 hover:bg-white/25 transition" onClick={() => setQuickLightbox(null)}>
            <X className="w-5 h-5" />
          </button>
          <PrivateImage apiPath={quickLightbox} alt="Preview" className="max-h-[88vh] max-w-[92vw] rounded-xl object-contain" onClick={e => e.stopPropagation()} />
        </div>,
        document.body
      )}

      {/* ── Reject modal ─────────────────────────────────────────────────── */}
      {rejectTarget && createPortal(
        <div className="fixed inset-0 z-50 flex flex-col items-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => { setRejectTarget(null); setRejectReason(''); }} />
          <div className="relative mt-16 w-full max-w-sm mx-4 bg-white rounded-2xl shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <div>
                <h3 className="font-semibold text-slate-900">Reject Quotation</h3>
                <p className="text-xs text-slate-500 mt-0.5">{rejectTarget.quotationNumber}</p>
              </div>
              <button onClick={() => { setRejectTarget(null); setRejectReason(''); }} className="p-2 hover:bg-slate-100 rounded-xl transition">
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Reason for rejection</label>
                <textarea
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                  rows={3}
                  placeholder="Provide a reason..."
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm outline-none resize-none focus:ring-2 focus:ring-red-500/15 focus:border-red-300 transition"
                />
              </div>
              <div className="flex gap-3">
                <button onClick={() => { setRejectTarget(null); setRejectReason(''); }} className="flex-1 py-2.5 bg-slate-100 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-200 transition">Cancel</button>
                <button
                  disabled={!rejectReason.trim() || rejectMut.isPending}
                  onClick={() => rejectMut.mutate({ id: rejectTarget.id, reason: rejectReason })}
                  className="flex-1 py-2.5 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 disabled:opacity-50 transition"
                >
                  {rejectMut.isPending ? 'Rejecting…' : 'Reject'}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── Delete confirm modal ─────────────────────────────────────────── */}
      {deleteConfirmOpen && createPortal(
        <div className="fixed inset-0 z-50 flex flex-col items-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => setDeleteConfirmOpen(false)} />
          <div className="relative mt-24 w-full max-w-sm mx-4 bg-white rounded-2xl shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <div>
                <h3 className="font-semibold text-slate-900">Move to Trash</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {selectAllPages
                    ? `All ${(data as any)?.totalCount ?? '…'} quotations will be moved to trash`
                    : `${selectedIds.size} quotation${selectedIds.size !== 1 ? 's' : ''} will be moved to trash`}
                </p>
              </div>
              <button onClick={() => setDeleteConfirmOpen(false)} className="p-2 hover:bg-slate-100 rounded-xl transition">
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-sm text-slate-600">Trashed quotations are permanently deleted after 30 days.</p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteConfirmOpen(false)} className="flex-1 py-2.5 bg-slate-100 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-200 transition">Cancel</button>
                <button
                  disabled={deleteMut.isPending}
                  onClick={() => {
                    const allIds = selectAllPages
                      ? sortedItems.map(q => q.id)
                      : [...selectedIds];
                    const regularIds = selectAllPages
                      ? allIds
                      : allIds.filter(id => !allRows.find((r: any) => r.id === id)?._isQuick);
                    const quickIds = selectAllPages
                      ? []
                      : allIds
                          .filter(id => allRows.find((r: any) => r.id === id)?._isQuick)
                          .map(id => (allRows.find((r: any) => r.id === id) as any)._quick.id);
                    Promise.all([
                      ...regularIds.map(id => deleteMut.mutateAsync(id)),
                      ...quickIds.map(id => quickRequestApi.adminSoftDelete(id)),
                    ])
                      .then(() => {
                        if (quickIds.length > 0) {
                          queryClient.setQueriesData({ queryKey: ['admin-quick-quotations'] }, (old: any) =>
                            Array.isArray(old) ? old.filter((q: any) => !quickIds.includes(q.id)) : old
                          );
                          queryClient.invalidateQueries({ queryKey: ['admin-quick-quotations'] });
                        }
                        setSelectedIds(new Set());
                        setSelectAllPages(false);
                        setDeleteConfirmOpen(false);
                        toast.success(`${allIds.length} item${allIds.length !== 1 ? 's' : ''} deleted`);
                      })
                      .catch(() => toast.error('Some deletions failed'));
                  }}
                  className="flex-1 py-2.5 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 disabled:opacity-50 transition"
                >
                  {deleteMut.isPending ? 'Deleting…' : 'Move to Trash'}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
