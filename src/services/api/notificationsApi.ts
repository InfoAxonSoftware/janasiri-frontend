import api from './axiosConfig';
import type { ApiResponse, PagedResult } from '../../types/api.types';
import type { Notification } from '../../types/notification.types';

export const notificationsApi = {
  getAll: (params?: Record<string, unknown>) =>
    api.get<ApiResponse<PagedResult<Notification>>>('/notifications', { params }),

  markAsRead: (id: string) =>
    api.put<ApiResponse<string>>(`/notifications/${id}/read`),

  markAllAsRead: () =>
    api.put<ApiResponse<string>>('/notifications/read-all'),

  getUnreadCount: () =>
    api.get<ApiResponse<number>>('/notifications/unread-count'),

  // Admin
  send: (data: { userId: string; title: string; message: string; type?: string; metadata?: string }) =>
    api.post<ApiResponse<string>>('/admin/notifications/send', data),

  broadcast: (data: { title: string; message: string; role?: string; type?: string; metadata?: string }) =>
    api.post<ApiResponse<string>>('/admin/notifications/broadcast', data),
};
