import api from './axiosConfig';
import type { ApiResponse, PagedResult } from '../../types/api.types';
import type { RepPerformance, SalesTarget, Visit, Route, AdHocVisitRequest, RouteProgress } from '../../types/common.types';

export interface Rep {
  id: string;
  userId: string;
  username: string;
  fullName: string;
  employeeCode: string;
  hireDate: string;
  regionIds: string[];
  regionNames: string[];
  subRegionIds: string[];
  subRegionNames: string[];
  coordinatorIds: string[];
  coordinatorNames: string[];
  assignedCustomersCount?: number;
  email?: string;
  phoneNumber?: string;
  isActive: boolean;
  mustChangePassword: boolean;
  temporaryPassword?: string;
  createdAt: string;
}

export const repsApi = {
  // Admin
  adminGetAll: (params?: Record<string, unknown>) =>
    api.get<ApiResponse<PagedResult<Rep>>>('/admin/reps', { params }),

  adminGetById: (id: string) =>
    api.get<ApiResponse<Rep>>(`/admin/reps/${id}`),

  adminCreate: (data: { username?: string; email?: string; password: string; fullName: string; phoneNumber?: string; employeeCode?: string; hireDate?: string; regionIds?: string[]; subRegionIds?: string[]; coordinatorIds?: string[] }) =>
    api.post<ApiResponse<Rep>>('/admin/reps', data),

  adminUpdate: (id: string, data: { fullName?: string; employeeCode?: string; phoneNumber?: string; email?: string; hireDate?: string; regionIds?: string[]; subRegionIds?: string[]; coordinatorIds?: string[]; isActive?: boolean }) =>
    api.put<ApiResponse<Rep>>(`/admin/reps/${id}`, data),

  adminDelete: (id: string) =>
    api.delete<ApiResponse<string>>(`/admin/reps/${id}`),

  adminGetTrash: (params?: { page?: number; pageSize?: number }) =>
    api.get<ApiResponse<PagedResult<Rep>>>('/admin/reps/trash', { params }),

  adminRestore: (id: string) =>
    api.post<ApiResponse<string>>(`/admin/reps/${id}/restore`),

  adminUnassignCoordinator: (id: string) =>
    api.delete<ApiResponse<string>>(`/admin/reps/${id}/coordinator`),

  adminGetPerformance: (id: string, params?: Record<string, unknown>) =>
    api.get<ApiResponse<RepPerformance>>(`/admin/reps/${id}/performance`, { params }),

  adminSetTarget: (repId: string, data: Record<string, unknown>) =>
    api.post<ApiResponse<SalesTarget>>(`/admin/reps/${repId}/targets`, data),

  adminGetTargets: (repId: string) =>
    api.get<ApiResponse<SalesTarget[]>>(`/admin/reps/${repId}/targets`),

  adminDeleteTarget: (targetId: string) =>
    api.delete<ApiResponse<string>>(`/admin/targets/${targetId}`),

  adminCreateRoute: (data: { name: string; description?: string; repId?: string; daysOfWeek?: string; estimatedDurationMinutes?: number }) =>
    api.post<ApiResponse<Route>>('/admin/routes', data),

  adminGetRoutes: () =>
    api.get<ApiResponse<Route[]>>('/admin/routes'),

  adminAddCustomerToRoute: (routeId: string, data: { customerId: string; visitOrder: number; visitFrequency?: string }) =>
    api.post<ApiResponse<string>>(`/admin/routes/${routeId}/customers`, data),

  adminAssignRoute: (routeId: string, repId: string) =>
    api.post<ApiResponse<string>>(`/admin/routes/${routeId}/assign`, { repId }),

  adminDeleteRoute: (routeId: string) =>
    api.delete<ApiResponse<string>>(`/admin/routes/${routeId}`),

  adminRemoveCustomerFromRoute: (routeId: string, customerId: string) =>
    api.delete<ApiResponse<string>>(`/admin/routes/${routeId}/customers/${customerId}`),

  adminRemoveRepFromRoute: (routeId: string, repId: string) =>
    api.delete<ApiResponse<string>>(`/admin/routes/${routeId}/reps/${repId}`),

  adminGetRouteProgress: () =>
    api.get<ApiResponse<RouteProgress[]>>('/admin/routes/progress/today'),

  // Rep self
  repGetProfile: () =>
    api.get<ApiResponse<Rep>>('/rep/profile'),

  repUpdateProfile: (data: { fullName?: string; phoneNumber?: string; hireDate?: string }) =>
    api.put<ApiResponse<Rep>>('/rep/profile', data),

  repGetRoutes: () =>
    api.get<ApiResponse<Route[]>>('/rep/routes'),

  repGetRoute: (id: string) =>
    api.get<ApiResponse<Route>>(`/rep/routes/${id}`),

  repGetTodayVisits: () =>
    api.get<ApiResponse<Visit[]>>('/rep/visits/today'),

  repGetVisit: (id: string) =>
    api.get<ApiResponse<Visit>>(`/rep/visits/${id}`),

  repAddAdHocVisit: (data: AdHocVisitRequest) =>
    api.post<ApiResponse<Visit>>('/rep/visits/ad-hoc', data),

  repCheckIn: (data: Record<string, unknown>) =>
    api.post<ApiResponse<Visit>>('/rep/visits/check-in', data),

  repCheckOut: (visitId: string, data: Record<string, unknown>) =>
    api.post<ApiResponse<Visit>>(`/rep/visits/${visitId}/check-out`, data),

  repCancelVisit: (visitId: string) =>
    api.delete<ApiResponse<string>>(`/rep/visits/${visitId}`),

  repGetPerformance: () =>
    api.get<ApiResponse<RepPerformance>>('/rep/performance'),

  repGetTargets: () =>
    api.get<ApiResponse<SalesTarget[]>>('/rep/targets'),
};
