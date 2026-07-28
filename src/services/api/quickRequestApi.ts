import api from './axiosConfig';

export interface QuickRequestDto {
  id: string;
  requestNumber: string;
  type: 'Order' | 'Quotation';
  customerName: string;
  details: string;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Completed';
  adminNotes?: string | null;
  repId: string;
  repName: string;
  imageUrls: string[];
  createdAt: string;
  updatedAt?: string | null;
}

export interface CreateQuickRequestDto {
  type: 'Order' | 'Quotation';
  customerName: string;
  details: string;
}

export interface UpdateQuickRequestStatusDto {
  status: string;
  adminNotes?: string;
}

export const quickRequestApi = {
  // Rep
  create: (dto: CreateQuickRequestDto) =>
    api.post<{ data: QuickRequestDto }>('/rep/quick-requests', dto),

  uploadImages: (id: string, files: File[]) => {
    const form = new FormData();
    files.forEach(f => form.append('images', f));
    return api.post<{ data: QuickRequestDto }>(`/rep/quick-requests/${id}/images`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  repGetAll: (type?: string) =>
    api.get<{ data: QuickRequestDto[] }>('/rep/quick-requests', { params: type ? { type } : undefined }),

  repGetById: (id: string) =>
    api.get<{ data: QuickRequestDto }>(`/rep/quick-requests/${id}`),

  // Admin
  adminGetAll: (type?: string, status?: string) =>
    api.get<{ data: QuickRequestDto[] }>('/admin/quick-requests', {
      params: { ...(type && { type }), ...(status && { status }) },
    }),

  adminGetById: (id: string) =>
    api.get<{ data: QuickRequestDto }>(`/admin/quick-requests/${id}`),

  adminUpdateStatus: (id: string, dto: UpdateQuickRequestStatusDto) =>
    api.put<{ data: QuickRequestDto }>(`/admin/quick-requests/${id}/status`, dto),

  adminSoftDelete: (id: string) =>
    api.delete<{ data: string }>(`/admin/quick-requests/${id}`),

  adminGetTrash: (type?: string) =>
    api.get<{ data: QuickRequestDto[] }>('/admin/quick-requests/trash', {
      params: type ? { type } : undefined,
    }),

  adminRestore: (id: string) =>
    api.post<{ data: string }>(`/admin/quick-requests/${id}/restore`),

  // Rep trash
  repDelete: (id: string) =>
    api.delete<{ data: string }>(`/rep/quick-requests/${id}`),

  repGetTrash: (type?: string) =>
    api.get<{ data: QuickRequestDto[] }>('/rep/quick-requests/trash', {
      params: type ? { type } : undefined,
    }),

  repRestore: (id: string) =>
    api.post<{ data: string }>(`/rep/quick-requests/${id}/restore`),

  // Coordinator
  coordinatorGetAll: (type?: string, status?: string) =>
    api.get<{ data: QuickRequestDto[] }>('/coordinator/quick-requests', {
      params: { ...(type && { type }), ...(status && { status }) },
    }),

  coordinatorDelete: (id: string) =>
    api.delete<{ data: string }>(`/coordinator/quick-requests/${id}`),

  coordinatorUpdateStatus: (id: string, dto: UpdateQuickRequestStatusDto) =>
    api.put<{ data: QuickRequestDto }>(`/coordinator/quick-requests/${id}/status`, dto),

  coordinatorGetTrash: (type?: string) =>
    api.get<{ data: QuickRequestDto[] }>('/coordinator/quick-requests/trash', {
      params: type ? { type } : undefined,
    }),

  coordinatorRestore: (id: string) =>
    api.post<{ data: string }>(`/coordinator/quick-requests/${id}/restore`),
};
