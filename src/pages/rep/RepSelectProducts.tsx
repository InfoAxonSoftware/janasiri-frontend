import { useState, useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { productsApi } from '../../services/api/productsApi';
import { customersApi } from '../../services/api/customersApi';
import { orderDraftUtils, type OrderDraftItem } from '../../utils/orderDraft';
import { formatCurrency } from '../../utils/formatters';
import { calculateLine } from '../../utils/calculations';
import { ArrowLeft, Search, ShoppingCart, Plus, Minus, Package, ChevronLeft, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import type { Product } from '../../types/product.types';
import { useIsDesktop } from '../../hooks/useMediaQuery';
import ProductDropdown from '../../components/common/ProductDropdown';

function createClientRowId() {
  const cryptoApi = globalThis.crypto;

  if (
    cryptoApi &&
    typeof cryptoApi.randomUUID === 'function'
  ) {
    return cryptoApi.randomUUID();
  }

  return `row-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

export default function RepSelectProducts() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [draft, setDraft] = useState(orderDraftUtils.get());
  const isDesktop = useIsDesktop();

  useEffect(() => {
    if (draft.customerId) return;

    toast.error('Select a customer first');
    navigate('/rep/orders/new', {
      replace: true,
    });
  }, [draft.customerId, navigate]);

  interface QuickRow { id: string; product?: Product; qty: number; }
  const [quickRows, setQuickRows] = useState<QuickRow[]>([]);
  const [rowSearches, setRowSearches] = useState<Record<string, string>>({});
  const addQuickRow = () => setQuickRows(r => [...r, { id: createClientRowId(), qty: 1 }]);
  const updateQuickRow = (id: string, changes: Partial<QuickRow>) => {
    setQuickRows(r => r.map(row => row.id === id ? { ...row, ...changes } : row));
  };
  const removeQuickRow = (id: string) => {
    const row = quickRows.find(r => r.id === id);
    if (row && row.product) {
      orderDraftUtils.removeItem(row.product.id);
      setDraft(orderDraftUtils.get());
    }
    setQuickRows(r => r.filter(row => row.id !== id));
  };

  useEffect(() => {
    if (quickRows.length && quickRows[quickRows.length - 1].product) {
      addQuickRow();
    }
  }, [quickRows]);

  useEffect(() => {
    const d = orderDraftUtils.get();
    const rows: QuickRow[] = d.items.map(i => ({
      id: createClientRowId(),
      product: {
        id: i.productId,
        name: i.name,
        sku: i.sku,
        sellingPrice: i.price,
      } as Product,
      qty: i.quantity,
    }));
    if (rows.length === 0) rows.push({ id: createClientRowId(), qty: 1 });
    setQuickRows(rows);
  }, []);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['rep-products-catalog', searchTerm, currentPage],
    queryFn: () => productsApi.customerCatalog({
      page: currentPage,
      pageSize: 24,
      search: searchTerm || undefined,
    }).then(r => r.data.data),
  });

  const { data: allCatalogProducts = [] } = useQuery({
    queryKey: ['rep-products-catalog-all'],
    queryFn: () => productsApi.customerCatalogAll(),
  });

  const selectedCustomerId = draft.customerId;
  const { data: selectedCustomerData } = useQuery({
    queryKey: ['rep-selected-customer', selectedCustomerId],
    queryFn: () => customersApi.repGetById(selectedCustomerId!).then(r => r.data.data),
    enabled: !!selectedCustomerId,
  });
  const isNonTaxCustomer = ((selectedCustomerData?.customerType || '').toLowerCase().replace(/[-\s]/g, '') === 'nontax');

  const getBaseRate = (p: Product) => (p.sellingPrice || 0) + (p.discountAmount || 0);
  const getCalcInput = (p: Product) => {
    const isSpecialPrice = p.discountPercent == null && (p.discountAmount || 0) > 0;
    const rate = isSpecialPrice ? (p.sellingPrice || 0) : getBaseRate(p);
    const discountPercent = isSpecialPrice ? 0 : (p.discountPercent ?? 0);
    const taxAmount = p.taxAmount ?? 0;
    return { rate, discountPercent, taxAmount, isSpecialPrice };
  };

  useEffect(() => {
    if (!allCatalogProducts.length) return;
    setQuickRows(rows => rows.map(r => {
      if (!r.product || r.product.discountPercent != null) return r;
      const p = allCatalogProducts.find((p: Product) => p.id === r.product?.id);
      if (!p) return r;
      return { ...r, product: p };
    }));
  }, [allCatalogProducts]);

  const getCartQty = useCallback((productId: string) => {
    return draft.items.find(i => i.productId === productId)?.quantity ?? 0;
  }, [draft.items]);

  const handleAddToCart = (product: Product) => {
    const allIncPrice = product.totalAmount || (product.sellingPrice || 0) + (product.taxAmount || 0);
    const item: OrderDraftItem = {
      productId: product.id,
      quantity: 1,
      name: product.name,
      price: product.sellingPrice,
      sku: product.sku,
      mrp: product.mrp,
      discountPercent: product.discountPercent,
      taxCode: product.taxCode,
      taxAmount: product.taxAmount,
      allIncPrice: allIncPrice || undefined,
      lineTotal: isNonTaxCustomer
        ? allIncPrice
        : calculateLine({ rate: product.sellingPrice || 0, qty: 1, discountPercent: product.discountPercent, taxAmount: product.taxAmount }).total,
    };
    orderDraftUtils.addItem(item);
    setDraft(orderDraftUtils.get());
    toast.success(`Added ${product.name}`);
  };

  const syncRowItem = (row: QuickRow) => {
    if (!row.product) return;
    const prod = row.product;
    const existing = orderDraftUtils.get().items.find(i => i.productId === prod.id);
    if (existing) {
      orderDraftUtils.updateQuantity(prod.id, row.qty);
    } else {
      orderDraftUtils.addItem({
        productId: prod.id,
        quantity: row.qty,
        name: prod.name,
        price: prod.sellingPrice,
        sku: prod.sku,
        mrp: prod.mrp,
        discountPercent: prod.discountPercent,
        taxCode: prod.taxCode,
        taxAmount: prod.taxAmount,
        allIncPrice: prod.totalAmount || undefined,
        lineTotal: calculateLine({ rate: prod.sellingPrice || 0, qty: row.qty, discountPercent: prod.discountPercent, taxAmount: prod.taxAmount }).total,
      });
    }
    setDraft(orderDraftUtils.get());
  };

  const handleIncrement = (product: Product) => {
    const qty = getCartQty(product.id);
    if (qty > 0) {
      orderDraftUtils.updateQuantity(product.id, qty + 1);
      setDraft(orderDraftUtils.get());
    } else {
      handleAddToCart(product);
    }
  };

  const handleDecrement = (productId: string) => {
    const qty = getCartQty(productId);
    if (qty > 1) {
      orderDraftUtils.updateQuantity(productId, qty - 1);
      setDraft(orderDraftUtils.get());
    } else if (qty === 1) {
      orderDraftUtils.removeItem(productId);
      setDraft(orderDraftUtils.get());
      toast.success('Removed from cart');
    }
  };

  const cartCount = orderDraftUtils.getItemCount();
  // Mobile cart total: computed from draft items (quickRows is desktop-only)
  const cartTotal = draft.items.reduce((sum, item) => sum + (item.lineTotal ?? 0), 0);
  const quickTotalGross = quickRows.reduce((sum, r) => {
    if (!r.product) return sum;
    const pricing = getCalcInput(r.product);
    const baseAmount = pricing.rate * r.qty;
    const rowTax = (r.product.taxAmount || 0) * r.qty;
    return sum + (isNonTaxCustomer ? (baseAmount + rowTax) : baseAmount);
  }, 0);
  const quickTotalTax = quickRows.reduce((sum, r) => {
    if (!r.product) return sum;
    const tax = isNonTaxCustomer ? 0 : (r.product.taxAmount || 0);
    return sum + tax * r.qty;
  }, 0);
  const quickTotalDiscount = quickRows.reduce((sum, r) => {
    if (!r.product) return sum;
    const pricing = getCalcInput(r.product);
    const unitDisc = pricing.isSpecialPrice ? 0 : (r.product.discountAmount || 0);
    return sum + unitDisc * r.qty;
  }, 0);
  const quickTotal = isNonTaxCustomer
    ? quickTotalGross - quickTotalDiscount
    : quickTotalGross + quickTotalTax - quickTotalDiscount;

  if (!draft.customerId) {
    return (
      <div className="flex min-h-[50dvh] items-center justify-center px-4">
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-8 text-center shadow-sm">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
          <p className="mt-4 text-sm font-semibold text-slate-600">
            Returning to Create Order...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 pb-16 md:pb-20 lg:pb-8">
      <div className="mx-auto max-w-[1200px] px-3 pt-2 sm:px-5 sm:pt-4 lg:px-6">
        {/* Header */}
        <section className="relative overflow-hidden rounded-2xl bg-emerald-700 px-4 py-5 text-white shadow-sm sm:px-5 sm:py-6">
          <div className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-white/10 blur-3xl" />

          <div className="relative flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-100">
                Create Order
              </p>
              <h1 className="mt-0.5 text-xl font-bold tracking-tight sm:text-2xl">
                Select Products
              </h1>
              <p className="mt-1 text-xs leading-5 text-emerald-100 sm:text-sm">
                Search products and set quantities
              </p>
            </div>

            <div className="hidden rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-right sm:block">
              <p className="text-[9px] font-bold uppercase tracking-wide text-emerald-100">
                Selected
              </p>
              <p className="mt-0.5 text-sm font-black text-white">
                {cartCount}
              </p>
            </div>
          </div>
        </section>

        {/* Search and Continue */}
        <section className="sticky top-2 z-30 mt-3 rounded-xl border border-slate-200 bg-white/95 p-2.5 shadow-sm backdrop-blur-md sm:p-3">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

              <input
                type="search"
                value={searchTerm}
                onChange={(event) => {
                  setSearchTerm(event.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search product or SKU"
                className="min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-500/15"
              />
            </div>

            <button
              type="button"
              disabled={cartCount === 0}
              onClick={() => navigate(-1)}
              className="inline-flex min-h-11 flex-shrink-0 items-center justify-center gap-1.5 rounded-xl bg-emerald-700 px-3.5 text-xs font-black text-white transition active:scale-[0.98] disabled:bg-slate-200 disabled:text-slate-400 sm:px-5 sm:text-sm"
            >
              Continue
              <ShoppingCart className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-2 flex items-center justify-between gap-3 px-1 text-[11px]">
            <span className="truncate text-slate-500">
              {data?.totalCount ?? data?.items?.length ?? 0} products
            </span>

            <span className="flex-shrink-0 font-bold text-emerald-700">
              {cartCount} item{cartCount === 1 ? '' : 's'} · {formatCurrency(cartTotal)}
            </span>
          </div>
        </section>

        {/* Loading */}
        {isLoading && (
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
            {Array.from({ length: 12 }).map((_, index) => (
              <div
                key={index}
                className="h-[66px] animate-pulse rounded-xl border border-slate-200 bg-white px-3 py-2.5"
              >
                <div className="h-3.5 w-3/4 rounded bg-slate-200" />
                <div className="mt-2 h-3.5 w-1/3 rounded bg-slate-100" />
              </div>
            ))}
          </div>
        )}

        {!isLoading && isError && (
          <section className="mt-4 rounded-2xl border border-red-100 bg-white px-5 py-12 text-center shadow-sm">
            <Package className="mx-auto h-12 w-12 text-red-200" />
            <h2 className="mt-4 text-base font-bold text-slate-800">
              Could not load products
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Check the connection and try again.
            </p>
            <button
              type="button"
              onClick={() => refetch()}
              className="mt-4 rounded-xl bg-emerald-700 px-5 py-2.5 text-xs font-bold text-white"
            >
              Retry
            </button>
          </section>
        )}

        {/* Products */}
        {!isLoading && !isError && data && (
          <>
            {data.items.length === 0 ? (
              <div className="text-center py-20">
                <Package className="w-16 h-16 mx-auto text-slate-300 mb-4" />
                <p className="text-lg font-semibold text-slate-700">No products found</p>
                <p className="text-sm text-slate-500 mt-2">Try adjusting your search</p>
              </div>
            ) : (
              <>
                {/* Desktop: Table */}
                {isDesktop ? (
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-6">
                    <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-violet-50 flex items-center justify-center">
                          <Package className="w-4 h-4 text-violet-600" />
                        </div>
                        <h2 className="text-sm font-bold text-slate-900">Product Selection</h2>
                      </div>
                      {cartCount > 0 && (
                        <div className="flex items-center gap-2.5 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2">
                          <ShoppingCart className="w-4 h-4 text-emerald-600" />
                          <span className="text-xs font-bold text-emerald-700">{cartCount} items</span>
                          <span className="text-emerald-300">|</span>
                          <span className="text-sm font-bold text-emerald-700">{formatCurrency(quickTotal)}</span>
                        </div>
                      )}
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-slate-50 text-slate-500">
                            <th className="text-center px-3 py-3 font-semibold text-[10px] uppercase tracking-wider w-8">#</th>
                            <th className="text-left px-3 py-3 font-semibold text-[10px] uppercase tracking-wider whitespace-nowrap">Item Code</th>
                            <th className="text-left px-4 py-3 font-semibold text-[10px] uppercase tracking-wider min-w-[280px]">Item Description</th>
                            <th className="text-center px-3 py-3 font-semibold text-[10px] uppercase tracking-wider w-20">Qty</th>
                            <th className="text-right px-3 py-3 font-semibold text-[10px] uppercase tracking-wider whitespace-nowrap">Rate</th>
                            <th className="text-right px-3 py-3 font-semibold text-[10px] uppercase tracking-wider whitespace-nowrap">Disc %</th>
                            <th className="text-right px-3 py-3 font-semibold text-[10px] uppercase tracking-wider whitespace-nowrap">Disc Amt</th>
                            {!isNonTaxCustomer && <th className="text-right px-3 py-3 font-semibold text-[10px] uppercase tracking-wider whitespace-nowrap">Tax</th>}
                            <th className="text-right px-3 py-3 font-semibold text-[10px] uppercase tracking-wider whitespace-nowrap">Line Gross</th>
                            <th className="w-12"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {quickRows.map(row => {
                            const prod = row.product;
                            let rate = 0, discPct = 0, discAmt = 0, taxAmt = 0, grossAmount = 0;
                            if (prod) {
                              const pricing = getCalcInput(prod);
                              rate = pricing.rate;
                              discPct = pricing.discountPercent;
                              discAmt = pricing.isSpecialPrice ? 0 : (prod.discountAmount || 0);
                              taxAmt = prod.taxAmount || 0;
                              const baseAmount = rate * row.qty;
                              const rowTax = taxAmt * row.qty;
                              grossAmount = isNonTaxCustomer ? (baseAmount + rowTax) : baseAmount;
                            }
                            return (
                              <tr key={row.id} className="group hover:bg-slate-50/50 transition-colors">
                                {/* # */}
                                <td className="px-3 py-2 text-center text-[10px] text-slate-400">{quickRows.indexOf(row) + 1}</td>
                                {/* Item Code (SKU) */}
                                <td className="px-3 py-2 text-slate-500 font-mono text-[10px] whitespace-nowrap">{prod?.sku || ''}</td>
                                {/* Item Description (dropdown) */}
                                <td className="px-3 py-2 min-w-[280px]">
                                  <ProductDropdown
                                    rowId={row.id}
                                    value={rowSearches[row.id] !== undefined ? rowSearches[row.id] : (prod?.name || '')}
                                    products={allCatalogProducts as Product[]}
                                    selectedProductIds={new Set(quickRows.filter(r => r.id !== row.id && r.product).map(r => r.product!.id))}
                                    currentProductId={prod?.id}
                                    onChange={(val) => {
                                      setRowSearches(prev => ({ ...prev, [row.id]: val }));
                                      if (!val.trim()) updateQuickRow(row.id, { product: undefined });
                                    }}
                                    onSelect={(p) => {
                                      updateQuickRow(row.id, { product: p, qty: 1 });
                                      setRowSearches(prev => ({ ...prev, [row.id]: p.name }));
                                      if (quickRows[quickRows.length - 1].id === row.id) addQuickRow();
                                      syncRowItem({ ...row, product: p, qty: 1 });
                                    }}
                                  />
                                </td>
                                {/* Qty */}
                                <td className="px-2 py-2 text-center">
                                  <input
                                    type="text" inputMode="numeric" pattern="[0-9]*" value={row.qty || ''} disabled={!prod}
                                    placeholder="Qty"
                                    onChange={e => { const q = Math.max(1, parseInt(e.target.value) || 1); updateQuickRow(row.id, { qty: q }); if (prod) { syncRowItem({ ...row, qty: q }); } }}
                                    className="w-16 text-center text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition disabled:opacity-40"
                                  />
                                </td>
                                {/* Rate */}
                                <td className="px-3 py-2 text-right text-slate-700 whitespace-nowrap">{prod ? formatCurrency(isNonTaxCustomer ? rate + taxAmt : rate) : ''}</td>
                                {/* Disc % */}
                                <td className="px-3 py-2 text-right text-slate-500 whitespace-nowrap">{prod && discPct > 0 ? `${discPct}%` : ''}</td>
                                {/* Disc Amt */}
                                <td className="px-3 py-2 text-right text-slate-500 whitespace-nowrap">{prod && discAmt > 0 ? formatCurrency(discAmt) : ''}</td>
                                {/* Tax amount — tax customers only */}
                                {!isNonTaxCustomer && <td className="px-3 py-2 text-right text-slate-500 whitespace-nowrap">{prod && taxAmt > 0 ? formatCurrency(taxAmt) : ''}</td>}
                                {/* Line Gross */}
                                <td className="px-3 py-2 text-right font-bold text-slate-900 whitespace-nowrap">{prod ? formatCurrency(grossAmount) : ''}</td>
                                <td className="px-2 py-2 text-center">
                                  <button onClick={() => removeQuickRow(row.id)}
                                    className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 transition opacity-0 group-hover:opacity-100">
                                    <span className="text-sm">&times;</span>
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  /* Mobile / tablet: dense product selector */
                  <div className="mb-5 mt-1 grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-2.5 md:grid-cols-3">
                    {data.items.map((product: Product) => {
                      const qty = getCartQty(product.id);
                      const basePrice = product.sellingPrice || 0;
                      const taxAmount = product.taxAmount || 0;
                      const allInclusivePrice =
                        product.totalAmount ||
                        basePrice + taxAmount;
                      const displayPrice = isNonTaxCustomer
                        ? allInclusivePrice
                        : basePrice;

                      return (
                        <article
                          key={product.id}
                          className={`flex min-h-[66px] min-w-0 items-center gap-2.5 rounded-xl border bg-white px-3 py-2.5 shadow-sm transition ${
                            qty > 0
                              ? 'border-emerald-500 bg-emerald-50/50 ring-1 ring-emerald-500/10'
                              : 'border-slate-200'
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <h2
                              className="line-clamp-2 break-words text-[12px] font-bold leading-4 text-slate-900 sm:text-[13px]"
                              title={product.name}
                            >
                              {product.name}
                            </h2>

                            <p className="mt-1 whitespace-nowrap text-[13px] font-black leading-4 text-emerald-700 sm:text-sm">
                              {formatCurrency(displayPrice)}
                            </p>
                          </div>

                          {qty === 0 ? (
                            <button
                              type="button"
                              onClick={() =>
                                handleAddToCart(product)
                              }
                              className="inline-flex h-9 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-700 px-3 text-[11px] font-bold text-white transition active:scale-[0.97] active:bg-emerald-800"
                            >
                              Add
                            </button>
                          ) : (
                            <div className="flex flex-shrink-0 items-center gap-1">
                              <button
                                type="button"
                                onClick={() =>
                                  handleDecrement(product.id)
                                }
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-700 transition active:scale-95 active:bg-slate-200"
                                aria-label={`Decrease ${product.name}`}
                              >
                                <Minus className="h-3.5 w-3.5" />
                              </button>

                              <div className="flex h-8 min-w-8 items-center justify-center rounded-lg border border-emerald-300 bg-white px-1.5 text-xs font-black text-emerald-700">
                                {qty}
                              </div>

                              <button
                                type="button"
                                onClick={() =>
                                  handleIncrement(product)
                                }
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-700 text-white transition active:scale-95 active:bg-emerald-800"
                                aria-label={`Increase ${product.name}`}
                              >
                                <Plus className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}
                        </article>
                      );
                    })}
                  </div>
                )}


                {/* Pagination */}
                {data.totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-6 mb-4">
                    <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                      className="w-10 h-10 rounded-xl border border-slate-200 bg-white flex items-center justify-center disabled:opacity-30 hover:bg-slate-50 transition">
                      <ChevronLeft className="w-4 h-4 text-slate-600" />
                    </button>
                    <div className="hidden md:flex items-center gap-1">
                      {Array.from({ length: Math.min(5, data.totalPages) }, (_, i) => {
                        const page = i + 1;
                        return (
                          <button key={page} onClick={() => setCurrentPage(page)}
                            className={`w-10 h-10 rounded-xl text-sm font-semibold transition ${currentPage === page ? 'bg-emerald-600 text-white' : 'bg-white border border-slate-200 hover:bg-slate-50'}`}>
                            {page}
                          </button>
                        );
                      })}
                      {data.totalPages > 5 && <span className="px-2 text-slate-400">...</span>}
                    </div>
                    <div className="md:hidden text-sm font-bold text-slate-700 bg-white border border-slate-200 rounded-xl px-4 py-2.5">
                      {currentPage} / {data.totalPages}
                    </div>
                    <button onClick={() => setCurrentPage(p => Math.min(data.totalPages, p + 1))} disabled={currentPage === data.totalPages}
                      className="w-10 h-10 rounded-xl border border-slate-200 bg-white flex items-center justify-center disabled:opacity-30 hover:bg-slate-50 transition">
                      <ChevronRight className="w-4 h-4 text-slate-600" />
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>


    </div>
  );
}