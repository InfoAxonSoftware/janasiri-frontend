import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import type { CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { useSelector, useDispatch } from 'react-redux';
import { useSearchParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { productsApi } from '../../services/api/productsApi';
import { customersApi } from '../../services/api/customersApi';
import { addToCart, updateQuantity, removeFromCart, clearCart } from '../../store/slices/cartSlice';
import type { RootState } from '../../store/store';
import { ChevronDown, Package, Store, Trash2, ShoppingCart } from 'lucide-react';
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

  // Auto-resize textarea based on content length
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
      if (
        containerRef.current?.contains(target) ||
        dropdownRef.current?.contains(target)
      ) {
        return;
      }
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
export default function CustomerProducts() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState('');

  interface QuickRow { id: string; product?: Product; qty: number; }

  const savedQuick = typeof window !== 'undefined' ? localStorage.getItem('quickRows') : null;
  const initialQuick: QuickRow[] = savedQuick ? JSON.parse(savedQuick) : [{ id: crypto.randomUUID(), qty: 1 }];
  const [quickRows, setQuickRows] = useState<QuickRow[]>(initialQuick);
  const [rowSearches, setRowSearches] = useState<Record<string, string>>({});
  const [qtyInputs, setQtyInputs] = useState<Record<string, string>>({});

  const addQuickRow = () => setQuickRows(r => [...r, { id: crypto.randomUUID(), qty: 1 }]);
  const setRowSearch = (id: string, value: string) => setRowSearches(cur => ({ ...cur, [id]: value }));

  const updateQuickRow = (id: string, changes: Partial<QuickRow>) =>
    setQuickRows(r => {
      if (changes.product) {
        const dup = r.some(row => row.id !== id && row.product?.id === changes.product?.id);
        if (dup) { toast.error('This product is already selected in another row'); return r; }
      }
      const next = r.map(row => row.id === id ? { ...row, ...changes } : row);
      if (changes.product) setRowSearch(id, changes.product.name);
      return next;
    });

  const removeQuickRow = (id: string) =>
    setQuickRows(r => {
      const next = r.filter(row => row.id !== id);
      return next.length ? next : [{ id: crypto.randomUUID(), qty: 1 }];
    });

  useEffect(() => { localStorage.setItem('quickRows', JSON.stringify(quickRows)); }, [quickRows]);

  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [brandFilter, setBrandFilter] = useState('');
  const [minPriceFilter, setMinPriceFilter] = useState<number | ''>('');
  const [maxPriceFilter, setMaxPriceFilter] = useState<number | ''>('');
  const [sortBy, setSortBy] = useState('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [productPickerSearch, setProductPickerSearch] = useState('');

  useEffect(() => {
    const category = searchParams.get('category');
    const searchQuery = searchParams.get('search');
    if (category) setCategoryFilter(category);
    if (searchQuery) setSearch(searchQuery);
  }, [searchParams]);

  const dispatch = useDispatch();
  const cartItems = useSelector((state: RootState) => state.cart.items);

  const getCartQty = useCallback(
    (productId: string) => cartItems.find(i => i.productId === productId)?.quantity ?? 0,
    [cartItems]
  );

  const cartCount = cartItems.reduce((s, i) => s + i.quantity, 0);

  const getBaseRate = (p: Product) => (p.sellingPrice || 0) + (p.discountAmount || 0);

  const getCalcInput = (p: Product) => {
    const isSpecialPrice = p.discountPercent == null && (p.discountAmount || 0) > 0;
    const rate = isSpecialPrice ? (p.sellingPrice || 0) : getBaseRate(p);
    const discountPercent = isSpecialPrice ? 0 : (p.discountPercent ?? 0);
    const taxAmount = p.taxAmount ?? 0;
    return { rate, discountPercent, taxAmount, isSpecialPrice };
  };

  const quickCount = quickRows.filter(r => !!r.product).length;

  useEffect(() => { if (quickCount === 0) dispatch(clearCart()); }, [quickCount, dispatch]);

  useEffect(() => {
    if (quickCount > 0 && cartCount === 0) {
      dispatch(clearCart());
      quickRows.forEach(r => {
        if (!r.product) return;
        const prod = r.product;
        const pricing = getCalcInput(prod);
        let taxRate = 0;
        if (pricing.taxAmount != null) {
          const base = pricing.rate * (1 - pricing.discountPercent / 100);
          if (base > 0) taxRate = pricing.taxAmount / base;
        }
        const calc = calculateLine({ rate: pricing.rate, qty: r.qty, discountPercent: pricing.discountPercent, taxAmount: pricing.taxAmount });
        dispatch(addToCart({ lineId: r.id, productId: prod.id, productName: prod.name, unitPrice: pricing.rate, quantity: r.qty, sku: prod.sku, discountPercent: pricing.discountPercent, taxRate, allIncPrice: prod.totalAmount || undefined, lineTotal: calc.total }));
      });
    }
  }, [quickCount, cartCount, quickRows, dispatch]);

  const { data: customerProfile, isLoading: isProfileLoading } = useQuery({
    queryKey: ['customer-profile-for-order-table-tax-mode'],
    queryFn: () => customersApi.customerGetProfile().then(r => r.data.data),
    staleTime: 5 * 60 * 1000,
  });

  const isNonTaxCustomer =
    (customerProfile?.customerType || '').toLowerCase().replace(/[-\s]/g, '') === 'nontax';

  const totalGrossAmount = quickRows.reduce((total, r) => {
    if (!r.product) return total;
    const pricing = getCalcInput(r.product);
    const rowBase = pricing.rate * r.qty;
    const lineTaxRate = taxCodeToRate(r.product.taxCode);
    const nonTaxLineGross = r.product.totalAmount ? r.product.totalAmount * r.qty : rowBase * (1 + lineTaxRate);
    return total + (isNonTaxCustomer ? nonTaxLineGross : rowBase);
  }, 0);

  // Per-line tax using taxCode rate: lineTax = lineNet × taxCodeToRate(taxCode)
  const totalTaxAmount = quickRows.reduce((total, r) => {
    if (!r.product || isNonTaxCustomer) return total;
    const pricing = getCalcInput(r.product);
    const taxRate = taxCodeToRate(r.product.taxCode);
    const rowGross = pricing.rate * r.qty;
    const rowDiscount = rowGross * (pricing.discountPercent / 100);
    const rowNet = rowGross - rowDiscount;
    return total + rowNet * taxRate;
  }, 0);

  const totalDiscountAmount = quickRows.reduce((total, r) => {
    if (!r.product) return total;
    const prod = r.product;
    const pricing = getCalcInput(prod);
    if (pricing.isSpecialPrice) return total;
    const rowTaxRate = taxCodeToRate(prod.taxCode);
    const allIncRate = prod.totalAmount || Math.round(pricing.rate * (1 + rowTaxRate) * 100) / 100;
    return total + (isNonTaxCustomer ? allIncRate * r.qty * pricing.discountPercent / 100 : (prod.discountAmount || 0) * r.qty);
  }, 0);

  const finalAmount = isNonTaxCustomer
    ? totalGrossAmount - totalDiscountAmount
    : totalGrossAmount + totalTaxAmount - totalDiscountAmount;

  const netAmount = totalGrossAmount - totalDiscountAmount;
  // Always use "Total Tax Amount" — covers mixed tax codes (V18, V15, NV, etc.)

  const { data: allProducts = [], isLoading } = useQuery({
    queryKey: ['customer-products-all-for-order', search, categoryFilter, brandFilter, minPriceFilter, maxPriceFilter, sortBy, sortDir],
    queryFn: () =>
      productsApi.customerCatalogAll({
        search: search || undefined,
        categoryId: categoryFilter || undefined,
        brand: brandFilter || undefined,
        minPrice: minPriceFilter || undefined,
        maxPrice: maxPriceFilter || undefined,
        sortBy, sortDir,
      }),
  });

  useEffect(() => {
    if (quickRows.length && quickRows[quickRows.length - 1].product) addQuickRow();
  }, [quickRows]);

  const filteredProducts = useMemo(() => {
    const searchTerm = productPickerSearch.trim().toLowerCase();
    const base = Array.isArray(allProducts) ? allProducts : [];
    if (!searchTerm) return [...base].sort((a, b) => a.name.localeCompare(b.name));
    return base
      .filter(p => p.name.toLowerCase().includes(searchTerm) || (p.sku || '').toLowerCase().includes(searchTerm))
      .sort((a, b) => {
        const aS = a.name.toLowerCase().startsWith(searchTerm) ? 0 : 1;
        const bS = b.name.toLowerCase().startsWith(searchTerm) ? 0 : 1;
        return aS - bS || a.name.localeCompare(b.name);
      });
  }, [allProducts, productPickerSearch]);

  const handleIncrement = (product: Product) => {
    const qty = getCartQty(product.id);
    const pricing = getCalcInput(product);
    const taxRate = taxCodeToRate(product.taxCode);
    if (qty === 0) {
      const calc = calculateLine({ rate: pricing.rate, qty: 1, discountPercent: pricing.discountPercent, taxAmount: pricing.taxAmount });
      dispatch(addToCart({ lineId: crypto.randomUUID(), productId: product.id, productName: product.name, unitPrice: pricing.rate, quantity: 1, sku: product.sku, discountPercent: pricing.discountPercent, taxCode: product.taxCode, taxRate, allIncPrice: product.totalAmount || undefined, lineTotal: calc.total }));
    } else {
      dispatch(updateQuantity({ productId: product.id, quantity: qty + 1 }));
    }
  };

  const handleDecrement = (product: Product) => {
    const qty = getCartQty(product.id);
    if (qty <= 1) dispatch(removeFromCart({ productId: product.id }));
    else dispatch(updateQuantity({ productId: product.id, quantity: qty - 1 }));
  };

  const goToCreateOrder = () => {
    dispatch(clearCart());
    quickRows.forEach(r => {
      if (!r.product) return;
      const prod = r.product;
      const pricing = getCalcInput(prod);
      const taxRate = taxCodeToRate(prod.taxCode);
      const calc = calculateLine({ rate: pricing.rate, qty: r.qty, discountPercent: pricing.discountPercent, taxAmount: pricing.taxAmount });
      dispatch(addToCart({ productId: prod.id, productName: prod.name, unitPrice: pricing.rate, quantity: r.qty, sku: prod.sku, discountPercent: pricing.discountPercent, taxCode: prod.taxCode, taxRate, allIncPrice: prod.totalAmount || undefined, lineTotal: calc.total }));
    });
    navigate('/shop/checkout');
  };

  if (isProfileLoading || !customerProfile) {
    return (
      <div className="flex items-center justify-center min-h-[300px] text-slate-500 font-medium">
        Loading customer profile...
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-5 lg:space-y-6 pb-20">
      {/* Page Header */}
      <div className="flex items-center justify-between gap-3 px-4 lg:px-0 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Create New Order</h1>
          <p className="text-sm text-slate-500 mt-1">Select products using the table below to add to your cart.</p>
        </div>
      </div>

      <div className="px-4 lg:px-0">
        <div className="overflow-visible space-y-5">

          {/* Table Container */}
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
                    <th className="text-center px-4 py-3 font-semibold text-xs uppercase tracking-wider whitespace-nowrap w-[60px]">Action</th>
                  </tr>
                </thead>

                <tbody>
                  {quickRows.map((row, rowIndex) => {
                    const prod = row.product;
                    const selectedProductIds = new Set(
                      quickRows.filter(r => r.id !== row.id && r.product).map(r => r.product!.id)
                    );

                    let rate = 0, discPct = 0, discAmt = 0, taxAmt = 0, grossAmount = 0;
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
                      <tr
                        key={row.id}
                        className="border-b border-slate-100 hover:bg-slate-50/60 transition-colors"
                      >
                        {/* # */}
                        <td className="px-4 py-2.5 text-center text-slate-400 border-r border-slate-100">
                          {rowIndex + 1}
                        </td>

                        {/* Item Description (product dropdown) */}
                        <td className="px-3 py-2 min-w-[220px] border-r border-slate-100">
                          <ProductDropdown
                            rowId={row.id}
                            value={rowSearches[row.id] !== undefined ? rowSearches[row.id] : (prod?.name || '')}
                            products={filteredProducts}
                            selectedProductIds={selectedProductIds}
                            currentProductId={prod?.id}
                            onChange={val => {
                              setRowSearch(row.id, val);
                              if (!val.trim()) updateQuickRow(row.id, { product: undefined });
                            }}
                            onSelect={selectedProduct => {
                              updateQuickRow(row.id, { product: selectedProduct, qty: 1 });
                              if (quickRows[quickRows.length - 1].id === row.id) addQuickRow();
                            }}
                          />
                        </td>

                        {/* Item Code (SKU) */}
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
                              if (!isNaN(parsed) && parsed >= 1) updateQuickRow(row.id, { qty: parsed });
                            }}
                            onBlur={e => {
                              const parsed = parseInt(e.target.value);
                              const safe = isNaN(parsed) || parsed < 1 ? 1 : parsed;
                              updateQuickRow(row.id, { qty: safe });
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

                        {/* Tax code — tax customers only */}
                        {!isNonTaxCustomer && (
                          <td className="px-4 py-2.5 text-center text-slate-600 whitespace-nowrap border-r border-slate-100">
                            {prod?.taxCode || <span className="text-slate-300">—</span>}
                          </td>
                        )}

                        {/* Line Gross */}
                        <td className="px-4 py-2.5 text-right font-semibold text-slate-900 whitespace-nowrap border-r border-slate-100">
                          {prod ? formatCurrency(grossAmount) : <span className="text-slate-300">—</span>}
                        </td>

                        {/* Delete */}
                        <td className="px-3 py-2.5 text-center">
                          <button
                            onClick={() => removeQuickRow(row.id)}
                            title="Remove item"
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

          {/* Order Summary (Right Aligned) */}
          <div className="flex justify-end mt-4">
            <div className="w-full md:w-[480px] bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-3">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Order Summary</p>
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Gross Amount</span>
                <span className="text-sm font-bold text-slate-800">{formatCurrency(totalGrossAmount)}</span>
              </div>
              <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                <span className="text-xs font-bold text-orange-500 uppercase tracking-wider">Discount Amount</span>
                <span className="text-sm font-bold text-orange-500">-{formatCurrency(totalDiscountAmount)}</span>
              </div>
              {!isNonTaxCustomer && (
                <>
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Net Amount</span>
                    <span className="text-sm font-bold text-slate-800">{formatCurrency(netAmount)}</span>
                  </div>
                  <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Tax Amount</span>
                    <span className="text-sm font-bold text-slate-800">{formatCurrency(totalTaxAmount)}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between items-center pt-1">
                <span className="text-sm font-black text-slate-900 uppercase tracking-wider">Total Invoice Value</span>
                <span className="text-2xl font-black text-orange-600">{formatCurrency(finalAmount)}</span>
              </div>
              <button
                onClick={goToCreateOrder}
                disabled={quickCount === 0}
                className="w-full mt-2 flex items-center justify-center gap-2 px-4 py-3 bg-orange-600 text-white rounded-xl text-sm font-bold hover:bg-orange-700 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm shadow-orange-200"
              >
                <ShoppingCart className="w-4 h-4" />
                Checkout
              </button>
            </div>
          </div>

        </div>

        {/* Loading Skeleton */}
        {isLoading && (
          <div className="mt-5 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-6 py-5 border-b border-slate-100 last:border-b-0 animate-pulse">
                <div className="flex-1 space-y-2.5">
                  <div className="h-4 bg-slate-200 rounded-full w-2/5" />
                  <div className="h-2.5 bg-slate-100 rounded-full w-1/4" />
                </div>
                <div className="h-5 bg-slate-200 rounded-full w-20" />
                <div className="h-10 bg-slate-100 rounded-xl w-28" />
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !allProducts.length && (
          <div className="text-center py-24 mt-5 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="w-20 h-20 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
              <Package className="w-10 h-10 text-slate-300" />
            </div>
            <h3 className="font-bold text-slate-900 text-lg mb-1">No products available</h3>
            <p className="text-sm text-slate-500 font-medium">Please check back later or adjust your search.</p>
          </div>
        )}
      </div>
    </div>
  );
}