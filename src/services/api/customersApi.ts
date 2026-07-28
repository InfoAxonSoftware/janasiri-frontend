import api from './axiosConfig';
import type { ApiResponse, PagedResult } from '../../types/api.types';
import type { Customer, CustomerFilterOptions, CustomerSummary, PriceDetail, PriceSpecialRequest } from '../../types/customer.types';
import type { CustomerLedger } from '../../types/payment.types';

export const customersApi = {
  // Admin
  adminGetAll: (params?: Record<string, unknown>) =>
    api.get<ApiResponse<PagedResult<Customer>>>('/admin/customers', { params }),

  adminGetFilterOptions: () =>
    api.get<ApiResponse<CustomerFilterOptions>>('/admin/customers/filters'),

  adminGetById: (id: string) =>
    api.get<ApiResponse<Customer>>(`/admin/customers/${id}`),

  adminGetSummary: (id: string) =>
    api.get<ApiResponse<CustomerSummary>>(`/admin/customers/${id}/summary`),

  // Coordinator (dedicated endpoints)
  coordinatorGetAll: (params?: Record<string, unknown>) =>
    api.get<ApiResponse<PagedResult<Customer>>>('/coordinator/customer-management', { params }),

  coordinatorGetFilterOptions: () =>
    api.get<ApiResponse<CustomerFilterOptions>>('/coordinator/customer-management/filters'),

  coordinatorGetById: (id: string) =>
    api.get<ApiResponse<Customer>>(`/coordinator/customer-management/${id}`),

  coordinatorGetSummary: (id: string) =>
    api.get<ApiResponse<CustomerSummary>>(`/admin/customers/${id}/summary`),

  adminCreate: (data: Record<string, unknown>) =>
    api.post<ApiResponse<Customer>>('/admin/customers', data),

  adminUpdate: (id: string, data: Record<string, unknown>) =>
    api.put<ApiResponse<Customer>>(`/admin/customers/${id}`, data),

  adminUpdateRegistrationDetails: (id: string, formData: FormData) =>
    api.put<ApiResponse<CustomerSummary>>(`/admin/customers/${id}/registration-details`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  adminToggleStatus: (id: string, isActive: boolean) =>
    api.put<ApiResponse<string>>(`/admin/customers/${id}/status`, isActive, {
      headers: { 'Content-Type': 'application/json' },
    }),

  adminSoftDelete: (id: string) =>
    api.delete<ApiResponse<string>>(`/admin/customers/${id}`),

  adminGetTrash: (params?: Record<string, unknown>) =>
    api.get<ApiResponse<PagedResult<Customer>>>('/admin/customers/trash', { params }),

  adminRestore: (id: string) =>
    api.put<ApiResponse<string>>(`/admin/customers/${id}/restore`, {}),

  adminGetSpecialPrices: (customerId: string) =>
    api.get<ApiResponse<PriceDetail[]>>(`/admin/customers/${customerId}/special-prices`),

  adminSaveSpecialPrices: (customerId: string, prices: PriceSpecialRequest[]) =>
    api.post<ApiResponse<string>>(`/admin/customers/${customerId}/special-prices`, prices),

  // Rep
  repGetCustomers: (params?: Record<string, unknown>) =>
    api.get<ApiResponse<PagedResult<Customer>>>('/rep/customers', { params }),

  repGetById: (id: string) =>
    api.get<ApiResponse<Customer>>(`/rep/customers/${id}`),

  repGetSummary: (id: string) =>
    api.get<ApiResponse<CustomerSummary>>(`/rep/customers/${id}/summary`),

  // Rep create customer
  repCreate: (data: Record<string, unknown>) =>
    api.post<ApiResponse<Customer>>('/rep/customers', data),

  // Customer
  customerGetProfile: () =>
    api.get<ApiResponse<Customer>>('/customer/profile'),

  customerUpdateProfile: (data: Record<string, unknown>) =>
    api.put<ApiResponse<Customer>>('/customer/profile', data),

  customerGetLedger: () =>
    api.get<ApiResponse<CustomerLedger>>('/customer/ledger'),
};
