import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationQueryKeys, notificationsApi, type NotificationRecipient } from '../../services/api/notificationsApi';
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
  const [recipientMode, setRecipientMode] = useState<'all' | 'role' | 'users'>('all');
  const [broadcastRole, setBroadcastRole] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [page, setPage] = useState(1);

  const { user } = useAuth();
  const userId = user?.id;
  const navigate = useNavigate();
  const basePath = '/admin';

  const { data, isLoading } = useQuery({
    queryKey: notificationQueryKeys.list(userId, { page, pageSize: 30 }),
    queryFn: () => notificationsApi.getAll({ page, pageSize: 30 }).then(r => r.data.data),
    enabled: !!userId,
  });

  const notifications = data?.items || [];

  const { data: recipients = [], isLoading: recipientsLoading } = useQuery({
    queryKey: ['notification-recipients'],
    queryFn: () => notificationsApi.getRecipients().then((response) => response.data.data || []),
    enabled: showSend,
  });

  const markReadMut = useMutation({
    mutationFn: (id: string) => notificationsApi.markAsRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationQueryKeys.all(userId) });
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
      queryClient.invalidateQueries({ queryKey: notificationQueryKeys.all(userId) });
      queryClient.invalidateQueries({ queryKey: ['unread-count', userId] });
    },
  });

  const broadcastMut = useMutation({
    mutationFn: () =>
      notificationsApi.broadcast({
        title: broadcastTitle,
        message: broadcastMessage,
        sendToAll: recipientMode === 'all',
        role: recipientMode === 'role' ? broadcastRole : undefined,
        userIds: recipientMode === 'users' ? selectedUserIds : undefined,
      }),
    onSuccess: () => {
      setShowSend(false);
      setBroadcastTitle('');
      setBroadcastMessage('');
      setRecipientMode('all');
      setBroadcastRole('');
      setUserRoleFilter('');
      setSelectedUserIds([]);
    },
  });

  // FIXED: removed the invalid `| ''` type.
  const roleLabel = (role: NotificationRecipient['role']) => ({
    Admin: 'Admin',
    SuperAdmin: 'Super Admin',
    SalesCoordinator: 'Coordinator',
    SalesRep: 'Sales Rep',
    Customer: 'Customer',
  }[role] || role);

  const visibleRecipients = recipients.filter(
    (recipient) => !userRoleFilter || recipient.role === userRoleFilter,
  );

  const canSend = Boolean(
    broadcastTitle.trim() &&
    broadcastMessage.trim() &&
    (
      recipientMode === 'all' ||
      (recipientMode === 'role' && broadcastRole) ||
      (recipientMode === 'users' && selectedUserIds.length > 0)
    ),
  );

  const changeRecipientMode = (mode: 'all' | 'role' | 'users') => {
    setRecipientMode(mode);
    setSelectedUserIds([]);

    if (mode !== 'role') {
      setBroadcastRole('');
    }
  };

  const toggleUser = (id: string) => {
    setSelectedUserIds((ids) =>
      ids.includes(id)
        ? ids.filter((selectedId) => selectedId !== id)
        : [...ids, id],
    );
  };

  const typeIcon = (type: string) => {
    if (type === 'success') {
      return <CheckCircle className="w-4 h-4 text-green-500" />;
    }

    if (type === 'warning') {
      return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
    }

    return <Info className="w-4 h-4 text-indigo-500" />;
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Notifications
          </h1>

          <p className="text-slate-500 text-sm mt-1">
            System notifications and broadcasts
          </p>
        </div>

        <div className="flex items-center gap-2">
          {(notifications || []).some((n) => !n.isRead) && (
            <button
              onClick={() => markAllMut.mutate()}
              disabled={markAllMut.isPending}
              className="px-3 py-1.5 bg-slate-100 rounded-lg text-xs font-medium hover:bg-slate-200 transition flex items-center gap-1.5"
            >
              {markAllMut.isPending ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <CheckCheck className="w-3 h-3" />
              )}

              Mark all read
            </button>
          )}

          <button
            onClick={() => setShowSend(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition"
          >
            <Send className="w-4 h-4" />
            Broadcast
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
        {isLoading ? (
          <div className="p-8 text-center text-slate-500">
            Loading notifications...
          </div>
        ) : !notifications?.length ? (
          <div className="p-8 text-center">
            <Bell className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">No notifications</p>
          </div>
        ) : (
          notifications.map((n: Notification) => (
            <div
              key={n.id}
              onClick={() => handleClick(n)}
              className={`flex items-start gap-3 p-4 hover:bg-slate-50 transition ${
                !n.isRead ? 'bg-indigo-50/40' : ''
              }`}
            >
              <span className="mt-0.5">
                {typeIcon(n.notificationType)}
              </span>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900">
                  {n.title}

                  {n.metadata?.customerName && (
                    <span className="text-xs text-slate-500 ml-1">
                      ({n.metadata.customerName})
                    </span>
                  )}

                  {n.metadata?.actorName && (
                    <span className="text-xs text-slate-500 ml-1">
                      by {n.metadata.actorName}
                    </span>
                  )}
                </p>

                <p className="text-sm text-slate-600 mt-0.5">
                  {n.message}
                </p>

                <p className="text-xs text-slate-400 mt-1">
                  {formatRelative(n.createdAt)}
                </p>
              </div>

              {!n.isRead && (
                <button
                  onClick={() => markReadMut.mutate(n.id)}
                  className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1 flex-shrink-0"
                >
                  <CheckCheck className="w-3 h-3" />
                  Mark read
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <span className="text-xs text-slate-400 font-medium">
            Page {page} of {data.totalPages}
          </span>

          <div className="flex gap-2">
            <button
              onClick={() =>
                setPage((current) => Math.max(1, current - 1))
              }
              disabled={page === 1}
              className="px-4 py-2 text-xs font-medium bg-white border border-slate-200 rounded-xl disabled:opacity-40 shadow-sm hover:bg-slate-50 transition"
            >
              Previous
            </button>

            <button
              onClick={() => setPage((current) => current + 1)}
              disabled={page >= data.totalPages}
              className="px-4 py-2 text-xs font-medium bg-indigo-600 text-white rounded-xl disabled:opacity-40 shadow-sm hover:bg-indigo-700 transition"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Broadcast Modal */}
      {showSend && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setShowSend(false)}
          />

          <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">
              Broadcast Notification
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Title
                </label>

                <input
                  value={broadcastTitle}
                  onChange={(e) => setBroadcastTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none"
                  placeholder="Notification title"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Message
                </label>

                <textarea
                  value={broadcastMessage}
                  onChange={(e) => setBroadcastMessage(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none resize-none"
                  placeholder="Notification message"
                />
              </div>

              <fieldset>
                <legend className="block text-sm font-medium text-slate-700 mb-1">
                  Recipients
                </legend>

                <select
                  value={recipientMode}
                  onChange={(e) =>
                    changeRecipientMode(
                      e.target.value as 'all' | 'role' | 'users',
                    )
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none bg-white"
                >
                  <option value="all">
                    All active users
                  </option>

                  <option value="role">
                    Users in a role
                  </option>

                  <option value="users">
                    Select specific users
                  </option>
                </select>
              </fieldset>

              {recipientMode === 'all' && (
                <p className="rounded-lg bg-indigo-50 px-3 py-2 text-xs text-indigo-700">
                  This will send one notification to every active user.
                  Individual selections are disabled.
                </p>
              )}

              {recipientMode === 'role' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Target role
                  </label>

                  <select
                    value={broadcastRole}
                    onChange={(e) => setBroadcastRole(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none bg-white"
                  >
                    <option value="">
                      Select a role
                    </option>

                    <option value="Admin">
                      Admins
                    </option>

                    <option value="SuperAdmin">
                      Super Admins
                    </option>

                    <option value="SalesCoordinator">
                      Coordinators
                    </option>

                    <option value="SalesRep">
                      Sales Reps
                    </option>

                    <option value="Customer">
                      Customers
                    </option>
                  </select>
                </div>
              )}

              {recipientMode === 'users' && (
                <div>
                  <div className="flex items-center justify-between gap-3 mb-1">
                    <label className="block text-sm font-medium text-slate-700">
                      Select active users
                    </label>

                    <select
                      aria-label="Filter users by role"
                      value={userRoleFilter}
                      onChange={(e) => {
                        setUserRoleFilter(e.target.value);
                        setSelectedUserIds([]);
                      }}
                      className="px-2 py-1 border border-slate-300 rounded-md text-xs bg-white"
                    >
                      <option value="">
                        All roles
                      </option>

                      <option value="Admin">
                        Admins
                      </option>

                      <option value="SuperAdmin">
                        Super Admins
                      </option>

                      <option value="SalesCoordinator">
                        Coordinators
                      </option>

                      <option value="SalesRep">
                        Sales Reps
                      </option>

                      <option value="Customer">
                        Customers
                      </option>
                    </select>
                  </div>

                  <div className="max-h-44 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100">
                    {recipientsLoading ? (
                      <p className="px-3 py-3 text-xs text-slate-400">
                        Loading active users...
                      </p>
                    ) : visibleRecipients.length === 0 ? (
                      <p className="px-3 py-3 text-xs text-slate-400">
                        No active users match this role.
                      </p>
                    ) : (
                      visibleRecipients.map((recipient) => (
                        <label
                          key={recipient.id}
                          className="flex cursor-pointer items-center gap-2 px-3 py-2 hover:bg-slate-50"
                        >
                          <input
                            type="checkbox"
                            checked={selectedUserIds.includes(
                              recipient.id,
                            )}
                            onChange={() =>
                              toggleUser(recipient.id)
                            }
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />

                          <span className="min-w-0 flex-1 text-xs text-slate-700 truncate">
                            {recipient.username}{' '}
                            <span className="text-slate-400">
                              ({recipient.email})
                            </span>
                          </span>

                          <span className="text-[10px] font-medium text-slate-500">
                            {roleLabel(recipient.role)}
                          </span>
                        </label>
                      ))
                    )}
                  </div>

                  <p className="mt-1 text-[11px] text-slate-400">
                    {selectedUserIds.length} selected
                  </p>
                </div>
              )}

              {broadcastMut.isError && (
                <p className="text-xs text-red-600">
                  Unable to send notification. Check the recipient selection
                  and try again.
                </p>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowSend(false)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-medium transition"
              >
                Cancel
              </button>

              <button
                onClick={() => broadcastMut.mutate()}
                disabled={!canSend || broadcastMut.isPending}
                className="flex-1 py-2.5 bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg text-sm font-medium transition disabled:opacity-50"
              >
                {broadcastMut.isPending ? 'Sending...' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}