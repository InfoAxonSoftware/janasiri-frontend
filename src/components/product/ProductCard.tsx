import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Check, Eye } from 'lucide-react';
import type { Product } from '../../types/product.types';
import { formatCurrency } from '../../utils/formatters';

type Props = {
  product: Product;
  added?: boolean;
  onAdd: (p: Product) => void;
  onQuickView?: (p: Product) => void;
  isNonTaxCustomer?: boolean;
};

export default function ProductCard({ product, added, onAdd, onQuickView, isNonTaxCustomer = false }: Props) {
  const [isPopping, setIsPopping] = useState(false);

  const handleAdd = () => {
    setIsPopping(true);
    onAdd(product);
    setTimeout(() => setIsPopping(false), 420);
  };

  // Image/icon removed by request — keep card compact. Quick-view button remains.
  return (
    <article className="group relative bg-white rounded-2xl border border-slate-100 hover:shadow-md transition">
      <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity z-10">
        <button
          onClick={(e) => { e.stopPropagation(); onQuickView?.(product); }}
          aria-label={`Quick view ${product.name}`}
          className="p-2 bg-white/90 text-slate-600 rounded-xl shadow-sm hover:scale-105 transition"
        >
          <Eye className="w-4 h-4" />
        </button>
      </div>

      <div className="p-3 md:p-4 flex flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 id={`prod-${product.id}-title`} className={`${(product.name || '').length > 12 ? 'line-clamp-2' : 'truncate'} text-sm md:text-base font-semibold text-slate-900 leading-tight`}>
              {product.name}
            </h3>

            {product.sku && <p className="text-[11px] text-slate-400 mt-1">SKU: {product.sku}</p>}
            {typeof product.quantity === 'number' && (
              <p className="text-[11px] text-slate-500 mt-1">Qty: {product.quantity}</p>
            )}
          </div>

          <div className="text-right flex-shrink-0">
            <div className="text-sm md:text-base font-bold text-orange-600">{formatCurrency(isNonTaxCustomer ? (product.sellingPrice || 0) + (product.taxAmount || 0) : product.sellingPrice)}</div>
          </div>
        </div>

        <div className="mt-1 flex items-center justify-between gap-3">
          <div />

          <button
            onClick={(e) => { e.stopPropagation(); handleAdd(); }}
            aria-label={`Add ${product.name} to cart`}
            className={`flex items-center gap-2 justify-center px-2 py-2 rounded-md md:rounded-xl text-white text-sm font-semibold transition-shadow shadow-sm active:scale-95 sparkle ${isPopping ? 'animate-pop sparkle-on' : ''} ${
              added ? 'bg-emerald-500 shadow-emerald-500/20' : 'bg-gradient-to-br from-orange-500 to-rose-500 shadow-orange-500/25 hover:shadow-md'
            }`}
          >
            {added ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            <span className="hidden md:inline-block">{added ? 'Added' : 'Add'}</span>
          </button>

        </div>
      </div>
    </article>
  );
}
