import api from './axiosConfig';
import type { ApiResponse, PagedResult } from '../../types/api.types';
import type { Notification } from '../../types/notification.types';

export interface NotificationListParams {
  page: number;
  pageSize: number;
  unreadOnly?: boolean;
}

export interface NotificationRecipient {
  id: string;
  username: string;
  email: string;
  role: 'Admin' | 'SuperAdmin' | 'SalesCoordinator' | 'SalesRep' | 'Customer';
}

export interface BroadcastNotificationData {
  title: string;
  message: string;
  role?: string;
  userIds?: string[];
  sendToAll?: boolean;
  type?: string;
  metadata?: string;
}

export const notificationQueryKeys = {
  all: (userId?: string) => ['notifications', userId] as const,
  list: (userId: string | undefined, { page, pageSize, unreadOnly = false }: NotificationListParams) =>
    ['notifications', userId, { page, pageSize, unreadOnly }] as const,
};

export const notificationsApi = {
  getAll: (params?: Record<string, unknown>) =>
    api.get<ApiResponse<PagedResult<Notification>>>('/notifications', { params }),

  markAsRead: (id: string) =>
    api.put<ApiResponse<string>>(`/notifications/${id}/read`),

  markAllAsRead: () =>
    api.put<ApiResponse<string>>('/notifications/read-all'),

  getUnreadCount: () =>
    api.get<ApiResponse<number>>('/notifications/unread-count'),

  getRecipients: () =>
    api.get<ApiResponse<NotificationRecipient[]>>('/admin/notifications/recipients'),

  // Admin
  send: (data: { userId: string; title: string; message: string; type?: string; metadata?: string }) =>
    api.post<ApiResponse<string>>('/admin/notifications/send', data),

  broadcast: (data: BroadcastNotificationData) =>
    api.post<ApiResponse<string>>('/admin/notifications/broadcast', data),
};
