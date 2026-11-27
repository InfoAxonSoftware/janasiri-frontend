import type { Notification } from '../types/notification.types';
export function getGuestAssignmentRoute(notification: Notification): string | null {
  const id = notification.metadata?.quickRequestId;
  if (notification.metadata?.kind !== 'GuestOrderAssigned' || typeof id !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return null;
  return '/rep/orders?guestOrder=' + encodeURIComponent(id);
}
