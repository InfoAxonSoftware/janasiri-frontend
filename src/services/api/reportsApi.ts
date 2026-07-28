import api from './axiosConfig';
import type { ApiResponse } from '../../types/api.types';
import type { DashboardData, SalesReport } from '../../types/common.types';

export const reportsApi = {
  getDashboard: () =>
    api.get<ApiResponse<DashboardData>>('/admin/reports/dashboard'),

  getSalesReport: (from: string, to: string, groupBy = 'day') =>
    api.get<ApiResponse<SalesReport>>('/admin/reports/sales', { params: { from, to, groupBy } }),

  getBestSelling: (params?: Record<string, unknown>) =>
    api.get<ApiResponse<unknown[]>>('/admin/reports/products/best-selling', { params }),

  getSlowMoving: (params?: Record<string, unknown>) =>
    api.get<ApiResponse<unknown[]>>('/admin/reports/products/slow-moving', { params }),

  getCustomerActivity: (params?: Record<string, unknown>) =>
    api.get<ApiResponse<unknown[]>>('/admin/reports/customers/activity', { params }),

  getLostCustomers: (params?: Record<string, unknown>) =>
    api.get<ApiResponse<unknown[]>>('/admin/reports/customers/lost', { params }),

  getOutstandingPayments: () =>
    api.get<ApiResponse<unknown[]>>('/admin/reports/payments/outstanding'),
};
