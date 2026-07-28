// @ts-nocheck
import { createPortal } from 'react-dom';
import { PrivateImage } from '../../components/common/PrivateImage';
import { Fragment, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Search, X, Trash2, RotateCcw, ChevronRight, ShoppingCart,
  Download, FileSpreadsheet, RefreshCw, Check, SlidersHorizontal,
  ArrowUpDown, ArrowUp, ArrowDown,
} from 'lucide-react';
import { ordersApi } from '../../services/api/ordersApi';
import { quickRequestApi } from '../../services/api/quickRequestApi';
import { customersApi } from '../../services/api/customersApi';
import { coordinatorGetReps } from '../../services/api/coordinatorApi';
import type { Order, OrderStatus } from '../../types/order.types';
import { FILTER_ORDER_STATUSES } from '../../types/order.types';
import { formatCurrency, formatDate, formatDateTime } from '../../utils/formatters';
import { useIsDesktop } from '../../hooks/useMediaQuery';
import MobileTileList from '../../components/common/MobileTileList';
import StatusBadge from '../../components/common/StatusBadge';
import { downloadQuickRequestPdf, downloadQuickRequestExcel } from '../../utils/quickRequestPdf';
import RoleOrderTrash from '../../components/orders/RoleOrderTrash';

const BASE = import.meta.env.VITE_API_URL?.replace('/api', '') || '';

