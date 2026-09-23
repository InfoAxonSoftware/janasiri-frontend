export type NotificationMetadataValue = string | number | boolean | null;
export type NotificationMetadata = Record<string, NotificationMetadataValue>;

export interface Notification {
  id: string;
  notificationType: string;
  title: string;
  message: string;
  isRead: boolean;
  readAt?: string;
  createdAt: string;
  metadata?: NotificationMetadata;
}
