// valid status values are kept in sync with the backend enum names
export const ORDER_STATUSES = [
  'Pending',
  'Approved',
  'Processing',
  'Dispatched',
  'Delivered',
  'Completed',
  'Cancelled',
  'OnHold',
  'Rejected',
  'PartiallyDelivered',
  'SalesOrderDone'
] as const;
export type OrderStatus = typeof ORDER_STATUSES[number];

// Only these 4 statuses shown in UI filter dropdowns / pills
export const FILTER_ORDER_STATUSES = ['Pending', 'Approved', 'Rejected', 'Completed'] as const;

export interface Order {
  id: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  repId?: string;
  repName?: string;
  orderDate: string;
  requiredDeliveryDate?: string;
  actualDeliveryDate?: string;
  status: OrderStatus;
  subTotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  deliveryAddress?: string;
  deliveryNotes?: string;
  rating?: number;
  isFromApprovedQuotation?: boolean;
  sourceQuotationNumber?: string;
  isDeleted?: boolean;
  deletedAt?: string;
  shopName?: string;
  items: OrderItem[];
  createdAt: string;
}

export interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  productSKU?: string;
  quantity: number;
  unitPrice: number;
  mrp?: number;
  discountPercent: number;
  taxCode?: string;
  taxAmount: number;
  lineTotal: number;
}

export interface CreateOrderRequest {
  customerId: string;
  requiredDeliveryDate?: string;
  deliveryAddress?: string;
  deliveryNotes?: string;
  items: CreateOrderItemRequest[];
}

export interface CreateOrderItemRequest {
  productId: string;
  quantity: number;
  discountPercent?: number;
}

export interface OrderFilterRequest {
  status?: OrderStatus;
  customerId?: string;
  repId?: string;
  fromDate?: string;
  toDate?: string;
  page?: number;
  pageSize?: number;
}

export interface UnifiedOrderFilterRequest {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  customerId?: string;
  fromDate?: string;
  toDate?: string;
  sortField?: string;
  sortDirection?: 'asc' | 'desc';
}

export interface OrderTrashItem {
  id: string;
  kind: 'Order' | 'QuickOrder';
}

export interface UnifiedQuickOrder {
  id: string;
  requestNumber: string;
  type: 'Order';
  customerName: string;
  details: string;
  status: string;
  adminNotes?: string | null;
  repId: string;
  repName: string;
  imageUrls: string[];
  createdAt: string;
  updatedAt?: string | null;
}

export interface UnifiedOrderItem extends OrderTrashItem {
  number: string;
  customerName: string;
  shopName?: string | null;
  customerId?: string | null;
  repId?: string | null;
  repName?: string | null;
  status: string;
  date: string;
  createdAt: string;
  totalAmount?: number | null;
  deletedAt?: string | null;
  order?: Order | null;
  quickOrder?: UnifiedQuickOrder | null;
}

export interface UpdateOrderStatusRequest {
  status: OrderStatus;
  reason?: string;
}

export interface RateOrderRequest {
  rating: number;
  comment?: string;
}
