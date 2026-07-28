export interface Coordinator {
  id: string;
  userId: string;
  username: string;
  fullName: string;
  employeeCode: string;
  regionId?: string;
  regionName?: string;
  hireDate: string;
  email?: string;
  phoneNumber?: string;
  isActive: boolean;
  mustChangePassword: boolean;
  temporaryPassword?: string;
  createdAt: string;
  assignedRepsCount: number;
  assignedCustomersCount: number;
}

export interface CreateCoordinatorRequest {
  username?: string;
  email?: string;
  password: string;
  phoneNumber?: string;
  fullName: string;
  employeeCode: string;
  regionId?: string;
  hireDate: string;
}

export interface UpdateCoordinatorRequest {
  fullName?: string;
  employeeCode?: string;
  phoneNumber?: string;
  email?: string;
  hireDate?: string;
  regionId?: string | null;
  isActive?: boolean;
}

export interface CoordinatorDashboard {
  totalReps: number;
  totalCustomers: number;
  pendingCustomerApprovals: number;
  pendingQuotations: number;
  totalSalesThisMonth: number;
  totalOrdersThisMonth: number;
  recentPendingApprovals: PendingCustomerApproval[];
  recentPendingQuotations: PendingQuotation[];
}

export interface PendingCustomerApproval {
  customerId: string;
  shopName: string;
  email?: string;
  phoneNumber?: string;
  repName?: string;
  city?: string;
  requestedAt: string;
}

export interface PendingQuotation {
  quotationId: string;
  quotationNumber: string;
  customerName: string;
  repName?: string;
  totalAmount: number;
  submittedAt: string;
}

export interface ApproveCustomerRequest {
  assignedRepId?: string;
}

export interface RejectCustomerRequest {
  reason: string;
}
