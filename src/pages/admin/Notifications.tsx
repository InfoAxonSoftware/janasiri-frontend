import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationsApi } from '../../services/api/notificationsApi';
import { formatRelative } from '../../utils/formatters';
import { Bell, CheckCircle, Send, Info, AlertTriangle, CheckCheck, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import type { Notification } from '../../types/notification.types';

export default function AdminNotifications() {
  const queryClient = useQueryClient();
  const [showSend, setShowSend] = useState(false);
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcastRole, setBroadcastRole] = useState('');

  const { user } = useAuth();
  const userId = user?.id;
  const navigate = useNavigate();
  const basePath = '/admin';

  const { data, isLoading } = useQuery({
    queryKey: ['notifications', userId],
    queryFn: () => notificationsApi.getAll().then(r => r.data.data),
    enabled: !!userId,
  });

  const notifications = data?.items || [];

  const markReadMut = useMutation({
    mutationFn: (id: string) => notificationsApi.markAsRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', userId] });
      queryClient.invalidateQueries({ queryKey: ['unread-count', userId] });
    },
  });

  const handleClick = (n: Notification) => {
    if (!n.isRead) markReadMut.mutate(n.id);
    if (n.metadata?.orderId) {
      navigate(`${basePath}/orders/${n.metadata.orderId}`);
    }
  };

  const markAllMut = useMutation({
    mutationFn: () => notificationsApi.markAllAsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', userId] });
      queryClient.invalidateQueries({ queryKey: ['unread-count', userId] });
    },
  });

  const broadcastMut = useMutation({
    mutationFn: () => notificationsApi.broadcast({ title: broadcastTitle, message: broadcastMessage, role: broadcastRole || undefined }),
    onSuccess: () => { setShowSend(false); setBroadcastTitle(''); setBroadcastMessage(''); setBroadcastRole(''); },
  });

  const typeIcon = (type: string) => {
    // timezone handling not needed here since formatRelative handles the Z, but
    // when we later display createdAt we may append Z if missing in cells
    if (type === 'success') return <CheckCircle className="w-4 h-4 text-green-500" />;
    if (type === 'warning') return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
    return <Info className="w-4 h-4 text-indigo-500" />;
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Notifications</h1>
          <p className="text-slate-500 text-sm mt-1">System notifications and broadcasts</p>
        </div>

        <div className="flex items-center gap-2">
          {(notifications || []).some(n => !n.isRead) && (
            <button
              onClick={() => markAllMut.mutate()}
              disabled={markAllMut.isPending}
              className="px-3 py-1.5 bg-slate-100 rounded-lg text-xs font-medium hover:bg-slate-200 transition flex items-center gap-1.5"
            >
              {markAllMut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCheck className="w-3 h-3" />}
              Mark all read
            </button>
          )}

          <button
            onClick={() => setShowSend(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition"
          >
            <Send className="w-4 h-4" /> Broadcast
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
        {isLoading ? (
          <div className="p-8 text-center text-slate-500">Loading notifications...</div>
        ) : !notifications?.length ? (
          <div className="p-8 text-center">
            <Bell className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">No notifications</p>
          </div>
        ) : (
          notifications.map((n: Notification) => (
            <div key={n.id} onClick={() => handleClick(n)} className={`flex items-start gap-3 p-4 hover:bg-slate-50 transition ${!n.isRead ? 'bg-indigo-50/40' : ''}`}>
              <span className="mt-0.5">{typeIcon(n.notificationType)}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900">
                  {n.title}
                  {n.metadata?.customerName && (
                    <span className="text-xs text-slate-500 ml-1">({n.metadata.customerName})</span>
                  )}
                  {n.metadata?.actorName && (
                    <span className="text-xs text-slate-500 ml-1">by {n.metadata.actorName}</span>
                  )}
                </p>
                <p className="text-sm text-slate-600 mt-0.5">{n.message}</p>
                <p className="text-xs text-slate-400 mt-1">{formatRelative(n.createdAt)}</p>
              </div>
              {!n.isRead && (
                <button
                  onClick={() => markReadMut.mutate(n.id)}
                  className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1 flex-shrink-0"
                >
                  <CheckCheck className="w-3 h-3" /> Mark read
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {/* Broadcast Modal */}
      {showSend && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowSend(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Broadcast Notification</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
                <input value={broadcastTitle} onChange={(e) => setBroadcastTitle(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none" placeholder="Notification title" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Message</label>
                <textarea value={broadcastMessage} onChange={(e) => setBroadcastMessage(e.target.value)} rows={3} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none resize-none" placeholder="Notification message" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Target Role (optional)</label>
                <select value={broadcastRole} onChange={(e) => setBroadcastRole(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none bg-white">
                  <option value="">All Users</option>
                  <option value="SalesRep">Sales Reps</option>
                  <option value="Customer">Customers</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowSend(false)} className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-medium transition">Cancel</button>
              <button onClick={() => broadcastMut.mutate()} disabled={!broadcastTitle || !broadcastMessage} className="flex-1 py-2.5 bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg text-sm font-medium transition disabled:opacity-50">Send</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
