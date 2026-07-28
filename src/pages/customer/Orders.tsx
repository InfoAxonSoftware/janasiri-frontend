import { Fragment, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ordersApi } from '../../services/api/ordersApi';
import { customersApi } from '../../services/api/customersApi';
import { formatCurrency, formatDate, formatDateTime } from '../../utils/formatters';
import { taxCodeToRate } from '../../utils/calculations';
import { downloadPurchaseOrderPdf } from '../../utils/purchaseOrderPdf';
import { getShopName } from '../../utils/shopName';
import { useIsDesktop } from '../../hooks/useMediaQuery';
import MobileTileList from '../../components/common/MobileTileList';
import StatusBadge from '../../components/common/StatusBadge';
import EmptyState from '../../components/common/EmptyState';
import BottomSheet from '../../components/common/BottomSheet';
import { ClipboardList, Package, Star, Loader2, Search, X, ChevronRight, ShoppingCart, FileText, RefreshCcw, Trash2, RotateCcw, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import type { Order, OrderStatus } from '../../types/order.types';
import toast from 'react-hot-toast';


const STATUS_FILTERS: { label: string; value: OrderStatus | '' }[] = [
  { label: 'All', value: '' },
  { label: 'Pending', value: 'Pending' },
  { label: 'Approved', value: 'Approved' },
  { label: 'Rejected', value: 'Rejected' },
  { label: 'Completed', value: 'Completed' },
];

export default function CustomerOrders() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<OrderStatus | ''>('');
  const [search, setSearch] = useState('');
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [ratingVal, setRatingVal] = useState(0);
  const [ratingComment, setRatingComment] = useState('');
  const [activeTab, setActiveTab] = useState<'active' | 'trash'>('active');
  const [sortField, setSortField] = useState<string>('orderDate');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const toggleSort = (f: string) => { if (sortField === f) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortField(f); setSortDir('asc'); } };
  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 opacity-30" />;
    return sortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-orange-500" /> : <ArrowDown className="w-3 h-3 text-orange-500" />;
  };

  const desktop = useIsDesktop();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['customer-orders', page, status],
    queryFn: () =>
      ordersApi
        .customerGetAll({ page, pageSize: 20, status: status || (undefined as OrderStatus | undefined) })
        .then((r) => r.data.data),
  });

  const reorderMut = useMutation({
    mutationFn: (id: string) => ordersApi.customerReorder(id),
    onSuccess: () => {
      toast.success('Reorder placed successfully!');
      refetch();
    },
    onError: () => toast.error('Reorder failed'),
  });

  const cancelMut = useMutation({
    mutationFn: (id: string) => ordersApi.customerCancel(id, 'Customer cancelled'),
    onSuccess: () => {
      toast.success('Order cancelled successfully');
      refetch();
      setSelectedOrder(null);
      setExpandedOrderId(null);
    },
    onError: () => toast.error('Cancel failed'),
  });

  const rateMut = useMutation({
    mutationFn: ({ id, rating, comment }: { id: string; rating: number; comment?: string }) =>
      ordersApi.customerRate(id, { rating, comment }),
    onSuccess: () => {
      toast.success('Thank you for your rating!');
      refetch();
      setSelectedOrder(null);
      setRatingVal(0);
      setRatingComment('');
    },
    onError: () => toast.error('Rating failed'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => ordersApi.customerDelete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-orders'] });
      queryClient.invalidateQueries({ queryKey: ['customer-orders-trash'] });
      toast.success('Moved to trash');
    },
  });

  const { data: trashData, isLoading: trashLoading } = useQuery({
    queryKey: ['customer-orders-trash', page],
    queryFn: () => ordersApi.customerGetTrash(page, 20).then(r => r.data.data),
    enabled: activeTab === 'trash',
  });

  const restoreMut = useMutation({
    mutationFn: (id: string) => ordersApi.customerRestore(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-orders'] });
      queryClient.invalidateQueries({ queryKey: ['customer-orders-trash'] });
      toast.success('Order restored');
    },
  });

  const { data: customerProfile } = useQuery({
    queryKey: ['customer-profile-for-order-tax-mode'],
    queryFn: () => customersApi.customerGetProfile().then((r): any => r.data.data),
    staleTime: 5 * 60 * 1000,
  });

  const isTaxCustomer =
    (customerProfile?.customerType || '').toLowerCase().replace(/[-\s]/g, '') === 'tax';

  const orders = data?.items || [];
  const filteredOrders = useMemo(
    () => {
      const filtered = orders.filter((o) => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        const shopName = getShopName({ shopName: customerProfile?.shopName, customerName: o.customerName }).toLowerCase();
        return o.orderNumber.toLowerCase().includes(q) || shopName.includes(q);
      });
      return [...filtered].sort((a, b) => {
        let av: any, bv: any;
        switch (sortField) {
          case 'orderNumber':  av = a.orderNumber || '';   bv = b.orderNumber || '';   break;
          case 'totalAmount':  av = a.totalAmount || 0;   bv = b.totalAmount || 0;   break;
          case 'status':       av = a.status || '';       bv = b.status || '';       break;
          default:             av = a.orderDate || '';    bv = b.orderDate || '';    break;
        }
        if (typeof av === 'string') av = av.toLowerCase();
        if (typeof bv === 'string') bv = bv.toLowerCase();
        if (av < bv) return sortDir === 'asc' ? -1 : 1;
        if (av > bv) return sortDir === 'asc' ? 1 : -1;
        return 0;
      });
    },
    [orders, search, customerProfile?.shopName, sortField, sortDir]
  );

  const totalPages = data?.totalPages || 0;
  const hasActiveFilters = !!(status || search);

  const handleRowClick = (order: Order) => {
    if (!desktop) {
      setSelectedOrder(order);
      return;
    }
    setExpandedOrderId((prev) => (prev === order.id ? null : order.id));
  };

  const handleCancelOrder = (order: Order) => {
    if (order.status !== 'Pending') {
      toast.error('Only pending orders can be cancelled');
      return;
    }
    if(window.confirm('Are you sure you want to cancel this order?')) {
      cancelMut.mutate(order.id);
    }
  };

  return (
    <div className="animate-fade-in flex flex-col gap-6 pb-28 min-h-screen bg-slate-50 lg:bg-transparent lg:px-2">
      
      {/* Page Header */}
      <div className="bg-white lg:bg-transparent px-4 py-6 lg:p-0 border-b border-slate-200 lg:border-none">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Orders History</h1>
            <p className="text-slate-500 text-sm mt-1">Track, manage and reorder your past purchases</p>
          </div>
          <button
            onClick={() => navigate('/shop/products')}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-orange-600 text-white text-sm font-bold hover:bg-orange-700 active:scale-95 transition-all shadow-sm"
          >
            <ShoppingCart className="w-4 h-4" />
            <span className="hidden sm:inline">Create Order</span>
            <span className="sm:hidden">New</span>
          </button>
        </div>
        {/* Active / Trash tabs */}
        <div className="mt-3 inline-flex bg-slate-100 rounded-lg p-1 gap-1">
          <button onClick={() => { setActiveTab('active'); setPage(1); }}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${activeTab === 'active' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>
            Active
          </button>
          <button onClick={() => { setActiveTab('trash'); setPage(1); }}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${activeTab === 'trash' ? 'bg-white shadow-sm text-rose-600' : 'text-slate-500 hover:text-slate-700'}`}>
            <Trash2 className="w-3 h-3" />Trash
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
                placeholder="Search by order number..."
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
                onClick={() => { setSearch(''); setStatus(''); setPage(1); }}
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
                onClick={() => { setStatus(f.value); setPage(1); }}
                className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
                  status === f.value
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
        {activeTab === 'trash' ? (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100">
              <span className="text-sm font-semibold text-slate-700">Trash (items remain until restored)</span>
            </div>
            {trashLoading ? (
              <div className="p-8 text-center text-slate-400 text-sm">Loading...</div>
            ) : (trashData?.items || []).length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm">Trash is empty</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">Order #</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">Date</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">Status</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(trashData?.items || []).map((o: any) => (
                    <tr key={o.id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3 font-medium text-slate-800">{o.orderNumber}</td>
                      <td className="px-4 py-3 text-slate-500">{formatDateTime(o.orderDate || o.createdAt)}</td>
                      <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => restoreMut.mutate(o.id)} className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg text-emerald-700 hover:bg-emerald-50 border border-emerald-200 transition">
                          <RotateCcw className="w-3 h-3" /> Restore
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ) : desktop ? (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {isLoading ? (
              <div className="p-12 text-center flex flex-col items-center justify-center">
                <Loader2 className="w-8 h-8 text-orange-500 animate-spin mb-3" />
                <div className="text-slate-500 text-sm font-medium">Loading your orders...</div>
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="p-16 text-center">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <ClipboardList className="w-8 h-8 text-slate-300" />
                </div>
                <p className="text-slate-900 font-bold text-lg">No orders found</p>
                <p className="text-slate-500 text-sm mt-1">Try adjusting your search or filters</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-4 py-4 w-8" />
                    <th onClick={() => toggleSort('orderNumber')} className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest cursor-pointer hover:bg-slate-100 select-none transition-colors"><span className="inline-flex items-center gap-1">Order # <SortIcon field="orderNumber" /></span></th>
                    <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Shop</th>
                    <th onClick={() => toggleSort('orderDate')} className="px-4 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest cursor-pointer hover:bg-slate-100 select-none transition-colors"><span className="inline-flex items-center gap-1">Date <SortIcon field="orderDate" /></span></th>
                    <th onClick={() => toggleSort('totalAmount')} className="px-4 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-widest cursor-pointer hover:bg-slate-100 select-none transition-colors"><span className="inline-flex items-center justify-end gap-1">Total <SortIcon field="totalAmount" /></span></th>
                    <th className="px-4 py-4 text-center text-xs font-bold text-slate-500 uppercase tracking-widest">Items</th>
                    <th onClick={() => toggleSort('status')} className="px-4 py-4 text-center text-xs font-bold text-slate-500 uppercase tracking-widest cursor-pointer hover:bg-slate-100 select-none transition-colors"><span className="inline-flex items-center gap-1">Status <SortIcon field="status" /></span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredOrders.map((order) => (
                    <Fragment key={order.id}>
                      <tr
                        onClick={() => handleRowClick(order)}
                        className={`cursor-pointer transition-colors ${
                          expandedOrderId === order.id ? 'bg-slate-50/80' : 'bg-white hover:bg-slate-50/50'
                        }`}
                      >
                        <td className="px-3 py-4 w-8 text-center">
                          <ChevronRight className={`w-4 h-4 text-slate-400 inline-block transition-transform duration-200 ${expandedOrderId === order.id ? 'rotate-90 text-orange-600' : ''}`} />
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex flex-col gap-1.5">
                            <span className="font-bold text-slate-900 text-sm">{order.orderNumber}</span>
                            {order.isFromApprovedQuotation && (
                              <span className="inline-flex w-fit px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-100">
                                Approved Quotation
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-sm font-medium text-slate-600">{getShopName({ shopName: customerProfile?.shopName, customerName: order.customerName })}</td>
                        <td className="px-4 py-4 text-sm font-medium text-slate-500">{formatDateTime(order.orderDate)}</td>
                        <td className="px-4 py-4 text-right text-sm font-bold text-slate-900">{formatCurrency(order.totalAmount)}</td>
                        <td className="px-4 py-4 text-center text-sm font-medium text-slate-500">{order.items?.length || 0}</td>
                        <td className="px-4 py-4 text-center"><StatusBadge status={order.status} /></td>
                      </tr>

                      {expandedOrderId === order.id && (
                        <tr className="bg-slate-50/50 border-b-2 border-slate-100">
                          <td colSpan={7} className="p-0">
                            <div className="px-8 py-6 animate-fade-in">
                              <div className="flex items-center justify-between mb-5 flex-wrap gap-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 bg-white rounded-xl shadow-sm border border-slate-200 flex items-center justify-center">
                                    <ClipboardList className="w-5 h-5 text-slate-500" />
                                  </div>
                                  <div>
                                    <h3 className="font-bold text-slate-900">{order.orderNumber} Details</h3>
                                    <p className="text-xs font-medium text-slate-500">Placed on {formatDateTime(order.orderDate)}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <button
                                    onClick={() => downloadPurchaseOrderPdf({ ...order, isTaxCustomer })}
                                    className="px-4 py-2 bg-white text-slate-700 border border-slate-200 rounded-xl text-sm font-bold hover:bg-slate-50 active:scale-95 transition-all shadow-sm flex items-center gap-2"
                                  >
                                    <FileText className="w-4 h-4 text-slate-400" /> Download PDF
                                  </button>
                                  {order.status === 'Delivered' && (
                                     <button
                                      onClick={(e) => { e.stopPropagation(); reorderMut.mutate(order.id); }}
                                      className="px-4 py-2 bg-orange-50 text-orange-700 border border-orange-200 rounded-xl text-sm font-bold hover:bg-orange-100 active:scale-95 transition-all shadow-sm flex items-center gap-2"
                                    >
                                      <RefreshCcw className="w-4 h-4" /> Reorder
                                    </button>
                                  )}
                                  {order.status === 'Pending' && (
                                    <button
                                      onClick={() => handleCancelOrder(order)}
                                      className="px-4 py-2 bg-red-50 text-red-600 border border-red-100 rounded-xl text-sm font-bold hover:bg-red-100 active:scale-95 transition-all shadow-sm"
                                    >
                                      Cancel Order
                                    </button>
                                  )}
                                </div>
                              </div>

                              {order.items?.length ? (() => {
                                // PDF එකේ වගේම Totals ගණනය කිරීම
                                let totalGross = 0;
                                let totalDiscount = 0;
                                let totalTax = 0;
                                const taxCodes = new Set<string>();

                                const itemRows = order.items.map((item, i) => {
                                  const rate = item.unitPrice || 0;
                                  const qty = item.quantity || 0;
                                  const discPct = item.discountPercent || 0;
                                  const rowTaxRate = taxCodeToRate(item.taxCode);
                                  const allIncRate = Math.round(rate * (1 + rowTaxRate) * 100) / 100;
                                  const rowGrossBase = rate * qty;
                                  const displayRate = isTaxCustomer ? rate : allIncRate;
                                  const rowGross = isTaxCustomer ? rowGrossBase : allIncRate * qty;
                                  const rowDiscount = isTaxCustomer ? (rowGrossBase * discPct) / 100 : (allIncRate * qty * discPct) / 100;
                                  const rowNet = rowGrossBase - (rowGrossBase * discPct) / 100;
                                  const rowTax = isTaxCustomer ? rowNet * rowTaxRate : 0;

                                  totalGross += rowGross;
                                  totalDiscount += rowDiscount;
                                  totalTax += rowTax;
                                  if (isTaxCustomer && item.taxCode) taxCodes.add(item.taxCode);

                                  return (
                                    <tr key={item.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors">
                                      <td className="px-4 py-3 text-center text-xs text-slate-400 font-medium">{i + 1}</td>
                                      <td className="px-4 py-3 font-mono text-xs text-slate-600">{item.productSKU || '-'}</td>
                                      <td className="px-4 py-3 font-bold text-slate-900 text-sm">{item.productName}</td>
                                      <td className="px-4 py-3 text-center font-medium text-slate-700">{qty}</td>
                                      <td className="px-4 py-3 text-right font-medium text-slate-700">{formatCurrency(displayRate)}</td>
                                      <td className="px-4 py-3 text-right font-medium text-slate-700">{discPct ? `${discPct}%` : '—'}</td>
                                      <td className="px-4 py-3 text-right font-medium text-emerald-600">{discPct ? formatCurrency(rowDiscount) : '—'}</td>
                                      {isTaxCustomer && (
                                        <td className="px-4 py-3 text-center font-bold text-[10px] text-slate-500">{item.taxCode || '—'}</td>
                                      )}
                                      <td className="px-4 py-3 text-right font-bold text-slate-900">{formatCurrency(rowGross)}</td>
                                    </tr>
                                  );
                                });

                                const netAmount = totalGross - totalDiscount;
                                const finalAmount = isTaxCustomer ? netAmount + totalTax : netAmount;

                                return (
                                  <>
                                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-5">
                                      <table className="w-full text-sm">
                                        <thead>
                                          <tr className="bg-slate-50 border-b border-slate-200">
                                            <th className="px-4 py-2.5 text-center text-[10px] font-bold text-slate-500 uppercase tracking-widest">No</th>
                                            <th className="px-4 py-2.5 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Item Code</th>
                                            <th className="px-4 py-2.5 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Description</th>
                                            <th className="px-4 py-2.5 text-center text-[10px] font-bold text-slate-500 uppercase tracking-widest">Qty</th>
                                            <th className="px-4 py-2.5 text-right text-[10px] font-bold text-slate-500 uppercase tracking-widest">Rate</th>
                                            <th className="px-4 py-2.5 text-right text-[10px] font-bold text-slate-500 uppercase tracking-widest">Disc %</th>
                                            <th className="px-4 py-2.5 text-right text-[10px] font-bold text-slate-500 uppercase tracking-widest">Disc Amt</th>
                                            {isTaxCustomer && (
                                              <th className="px-4 py-2.5 text-center text-[10px] font-bold text-slate-500 uppercase tracking-widest">Tax Code</th>
                                            )}
                                            <th className="px-4 py-2.5 text-right text-[10px] font-bold text-slate-500 uppercase tracking-widest">Gross Amount</th>
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

            {data && data.totalPages > 1 && (
              <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{data.totalCount} Orders • Page {data.page} of {data.totalPages}</span>
                <div className="flex gap-2">
                  <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="px-4 py-2 bg-white rounded-lg border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition shadow-sm">Prev</button>
                  <button onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))} disabled={page >= data.totalPages} className="px-4 py-2 bg-white rounded-lg border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition shadow-sm">Next</button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <MobileTileList
            data={filteredOrders}
            keyField="id"
            isLoading={isLoading}
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
            onTileClick={handleRowClick}
            emptyState={<EmptyState icon={ClipboardList} title="No orders found" description="Try adjusting your filters" />}
            renderTile={(order) => (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 relative overflow-hidden">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex flex-col gap-1">
                    <span className="text-base font-bold text-slate-900">{order.orderNumber}</span>
                    {order.isFromApprovedQuotation && (
                      <span className="inline-flex w-fit px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-100">
                        Quotation
                      </span>
                    )}
                  </div>
                  <StatusBadge status={order.status} />
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                    {formatDateTime(order.orderDate)} • {order.items?.length || 0} items
                  </span>
                  <span className="text-sm font-bold text-slate-900">{formatCurrency(order.totalAmount)}</span>
                </div>
                
                <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-2">
                  {order.status === 'Pending' && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleCancelOrder(order); }}
                      className="flex-1 py-2.5 bg-white border border-slate-200 text-red-600 rounded-xl text-xs font-bold hover:bg-red-50 transition shadow-sm"
                    >
                      Cancel Order
                    </button>
                  )}
                  {order.status === 'Delivered' && (
                    <button
                      onClick={(e) => { e.stopPropagation(); reorderMut.mutate(order.id); }}
                      className="flex-1 py-2.5 bg-orange-50 border border-orange-100 text-orange-700 rounded-xl text-xs font-bold hover:bg-orange-100 transition shadow-sm flex items-center justify-center gap-1.5"
                    >
                      <RefreshCcw className="w-3.5 h-3.5" /> Reorder
                    </button>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); downloadPurchaseOrderPdf({ ...order, isTaxCustomer }); }}
                    className="flex-1 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-50 transition shadow-sm flex items-center justify-center gap-1.5"
                  >
                    <FileText className="w-3.5 h-3.5" /> PDF
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteMut.mutate(order.id); }}
                    className="py-2.5 px-3 bg-white border border-slate-200 text-slate-400 rounded-xl hover:text-red-500 hover:border-red-200 hover:bg-red-50 transition shadow-sm flex items-center justify-center"
                    title="Move to trash"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          />
        )}
      </div>

      <BottomSheet open={!!selectedOrder && !desktop} onClose={() => setSelectedOrder(null)} title={selectedOrder?.orderNumber || 'Order Detail'}>
        {selectedOrder && (() => {
          // Mobile View එකටත් PDF එකේ ගණනය කිරීම්ම එකතු කිරීම
          let totalGross = 0;
          let totalDiscount = 0;
          let totalTax = 0;
          const taxCodes = new Set<string>();

          selectedOrder.items?.forEach(item => {
            const rate = item.unitPrice || 0;
            const qty = item.quantity || 0;
            const discPct = item.discountPercent || 0;
            const rowTaxRate = taxCodeToRate(item.taxCode);
            const allIncRate = Math.round(rate * (1 + rowTaxRate) * 100) / 100;
            const rowGrossBase = rate * qty;
            const rowDiscount = isTaxCustomer ? (rowGrossBase * discPct) / 100 : (allIncRate * qty * discPct) / 100;
            const rowNet = rowGrossBase - (rowGrossBase * discPct) / 100;
            const rowTax = isTaxCustomer ? rowNet * rowTaxRate : 0;
            const rowGross = isTaxCustomer ? rowGrossBase : allIncRate * qty;

            totalGross += rowGross;
            totalDiscount += rowDiscount;
            totalTax += rowTax;
            if (isTaxCustomer && item.taxCode) taxCodes.add(item.taxCode);
          });

          const netAmount = totalGross - totalDiscount;
          const finalAmount = isTaxCustomer ? netAmount + totalTax : netAmount;

          return (
            <div className="space-y-5 pb-6">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Date</p>
                  <p className="text-sm font-bold text-slate-900 mt-1">{formatDateTime(selectedOrder.orderDate)}</p>
                </div>
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">Status</p>
                  <StatusBadge status={selectedOrder.status} />
                </div>
              </div>

              <div>
                <h3 className="font-bold text-slate-900 text-sm mb-3 px-1">Order Items</h3>
                <div className="bg-white border border-slate-200 shadow-sm rounded-xl divide-y divide-slate-100">
                  {selectedOrder.items?.map((item) => {
                    const rate = item.unitPrice || 0;
                    const qty = item.quantity || 0;
                    const rowTaxRate = taxCodeToRate(item.taxCode);
                    const allIncRate = Math.round(rate * (1 + rowTaxRate) * 100) / 100;
                    const displayRate = isTaxCustomer ? rate : allIncRate;
                    const rowGrossBase = rate * qty;
                    const rowGross = isTaxCustomer ? rowGrossBase : allIncRate * qty;

                    return (
                      <div key={item.id} className="p-4">
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="font-bold text-slate-900 text-sm leading-tight">{item.productName}</div>
                          <span className="text-sm font-bold text-slate-900 whitespace-nowrap">{formatCurrency(rowGross)}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                          <span className="bg-slate-100 px-2 py-0.5 rounded-md">Qty: {item.quantity}</span>
                          <span>Rate: {formatCurrency(displayRate)}</span>
                        </div>
                      </div>
                    )
                  })}
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

              {selectedOrder.status === 'Pending' && (
                <button
                  onClick={() => handleCancelOrder(selectedOrder)}
                  className="w-full py-3.5 bg-white border border-slate-200 text-red-600 rounded-xl text-sm font-bold hover:bg-slate-50 active:scale-[0.98] transition-all shadow-sm"
                >
                  Cancel Order
                </button>
              )}

              {selectedOrder.status === 'Delivered' && !selectedOrder.rating && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4">
                  <h3 className="font-bold text-slate-900 text-sm text-center">How was your experience?</h3>
                  <div className="flex items-center justify-center gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button key={star} onClick={() => setRatingVal(star)} className="p-1 transition-transform active:scale-75">
                        <Star className={`w-8 h-8 ${star <= ratingVal ? 'fill-orange-400 text-orange-400' : 'text-slate-300'}`} />
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={ratingComment}
                    onChange={(e) => setRatingComment(e.target.value)}
                    placeholder="Leave a comment (optional)"
                    rows={2}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-1 focus:ring-orange-500 focus:border-orange-500 outline-none resize-none transition-all"
                  />
                  <button
                    onClick={() => rateMut.mutate({ id: selectedOrder.id, rating: ratingVal, comment: ratingComment || undefined })}
                    disabled={ratingVal === 0 || rateMut.isPending}
                    className="w-full py-3 bg-orange-600 text-white rounded-xl text-sm font-bold disabled:opacity-50 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-sm"
                  >
                    {rateMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Submit Rating'}
                  </button>
                </div>
              )}
            </div>
          );
        })()}
      </BottomSheet>
    </div>
  );
}
