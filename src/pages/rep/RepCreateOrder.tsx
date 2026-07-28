import { useState, useEffect } from 'react';
import type { Order } from '../../types/order.types';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customersApi } from '../../services/api/customersApi';
import { ordersApi } from '../../services/api/ordersApi';
import { productsApi } from '../../services/api/productsApi';
import { formatCurrency } from '../../utils/formatters';
import { taxCodeToRate } from '../../utils/calculations';
import { orderDraftUtils } from '../../utils/orderDraft';
import { ArrowLeft, User, Package, ShoppingCart, Trash2, CheckCircle, ChevronRight, Download, Eye, Plus } from 'lucide-react';
import { downloadPurchaseOrderPdf } from '../../utils/purchaseOrderPdf';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useIsDesktop } from '../../hooks/useMediaQuery';
import type { Product } from '../../types/product.types';
import ProductDropdown from '../../components/common/ProductDropdown';

type DesktopOrderRow = {
  id: string;
  product?: Product;
  qty: number;
};

function createClientRowId() {
  const cryptoApi = globalThis.crypto;

  if (cryptoApi && typeof cryptoApi.randomUUID === 'function') {
    return cryptoApi.randomUUID();
  }

  return `row-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function formatTableAmount(value: number) {
  const numericValue = Number(value || 0);

  return numericValue.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function RepCreateOrder() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isDesktop = useIsDesktop();

  const [draft, setDraft] = useState(orderDraftUtils.get());
  const [createdOrder, setCreatedOrder] = useState<Order | null>(null);
  const [desktopCustomerId, setDesktopCustomerId] = useState(draft.customerId || '');
  const [rowSearches, setRowSearches] = useState<Record<string, string>>({});
  const [desktopRows, setDesktopRows] = useState<DesktopOrderRow[]>(() => {
    if (!draft.items.length) return [{ id: createClientRowId(), qty: 1 }];
    return draft.items.map(item => ({
      id: createClientRowId(),
      qty: item.quantity,
      product: {
        id: item.productId,
        name: item.name,
        sku: item.sku,
        sellingPrice: item.price,
        quantity: 0,
        createdAt: '',
        mrp: item.mrp,
        discountPercent: item.discountPercent,
        taxAmount: item.taxAmount,
        taxCode: item.taxCode,
      },
    }));
  });

  /* ── PDF Receipt ── */
  const downloadReceipt = () => {
    if (!createdOrder) return;
    downloadPurchaseOrderPdf({ ...createdOrder, isTaxCustomer: !isNonTaxCustomer });
  };

  /* ── Effects ── */
  useEffect(() => {
    const refreshDraft = () => setDraft(orderDraftUtils.get());
    window.addEventListener('focus', refreshDraft);
    refreshDraft();
    return () => window.removeEventListener('focus', refreshDraft);
  }, []);

  useEffect(() => {
    if (draft.customerId || draft.items.length === 0) return;

    draft.items.forEach((item) => {
      orderDraftUtils.removeItem(item.productId);
    });

    setDraft(orderDraftUtils.get());
  }, [draft.customerId]);

  useEffect(() => {
    if (!isDesktop || desktopCustomerId) return;

    setDesktopRows([
      {
        id: createClientRowId(),
        qty: 1,
      },
    ]);
    setRowSearches({});
  }, [desktopCustomerId, isDesktop]);

  /* ── Queries ── */
  const { data: selectedCustomer } = useQuery({
    queryKey: ['rep-customer', draft.customerId],
    queryFn: () => customersApi.repGetById(draft.customerId!).then(r => r.data.data),
    enabled: !!draft.customerId,
  });

  const { data: selectedDesktopCustomerDetail } = useQuery({
    queryKey: ['rep-customer', desktopCustomerId],
    queryFn: () => customersApi.repGetById(desktopCustomerId!).then(r => r.data.data),
    enabled: isDesktop && !!desktopCustomerId,
  });

  const { data: customerList } = useQuery({
    queryKey: ['rep-customers'],
    queryFn: () => customersApi.repGetCustomers({ page: 1, pageSize: 2000 }).then(r => r.data.data),
  });

  const { data: productCatalog } = useQuery({
    queryKey: ['rep-products-for-order-create'],
    queryFn: () => productsApi.getAllForSelection(),
    enabled: isDesktop && !!desktopCustomerId,
  });

  /* ── Mutations ── */
  const createMut = useMutation({
    mutationFn: (d: { customerId: string; deliveryAddress?: string; deliveryNotes?: string; items: { productId: string; quantity: number }[] }) => ordersApi.repCreate(d),
    onSuccess: (res) => {
      const order = res.data.data;
      queryClient.invalidateQueries({ queryKey: ['rep-orders'] });
      orderDraftUtils.clear();
      toast.success('Order created successfully!');
      setCreatedOrder(order);
    },
    onError: () => toast.error('Failed to create order'),
  });

  const handleSubmit = () => {
    if (!draft.customerId) return toast.error('Please select a customer');
    if (draft.items.length === 0) return toast.error('Add at least one product');
    createMut.mutate({
      customerId: draft.customerId,
      items: draft.items.map(({ productId, quantity }) => ({
        productId,
        quantity,
      })),
    });
  };

  /* ── Computed ── */
  const itemCount = draft.items.length;
  const desktopProducts: Product[] = productCatalog || [];
  const isNonTaxCustomer = isDesktop
    ? ((selectedDesktopCustomerDetail?.customerType || '').toLowerCase().replace(/[-\s]/g, '') === 'nontax')
    : ((selectedCustomer?.customerType || '').toLowerCase().replace(/[-\s]/g, '') === 'nontax');

  const mobileTotalGross = draft.items.reduce((s, i) => {
    const rate = i.price || 0, qty = i.quantity || 0;
    const rowTaxRate = taxCodeToRate(i.taxCode);
    const nonTaxGross = i.allIncPrice ? i.allIncPrice * qty : rate * qty * (1 + rowTaxRate);
    return s + (isNonTaxCustomer ? nonTaxGross : rate * qty);
  }, 0);
  const mobileTotalTax = draft.items.reduce((s, i) => {
    if (isNonTaxCustomer) return s;
    const rate = i.price || 0, qty = i.quantity || 0;
    const rowGross = rate * qty;
    const rowDiscount = rowGross * ((i.discountPercent || 0) / 100);
    return s + (rowGross - rowDiscount) * taxCodeToRate(i.taxCode);
  }, 0);
  const mobileTotalDiscount = draft.items.reduce((s, i) => {
    const r = i.price || 0, qty = i.quantity || 0, dp = i.discountPercent || 0;
    const rowTaxRate = taxCodeToRate(i.taxCode);
    const allIncR = i.allIncPrice || Math.round(r * (1 + rowTaxRate) * 100) / 100;
    return s + (isNonTaxCustomer ? allIncR * qty * dp / 100 : r * qty * dp / 100);
  }, 0);
  const total = isNonTaxCustomer
    ? mobileTotalGross - mobileTotalDiscount
    : mobileTotalGross + mobileTotalTax - mobileTotalDiscount;

  const getBaseRate = (p: Product) => (p.sellingPrice || 0) + (p.discountAmount || 0);
  const getCalcInput = (p: Product) => {
    const isSpecialPrice = p.discountPercent == null && (p.discountAmount || 0) > 0;
    const rate = isSpecialPrice ? (p.sellingPrice || 0) : getBaseRate(p);
    const discountPercent = isSpecialPrice ? 0 : (p.discountPercent ?? 0);
    const taxAmount = p.taxAmount ?? 0;
    return { rate, discountPercent, taxAmount, isSpecialPrice };
  };

  const desktopRowsWithProduct = desktopRows.filter(r => !!r.product);

  const desktopTotalGross = desktopRowsWithProduct.reduce((sum, row) => {
    const p = row.product as Product;
    const pricing = getCalcInput(p);
    const rowBase = pricing.rate * row.qty;
    const rowTaxRate = taxCodeToRate(p.taxCode);
    const nonTaxGross = p.totalAmount ? p.totalAmount * row.qty : rowBase * (1 + rowTaxRate);
    return sum + (isNonTaxCustomer ? nonTaxGross : rowBase);
  }, 0);
  const desktopTotalTax = desktopRowsWithProduct.reduce((sum, row) => {
    if (isNonTaxCustomer) return sum;
    const p = row.product as Product;
    const pricing = getCalcInput(p);
    const rowGross = pricing.rate * row.qty;
    const rowDiscount = rowGross * (pricing.discountPercent / 100);
    return sum + (rowGross - rowDiscount) * taxCodeToRate(p.taxCode);
  }, 0);
  const desktopTotalDiscount = desktopRowsWithProduct.reduce((sum, row) => {
    const p = row.product as Product;
    const pricing = getCalcInput(p);
    if (pricing.isSpecialPrice) return sum;
    const rowTaxRate = taxCodeToRate(p.taxCode);
    const allIncRate = p.totalAmount || Math.round(pricing.rate * (1 + rowTaxRate) * 100) / 100;
    return sum + (isNonTaxCustomer ? allIncRate * row.qty * pricing.discountPercent / 100 : (p.discountAmount || 0) * row.qty);
  }, 0);
  const desktopTotal = isNonTaxCustomer
    ? desktopTotalGross - desktopTotalDiscount
    : desktopTotalGross + desktopTotalTax - desktopTotalDiscount;

  const upsertDesktopRow = (rowId: string, updates: Partial<DesktopOrderRow>) => {
    setDesktopRows(prev => {
      const next = prev.map(row => (row.id === rowId ? { ...row, ...updates } : row));
      if (next[next.length - 1]?.id === rowId && updates.product) {
        next.push({ id: createClientRowId(), qty: 1 });
      }
      return next;
    });
  };
  const removeDesktopRow = (rowId: string) => {
    setDesktopRows(prev => {
      const filtered = prev.filter(row => row.id !== rowId);
      return filtered.length ? filtered : [{ id: createClientRowId(), qty: 1 }];
    });
  };

  const handleDesktopSubmit = () => {
    if (!desktopCustomerId) return toast.error('Please select a customer');
    if (!desktopRowsWithProduct.length) return toast.error('Add at least one product');
    createMut.mutate({
      customerId: desktopCustomerId,
      items: desktopRowsWithProduct.map((row) => ({
        productId: (row.product as Product).id,
        quantity: row.qty,
      })),
    });
  };

  /* ═══════ SUCCESS SCREEN ═══════ */
  if (createdOrder) {
    const startAnotherOrder = () => {
      orderDraftUtils.clear();
      setDraft(orderDraftUtils.get());
      setDesktopCustomerId('');
      setDesktopRows([
        {
          id: createClientRowId(),
          qty: 1,
        },
      ]);
      setRowSearches({});
      setCreatedOrder(null);
    };

    return (
      <div className="mx-auto flex min-h-[calc(100dvh-96px)] w-full max-w-6xl items-center px-3 py-6 sm:px-5 sm:py-8 lg:px-0">
        <section className="w-full overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-900/5">
          <div className="grid lg:grid-cols-[1.05fr_0.95fr]">
            {/* Confirmation */}
            <div className="relative overflow-hidden bg-emerald-700 px-5 py-8 text-white sm:px-8 sm:py-10 lg:px-10 lg:py-12">
              <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-28 -left-20 h-64 w-64 rounded-full bg-emerald-300/10 blur-3xl" />

              <div className="relative">
                <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-emerald-700 shadow-lg shadow-emerald-950/10 sm:h-20 sm:w-20">
                  <CheckCircle className="h-9 w-9 sm:h-11 sm:w-11" />
                </div>

                <p className="mt-6 text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-100">
                  Order Created
                </p>

                <h1 className="mt-2 max-w-xl text-3xl font-black leading-tight tracking-tight sm:text-4xl">
                  Order placed successfully
                </h1>

                <p className="mt-3 max-w-lg text-sm leading-6 text-emerald-50 sm:text-base">
                  The order has been submitted and is ready for processing.
                </p>

                <div className="mt-7 inline-flex max-w-full items-center gap-3 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-sm">
                  <div className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-white/15">
                    <ShoppingCart className="h-4 w-4" />
                  </div>

                  <div className="min-w-0">
                    <p className="text-[9px] font-bold uppercase tracking-wide text-emerald-100">
                      Order Number
                    </p>
                    <p className="mt-0.5 break-all text-sm font-black text-white sm:text-base">
                      {createdOrder.orderNumber}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col justify-center px-5 py-7 sm:px-8 sm:py-9 lg:px-10 lg:py-12">
              <div className="mx-auto w-full max-w-md">
                <div className="flex items-center gap-3">
                  <div className="inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                    <CheckCircle className="h-5 w-5" />
                  </div>

                  <div className="min-w-0">
                    <h2 className="text-lg font-black text-slate-900 sm:text-xl">
                      Your order is ready
                    </h2>
                    <p className="mt-0.5 text-xs leading-5 text-slate-500 sm:text-sm">
                      Choose what you would like to do next.
                    </p>
                  </div>
                </div>

                <div className="mt-6 space-y-3">
                  <button
                    type="button"
                    onClick={() =>
                      navigate(`/rep/orders/${createdOrder.id}`)
                    }
                    className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 text-sm font-bold text-white shadow-lg shadow-emerald-700/15 transition hover:bg-emerald-800 active:scale-[0.99]"
                  >
                    <Eye className="h-4 w-4" />
                    View Order
                  </button>

                  <button
                    type="button"
                    onClick={downloadReceipt}
                    className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 text-sm font-bold text-slate-800 transition hover:bg-slate-50 active:scale-[0.99]"
                  >
                    <Download className="h-4 w-4" />
                    Download Receipt
                  </button>

                  <div className="grid grid-cols-1 gap-3 pt-1 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => navigate('/rep/orders')}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-slate-100 px-4 text-xs font-bold text-slate-700 transition hover:bg-slate-200"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Back to Orders
                    </button>

                    <button
                      type="button"
                      onClick={startAnotherOrder}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-50 px-4 text-xs font-bold text-emerald-700 transition hover:bg-emerald-100"
                    >
                      <Plus className="h-4 w-4" />
                      Create Another
                    </button>
                  </div>
                </div>

                <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-semibold text-slate-500">
                      Status
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-bold text-emerald-700">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                      Submitted
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    );
  }

  /* ═══════ DESKTOP LAYOUT ═══════ */
  if (isDesktop) {
    const desktopCustomer = (customerList?.items || []).find(
      (customer: any) => customer.id === desktopCustomerId,
    );

    const customerName =
      desktopCustomer?.shopName ||
      selectedDesktopCustomerDetail?.shopName ||
      '';

    const customerReady = Boolean(desktopCustomerId);
    const productsReady = desktopRowsWithProduct.length > 0;
    const orderReady = customerReady && productsReady;

    const totalQuantity = desktopRowsWithProduct.reduce(
      (sum, row) => sum + Number(row.qty || 0),
      0,
    );

    /*
     * Laptop-friendly Excel allocation:
     * - Product Name receives most of the available width.
     * - Rate, MRP, Discount and Amount remain compact.
     * - Non-Tax customers have no Tax column.
     */
    const desktopSheetColumns = isNonTaxCustomer
      ? '32px minmax(390px, 2fr) 70px 66px minmax(86px, 0.68fr) minmax(82px, 0.62fr) minmax(84px, 0.64fr) minmax(104px, 0.82fr) 28px'
      : '32px minmax(370px, 1.9fr) 70px 66px minmax(84px, 0.66fr) minmax(80px, 0.60fr) minmax(82px, 0.62fr) 50px minmax(102px, 0.80fr) 28px';

    const desktopSheetMinWidth = isNonTaxCustomer ? 960 : 1010;

    return (
      <div className="mx-auto w-full max-w-[1700px] animate-fade-in space-y-4 pb-12">
        {/* Desktop header */}
        <section className="relative overflow-hidden rounded-2xl bg-emerald-700 px-5 py-4 text-white shadow-sm">
          <div className="relative flex items-center">
            <div className="min-w-0">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.17em] text-emerald-100">
                  Sales Order Sheet
                </p>
                <h1 className="mt-0.5 text-xl font-black tracking-tight">
                  Create New Order
                </h1>
                <p className="mt-1 text-xs text-emerald-100">
                  Type a product name in the sheet and select from suggestions
                </p>
              </div>
            </div>

          </div>
        </section>

        <div className="grid grid-cols-[minmax(0,1fr)_270px] items-start gap-3 2xl:grid-cols-[minmax(0,1fr)_300px]">
          <main className="min-w-0 space-y-4">
            {/* Customer strip */}
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="grid grid-cols-[150px_minmax(250px,1fr)_minmax(210px,0.7fr)_125px] 2xl:grid-cols-[170px_minmax(300px,1fr)_minmax(250px,0.8fr)_145px] items-stretch">
                <div className="flex items-center gap-2.5 border-r border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-slate-200 text-slate-950">
                    <User className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">
                      Step 1
                    </p>
                    <p className="text-sm font-black text-slate-800">
                      Customer
                    </p>
                  </div>
                </div>

                <div className="border-r border-slate-200 p-3">
                  <select
                    value={desktopCustomerId}
                    onChange={(event) => {
                      const nextCustomerId = event.target.value;
                      setDesktopCustomerId(nextCustomerId);

                      if (!nextCustomerId) {
                        setDesktopRows([
                          {
                            id: createClientRowId(),
                            qty: 1,
                          },
                        ]);
                        setRowSearches({});
                      }
                    }}
                    className="min-h-11 w-full border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-slate-950 focus:ring-1 focus:ring-slate-950/10"
                  >
                    <option value="">Select a customer...</option>
                    {(customerList?.items || []).map((customer: any) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.shopName}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="min-w-0 border-r border-slate-200 px-4 py-3">
                  {customerReady ? (
                    <>
                      <p className="truncate text-sm font-black text-slate-900">
                        {customerName}
                      </p>
                      <p className="mt-1 truncate text-[11px] text-slate-500">
                        {selectedDesktopCustomerDetail?.city ||
                          desktopCustomer?.city ||
                          'No location'}
                        {(selectedDesktopCustomerDetail?.phoneNumber ||
                          desktopCustomer?.phoneNumber)
                          ? ` · ${
                              selectedDesktopCustomerDetail?.phoneNumber ||
                              desktopCustomer?.phoneNumber
                            }`
                          : ''}
                      </p>
                    </>
                  ) : (
                    <p className="pt-2 text-xs font-semibold text-slate-400">
                      Customer details appear here
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-center px-3 py-3">
                  <span
                    className={`inline-flex rounded-full px-3 py-1.5 text-[10px] font-bold ${
                      customerReady
                        ? 'bg-slate-200 text-slate-800'
                        : 'bg-slate-100 text-slate-400'
                    }`}
                  >
                    {!customerReady
                      ? 'No customer'
                      : isNonTaxCustomer
                        ? 'Non-Tax'
                        : 'Tax Customer'}
                  </span>
                </div>
              </div>
            </section>

            {/* Excel-like product sheet */}
            <section className="overflow-hidden border border-slate-300 bg-white shadow-sm">
              <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-4 py-2.5">
                <div className="flex items-center gap-3">
                  <div className="inline-flex h-8 w-8 items-center justify-center bg-slate-200 text-slate-800">
                    <Package className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <h2 className="text-[15px] font-black text-slate-900">
                      Product Entry Sheet
                    </h2>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {customerReady
                        ? 'Start typing inside the Product Name column'
                        : 'Select a customer before adding products'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={!customerReady}
                  onClick={() => {
                    if (!customerReady) return;

                    setDesktopRows((current) => [
                      ...current,
                      {
                        id: createClientRowId(),
                        qty: 1,
                      },
                    ]);
                  }}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-[11px] font-bold text-slate-800 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                >
                  <Plus className="h-4 w-4" />
                  Add Row
                </button>
              </div>

              <div className="w-full overflow-x-auto overscroll-x-contain">
                <div className="w-full" style={{ minWidth: desktopSheetMinWidth }}>
                {/* Sheet headings */}
                <div className="grid border-b border-emerald-200 bg-emerald-50 text-[11px] font-bold uppercase tracking-wide text-emerald-950" style={{ gridTemplateColumns: desktopSheetColumns }}>
                  <div className="border-r border-emerald-200 px-2 py-2 text-center">
                    #
                  </div>
                  <div className="border-r border-emerald-200 px-2.5 py-2">
                    Product Name
                  </div>
                  <div className="border-r border-emerald-200 px-1 py-2 text-center">
                    SKU
                  </div>
                  <div className="border-r border-emerald-200 px-2 py-2 text-center">
                    Qty
                  </div>
                  <div className="border-r border-emerald-200 px-2.5 py-2 text-right">
                    Rate
                  </div>
                  <div className="border-r border-emerald-200 px-2.5 py-2 text-right">
                    MRP
                  </div>
                  <div className="border-r border-emerald-200 px-2.5 py-2 text-right">
                    Discount
                  </div>
                  {!isNonTaxCustomer && (
                    <div className="border-r border-emerald-200 px-1 py-2 text-center">
                      Tax
                    </div>
                  )}
                  <div className="border-r border-emerald-200 px-2.5 py-2 text-right">
                    Amount
                  </div>
                  <div />
                </div>

                <div className="relative overflow-visible">
                  {desktopRows.map((row, rowIndex) => {
                    const product = row.product;

                    const selectedIds = new Set(
                      desktopRows
                        .filter(
                          (existingRow) =>
                            existingRow.id !== row.id &&
                            existingRow.product,
                        )
                        .map(
                          (existingRow) =>
                            (existingRow.product as Product).id,
                        ),
                    );

                    let rate = 0;
                    let discountPercent = 0;
                    let discountAmount = 0;
                    let taxAmount = 0;
                    let lineTotal = 0;
                    let allInclusiveRate = 0;

                    if (product) {
                      const pricing = getCalcInput(product);
                      rate = pricing.rate;
                      discountPercent = pricing.discountPercent;

                      const lineTaxRate = taxCodeToRate(product.taxCode);

                      allInclusiveRate =
                        product.totalAmount ||
                        Math.round(
                          rate * (1 + lineTaxRate) * 100,
                        ) / 100;

                      const lineGross = isNonTaxCustomer
                        ? allInclusiveRate * row.qty
                        : rate * row.qty;

                      discountAmount = pricing.isSpecialPrice
                        ? 0
                        : isNonTaxCustomer
                          ? (lineGross * discountPercent) / 100
                          : (product.discountAmount || 0) * row.qty;

                      taxAmount = isNonTaxCustomer
                        ? 0
                        : (lineGross - discountAmount) * lineTaxRate;

                      lineTotal =
                        lineGross - discountAmount + taxAmount;
                    }

                    return (
                      <div
                        key={row.id}
                        className={`relative grid border-b border-slate-300 text-[13px] ${
                          rowIndex % 2 === 0
                            ? 'bg-white'
                            : 'bg-slate-50/60'
                        }`}
                        style={{ gridTemplateColumns: desktopSheetColumns }}
                      >
                        <div className="flex min-h-[42px] items-center justify-center border-r border-slate-300 bg-slate-100 font-bold text-slate-500">
                          {rowIndex + 1}
                        </div>

                        <div className="relative z-10 min-w-0 overflow-visible border-r border-slate-300 px-1.5 py-1 focus-within:z-50">
                          {customerReady ? (
                            <ProductDropdown
                              rowId={row.id}
                              value={
                                rowSearches[row.id] !== undefined
                                  ? rowSearches[row.id]
                                  : product?.name || ''
                              }
                              products={desktopProducts}
                              selectedProductIds={selectedIds}
                              currentProductId={product?.id}
                              onChange={(value) => {
                                setRowSearches((current) => ({
                                  ...current,
                                  [row.id]: value,
                                }));

                                if (!value.trim()) {
                                  upsertDesktopRow(row.id, {
                                    product: undefined,
                                  });
                                }
                              }}
                              onSelect={(selectedProduct) => {
                                upsertDesktopRow(row.id, {
                                  product: selectedProduct,
                                });

                                setRowSearches((current) => ({
                                  ...current,
                                  [row.id]: selectedProduct.name,
                                }));
                              }}
                            />
                          ) : (
                            <div className="flex h-8 items-center px-2 text-[11px] font-medium text-slate-400">
                              Select customer first
                            </div>
                          )}

                        </div>

                        <div className="flex min-w-0 items-center justify-center border-r border-slate-300 px-1 text-center font-mono text-[12px] font-semibold text-slate-700">
                          <span className="truncate">
                            {product?.sku || ''}
                          </span>
                        </div>

                        <div className="flex items-center justify-center border-r border-slate-300 p-1">
                          <input
                            type="number"
                            min="1"
                            inputMode="numeric"
                            value={row.qty === 0 ? '' : row.qty}
                            disabled={!customerReady || !product}
                            onChange={(event) => {
                              const rawValue = event.target.value;

                              upsertDesktopRow(row.id, {
                                qty:
                                  rawValue === ''
                                    ? 0
                                    : Math.max(
                                        0,
                                        Number(rawValue) || 0,
                                      ),
                              });
                            }}
                            onBlur={() => {
                              if (!row.qty || row.qty < 1) {
                                upsertDesktopRow(row.id, {
                                  qty: 1,
                                });
                              }
                            }}
                            className="h-8 w-full appearance-none bg-transparent px-1 text-center text-[13px] font-bold text-slate-900 outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none focus:bg-slate-100 disabled:text-slate-300"
                            style={{ MozAppearance: 'textfield' }}
                          />
                        </div>

                        <ExcelMoneyCell
                          value={
                            product
                              ? formatTableAmount(
                                  isNonTaxCustomer
                                    ? allInclusiveRate
                                    : rate,
                                )
                              : ''
                          }
                        />

                        <ExcelMoneyCell
                          value={
                            product?.mrp != null
                              ? formatTableAmount(product.mrp)
                              : ''
                          }
                          muted
                        />

                        <ExcelMoneyCell
                          value={
                            product && discountAmount > 0
                              ? `-${formatTableAmount(discountAmount)}`
                              : ''
                          }
                        />

                        {!isNonTaxCustomer && (
                          <div className="flex min-w-0 items-center justify-center border-r border-slate-300 px-0.5 text-center text-[11px] font-bold text-slate-700">
                            {product?.taxCode || ''}
                          </div>
                        )}

                        <ExcelMoneyCell
                          value={
                            product
                              ? formatTableAmount(lineTotal)
                              : ''
                          }
                          strong
                        />

                        <div className="flex items-center justify-center">
                          <button
                            type="button"
                            disabled={!customerReady || !product}
                            onClick={() => removeDesktopRow(row.id)}
                            className="inline-flex h-6 w-6 items-center justify-center text-slate-300 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30"
                            aria-label="Remove row"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Spreadsheet totals */}
                <div className="grid border-t border-emerald-300 bg-emerald-50 text-[12px] font-bold text-emerald-950" style={{ gridTemplateColumns: desktopSheetColumns }}>
                  <div className="border-r border-emerald-200 px-2 py-2.5 text-center">
                    Σ
                  </div>
                  <div className="border-r border-emerald-200 px-2.5 py-2.5 text-right">
                    ORDER TOTALS
                  </div>
                  <div className="border-r border-emerald-200 px-2.5 py-2.5 text-center text-emerald-800">
                    {desktopRowsWithProduct.length} rows
                  </div>
                  <div className="border-r border-emerald-200 px-2 py-2.5 text-center">
                    {totalQuantity}
                  </div>
                  <div className="min-w-0 whitespace-nowrap border-r border-emerald-200 px-1.5 py-2.5 text-right text-[10px] text-emerald-950">
                    {formatTableAmount(desktopTotalGross)}
                  </div>
                  <div className="border-r border-emerald-200 px-2 py-2.5" />
                  <div className="min-w-0 whitespace-nowrap border-r border-emerald-200 px-1.5 py-2.5 text-right text-[10px] text-emerald-950">
                    -{formatTableAmount(desktopTotalDiscount)}
                  </div>
                  {!isNonTaxCustomer && (
                    <div
                      className="border-r border-emerald-200"
                      aria-label="Tax total shown in Invoice Summary"
                    />
                  )}
                  <div className="min-w-0 whitespace-nowrap border-r border-emerald-200 px-1.5 py-2.5 text-right text-[10px] text-emerald-950">
                    {formatTableAmount(desktopTotal)}
                  </div>
                  <div />
                </div>
                </div>
              </div>

            </section>
          </main>

          {/* Sticky summary */}
          <aside className="min-w-0">
            <section className="sticky top-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg shadow-slate-900/5">
              <div className="bg-emerald-700 px-4 py-3.5 text-white">
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-emerald-100">
                  Invoice Summary
                </p>
                <div className="mt-1 flex items-center justify-between gap-3">
                  <h2 className="text-lg font-black">
                    Review Order
                  </h2>
                  <div
                    className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${
                      orderReady
                        ? 'bg-white text-emerald-700'
                        : 'bg-white/10 text-emerald-100'
                    }`}
                  >
                    <ShoppingCart className="h-4 w-4" />
                  </div>
                </div>
              </div>

              <div className="space-y-4 p-4">
                <div className="space-y-3">
                  <SummaryRow
                    label="Gross Amount"
                    value={formatCurrency(desktopTotalGross)}
                  />
                  <SummaryRow
                    label="Discount"
                    value={`-${formatCurrency(desktopTotalDiscount)}`}
                  />
                  {!isNonTaxCustomer && (
                    <SummaryRow
                      label="Tax"
                      value={`+${formatCurrency(desktopTotalTax)}`}
                    />
                  )}
                </div>

                <div className="border-y border-slate-200 py-4">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                    Total Invoice Value
                  </p>
                  <p className="mt-1 break-words text-2xl font-black leading-tight text-emerald-700">
                    {formatCurrency(desktopTotal)}
                  </p>
                </div>

                <button
                  type="button"
                  disabled={!orderReady || createMut.isPending}
                  onClick={handleDesktopSubmit}
                  className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 text-sm font-bold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-35"
                >
                  <ShoppingCart className="h-4 w-4" />
                  {createMut.isPending
                    ? 'Placing Order...'
                    : 'Place Order'}
                </button>
              </div>
            </section>
          </aside>
        </div>
      </div>
    );
  }

  /* ═══════ MOBILE / TABLET LAYOUT ═══════ */
  const mobileCustomerReady = Boolean(draft.customerId);
  const mobileProductsReady = mobileCustomerReady && draft.items.length > 0;
  const mobileOrderReady =
    mobileCustomerReady && mobileProductsReady;

  return (
    <div className="mx-auto w-full max-w-5xl animate-fade-in px-3 pb-16 pt-2 sm:px-5 sm:pt-4 md:pb-12">
      {/* Mobile / tablet header */}
      <section className="relative overflow-hidden rounded-2xl bg-emerald-700 px-4 py-5 text-white shadow-sm sm:px-5 md:px-6 md:py-6">
        <div className="relative flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-100">
                Sales Orders
              </p>
              <h1 className="mt-0.5 text-xl font-bold tracking-tight sm:text-2xl">
                Create Order
              </h1>
              <p className="mt-1 text-xs text-emerald-100">
                Customer, products and review
              </p>
            </div>
          </div>

          <div className="hidden min-w-[150px] rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-right backdrop-blur-sm sm:block">
            <p className="text-[9px] font-semibold uppercase tracking-wide text-emerald-100">
              Current Total
            </p>
            <p className="mt-0.5 break-words text-sm font-bold text-white">
              {formatCurrency(total)}
            </p>
          </div>
        </div>

        <div className="relative mt-5 grid grid-cols-3 gap-2">
          <OrderProgressStep
            number={1}
            label="Customer"
            complete={mobileCustomerReady}
            active={!mobileCustomerReady}
          />
          <OrderProgressStep
            number={2}
            label="Products"
            complete={mobileProductsReady}
            active={mobileCustomerReady && !mobileProductsReady}
          />
          <OrderProgressStep
            number={3}
            label="Review"
            complete={mobileOrderReady}
            active={mobileOrderReady}
          />
        </div>
      </section>

      <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_310px] md:items-start">
        <main className="min-w-0 space-y-4">
          {/* Customer */}
          <ResponsiveOrderSection
            icon={User}
            title="Customer"
            completed={mobileCustomerReady}
            actionLabel={mobileCustomerReady ? 'Change' : undefined}
            onAction={() => navigate('/rep/orders/new/customers')}
          >
            {!mobileCustomerReady ? (
              <button
                type="button"
                onClick={() => navigate('/rep/orders/new/customers')}
                className="group flex min-h-24 w-full items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 text-left transition active:border-emerald-300 active:bg-emerald-50"
              >
                <div className="inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                  <User className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-slate-800">
                    Select customer
                  </p>
                  <p className="mt-1 text-[11px] leading-4 text-slate-500">
                    Choose the shop for this order
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 flex-shrink-0 text-slate-300" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => navigate('/rep/orders/new/customers')}
                className="flex min-h-[76px] w-full items-center gap-3 rounded-xl border border-emerald-100 bg-emerald-50/60 p-3 text-left transition active:bg-emerald-50"
              >
                <div className="inline-flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-base font-black text-white">
                  {draft.customerName?.charAt(0)?.toUpperCase() || '?'}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="break-words text-sm font-bold leading-5 text-slate-900">
                    {draft.customerName}
                  </p>

                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-500">
                    <span>{selectedCustomer?.city || 'No location'}</span>
                    {selectedCustomer?.phoneNumber && (
                      <span>{selectedCustomer.phoneNumber}</span>
                    )}
                    {isNonTaxCustomer && (
                      <span className="rounded-full bg-white px-2 py-0.5 font-bold text-amber-700">
                        Non-Tax
                      </span>
                    )}
                  </div>
                </div>

                <ChevronRight className="h-4 w-4 flex-shrink-0 text-emerald-500" />
              </button>
            )}
          </ResponsiveOrderSection>

          {/* Products */}
          <ResponsiveOrderSection
            icon={Package}
            title="Products"
            completed={mobileProductsReady}
            count={draft.items.length}
            actionLabel={
              mobileCustomerReady && mobileProductsReady
                ? 'Edit'
                : undefined
            }
            onAction={
              mobileCustomerReady
                ? () => navigate('/rep/orders/new/products')
                : undefined
            }
          >
            {!mobileCustomerReady ? (
              <div className="flex min-h-24 w-full items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4">
                <div className="inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-slate-200 text-slate-500">
                  <Package className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-slate-600">
                    Select customer first
                  </p>
                  <p className="mt-1 text-[11px] leading-4 text-slate-500">
                    Products can be added after choosing a customer
                  </p>
                </div>
              </div>
            ) : !mobileProductsReady ? (
              <button
                type="button"
                onClick={() => navigate('/rep/orders/new/products')}
                className="flex min-h-24 w-full items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 text-left transition active:border-emerald-300 active:bg-emerald-50"
              >
                <div className="inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                  <Package className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-slate-800">
                    Add products
                  </p>
                  <p className="mt-1 text-[11px] leading-4 text-slate-500">
                    Search products and set quantities
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 flex-shrink-0 text-slate-300" />
              </button>
            ) : (
              <div className="space-y-2">
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                  {draft.items.map((item, index) => {
                    const rate = item.price || 0;
                    const lineTaxRate =
                      taxCodeToRate(item.taxCode);
                    const allInclusiveRate =
                      item.allIncPrice ||
                      Math.round(
                        rate * (1 + lineTaxRate) * 100,
                      ) /
                        100;
                    const displayRate = isNonTaxCustomer
                      ? allInclusiveRate
                      : rate;

                    return (
                      <div
                        key={item.productId}
                        className={`grid min-h-[46px] grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3 py-2 ${
                          index !== draft.items.length - 1
                            ? 'border-b border-slate-100'
                            : ''
                        }`}
                      >
                        <p
                          className="min-w-0 line-clamp-2 break-words text-[12px] font-bold leading-4 text-slate-900 sm:text-[13px]"
                          title={item.name}
                        >
                          {item.name}
                        </p>

                        <p className="min-w-[88px] whitespace-nowrap text-right text-[12px] font-black text-emerald-700 sm:text-[13px]">
                          {formatCurrency(displayRate)}
                        </p>
                      </div>
                    );
                  })}
                </div>


                <button
                  type="button"
                  disabled={!mobileCustomerReady}
                  onClick={() => {
                    if (!mobileCustomerReady) return;
                    navigate('/rep/orders/new/products');
                  }}
                  className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 text-xs font-bold text-emerald-700 transition active:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Plus className="h-4 w-4" />
                  Add More Products
                </button>
              </div>
            )}
          </ResponsiveOrderSection>

          {/* Delivery */}

          {/* Mobile order summary and submit */}
          {mobileProductsReady && (
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm md:hidden">
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3.5">
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-emerald-700">
                    Final Review
                  </p>
                  <h2 className="mt-0.5 text-sm font-black text-slate-900">
                    Order Summary
                  </h2>
                </div>

                <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-bold text-emerald-700">
                  {itemCount} item{itemCount === 1 ? '' : 's'}
                </span>
              </div>

              <div className="p-4">
                <div className="space-y-3">
                  <SummaryRow
                    label="Gross Amount"
                    value={formatCurrency(mobileTotalGross)}
                  />

                  <SummaryRow
                    label="Discount"
                    value={`-${formatCurrency(
                      mobileTotalDiscount,
                    )}`}
                  />

                  {!isNonTaxCustomer && (
                    <SummaryRow
                      label="Tax"
                      value={`+${formatCurrency(
                        mobileTotalTax,
                      )}`}
                    />
                  )}
                </div>

                <div className="mt-4 rounded-xl bg-emerald-50 px-3.5 py-3">
                  <p className="text-[9px] font-bold uppercase tracking-wide text-emerald-700">
                    Total Invoice Value
                  </p>
                  <p className="mt-1 break-words text-2xl font-black leading-tight text-emerald-800">
                    {formatCurrency(total)}
                  </p>
                </div>

                <button
                  type="button"
                  disabled={
                    !mobileOrderReady ||
                    createMut.isPending
                  }
                  onClick={handleSubmit}
                  className="mt-3 inline-flex min-h-13 w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 text-sm font-black text-white shadow-lg shadow-emerald-700/15 transition active:scale-[0.99] active:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ShoppingCart className="h-4.5 w-4.5" />
                  {createMut.isPending
                    ? 'Placing Order...'
                    : 'Place Order'}
                </button>
              </div>
            </section>
          )}

        </main>

        {/* Tablet sticky summary */}
        <aside className="hidden md:block">
          <section className="sticky top-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-4 py-4">
              <h2 className="text-sm font-bold text-slate-900">
                Order Summary
              </h2>
              <p className="mt-0.5 text-[11px] text-slate-500">
                {itemCount} selected item{itemCount === 1 ? '' : 's'}
              </p>
            </div>

            <div className="space-y-3 p-4">
              <SummaryRow
                label="Gross Amount"
                value={formatCurrency(mobileTotalGross)}
              />
              <SummaryRow
                label="Discount"
                value={`-${formatCurrency(mobileTotalDiscount)}`}
              />
              {!isNonTaxCustomer && (
                <SummaryRow
                  label="Tax"
                  value={`+${formatCurrency(mobileTotalTax)}`}
                />
              )}

              <div className="border-t border-slate-100 pt-4">
                <p className="text-xs font-semibold text-slate-500">
                  Total Invoice Value
                </p>
                <p className="mt-1 break-words text-2xl font-extrabold leading-tight text-emerald-700">
                  {formatCurrency(total)}
                </p>
              </div>

              <button
                type="button"
                disabled={!mobileOrderReady || createMut.isPending}
                onClick={handleSubmit}
                className="mt-2 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white shadow-lg shadow-emerald-600/15 transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ShoppingCart className="h-4 w-4" />
                {createMut.isPending ? 'Placing Order...' : 'Place Order'}
              </button>

              {!mobileCustomerReady && (
                <p className="text-center text-[10px] text-amber-600">
                  Select a customer to continue
                </p>
              )}
            </div>
          </section>
        </aside>
      </div>


    </div>
  );
}

