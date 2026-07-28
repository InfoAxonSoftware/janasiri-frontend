import { useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck } from 'lucide-react';
import { notificationsApi } from '../../services/api/notificationsApi';
import { formatRelative } from '../../utils/formatters';
import type { Notification } from '../../types/notification.types';

interface NotificationPanelProps {
  open: boolean;
  onClose: () => void;
  userId?: string;
  accent?: 'indigo' | 'orange' | 'emerald';
}

export default function NotificationPanel({ open, onClose, userId, accent = 'indigo' }: NotificationPanelProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const queryClient = useQueryClient();

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
    queryKey: ['notifications', userId],
    queryFn: () => notificationsApi.getAll({ page: 1, pageSize: 40 }).then((r) => r.data.data),
    enabled: open && !!userId,
  });

  const markReadMut = useMutation({
    mutationFn: (id: string) => notificationsApi.markAsRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', userId] });
      queryClient.invalidateQueries({ queryKey: ['unread-count', userId] });
    },
  });

  const markAllReadMut = useMutation({
    mutationFn: () => notificationsApi.markAllAsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', userId] });
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

  if (!open) return null;

  const items = (data?.items || []) as Notification[];

  return (
    <div
      ref={panelRef}
      className="fixed top-16 left-3 right-3 max-h-[70vh] bg-white border border-slate-200 rounded-2xl shadow-2xl z-[70] overflow-hidden lg:absolute lg:top-[calc(100%+8px)] lg:left-auto lg:right-0 lg:w-[360px] lg:max-w-[92vw]"
    >
      <div className="px-3 py-2.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-slate-600" />
          <p className="text-xs font-semibold text-slate-700">Notifications</p>
        </div>
        <button
          onClick={() => markAllReadMut.mutate()}
          disabled={markAllReadMut.isPending || !items.some((n) => !n.isRead)}
          className={`text-[11px] font-medium disabled:text-slate-300 ${styles.actionText}`}
        >
          <span className="inline-flex items-center gap-1">
            <CheckCheck className="w-3.5 h-3.5" /> Mark all read
          </span>
        </button>
      </div>

      <div className="max-h-[420px] overflow-y-auto">
        {isLoading ? (
          <div className="px-3 py-4 text-[11px] text-slate-400">Loading notifications...</div>
        ) : items.length === 0 ? (
          <div className="px-3 py-6 text-center text-[11px] text-slate-400">No notifications yet</div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {items.map((n) => (
              <li
                key={n.id}
                onClick={() => {
                  if (!n.isRead) markReadMut.mutate(n.id);
                }}
                className={`px-3 py-2.5 cursor-pointer hover:bg-slate-50 transition ${n.isRead ? 'bg-white' : styles.unreadBg}`}
              >
                <div className="flex items-start gap-2">
                  <span className={`mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0 ${n.isRead ? 'bg-slate-300' : styles.dot}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold text-slate-800 truncate">{n.title}</p>
                    <p className="text-[11px] text-slate-600 mt-0.5 leading-4">{n.message}</p>
                    <p className="text-[10px] text-slate-400 mt-1">{formatRelative(n.createdAt)}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
