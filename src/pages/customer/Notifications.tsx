import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { notificationsApi } from '../../services/api/notificationsApi';
import { useAuth } from '../../hooks/useAuth';
import PageHeader from '../../components/common/PageHeader';
import { Bell, CheckCheck, Circle, Loader2 } from 'lucide-react';
import type { Notification } from '../../types/notification.types';

export default function CustomerNotifications() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const { user } = useAuth();
  const userId = user?.id;

  const { data, isLoading } = useQuery({
    queryKey: ['notifications', userId, page],
    queryFn: () => notificationsApi.getAll({ page, pageSize: 30 }).then((r) => r.data.data),
    enabled: !!userId,
  });

  const { data: unread } = useQuery({
    queryKey: ['unread-count', userId],
    queryFn: () => notificationsApi.getUnreadCount().then((r) => r.data.data),
    enabled: !!userId,
  });

  const markReadMut = useMutation({
    mutationFn: (id: string) => notificationsApi.markAsRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', userId] });
      queryClient.invalidateQueries({ queryKey: ['unread-count', userId] });
    },
  });

  const markAllMut = useMutation({
    mutationFn: () => notificationsApi.markAllAsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', userId] });
      queryClient.invalidateQueries({ queryKey: ['unread-count', userId] });
    },
  });

  const notifications = data?.items || [];

  const handleClick = (n: Notification) => {
    if (!n.isRead) markReadMut.mutate(n.id);
    if (n.metadata?.orderId) navigate(`/shop/orders/${n.metadata.orderId}`);
  };

  const formatTime = (dateStr: string | undefined) => {
    if (!dateStr) return 'Recently';
    try {
      if (!dateStr.endsWith('Z') && !dateStr.includes('+')) dateStr = dateStr + 'Z';
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return 'Recently';
      const now = new Date();
      const diff = now.getTime() - date.getTime();
      const mins = Math.floor(diff / 60000);
      if (mins < 1) return 'Just now';
      if (mins < 60) return `${mins}m ago`;
      const hours = Math.floor(mins / 60);
      if (hours < 24) return `${hours}h ago`;
      const days = Math.floor(hours / 24);
      if (days < 7) return `${days}d ago`;
      return date.toLocaleDateString();
    } catch {
      return 'Recently';
    }
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Notifications"
        subtitle={unread ? `${unread} unread` : 'All caught up'}
        actions={
          (unread ?? 0) > 0
            ? [
                {
                  label: markAllMut.isPending ? 'Marking...' : 'Mark all read',
                  icon: CheckCheck,
                  onClick: () => markAllMut.mutate(),
                  variant: 'secondary' as const,
                },
              ]
            : []
        }
      />

      <div className="px-4 lg:px-6 pb-6">
        {isLoading ? (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-10 h-10 bg-slate-100 rounded-xl animate-pulse" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3.5 bg-slate-100 rounded-full w-3/4 animate-pulse" />
                  <div className="h-3 bg-slate-100 rounded-full w-1/2 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : !notifications.length ? (
          <div className="text-center py-16 bg-white rounded-2xl shadow-sm border border-slate-100">
            <Bell className="w-14 h-14 text-slate-200 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">No notifications</p>
            <p className="text-xs text-slate-400 mt-1">You're all caught up!</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 divide-y divide-slate-50 overflow-hidden">
            {notifications.map((n: Notification) => (
              <div
                key={n.id}
                onClick={() => handleClick(n)}
                className={`flex items-start gap-3 px-5 py-4 transition cursor-pointer ${
                  n.isRead ? 'bg-white hover:bg-slate-50' : 'bg-orange-50/50 hover:bg-orange-50/70'
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    n.isRead ? 'bg-slate-50' : 'bg-orange-100'
                  }`}
                >
                  <Bell className={`w-5 h-5 ${n.isRead ? 'text-slate-300' : 'text-orange-500'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className={`text-sm leading-snug ${n.isRead ? 'text-slate-600' : 'font-semibold text-slate-900'}`}>
                      {n.title}
                      {n.metadata?.actorName && <span className="text-xs text-slate-500 ml-1">({n.metadata.actorName})</span>}
                    </p>
                    {!n.isRead && <Circle className="w-2 h-2 fill-orange-500 text-orange-500 flex-shrink-0 mt-1.5" />}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{n.message}</p>
                  <p className="text-[10px] text-slate-300 mt-1 font-medium">{formatTime(n.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-between pt-4">
            <span className="text-xs text-slate-400 font-medium">
              Page {page} of {data.totalPages}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-2 text-xs font-medium bg-white border border-slate-200 rounded-xl disabled:opacity-40 shadow-sm hover:bg-slate-50 transition"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= data.totalPages}
                className="px-4 py-2 text-xs font-medium bg-orange-600 text-white rounded-xl disabled:opacity-40 shadow-sm hover:bg-orange-700 transition"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
