import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { productsApi } from '../../services/api/productsApi';
import { customersApi } from '../../services/api/customersApi';
import { formatCurrency } from '../../utils/formatters';
import { Package, Search, FileDown } from 'lucide-react';
import type { Category, Product } from '../../types/product.types';
import toast from 'react-hot-toast';
import { exportPriceListPdf } from '../../utils/priceListPdf';

const API_BASE = import.meta.env.VITE_API_URL?.replace('/api', '') || '';

export default function CustomerProductCatalog() {
  const [search, setSearch] = useState('');
  const [exporting, setExporting] = useState(false);

  // Determine tax/non-tax
  const { data: customerProfile } = useQuery({
    queryKey: ['customer-profile-catalog-tax'],
    queryFn: () => customersApi.customerGetProfile().then(r => r.data.data),
    staleTime: 5 * 60 * 1000,
  });
  const isNonTax = (customerProfile?.customerType || '').toLowerCase().replace(/[-\s]/g, '') === 'nontax';

  // Load ALL products + categories tree (same data admin uses for export)
  const { data: allProducts = [], isLoading } = useQuery({
    queryKey: ['customer-product-catalog-all'],
    queryFn: () => productsApi.customerCatalogAll(),
    staleTime: 5 * 60 * 1000,
  });

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => productsApi.customerCategories().then(r => r.data.data),
    staleTime: 10 * 60 * 1000,
  });

  // Build categoryId → "Main - Sub" GroupName, same logic as admin export
  const catMap = useMemo(() => {
    const m = new Map<string, string>();
    if (categories) {
      for (const main of categories as Category[]) {
        if (!main.subCategories?.length) {
          m.set(main.id, main.name);
        } else {
          for (const sub of main.subCategories) {
            m.set(sub.id, `${main.name} - ${sub.name}`);
          }
        }
      }
    }
    return m;
  }, [categories]);

  // Filter + group by full GroupName (same as admin export)
  const grouped = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q
      ? allProducts.filter(
          (p: Product) =>
            p.name.toLowerCase().includes(q) ||
            (p.sku || '').toLowerCase().includes(q) ||
            (p.categoryName || '').toLowerCase().includes(q),
        )
      : allProducts;

    const map = new Map<string, Product[]>();
    for (const p of filtered) {
      const group = (p.categoryId && catMap.get(p.categoryId)) || p.categoryName || 'Uncategorized';
      if (!map.has(group)) map.set(group, []);
      map.get(group)!.push(p);
    }

    // Sort groups A-Z, products A-Z within each group
    return new Map(
      [...map.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, prods]) => [key, prods.slice().sort((a: Product, b: Product) => a.name.localeCompare(b.name))] as [string, Product[]])
    );
  }, [allProducts, catMap, search]);

  const totalCount = allProducts.length;
  const colCount = isNonTax ? 6 : 8;

  const handleExportPdf = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      await exportPriceListPdf(grouped);
    } catch (err) {
      console.error('PDF export failed', err);
      toast.error('Export failed');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="animate-fade-in space-y-5 pb-10">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Products</h1>
          <p className="text-sm text-slate-500 mt-0.5">{totalCount} products available</p>
        </div>
        <div className="flex items-center gap-3">
          {customerProfile && (
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${isNonTax ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
              {isNonTax ? 'Non-Tax Customer' : 'Tax Customer'}
            </span>
          )}
          <button
            onClick={handleExportPdf}
            disabled={exporting || isLoading || totalCount === 0}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-600 text-white text-sm font-semibold hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            <FileDown className="w-4 h-4" />
            {exporting ? 'Exporting…' : 'Export PDF'}
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search by name, SKU or category..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-orange-500/20 focus:border-orange-300 outline-none transition"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="py-20 text-center">
            <div className="inline-block w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-slate-500 mt-4">Loading products...</p>
          </div>
        ) : grouped.size === 0 ? (
          <div className="py-20 text-center">
            <Package className="w-14 h-14 mx-auto text-slate-300 mb-4" />
            <p className="text-lg font-semibold text-slate-700">No products found</p>
            <p className="text-sm text-slate-500 mt-1">Try a different search term</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-slate-800 text-white">
                  <th className="text-left px-4 py-3.5 font-semibold text-xs uppercase tracking-wider border-r border-slate-600 min-w-[200px]">Group Name</th>
                  <th className="text-left px-4 py-3.5 font-semibold text-xs uppercase tracking-wider border-r border-slate-600 whitespace-nowrap">Item</th>
                  <th className="text-left px-4 py-3.5 font-semibold text-xs uppercase tracking-wider border-r border-slate-600 min-w-[240px]">Sales Description</th>
                  <th className="text-center px-4 py-3.5 font-semibold text-xs uppercase tracking-wider border-r border-slate-600 whitespace-nowrap w-32">UOM</th>
                  {!isNonTax && (
                    <>
                      <th className="text-right px-4 py-3.5 font-semibold text-xs uppercase tracking-wider border-r border-slate-600 whitespace-nowrap">Price</th>
                      <th className="text-center px-2 py-3.5 font-semibold text-xs uppercase tracking-wider border-r border-slate-600 whitespace-nowrap w-14">Tax</th>
                    </>
                  )}
                  <th className="text-right px-4 py-3.5 font-semibold text-xs uppercase tracking-wider border-r border-slate-600 whitespace-nowrap">All Inc Price</th>
                  <th className="text-right px-4 py-3.5 font-semibold text-xs uppercase tracking-wider whitespace-nowrap">MRP</th>
                </tr>
              </thead>
              <tbody>
                {Array.from(grouped.entries()).map(([groupName, items]) => (
                  <>
                    {/* Group header row */}
                    <tr key={`hdr-${groupName}`} className="bg-slate-100 border-y border-slate-300">
                      <td colSpan={colCount} className="px-4 py-2 font-bold text-slate-800 text-sm">
                        {groupName}
                      </td>
                    </tr>
                    {/* Product rows */}
                    {items.map((product: Product) => (
                      <tr key={product.id} className="border-b border-slate-100 hover:bg-slate-50/60 transition-colors">
                        <td className="px-4 py-3 text-slate-600 border-r border-slate-100">{groupName}</td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-600 whitespace-nowrap border-r border-slate-100">{product.sku || '—'}</td>
                        <td className="px-4 py-3 text-slate-800 border-r border-slate-100">
                          <div className="flex items-center gap-2">
                            {(product.imageUrls?.length ?? 0) > 0 && (
                              <img
                                src={`${API_BASE}${product.imageUrls![0]}`}
                                alt=""
                                className="w-8 h-8 rounded object-cover flex-shrink-0 border border-slate-200"
                                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                              />
                            )}
                            {product.name}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center text-sky-600 font-medium border-r border-slate-100 w-32">
                          {product.uom || 'No UOM'}
                        </td>
                        {!isNonTax && (
                          <>
                            <td className="px-4 py-3 text-right text-slate-700 border-r border-slate-100 whitespace-nowrap">
                              {product.sellingPrice != null ? formatCurrency(product.sellingPrice) : '—'}
                            </td>
                            <td className="px-2 py-3 text-center border-r border-slate-100 w-14 whitespace-nowrap">
                              {product.taxCode
                                ? <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold ${product.taxCode.startsWith('V') ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>{product.taxCode}</span>
                                : <span className="text-slate-300">—</span>}
                            </td>
                          </>
                        )}
                        <td className="px-4 py-3 text-right font-semibold text-slate-900 border-r border-slate-100 whitespace-nowrap">
                          {product.totalAmount != null ? formatCurrency(product.totalAmount) : '—'}
                        </td>
                        <td className="px-4 py-3 text-right text-orange-600 font-semibold whitespace-nowrap">
                          {product.mrp != null ? formatCurrency(product.mrp) : '—'}
                        </td>
                      </tr>
                    ))}
                    {/* Blank spacer row between groups */}
                    <tr key={`spacer-${groupName}`} className="bg-white">
                      <td colSpan={colCount} className="py-1" />
                    </tr>
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
