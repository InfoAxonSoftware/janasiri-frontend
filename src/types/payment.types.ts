export interface Payment {
  id: string;
  customerId: string;
  customerName?: string;
  orderId?: string;
  paymentDate: string;
  amount: number;
  paymentMethod: string;
  referenceNumber?: string;
  chequeNumber?: string;
  bankName?: string;
  status: string;
  notes?: string;
  createdAt: string;
}

export interface PaymentRecord {
  customerId: string;
  orderId?: string;
  amount: number;
  // backend expects numeric enum value for PaymentMethod; allow number here
  paymentMethod: number | string;
  referenceNumber?: string;
  chequeNumber?: string;
  bankName?: string;
  chequeDate?: string;
  notes?: string;
}

export interface CustomerLedger {
  totalOutstanding: number;
  totalPaid: number;
  entries: LedgerEntry[];
}

export interface LedgerEntry {
  date: string;
  type: string;
  reference: string;
  debit: number;
  credit: number;
  balance: number;
}
