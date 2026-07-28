import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import type { Product } from '../../types/product.types';
import { formatCurrency } from '../../utils/formatters';
import { X, ShoppingCart } from 'lucide-react';

type Props = {
  product: Product | null;
  open: boolean;
  onClose: () => void;
  onAdd: (p: Product) => void;
  isNonTaxCustomer?: boolean;
};

export default function ProductQuickView({ product, open, onClose, onAdd, isNonTaxCustomer = false }: Props) {
  const [isPopping, setIsPopping] = useState(false);
  if (!open || !product) return null;

  return createPortal(
    <div className="fixed inset-0 z-50" style={{ pointerEvents: 'auto' }}>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Desktop modal centered, mobile bottom sheet */}
      <div className="fixed left-1/2 top-12 -translate-x-1/2 w-full max-w-3xl mx-auto lg:rounded-2xl bg-white shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <div className="flex items-center gap-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">{product.name}</h3>
              <p className="text-xs text-slate-400">{product.brand || 'Generic'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-sm font-bold text-orange-600">{formatCurrency(isNonTaxCustomer ? (product.sellingPrice || 0) + (product.taxAmount || 0) : product.sellingPrice)}</div>
            <button onClick={onClose} className="p-2 rounded-md text-slate-500 hover:bg-slate-50">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-4 lg:p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
{/* image removed (no longer part of product) */}

          <div className="space-y-4">
            {/* description field removed */}
            <div className="flex items-center gap-3">
              <button onClick={() => { setIsPopping(true); onAdd(product); setTimeout(() => setIsPopping(false), 420); }} className={`flex items-center gap-2 px-4 py-2 bg-gradient-to-br from-orange-500 to-rose-500 text-white rounded-xl shadow-md sparkle ${isPopping ? 'animate-pop sparkle-on' : ''}`}>
                <ShoppingCart className="w-4 h-4" /> Add to cart
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
