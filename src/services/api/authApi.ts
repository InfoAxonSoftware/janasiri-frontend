import api from './axiosConfig';
import type { ApiResponse, PagedResult } from '../../types/api.types';
import type { LoginRequest, AuthResponse, RegisterRequest, ChangePasswordRequest, CreateAdminAccountRequest, UserInfo, AdminAccountInfo, UpdateAdminAccountRequest, AdminResetPasswordResult, LockedUserInfo, UnlockUserResult } from '../../types/auth.types';

export const authApi = {
  login: (data: LoginRequest) =>
    api.post<ApiResponse<AuthResponse>>('/auth/login', data),

  register: (data: RegisterRequest) =>
    api.post<ApiResponse<AuthResponse>>('/auth/register', data),

  refreshToken: (refreshToken: string, accessToken: string) =>
    api.post<ApiResponse<AuthResponse>>('/auth/refresh-token', { accessToken, refreshToken }),

  changePassword: (data: ChangePasswordRequest) =>
    api.post<ApiResponse<string>>('/auth/change-password', data),

  createAdminAccount: (data: CreateAdminAccountRequest) =>
    api.post<ApiResponse<UserInfo>>('/auth/create-admin', data),

  getAdminAccounts: () =>
    api.get<ApiResponse<AdminAccountInfo[]>>('/auth/admins'),

  getCurrentAdminProfile: () =>
    api.get<ApiResponse<AdminAccountInfo>>('/auth/admin-profile'),

  updateAdminAccount: (userId: string, data: UpdateAdminAccountRequest) =>
    api.put<ApiResponse<AdminAccountInfo>>(`/auth/admins/${userId}`, data),

  deleteAdminAccount: (userId: string) =>
    api.delete<ApiResponse<string>>(`/auth/admins/${userId}`),

  adminResetUserTempPassword: (userId: string) =>
    api.post<ApiResponse<AdminResetPasswordResult>>(`/auth/admin/users/${userId}/temp-password`),

  adminSetUserPassword: (userId: string, password: string) =>
    api.put<ApiResponse<string>>(`/auth/admin/users/${userId}/password`, { password }),

  logout: () =>
    api.post<ApiResponse<string>>('/auth/logout'),

  getLockedUsers: (params?: Record<string, unknown>) =>
    api.get<ApiResponse<PagedResult<LockedUserInfo>>>('/auth/admin/locked-users', { params }),

  unlockUser: (userId: string) =>
    api.post<ApiResponse<UnlockUserResult>>(`/auth/admin/users/${userId}/unlock`),
};
