import api from './axiosConfig';
import type { ApiResponse, PagedResult } from '../../types/api.types';
import type { Complaint, ComplaintMessage, CreateComplaintRequest, SendComplaintMessageRequest } from '../../types/common.types';

export const supportApi = {
  // Customer
  customerCreateComplaint: (data: CreateComplaintRequest) =>
    api.post<ApiResponse<Complaint>>('/customer/support/complaints', data),

  customerGetComplaints: () =>
    api.get<ApiResponse<Complaint[]>>('/customer/support/complaints'),

  customerGetMessages: (id: string) =>
    api.get<ApiResponse<ComplaintMessage[]>>(`/customer/support/complaints/${id}/messages`),

  customerSendMessage: (id: string, data: SendComplaintMessageRequest) =>
    api.post<ApiResponse<ComplaintMessage>>(`/customer/support/complaints/${id}/messages`, data),

  // Sales Rep
  repCreateComplaint: (data: CreateComplaintRequest) =>
    api.post<ApiResponse<Complaint>>('/rep/support/complaints', data),

  repGetComplaints: () =>
    api.get<ApiResponse<Complaint[]>>('/rep/support/complaints'),

  repGetMessages: (id: string) =>
    api.get<ApiResponse<ComplaintMessage[]>>(`/rep/support/complaints/${id}/messages`),

  repSendMessage: (id: string, data: SendComplaintMessageRequest) =>
    api.post<ApiResponse<ComplaintMessage>>(`/rep/support/complaints/${id}/messages`, data),

  // Coordinator
  coordinatorCreateComplaint: (data: CreateComplaintRequest) =>
    api.post<ApiResponse<Complaint>>('/coordinator/support/complaints', data),

  coordinatorGetComplaints: () =>
    api.get<ApiResponse<Complaint[]>>('/coordinator/support/complaints'),

  coordinatorGetMessages: (id: string) =>
    api.get<ApiResponse<ComplaintMessage[]>>(`/coordinator/support/complaints/${id}/messages`),

  coordinatorSendMessage: (id: string, data: SendComplaintMessageRequest) =>
    api.post<ApiResponse<ComplaintMessage>>(`/coordinator/support/complaints/${id}/messages`, data),

  // Admin
  adminGetComplaints: (params?: Record<string, unknown>) =>
    api.get<ApiResponse<PagedResult<Complaint>>>('/admin/support/complaints', { params }),

  adminUpdateStatus: (id: string, status: string) =>
    api.put<ApiResponse<Complaint>>(`/admin/support/complaints/${id}/status`, status, {
      headers: { 'Content-Type': 'application/json' },
    }),

  adminGetMessages: (id: string) =>
    api.get<ApiResponse<ComplaintMessage[]>>(`/admin/support/complaints/${id}/messages`),

  adminSendMessage: (id: string, data: SendComplaintMessageRequest) =>
    api.post<ApiResponse<ComplaintMessage>>(`/admin/support/complaints/${id}/messages`, data),
};
