import api from './axiosConfig';

export type RepPaymentStatus = 'AwaitingConfirmation' | 'Confirmed' | 'Approved' | 'Rejected';
export type RepPaymentView = 'active' | 'trash';
export type PaymentReportSortDirection = 'asc' | 'desc';

export interface RepPaymentDto {
  id: string;
  reportNumber: string;
  repId: string;
  repName: string;
  coordinatorName?: string | null;
  customerName: string;
  referenceNumber?: string | null;
  amount: number;
  imageUrl?: string | null;
  hasEvidence: boolean;
  status: RepPaymentStatus;
  adminNotes?: string | null;
  updatedBy?: string | null;
  createdAt: string;
  updatedAt?: string | null;
  deletedAt?: string | null;
  isDeletedByAdmin: boolean;
  adminDeletedAt?: string | null;
  isDeletedByCoordinator: boolean;
  coordinatorDeletedAt?: string | null;
  isDeletedBySalesRep: boolean;
  salesRepDeletedAt?: string | null;
}

export interface PagedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages?: number;
}

export interface RepPaymentQueryParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  repId?: string;
  fromDate?: string;
  toDate?: string;
  sortField?: string;
  sortDir?: PaymentReportSortDirection;
  view?: RepPaymentView;
}

export interface RepPaymentRepOption {
  id: string;
  name: string;
}

export interface CreateRepPaymentPayload {
  customerName: string;
  referenceNumber: string;
  amount: number;
  image?: File | null;
}

export interface UpdateRepPaymentStatusPayload {
  status: string;
  adminNotes?: string;
}

export const repPaymentsApi = {
  // ── Rep ──────────────────────────────────────────────────────────────────
  create: async (payload: CreateRepPaymentPayload) => {
    const formData = new FormData();
    formData.append('customerName', payload.customerName);
    formData.append('referenceNumber', payload.referenceNumber);
    formData.append('amount', String(payload.amount));
    if (payload.image) formData.append('image', payload.image);

    const res = await api.post<{ data: RepPaymentDto }>(
      '/rep/payment-reports',
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );

    return res.data.data;
  },

  getRepPayments: async (params: RepPaymentQueryParams = {}) => {
    const res = await api.get<{ data: PagedResult<RepPaymentDto> }>(
      '/rep/payment-reports',
      { params },
    );
    return res.data.data;
  },

  getRepById: async (id: string) => {
    const res = await api.get<{ data: RepPaymentDto }>(
      `/rep/payment-reports/${id}`,
    );
    return res.data.data;
  },

  deleteRep: async (id: string) => {
    await api.delete(`/rep/payment-reports/${id}`);
  },

  repTrash: async (id: string) => {
    await api.put(`/rep/payment-reports/${id}/trash`);
  },

  repRestore: async (id: string) => {
    await api.put(`/rep/payment-reports/${id}/restore`);
  },

  // ── Admin ────────────────────────────────────────────────────────────────
  getAll: async (params: RepPaymentQueryParams = {}) => {
    const res = await api.get<{ data: PagedResult<RepPaymentDto> }>(
      '/admin/payment-reports',
      { params },
    );
    return res.data.data;
  },

  getTrash: async (params: RepPaymentQueryParams = {}) => {
    const res = await api.get<{ data: PagedResult<RepPaymentDto> }>(
      '/admin/payment-reports/trash',
      { params },
    );
    return res.data.data;
  },

  getAdminRepOptions: async () => {
    const res = await api.get<{ data: RepPaymentRepOption[] }>(
      '/admin/payment-reports/rep-options',
    );
    return res.data.data;
  },

  getByIdAdmin: async (id: string) => {
    const res = await api.get<{ data: RepPaymentDto }>(
      `/admin/payment-reports/${id}`,
    );
    return res.data.data;
  },

  updateStatus: async (
    id: string,
    payload: UpdateRepPaymentStatusPayload,
  ) => {
    const res = await api.put<{ data: RepPaymentDto }>(
      `/admin/payment-reports/${id}/status`,
      payload,
    );
    return res.data.data;
  },

  softDelete: async (id: string) => {
    await api.delete(`/admin/payment-reports/${id}`);
  },

  restore: async (id: string) => {
    await api.post(`/admin/payment-reports/${id}/restore`);
  },

  hardDelete: async (id: string) => {
    await api.delete(`/admin/payment-reports/${id}/permanent`);
  },

  bulkDelete: async (ids: string[]) => {
    await api.post('/admin/payment-reports/bulk-delete', ids);
  },

  bulkStatus: async (ids: string[], status: string) => {
    await api.post('/admin/payment-reports/bulk-status', { ids, status });
  },

  // ── Coordinator ─────────────────────────────────────────────────────────
  getForCoordinator: async (params: RepPaymentQueryParams = {}) => {
    const res = await api.get<{ data: PagedResult<RepPaymentDto> }>(
      '/coordinator/payment-reports',
      { params },
    );
    return res.data.data;
  },

  getCoordinatorRepOptions: async () => {
    const res = await api.get<{ data: RepPaymentRepOption[] }>(
      '/coordinator/payment-reports/rep-options',
    );
    return res.data.data;
  },

  getForCoordinatorById: async (id: string) => {
    const res = await api.get<{ data: RepPaymentDto }>(
      `/coordinator/payment-reports/${id}`,
    );
    return res.data.data;
  },

  coordinatorUpdateStatus: async (
    id: string,
    payload: UpdateRepPaymentStatusPayload,
  ) => {
    const res = await api.put<{ data: RepPaymentDto }>(
      `/coordinator/payment-reports/${id}/status`,
      payload,
    );
    return res.data.data;
  },

  coordinatorTrash: async (id: string) => {
    await api.put(`/coordinator/payment-reports/${id}/trash`);
  },

  coordinatorRestore: async (id: string) => {
    await api.put(`/coordinator/payment-reports/${id}/restore`);
  },
};
