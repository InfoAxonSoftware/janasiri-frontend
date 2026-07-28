import api from './axiosConfig';
import type { ApiResponse, PagedResult } from '../../types/api.types';
import type { Region, SubRegion } from '../../types/region.types';

export interface RegistrationRequest {
  id: string;
  customerType: string;
  customerName: string;
  businessRegistrationNumber?: string;
  registeredAddress?: string;
  incorporateDate?: string;
  businessName?: string;
  businessLocation?: string;
  telephone: string;
  email: string;
  bankBranch?: string;
  proprietorName?: string;
  proprietorTp?: string;
  proprietorEmail?: string;
  managerName?: string;
  managerTp?: string;
  managerEmail?: string;
  chefName?: string;
  chefTp?: string;
  chefEmail?: string;
  purchasingName?: string;
  purchasingTp?: string;
  purchasingEmail?: string;
  accountantName?: string;
  accountantTp?: string;
  accountantEmail?: string;
  province?: string;
  town?: string;
  businessRegDocUrl?: string;
  businessAddressDocUrl?: string;
  vatDocUrl?: string;
  status: string;
  rejectionReason?: string;
  reviewNotes?: string;
  assignedCoordinatorId?: string;
  assignedCoordinatorName?: string;
  regionId?: string;
  regionName?: string;
  subRegionId?: string;
  subRegionName?: string;
  assignedRepId?: string;
  assignedRepName?: string;
  reviewedAt?: string;
  createdAt: string;
  preferredUsername?: string;
  preferredPassword?: string;
}

export interface CoordinatorOption {
  id: string;
  name: string;
}

export const customerRegistrationApi = {
  /** Submit a registration form (anonymous – no auth required) */
  submit: (formData: FormData) =>
    api.post<ApiResponse<RegistrationRequest>>('/customer-registrations', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  /** Public: registration form region options */
  getPublicRegions: () =>
    api.get<ApiResponse<Region[]>>('/customer-registrations/regions'),

  /** Public: registration form sub-region options by region */
  getPublicSubRegions: (regionId: string) =>
    api.get<ApiResponse<SubRegion[]>>(`/customer-registrations/regions/${regionId}/sub-regions`),

  /** Admin: list all registration requests */
  adminGetAll: (params?: { page?: number; pageSize?: number; status?: string }) =>
    api.get<ApiResponse<PagedResult<RegistrationRequest>>>('/admin/customer-registrations', { params }),

  /** Admin: get single request */
  adminGetById: (id: string) =>
    api.get<ApiResponse<RegistrationRequest>>(`/admin/customer-registrations/${id}`),

  /** Admin: approve or reject a request */
  adminReview: (id: string, data: {
    action: 'Approve' | 'Reject';
    username?: string;
    password?: string;
    rejectionReason?: string;
    reviewNotes?: string;
    assignedCoordinatorId?: string;
    regionId?: string;
    subRegionId?: string;
  }) =>
    api.put<ApiResponse<RegistrationRequest>>(`/admin/customer-registrations/${id}/review`, data),

  /** Admin: create a customer directly (auto-approves + sends credentials email) */
  adminCreate: (formData: FormData) =>
    api.post<ApiResponse<RegistrationRequest>>('/admin/customer-registrations/admin-create', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  /** Admin: get coordinator options for assigning */
  adminGetCoordinators: () =>
    api.get<ApiResponse<CoordinatorOption[]>>('/admin/customer-registrations/coordinators'),

  /** Coordinator: list region-scoped registration requests */
  coordinatorGetAll: (params?: { page?: number; pageSize?: number; status?: string }) =>
    api.get<ApiResponse<PagedResult<RegistrationRequest>>>('/coordinator/customer-registrations', { params }),

  /** Coordinator: approve or reject a request */
  coordinatorReview: (id: string, data: {
    action: 'Approve' | 'Reject';
    password?: string;
    rejectionReason?: string;
    reviewNotes?: string;
    subRegionId?: string;
  }) =>
    api.put<ApiResponse<RegistrationRequest>>(`/coordinator/customer-registrations/${id}/review`, data),
};
