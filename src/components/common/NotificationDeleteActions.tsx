import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { notificationQueryKeys, notificationsApi } from '../../services/api/notificationsApi';

type CommonProps = { userId?: string; onDeleted?: () => void };

function useNotificationDelete(userId?: string, onDeleted?: () => void) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (action: { id: string } | { readOnly: boolean }) => {
      if ('id' in action) await notificationsApi.deleteOne(action.id);
      else await notificationsApi.clear(action.readOnly);
    },
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: notificationQueryKeys.all(userId) }),
        client.invalidateQueries({ queryKey: ['unread-count', userId] }),
      ]);
      onDeleted?.();
      toast.success('Notifications updated');
    },
    onError: () => toast.error('Could not delete notifications. Please try again.'),
  });
}

export function DeleteNotificationButton({ userId, id, onDeleted }: CommonProps & { id: string }) {
  const mutation = useNotificationDelete(userId, onDeleted);
  return (
    <button
      type="button"
      title="Delete notification"
      aria-label="Delete notification"
      disabled={!userId || mutation.isPending}
      onClick={(event) => { event.stopPropagation(); mutation.mutate({ id }); }}
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 disabled:opacity-40"
    >
      <Trash2 className="h-4 w-4" />
    </button>
  );
}

export function ClearNotificationActions({ userId, onDeleted, disabled = false, compact = false }: CommonProps & { disabled?: boolean; compact?: boolean }) {
  const mutation = useNotificationDelete(userId, onDeleted);
  const clear = (readOnly: boolean) => {
    const message = readOnly
      ? 'Permanently delete all read notifications? Unread notifications will be kept.'
      : 'Permanently delete all your notifications, including unread ones? Orders and other records will not be deleted.';
    if (window.confirm(message)) mutation.mutate({ readOnly });
  };
  return (
    <div className={compact ? "flex flex-nowrap shrink-0 items-center gap-1" : "flex flex-wrap items-center gap-1.5"}>
      <button type="button" disabled={disabled || !userId || mutation.isPending} onClick={() => clear(true)}
        className={"whitespace-nowrap rounded-lg py-2 font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-40 " + (compact ? "px-2 text-[11px]" : "px-2.5 text-xs")}>
        Clear read
      </button>
      <button type="button" disabled={disabled || !userId || mutation.isPending} onClick={() => clear(false)}
        className={"inline-flex items-center gap-1 whitespace-nowrap rounded-lg py-2 font-medium text-red-600 hover:bg-red-50 disabled:opacity-40 " + (compact ? "px-2 text-[11px]" : "px-2.5 text-xs")}>
        <Trash2 className="h-3.5 w-3.5" /> Clear all
      </button>
    </div>
  );
}