function OrderProgressStep({
  number,
  label,
  complete,
  active,
}: {
  number: number;
  label: string;
  complete: boolean;
  active: boolean;
}) {
  return (
    <div
      className={`rounded-xl border px-2 py-2 text-center backdrop-blur-sm transition ${
        complete
          ? 'border-white/20 bg-white/15'
          : active
            ? 'border-white/25 bg-white/10'
            : 'border-white/10 bg-black/5'
      }`}
    >
      <div
        className={`mx-auto inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black ${
          complete
            ? 'bg-white text-emerald-700'
            : active
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-white/10 text-emerald-100'
        }`}
      >
        {complete ? '✓' : number}
      </div>
      <p className="mt-1 text-[9px] font-semibold uppercase tracking-wide text-emerald-50">
        {label}
      </p>
    </div>
  );
}

function ResponsiveOrderSection({
  icon: Icon,
  title,
  count,
  completed = false,
  actionLabel,
  onAction,
  children,
}: {
  icon: any;
  title: string;
  count?: number;
  completed?: boolean;
  actionLabel?: string;
  onAction?: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3.5 sm:px-5">
        <div className="flex min-w-0 items-center gap-2.5">
          <div
            className={`inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ${
              completed
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-slate-100 text-slate-500'
            }`}
          >
            <Icon className="h-4 w-4" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-900">
                {title}
              </h2>

              {typeof count === 'number' && count > 0 && (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                  {count}
                </span>
              )}
            </div>
          </div>
        </div>

        {actionLabel && onAction && (
          <button
            type="button"
            onClick={onAction}
            className="inline-flex min-h-9 items-center rounded-lg px-2.5 text-xs font-bold text-emerald-700 transition active:bg-emerald-50"
          >
            {actionLabel}
          </button>
        )}
      </div>

      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}



function ExcelMoneyCell({
  value,
  muted = false,
  strong = false,
}: {
  value: string;
  muted?: boolean;
  strong?: boolean;
}) {
  return (
    <div className="flex min-w-0 items-center justify-end overflow-hidden border-r border-slate-300 px-1.5 py-1 text-right">
      <span
        className={`max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-[11px] leading-4 tabular-nums xl:text-[12px] ${
          muted ? 'text-slate-500' : 'text-slate-950'
        } ${strong ? 'font-black' : 'font-semibold'}`}
      >
        {value}
      </span>
    </div>
  );
}

function SummaryRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="max-w-[62%] break-words text-right font-bold text-slate-950">
        {value}
      </span>
    </div>
  );
}