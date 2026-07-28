export interface DashboardData {
  totalSalesToday: number;
  totalSalesMonth: number;
  totalOrders: number;
  pendingOrders: number;
  totalProducts: number;
  lowStockProducts: number;
  totalCustomers: number;
  activeReps: number;
  totalOutstanding: number;
  totalQuotations?: number;
  pendingQuotations?: number;
  salesTrend: SalesTrend[];
  topProducts: TopProduct[];
}

// minimal summary used on simplified admin dashboard
export interface AdminDashboardSummary {
  totalOrders: number;
  pendingOrders: number;
  totalProducts: number;
  lowStockProducts: number;
  totalCustomers: number;
  activeReps: number;
}

export interface SalesTrend {
  period: string;
  amount: number;
  orderCount: number;
}

export interface TopProduct {
  productId: string;
  productName: string;
  quantitySold: number;
  revenue: number;
}

export interface SalesReport {
  fromDate: string;
  toDate: string;
  totalSales: number;
  totalOrders: number;
  averageOrderValue: number;
  dailyBreakdown: SalesTrend[];
}

export interface RepPerformance {
  repId: string;
  repName: string;
  totalSales: number;
  totalOrders: number;
  totalCustomers: number;
  targetAmount: number;
  achievedAmount: number;
  achievementPercentage: number;
}

export interface SalesTarget {
  id: string;
  repId: string;
  targetName?: string | null;
  targetPeriod: string;
  startDate: string;
  endDate: string;
  targetAmount: number;
  achievedAmount: number;
  achievementPercentage: number;
  balanceRemaining: number;
  exceededBy: number;
  status: string;

  // Current uploaded sales report (undefined until the first report is uploaded)
  hasReport: boolean;
  currentReportId?: string | null;
  reportFromDate?: string | null;
  reportAsAtDate?: string | null;
  reportSourceFileName?: string | null;
  reportUploadedAt?: string | null;
  distinctOrderCount: number;
  distinctCustomerCount: number;
  performanceStatus: 'Below Target' | 'On Track' | 'Target Achieved' | 'Target Exceeded';
}

export interface AdHocVisitRequest {
  customerId: string;
  notes?: string;
}

export interface Visit {
  id: string;
  repId: string;
  customerId: string;
  customerName?: string;
  plannedDate?: string;
  checkInTime?: string;
  checkOutTime?: string;
  status: string;
  notes?: string;
  outcomeReason?: string;
  latitude?: number;
  longitude?: number;
  phoneNumber?: string;
  street?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

export interface RouteProgress {
  repId: string;
  repName: string;
  totalPlanned: number;
  completed: number;
  strikeRate: number; // 0-1
}

export interface Route {
  id: string;
  name: string;
  description?: string;
  repId?: string;
  repName?: string;
  assignedReps?: Array<{ repId: string; repName: string }>;
  daysOfWeek: string[];
  estimatedDurationMinutes: number;
  isActive: boolean;
  customers?: RouteCustomer[];
}

export interface RouteCustomer {
  id: string;
  customerId: string;
  customerName?: string;
  visitOrder: number;
  visitFrequency: string;
  latitude?: number;
  longitude?: number;
}

export interface Complaint {
  id: string;
  customerId?: string;
  customerName: string;
  createdByUserId?: string;
  createdByRole?: string;
  createdByName?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  contactPosition?: string;
  assignedTo?: string;
  orderId?: string;
  subject: string;
  ticketType?: 'Support' | 'Complaint';
  description: string;
  priority: string;
  status: string;
  resolution?: string;
  createdAt: string;
  resolvedAt?: string;
}

export interface CreateComplaintRequest {
  orderId?: string;
  subject: string;
  ticketType?: 'Support' | 'Complaint';
  description: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  contactPosition?: string;
  priority?: string;
}

export interface ComplaintMessage {
  id: string;
  complaintId: string;
  senderUserId: string;
  senderRole: string;
  senderName: string;
  message: string;
  isSystemMessage: boolean;
  createdAt: string;
}

export interface SendComplaintMessageRequest {
  message: string;
}