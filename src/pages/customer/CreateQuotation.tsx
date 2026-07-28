import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import type { CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

import type { RootState } from '../../store/store';
import { productsApi } from '../../services/api/productsApi';
import { customersApi } from '../../services/api/customersApi';
import { customerCreateQuotation } from '../../services/api/quotationApi';
import { ChevronDown, Package, FileText, Trash2, Loader2 } from 'lucide-react';
import type { Product } from '../../types/product.types';
import { formatCurrency } from '../../utils/formatters';
import { calculateLine, taxCodeToRate } from '../../utils/calculations';

/* ─────────────────────────────────────────────
   Modern Product Dropdown Component (Orange Theme)
───────────────────────────────────────────── */
interface ProductDropdownProps {
  rowId: string;
  value: string;
  products: Product[];
  selectedProductIds: Set<string>;
  currentProductId?: string;
  onSelect: (product: Product) => void;
  onChange: (value: string) => void;
}

function ProductDropdown({
  rowId,
  value,
  products,
  selectedProductIds,
  currentProductId,
  onSelect,
  onChange,
}: ProductDropdownProps) {
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const [dropUp, setDropUp] = useState(false);
  const [floatingStyle, setFloatingStyle] = useState<CSSProperties>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [visibleCount, setVisibleCount] = useState(60);

  useEffect(() => {
    setVisibleCount(60);
  }, [value, products.length, currentProductId]);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = inputRef.current.scrollHeight + 'px';
    }
  }, [value]);

  const filtered = useMemo(() => {
    const q = value.trim().toLowerCase();
    const base = products.filter(
      (p) => !selectedProductIds.has(p.id) || p.id === currentProductId
    );
    if (!q) return base;
    return base
      .filter((p) => p.name.toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q))
      .sort((a, b) => {
        const aS = a.name.toLowerCase().startsWith(q) ? 0 : 1;
        const bS = b.name.toLowerCase().startsWith(q) ? 0 : 1;
        return aS - bS || a.name.localeCompare(b.name);
      });
  }, [products, value, selectedProductIds, currentProductId]);

  const visibleItems = filtered.slice(0, visibleCount);

  const updatePosition = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const buffer = 12;
    const dropdownMaxHeight = 320;
    const availableBelow = window.innerHeight - rect.bottom - buffer;
    const availableAbove = rect.top - buffer;

    const shouldDropUp = availableBelow < 220 && availableAbove > availableBelow;
    setDropUp(shouldDropUp);

    const top = shouldDropUp ? rect.top - (dropdownMaxHeight <= availableAbove ? dropdownMaxHeight : availableAbove) : rect.bottom + 8;
    const maxHeight = shouldDropUp ? Math.min(dropdownMaxHeight, availableAbove) : Math.min(dropdownMaxHeight, availableBelow);

    setFloatingStyle({
      position: 'fixed',
      left: rect.left,
      width: rect.width,
      top: shouldDropUp ? undefined : top,
      bottom: shouldDropUp ? window.innerHeight - rect.top + 8 : undefined,
      maxHeight,
      zIndex: 9999,
    });
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (containerRef.current?.contains(target) || dropdownRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!listRef.current) return;
    const item = listRef.current.children[highlighted] as HTMLElement | undefined;
    item?.scrollIntoView({ block: 'nearest' });
  }, [highlighted]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) { setOpen(true); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlighted(h => Math.min(h + 1, filtered.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlighted(h => Math.max(h - 1, 0)); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[highlighted]) { onSelect(filtered[highlighted]); setOpen(false); }
    } else if (e.key === 'Escape') { setOpen(false); }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div className={`relative flex items-center bg-transparent rounded-xl transition-all ${open ? 'ring-2 ring-orange-500/20 bg-white' : 'hover:bg-slate-50'}`}>
        <textarea
          ref={inputRef}
          rows={1}
          value={value}
          placeholder="Search product..."
          onChange={e => { onChange(e.target.value); setOpen(true); setHighlighted(0); }}
          onFocus={() => { setOpen(true); setHighlighted(0); }}
          onKeyDown={handleKeyDown}
          className="w-full pl-3 pr-8 py-2.5 text-sm font-bold text-slate-800 bg-transparent border-transparent focus:outline-none focus:ring-0 focus:border-transparent resize-none overflow-hidden placeholder-slate-400 break-words"
          style={{ minHeight: '40px' }}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => { setOpen(o => !o); inputRef.current?.focus(); }}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition"
        >
          <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${open ? 'rotate-180 text-orange-500' : ''}`} />
        </button>
      </div>

      {open && createPortal(
        <div
          ref={dropdownRef}
          className="w-full max-w-full rounded-2xl overflow-hidden overflow-x-hidden bg-white border border-slate-200 animate-fade-in"
          style={{
            ...floatingStyle,
            boxShadow: '0 10px 40px -10px rgba(0,0,0,0.15)',
          }}
        >
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Select Product</span>
            <span className="text-[10px] text-slate-400 font-bold bg-white px-2 py-0.5 rounded-full border border-slate-200">{filtered.length} found</span>
          </div>

          {filtered.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <Package className="w-8 h-8 text-slate-200 mx-auto mb-3" />
              <p className="text-sm text-slate-700 font-bold">No products found</p>
              <p className="text-xs text-slate-500 mt-1">Try a different keyword</p>
            </div>
          ) : (
            <ul
              ref={listRef}
              className="max-h-60 overflow-y-auto overflow-x-hidden overscroll-contain"
              style={{ scrollbarWidth: 'thin' }}
              onScroll={(e) => {
                const t = e.target as HTMLElement;
                if (t.scrollHeight - t.scrollTop - t.clientHeight < 36 && visibleCount < filtered.length) {
                  setVisibleCount(prev => Math.min(prev + 50, filtered.length));
                }
              }}
            >
              {visibleItems.map((p, i) => (
                <li
                  key={p.id}
                  onMouseDown={e => { e.preventDefault(); onSelect(p); setOpen(false); }}
                  onMouseEnter={() => setHighlighted(i)}
                  className={`px-4 py-3 cursor-pointer border-b border-slate-50 last:border-b-0 transition-all duration-100 ${
                    i === highlighted
                      ? 'bg-orange-50/50 border-l-[3px] border-l-orange-500'
                      : 'border-l-[3px] border-l-transparent hover:bg-slate-50'
                  }`}
                >
                  <p className={`text-sm font-bold leading-snug break-words ${i === highlighted ? 'text-orange-900' : 'text-slate-800'}`} style={{ whiteSpace: 'normal' }}>
                    {p.name}
                  </p>
                </li>
              ))}
            </ul>
          )}

          <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 flex items-center gap-4">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1"><span>↑↓</span> Navigate</span>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1"><span>↵</span> Select</span>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1"><span>ESC</span> Close</span>
          </div>
        </div>
      , document.body)}
    </div>
  );
}

/* ─────────────────────────────────────────────
   Main Component
───────────────────────────────────────────── */
type QuotationRow = {
  id: string;
  product?: Product;
  qty: number;
  requestPrice?: number;
};

export default function CustomerCreateQuotation() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useSelector((state: RootState) => state.auth);

  const [notes, setNotes] = useState('');
  const [quotationRows, setQuotationRows] = useState<QuotationRow[]>([{ id: crypto.randomUUID(), qty: 1 }]);
  const [rowSearches, setRowSearches] = useState<Record<string, string>>({});
  const [qtyInputs, setQtyInputs] = useState<Record<string, string>>({});

  const { data: productsData, isLoading: isProductsLoading } = useQuery({
    queryKey: ['customer-products-for-quotation-create'],
    queryFn: () => productsApi.getAllForSelection(),
  });

  const { data: customerProfile, isLoading: isProfileLoading } = useQuery({
    queryKey: ['customer-profile-for-quotation-create'],
    queryFn: () => customersApi.customerGetProfile().then((r) => r.data.data),
    staleTime: 5 * 60 * 1000,
  });

  const isTaxCustomer = ((customerProfile?.customerType || '').toLowerCase().replace(/[-\s]/g, '') === 'tax');
  const isNonTaxCustomer = !isTaxCustomer;

  const allProducts = Array.isArray(productsData) ? productsData : [];

  const addQuotationRow = () => setQuotationRows(r => [...r, { id: crypto.randomUUID(), qty: 1 }]);
  const setRowSearch = (id: string, value: string) => setRowSearches(cur => ({ ...cur, [id]: value }));

  const updateQuotationRow = (id: string, changes: Partial<QuotationRow>) => {
    setQuotationRows(r => {
      if (changes.product) {
        const dup = r.some(row => row.id !== id && row.product?.id === changes.product?.id);
        if (dup) { toast.error('This product is already selected in another row'); return r; }
      }
      const next = r.map(row => row.id === id ? { ...row, ...changes } : row);
      if (changes.product) setRowSearch(id, changes.product.name);
      return next;
    });
  };

  const removeQuotationRow = (id: string) => {
    setQuotationRows(r => {
      const next = r.filter(row => row.id !== id);
      return next.length ? next : [{ id: crypto.randomUUID(), qty: 1 }];
    });
  };

  useEffect(() => {
    if (quotationRows.length && quotationRows[quotationRows.length - 1].product) addQuotationRow();
  }, [quotationRows]);

  function getCalcInput(product: Product) {
    const isSpecialPrice = product.discountPercent == null && (product.discountAmount || 0) > 0;
    const baseRate = (product.sellingPrice || 0) + (product.discountAmount || 0);
    const rate = isSpecialPrice ? (product.sellingPrice || 0) : baseRate;
    const discountPercent = isSpecialPrice ? 0 : (product.discountPercent ?? 0);
    const taxAmount = isNonTaxCustomer ? 0 : (product.taxAmount ?? 0);
    return { rate, discountPercent, taxAmount, isSpecialPrice };
  }

  const selectedRows = quotationRows.filter((r) => !!r.product);
  
  const quoteTotals = selectedRows.reduce(
    (acc, row) => {
      if (!row.product) return acc;
      const calcInput = getCalcInput(row.product);

      const rowGrossBase = calcInput.rate * row.qty;
      // Per-line tax using taxCode rate for accuracy across mixed tax brackets
      const rowTaxRate = taxCodeToRate(row.product.taxCode);
      const allIncRate = row.product.totalAmount || Math.round(calcInput.rate * (1 + rowTaxRate) * 100) / 100;
      const rowDiscount = isNonTaxCustomer ? allIncRate * row.qty * calcInput.discountPercent / 100 : (rowGrossBase * calcInput.discountPercent) / 100;
      const rowNet = rowGrossBase - rowGrossBase * (calcInput.discountPercent / 100);
      const rowTax = isNonTaxCustomer ? 0 : rowNet * rowTaxRate;
      const nonTaxGross = allIncRate * row.qty;
      const rowGross = isNonTaxCustomer ? nonTaxGross : rowGrossBase;

      return {
        totalItems: acc.totalItems + row.qty,
        totalGross: acc.totalGross + rowGross,
        totalDiscount: acc.totalDiscount + rowDiscount,
        totalTax: acc.totalTax + rowTax,
        totalAmount: acc.totalAmount + (isNonTaxCustomer ? rowGross - rowDiscount : rowNet + rowTax),
      };
    },
    { totalItems: 0, totalGross: 0, totalDiscount: 0, totalTax: 0, totalAmount: 0 }
  );

  const quoteNetAmount = quoteTotals.totalGross - quoteTotals.totalDiscount;

  const createMut = useMutation({
    mutationFn: () =>
      customerCreateQuotation({
        customerId: user?.id || '',
        notes: notes || undefined,
        items: selectedRows.map((r) => {
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
      toast.success('Quotation request submitted!');
      queryClient.invalidateQueries({ queryKey: ['customer-quotations'] });
      navigate('/shop/quotations');
    },
    onError: () => toast.error('Failed to submit quotation'),
  });

  if (isProfileLoading || isProductsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px] text-slate-500 font-medium gap-3">
        <Loader2 className="w-5 h-5 animate-spin" /> Loading data...
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-4 lg:space-y-6 pb-20">
      {/* Page Header */}
      <div className="flex items-center justify-between gap-3 px-4 lg:px-0">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Request Quotation</h1>
          <p className="text-sm text-slate-500 mt-1">Select items and optionally enter a request price per product.</p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <button
            onClick={() => navigate('/shop/quotations')}
            className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm font-bold shadow-sm hover:bg-slate-50 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={() => createMut.mutate()}
            disabled={selectedRows.length === 0 || createMut.isPending}
            className="px-4 py-2 bg-orange-600 text-white rounded-xl text-sm font-bold shadow-sm hover:bg-orange-700 active:scale-95 disabled:opacity-40 transition-all flex items-center gap-2"
          >
            {createMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Submit Quotation
          </button>
        </div>
      </div>

      <div className="px-4 lg:px-0">
        <div className="overflow-visible space-y-5">

          {/* Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-[12px] border-collapse">
                <thead>
                  <tr className="bg-slate-800 text-white">
                    <th className="text-center px-4 py-3 font-semibold text-xs uppercase tracking-wider border-r border-slate-600 w-10">#</th>
                    <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider border-r border-slate-600 min-w-[220px]">Item Description</th>
                    <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider border-r border-slate-600 whitespace-nowrap">Item Code</th>
                    <th className="text-center px-4 py-3 font-semibold text-xs uppercase tracking-wider border-r border-slate-600 whitespace-nowrap">Qty</th>
                    <th className="text-right px-4 py-3 font-semibold text-xs uppercase tracking-wider border-r border-slate-600 whitespace-nowrap">Rate</th>
                    <th className="text-right px-4 py-3 font-semibold text-xs uppercase tracking-wider border-r border-slate-600 whitespace-nowrap">Disc %</th>
                    <th className="text-right px-4 py-3 font-semibold text-xs uppercase tracking-wider border-r border-slate-600 whitespace-nowrap">Disc Amt</th>
                    {!isNonTaxCustomer && <th className="text-center px-4 py-3 font-semibold text-xs uppercase tracking-wider border-r border-slate-600 whitespace-nowrap">Tax</th>}
                    <th className="text-right px-4 py-3 font-semibold text-xs uppercase tracking-wider border-r border-slate-600 whitespace-nowrap">Line Gross</th>
                    <th className="text-right px-4 py-3 font-semibold text-xs uppercase tracking-wider border-r border-slate-600 whitespace-nowrap">Req. Price</th>
                    <th className="text-center px-4 py-3 font-semibold text-xs uppercase tracking-wider whitespace-nowrap w-[60px]">Action</th>
                  </tr>
                </thead>

                <tbody>
                  {quotationRows.map((row, rowIndex) => {
                    const prod = row.product;
                    const selectedProductIds = new Set(
                      quotationRows.filter(r => r.id !== row.id && r.product).map(r => r.product!.id)
                    );

                    let rate = 0, discPct = 0, discAmt = 0, grossAmount = 0;
                    if (prod) {
                      const pricing = getCalcInput(prod);
                      rate = pricing.rate;
                      discPct = pricing.discountPercent;
                      const lineTaxRate = taxCodeToRate(prod.taxCode);
                      const allIncRate = prod.totalAmount || Math.round(rate * (1 + lineTaxRate) * 100) / 100;
                      discAmt = pricing.isSpecialPrice ? 0 : (isNonTaxCustomer ? allIncRate * row.qty * discPct / 100 : (prod.discountAmount || 0));
                      const baseAmount = rate * row.qty;
                      grossAmount = isNonTaxCustomer ? allIncRate * row.qty : baseAmount;
                    }

                    return (
                      <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50/60 transition-colors">

                        {/* # */}
                        <td className="px-4 py-2.5 text-center text-slate-400 border-r border-slate-100">
                          {rowIndex + 1}
                        </td>

                        {/* Item Description */}
                        <td className="px-3 py-2 min-w-[220px] border-r border-slate-100">
                          <ProductDropdown
                            rowId={row.id}
                            value={rowSearches[row.id] !== undefined ? rowSearches[row.id] : (prod?.name || '')}
                            products={allProducts}
                            selectedProductIds={selectedProductIds}
                            currentProductId={prod?.id}
                            onChange={val => {
                              setRowSearch(row.id, val);
                              if (!val.trim()) updateQuotationRow(row.id, { product: undefined });
                            }}
                            onSelect={selectedProduct => {
                              updateQuotationRow(row.id, { product: selectedProduct, qty: 1, requestPrice: undefined });
                              if (quotationRows[quotationRows.length - 1].id === row.id) addQuotationRow();
                            }}
                          />
                        </td>

                        {/* Item Code */}
                        <td className="px-4 py-2.5 font-mono text-slate-600 whitespace-nowrap border-r border-slate-100">
                          {prod?.sku || <span className="text-slate-300">—</span>}
                        </td>

                        {/* Qty */}
                        <td className="px-3 py-2 text-center border-r border-slate-100">
                          <input
                            type="number" min={1}
                            value={qtyInputs[row.id] !== undefined ? qtyInputs[row.id] : String(row.qty)}
                            disabled={!prod}
                            onChange={e => {
                              const raw = e.target.value;
                              setQtyInputs(cur => ({ ...cur, [row.id]: raw }));
                              const parsed = parseInt(raw);
                              if (!isNaN(parsed) && parsed >= 1) updateQuotationRow(row.id, { qty: parsed });
                            }}
                            onBlur={e => {
                              const parsed = parseInt(e.target.value);
                              const safe = isNaN(parsed) || parsed < 1 ? 1 : parsed;
                              updateQuotationRow(row.id, { qty: safe });
                              setQtyInputs(cur => { const n = { ...cur }; delete n[row.id]; return n; });
                            }}
                            className="w-14 text-center font-bold text-[12px] text-slate-900 bg-white border border-slate-200 rounded-lg py-1.5 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 disabled:opacity-40 disabled:bg-slate-50 transition-all no-number-spin"
                          />
                        </td>

                        {/* Rate */}
                        <td className="px-4 py-2.5 text-right text-slate-700 whitespace-nowrap border-r border-slate-100">
                          {prod ? formatCurrency(isNonTaxCustomer ? (prod.totalAmount || rate * (1 + taxCodeToRate(prod.taxCode))) : rate) : <span className="text-slate-300">—</span>}
                        </td>

                        {/* Disc % */}
                        <td className="px-4 py-2.5 text-right font-semibold text-emerald-600 whitespace-nowrap border-r border-slate-100">
                          {prod && discPct > 0 ? `${discPct}%` : <span className="text-slate-300">—</span>}
                        </td>

                        {/* Disc Amt */}
                        <td className="px-4 py-2.5 text-right font-semibold text-emerald-600 whitespace-nowrap border-r border-slate-100">
                          {prod && discAmt > 0 ? formatCurrency(discAmt) : <span className="text-slate-300">—</span>}
                        </td>

                        {/* Tax — tax customers only */}
                        {!isNonTaxCustomer && (
                          <td className="px-4 py-2.5 text-center text-slate-600 whitespace-nowrap border-r border-slate-100">
                            {prod?.taxCode || <span className="text-slate-300">—</span>}
                          </td>
                        )}

                        {/* Line Gross */}
                        <td className="px-4 py-2.5 text-right font-semibold text-slate-900 whitespace-nowrap border-r border-slate-100">
                          {prod ? formatCurrency(grossAmount) : <span className="text-slate-300">—</span>}
                        </td>

                        {/* Req. Price */}
                        <td className="px-4 py-2.5 text-right border-r border-slate-100">
                          {prod ? (
                            <input
                              type="number"
                              min={0}
                              step="any"
                              value={row.requestPrice ?? ''}
                              onChange={e => {
                                const val = e.target.value;
                                updateQuotationRow(row.id, { requestPrice: val === '' ? undefined : Number(val) });
                              }}
                              placeholder="Optional"
                              className="w-24 text-right font-semibold text-[12px] text-orange-600 bg-white border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 placeholder-slate-300 transition-all [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                            />
                          ) : <span className="text-slate-300">—</span>}
                        </td>

                        {/* Delete */}
                        <td className="px-3 py-2.5 text-center">
                          <button
                            onClick={() => removeQuotationRow(row.id)}
                            title="Remove row"
                            className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all mx-auto"
                          >
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

          {/* Bottom: Notes + Summary */}
          <div className="flex flex-col md:flex-row justify-between gap-6 mt-2">

            {/* Notes */}
            <div className="flex-1 max-w-lg space-y-2">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest">
                Notes <span className="text-slate-300 normal-case font-normal">(Optional)</span>
              </label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={4}
                placeholder="Add any special requests or notes here..."
                className="w-full px-4 py-3 border border-slate-200 bg-white rounded-xl text-sm resize-none shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-300 transition-all"
              />
            </div>

            {/* Order Summary */}
            <div className="w-full md:w-[480px] bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-3 h-fit">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Quotation Summary</p>
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Items</span>
                <span className="text-sm font-bold text-slate-800">{quoteTotals.totalItems}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Gross Amount</span>
                <span className="text-sm font-bold text-slate-800">{formatCurrency(quoteTotals.totalGross)}</span>
              </div>
              <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                <span className="text-xs font-bold text-orange-500 uppercase tracking-wider">Discount Amount</span>
                <span className="text-sm font-bold text-orange-500">-{formatCurrency(quoteTotals.totalDiscount)}</span>
              </div>
              {!isNonTaxCustomer && (
                <>
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Net Amount</span>
                    <span className="text-sm font-bold text-slate-800">{formatCurrency(quoteNetAmount)}</span>
                  </div>
                  <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Tax Amount</span>
                    <span className="text-sm font-bold text-slate-800">{formatCurrency(quoteTotals.totalTax)}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between items-center pt-1">
                <span className="text-sm font-black text-slate-900 uppercase tracking-wider">Total Invoice Value</span>
                <span className="text-2xl font-black text-orange-600">{formatCurrency(quoteTotals.totalAmount)}</span>
              </div>
              <button
                onClick={() => createMut.mutate()}
                disabled={selectedRows.length === 0 || createMut.isPending}
                className="w-full mt-2 flex items-center justify-center gap-2 px-4 py-3 bg-orange-600 text-white rounded-xl text-sm font-bold hover:bg-orange-700 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm shadow-orange-200"
              >
                {createMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                Submit Quotation
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
