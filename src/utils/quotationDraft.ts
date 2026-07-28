// Quotation draft state management for Rep quotation creation flow (mobile)
// Mirrors orderDraft.ts but includes requestPrice per item

const DRAFT_KEY = 'rep_quotation_draft';

export interface QuotationDraftItem {
  productId: string;
  name: string;
  sku: string;
  price: number;         // sellingPrice (base)
  quantity: number;
  requestPrice?: number; // rep's requested price
  taxCode?: string;
  taxAmount?: number;
  totalAmount?: number;  // all-inclusive price (price + tax)
  discountPercent?: number;
  discountAmount?: number;
}

export interface QuotationDraft {
  customerId?: string;
  customerName?: string;
  items: QuotationDraftItem[];
  notes?: string;
}

export const quotationDraftUtils = {
  get(): QuotationDraft {
    try {
      const json = sessionStorage.getItem(DRAFT_KEY);
      return json ? JSON.parse(json) : { items: [] };
    } catch {
      return { items: [] };
    }
  },

  save(draft: QuotationDraft): void {
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch (e) {
      console.error('Failed to save quotation draft:', e);
    }
  },

  setCustomer(customerId: string, customerName: string): void {
    const draft = this.get();
    draft.customerId = customerId;
    draft.customerName = customerName;
    this.save(draft);
  },

  addItem(item: QuotationDraftItem): void {
    const draft = this.get();
    const existing = draft.items.find(i => i.productId === item.productId);
    if (existing) {
      existing.quantity += item.quantity;
    } else {
      draft.items.push(item);
    }
    this.save(draft);
  },

  updateQuantity(productId: string, quantity: number): void {
    const draft = this.get();
    const item = draft.items.find(i => i.productId === productId);
    if (item) {
      item.quantity = Math.max(1, quantity);
      this.save(draft);
    }
  },

  updateRequestPrice(productId: string, price: number | undefined): void {
    const draft = this.get();
    const item = draft.items.find(i => i.productId === productId);
    if (item) {
      item.requestPrice = price;
      this.save(draft);
    }
  },

  removeItem(productId: string): void {
    const draft = this.get();
    draft.items = draft.items.filter(i => i.productId !== productId);
    this.save(draft);
  },

  setNotes(notes: string): void {
    const draft = this.get();
    draft.notes = notes;
    this.save(draft);
  },

  clear(): void {
    sessionStorage.removeItem(DRAFT_KEY);
  },

  getItemCount(): number {
    const draft = this.get();
    return draft.items.reduce((sum, item) => sum + item.quantity, 0);
  },
};
