import api from './axiosConfig';
import type { ApiResponse, PagedResult } from '../../types/api.types';
import type { Customer, PriceDetail, PriceSpecialRequest } from '../../types/customer.types';
import type { RepPerformance, Route } from '../../types/common.types';
import type {
  Coordinator,
  CreateCoordinatorRequest,
  UpdateCoordinatorRequest,
  CoordinatorDashboard,
  ApproveCustomerRequest,
  RejectCustomerRequest,
} from '../../types/coordinator.types';

// ===== Admin endpoints =====

export const adminGetAllCoordinators = async (page = 1, pageSize = 20, search?: string) => {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (search) params.set('search', search);
  const { data } = await api.get<ApiResponse<PagedResult<Coordinator>>>(`/admin/coordinators?${params}`);
  return data.data;
};

export const adminGetCoordinator = async (id: string) => {
  const { data } = await api.get<ApiResponse<Coordinator>>(`/admin/coordinators/${id}`);
  return data.data;
};

export const adminCreateCoordinator = async (req: CreateCoordinatorRequest) => {
  const { data } = await api.post<ApiResponse<Coordinator>>('/admin/coordinators', req);
  return data.data;
};

export const adminUpdateCoordinator = async (id: string, req: UpdateCoordinatorRequest) => {
  const { data } = await api.put<ApiResponse<Coordinator>>(`/admin/coordinators/${id}`, req);
  return data.data;
};

export const adminDeleteCoordinator = async (id: string) => {
  const { data } = await api.delete<ApiResponse<string>>(`/admin/coordinators/${id}`);
  return data.data;
};

export const adminGetTrashedCoordinators = async (page = 1, pageSize = 20) => {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  const { data } = await api.get<ApiResponse<PagedResult<Coordinator>>>(`/admin/coordinators/trash?${params}`);
  return data.data;
};

export const adminRestoreCoordinator = async (id: string) => {
  const { data } = await api.post<ApiResponse<string>>(`/admin/coordinators/${id}/restore`);
  return data.data;
};

export const adminAssignRepToCoordinator = async (coordinatorId: string, repId: string) => {
  const { data } = await api.post<ApiResponse<string>>(`/admin/coordinators/${coordinatorId}/assign-rep`, { repId });
  return data.data;
};

// ===== Coordinator own endpoints =====

export const coordinatorGetProfile = async () => {
  const { data } = await api.get<ApiResponse<Coordinator>>('/coordinator/profile');
  return data.data;
};

export const coordinatorUpdateProfile = async (req: { fullName?: string; phoneNumber?: string }) => {
  const { data } = await api.put<ApiResponse<Coordinator>>('/coordinator/profile', req);
  return data.data;
};

export const coordinatorGetDashboard = async () => {
  const { data } = await api.get<ApiResponse<CoordinatorDashboard>>('/coordinator/dashboard');
  return data.data;
};

export const coordinatorGetReps = async () => {
  const { data } = await api.get<ApiResponse<{ id: string; fullName: string; employeeCode: string; regionId?: string; regionName?: string; subRegionId?: string; subRegionName?: string; email?: string; phoneNumber?: string; isActive: boolean }[]>>('/coordinator/reps');
  return data.data;
};

export const coordinatorGetRepById = async (repId: string) => {
  const { data } = await api.get<ApiResponse<{ id: string; fullName: string; employeeCode: string; regionId?: string; regionName?: string; subRegionId?: string; subRegionName?: string; email?: string; phoneNumber?: string; isActive: boolean; assignedCustomersCount?: number; hireDate?: string; createdAt?: string }>>(`/coordinator/reps/${repId}`);
  return data.data;
};

export const coordinatorGetRepPerformance = async (repId: string, params?: { from?: string; to?: string }) => {
  const { data } = await api.get<ApiResponse<RepPerformance>>(`/coordinator/reps/${repId}/performance`, { params });
  return data.data;
};

export const coordinatorGetRepCustomers = async (repId: string, page = 1, pageSize = 50, search?: string) => {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (search) params.set('search', search);
  const { data } = await api.get<ApiResponse<PagedResult<Customer>>>(`/coordinator/reps/${repId}/customers?${params}`);
  return data.data;
};

