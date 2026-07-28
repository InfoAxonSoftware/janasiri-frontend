import { Fragment, useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { customerGetQuotations, customerConvertQuotation, customerCancelQuotation } from '../../services/api/quotationApi';
import { customersApi } from '../../services/api/customersApi';
import { formatCurrency, formatDate, formatDateTime, formatRelative } from '../../utils/formatters';
import { taxCodeToRate } from '../../utils/calculations';
import { downloadQuotationPdf } from '../../utils/quotationPdf';
import { useIsDesktop } from '../../hooks/useMediaQuery';
import MobileTileList from '../../components/common/MobileTileList';
import StatusBadge from '../../components/common/StatusBadge';
import EmptyState from '../../components/common/EmptyState';
import BottomSheet from '../../components/common/BottomSheet';
import { FileText, Plus, Loader2, ShoppingCart, ArrowRight, Download, Search, X, ChevronRight, ClipboardList, RefreshCcw, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Quotation, QuotationStatus } from '../../types/quotation.types';

const STATUS_FILTERS: { label: string; value: string }[] = [
  { label: 'All', value: '' },
  { label: 'Pending', value: 'Pending' },
  { label: 'Approved', value: 'Approved' },
  { label: 'Rejected', value: 'Rejected' },
  { label: 'Completed', value: 'Completed' },
];

export default function CustomerQuotations() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const desktop = useIsDesktop();
  
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [expandedQuotationId, setExpandedQuotationId] = useState<string | null>(null);
  const [selectedQuotation, setSelectedQuotation] = useState<Quotation | null>(null);
  const [convertQuotation, setConvertQuotation] = useState<Quotation | null>(null);
  
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [sortField, setSortField] = useState<string>('createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const toggleSort = (f: string) => { if (sortField === f) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortField(f); setSortDir('asc'); } };
  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 opacity-30" />;
    return sortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-orange-500" /> : <ArrowDown className="w-3 h-3 text-orange-500" />;
  };

  const { data: customerProfile } = useQuery({
    queryKey: ['customer-profile-for-quotation-tax-mode'],
    queryFn: () => customersApi.customerGetProfile().then((r): any => r.data.data),
    staleTime: 5 * 60 * 1000,
  });

  const isTaxCustomer =
    (customerProfile?.customerType || '').toLowerCase().replace(/[-\s]/g, '') === 'tax';

  const { data, isLoading } = useQuery({
    queryKey: ['customer-quotations', page, statusFilter],
    queryFn: () => customerGetQuotations(page, 20, statusFilter || undefined),
  });

  const convertMut = useMutation({
    mutationFn: ({ id }: { id: string }) =>
      customerConvertQuotation(id, {
        deliveryAddress: deliveryAddress || undefined,
        deliveryNotes: deliveryNotes || undefined,
      }),
    onSuccess: () => {
      toast.success('Quotation converted to order successfully!');
      setConvertQuotation(null);
      setDeliveryAddress('');
      setDeliveryNotes('');
      queryClient.invalidateQueries({ queryKey: ['customer-quotations'] });
      queryClient.invalidateQueries({ queryKey: ['customer-orders'] });
    },
    onError: () => toast.error('Failed to convert quotation'),
  });

  const cancelMut = useMutation({
    mutationFn: ({ id }: { id: string }) => customerCancelQuotation(id, 'Cancelled by customer'),
    onSuccess: () => {
      toast.success('Quotation cancelled successfully');
      queryClient.invalidateQueries({ queryKey: ['customer-quotations'] });
      setSelectedQuotation(null);
      setExpandedQuotationId(null);
    },
    onError: () => toast.error('Failed to cancel quotation'),
  });

  const quotations = data?.items || [];
  const totalPages = data ? Math.ceil(data.totalCount / data.pageSize) : 0;

  const filteredQuotations = useMemo(() => {
    const filtered = quotations.filter((q) => {
      if (!search.trim()) return true;
      const term = search.toLowerCase();
      return q.quotationNumber.toLowerCase().includes(term);
    });
    return [...filtered].sort((a, b) => {
      let av: any, bv: any;
      switch (sortField) {
        case 'quotationNumber': av = a.quotationNumber || ''; bv = b.quotationNumber || ''; break;
        case 'totalAmount':     av = a.totalAmount || 0;    bv = b.totalAmount || 0;    break;
        case 'status':          av = a.status || '';        bv = b.status || '';        break;
        default:                av = a.createdAt || '';     bv = b.createdAt || '';     break;
      }
      if (typeof av === 'string') av = av.toLowerCase();
      if (typeof bv === 'string') bv = bv.toLowerCase();
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [quotations, search, sortField, sortDir]);

  useEffect(() => {
    if (!selectedQuotation) return;
    const updated = quotations.find((item) => item.id === selectedQuotation.id) || null;
    setSelectedQuotation(updated);
  }, [quotations, selectedQuotation?.id]);

  useEffect(() => {
    if (!convertQuotation) return;
    const updated = quotations.find((item) => item.id === convertQuotation.id) || null;
    setConvertQuotation(updated);
  }, [quotations, convertQuotation?.id]);

  const handleRowClick = (q: Quotation) => {
    if (!desktop) {
      setSelectedQuotation(q);
      return;
    }
    setExpandedQuotationId((prev) => (prev === q.id ? null : q.id));
  };

  const handleCancelQuotation = (q: Quotation) => {
    if(window.confirm('Are you sure you want to cancel this quotation?')) {
      cancelMut.mutate({ id: q.id });
    }
  };

  const hasActiveFilters = !!(statusFilter || search);

  return (
    <div className="animate-fade-in flex flex-col gap-6 pb-28 min-h-screen bg-slate-50 lg:bg-transparent lg:px-2">
      
      {/* Page Header (Matches Order Page) */}
      <div className="bg-white lg:bg-transparent px-4 py-6 lg:p-0 border-b border-slate-200 lg:border-none">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">My Quotations</h1>
            <p className="text-slate-500 text-sm mt-1">Manage, track and convert your quotation requests</p>
          </div>
          <button
            onClick={() => navigate('/shop/quotations/new')}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-orange-600 text-white text-sm font-bold hover:bg-orange-700 active:scale-95 transition-all shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Request Quote</span>
            <span className="sm:hidden">New</span>
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="sticky top-14 md:top-16 z-20 px-4 lg:px-0">
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm px-4 py-3 space-y-3">
          {/* Search + Clear row */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-orange-500 transition-colors" />
              <input
                type="text"
                placeholder="Search by quotation #..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="w-full pl-9 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm placeholder-slate-400 focus:bg-white focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-all"
              />
              {search && (
                <button onClick={() => { setSearch(''); setPage(1); }} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            {hasActiveFilters && (
              <button
                onClick={() => { setSearch(''); setStatusFilter(''); setPage(1); }}
                className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-orange-50 border border-orange-100 text-orange-600 text-xs font-bold hover:bg-orange-100 transition flex-shrink-0"
                title="Clear Filters"
              >
                <RefreshCcw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Clear</span>
              </button>
            )}
          </div>
          {/* Status pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-0.5 scrollbar-hide">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.label}
                onClick={() => { setStatusFilter(f.value); setPage(1); }}
                className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
                  statusFilter === f.value
                    ? 'bg-orange-500 text-white shadow-sm shadow-orange-200'
                    : 'bg-slate-100 text-slate-600 hover:bg-orange-50 hover:text-orange-700'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="px-4 lg:px-0">
        {desktop ? (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {isLoading ? (
              <div className="p-12 text-center flex flex-col items-center justify-center">
                <Loader2 className="w-8 h-8 text-orange-500 animate-spin mb-3" />
                <div className="text-slate-500 text-sm font-medium">Loading your quotations...</div>
              </div>
            ) : filteredQuotations.length === 0 ? (
              <div className="p-16 text-center">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FileText className="w-8 h-8 text-slate-300" />
                </div>
                <p className="text-slate-900 font-bold text-lg">No quotations found</p>
                <p className="text-slate-500 text-sm mt-1">Try adjusting your search or request a new quote</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-4 py-4 w-8" />
                    <th onClick={() => toggleSort('quotationNumber')} className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest cursor-pointer hover:bg-slate-100 select-none transition-colors"><span className="inline-flex items-center gap-1">Quotation # <SortIcon field="quotationNumber" /></span></th>
                    <th onClick={() => toggleSort('createdAt')} className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest cursor-pointer hover:bg-slate-100 select-none transition-colors"><span className="inline-flex items-center gap-1">Date <SortIcon field="createdAt" /></span></th>
                    <th onClick={() => toggleSort('totalAmount')} className="px-4 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-widest cursor-pointer hover:bg-slate-100 select-none transition-colors"><span className="inline-flex items-center justify-end gap-1">Total <SortIcon field="totalAmount" /></span></th>
                    <th className="px-4 py-4 text-center text-xs font-bold text-slate-500 uppercase tracking-widest">Items</th>
                    <th onClick={() => toggleSort('status')} className="px-4 py-4 text-center text-xs font-bold text-slate-500 uppercase tracking-widest cursor-pointer hover:bg-slate-100 select-none transition-colors"><span className="inline-flex items-center gap-1">Status <SortIcon field="status" /></span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredQuotations.map((q) => (
                    <Fragment key={q.id}>
                      <tr
                        onClick={() => handleRowClick(q)}
                        className={`cursor-pointer transition-colors ${
                          expandedQuotationId === q.id ? 'bg-slate-50/80' : 'bg-white hover:bg-slate-50/50'
                        }`}
                      >
                        <td className="px-3 py-4 w-8 text-center">
                          <ChevronRight className={`w-4 h-4 text-slate-400 inline-block transition-transform duration-200 ${expandedQuotationId === q.id ? 'rotate-90 text-orange-600' : ''}`} />
                        </td>
                        <td className="px-4 py-4">
                          <span className="font-bold text-slate-900 text-sm">{q.quotationNumber}</span>
                        </td>
                        <td className="px-4 py-4 text-sm font-medium text-slate-500 whitespace-nowrap">{formatDateTime(q.createdAt)}</td>
                        <td className="px-4 py-4 text-right text-sm font-bold text-slate-900">{formatCurrency(q.totalAmount)}</td>
                        <td className="px-4 py-4 text-center text-sm font-medium text-slate-500">{q.items?.length || 0}</td>
                        <td className="px-4 py-4 text-center"><StatusBadge status={q.status} /></td>
                      </tr>

                      {expandedQuotationId === q.id && (
                        <tr className="bg-slate-50/50 border-b-2 border-slate-100">
                          <td colSpan={6} className="p-0">
                            <div className="px-8 py-6 animate-fade-in">
                              <div className="flex items-center justify-between mb-5 flex-wrap gap-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 bg-white rounded-xl shadow-sm border border-slate-200 flex items-center justify-center">
                                    <FileText className="w-5 h-5 text-slate-500" />
                                  </div>
                                  <div>
                                    <h3 className="font-bold text-slate-900">{q.quotationNumber} Details</h3>
                                    <p className="text-xs font-medium text-slate-500">Requested on {formatDateTime(q.createdAt)}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <button
                                    onClick={() => downloadQuotationPdf(q, isTaxCustomer)}
                                    className="px-4 py-2 bg-white text-slate-700 border border-slate-200 rounded-xl text-sm font-bold hover:bg-slate-50 active:scale-95 transition-all shadow-sm flex items-center gap-2"
                                  >
                                    <Download className="w-4 h-4 text-slate-400" /> Download PDF
                                  </button>
                                  
                                  {q.status === 'Approved' && !q.convertedOrderId && (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); setConvertQuotation(q); }}
                                      className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 active:scale-95 transition-all shadow-sm flex items-center gap-2"
                                    >
                                      <ShoppingCart className="w-4 h-4" /> Convert to Order
                                    </button>
                                  )}

                                  {(q.status === 'Submitted' || q.status === 'UnderReview') && (
                                    <button
                                      onClick={() => handleCancelQuotation(q)}
                                      disabled={cancelMut.isPending}
                                      className="px-4 py-2 bg-red-50 text-red-600 border border-red-100 rounded-xl text-sm font-bold hover:bg-red-100 active:scale-95 transition-all shadow-sm"
                                    >
                                      Cancel Quotation
                                    </button>
                                  )}
                                </div>
                              </div>

                              {q.rejectionReason && (
                                <div className="mb-4 bg-red-50 border border-red-100 rounded-xl p-4">
                                  <p className="text-xs text-red-500 font-bold uppercase tracking-wider mb-1">Rejection Reason</p>
                                  <p className="text-sm text-red-700 font-medium">{q.rejectionReason}</p>
                                </div>
                              )}

                              {q.notes && (
                                <div className="mb-4 bg-white border border-slate-200 shadow-sm rounded-xl p-4">
                                  <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Notes</p>
                                  <p className="text-sm text-slate-700 font-medium">{q.notes}</p>
                                </div>
                              )}

                              {q.items?.length ? (() => {
                                let totalGross = 0;
                                let totalDiscount = 0;
                                let totalTax = 0;
                                const taxCodes = new Set<string>();

                                const itemRows = q.items.map((item: any, i: number) => {
                                  const rate = item.unitPrice || 0;
                                  const qty = item.quantity || 0;
                                  const discPct = item.discountPercent || 0;
                                  const rowTaxRate = taxCodeToRate((item as any).taxCode);
                                  const allIncRate = Math.round(rate * (1 + rowTaxRate) * 100) / 100;
                                  const rowGrossBase = rate * qty;
                                  const displayRate = isTaxCustomer ? rate : allIncRate;
                                  const rowGross = isTaxCustomer ? rowGrossBase : allIncRate * qty;
                                  const rowDiscount = isTaxCustomer
                                    ? (item.discountAmount || ((rowGrossBase * discPct) / 100))
                                    : (allIncRate * qty * discPct) / 100;
                                  const rowNet = rowGrossBase - (rowGrossBase * discPct) / 100;
                                  const rowTax = isTaxCustomer ? rowNet * rowTaxRate : 0;

                                  totalGross += rowGross;
                                  totalDiscount += rowDiscount;
                                  totalTax += rowTax;
                                  if (isTaxCustomer && (item as any).taxCode) taxCodes.add((item as any).taxCode);

                                  return (
                                    <tr key={item.id || item.productId} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors">
                                      <td className="px-4 py-3 text-center text-xs text-slate-400 font-medium">{i + 1}</td>
                                      <td className="px-4 py-3 font-mono text-xs text-slate-600">{item.productSKU || '-'}</td>
                                      <td className="px-4 py-3 font-bold text-slate-900 text-sm max-w-[200px] truncate" title={item.productName}>{item.productName}</td>
                                      <td className="px-4 py-3 text-center font-medium text-slate-700">{qty}</td>
                                      <td className="px-4 py-3 text-right font-medium text-slate-700">{formatCurrency(displayRate)}</td>
                                      <td className="px-4 py-3 text-right font-medium text-slate-700">{discPct ? `${discPct}%` : '0.00'}</td>
                                      <td className="px-4 py-3 text-right font-medium text-emerald-600">{formatCurrency(rowDiscount)}</td>
                                      {isTaxCustomer && (
                                        <td className="px-4 py-3 text-center font-medium text-slate-600">{(item as any).taxCode || '—'}</td>
                                      )}
                                      <td className="px-4 py-3 text-right font-bold text-slate-900">{formatCurrency(rowGross)}</td>
                                      <td className="px-4 py-3 text-right font-bold text-orange-600">{item.expectedPrice != null ? formatCurrency(item.expectedPrice) : '-'}</td>
                                    </tr>
                                  );
                                });

                                const netAmount = totalGross - totalDiscount;
                                const finalAmount = isTaxCustomer ? netAmount + totalTax : netAmount;

                                return (
                                  <>
                                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-x-auto mb-5">
                                      <table className="w-full text-sm min-w-[900px]">
                                        <thead>
                                          <tr className="bg-slate-50 border-b border-slate-200">
                                            <th className="px-4 py-2.5 text-center text-[10px] font-bold text-slate-500 uppercase tracking-widest">#</th>
                                            <th className="px-4 py-2.5 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Item Code</th>
                                            <th className="px-4 py-2.5 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Item Description</th>
                                            <th className="px-4 py-2.5 text-center text-[10px] font-bold text-slate-500 uppercase tracking-widest">Qty</th>
                                            <th className="px-4 py-2.5 text-right text-[10px] font-bold text-slate-500 uppercase tracking-widest">Rate</th>
                                            <th className="px-4 py-2.5 text-right text-[10px] font-bold text-slate-500 uppercase tracking-widest">Disc %</th>
                                            <th className="px-4 py-2.5 text-right text-[10px] font-bold text-slate-500 uppercase tracking-widest">Disc Amt</th>
                                            {isTaxCustomer && (
                                              <th className="px-4 py-2.5 text-right text-[10px] font-bold text-slate-500 uppercase tracking-widest">Tax</th>
                                            )}
                                            <th className="px-4 py-2.5 text-right text-[10px] font-bold text-slate-500 uppercase tracking-widest">Line Gross</th>
                                            <th className="px-4 py-2.5 text-right text-[10px] font-bold text-slate-500 uppercase tracking-widest text-orange-600 bg-orange-50/50">Request Price</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {itemRows}
                                        </tbody>
                                      </table>
                                    </div>

                                    <div className="flex justify-end">
                                      <div className="w-full max-w-md space-y-2 bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                                        <div className="flex items-center justify-between gap-8">
                                          <span className="font-bold text-slate-500 uppercase tracking-wider text-xs">Gross Amount</span>
                                          <span className="font-bold text-slate-900 whitespace-nowrap tabular-nums">{formatCurrency(totalGross)}</span>
                                        </div>
                                        <div className="flex items-center justify-between gap-8 pb-3 border-b border-slate-100">
                                          <span className="font-bold text-orange-500 uppercase tracking-wider text-xs">Discount Amount</span>
                                          <span className="font-bold text-orange-500 whitespace-nowrap tabular-nums">-{formatCurrency(totalDiscount)}</span>
                                        </div>
                                        {isTaxCustomer && (
                                          <>
                                            <div className="flex items-center justify-between gap-8">
                                              <span className="font-bold text-slate-500 uppercase tracking-wider text-xs">Net Amount</span>
                                              <span className="font-bold text-slate-900 whitespace-nowrap tabular-nums">{formatCurrency(netAmount)}</span>
                                            </div>
                                            <div className="flex items-center justify-between gap-8 pb-3 border-b border-slate-100">
                                              <span className="font-bold text-slate-500 uppercase tracking-wider text-xs">Total Tax Amount</span>
                                              <span className="font-bold text-slate-900 whitespace-nowrap tabular-nums">{formatCurrency(totalTax)}</span>
                                            </div>
                                          </>
                                        )}
                                        <div className="flex items-center justify-between gap-8 pt-2">
                                          <span className="font-bold text-slate-800 uppercase tracking-wider text-sm">Total Invoice Value</span>
                                          <span className="text-xl font-black text-orange-600 whitespace-nowrap tabular-nums">{formatCurrency(finalAmount)}</span>
                                        </div>
                                      </div>
                                    </div>
                                  </>
                                );
                              })() : null}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            )}

            {data && totalPages > 1 && (
              <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{data.totalCount} Quotations • Page {data.page} of {totalPages}</span>
                <div className="flex gap-2">
                  <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="px-4 py-2 bg-white rounded-lg border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition shadow-sm">Prev</button>
                  <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="px-4 py-2 bg-white rounded-lg border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition shadow-sm">Next</button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <MobileTileList
            data={filteredQuotations}
            keyField="id"
            isLoading={isLoading}
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
            onTileClick={handleRowClick}
            emptyState={<EmptyState icon={FileText} title="No quotations found" description="Try adjusting your filters" action={{ label: 'Request Quote', onClick: () => navigate('/shop/quotations/new') }} />}
            renderTile={(q) => (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 relative overflow-hidden">
                <div className="flex items-start justify-between mb-3">
                  <span className="text-base font-bold text-slate-900">{q.quotationNumber}</span>
                  <StatusBadge status={q.status} />
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                    {formatDateTime(q.createdAt)} • {q.items?.length || 0} items
                  </span>
                  <span className="text-sm font-bold text-slate-900">{formatCurrency(q.totalAmount)}</span>
                </div>

                {q.rejectionReason && (
                  <div className="mt-3 bg-red-50 rounded-lg px-3 py-2 border border-red-100">
                    <p className="text-[11px] text-red-600 font-medium">
                      <span className="font-bold uppercase tracking-wider text-[10px]">Rejected:</span> {q.rejectionReason}
                    </p>
                  </div>
                )}
                
                <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-2">
                  {(q.status === 'Submitted' || q.status === 'UnderReview') && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleCancelQuotation(q); }}
                      className="flex-1 py-2.5 bg-white border border-slate-200 text-red-600 rounded-xl text-xs font-bold hover:bg-red-50 transition shadow-sm"
                    >
                      Cancel Quote
                    </button>
                  )}
                  {q.status === 'Approved' && !q.convertedOrderId && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setConvertQuotation(q); }}
                      className="flex-1 py-2.5 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-xl text-xs font-bold hover:bg-emerald-100 transition shadow-sm flex items-center justify-center gap-1.5"
                    >
                      <ShoppingCart className="w-3.5 h-3.5" /> Convert
                    </button>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); downloadQuotationPdf(q, isTaxCustomer); }}
                    className="flex-1 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-50 transition shadow-sm flex items-center justify-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" /> PDF
                  </button>
                </div>
              </div>
            )}
          />
        )}
      </div>

      {/* Mobile Bottom Sheet — Quotation Detail */}
      <BottomSheet open={!!selectedQuotation && !desktop} onClose={() => setSelectedQuotation(null)} title={selectedQuotation?.quotationNumber || 'Quotation Details'}>
        {selectedQuotation && (() => {
          let totalGross = 0;
          let totalDiscount = 0;
          let totalTax = 0;
          const taxCodes = new Set<string>();

          selectedQuotation.items?.forEach((item: any) => {
            const rate = item.unitPrice || 0;
            const qty = item.quantity || 0;
            const discPct = item.discountPercent || 0;
            const rowTaxRate = taxCodeToRate((item as any).taxCode);
            const allIncRate = Math.round(rate * (1 + rowTaxRate) * 100) / 100;
            const rowGrossBase = rate * qty;
            const rowDiscount = isTaxCustomer
              ? (item.discountAmount || ((rowGrossBase * discPct) / 100))
              : (allIncRate * qty * discPct) / 100;
            const rowNet = rowGrossBase - (rowGrossBase * discPct) / 100;
            const rowTax = isTaxCustomer ? rowNet * rowTaxRate : 0;
            const rowGross = isTaxCustomer ? rowGrossBase : allIncRate * qty;

            totalGross += rowGross;
            totalDiscount += rowDiscount;
            totalTax += rowTax;
            if (isTaxCustomer && (item as any).taxCode) taxCodes.add((item as any).taxCode);
          });

          const netAmount = totalGross - totalDiscount;
          const finalAmount = isTaxCustomer ? netAmount + totalTax : netAmount;

          return (
            <div className="space-y-5 pb-6">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Requested Date</p>
                  <p className="text-sm font-bold text-slate-900 mt-1">{formatDateTime(selectedQuotation.createdAt)}</p>
                </div>
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">Status</p>
                  <StatusBadge status={selectedQuotation.status} />
                </div>
              </div>

              {selectedQuotation.rejectionReason && (
                <div className="bg-red-50 border border-red-100 rounded-xl p-4">
                  <p className="text-xs text-red-500 font-bold uppercase tracking-wider mb-1">Rejection Reason</p>
                  <p className="text-sm text-red-700 font-medium">{selectedQuotation.rejectionReason}</p>
                </div>
              )}

              {selectedQuotation.notes && (
                <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-4">
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Notes</p>
                  <p className="text-sm text-slate-700 font-medium">{selectedQuotation.notes}</p>
                </div>
              )}

              <div>
                <h3 className="font-bold text-slate-900 text-sm mb-3 px-1">Quotation Items</h3>
                <div className="bg-white border border-slate-200 shadow-sm rounded-xl divide-y divide-slate-100 overflow-x-auto">
                  <table className="w-full text-left text-sm min-w-[500px]">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-widest">Item</th>
                        <th className="px-4 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-widest">Qty</th>
                        <th className="px-4 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-widest">Rate</th>
                        <th className="px-4 py-3 text-right text-xs font-bold text-orange-600 uppercase tracking-widest bg-orange-50/50">Req. Price</th>
                        <th className="px-4 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-widest">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedQuotation.items?.map((item: any) => {
                        const rate = item.unitPrice || 0;
                        const qty = item.quantity || 0;
                        const rowTaxRate = taxCodeToRate((item as any).taxCode);
                        const allIncRate = Math.round(rate * (1 + rowTaxRate) * 100) / 100;
                        const displayRate = isTaxCustomer ? rate : allIncRate;
                        const rowGrossBase = rate * qty;
                        const rowGross = isTaxCustomer ? rowGrossBase : allIncRate * qty;

                        return (
                          <tr key={item.id}>
                            <td className="px-4 py-3 font-bold text-slate-900 max-w-[200px] truncate">{item.productName}</td>
                            <td className="px-4 py-3 text-center font-medium text-slate-700">{qty}</td>
                            <td className="px-4 py-3 text-right font-medium text-slate-700">{formatCurrency(displayRate)}</td>
                            <td className="px-4 py-3 text-right font-bold text-orange-600">{item.expectedPrice != null ? formatCurrency(item.expectedPrice) : '-'}</td>
                            <td className="px-4 py-3 text-right font-bold text-slate-900">{formatCurrency(rowGross)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3 shadow-sm">
                <div className="flex justify-between text-sm">
                  <span className="font-bold text-slate-500 uppercase tracking-wider text-xs">Gross Amount</span>
                  <span className="font-bold text-slate-900">{formatCurrency(totalGross)}</span>
                </div>
                <div className="flex justify-between text-sm pb-3 border-b border-slate-100">
                  <span className="font-bold text-orange-500 uppercase tracking-wider text-xs">Discount Amount</span>
                  <span className="font-bold text-orange-500">-{formatCurrency(totalDiscount)}</span>
                </div>
                {isTaxCustomer && (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="font-bold text-slate-500 uppercase tracking-wider text-xs">Net Amount</span>
                      <span className="font-bold text-slate-900">{formatCurrency(netAmount)}</span>
                    </div>
                    <div className="flex justify-between text-sm pb-3 border-b border-slate-100">
                      <span className="font-bold text-slate-500 uppercase tracking-wider text-xs">Total Tax Amount</span>
                      <span className="font-bold text-slate-900">{formatCurrency(totalTax)}</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between items-center pt-1">
                  <span className="font-bold text-slate-800 uppercase tracking-wider text-sm">Total Invoice Value</span>
                  <span className="text-xl font-bold text-orange-600">{formatCurrency(finalAmount)}</span>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => downloadQuotationPdf(selectedQuotation, isTaxCustomer)}
                  className="flex-1 py-3.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-50 flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-sm"
                >
                  <Download className="w-4 h-4 text-slate-400" /> Download PDF
                </button>
                
                {selectedQuotation.status === 'Approved' && !selectedQuotation.convertedOrderId && (
                  <button
                    onClick={() => {
                      setConvertQuotation(selectedQuotation);
                      setSelectedQuotation(null);
                    }}
                    className="flex-1 py-3.5 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-sm"
                  >
                    <ShoppingCart className="w-4 h-4" /> Convert to Order
                  </button>
                )}

                {(selectedQuotation.status === 'Submitted' || selectedQuotation.status === 'UnderReview') && (
                  <button
                    onClick={() => handleCancelQuotation(selectedQuotation)}
                    disabled={cancelMut.isPending}
                    className="flex-1 py-3.5 bg-white border border-red-200 text-red-600 rounded-xl text-sm font-bold hover:bg-red-50 disabled:opacity-50 active:scale-[0.98] transition-all shadow-sm"
                  >
                    Cancel Quotation
                  </button>
                )}
              </div>
            </div>
          );
        })()}
      </BottomSheet>

      {/* Convert to Order Bottom Sheet / Modal */}
      <BottomSheet open={!!convertQuotation} onClose={() => setConvertQuotation(null)} title="Convert to Order">
        {convertQuotation && (
          <div className="space-y-5">
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 flex justify-between items-center">
              <div>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Quotation</p>
                <p className="text-sm font-bold text-slate-900 mt-0.5">{convertQuotation.quotationNumber}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Total Amount</p>
                <p className="text-sm font-bold text-orange-600 mt-0.5">{formatCurrency(convertQuotation.totalAmount)}</p>
              </div>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">Delivery Address <span className="text-slate-400 normal-case font-medium">(optional)</span></label>
                <input
                  type="text"
                  placeholder="Enter delivery address..."
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 transition-all shadow-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">Delivery Notes <span className="text-slate-400 normal-case font-medium">(optional)</span></label>
                <textarea
                  placeholder="Any special instructions..."
                  value={deliveryNotes}
                  onChange={(e) => setDeliveryNotes(e.target.value)}
                  rows={2}
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium outline-none resize-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 transition-all shadow-sm"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button onClick={() => setConvertQuotation(null)} className="flex-1 py-3.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-50 active:scale-[0.98] transition-all shadow-sm">
                Cancel
              </button>
              <button
                onClick={() => convertMut.mutate({ id: convertQuotation.id })}
                disabled={convertMut.isPending}
                className="flex-[2] py-3.5 bg-emerald-600 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-emerald-700 disabled:opacity-60 active:scale-[0.98] transition-all shadow-sm"
              >
                {convertMut.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShoppingCart className="w-4 h-4" />} 
                Confirm Conversion
              </button>
            </div>
          </div>
        )}
      </BottomSheet>
    </div>
  );
}