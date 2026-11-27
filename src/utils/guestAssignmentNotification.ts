import type { Notification } from '../types/notification.types';
export function getGuestAssignmentRoute(notification: Notification): string | null {
  const kind = notification.metadata?.kind;
  const id = kind === 'GuestOrderAssigned' || kind === 'QuickQuotationAssigned' ? notification.metadata?.quickRequestId : notification.metadata?.recordId;
  if (typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return null;
  if (kind === 'GuestOrderAssigned') return '/rep/orders?guestOrder=' + encodeURIComponent(id);
  if (kind === 'StandardOrderAssigned') return '/rep/orders/' + encodeURIComponent(id);
  if (kind === 'QuickQuotationAssigned') return '/rep/quotations?assignedQuick=' + encodeURIComponent(id);
  if (kind === 'StandardQuotationAssigned') return '/rep/quotations?assignedQuotation=' + encodeURIComponent(id);
  return null;
}