export const coordinatorGetRepRoutes = async (repId: string) => {
  const { data } = await api.get<ApiResponse<Route[]>>(`/coordinator/reps/${repId}/routes`);
  return data.data;
};

export const coordinatorGetRoutes = async () => {
  const { data } = await api.get<ApiResponse<Route[]>>('/coordinator/routes');
  return data.data;
};

export const coordinatorCreateRoute = async (payload: { name: string; description?: string; repId?: string; daysOfWeek?: string[]; estimatedDurationMinutes?: number }) => {
  const body = {
    name: payload.name,
    description: payload.description,
    repId: payload.repId || undefined,
    daysOfWeek: JSON.stringify(payload.daysOfWeek || []),
    estimatedDurationMinutes: payload.estimatedDurationMinutes || 0,
    customers: [],
  };
  const { data } = await api.post<ApiResponse<Route>>('/coordinator/routes', body);
  return data.data;
};

export const coordinatorAssignRoute = async (routeId: string, repId: string) => {
  const { data } = await api.post<ApiResponse<string>>(`/coordinator/routes/${routeId}/assign`, { repId });
  return data.data;
};

export const coordinatorCreateRouteForRep = async (repId: string, payload: { name: string; description?: string; daysOfWeek?: string[]; estimatedDurationMinutes?: number }) => {
  const body = {
    name: payload.name,
    description: payload.description,
    repId,
    daysOfWeek: JSON.stringify(payload.daysOfWeek || []),
    estimatedDurationMinutes: payload.estimatedDurationMinutes || 0,
    customers: [],
  };
  const { data } = await api.post<ApiResponse<Route>>(`/coordinator/reps/${repId}/routes`, body);
  return data.data;
};

export const coordinatorAddCustomerToRoute = async (routeId: string, payload: { customerId: string; visitOrder: number; visitFrequency?: string }) => {
  const { data } = await api.post<ApiResponse<string>>(`/coordinator/routes/${routeId}/customers`, payload);
  return data.data;
};

export const coordinatorRemoveCustomerFromRoute = async (routeId: string, customerId: string) => {
  const { data } = await api.delete<ApiResponse<string>>(`/coordinator/routes/${routeId}/customers/${customerId}`);
  return data.data;
};

export const coordinatorDeleteRoute = async (routeId: string) => {
  const { data } = await api.delete<ApiResponse<string>>(`/coordinator/routes/${routeId}`);
  return data.data;
};

export const coordinatorGetCustomers = async (page = 1, pageSize = 20, search?: string) => {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (search) params.set('search', search);
  const { data } = await api.get<ApiResponse<PagedResult<Customer>>>(`/coordinator/customers?${params}`);
  return data.data;
};

export const coordinatorGetPendingApprovals = async (page = 1, pageSize = 20) => {
  const { data } = await api.get<ApiResponse<PagedResult<Customer>>>(`/coordinator/customers/pending?page=${page}&pageSize=${pageSize}`);
  return data.data;
};

export const coordinatorApproveCustomer = async (customerId: string, req: ApproveCustomerRequest) => {
  const { data } = await api.post<ApiResponse<Customer>>(`/coordinator/customers/${customerId}/approve`, req);
  return data.data;
};

export const coordinatorRejectCustomer = async (customerId: string, req: RejectCustomerRequest) => {
  const { data } = await api.post<ApiResponse<string>>(`/coordinator/customers/${customerId}/reject`, req);
  return data.data;
};

export const coordinatorGetSpecialPrices = async (customerId: string) => {
  const { data } = await api.get<ApiResponse<PriceDetail[]>>(`/coordinator/customers/${customerId}/special-prices`);
  return data.data;
};

export const coordinatorSaveSpecialPrices = async (customerId: string, prices: PriceSpecialRequest[]) => {
  const { data } = await api.post<ApiResponse<string>>(`/coordinator/customers/${customerId}/special-prices`, prices);
  return data.data;
};
