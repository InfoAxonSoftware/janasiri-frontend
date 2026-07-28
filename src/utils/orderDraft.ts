// Order draft state management for Rep order creation flow
// Uses sessionStorage to persist across page navigations

import { calculateLine } from './calculations';

export interface OrderDraftItem {
  productId: string;
  quantity: number;
  name: string;
  price: number;
  sku: string;
  mrp?: number;
  /* optional pricing modifiers carried over from catalog */
  discountPercent?: number;
  taxCode?: string;
  taxAmount?: number;
  /** pre-computed all-inclusive price per unit (base + tax) stored on product as totalAmount */
  allIncPrice?: number;
  /** total for this line as shown when added (price×qty ± discounts/taxes) */
  lineTotal?: number;
}

export interface OrderDraft {
  customerId?: string;
  customerName?: string;
  items: OrderDraftItem[];
  deliveryAddress?: string;
  deliveryNotes?: string;
}

const DRAFT_KEY = 'rep_order_draft';

export const orderDraftUtils = {
  get(): OrderDraft {
    try {
      const json = sessionStorage.getItem(DRAFT_KEY);
      return json ? JSON.parse(json) : { items: [] };
    } catch {
      return { items: [] };
    }
  },

  save(draft: OrderDraft): void {
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch (e) {
      console.error('Failed to save order draft:', e);
    }
  },

  setCustomer(customerId: string, customerName: string): void {
    const draft = this.get();
    draft.customerId = customerId;
    draft.customerName = customerName;
    this.save(draft);
  },

  addItem(item: OrderDraftItem): void {
    const draft = this.get();
    const existing = draft.items.find(i => i.productId === item.productId);
    if (existing) {
      existing.quantity += item.quantity;
      // recalc line total if quantity changed
      if (item.lineTotal != null) {
        const unit = existing.lineTotal! / (existing.quantity - item.quantity);
        existing.lineTotal = unit * existing.quantity;
      }
    } else {
      draft.items.push(item);
    }
    this.save(draft);
  },

  updateQuantity(productId: string, quantity: number): void {
    const draft = this.get();
    const item = draft.items.find(i => i.productId === productId);
    if (item) {
      const prevQty = item.quantity;
      item.quantity = Math.max(1, quantity);
      // adjust stored line total proportionally if present
      if (item.lineTotal != null && prevQty && prevQty !== item.quantity) {
        const unit = item.lineTotal! / prevQty;
        item.lineTotal = unit * item.quantity;
      }
      this.save(draft);
    }
  },

  removeItem(productId: string): void {
    const draft = this.get();
    draft.items = draft.items.filter(i => i.productId !== productId);
    this.save(draft);
  },

  setDeliveryInfo(address?: string, notes?: string): void {
    const draft = this.get();
    draft.deliveryAddress = address;
    draft.deliveryNotes = notes;
    this.save(draft);
  },

  clear(): void {
    sessionStorage.removeItem(DRAFT_KEY);
  },

  getTotal(): number {
    const draft = this.get();
    return draft.items.reduce((sum, item) => {
      // if we have a lineTotal stored, trust it; otherwise compute
      if (item.lineTotal != null) return sum + item.lineTotal;
      const calc = calculateLine({ rate: item.price, qty: item.quantity, discountPercent: item.discountPercent, taxAmount: item.taxAmount });
      return sum + calc.total;
    }, 0);
  },

  getItemCount(): number {
    const draft = this.get();
    return draft.items.reduce((sum, item) => sum + item.quantity, 0);
  }
};
