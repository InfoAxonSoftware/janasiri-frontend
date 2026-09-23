import { useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck, ChevronRight } from 'lucide-react';
import { notificationQueryKeys, notificationsApi } from '../../services/api/notificationsApi';
import { formatRelative } from '../../utils/formatters';
import type { Notification } from '../../types/notification.types';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

const RECENT_NOTIFICATION_LIMIT = 25;

const notificationRouteByRole: Record<string, string> = {
  Admin: '/admin/notifications',
  SuperAdmin: '/admin/notifications',
  SalesCoordinator: '/coordinator/notifications',
  SalesRep: '/rep/notifications',
  Customer: '/shop/notifications',
};

function deduplicateNotifications(items: Notification[]) {
  const ids = new Set<string>();
  return items.filter((notification) => {
    if (ids.has(notification.id)) return false;
    ids.add(notification.id);
    return true;
  });
}

interface NotificationPanelProps {
  open: boolean;
  onClose: () => void;
  userId?: string;
  accent?: 'indigo' | 'orange' | 'emerald';
}

export default function NotificationPanel({ open, onClose, userId, accent = 'indigo' }: NotificationPanelProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { user } = useAuth();

  const accentStyles = {
    indigo: {
      actionText: 'text-indigo-600',
      unreadBg: 'bg-indigo-50/40',
      dot: 'bg-indigo-500',
    },
    orange: {
      actionText: 'text-orange-600',
      unreadBg: 'bg-orange-50/50',
      dot: 'bg-orange-500',
    },
    emerald: {
      actionText: 'text-emerald-600',
      unreadBg: 'bg-emerald-50/50',
      dot: 'bg-emerald-500',
    },
  } as const;

  const styles = accentStyles[accent];

  const { data, isLoading } = useQuery({
    queryKey: notificationQueryKeys.list(userId, { page: 1, pageSize: RECENT_NOTIFICATION_LIMIT }),
    queryFn: () => notificationsApi.getAll({ page: 1, pageSize: RECENT_NOTIFICATION_LIMIT }).then((r) => r.data.data),
    enabled: open && !!userId,
    select: (result) => ({ ...result, items: deduplicateNotifications(result.items as Notification[]) }),
  });
  const items = (data?.items || []) as Notification[];

  const markReadMut = useMutation({
    mutationFn: (id: string) => notificationsApi.markAsRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationQueryKeys.all(userId) });
      queryClient.invalidateQueries({ queryKey: ['unread-count', userId] });
    },
  });

  const markAllReadMut = useMutation({
    mutationFn: () => notificationsApi.markAllAsRead(),
    onSuccess: () => {
      queryClient.setQueriesData({ queryKey: notificationQueryKeys.all(userId) }, (previous: { items?: Notification[] } | undefined) => {
        if (!previous?.items) return previous;
        return { ...previous, items: previous.items.map((notification) => ({ ...notification, isRead: true })) };
      });
      queryClient.setQueryData(['unread-count', userId], 0);
      queryClient.invalidateQueries({ queryKey: notificationQueryKeys.all(userId) });
      queryClient.invalidateQueries({ queryKey: ['unread-count', userId] });
    },
  });

  useEffect(() => {
    if (!open) return;

    const onMouseDown = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onEsc);

    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (open && listRef.current) listRef.current.scrollTop = 0;
  }, [open, data?.items]);

  if (!open) return null;

  const viewAllRoute = notificationRouteByRole[user?.role || ''];

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Notifications"
      className="fixed top-16 left-3 right-3 max-h-[70vh] bg-white border border-slate-200 rounded-2xl shadow-2xl z-[70] overflow-hidden flex flex-col lg:absolute lg:top-[calc(100%+8px)] lg:left-auto lg:right-0 lg:w-[360px] lg:max-w-[92vw]"
    >
      <div className="px-3 py-2.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-slate-600" />
          <p className="text-xs font-semibold text-slate-700">Notifications</p>
        </div>
        <button
          onClick={() => markAllReadMut.mutate()}
          disabled={markAllReadMut.isPending || !items.some((n) => !n.isRead)}
          aria-label="Mark all notifications as read"
          className={`text-[11px] font-medium disabled:text-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-indigo-500 rounded ${styles.actionText}`}
        >
          <span className="inline-flex items-center gap-1">
            <CheckCheck className="w-3.5 h-3.5" /> Mark all read
          </span>
        </button>
      </div>

      <div ref={listRef} className="max-h-[420px] min-h-0 overflow-y-auto" aria-live="polite">
        {isLoading ? (
          <div className="px-3 py-4 text-[11px] text-slate-400">Loading notifications...</div>
        ) : items.length === 0 ? (
          <div className="px-3 py-6 text-center text-[11px] text-slate-400">No notifications yet</div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {items.map((n) => (
              <li key={n.id} className={n.isRead ? 'bg-white' : styles.unreadBg}>
                <button
                  type="button"
                  onClick={() => {
                    if (!n.isRead) markReadMut.mutate(n.id);
                  }}
                  aria-label={`${n.isRead ? 'Read' : 'Unread'} notification: ${n.title}`}
                  className="w-full text-left px-3 py-2.5 hover:bg-slate-50 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500"
                >
                <div className="flex items-start gap-2">
                  <span className={`mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0 ${n.isRead ? 'bg-slate-300' : styles.dot}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold text-slate-800 truncate">{n.title}</p>
                    <p className="text-[11px] text-slate-600 mt-0.5 leading-4">{n.message}</p>
                    <p className="text-[10px] text-slate-400 mt-1">{formatRelative(n.createdAt)}</p>
                  </div>
                </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {viewAllRoute && (
        <div className="border-t border-slate-100 bg-slate-50/60 p-2">
          <button
            type="button"
            onClick={() => { onClose(); navigate(viewAllRoute); }}
            className={`w-full inline-flex items-center justify-center gap-1 rounded-lg px-3 py-2 text-xs font-semibold hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-indigo-500 ${styles.actionText}`}
          >
            View all notifications <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
