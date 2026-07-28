import { useCallback, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notificationsApi } from '../services/api/notificationsApi';
import type { Notification } from '../types/notification.types';

export type NotificationSectionMap = Record<string, string[]>;

export function useSectionNotificationBadges(userId: string | undefined, sectionMap: NotificationSectionMap) {
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ['notifications', userId, 'unread-sections'],
    queryFn: () => notificationsApi.getAll({ page: 1, pageSize: 200, unreadOnly: true }).then((r) => r.data.data),
    enabled: !!userId,
  });

  const unreadItems = useMemo(() => (data?.items || []) as Notification[], [data]);

  const counts = useMemo(() => {
    const result: Record<string, number> = {};

    for (const [section, types] of Object.entries(sectionMap)) {
      result[section] = unreadItems.filter((n) => types.includes(n.notificationType)).length;
    }

    return result;
  }, [unreadItems, sectionMap]);

  const markManyMut = useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(ids.map((id) => notificationsApi.markAsRead(id)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', userId] });
      queryClient.invalidateQueries({ queryKey: ['unread-count', userId] });
    },
  });

  const markSectionAsRead = useCallback((section: string) => {
    const types = sectionMap[section] || [];
    if (!types.length) return;
    if (markManyMut.isPending) return;

    const ids = unreadItems.filter((n) => types.includes(n.notificationType)).map((n) => n.id);
    if (!ids.length) return;

    markManyMut.mutate(ids);
  }, [markManyMut, sectionMap, unreadItems]);

  return {
    counts,
    markSectionAsRead,
    isMarking: markManyMut.isPending,
  };
}