export default function CoordinatorOrders() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<OrderStatus | ''>('');
  const [search, setSearch] = useState('');
  const [repIdFilter, setRepIdFilter] = useState('');
  const [customerIdFilter, setCustomerIdFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [activeTab, setActiveTab] = useState<'active' | 'trash'>('active');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [showBulkStatusModal, setShowBulkStatusModal] = useState(false);
  const [bulkStatusValue, setBulkStatusValue] = useState<OrderStatus | ''>('');
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [filterSubPanel, setFilterSubPanel] = useState<'status' | 'rep' | 'customer' | 'date' | null>(null);
  const [sortField, setSortField] = useState<string>('orderDate');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const toggleSort = (f: string) => { if (sortField === f) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortField(f); setSortDir('asc'); } };
  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 opacity-30" />;
    return sortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-600" /> : <ArrowDown className="w-3 h-3 text-indigo-600" />;
  };

  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const isDesktop = useIsDesktop();

  /* ─ Data ─────────────────────────────────────────────────── */
  const { data: repsData } = useQuery({
    queryKey: ['coordinator-reps-filter'],
    queryFn: () => coordinatorGetReps().then(r => r || []),
    staleTime: 5 * 60 * 1000,
  });

  const { data: customersData } = useQuery({
    queryKey: ['coordinator-customers-filter'],
    queryFn: () => customersApi.coordinatorGetAll({ pageSize: 500 }).then(r => r.data.data?.items || []),
    staleTime: 5 * 60 * 1000,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['coordinator-orders', page, status, fromDate, toDate, repIdFilter, customerIdFilter],
    queryFn: () => ordersApi.coordinatorGetAll({
      page, pageSize: 20,
      status: status || undefined,
      fromDate: fromDate || undefined,
      toDate: toDate || undefined,
      repId: repIdFilter || undefined,
      customerId: customerIdFilter || undefined,
    }).then(r => r.data.data),
    enabled: activeTab === 'active',
  });

  const { data: quickData = [] } = useQuery({
    queryKey: ['coordinator-quick-orders', status],
    queryFn: () => quickRequestApi.coordinatorGetAll('Order', status || undefined).then(r => r.data.data),
    enabled: activeTab === 'active',
  });

  const { data: trashData, isLoading: trashLoading } = useQuery({
    queryKey: ['coordinator-orders-trash', page],
    queryFn: () => ordersApi.coordinatorGetTrash(page, 20).then(r => r.data.data),
    enabled: false,
  });

  const { data: quickTrashData = [], isLoading: quickTrashLoading } = useQuery({
    queryKey: ['coordinator-quick-orders-trash'],
    queryFn: () => quickRequestApi.coordinatorGetTrash('Order').then(r => r.data.data),
    enabled: false,
  });

  /* ─ Mutations ─────────────────────────────────────────────── */
  const approveMut = useMutation({
    mutationFn: (id: string) => ordersApi.coordinatorApprove(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['coordinator-orders'] }); toast.success('Order approved'); },
    onError: () => toast.error('Failed to approve'),
  });

  const rejectMut = useMutation({
    mutationFn: ({ id, reason }) => ordersApi.coordinatorReject(id, reason),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['coordinator-orders'] }); toast.success('Order rejected'); },
    onError: () => toast.error('Failed to reject'),
  });

  const updateStatusMut = useMutation({
    mutationFn: ({ id, s }) => ordersApi.coordinatorUpdateStatus(id, { status: s }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['coordinator-orders'] }); toast.success('Status updated'); },
  });

  const quickStatusMut = useMutation({
    mutationFn: ({ id, s }) => quickRequestApi.coordinatorUpdateStatus(id, { status: s }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['coordinator-quick-orders'] }); toast.success('Status updated'); },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => ordersApi.coordinatorDelete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coordinator-orders'] });
      queryClient.invalidateQueries({ queryKey: ['coordinator-orders-trash'] });
      toast.success('Moved to trash');
    },
  });

  const quickDeleteMut = useMutation({
    mutationFn: (id: string) => quickRequestApi.coordinatorDelete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coordinator-quick-orders'] });
      queryClient.invalidateQueries({ queryKey: ['coordinator-quick-orders-trash'] });
      toast.success('Moved to trash');
    },
  });

  const restoreMut = useMutation({
    mutationFn: (id: string) => ordersApi.coordinatorRestore(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coordinator-orders'] });
      queryClient.invalidateQueries({ queryKey: ['coordinator-orders-trash'] });
      toast.success('Order restored');
    },
  });

  const quickRestoreMut = useMutation({
    mutationFn: (id: string) => quickRequestApi.coordinatorRestore(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coordinator-quick-orders'] });
      queryClient.invalidateQueries({ queryKey: ['coordinator-quick-orders-trash'] });
      toast.success('Quick order restored');
    },
  });

  /* ─ Computed ──────────────────────────────────────────────── */
  const orders: Order[] = data?.items || [];
  const totalPages = data?.totalPages || 1;
  const reps = (repsData || []).map((r: any) => ({ id: r.id, fullName: r.fullName }));
  const customers = customersData || [];
  const activeFilterCount = (status ? 1 : 0) + (repIdFilter ? 1 : 0) + (customerIdFilter ? 1 : 0) + ((fromDate || toDate) ? 1 : 0);

  const quickOrderRows = useMemo(() => {
    const rows = (quickData as any[]).map(r => ({
      _isQuick: true, _quick: r,
      id: r.id, orderNumber: r.requestNumber,
      customerName: r.customerName, repName: r.repName,
      orderDate: r.createdAt, status: r.status,
      items: [], totalAmount: 0,
    }));
    return status ? rows.filter(r => r.status === status) : rows;
  }, [quickData, status]);

  const allRows = useMemo(() => {
    const merged = [...orders, ...quickOrderRows];
    const q = search.toLowerCase();
    const filtered = q ? merged.filter(r =>
      (r.orderNumber || '').toLowerCase().includes(q) ||
      (r.customerName || '').toLowerCase().includes(q) ||
      (r.repName || '').toLowerCase().includes(q)
    ) : merged;
    return filtered.sort((a, b) => {
      let av: any, bv: any;
      switch (sortField) {
        case 'orderNumber':  av = a.orderNumber || '';    bv = b.orderNumber || '';    break;
        case 'customerName': av = a.customerName || '';   bv = b.customerName || '';   break;
        case 'repName':      av = a.repName || '';        bv = b.repName || '';        break;
        case 'totalAmount':  av = a.totalAmount || 0;    bv = b.totalAmount || 0;    break;
        case 'status':       av = a.status || '';        bv = b.status || '';        break;
        default:             av = a.orderDate || '';     bv = b.orderDate || '';     break;
      }
      if (typeof av === 'string') av = av.toLowerCase();
      if (typeof bv === 'string') bv = bv.toLowerCase();
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [orders, quickOrderRows, search, sortField, sortDir]);

  const toggleSelection = (id: string) => setSelectedIds(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  const toggleAll = () => selectedIds.size === allRows.length && allRows.length > 0 ? setSelectedIds(new Set()) : setSelectedIds(new Set(allRows.map(r => r.id)));

  const handleBulkStatusChange = async () => {
    if (!bulkStatusValue) return;
    const ids = [...selectedIds];
    const rowMap = new Map(allRows.map(r => [r.id, r]));
    const regularIds = ids.filter(id => !rowMap.get(id)?._isQuick);
    const quickIds = ids.filter(id => rowMap.get(id)?._isQuick);
    try {
      await Promise.all([
        ...regularIds.map(id => ordersApi.coordinatorUpdateStatus(id, { status: bulkStatusValue as OrderStatus })),
        ...quickIds.map(id => quickRequestApi.coordinatorUpdateStatus(id, { status: bulkStatusValue })),
      ]);
      queryClient.invalidateQueries({ queryKey: ['coordinator-orders'] });
      queryClient.invalidateQueries({ queryKey: ['coordinator-quick-orders'] });
      setShowBulkStatusModal(false); setSelectedIds(new Set());
      toast.success(`${ids.length} order(s) updated to ${bulkStatusValue}`);
    } catch { toast.error('Some updates failed'); }
  };

  const handleBulkDelete = async () => {
    const ids = [...selectedIds];
    const rowMap = new Map(allRows.map(r => [r.id, r]));
    const regularIds = ids.filter(id => !rowMap.get(id)?._isQuick);
    const quickIds = ids.filter(id => rowMap.get(id)?._isQuick);
    await Promise.all([
      ...regularIds.map(id => ordersApi.coordinatorDelete(id)),
      ...quickIds.map(id => quickRequestApi.coordinatorDelete(id)),
    ]);
    queryClient.invalidateQueries({ queryKey: ['coordinator-orders'] });
    queryClient.invalidateQueries({ queryKey: ['coordinator-quick-orders'] });
    queryClient.invalidateQueries({ queryKey: ['coordinator-orders-trash'] });
    setSelectedIds(new Set());
    toast.success(`${ids.length} moved to trash`);
  };

  const handleReject = (orderId: string) => {
    const reason = window.prompt('Enter rejection reason');
    if (!reason?.trim()) { toast.error('Reason required'); return; }
    rejectMut.mutate({ id: orderId, reason: reason.trim() });
  };

  /* ─ Render ────────────────────────────────────────────────── */
  return (
    <div className="animate-fade-in flex flex-col gap-4 pb-28">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Orders</h1>
        <p className="text-slate-500 text-sm mt-1">Track and manage orders from your assigned reps</p>
      </div>

      {/* Sticky Toolbar */}
      <div className="sticky top-0 z-30">
        <div className="bg-white/95 backdrop-blur-sm border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-3 py-2.5 flex flex-wrap sm:flex-nowrap items-center gap-x-2 gap-y-2">

            {/* Tabs */}
            <div className="flex gap-0.5 bg-slate-100 p-0.5 rounded-lg shrink-0 order-1">
              <button onClick={() => { setActiveTab('active'); setPage(1); setSelectedIds(new Set()); }}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${activeTab === 'active' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>Active</button>
              <button onClick={() => { setActiveTab('trash'); setPage(1); setSelectedIds(new Set()); }}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${activeTab === 'trash' ? 'bg-white shadow-sm text-rose-600' : 'text-slate-500 hover:text-slate-700'}`}>
                <Trash2 className="w-3 h-3" />Trash
              </button>
            </div>

            {/* Search */}
            <div className="relative group order-3 sm:order-2 w-full sm:w-auto sm:flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
              <input type="text" placeholder="Search order # or customer…" value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                className="w-full pl-8 pr-7 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm placeholder-slate-400 focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/15 outline-none transition-all" />
              {search && <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X className="w-3.5 h-3.5" /></button>}
            </div>

            {/* Right */}
            <div className="order-2 sm:order-3 ml-auto sm:ml-0 flex items-center gap-1 shrink-0">
              <button onClick={() => setFilterPanelOpen(p => !p)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-semibold transition-all ${filterPanelOpen ? 'bg-indigo-600 text-white' : activeFilterCount > 0 ? 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200' : 'text-slate-600 hover:bg-slate-100'}`}>
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Filter</span>
                {activeFilterCount > 0 && <span className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold ${filterPanelOpen ? 'bg-white/30 text-white' : 'bg-indigo-600 text-white'}`}>{activeFilterCount}</span>}
              </button>
              {selectedIds.size > 0 && (
                <>
                  <div className="w-px h-5 bg-slate-200 mx-0.5" />
                  <button onClick={() => { setBulkStatusValue(''); setShowBulkStatusModal(true); }}
                    className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-semibold text-blue-600 hover:bg-blue-50 transition-all">
                    <RefreshCw className="w-3.5 h-3.5" /><span className="hidden lg:inline">Status</span>
                  </button>
                  <button onClick={handleBulkDelete}
                    className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-semibold text-red-600 hover:bg-red-50 transition-all">
                    <Trash2 className="w-3.5 h-3.5" /><span className="hidden lg:inline">Delete ({selectedIds.size})</span>
                  </button>
                  <button onClick={() => setSelectedIds(new Set())} className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Filter Panel */}
          {filterPanelOpen && (
            <div className="border-t border-slate-100">
              <div className="flex flex-wrap bg-slate-50 px-3 pt-3 gap-1">
                {([{ key: 'status', label: 'Status', count: status ? 1 : 0 }, { key: 'rep', label: 'Rep', count: repIdFilter ? 1 : 0 }, { key: 'customer', label: 'Customer', count: customerIdFilter ? 1 : 0 }, { key: 'date', label: 'Date', count: (fromDate || toDate) ? 1 : 0 }] as any[]).map(({ key, label, count }) => (
                  <button key={key} onClick={() => setFilterSubPanel(p => p === key ? null : key)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-t-lg text-xs font-semibold border border-b-0 transition-all ${filterSubPanel === key ? 'bg-white border-slate-200 text-slate-800 -mb-px pb-[7px] z-10 relative' : count > 0 ? 'bg-indigo-50 border-indigo-100 text-indigo-700' : 'bg-transparent border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-100'}`}>
                    {label}
                    {count > 0 && <span className="w-4 h-4 rounded-full bg-indigo-600 text-white text-[9px] font-bold inline-flex items-center justify-center">{count}</span>}
                  </button>
                ))}
                {activeFilterCount > 0 && (
                  <button onClick={() => { setStatus(''); setRepIdFilter(''); setCustomerIdFilter(''); setFromDate(''); setToDate(''); setPage(1); }}
                    className="ml-auto inline-flex items-center gap-1 px-2.5 py-1.5 rounded-t-lg text-xs font-semibold text-red-500 hover:text-red-700 hover:bg-red-50 transition-all border border-transparent">
                    <X className="w-3 h-3" /> Clear all
                  </button>
                )}
              </div>
              <div className="bg-white border-t border-slate-200 px-4 py-4">
                {filterSubPanel === 'status' && (
                  <div className="flex flex-wrap gap-2">
                    {FILTER_ORDER_STATUSES.map(s => (
                      <button key={s} onClick={() => { setStatus(prev => prev === s ? '' : s); setPage(1); }}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${status === s ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm' : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-700 hover:bg-indigo-50'}`}>
                        {status === s && <Check className="w-3 h-3" />}{s}
                      </button>
                    ))}
                  </div>
                )}
                {filterSubPanel === 'rep' && (
                  <div className="flex flex-wrap gap-2">
                    {reps.map((r: any) => (
                      <button key={r.id} onClick={() => { setRepIdFilter(prev => prev === r.id ? '' : r.id); setPage(1); }}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${repIdFilter === r.id ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm' : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-700 hover:bg-indigo-50'}`}>
                        {repIdFilter === r.id && <Check className="w-3 h-3" />}{r.fullName}
                      </button>
                    ))}
                  </div>
                )}
                {filterSubPanel === 'customer' && (
                  <div className="flex flex-wrap gap-2">
                    {customers.slice(0, 30).map((c: any) => (
                      <button key={c.id} onClick={() => { setCustomerIdFilter(prev => prev === c.id ? '' : c.id); setPage(1); }}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${customerIdFilter === c.id ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm' : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-700 hover:bg-indigo-50'}`}>
                        {customerIdFilter === c.id && <Check className="w-3 h-3" />}{c.shopName}
                      </button>
                    ))}
                  </div>
                )}
                {filterSubPanel === 'date' && (
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-2"><span className="text-xs text-slate-500 font-medium">From</span><input type="date" value={fromDate} onChange={e => { setFromDate(e.target.value); setPage(1); }} className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500/15" /></div>
                    <div className="flex items-center gap-2"><span className="text-xs text-slate-500 font-medium">To</span><input type="date" value={toDate} onChange={e => { setToDate(e.target.value); setPage(1); }} className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500/15" /></div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Trash View */}
      {activeTab === 'trash' ? (
        <>
        <RoleOrderTrash role='coordinator' />
        <div className="hidden bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100"><span className="text-sm font-semibold text-slate-700">Items remain until manually restored or removed</span></div>
          {(trashLoading || quickTrashLoading) ? <div className="p-8 text-center text-slate-400 text-sm">Loading...</div>
            : (() => {
                const repName = repIdFilter ? (reps.find(r => r.id === repIdFilter)?.fullName || '').toLowerCase() : '';
                const custName = customerIdFilter ? (customers.find(c => c.id === customerIdFilter)?.shopName || '').toLowerCase() : '';
                const regularItems = (trashData?.items || []).map((o: any) => ({ ...o, _isQuick: false, displayNumber: o.orderNumber, deletedOn: o.deletedAt || o.coordinatorDeletedAt }));
                const quickItems = (quickTrashData as any[]).map((q: any) => ({ ...q, _isQuick: true, displayNumber: q.requestNumber, deletedOn: q.deletedAt }));
                let allTrashItems = [...regularItems, ...quickItems].sort((a, b) => new Date(b.deletedOn || 0).getTime() - new Date(a.deletedOn || 0).getTime());
                // Apply active filters
                if (status)        allTrashItems = allTrashItems.filter(o => o.status === status);
                if (repName)       allTrashItems = allTrashItems.filter(o => (o.repName || '').toLowerCase().includes(repName));
                if (custName)      allTrashItems = allTrashItems.filter(o => (o.customerName || '').toLowerCase().includes(custName));
                if (fromDate)      allTrashItems = allTrashItems.filter(o => { const d = o.deletedOn || o.orderDate || o.createdAt; return d && d >= fromDate; });
                if (toDate)        allTrashItems = allTrashItems.filter(o => { const d = o.deletedOn || o.orderDate || o.createdAt; return d && d.slice(0, 10) <= toDate; });
                if (search.trim()) { const sq = search.toLowerCase(); allTrashItems = allTrashItems.filter(o => (o.displayNumber || '').toLowerCase().includes(sq) || (o.customerName || '').toLowerCase().includes(sq)); }
                if (!allTrashItems.length) return (
                  <div className="p-8 text-center text-slate-400 text-sm">
                    {(regularItems.length + quickItems.length) > 0 ? 'No items match the current filters' : 'Trash is empty'}
                  </div>
                );
                return (
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-100">
                      <tr>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">Order #</th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">Customer</th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">Date</th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">Status</th>
                        <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {allTrashItems.map((o: any) => (
                        <tr key={o.id} className="hover:bg-slate-50/50">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              <span className="font-medium text-slate-800">{o.displayNumber}</span>
                              {o._isQuick && <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-violet-100 text-violet-700">Quick</span>}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-slate-600">{o.customerName}</td>
                          <td className="px-4 py-3 text-slate-500">{formatDateTime(o.deletedOn || o.orderDate || o.createdAt)}</td>
                          <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => o._isQuick ? quickRestoreMut.mutate(o.id) : restoreMut.mutate(o.id)}
                              disabled={restoreMut.isPending || quickRestoreMut.isPending}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg text-emerald-700 hover:bg-emerald-50 border border-emerald-200 transition disabled:opacity-50">
                              <RotateCcw className="w-3 h-3" /> Restore
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                );
              })()}
        </div>
        </>
      ) : (
        /* Active View */
        <>
          {isDesktop ? (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              {isLoading ? (
                <div className="p-10 text-center text-slate-400 text-sm">Loading orders...</div>
              ) : allRows.length === 0 ? (
                <div className="p-14 text-center"><ShoppingCart className="w-10 h-10 text-slate-200 mx-auto mb-2" /><p className="text-slate-400 text-sm">No orders found</p></div>
              ) : (
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-slate-800 text-white">
                      <th className="w-10 px-3 py-3.5 text-center border-r border-slate-600">
                        <input type="checkbox" checked={allRows.length > 0 && selectedIds.size === allRows.length} onChange={toggleAll} className="accent-indigo-400 w-3.5 h-3.5 cursor-pointer" />
                      </th>
                      <th className="w-8 px-2 py-3.5 border-r border-slate-600" />
                      <th onClick={() => toggleSort('orderNumber')} className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider border-r border-slate-600 cursor-pointer hover:bg-slate-700 transition-colors whitespace-nowrap select-none w-60">
                        <span className="flex items-center gap-1.5">Order <SortIcon field="orderNumber" /></span>
                      </th>
                      <th onClick={() => toggleSort('customerName')} className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider border-r border-slate-600 cursor-pointer hover:bg-slate-700 transition-colors select-none w-48">
                        <span className="flex items-center gap-1.5">Customer <SortIcon field="customerName" /></span>
                      </th>
                      <th onClick={() => toggleSort('repName')} className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider border-r border-slate-600 cursor-pointer hover:bg-slate-700 transition-colors select-none w-32">
                        <span className="flex items-center gap-1.5">Rep <SortIcon field="repName" /></span>
                      </th>
                      <th className="px-3 py-3.5 text-center text-xs font-semibold uppercase tracking-wider border-r border-slate-600 w-16">Items</th>
                      <th className="px-4 py-3.5 text-right text-xs font-semibold uppercase tracking-wider border-r border-slate-600 w-28 whitespace-nowrap">Total</th>
                      <th onClick={() => toggleSort('orderDate')} className="px-4 py-3.5 text-right text-xs font-semibold uppercase tracking-wider border-r border-slate-600 cursor-pointer hover:bg-slate-700 transition-colors select-none w-28 whitespace-nowrap">
                        <span className="flex items-center justify-end gap-1.5">Date <SortIcon field="orderDate" /></span>
                      </th>
                      <th onClick={() => toggleSort('status')} className="px-4 py-3.5 text-center text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-slate-700 transition-colors select-none w-32">
                        <span className="flex items-center justify-center gap-1.5">Status <SortIcon field="status" /></span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {allRows.map((row: any) => {
                      if (row._isQuick) {
                        const qr = row._quick;
                        const isExpanded = expandedOrderId === qr.id;
                        return (
                          <Fragment key={qr.id}>
                            <tr onClick={() => { if (selectedIds.size > 0) toggleSelection(qr.id); else setExpandedOrderId(p => p === qr.id ? null : qr.id); }}
                              className={`border-b border-slate-100 cursor-pointer transition-colors select-none ${selectedIds.has(qr.id) ? 'bg-violet-50/60' : isExpanded ? 'bg-violet-50/50 border-violet-100' : 'hover:bg-slate-50/70'}`}>
                              <td className="px-3 py-3 text-center border-r border-slate-100" onClick={e => { e.stopPropagation(); toggleSelection(qr.id); }}>
                                <input type="checkbox" readOnly checked={selectedIds.has(qr.id)} className="pointer-events-none accent-violet-500 w-3.5 h-3.5" />
                              </td>
                              <td className="px-2 py-3 border-r border-slate-100">
                                <ChevronRight className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-90 text-violet-500' : 'text-slate-400'}`} />
                              </td>
                              <td className="px-4 py-3 border-r border-slate-100 whitespace-nowrap">
                                <div className="flex flex-col gap-0.5">
                                  <span className="font-bold text-slate-900">{qr.requestNumber}</span>
                                  <span className="inline-flex w-fit px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-violet-100 text-violet-700">Quick Order</span>
                                </div>
                              </td>
                              <td className="px-4 py-3 border-r border-slate-100"><span className="text-slate-700 truncate block">{qr.customerName}</span></td>
                              <td className="px-4 py-3 border-r border-slate-100"><span className="text-slate-500">{qr.repName || '—'}</span></td>
                              <td className="px-3 py-3 text-center border-r border-slate-100"><span className="text-slate-400">—</span></td>
                              <td className="px-4 py-3 text-right border-r border-slate-100"><span className="text-slate-400">—</span></td>
                              <td className="px-4 py-3 text-right border-r border-slate-100 whitespace-nowrap"><span className="text-slate-500">{formatDateTime(qr.createdAt)}</span></td>
                              <td className="px-4 py-3 text-center"><StatusBadge status={qr.status} /></td>
                            </tr>
                            {isExpanded && (
                              <tr className="border-b border-violet-100">
                                <td colSpan={9} className="p-0">
                                  <div className="bg-gradient-to-b from-violet-50/40 to-white px-8 py-5">
                                    <div className="flex items-start gap-6">
                                      <div className="flex-1 space-y-3">
                                        <div>
                                          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">Order Details</p>
                                          <pre className="text-sm text-slate-800 whitespace-pre-wrap font-sans bg-white border border-slate-100 rounded-xl p-3">{qr.details}</pre>
                                        </div>
                                        {qr.adminNotes && (
                                          <div>
                                            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Notes</p>
                                            <p className="text-sm text-slate-700 bg-amber-50 border border-amber-100 rounded-xl p-3">{qr.adminNotes}</p>
                                          </div>
                                        )}
                                        {qr.imageUrls?.length > 0 && (
                                          <div>
                                            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-2">Photos ({qr.imageUrls.length})</p>
                                            <div className="flex flex-wrap gap-2">
                                              {qr.imageUrls.map((url: string, i: number) => (
                                                <PrivateImage key={i} apiPath={url} alt={`Photo ${i + 1}`} className="w-20 h-20 rounded-xl object-cover border border-slate-200" />
                                              ))}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                      <div className="shrink-0 space-y-2 min-w-[190px]">
                                        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Update Status</p>
                                        <div className="flex flex-col gap-1.5" onClick={e => e.stopPropagation()}>
                                          {FILTER_ORDER_STATUSES.map(s => (
                                            <button key={s} onClick={() => quickStatusMut.mutate({ id: qr.id, s })} disabled={quickStatusMut.isPending}
                                              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition text-left ${s === qr.status ? 'bg-slate-800 text-white border-slate-800' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'} disabled:opacity-50`}>
                                              {s === qr.status ? `✓ ${s}` : s}
                                            </button>
                                          ))}
                                        </div>
                                        <div className="flex gap-1.5 mt-1" onClick={e => e.stopPropagation()}>
                                          <button onClick={() => downloadQuickRequestPdf(qr)} className="flex-1 inline-flex items-center justify-center gap-1 py-1.5 text-xs font-semibold rounded-lg text-red-600 hover:bg-red-50 border border-red-100 transition">
                                            <Download className="w-3 h-3" /> PDF
                                          </button>
                                          <button onClick={() => downloadQuickRequestExcel(qr)} className="flex-1 inline-flex items-center justify-center gap-1 py-1.5 text-xs font-semibold rounded-lg text-emerald-600 hover:bg-emerald-50 border border-emerald-100 transition">
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

                      // Regular order
                      const isSelected = selectedIds.has(row.id);
                      const isExpanded = expandedOrderId === row.id;
                      return (
                        <Fragment key={row.id}>
                          <tr
                            onClick={() => { if (selectedIds.size > 0) toggleSelection(row.id); else setExpandedOrderId(p => p === row.id ? null : row.id); }}
                            className={`border-b border-slate-100 cursor-pointer transition-colors select-none ${isSelected ? 'bg-indigo-50/60' : isExpanded ? 'bg-blue-50/50 border-blue-100' : 'hover:bg-slate-50/70'}`}
                          >
                            <td className="px-3 py-3 text-center border-r border-slate-100" onClick={e => { e.stopPropagation(); toggleSelection(row.id); }}>
                              <input type="checkbox" readOnly checked={isSelected} className="pointer-events-none accent-indigo-500 w-3.5 h-3.5" />
                            </td>
                            <td className="px-2 py-3 border-r border-slate-100">
                              <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isExpanded ? 'rotate-90 text-blue-500' : ''}`} />
                            </td>
                            <td className="px-4 py-3 border-r border-slate-100 whitespace-nowrap">
                              <div className="flex flex-col gap-0.5">
                                <span className="font-bold text-slate-900">{row.orderNumber}</span>
                                {row.isFromApprovedQuotation && (
                                  <span className="inline-flex w-fit px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">From Quotation</span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 border-r border-slate-100 max-w-[180px]">
                              <span className="text-slate-700 truncate block">{row.customerName || '—'}</span>
                            </td>
                            <td className="px-4 py-3 border-r border-slate-100">
                              <span className="text-slate-500">{row.repName || '—'}</span>
                            </td>
                            <td className="px-3 py-3 text-center border-r border-slate-100">
                              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-600 text-xs font-bold">{row.items?.length || 0}</span>
                            </td>
                            <td className="px-4 py-3 text-right border-r border-slate-100 whitespace-nowrap">
                              <span className="font-bold text-slate-900">{formatCurrency(row.totalAmount)}</span>
                            </td>
                            <td className="px-4 py-3 text-right border-r border-slate-100 whitespace-nowrap">
                              <span className="text-slate-500">{formatDateTime(row.orderDate)}</span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <StatusBadge status={row.status} />
                            </td>
                          </tr>

                          {isExpanded && (
                            <tr className="border-b border-blue-100">
                              <td colSpan={9} className="p-0">
                                <div className="bg-gradient-to-b from-slate-50 to-white px-8 py-5" style={{ animation: 'fadeIn 0.18s ease-out both' }}>
                                  <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
                                    <div className="flex items-center gap-1.5 text-sm flex-wrap">
                                      <span className="font-semibold text-slate-700">{row.orderNumber}</span>
                                      <span className="text-slate-400">·</span>
                                      <span className="text-slate-500">{row.customerName}</span>
                                    </div>
                                    <div className="flex items-center gap-0.5 flex-wrap justify-end" onClick={e => e.stopPropagation()}>
                                      {row.status === 'Pending' ? (
                                        <>
                                          <button onClick={() => approveMut.mutate(row.id)} disabled={approveMut.isPending} className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition disabled:opacity-60">Approve</button>
                                          <button onClick={() => handleReject(row.id)} className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-semibold bg-red-50 text-red-700 hover:bg-red-100 transition">Reject</button>
                                        </>
                                      ) : (
                                        FILTER_ORDER_STATUSES.map(s => (
                                          <button key={s} disabled={updateStatusMut.isPending}
                                            onClick={() => { if (s !== row.status) updateStatusMut.mutate({ id: row.id, s }); }}
                                            className={`inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-semibold transition-all select-none ${s === row.status ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 cursor-pointer'}`}>
                                            {s === row.status && <Check className="w-3 h-3 shrink-0" />}
                                            {s}
                                          </button>
                                        ))
                                      )}
                                    </div>
                                  </div>
                                  {row.items?.length > 0 && (
                                    <div className="rounded-xl overflow-hidden border border-slate-200 mb-4">
                                      <table className="w-full text-xs border-collapse">
                                        <thead>
                                          <tr className="bg-slate-200 text-black">
                                            <th className="px-3 py-2.5 w-8 text-left text-xs font-semibold uppercase tracking-wider border-r border-slate-300">No</th>
                                            <th className="px-3 py-2.5 w-24 text-left text-xs font-semibold uppercase tracking-wider border-r border-slate-300">Item Code</th>
                                            <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider border-r border-slate-300">Description</th>
                                            <th className="px-3 py-2.5 w-12 text-center text-xs font-semibold uppercase tracking-wider border-r border-slate-300">Qty</th>
                                            <th className="px-3 py-2.5 w-28 text-right text-xs font-semibold uppercase tracking-wider border-r border-slate-300">Rate</th>
                                            <th className="px-3 py-2.5 w-10 text-right text-xs font-semibold uppercase tracking-wider border-r border-slate-300">Disc%</th>
                                            <th className="px-3 py-2.5 w-28 text-right text-xs font-semibold uppercase tracking-wider">Line Total</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {row.items.map((item: any, i: number) => {
                                            const rate = item.unitPrice || 0;
                                            const qty = item.quantity || 0;
                                            const discPct = item.discountPercent || 0;
                                            const lineTotal = item.lineTotal || (rate * qty * (1 - discPct / 100));
                                            return (
                                              <tr key={item.id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                                                <td className="px-3 py-2.5 text-center text-xs text-slate-400 font-medium border border-slate-100">{i + 1}</td>
                                                <td className="px-3 py-2.5 font-medium text-slate-900 border border-slate-100">{item.productSKU || '—'}</td>
                                                <td className="px-3 py-2.5 font-medium text-slate-900 border border-slate-100">{item.productName}</td>
                                                <td className="px-3 py-2.5 text-center text-slate-700 font-semibold border border-slate-100">{qty}</td>
                                                <td className="px-3 py-2.5 text-right text-slate-700 border border-slate-100">{formatCurrency(rate)}</td>
                                                <td className="px-3 py-2.5 text-right text-slate-500 border border-slate-100">{discPct ? `${discPct}%` : <span className="text-slate-300">—</span>}</td>
                                                <td className="px-3 py-2.5 text-right font-bold text-slate-900 border border-slate-100">{formatCurrency(lineTotal)}</td>
                                              </tr>
                                            );
                                          })}
                                        </tbody>
                                      </table>
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              )}

              {data && data.totalPages > 1 && (
                <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs text-slate-500">Page {data.page} of {data.totalPages}</span>
                  <div className="flex gap-2">
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="px-3 py-1.5 bg-white rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition">Prev</button>
                    <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="px-3 py-1.5 bg-white rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition">Next</button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <MobileTileList
              data={allRows}
              keyExtractor={(o: any) => o.id}
              isLoading={isLoading}
              page={page}
              totalPages={totalPages}
              onPageChange={setPage}
              emptyMessage="No orders found"
              emptyIcon={<ShoppingCart className="w-10 h-10" />}
              renderTile={(row: any) => (
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-900 truncate">{row.orderNumber}</p>
                      {row._isQuick && <span className="inline-flex w-fit px-2 py-0.5 rounded-full text-[10px] font-semibold bg-violet-100 text-violet-700">Quick Order</span>}
                      <p className="text-sm text-slate-500 truncate">{row.customerName}</p>
                    </div>
                    <StatusBadge status={row.status} />
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-400 mb-2">
                    <span>{formatDateTime(row.orderDate)}</span>
                    <span>Rep: {row.repName || ''}</span>
                  </div>
                  <div className="flex justify-between items-center pt-2.5 border-t border-slate-50">
                    <span className="font-bold text-slate-900">{row._isQuick ? '—' : formatCurrency(row.totalAmount)}</span>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </div>
                </div>
              )}
              onTileClick={(row: any) => !row._isQuick && navigate(`/coordinator/orders/${row.id}`)}
            />
          )}
        </>
      )}

      {/* Bulk Status Modal */}
      {showBulkStatusModal && createPortal(
        <div className="fixed inset-0 z-50 flex flex-col items-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => setShowBulkStatusModal(false)} />
          <div className="relative mt-16 w-full max-w-sm mx-4 bg-white rounded-2xl shadow-2xl border border-slate-200" style={{ animation: 'slideDown 0.25s ease-out both' }}>
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <div><h3 className="font-semibold text-slate-900">Bulk Status Change</h3><p className="text-xs text-slate-500 mt-0.5">{selectedIds.size} orders selected</p></div>
              <button onClick={() => setShowBulkStatusModal(false)} className="p-2 hover:bg-slate-100 rounded-xl transition"><X className="w-4 h-4 text-slate-400" /></button>
            </div>
            <div className="p-5 space-y-4">
              <select value={bulkStatusValue} onChange={e => setBulkStatusValue(e.target.value as OrderStatus)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/15 transition">
                <option value="">Select new status</option>
                {FILTER_ORDER_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <div className="flex gap-3">
                <button onClick={() => setShowBulkStatusModal(false)} className="flex-1 py-2.5 bg-slate-100 rounded-xl text-sm font-medium hover:bg-slate-200 transition">Cancel</button>
                <button disabled={!bulkStatusValue} onClick={handleBulkStatusChange} className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition">Apply to {selectedIds.size}</button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

