export const QUOTATION_STATUSES = [
  'Draft',
  'Submitted',
  'UnderReview',
  'Approved',
  'Rejected',
  'ConvertedToOrder',
  'Expired',
  'SalesQuotationDone'
] as const;
export type QuotationStatus = typeof QUOTATION_STATUSES[number];

// Only these 4 statuses shown in UI filter dropdowns / pills
export const FILTER_QUOTATION_STATUSES = ['Pending', 'Approved', 'Rejected', 'Completed'] as const;

export interface Quotation {
  id: string;
  quotationNumber: string;
  customerId: string;
  customerName: string;
  shopName?: string;
  repId?: string;
  repName?: string;
  coordinatorId?: string;
  coordinatorName?: string;
  status: QuotationStatus;
  subTotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  notes?: string;
  rejectionReason?: string;
  validUntil?: string;
  convertedOrderId?: string;
  items: QuotationItem[];
  createdAt: string;
  isDeleted?: boolean;
  deletedAt?: string;
}

export interface QuotationItem {
  id: string;
  productId: string;
  productName: string;
  productSKU?: string;
  mrp?: number;
  quantity: number;
  unitPrice: number;
  expectedPrice?: number;
  discountPercent: number;
  taxCode?: string;
  taxAmount: number;
  lineTotal: number;
}

export interface CreateQuotationRequest {
  customerId: string;
  notes?: string;
  validUntil?: string;
  items: CreateQuotationItemRequest[];
}

export interface CreateQuotationItemRequest {
  productId: string;
  quantity: number;
  expectedPrice?: number;
  discountPercent: number;
}

export interface ApproveQuotationRequest {
  notes?: string;
}

export interface RejectQuotationRequest {
  reason: string;
}

export interface ConvertQuotationToOrderRequest {
  deliveryAddress?: string;
  deliveryNotes?: string;
  requiredDeliveryDate?: string;
}
