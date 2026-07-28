// @ts-nocheck
import { Fragment, useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { PrivateImage } from '../../components/common/PrivateImage';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { repGetQuotations, repDeleteQuotation, repGetQuotationsTrash, repRestoreQuotation } from '../../services/api/quotationApi';
import toast from 'react-hot-toast';
import { customersApi } from '../../services/api/customersApi';
import { quickRequestApi } from '../../services/api/quickRequestApi';
import { formatCurrency, formatRelative, formatDate, formatDateTime } from '../../utils/formatters';
import { taxCodeToRate } from '../../utils/calculations';
import { downloadQuotationPdf } from '../../utils/quotationPdf';
import { useNavigate } from 'react-router-dom';
import { FileText, Plus, Download, X, FileSpreadsheet, ArrowUpDown, ArrowUp, ArrowDown, Trash2, RotateCcw } from 'lucide-react';
import { useIsDesktop } from '../../hooks/useMediaQuery';
import PageHeader from '../../components/common/PageHeader';
import MobileTileList from '../../components/common/MobileTileList';
import BottomSheet from '../../components/common/BottomSheet';
import StatusBadge from '../../components/common/StatusBadge';
import EmptyState from '../../components/common/EmptyState';
import type { Quotation } from '../../types/quotation.types';
import { downloadQuickRequestPdf, downloadQuickRequestExcel, downloadImage } from '../../utils/quickRequestPdf';

const BASE = import.meta.env.VITE_API_URL?.replace('/api', '') || '';

const STATUS_FILTERS = [
  { label: 'All', value: '' },
  { label: 'Pending', value: 'Pending' },
  { label: 'Approved', value: 'Approved' },
  { label: 'Rejected', value: 'Rejected' },
  { label: 'Completed', value: 'Completed' },
];

export default function RepQuotations() {
  const navigate = useNavigate();
  const desktop = useIsDesktop();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [activeTab, setActiveTab] = useState<'active' | 'trash'>('active');
  const [statusFilter, setStatusFilter] = useState('');
  const [selected, setSelected] = useState<Quotation | null>(null);
  const [selectedQuick, setSelectedQuick] = useState<any>(null);
  const [quickLightbox, setQuickLightbox] = useState<string | null>(null);
  const [sortField, setSortField] = useState<string>('createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const toggleSort = (f: string) => { if (sortField === f) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortField(f); setSortDir('asc'); } };
  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 opacity-30" />;
    return sortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-600" /> : <ArrowDown className="w-3 h-3 text-indigo-600" />;
  };
  const { data, isLoading } = useQuery({
    queryKey: ['rep-quotations', page, statusFilter],
    queryFn: () => repGetQuotations(page, 20, statusFilter || undefined),
    enabled: activeTab === 'active',
  });

  const { data: customersData } = useQuery({
    queryKey: ['rep-quotation-customer-names'],
    queryFn: () => customersApi.repGetCustomers({ page: 1, pageSize: 2000 }).then((r) => r.data.data.items),
  });

  const quotations = data?.items || [];
  const customerNameById = new Map((customersData || []).map((c) => [c.id, c.shopName]));
  const getIsTax = (q: Quotation) => {
    const cust = (customersData || []).find((c) => c.id === q.customerId);
    if (!cust) return undefined;
    return (cust.customerType || '').toLowerCase().replace(/[-\s]/g, '') !== 'nontax';
  };
  const totalPages = data ? Math.ceil(data.totalCount / data.pageSize) : 0;

  const { data: quickData = [] } = useQuery({
    queryKey: ['rep-quick-quotations'],
    queryFn: () => quickRequestApi.repGetAll('Quotation').then(r => r.data.data),
    enabled: activeTab === 'active',
  });

  const { data: trashData, isLoading: trashLoading } = useQuery({
    queryKey: ['rep-quotations-trash'],
    queryFn: () => repGetQuotationsTrash(1, 200),
    enabled: activeTab === 'trash',
  });

  const { data: quickTrashData = [] } = useQuery({
    queryKey: ['rep-quick-quotations-trash'],
    queryFn: () => quickRequestApi.repGetTrash('Quotation').then(r => r.data.data),
    enabled: activeTab === 'trash',
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => repDeleteQuotation(id),
    onSuccess: (_, id) => {
      toast.success('Moved to trash', { id: 'quotation-delete' });
      queryClient.setQueriesData({ queryKey: ['rep-quotations'] }, (old: any) =>
        old ? { ...old, items: old.items?.filter((q: any) => q.id !== id), totalCount: Math.max(0, (old.totalCount ?? 0) - 1) } : old
      );
      queryClient.invalidateQueries({ queryKey: ['rep-quotations'] });
      queryClient.invalidateQueries({ queryKey: ['rep-quotations-trash'] });
    },
    onError: () => toast.error('Failed to delete', { id: 'quotation-delete' }),
  });

  const restoreMut = useMutation({
    mutationFn: (id: string) => repRestoreQuotation(id),
    onSuccess: () => {
      toast.success('Quotation restored', { id: 'quotation-restore' });
      queryClient.invalidateQueries({ queryKey: ['rep-quotations'] });
      queryClient.invalidateQueries({ queryKey: ['rep-quotations-trash'] });
    },
    onError: () => toast.error('Failed to restore', { id: 'quotation-restore' }),
  });

  const quickDeleteMut = useMutation({
    mutationFn: (id: string) => quickRequestApi.repDelete(id),
    onSuccess: () => {
      toast.success('Moved to trash', { id: 'quotation-delete' });
      queryClient.invalidateQueries({ queryKey: ['rep-quick-quotations'] });
      queryClient.invalidateQueries({ queryKey: ['rep-quick-quotations-trash'] });
    },
    onError: () => toast.error('Failed to delete', { id: 'quotation-delete' }),
  });

  const quickRestoreMut = useMutation({
    mutationFn: (id: string) => quickRequestApi.repRestore(id),
    onSuccess: () => {
      toast.success('Quotation restored', { id: 'quotation-restore' });
      queryClient.invalidateQueries({ queryKey: ['rep-quick-quotations'] });
      queryClient.invalidateQueries({ queryKey: ['rep-quick-quotations-trash'] });
    },
    onError: () => toast.error('Failed to restore', { id: 'quotation-restore' }),
  });

  const quickQuotationRows = useMemo(() => (quickData as any[]).map((r: any) => ({
    _isQuick: true, _quick: r,
    id: r.id, quotationNumber: r.requestNumber,
    customerName: r.customerName, createdAt: r.createdAt, status: r.status,
    items: [] as any[], totalAmount: 0,
  })), [quickData]);

  const daysLeft = (deletedAt: string | undefined) => {
    if (!deletedAt) return null;
    const d = Math.ceil(7 - (Date.now() - new Date(deletedAt).getTime()) / 86400000);
    return Math.max(0, d);
  };

  const allTrashItems = useMemo(() => {
    const regular = (trashData?.items || []).map((q: any) => ({
      ...q, _isQuick: false,
      quotationNumber: q.quotationNumber, customerName: q.customerName || q.shopName || '—',
    }));
    const quick = (quickTrashData as any[]).map((r: any) => ({
      _isQuick: true, _quick: r,
      id: r.id, quotationNumber: r.requestNumber,
      customerName: r.customerName, status: r.status,
      deletedAt: r.deletedAt || r.updatedAt || r.createdAt,
      totalAmount: 0,
    }));
    return [...regular, ...quick].sort((a, b) => (b.deletedAt || '').localeCompare(a.deletedAt || ''));
  }, [trashData, quickTrashData]);

  const allQuotations: any[] = useMemo(() => {
    const merged = [...quotations, ...quickQuotationRows];
    return merged.sort((a, b) => {
      let av: any, bv: any;
      switch (sortField) {
        case 'quotationNumber': av = a.quotationNumber; bv = b.quotationNumber; break;
        case 'customerName':    av = a.customerName || ''; bv = b.customerName || ''; break;
        case 'totalAmount':     av = a.totalAmount || 0;  bv = b.totalAmount || 0;  break;
        case 'status':          av = a.status;            bv = b.status;            break;
        default:                av = a.createdAt || '';   bv = b.createdAt || '';   break;
      }
      if (typeof av === 'string') av = av.toLowerCase();
      if (typeof bv === 'string') bv = bv.toLowerCase();
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [quotations, quickQuotationRows, sortField, sortDir]);

  const getCustomerDisplayName = (quotation: Quotation) => {
    const fromCustomerList = customerNameById.get(quotation.customerId);
    if (fromCustomerList) return fromCustomerList;
    if (quotation.shopName) return quotation.shopName;
    if (!quotation.customerName) return 'Customer';
    return quotation.customerName.includes('@') ? 'Customer' : quotation.customerName;
  };

  useEffect(() => {
    if (!selected) return;
    const updated = quotations.find((item) => item.id === selected.id) || null;
    setSelected(updated);
  }, [quotations, selected?.id]);

  const handleRowClick = (q: any) => {
    if (q._isQuick) { setSelectedQuick(q._quick); return; }
    setSelected((prev) => (prev?.id === q.id ? null : q));
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Quotations"
        subtitle={`${data?.totalCount || 0} quotations`}
        actions={[
          {
            label: 'New Quote',
            onClick: () => navigate('/rep/quotations/new'),
            icon: Plus,
            variant: 'primary' as const,
          },
        ]}
      />

      <div className="pb-6 space-y-4">
        {/* Tab switcher */}
        <div className="inline-flex bg-slate-100 rounded-xl p-1 gap-1">
          <button
            onClick={() => { setActiveTab('active'); setPage(1); }}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${activeTab === 'active' ? 'bg-white shadow-sm text-emerald-700' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Active
          </button>
          <button
            onClick={() => { setActiveTab('trash'); setPage(1); setSelected(null); }}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${activeTab === 'trash' ? 'bg-white shadow-sm text-rose-600' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <Trash2 className="w-3 h-3" /> Trash
          </button>
        </div>

        {activeTab === 'active' && (
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => {
                setStatusFilter(f.value);
                setPage(1);
              }}
              className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                statusFilter === f.value
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/20'
                  : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        )}

        {activeTab === 'active' && (desktop ? (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {isLoading ? (
              <div className="p-10 text-center text-slate-400 text-sm">Loading quotations</div>
            ) : allQuotations.length === 0 ? (
              <div className="p-12">
                <EmptyState
                  icon={FileText}
                  title="No quotations yet"
                  description="Create a quote to get started"
                  action={{ label: 'New Quote', onClick: () => navigate('/rep/quotations/new') }}
                />
              </div>
            ) : (
              <table className="w-full table-fixed">
                <colgroup>
                  <col className="w-[26%]" />
                  <col className="w-[22%]" />
                  <col className="w-[11%]" />
                  <col className="w-[15%]" />
                  <col className="w-[10%]" />
                  <col className="w-[10%]" />
                  <col className="w-[6%]" />
                </colgroup>
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th onClick={() => toggleSort('quotationNumber')} className="px-4 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide cursor-pointer hover:bg-slate-100 select-none transition-colors"><span className="inline-flex items-center gap-1">Quotation # <SortIcon field="quotationNumber" /></span></th>
                    <th onClick={() => toggleSort('customerName')} className="px-4 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide cursor-pointer hover:bg-slate-100 select-none transition-colors"><span className="inline-flex items-center gap-1">Customer <SortIcon field="customerName" /></span></th>
                    <th className="px-3 py-3 text-center text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Items</th>
                    <th onClick={() => toggleSort('totalAmount')} className="px-4 py-3 text-right text-[11px] font-semibold text-slate-500 uppercase tracking-wide cursor-pointer hover:bg-slate-100 select-none transition-colors"><span className="inline-flex items-center justify-end gap-1">Total <SortIcon field="totalAmount" /></span></th>
                    <th onClick={() => toggleSort('status')} className="px-4 py-3 text-center text-[11px] font-semibold text-slate-500 uppercase tracking-wide cursor-pointer hover:bg-slate-100 select-none transition-colors"><span className="inline-flex items-center gap-1">Status <SortIcon field="status" /></span></th>
                    <th onClick={() => toggleSort('createdAt')} className="px-4 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide cursor-pointer hover:bg-slate-100 select-none transition-colors"><span className="inline-flex items-center gap-1">Created <SortIcon field="createdAt" /></span></th>
                    <th className="px-3 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {allQuotations.map((q: any) => {
                    if (q._isQuick) {
                      const qr = q._quick;
                      return (
                        <Fragment key={qr.id}>
                          <tr
                            onClick={() => handleRowClick(q)}
                            className="border-b border-slate-50 cursor-pointer transition-colors hover:bg-emerald-50/30"
                          >
                            <td className="px-4 py-3.5 font-semibold text-slate-900 truncate">
                              <div className="flex flex-col gap-0.5">
                                <span>{qr.requestNumber}</span>
                                <span className="inline-flex w-fit px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-700">Quick Quotation</span>
                              </div>
                            </td>
                            <td className="px-4 py-3.5 text-slate-700 truncate">{qr.customerName}</td>
                            <td className="px-3 py-3.5 text-center text-slate-400">—</td>
                            <td className="px-4 py-3.5 text-right text-slate-400">—</td>
                            <td className="px-4 py-3.5 text-center"><StatusBadge status={qr.status} type="quotations" /></td>
                            <td className="px-4 py-3.5 text-xs text-slate-500 whitespace-nowrap">{formatDateTime(qr.createdAt)}</td>
                            <td className="px-2 py-3.5 text-center">
                              <button
                                onClick={e => { e.stopPropagation(); quickDeleteMut.mutate(qr.id); }}
                                disabled={quickDeleteMut.isPending}
                                className="p-1.5 rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-500 transition disabled:opacity-40"
                                title="Move to trash"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        </Fragment>
                      );
                    }
                    return (
                    <Fragment key={q.id}>
                      <tr
                        onClick={() => handleRowClick(q)}
                        className={`border-b border-slate-50 cursor-pointer transition-colors ${
                          selected?.id === q.id ? 'bg-emerald-50/50 border-emerald-100' : 'hover:bg-slate-50/70'
                        }`}
                      >
                        <td className="px-4 py-3.5 font-semibold text-slate-900 truncate" title={q.quotationNumber}>
                          {q.quotationNumber}
                        </td>
                        <td className="px-4 py-3.5 text-slate-700 truncate" title={getCustomerDisplayName(q)}>
                          {getCustomerDisplayName(q)}
                        </td>
                        <td className="px-3 py-3.5 text-center text-slate-600 font-medium">{q.items?.length || 0}</td>
                        <td className="px-4 py-3.5 text-right font-semibold text-slate-900 tabular-nums">{formatCurrency(q.totalAmount)}</td>
                        <td className="px-4 py-3.5 text-center">
                          <StatusBadge status={q.status} type="quotations" />
                        </td>
                        <td className="px-4 py-3.5 text-xs text-slate-500 whitespace-nowrap">{formatDateTime(q.createdAt)}</td>
                        <td className="px-2 py-3.5 text-center">
                          <button
                            onClick={e => { e.stopPropagation(); deleteMut.mutate(q.id); }}
                            disabled={deleteMut.isPending}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-500 transition disabled:opacity-40"
                            title="Move to trash"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>

                      {selected?.id === q.id && (
                        <tr className="border-b border-emerald-100">
                          <td colSpan={7} className="p-0">
                            <div className="bg-gradient-to-b from-emerald-50/70 to-slate-50/20 px-6 py-4" style={{ animation: 'fadeIn 0.18s ease-out both' }}>
                              {q.items?.length > 0 && (
                                <div className="rounded-xl overflow-x-auto border border-slate-200 mb-4">
                                  <table className="w-full text-[11px] min-w-[980px]">
                                    <thead>
                                      <tr className="bg-slate-50">
                                        <th className="px-3 py-2 text-center font-semibold text-slate-500 uppercase w-8">#</th>
                                        <th className="px-3 py-2 text-left font-semibold text-slate-500 uppercase">Item Code</th>
                                        <th className="px-3 py-2 text-left font-semibold text-slate-500 uppercase">Item Description</th>
                                        <th className="px-3 py-2 text-center font-semibold text-slate-500 uppercase">Qty</th>
                                        <th className="px-3 py-2 text-right font-semibold text-slate-500 uppercase">Rate</th>
                                        <th className="px-3 py-2 text-right font-semibold text-slate-500 uppercase">Disc %</th>
                                        <th className="px-3 py-2 text-right font-semibold text-slate-500 uppercase">Disc Amt</th>
                                        {getIsTax(q) !== false && <th className="px-3 py-2 text-right font-semibold text-slate-500 uppercase">Tax</th>}
                                        <th className="px-3 py-2 text-right font-semibold text-slate-500 uppercase">Line Gross</th>
                                        <th className="px-3 py-2 text-right font-semibold text-slate-500 uppercase">Request Price</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                      {q.items.map((item: any, idx: number) => {
                                        const rate = item.unitPrice || 0;
                                        const qty = item.quantity || 0;
                                        const discPct = item.discountPercent || 0;
                                        const isTax = getIsTax(q);
                                        const lineTaxRate = taxCodeToRate(item.taxCode);
                                        const allIncRate = Math.round(rate * (1 + lineTaxRate) * 100) / 100;
                                        const displayRate = isTax === false ? allIncRate : rate;
                                        const lineGross = isTax === false ? allIncRate * qty : rate * qty;
                                        const discAmt = isTax === false ? (allIncRate * qty * discPct) / 100 : (rate * qty * discPct) / 100;
                                        return (
                                          <tr key={item.id}>
                                            <td className="px-3 py-2.5 text-center text-slate-400">{idx + 1}</td>
                                            <td className="px-3 py-2.5 text-slate-400 text-xs font-mono">{item.productSKU || '-'}</td>
                                            <td className="px-3 py-2.5 text-slate-800 max-w-[220px] truncate" title={item.productName || '-'}>
                                              {item.productName || '-'}
                                            </td>
                                            <td className="px-3 py-2.5 text-center text-slate-600">{qty}</td>
                                            <td className="px-3 py-2.5 text-right text-slate-700">{formatCurrency(displayRate)}</td>
                                            <td className="px-3 py-2.5 text-right text-slate-700">{discPct ? `${discPct}%` : '-'}</td>
                                            <td className="px-3 py-2.5 text-right text-slate-700">{discAmt ? formatCurrency(discAmt) : '-'}</td>
                                            {isTax !== false && <td className="px-3 py-2.5 text-center text-slate-700">{item.taxCode || '—'}</td>}
                                            <td className="px-3 py-2.5 text-right font-semibold text-slate-900">{formatCurrency(lineGross)}</td>
                                            <td className="px-3 py-2.5 text-right text-slate-700">
                                              {item.expectedPrice != null ? formatCurrency(item.expectedPrice) : '-'}
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              )}

                              {q.rejectionReason && (
                                <div className="bg-red-50 rounded-xl p-3 mb-3">
                                  <p className="text-sm text-red-600">
                                    <strong>Rejected:</strong> {q.rejectionReason}
                                  </p>
                                </div>
                              )}

                              <div className="flex justify-end mt-4">
                                <button
                                  onClick={() => downloadQuotationPdf(q, getIsTax(q))}
                                  className="px-4 py-2.5 border border-slate-200 text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-50 transition flex items-center gap-2"
                                >
                                  <Download className="w-4 h-4" /> Download PDF
                                </button>
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
            )}

            {data && totalPages > 1 && (
              <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs text-slate-500">
                  {data.totalCount} total • page {page} of {totalPages}
                </span>
                <div className="flex gap-1">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition"
                  >
                    Prev
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <MobileTileList
            data={allQuotations}
            isLoading={isLoading}
            keyExtractor={(q: any) => q.id}
            onTileClick={(q: any) => handleRowClick(q)}
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
            renderTile={(q: any) => {
              if (q._isQuick) {
                const qr = q._quick;
                return (
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-100 to-green-100 flex items-center justify-center flex-shrink-0">
                          <FileText className="w-5 h-5 text-emerald-600" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-800 text-sm">{qr.requestNumber}</p>
                          <span className="inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">Quick Quotation</span>
                          <p className="text-[11px] text-slate-400 mt-0.5">{qr.customerName}</p>
                          <p className="text-[10px] text-slate-300 mt-0.5">{formatRelative(qr.createdAt)}</p>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <StatusBadge status={qr.status} type="quotations" />
                      </div>
                    </div>
                    <div className="mt-2.5 flex justify-end">
                      <button
                        onClick={e => { e.stopPropagation(); quickDeleteMut.mutate(qr.id); }}
                        disabled={quickDeleteMut.isPending}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-red-500 hover:bg-red-50 border border-slate-200 hover:border-red-100 transition disabled:opacity-40"
                        title="Move to trash"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Delete
                      </button>
                    </div>
                  </div>
                );
              }
              return (
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-100 to-green-100 flex items-center justify-center flex-shrink-0">
                      <FileText className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-800 text-sm">{q.quotationNumber}</p>
                      <p className="text-[11px] text-slate-400">{getCustomerDisplayName(q)}</p>
                      <p className="text-[10px] text-slate-300 mt-0.5">{formatRelative(q.createdAt)}</p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-slate-800">{formatCurrency(q.totalAmount)}</p>
                    <StatusBadge status={q.status} type="quotations" />
                  </div>
                </div>
                {q.rejectionReason && (
                  <div className="mt-2 bg-red-50 rounded-lg px-3 py-2">
                    <p className="text-xs text-red-600">
                      <span className="font-semibold">Rejected:</span> {q.rejectionReason}
                    </p>
                  </div>
                )}
                <div className="mt-2.5 flex justify-end">
                  <button
                    onClick={e => { e.stopPropagation(); deleteMut.mutate(q.id); }}
                    disabled={deleteMut.isPending}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-red-500 hover:bg-red-50 border border-slate-200 hover:border-red-100 transition disabled:opacity-40"
                    title="Move to trash"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </button>
                </div>
              </div>
              );
            }}
          />
        ))}

        {activeTab === 'trash' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {trashLoading ? (
              <div className="p-10 text-center text-slate-400 text-sm">Loading trash…</div>
            ) : allTrashItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                <Trash2 className="w-10 h-10 mb-3 opacity-20" />
                <p className="text-sm font-medium">Trash is empty</p>
                <p className="text-xs mt-1 text-slate-300">Deleted quotations appear here for 7 days then are permanently removed</p>
              </div>
            ) : (
              <>
                {/* Mobile */}
                <div className="lg:hidden divide-y divide-slate-100">
                  {allTrashItems.map((q: any) => {
                    const left = daysLeft(q.deletedAt);
                    return (
                      <div key={q.id} className="px-4 py-3.5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold text-slate-700 truncate">{q.quotationNumber}</p>
                            {q._isQuick && <span className="inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">Quick</span>}
                            <p className="text-xs text-slate-400 mt-0.5 truncate">{q.customerName || '—'}</p>
                            <p className="text-[10px] text-slate-300 mt-0.5">Deleted {q.deletedAt ? formatDateTime(q.deletedAt) : '—'}</p>
                          </div>
                          {left !== null && (
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${left <= 1 ? 'bg-red-100 text-red-600' : 'bg-amber-50 text-amber-600'}`}>
                              {left}d left
                            </span>
                          )}
                        </div>
                        <div className="flex justify-end mt-2.5">
                          <button
                            onClick={() => q._isQuick ? quickRestoreMut.mutate(q._quick.id) : restoreMut.mutate(q.id)}
                            disabled={restoreMut.isPending || quickRestoreMut.isPending}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-lg text-xs font-medium hover:bg-emerald-600 hover:text-white hover:border-emerald-600 transition disabled:opacity-50"
                          >
                            <RotateCcw className="w-3.5 h-3.5" /> Restore
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {/* Desktop */}
                <div className="hidden lg:block">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-slate-800 text-white">
                        <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider border-r border-slate-600">Quotation #</th>
                        <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider border-r border-slate-600">Customer</th>
                        <th className="px-4 py-3.5 text-center text-xs font-semibold uppercase tracking-wider border-r border-slate-600">Status</th>
                        <th className="px-4 py-3.5 text-right text-xs font-semibold uppercase tracking-wider border-r border-slate-600">Deleted At</th>
                        <th className="px-4 py-3.5 text-center text-xs font-semibold uppercase tracking-wider border-r border-slate-600">Days Left</th>
                        <th className="px-4 py-3.5 text-center text-xs font-semibold uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allTrashItems.map((q: any, i: number) => {
                        const left = daysLeft(q.deletedAt);
                        return (
                          <tr key={q.id} className={`border-b border-slate-100 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}>
                            <td className="px-4 py-3 border-r border-slate-100">
                              <span className="font-bold text-slate-700">{q.quotationNumber}</span>
                              {q._isQuick && <span className="ml-2 inline-flex px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-emerald-100 text-emerald-700">Quick</span>}
                            </td>
                            <td className="px-4 py-3 border-r border-slate-100 text-slate-500 truncate max-w-[200px]">{q.customerName || '—'}</td>
                            <td className="px-4 py-3 border-r border-slate-100 text-center"><StatusBadge status={q.status} type="quotations" /></td>
                            <td className="px-4 py-3 border-r border-slate-100 text-right text-slate-400 text-xs">{q.deletedAt ? formatDateTime(q.deletedAt) : '—'}</td>
                            <td className="px-4 py-3 border-r border-slate-100 text-center">
                              {left !== null && (
                                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${left <= 1 ? 'bg-red-100 text-red-600' : 'bg-amber-50 text-amber-600'}`}>
                                  {left} day{left !== 1 ? 's' : ''}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <button
                                onClick={() => q._isQuick ? quickRestoreMut.mutate(q._quick.id) : restoreMut.mutate(q.id)}
                                disabled={restoreMut.isPending || quickRestoreMut.isPending}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-lg text-xs font-medium hover:bg-emerald-600 hover:text-white hover:border-emerald-600 transition disabled:opacity-50"
                              >
                                <RotateCcw className="w-3.5 h-3.5" /> Restore
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {selectedQuick && createPortal(
        <div className="fixed inset-0 z-[9998] bg-black/60 flex items-end md:items-center justify-center p-4" onClick={() => setSelectedQuick(null)}>
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div>
                <p className="text-base font-bold text-slate-900">{selectedQuick.requestNumber}</p>
                <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-700">Quick Quotation</span>
              </div>
              <button onClick={() => setSelectedQuick(null)} className="p-2 rounded-full hover:bg-slate-100 transition">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-4 overflow-y-auto max-h-[70vh]">
              <div className="grid grid-cols-2 gap-3">
                <div><p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Customer</p><p className="text-sm text-slate-800">{selectedQuick.customerName}</p></div>
                <div><p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Date</p><p className="text-sm text-slate-800">{formatDateTime(selectedQuick.createdAt)}</p></div>
                <div><p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Status</p><StatusBadge status={selectedQuick.status} type="quotations" /></div>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Quotation Details</p>
                <pre className="text-sm text-slate-800 whitespace-pre-wrap font-sans bg-slate-50 border border-slate-100 rounded-xl p-3">{selectedQuick.details}</pre>
              </div>
              {selectedQuick.adminNotes && (
                <div>
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Admin Notes</p>
                  <p className="text-sm text-slate-700 bg-amber-50 border border-amber-100 rounded-xl p-3">{selectedQuick.adminNotes}</p>
                </div>
              )}
              {selectedQuick.imageUrls?.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-2">Photos ({selectedQuick.imageUrls.length})</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedQuick.imageUrls.map((url: string, i: number) => (
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
            </div>
            <div className="px-5 py-3 border-t border-slate-100 flex gap-2">
              <button onClick={() => downloadQuickRequestPdf(selectedQuick)} className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 text-sm font-semibold rounded-xl text-red-600 hover:bg-red-50 border border-red-100 transition">
                <Download className="w-4 h-4" /> PDF
              </button>
              <button onClick={() => downloadQuickRequestExcel(selectedQuick)} className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 text-sm font-semibold rounded-xl text-emerald-600 hover:bg-emerald-50 border border-emerald-100 transition">
                <FileSpreadsheet className="w-4 h-4" /> Excel
              </button>
            </div>
          </div>
        </div>,
        document.body
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

      <BottomSheet isOpen={!!selected && !desktop} onClose={() => setSelected(null)} title={selected?.quotationNumber || 'Quotation'}>
        {selected && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold text-slate-900">{selected.quotationNumber}</p>
                <p className="text-sm text-slate-500">{getCustomerDisplayName(selected)}</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-slate-900">{formatCurrency(selected.totalAmount)}</p>
                <StatusBadge status={selected.status} type="quotations" />
              </div>
            </div>
            {selected.items?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-600 mb-2">Items</p>
                <div className="rounded-xl overflow-x-auto border border-slate-200">
                  <table className="w-full text-[11px] min-w-[980px]">
                    <thead>
                      <tr className="bg-slate-50">
                        <th className="px-3 py-2 text-center font-semibold text-slate-500 uppercase w-8">#</th>
                        <th className="px-3 py-2 text-left font-semibold text-slate-500 uppercase">Item Code</th>
                        <th className="px-3 py-2 text-left font-semibold text-slate-500 uppercase">Item Description</th>
                        <th className="px-3 py-2 text-center font-semibold text-slate-500 uppercase">Qty</th>
                        <th className="px-3 py-2 text-right font-semibold text-slate-500 uppercase">Rate</th>
                        <th className="px-3 py-2 text-right font-semibold text-slate-500 uppercase">Disc %</th>
                        <th className="px-3 py-2 text-right font-semibold text-slate-500 uppercase">Disc Amt</th>
                        {getIsTax(selected) !== false && <th className="px-3 py-2 text-right font-semibold text-slate-500 uppercase">Tax</th>}
                        <th className="px-3 py-2 text-right font-semibold text-slate-500 uppercase">Line Gross</th>
                        <th className="px-3 py-2 text-right font-semibold text-slate-500 uppercase">Request Price</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selected.items.map((item: any, idx: number) => {
                        const rate = item.unitPrice || 0;
                        const qty = item.quantity || 0;
                        const discPct = item.discountPercent || 0;
                        const isTax = getIsTax(selected);
                        const lineTaxRate = taxCodeToRate(item.taxCode);
                        const allIncRate = Math.round(rate * (1 + lineTaxRate) * 100) / 100;
                        const displayRate = isTax === false ? allIncRate : rate;
                        const lineGross = isTax === false ? allIncRate * qty : rate * qty;
                        const discAmt = isTax === false ? (allIncRate * qty * discPct) / 100 : (rate * qty * discPct) / 100;
                        return (
                          <tr key={item.id}>
                            <td className="px-3 py-2.5 text-center text-slate-400">{idx + 1}</td>
                            <td className="px-3 py-2.5 text-slate-400 text-xs font-mono">{item.productSKU || '-'}</td>
                            <td className="px-3 py-2.5 text-slate-800 max-w-[220px] truncate" title={item.productName || '-'}>
                              {item.productName || '-'}
                            </td>
                            <td className="px-3 py-2.5 text-center text-slate-600">{qty}</td>
                            <td className="px-3 py-2.5 text-right text-slate-700">{formatCurrency(displayRate)}</td>
                            <td className="px-3 py-2.5 text-right text-slate-700">{discPct ? `${discPct}%` : '-'}</td>
                            <td className="px-3 py-2.5 text-right text-slate-700">{discAmt ? formatCurrency(discAmt) : '-'}</td>
                            {isTax !== false && <td className="px-3 py-2.5 text-center text-slate-700">{item.taxCode || '—'}</td>}
                            <td className="px-3 py-2.5 text-right font-semibold text-slate-900">{formatCurrency(lineGross)}</td>
                            <td className="px-3 py-2.5 text-right text-slate-700">
                              {item.expectedPrice != null ? formatCurrency(item.expectedPrice) : '-'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {selected.rejectionReason && (
              <div className="bg-red-50 rounded-xl p-3">
                <p className="text-sm text-red-600">
                  <strong>Rejected:</strong> {selected.rejectionReason}
                </p>
              </div>
            )}

            <button
              onClick={() => downloadQuotationPdf(selected, getIsTax(selected))}
              className="w-full px-4 py-2.5 border border-slate-200 text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-50 transition flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" /> Download PDF
            </button>
          </div>
        )}
      </BottomSheet>
    </div>
  );
}
