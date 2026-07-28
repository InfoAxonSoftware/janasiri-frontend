import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationsApi } from '../../services/api/notificationsApi';
import { Bell, CheckCheck, Circle } from 'lucide-react';
import type { Notification } from '../../types/notification.types';
import { useAuth } from '../../hooks/useAuth';
import PageHeader from '../../components/common/PageHeader';
import { useNavigate } from 'react-router-dom';

export default function RepNotifications() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const { user } = useAuth();
  const userId = user?.id;

  const { data, isLoading } = useQuery({
    queryKey: ['notifications', userId, page],
    queryFn: () => notificationsApi.getAll({ page, pageSize: 30 }).then(r => r.data.data),
    enabled: !!userId,
  });

  const { data: unread } = useQuery({
    queryKey: ['unread-count', userId],
    queryFn: () => notificationsApi.getUnreadCount().then(r => r.data.data),
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
    if (n.metadata?.orderId) navigate(`/rep/orders/${n.metadata.orderId}`);
  };

  const formatTime = (dateStr: string | undefined) => {
    if (!dateStr) return 'Recently';
    try {
      if (!dateStr.endsWith('Z') && !dateStr.includes('+')) dateStr = dateStr + 'Z';
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return 'Recently';
      const diff = Date.now() - date.getTime();
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
    <div className="animate-fade-in space-y-4 lg:space-y-6">
      <PageHeader title="Notifications" subtitle={unread ? `${unread} unread` : 'All caught up'}
        actions={(unread ?? 0) > 0 ? [{
          label: markAllMut.isPending ? 'Marking...' : 'Mark all read',
          onClick: () => markAllMut.mutate(),
          icon: CheckCheck,
          variant: 'secondary' as const,
        }] : undefined}
      />

      {isLoading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="w-10 h-10 bg-slate-100 rounded-xl skeleton" />
              <div className="flex-1 space-y-1.5"><div className="h-3.5 bg-slate-100 rounded-full w-3/4 skeleton" /><div className="h-3 bg-slate-100 rounded-full w-1/2 skeleton" /></div>
            </div>
          ))}
        </div>
      ) : !notifications.length ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
          <Bell className="w-14 h-14 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No notifications</p>
          <p className="text-xs text-slate-400 mt-1">You&apos;re all caught up!</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-50 overflow-hidden">
          {notifications.map((n: Notification) => (
            <div key={n.id} onClick={() => handleClick(n)}
              className={`flex items-start gap-3 px-5 py-4 transition cursor-pointer ${n.isRead ? 'bg-white hover:bg-slate-50' : 'bg-emerald-50/40 hover:bg-emerald-50/60'}`}>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${n.isRead ? 'bg-slate-50' : 'bg-gradient-to-br from-emerald-100 to-green-100'}`}>
                <Bell className={`w-5 h-5 ${n.isRead ? 'text-slate-300' : 'text-emerald-600'}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className={`text-sm leading-snug ${n.isRead ? 'text-slate-600' : 'font-semibold text-slate-900'}`}>
                    {n.title}
                    {n.metadata?.customerName && <span className="text-xs text-slate-500 ml-1">({n.metadata.customerName})</span>}
                    {n.metadata?.actorName && <span className="text-xs text-slate-500 ml-1">by {n.metadata.actorName}</span>}
                  </p>
                  {!n.isRead && <Circle className="w-2 h-2 fill-emerald-500 text-emerald-500 flex-shrink-0 mt-1.5" />}
                </div>
                <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{n.message}</p>
                <p className="text-[10px] text-slate-300 mt-1 font-medium">{formatTime(n.createdAt)}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <span className="text-xs text-slate-400 font-medium">Page {page} of {data.totalPages}</span>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="px-4 py-2 text-xs font-medium bg-white border border-slate-200 rounded-xl disabled:opacity-40 shadow-sm">Previous</button>
            <button onClick={() => setPage(p => p + 1)} disabled={page >= data.totalPages}
              className="px-4 py-2 text-xs font-medium bg-emerald-600 text-white rounded-xl disabled:opacity-40 shadow-sm">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
