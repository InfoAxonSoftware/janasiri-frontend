import api from './axiosConfig';
import type { ApiResponse, PagedResult } from '../../types/api.types';
import type { Payment, CustomerLedger } from '../../types/payment.types';

export const paymentsApi = {
  // Admin
  adminGetAll: (params?: Record<string, unknown>) =>
    api.get<ApiResponse<PagedResult<Payment>>>('/admin/payments', { params }),

  adminVerify: (id: string) =>
    api.post<ApiResponse<Payment>>(`/admin/payments/${id}/verify`),

  adminGetCustomerLedger: (customerId: string) =>
    api.get<ApiResponse<CustomerLedger>>(`/admin/customers/${customerId}/ledger`),

  // Rep
  repRecord: (data: Record<string, unknown>) =>
    api.post<ApiResponse<Payment>>('/rep/payments', data),

  repGetAll: (params?: Record<string, unknown>) =>
    api.get<ApiResponse<PagedResult<Payment>>>('/rep/payments', { params }),

  repGetCustomerBalance: (customerId: string) =>
    api.get<ApiResponse<CustomerLedger>>(`/rep/customers/${customerId}/balance`),

  // Customer
  customerGetHistory: (params?: Record<string, unknown>) =>
    api.get<ApiResponse<PagedResult<Payment>>>('/customer/payments', { params }),

  customerGetBalance: () =>
    api.get<ApiResponse<CustomerLedger>>('/customer/balance'),
};
