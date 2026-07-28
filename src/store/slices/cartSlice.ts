import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import { calculateLine } from '../../utils/calculations';

export interface CartItem {  // unique identifier for this line; if omitted, merge happens by productId
  lineId?: string;  productId: string;
  productName: string;
  unitPrice: number;          // base selling price per unit (without discount/tax)
  quantity: number;
  sku?: string;
  imageUrl?: string;
  // discount percentage from product or applied by user
  discountPercent?: number;
  // tax code from product (e.g. "V18", "V15", "NV") used for per-line tax calculation
  taxCode?: string;
  // pre-computed all-inclusive price per unit (base + tax), stored on product as totalAmount
  allIncPrice?: number;
  // tax rate expressed as a decimal (0.18 for 18%) derived from product metadata
  taxRate?: number;
  // total for this line, recalculated whenever quantity/percent/rate change
  lineTotal: number;
}

interface CartState {
  items: CartItem[];
  customerId: string | null;
}

const saved = localStorage.getItem('cart');
let initialState: CartState = saved ? JSON.parse(saved) : { items: [], customerId: null };
if (initialState.items && initialState.items.length) {
  // migrate old items (which may have used discountAmount/taxAmount) to new
  // schema; ensure discountPercent and taxRate exist and recompute lineTotal.
  initialState.items = initialState.items.map(i => {
    const item: any = { ...i };
    if (item.discountPercent == null) item.discountPercent = 0;
    if (item.taxRate == null) {
      // try to infer taxRate from previous taxAmount value if present
      if (item.taxAmount != null && item.unitPrice) {
        const discPct = item.discountPercent || 0;
        const base = item.unitPrice * (1 - discPct / 100);
        if (base > 0) item.taxRate = item.taxAmount / base;
      } else {
        item.taxRate = 0;
      }
    }
    // recalc lineTotal
    const calc = calculateLine({
      rate: item.unitPrice,
      qty: item.quantity,
      discountPercent: item.discountPercent,
      taxAmount: item.taxRate != null ? item.taxRate * item.unitPrice * (1 - (item.discountPercent || 0) / 100) : undefined,
    });
    item.lineTotal = calc.total;
    return item as CartItem;
  });
}

const persist = (state: CartState) => localStorage.setItem('cart', JSON.stringify(state));

const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
    setCartCustomer(state, action: PayloadAction<string>) {
      state.customerId = action.payload;
      persist(state);
    },
    addToCart(state, action: PayloadAction<CartItem>) {
      const payload = { ...action.payload } as CartItem;
      // recalc line total in case caller didn't
      const calc = calculateLine({
        rate: payload.unitPrice,
        qty: payload.quantity,
        discountPercent: payload.discountPercent,
        taxAmount: payload.taxRate != null
          ? payload.taxRate * payload.unitPrice * (1 - (payload.discountPercent ?? 0) / 100)
          : undefined,
      });
      payload.lineTotal = calc.total;

      // find matching existing item: prefer matching lineId, otherwise match by
      // productId only if no lineId specified (legacy behaviour)
      let existing: CartItem | undefined;
      if (payload.lineId) {
        existing = state.items.find(i => i.lineId === payload.lineId);
      }
      if (!existing && !payload.lineId) {
        existing = state.items.find(i => i.productId === payload.productId && !i.lineId);
      }

      if (existing && !payload.lineId) {
        // merge into existing
        existing.quantity += payload.quantity;
        const merged = calculateLine({
          rate: existing.unitPrice,
          qty: existing.quantity,
          discountPercent: existing.discountPercent,
          taxAmount: existing.taxRate != null
            ? existing.taxRate * existing.unitPrice * (1 - (existing.discountPercent ?? 0) / 100)
            : undefined,
        });
        existing.lineTotal = merged.total;
      } else {
        state.items.push(payload);
      }
      persist(state);
    },
    updateQuantity(state, action: PayloadAction<{ productId?: string; lineId?: string; quantity: number }>) {
      let item: CartItem | undefined;
      if (action.payload.lineId) {
        item = state.items.find(i => i.lineId === action.payload.lineId);
      } else if (action.payload.productId) {
        item = state.items.find(i => i.productId === action.payload.productId);
      }
      if (item) {
        item.quantity = action.payload.quantity;
        const calc = calculateLine({
          rate: item.unitPrice,
          qty: item.quantity,
          discountPercent: item.discountPercent,
          taxAmount: item.taxRate != null
            ? item.taxRate * item.unitPrice * (1 - (item.discountPercent ?? 0) / 100)
            : undefined,
        });
        item.lineTotal = calc.total;
        if (item.quantity <= 0) {
          state.items = state.items.filter(i => i !== item);
        }
      }
      persist(state);
    },


    // this reducer is no longer needed but kept for compatibility (no-op)
    updateItemSnapshot(state, action: PayloadAction<any>) {
      // no operation
      persist(state);
    },
    removeFromCart(state, action: PayloadAction<{ productId?: string; lineId?: string }>) {
      if (action.payload.lineId) {
        state.items = state.items.filter(i => i.lineId !== action.payload.lineId);
      } else if (action.payload.productId) {
        state.items = state.items.filter(i => i.productId !== action.payload.productId);
      }
      persist(state);
    },
    clearCart(state) {
      state.items = [];
      state.customerId = null;
      localStorage.removeItem('cart');
    },
  },
});

export const { setCartCustomer, addToCart, updateQuantity, updateItemSnapshot, removeFromCart, clearCart } = cartSlice.actions;
export default cartSlice.reducer;
