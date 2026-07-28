import { createPortal } from 'react-dom';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customersApi } from '../../services/api/customersApi';
import { productsApi } from '../../services/api/productsApi';
import type { PriceDetail } from '../../types/customer.types';
import type { Product } from '../../types/product.types';
import { formatCurrency } from '../../utils/formatters';
import { ArrowLeft, Save, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

type SpecialPriceRow = {
  id: string;
  product?: Product;
  productId?: string;
  productName?: string;
  search?: string;
  specialPrice: number | null;
  discountPercent: number | null;
  existing?: boolean;
};

export default function AdminCustomerSpecialPrices() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [rows, setRows] = useState<SpecialPriceRow[]>([{ id: crypto.randomUUID(), specialPrice: null, discountPercent: null }]);
  const [overrides, setOverrides] = useState<Record<string, { specialPrice?: number | null; discountPercent?: number | null }>>({});
  const [activeDropdown, setActiveDropdown] = useState<{ rowId: string; rect: DOMRect; query: string } | null>(null);
  const inputRefs = useRef<Record<string, HTMLInputElement>>({});
  const portalRef = useRef<HTMLDivElement | null>(null);

  const { data: productsData, isLoading: productsLoading, error: productsError } = useQuery<import('../../types/api.types').PagedResult<Product>>({
    queryKey: ['admin-products-special-prices'],
    queryFn: () => productsApi.getAll({ page: 1, pageSize: 1000 }).then(r => r.data.data),
    enabled: !!id,
  });

  const { data: priceDetails, isLoading: priceDetailsLoading, error: priceDetailsError } = useQuery<PriceDetail[]>({
    queryKey: ['admin-customer-special-prices', id],
    queryFn: () => customersApi.adminGetSpecialPrices(id!).then(r => r.data.data),
    enabled: !!id,
  });

  const createBlankRow = () => ({
    id: crypto.randomUUID(),
    search: '',
    specialPrice: null,
    discountPercent: null,
  } as SpecialPriceRow);

  const ensureBlankRow = (items: SpecialPriceRow[]) => {
    if (items.length === 0) return [createBlankRow()];
    const last = items[items.length - 1];
    if (!last.productId) return items;
    return [...items, createBlankRow()];
  };

  useEffect(() => {
    if (!productsData || !priceDetails) return;

    const nextOverrides: Record<string, { specialPrice?: number | null; discountPercent?: number | null }> = {};
    for (const pd of priceDetails) {
      if (pd.specialPrice == null && pd.discountPercent == null) continue;
      nextOverrides[pd.productId] = {
        specialPrice: pd.specialPrice ?? null,
        discountPercent: pd.discountPercent ?? null,
      };
    }

    setOverrides(nextOverrides);

    const productMap = new Map(productsData.items.map(p => [p.id, p]));
    const overrideRows: SpecialPriceRow[] = Object.entries(nextOverrides).map(([productId, override]) => {
      const product = productMap.get(productId);
      const fallbackName = priceDetails.find(p => p.productId === productId)?.productName;
      return {
        id: crypto.randomUUID(),
        product,
        productId,
        productName: product?.name ?? fallbackName,
        specialPrice: override.specialPrice ?? null,
        discountPercent: override.discountPercent ?? null,
        existing: true,
      };
    });

    setRows(ensureBlankRow(overrideRows));
  }, [priceDetails, productsData]);

  const queryClient = useQueryClient();
  const loading = productsLoading || priceDetailsLoading;
  const error = productsError || priceDetailsError;

  const availableProducts = useMemo(() => {
    const all = productsData?.items ?? [];
    const selectedIds = new Set(Object.keys(overrides));
    return all.filter(p => !selectedIds.has(p.id));
  }, [productsData, overrides]);

  const filteredProducts = useMemo(() => {
    if (!activeDropdown) return [];
    const query = activeDropdown.query.trim().toLowerCase();
    if (!query) return availableProducts.slice(0, 10);
    return availableProducts
      .filter(p =>
        p.name.toLowerCase().includes(query) ||
        (p.sku ?? '').toLowerCase().includes(query)
      )
      .slice(0, 10);
  }, [activeDropdown, availableProducts]);

  const dropdownStyle = activeDropdown?.rect
    ? {
        position: 'fixed' as const,
        left: activeDropdown.rect.left,
        top: activeDropdown.rect.bottom + 4,
        width: activeDropdown.rect.width,
      }
    : undefined;

  const handleSelectProduct = (rowId: string, productId: string) => {
    const product = productsData?.items.find(p => p.id === productId);
    if (!product) return;

    const defaultDiscount = product.discountPercent ?? (product.discountAmount != null && product.sellingPrice ? (product.discountAmount / product.sellingPrice) * 100 : null);

    setOverrides(prev => ({
      ...prev,
      [productId]: {
        specialPrice: prev[productId]?.specialPrice ?? null,
        discountPercent: prev[productId]?.discountPercent ?? defaultDiscount ?? null,
      },
    }));

    setRows(prev => {
      const next = prev.map(r => {
        if (r.id !== rowId) return r;
        return {
          ...r,
          product,
          productId,
          productName: product.name,
          search: '',
          specialPrice: overrides[productId]?.specialPrice ?? null,
          discountPercent: overrides[productId]?.discountPercent ?? defaultDiscount ?? null,
          existing: true,
        };
      });
      return ensureBlankRow(next);
    });

    setActiveDropdown(null);
  };

  const updateRow = (rowId: string, updates: Partial<SpecialPriceRow>) => {
    setRows(prev => {
      const next = prev.map(r => (r.id === rowId ? { ...r, ...updates } : r));

      const updatedRow = next.find(r => r.id === rowId);
      const productId = updatedRow?.productId;
      if (productId) {
        setOverrides(prevOverrides => {
          const current = prevOverrides[productId] ?? {};
          const nextOverride = {
            ...current,
            specialPrice: updates.specialPrice !== undefined ? updates.specialPrice : current.specialPrice,
            discountPercent: updates.discountPercent !== undefined ? updates.discountPercent : current.discountPercent,
          };

          if (nextOverride.specialPrice == null && nextOverride.discountPercent == null) {
            const { [productId]: _, ...rest } = prevOverrides;
            return rest;
          }

          return { ...prevOverrides, [productId]: nextOverride };
        });
      }

      return next;
    });

    if (activeDropdown?.rowId === rowId && updates.search != null) {
      setActiveDropdown(prev => prev ? { ...prev, query: updates.search ?? '' } : prev);
    }
  };

  const deleteRow = (rowId: string) => {
    setRows(prev => {
      const rowToDelete = prev.find(r => r.id === rowId);
      const next = prev.filter(r => r.id !== rowId);

      if (rowToDelete?.productId) {
        setOverrides(prevOverrides => {
          const { [rowToDelete.productId!]: _, ...rest } = prevOverrides;
          return rest;
        });
      }

      return ensureBlankRow(next);
    });

    // Persist deletion immediately to backend.
    const row = rows.find(r => r.id === rowId);
    if (row?.productId) {
      saveMut.mutate([{ productId: row.productId }]);
    }
  };

  const buildPayload = () => {
    const map = new Map<string, { specialPrice?: number | null; discountPercent?: number | null }>();

    Object.entries(overrides).forEach(([productId, override]) => {
      map.set(productId, { specialPrice: override.specialPrice, discountPercent: override.discountPercent });
    });

    return Array.from(map.entries()).map(([productId, override]) => ({
      productId,
      specialPrice: override.specialPrice ?? undefined,
      discountPercent: override.discountPercent ?? undefined,
    }));
  };

  useLayoutEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!activeDropdown) return;
      const input = inputRefs.current[activeDropdown.rowId];
      const portal = portalRef.current;
      if (portal && portal.contains(event.target as Node)) return;
      if (input && !input.contains(event.target as Node)) {
        setActiveDropdown(null);
      }
    };

    const handleResize = () => {
      if (!activeDropdown) return;
      const rect = inputRefs.current[activeDropdown.rowId]?.getBoundingClientRect();
      if (rect) setActiveDropdown(prev => prev ? { ...prev, rect } : prev);
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleResize, true);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleResize, true);
    };
  }, [activeDropdown]);

  const saveMut = useMutation({
    mutationFn: (payload: Array<{ productId: string; specialPrice?: number; discountPercent?: number }>) =>
      customersApi.adminSaveSpecialPrices(id!, payload),
    onSuccess: (_data, variables) => {
      toast.success('Special prices saved');

      // Keep UI synced with what was submitted until refetch completes.
      setOverrides(prev => {
        const next = { ...prev };
        variables.forEach(v => {
          const hasAny = v.specialPrice != null || v.discountPercent != null;
          if (hasAny) {
            next[v.productId] = { specialPrice: v.specialPrice ?? null, discountPercent: v.discountPercent ?? null };
          } else {
            delete next[v.productId];
          }
        });
        return next;
      });

      if (id) queryClient.invalidateQueries({ queryKey: ['admin-customer-special-prices', id] });
    },
    onError: (e: any) => {
      toast.error(e?.response?.data?.message || 'Failed to save');
    },
  });

  const handleSave = () => {
    const payload = buildPayload();
    saveMut.mutate(payload);
  };

  return (
    <div className="animate-fade-in space-y-5 pb-20">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-slate-100 transition">
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </button>
        <h1 className="text-2xl font-bold">Special Prices</h1>
        <button
          onClick={handleSave}
          disabled={saveMut.isPending}
          className="ml-auto inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          Save All
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="overflow-visible">
          <table className="w-full table-fixed text-sm">
            <colgroup>
              <col className="w-3/5" />
              <col className="w-24" />
              <col className="w-16" />
              <col className="w-28" />
              <col className="w-24" />
              <col className="w-28" />
              <col className="w-20" />
              <col className="w-28" />
              <col className="w-28" />
              <col className="w-32" />
              <col className="w-20" />
            </colgroup>
            <thead className="text-xs font-semibold text-slate-500 bg-slate-50">
              <tr>
                <th className="px-5 py-3 text-left">Description</th>
                <th className="px-5 py-3 text-left">Item</th>
                <th className="px-5 py-3 text-center">Qty</th>
                <th className="px-5 py-3 text-right">Rate</th>
                <th className="px-5 py-3 text-right">Disc %</th>
                <th className="px-5 py-3 text-right">Disc Amt</th>
                <th className="px-5 py-3 text-right">Tax</th>
                <th className="px-5 py-3 text-right">Tax Amt</th>
                <th className="px-5 py-3 text-right">Amount</th>
                <th className="px-5 py-3 text-right">Special Price</th>
                <th className="px-5 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={11} className="p-6 text-center text-slate-400">Loading…</td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={11} className="p-6 text-center text-red-500">Failed to load products. Please refresh.</td>
                </tr>
              ) : (
                rows.map(row => {
                  const product = row.product;
                  const hasProduct = !!product?.id;
                  const base = product?.sellingPrice ?? 0;
                  const sku = product?.sku;
                  const quantity = product?.quantity ?? 0;
                  const mrp = product?.mrp;
                  const taxCode = product?.taxCode;
                  const taxAmountFromProduct = product?.taxAmount;
                  const productName = hasProduct ? product.name : row.productName;

                  const hasOverride = row.specialPrice != null || row.discountPercent != null;

                  const discountAmount = row.discountPercent != null ? (base * row.discountPercent) / 100 : 0;
                  const baseAfterDiscount = base - discountAmount;
                  const taxRate = taxAmountFromProduct != null && baseAfterDiscount > 0 ? taxAmountFromProduct / baseAfterDiscount : 0;

                  const finalPrice = row.specialPrice != null
                    ? row.specialPrice
                    : row.discountPercent != null
                      ? baseAfterDiscount
                      : base;

                  const taxAmount = finalPrice * taxRate;
                  const amount = finalPrice + (taxAmount || 0);

                  return (
                    <tr key={row.id} className="border-t border-slate-100">
                      <td className="px-5 py-4 text-slate-800 truncate !overflow-visible relative">
                        {hasProduct || row.productName ? (
                          <span>{productName}</span>
                        ) : (
                          <input
                            placeholder="Search product"
                            ref={el => { if (el) inputRefs.current[row.id] = el; }}
                            value={row.search ?? ''}
                            onChange={e => {
                              const query = e.target.value;
                              updateRow(row.id, { search: query });
                              const rect = inputRefs.current[row.id]?.getBoundingClientRect();
                              if (rect) setActiveDropdown({ rowId: row.id, rect, query });
                            }}
                            onFocus={() => {
                              const rect = inputRefs.current[row.id]?.getBoundingClientRect();
                              if (rect) setActiveDropdown({ rowId: row.id, rect, query: row.search ?? '' });
                            }}
                            className="w-full px-2 py-1 border border-slate-200 rounded-lg text-sm"
                          />
                        )}
                      </td>
                      <td className="px-5 py-4 text-slate-600 truncate">{hasProduct ? sku : '—'}</td>
                      <td className="px-5 py-4 text-slate-600">{hasProduct ? quantity : '—'}</td>
                      <td className="px-5 py-4 text-slate-600">{hasProduct ? formatCurrency(base) : '—'}</td>
                      <td className="px-5 py-4">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={row.discountPercent ?? ''}
                          onChange={e => {
                            const v = e.target.value;
                            updateRow(row.id, { discountPercent: v === '' ? null : parseFloat(v), specialPrice: null });
                          }}
                          className="w-full px-2 py-1 border border-slate-200 rounded-lg text-sm"
                          placeholder="%"
                          disabled={!hasProduct || row.specialPrice != null}
                        />
                      </td>
                      <td className="px-5 py-4 text-slate-600">{hasProduct ? formatCurrency(discountAmount) : '—'}</td>
                      <td className="px-5 py-4 text-slate-600">{hasProduct ? (taxCode ?? '—') : '—'}</td>
                      <td className="px-5 py-4 text-slate-600">{hasProduct ? (taxAmountFromProduct != null ? formatCurrency(taxAmountFromProduct) : '—') : '—'}</td>
                      <td className={`px-5 py-4 text-sm font-semibold ${hasOverride ? 'text-emerald-700' : 'text-slate-600'}`}>
                        {hasProduct ? formatCurrency(amount) : '—'}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={row.specialPrice ?? ''}
                          onChange={e => {
                            const v = e.target.value;
                            updateRow(row.id, { specialPrice: v === '' ? null : parseFloat(v), discountPercent: null });
                          }}
                          className="w-28 px-2 py-1 border border-slate-200 rounded-lg text-sm"
                          placeholder="—"
                          disabled={!hasProduct || row.discountPercent != null}
                        />
                      </td>
                      <td className="px-5 py-4 text-right">
                        {hasProduct ? (
                          <button
                            onClick={() => deleteRow(row.id)}
                            className="p-2 rounded-md text-red-600 hover:bg-red-50"
                            title="Remove special price"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        ) : (
                          <span className="inline-block w-4 h-4" />
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      {activeDropdown && dropdownStyle && createPortal(
        <div ref={portalRef} style={dropdownStyle} className="z-50">
          <div className="max-h-72 overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
            {filteredProducts.length === 0 ? (
              <div className="px-3 py-2 text-sm text-slate-500">No matches</div>
            ) : (
              filteredProducts.map(p => (
                <button
                  key={p.id}
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => handleSelectProduct(activeDropdown.rowId, p.id)}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-slate-100"
                >
                  <span className="font-medium">{p.name}</span>
                  <span className="ml-2 text-slate-500">{p.sku ? `(${p.sku})` : ''}</span>
                </button>
              ))
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
