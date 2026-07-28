import { useMemo, useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { repCreateQuotation } from '../../services/api/quotationApi';
import { customersApi } from '../../services/api/customersApi';
import { productsApi } from '../../services/api/productsApi';
import { formatCurrency } from '../../utils/formatters';
import { taxCodeToRate } from '../../utils/calculations';
import { quotationDraftUtils } from '../../utils/quotationDraft';
import type { Product } from '../../types/product.types';
import toast from 'react-hot-toast';
import { useIsDesktop } from '../../hooks/useMediaQuery';
import { ArrowLeft, User, Package, Trash2, FileText, Plus, Tag, MessageSquare, ChevronRight } from 'lucide-react';
import ProductDropdown from '../../components/common/ProductDropdown';

type QuotationRow = {
  id: string;
  product?: Product;
  qty: number;
  requestPrice?: number;
};

export default function RepCreateQuotation() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isDesktop = useIsDesktop();

  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [notes, setNotes] = useState('');
  const [quotationRows, setQuotationRows] = useState<QuotationRow[]>([{ id: crypto.randomUUID(), qty: 1 }]);
  const [rowSearches, setRowSearches] = useState<Record<string, string>>({});

  const { data: customers } = useQuery({
    queryKey: ['rep-customers-for-quotation-create'],
    queryFn: () => customersApi.repGetCustomers({ page: 1, pageSize: 500 }).then((r) => r.data.data.items),
  });

  const { data: products } = useQuery({
    queryKey: ['rep-products-for-quotation-create'],
    queryFn: () => productsApi.getAllForSelection(),
  });

  const selectedCustomerName = useMemo(() => {
    const customer = (customers || []).find((c: any) => c.id === selectedCustomerId);
    return customer?.shopName || '';
  }, [customers, selectedCustomerId]);

  const { data: selectedCustomerDetail } = useQuery({
    queryKey: ['rep-customer', selectedCustomerId],
    queryFn: () => customersApi.repGetById(selectedCustomerId!).then(r => r.data.data),
    enabled: !!selectedCustomerId,
  });
  const isNonTaxCustomer = ((selectedCustomerDetail?.customerType || '').toLowerCase().replace(/[-\s]/g, '') === 'nontax');

  const createMut = useMutation({
    mutationFn: () =>
      repCreateQuotation({
        customerId: selectedCustomerId,
        notes: notes || undefined,
        items: quotationRows
          .filter((r) => !!r.product)
          .map((r) => {
            const product = r.product as Product;
            const isSpecialPrice = product.discountPercent == null && (product.discountAmount || 0) > 0;
            const discountPercent = isSpecialPrice ? 0 : (product.discountPercent ?? 0);
            return {
              productId: product.id,
              quantity: r.qty,
              expectedPrice: r.requestPrice && r.requestPrice > 0 ? r.requestPrice : undefined,
              discountPercent,
            };
          }),
      }),
    onSuccess: () => {
      toast.success('Quotation submitted! It is now visible to coordinator and admin.');
      queryClient.invalidateQueries({ queryKey: ['rep-quotations'] });
      navigate('/rep/quotations');
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.message;
      toast.error(msg || 'Failed to submit quotation');
    },
  });

  /* ── Mobile-specific state ── */
  const [mobileDraft, setMobileDraft] = useState(() => quotationDraftUtils.get());
  const [mobileNotes, setMobileNotes] = useState(() => quotationDraftUtils.get().notes || '');
  const [mobileCustomerId, setMobileCustomerId] = useState(() => quotationDraftUtils.get().customerId || '');

  useEffect(() => {
    if (!isDesktop) quotationDraftUtils.setNotes(mobileNotes);
  }, [mobileNotes, isDesktop]);

  const handleMobileCustomerChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    setMobileCustomerId(id);
    const name = (customers || []).find((c: any) => c.id === id)?.shopName || '';
    quotationDraftUtils.setCustomer(id, name);
    setMobileDraft(quotationDraftUtils.get());
  };

  const refreshMobileDraft = () => setMobileDraft(quotationDraftUtils.get());

  const { data: mobileCustomerDetail } = useQuery({
    queryKey: ['rep-customer-mob-quot', mobileCustomerId],
    queryFn: () => customersApi.repGetById(mobileCustomerId!).then(r => r.data.data),
    enabled: !isDesktop && !!mobileCustomerId,
  });
  const isMobileNonTax = ((mobileCustomerDetail?.customerType || '').toLowerCase().replace(/[-\s]/g, '') === 'nontax');

  const mobileMut = useMutation({
    mutationFn: () => {
      const d = quotationDraftUtils.get();
      return repCreateQuotation({
        customerId: d.customerId!,
        notes: mobileNotes || undefined,
        items: d.items.map(i => ({
          productId: i.productId,
          quantity: i.quantity,
          expectedPrice: i.requestPrice && i.requestPrice > 0 ? i.requestPrice : undefined,
          discountPercent: i.discountPercent ?? 0,
        })),
      });
    },
    onSuccess: () => {
      quotationDraftUtils.clear();
      toast.success('Quotation submitted! It is now visible to coordinator and admin.');
      queryClient.invalidateQueries({ queryKey: ['rep-quotations'] });
      navigate('/rep/quotations');
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.message;
      toast.error(msg || 'Failed to submit quotation');
    },
  });

  const addQuotationRow = () => {
    setQuotationRows((prev) => [...prev, { id: crypto.randomUUID(), qty: 1 }]);
  };

  const updateQuotationRow = (rowId: string, updates: Partial<QuotationRow>) => {
    setQuotationRows((prev) => {
      if (updates.product) {
        const duplicateExists = prev.some((r) => r.id !== rowId && r.product?.id === updates.product?.id);
        if (duplicateExists) {
          toast.error('This product is already selected in another row');
          return prev;
        }
      }
      const next = prev.map((r) => (r.id === rowId ? { ...r, ...updates } : r));
      const isLast = next[next.length - 1]?.id === rowId;
      if (isLast && updates.product) {
        next.push({ id: crypto.randomUUID(), qty: 1 });
      }
      return next;
    });
  };

  const removeQuotationRow = (rowId: string) => {
    setQuotationRows((prev) => {
      const filtered = prev.filter((r) => r.id !== rowId);
      if (filtered.length === 0) return [{ id: crypto.randomUUID(), qty: 1 }];
      return filtered;
    });
  };

  const getCalcInput = (product: Product) => {
    const isSpecialPrice = product.discountPercent == null && (product.discountAmount || 0) > 0;
    const baseRate = (product.sellingPrice || 0) + (product.discountAmount || 0);
    const rate = isSpecialPrice ? (product.sellingPrice || 0) : baseRate;
    const discountPercent = isSpecialPrice ? 0 : (product.discountPercent ?? 0);
    const taxAmount = product.taxAmount ?? 0;
    return { rate, discountPercent, taxAmount, isSpecialPrice };
  };

  const selectedItems = quotationRows.filter((r) => !!r.product);

  const quotationTotalGross = selectedItems.reduce((sum, row) => {
    const p = row.product as Product;
    const pricing = getCalcInput(p);
    const baseAmount = pricing.rate * row.qty;
    const rowTaxRate = taxCodeToRate(p.taxCode);
    const nonTaxGross = p.totalAmount ? p.totalAmount * row.qty : baseAmount * (1 + rowTaxRate);
    return sum + (isNonTaxCustomer ? nonTaxGross : baseAmount);
  }, 0);

  const quotationTotalTax = selectedItems.reduce((sum, row) => {
    if (isNonTaxCustomer) return sum;
    const p = row.product as Product;
    const pricing = getCalcInput(p);
    const rowGross = pricing.rate * row.qty;
    const rowDiscount = rowGross * (pricing.discountPercent / 100);
    const rowNet = rowGross - rowDiscount;
    return sum + rowNet * taxCodeToRate(p.taxCode);
  }, 0);

  const quotationTotalDiscount = selectedItems.reduce((sum, row) => {
    const p = row.product as Product;
    const pricing = getCalcInput(p);
    if (pricing.isSpecialPrice) return sum;
    const rowTaxRate = taxCodeToRate(p.taxCode);
    const allIncRate = p.totalAmount || Math.round(pricing.rate * (1 + rowTaxRate) * 100) / 100;
    return sum + (isNonTaxCustomer ? allIncRate * row.qty * pricing.discountPercent / 100 : (p.discountAmount || 0) * row.qty);
  }, 0);

  const quotationTotal = isNonTaxCustomer
    ? quotationTotalGross - quotationTotalDiscount
    : quotationTotalGross + quotationTotalTax - quotationTotalDiscount;

  const quotationNetAmount = quotationTotalGross - quotationTotalDiscount;

  /* ═══════ DESKTOP ═══════ */
  if (isDesktop) {
    return (
      <div className="min-h-screen bg-slate-50/50">
        <div className="max-w-[1200px] mx-auto px-6 py-6 space-y-5">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition">
                <ArrowLeft className="w-5 h-5 text-slate-600" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-slate-900">Create Quotation</h1>
                <p className="text-sm text-slate-500">Create quotations for your customer</p>
              </div>
            </div>
            {selectedItems.length > 0 && (
              <div className="flex items-center gap-2.5 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5">
                <FileText className="w-4 h-4 text-emerald-600" />
                <span className="text-sm font-bold text-emerald-700">{selectedItems.length} items</span>
                <span className="text-emerald-300">|</span>
                <span className="text-sm font-bold text-emerald-700">{formatCurrency(quotationTotal)}</span>
              </div>
            )}
          </div>

          {/* Customer */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="px-5 py-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
                  <User className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Customer</h2>
                  {selectedCustomerName && (
                    <p className="text-xs text-slate-500 mt-0.5">
                      {selectedCustomerName}
                      {isNonTaxCustomer && <span className="text-orange-600 font-semibold"> &bull; Non-Tax</span>}
                    </p>
                  )}
                </div>
              </div>
            </div>
            <div className="p-5">
              <select value={selectedCustomerId} onChange={(e) => setSelectedCustomerId(e.target.value)}
                className="w-full max-w-lg px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition">
                <option value="">Select a customer...</option>
                {(customers || []).map((customer: any) => (
                  <option key={customer.id} value={customer.id}>{customer.shopName}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Product Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-violet-50 flex items-center justify-center">
                  <Package className="w-4 h-4 text-violet-600" />
                </div>
                <h2 className="text-sm font-bold text-slate-900">Quotation Items</h2>
              </div>
              <button onClick={addQuotationRow}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition">
                <Plus className="w-3.5 h-3.5" /> Add Row
              </button>
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
                    <th className="text-right px-3 py-3 font-semibold text-[10px] uppercase tracking-wider whitespace-nowrap">Request Price</th>
                    <th className="w-12"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {quotationRows.map((row) => {
                    const p = row.product;
                    const selectedProductIds = new Set(quotationRows.filter((r) => r.id !== row.id && r.product).map((r) => r.product!.id));
                    const calcInput = p ? getCalcInput(p) : null;
                    let grossAmount = 0, discAmt = 0;
                    if (p && calcInput) {
                      const lineTaxRate = taxCodeToRate(p.taxCode);
                      const allIncRate = p.totalAmount || Math.round(calcInput.rate * (1 + lineTaxRate) * 100) / 100;
                      discAmt = calcInput.isSpecialPrice ? 0 : (isNonTaxCustomer ? allIncRate * row.qty * calcInput.discountPercent / 100 : (p.discountAmount || 0));
                      const baseAmount = calcInput.rate * row.qty;
                      grossAmount = isNonTaxCustomer ? allIncRate * row.qty : baseAmount;
                    }
                    return (
                      <tr key={row.id} className="group hover:bg-slate-50/50 transition-colors">
                        {/* # */}
                        <td className="px-3 py-2 text-center text-[10px] text-slate-400">{quotationRows.indexOf(row) + 1}</td>
                        {/* Item Code (SKU) */}
                        <td className="px-3 py-2 text-slate-500 font-mono text-[10px] whitespace-nowrap">{p?.sku || ''}</td>
                        {/* Item Description (dropdown) */}
                        <td className="px-3 py-2 min-w-[280px]">
                          <ProductDropdown rowId={row.id}
                            value={rowSearches[row.id] !== undefined ? rowSearches[row.id] : (p?.name || '')}
                            products={(products || []) as Product[]} selectedProductIds={selectedProductIds} currentProductId={p?.id}
                            onChange={(val) => { setRowSearches(prev => ({ ...prev, [row.id]: val })); if (!val.trim()) updateQuotationRow(row.id, { product: undefined }); }}
                            onSelect={(product) => { updateQuotationRow(row.id, { product }); setRowSearches(prev => ({ ...prev, [row.id]: product.name })); }}
                          />
                        </td>
                        {/* Qty */}
                        <td className="px-2 py-2 text-center">
                          <input type="text" inputMode="numeric" pattern="[0-9]*" value={row.qty || ''} disabled={!p} placeholder="Qty"
                            onChange={(e) => updateQuotationRow(row.id, { qty: Math.max(1, Number(e.target.value) || 1) })}
                            className="w-16 text-center text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition disabled:opacity-40" />
                        </td>
                        {/* Rate */}
                        <td className="px-3 py-2 text-right text-slate-700 whitespace-nowrap">{p && calcInput ? formatCurrency(isNonTaxCustomer ? (p.totalAmount || calcInput.rate * (1 + taxCodeToRate(p.taxCode))) : calcInput.rate) : ''}</td>
                        {/* Disc % */}
                        <td className="px-3 py-2 text-right text-slate-500 whitespace-nowrap">{p && calcInput && calcInput.discountPercent > 0 ? `${calcInput.discountPercent}%` : ''}</td>
                        {/* Disc Amt */}
                        <td className="px-3 py-2 text-right text-slate-500 whitespace-nowrap">{p && discAmt > 0 ? formatCurrency(discAmt) : ''}</td>
                        {/* Tax code — tax customers only */}
                        {!isNonTaxCustomer && <td className="px-3 py-2 text-center text-slate-500 whitespace-nowrap">{p?.taxCode || ''}</td>}
                        {/* Line Gross */}
                        <td className="px-3 py-2 text-right font-bold text-slate-900 whitespace-nowrap">{p ? formatCurrency(grossAmount) : ''}</td>
                        {/* Request Price */}
                        <td className="px-2 py-2">
                          <input type="number" min={0} step={0.01} value={row.requestPrice ?? ''} disabled={!p}
                            onChange={(e) => updateQuotationRow(row.id, { requestPrice: e.target.value === '' ? undefined : Number(e.target.value) })}
                            className="w-24 text-right text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition disabled:opacity-40" placeholder="optional" />
                        </td>
                        <td className="px-2 py-2 text-center">
                          <button onClick={() => removeQuotationRow(row.id)}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 transition opacity-0 group-hover:opacity-100">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Notes */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="px-5 py-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-violet-50 flex items-center justify-center">
                  <FileText className="w-4 h-4 text-violet-600" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Quotation Notes</h2>
                  <p className="text-xs text-slate-400">Optional — visible to admin &amp; coordinator</p>
                </div>
              </div>
            </div>
            <div className="p-5">
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Add any comments or special instructions for this quotation..."
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 resize-none placeholder-slate-400 transition" />
            </div>
          </div>

          {/* Summary & Actions */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 space-y-3">
              <div className="flex justify-between text-sm text-slate-500">
                <span>Gross Amount</span>
                <span className="font-semibold text-slate-700">{formatCurrency(quotationTotalGross)}</span>
              </div>
              <div className="flex justify-between text-sm text-emerald-600 pb-2 border-b border-slate-100">
                <span>Discount Amount</span>
                <span className="font-semibold">-{formatCurrency(quotationTotalDiscount)}</span>
              </div>
              {!isNonTaxCustomer && (
                <>
                  <div className="flex justify-between text-sm text-slate-500">
                    <span>Net Amount</span>
                    <span className="font-semibold text-slate-700">{formatCurrency(quotationNetAmount)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-slate-500 pb-2 border-b border-slate-100">
                    <span>Total Tax Amount</span>
                    <span className="font-semibold text-slate-700">+{formatCurrency(quotationTotalTax)}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between items-center">
                <span className="text-base font-bold text-slate-900">Total Invoice Value</span>
                <span className="text-2xl font-bold text-emerald-600">{formatCurrency(quotationTotal)}</span>
              </div>
            </div>
            <div className="px-5 pb-5 flex gap-3">
              <button onClick={() => navigate('/rep/quotations')}
                className="flex-1 py-3 border-2 border-slate-200 text-slate-600 rounded-xl font-semibold text-sm hover:bg-slate-50 transition">
                Cancel
              </button>
              <button onClick={() => createMut.mutate()}
                disabled={createMut.isPending || !selectedCustomerId || selectedItems.length === 0}
                className="flex-[2] py-3 bg-emerald-600 text-white rounded-xl font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-emerald-700 transition active:scale-[0.99] flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20">
                <FileText className="w-4 h-4" />
                {createMut.isPending ? 'Submitting...' : 'Send Quotation'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ═══════ MOBILE / TABLET ═══════ */
  const mobileItems = mobileDraft.items;
  const mobileTotal = mobileItems.reduce((sum, i) => {
    const price = isMobileNonTax ? (i.totalAmount || i.price) : i.price;
    return sum + price * i.quantity;
  }, 0);

  return (
    <div className="pb-28">
      <div className="px-4 pt-4 max-w-2xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={() => { quotationDraftUtils.clear(); navigate(-1); }}
            className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition shrink-0">
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-slate-900">Create Quotation</h1>
            <p className="text-xs text-slate-500">Select customer, add products, and submit</p>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="flex gap-2">
          {[
            { label: 'Customer', done: !!mobileCustomerId },
            { label: 'Products', done: mobileItems.length > 0 },
            { label: 'Send', done: !!mobileCustomerId && mobileItems.length > 0 },
          ].map((step, i) => (
            <div key={i} className={`flex-1 rounded-xl p-3 text-center transition-all ${step.done ? 'bg-violet-50 border border-violet-200' : 'bg-white border border-slate-200'}`}>
              <p className={`text-[10px] font-bold uppercase tracking-wider ${step.done ? 'text-violet-600' : 'text-slate-400'}`}>{step.label}</p>
              <p className={`text-xs font-bold mt-0.5 ${step.done ? 'text-violet-700' : 'text-slate-300'}`}>{step.done ? '✓' : '—'}</p>
            </div>
          ))}
        </div>

        {/* Customer Card */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                <User className="w-4 h-4 text-blue-600" />
              </div>
              <span className="text-sm font-bold text-slate-900">Customer</span>
              {isMobileNonTax && <span className="text-[10px] font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">Non-Tax</span>}
            </div>
          </div>
          <div className="p-4">
            <select value={mobileCustomerId} onChange={handleMobileCustomerChange}
              className="w-full px-3.5 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400">
              <option value="">Select customer...</option>
              {(customers || []).map((customer: any) => (
                <option key={customer.id} value={customer.id}>{customer.shopName}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Products Card */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center">
                <Package className="w-4 h-4 text-violet-600" />
              </div>
              <span className="text-sm font-bold text-slate-900">Products</span>
              {mobileItems.length > 0 && (
                <span className="px-2 py-0.5 bg-violet-100 text-violet-700 text-[10px] font-bold rounded-full">{mobileItems.length}</span>
              )}
            </div>
            {mobileItems.length > 0 && (
              <button onClick={() => { refreshMobileDraft(); navigate('/rep/quotations/new/products'); }}
                className="text-xs font-semibold text-violet-600">Edit</button>
            )}
          </div>
          <div className="p-4">
            {mobileItems.length === 0 ? (
              <button onClick={() => { refreshMobileDraft(); navigate('/rep/quotations/new/products'); }}
                className="w-full py-10 border-2 border-dashed border-slate-200 rounded-xl hover:border-violet-400 hover:bg-violet-50/30 transition group text-center">
                <Package className="w-8 h-8 mx-auto text-slate-300 group-hover:text-violet-500 mb-2" />
                <p className="text-sm font-bold text-slate-500 group-hover:text-violet-600">Add Products</p>
              </button>
            ) : (
              <div className="space-y-3">
                {mobileItems.map(item => {
                  const displayPrice = isMobileNonTax ? (item.totalAmount || item.price) : item.price;
                  return (
                    <div key={item.productId} className="p-3 bg-slate-50 rounded-xl space-y-2">
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-900 break-words leading-snug">{item.name}</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">{item.sku} · {formatCurrency(displayPrice)} × {item.quantity}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-bold text-slate-900">{formatCurrency(displayPrice * item.quantity)}</p>
                        </div>
                        <button onClick={() => { quotationDraftUtils.removeItem(item.productId); refreshMobileDraft(); }}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 transition shrink-0">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      {/* Request price display */}
                      {item.requestPrice != null && (
                        <div className="flex items-center gap-1.5 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
                          <Tag className="w-3 h-3" />
                          <span>Request price: {formatCurrency(item.requestPrice)}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
                <button onClick={() => { refreshMobileDraft(); navigate('/rep/quotations/new/products'); }}
                  className="w-full py-2.5 border border-violet-200 text-violet-600 font-semibold rounded-xl text-xs hover:bg-violet-50 transition">
                  + Add / Edit Products
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Quotation Notes */}
        {mobileCustomerId && mobileItems.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center">
                  <MessageSquare className="w-4 h-4 text-violet-600" />
                </div>
                <div>
                  <span className="text-sm font-bold text-slate-900">Quotation Notes</span>
                  <span className="text-xs text-slate-400 ml-2">Optional</span>
                </div>
              </div>
            </div>
            <div className="p-4">
              <textarea value={mobileNotes} onChange={e => setMobileNotes(e.target.value)} rows={3}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm resize-none placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400"
                placeholder="Add any comments or special instructions..." />
            </div>
          </div>
        )}

        {/* Summary */}
        {mobileItems.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2.5">
            <div className="flex justify-between text-sm text-slate-500">
              <span>Items</span><span className="font-semibold text-slate-700">{mobileItems.length} product{mobileItems.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="flex justify-between items-center border-t border-slate-100 pt-2.5">
              <span className="font-bold text-slate-900">Estimated Total</span>
              <span className="text-xl font-bold text-violet-600">{formatCurrency(mobileTotal)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Mobile Bottom Bar */}
      {mobileItems.length > 0 && (
        <div className="fixed left-0 right-0 bottom-[calc(env(safe-area-inset-bottom,0px)+70px)] z-40 px-3">
          <div className="max-w-2xl mx-auto">
            <button onClick={() => mobileMut.mutate()}
              disabled={mobileMut.isPending || !mobileCustomerId || mobileItems.length === 0}
              className="w-full bg-violet-600 text-white rounded-2xl shadow-xl shadow-violet-600/30 p-4 flex items-center gap-3 disabled:opacity-50 active:scale-[0.98] transition">
              <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className="text-[10px] font-semibold text-violet-100 uppercase tracking-wider">{mobileItems.length} Item{mobileItems.length !== 1 ? 's' : ''}</p>
                <p className="text-base font-bold">{formatCurrency(mobileTotal)}</p>
              </div>
              <span className="px-5 py-2.5 bg-white text-violet-700 rounded-xl text-sm font-bold shrink-0">
                {mobileMut.isPending ? 'Sending...' : 'Send Quotation'}
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
