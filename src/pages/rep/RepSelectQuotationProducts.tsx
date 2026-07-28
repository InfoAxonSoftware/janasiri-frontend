// @ts-nocheck
import { useState, useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { productsApi } from '../../services/api/productsApi';
import { customersApi } from '../../services/api/customersApi';
import { quotationDraftUtils } from '../../utils/quotationDraft';
import { formatCurrency } from '../../utils/formatters';
import { ArrowLeft, Search, FileText, Plus, Minus, Package, ChevronLeft, ChevronRight, Tag } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import type { Product } from '../../types/product.types';

export default function RepSelectQuotationProducts() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [draft, setDraft] = useState(quotationDraftUtils.get());
  // requestPrices: productId → input string (to allow decimal typing)
  const [requestPrices, setRequestPrices] = useState<Record<string, string>>(() => {
    const d = quotationDraftUtils.get();
    const m: Record<string, string> = {};
    d.items.forEach(i => {
      if (i.requestPrice != null) m[i.productId] = String(i.requestPrice);
    });
    return m;
  });

  const selectedCustomerId = draft.customerId;
  const { data: selectedCustomerData } = useQuery({
    queryKey: ['rep-selected-customer-quot', selectedCustomerId],
    queryFn: () => customersApi.repGetById(selectedCustomerId!).then(r => r.data.data),
    enabled: !!selectedCustomerId,
  });
  const isNonTaxCustomer = ((selectedCustomerData?.customerType || '').toLowerCase().replace(/[-\s]/g, '') === 'nontax');

  const { data, isLoading } = useQuery({
    queryKey: ['rep-products-catalog-quot', searchTerm, currentPage],
    queryFn: () => productsApi.repCatalog({
      page: currentPage,
      pageSize: 24,
      search: searchTerm || undefined,
    }).then(r => r.data.data),
  });

  const getCartQty = useCallback((productId: string) => {
    return draft.items.find(i => i.productId === productId)?.quantity ?? 0;
  }, [draft.items]);

  const handleAddToCart = (product: Product) => {
    const allIncPrice = product.totalAmount || (product.sellingPrice || 0) + (product.taxAmount || 0);
    quotationDraftUtils.addItem({
      productId: product.id,
      name: product.name,
      sku: product.sku || '',
      price: product.sellingPrice || 0,
      quantity: 1,
      taxCode: product.taxCode,
      taxAmount: product.taxAmount,
      totalAmount: allIncPrice || undefined,
      discountPercent: product.discountPercent,
      discountAmount: product.discountAmount,
    });
    setDraft(quotationDraftUtils.get());
    toast.success(`Added ${product.name}`);
  };

  const handleIncrement = (product: Product) => {
    const qty = getCartQty(product.id);
    if (qty > 0) {
      quotationDraftUtils.updateQuantity(product.id, qty + 1);
      setDraft(quotationDraftUtils.get());
    } else {
      handleAddToCart(product);
    }
  };

  const handleDecrement = (productId: string) => {
    const qty = getCartQty(productId);
    if (qty > 1) {
      quotationDraftUtils.updateQuantity(productId, qty - 1);
      setDraft(quotationDraftUtils.get());
    } else if (qty === 1) {
      quotationDraftUtils.removeItem(productId);
      setDraft(quotationDraftUtils.get());
      // clear stored request price
      setRequestPrices(prev => { const n = { ...prev }; delete n[productId]; return n; });
      toast.success('Removed from quotation');
    }
  };

  const handleRequestPriceChange = (productId: string, val: string) => {
    setRequestPrices(prev => ({ ...prev, [productId]: val }));
    const num = parseFloat(val);
    quotationDraftUtils.updateRequestPrice(productId, isNaN(num) || val === '' ? undefined : num);
    setDraft(quotationDraftUtils.get());
  };

  const cartCount = quotationDraftUtils.getItemCount();

  return (
    <div className="min-h-screen bg-slate-50/50 pb-24 md:pb-28 lg:pb-6">
      <div className="px-4 md:px-5 lg:px-6 pt-4 md:pt-6 max-w-[1200px] mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition">
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Add Products</h1>
              <p className="text-xs text-slate-500">Browse catalog and add items to your quotation</p>
            </div>
          </div>
          <button onClick={() => navigate(-1)}
            className="hidden sm:inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-700 transition text-sm active:scale-[0.98]">
            Done &rarr;
          </button>
        </div>

        {/* Stats Row */}
        <div className="flex gap-2 mb-4">
          <div className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-center">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Selected</p>
            <p className="text-lg font-bold text-slate-900">{cartCount}</p>
          </div>
          <div className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-center">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Catalog</p>
            <p className="text-lg font-bold text-slate-900">{data?.items?.length || 0}</p>
          </div>
          <div className="flex-1 bg-violet-50 border border-violet-200 rounded-xl px-3 py-2.5 text-center">
            <p className="text-[10px] font-bold text-violet-500 uppercase tracking-wider">Items</p>
            <p className="text-lg font-bold text-violet-700">{draft.items.length}</p>
          </div>
        </div>

        {/* Search */}
        <div className="sticky top-0 z-20 bg-slate-50/95 backdrop-blur-sm pb-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                placeholder="Search by product name or SKU..."
                className="w-full pl-11 pr-4 py-3.5 text-sm border-0 outline-none placeholder-slate-400"
              />
            </div>
          </div>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="text-center py-20">
            <div className="inline-block w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-slate-500 mt-4">Loading products...</p>
          </div>
        )}

        {/* Product Cards */}
        {!isLoading && data && (
          <>
            {data.items.length === 0 ? (
              <div className="text-center py-20">
                <Package className="w-16 h-16 mx-auto text-slate-300 mb-4" />
                <p className="text-lg font-semibold text-slate-700">No products found</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                  {data.items.map((product: Product) => {
                    const qty = getCartQty(product.id);
                    const basePrice = product.sellingPrice || 0;
                    const taxAmt = product.taxAmount || 0;
                    const allIncPrice = product.totalAmount || (basePrice + taxAmt);
                    const displayPrice = isNonTaxCustomer ? allIncPrice : basePrice;
                    const hasDiscount = (product.discountPercent || 0) > 0;
                    const reqPriceStr = requestPrices[product.id] ?? '';

                    return (
                      <div key={product.id} className={`bg-white rounded-2xl border overflow-hidden transition-all active:scale-[0.98] ${qty > 0 ? 'border-violet-300 ring-2 ring-violet-100 shadow-sm' : 'border-slate-200'}`}>
                        <div className="p-3.5">
                          {/* Product info */}
                          <div className="flex items-start gap-2 mb-3">
                            <div className="flex-1 min-w-0">
                              <h3 className="text-sm font-bold text-slate-900 leading-snug break-words">{product.name}</h3>
                              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                <span className="text-[11px] text-slate-400 font-mono">{product.sku}</span>
                                {product.taxCode && (
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">{product.taxCode}</span>
                                )}
                                {hasDiscount && (
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">{product.discountPercent}% off</span>
                                )}
                              </div>
                            </div>
                            {qty > 0 && (
                              <div className="shrink-0 w-7 h-7 rounded-full bg-violet-500 flex items-center justify-center">
                                <span className="text-[11px] font-bold text-white">{qty}</span>
                              </div>
                            )}
                          </div>

                          {/* Price */}
                          <div className="mb-3">
                            <span className="text-xl font-bold text-violet-600">{formatCurrency(displayPrice)}</span>
                            {!isNonTaxCustomer && taxAmt > 0 && (
                              <span className="text-xs text-slate-400 ml-1.5">+{formatCurrency(taxAmt)} tax</span>
                            )}
                          </div>

                          {/* Add / Qty controls */}
                          {qty === 0 ? (
                            <button onClick={() => handleAddToCart(product)}
                              className="w-full py-3 bg-violet-600 text-white font-semibold rounded-xl hover:bg-violet-700 active:bg-violet-800 transition flex items-center justify-center gap-2 active:scale-[0.97] text-sm">
                              <Plus className="w-4 h-4" /> Add to Quotation
                            </button>
                          ) : (
                            <div className="space-y-2.5">
                              <div className="flex items-center gap-2">
                                <button onClick={() => handleDecrement(product.id)}
                                  className="w-12 h-12 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 rounded-xl transition flex items-center justify-center active:scale-95 shrink-0">
                                  <Minus className="w-5 h-5 text-slate-700" />
                                </button>
                                <div className="flex-1 h-12 bg-violet-50 border-2 border-violet-500 rounded-xl font-bold text-violet-700 flex items-center justify-center text-xl">
                                  {qty}
                                </div>
                                <button onClick={() => handleIncrement(product)}
                                  className="w-12 h-12 bg-violet-600 hover:bg-violet-700 active:bg-violet-800 rounded-xl transition flex items-center justify-center active:scale-95 shrink-0">
                                  <Plus className="w-5 h-5 text-white" />
                                </button>
                              </div>
                              {/* Request Price input (only shown when product is in quotation) */}
                              <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                                <Tag className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                <input
                                  type="number"
                                  min={0}
                                  step={0.01}
                                  value={reqPriceStr}
                                  onChange={e => handleRequestPriceChange(product.id, e.target.value)}
                                  placeholder="Request price (optional)"
                                  className="flex-1 text-sm bg-transparent border-0 outline-none text-amber-800 placeholder-amber-400 min-w-0"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Pagination */}
                {data.totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-6 mb-4">
                    <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                      className="w-10 h-10 rounded-xl border border-slate-200 bg-white flex items-center justify-center disabled:opacity-30 hover:bg-slate-50 transition">
                      <ChevronLeft className="w-4 h-4 text-slate-600" />
                    </button>
                    <div className="text-sm font-bold text-slate-700 bg-white border border-slate-200 rounded-xl px-4 py-2.5">
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

      {/* Mobile Bottom Bar */}
      {cartCount > 0 && (
        <div className="fixed left-0 right-0 bottom-[calc(env(safe-area-inset-bottom,0px)+70px)] md:bottom-[calc(env(safe-area-inset-bottom,0px)+74px)] z-40 px-3">
          <div className="max-w-2xl mx-auto">
            <button onClick={() => navigate(-1)}
              className="w-full bg-violet-600 text-white rounded-2xl shadow-xl shadow-violet-600/30 p-4 flex items-center gap-3 active:scale-[0.98] transition">
              <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className="text-[10px] font-semibold text-violet-100 uppercase tracking-wider">{cartCount} Item{cartCount !== 1 ? 's' : ''} in Quotation</p>
                <p className="text-sm font-bold">Tap to review &amp; submit</p>
              </div>
              <span className="px-5 py-2.5 bg-white text-violet-700 rounded-xl text-sm font-bold shrink-0">Done</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
