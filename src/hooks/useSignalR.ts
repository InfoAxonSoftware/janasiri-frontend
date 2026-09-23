import { useEffect, useRef, useCallback } from 'react';
import {
  HubConnectionBuilder,
  HubConnection,
  LogLevel,
  HubConnectionState,
} from '@microsoft/signalr';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useAuth } from './useAuth';
import { paymentReportKeys } from '../services/queryKeys/paymentReportKeys';
import { notificationQueryKeys } from '../services/api/notificationsApi';
import type { Notification } from '../types/notification.types';

export interface PaymentReportEvent {
  eventType:
    | 'paymentReportCreated'
    | 'paymentReportStatusChanged'
    | 'paymentReportTrashed'
    | 'paymentReportRestored';
  reportId: string;
  salesRepUserId: string;
  coordinatorUserId?: string | null;
  oldStatus?: string | null;
  newStatus?: string | null;
  actionUrl?: string | null;
  occurredAt: string;
}

// Debounce helper — collapses rapid repeated calls into one invocation
// after `delay` ms.
function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  delay: number,
): T {
  let timer: ReturnType<typeof setTimeout> | null = null;

  return ((...args: unknown[]) => {
    if (timer) clearTimeout(timer);

    timer = setTimeout(() => {
      timer = null;
      fn(...args);
    }, delay);
  }) as T;
}

// Use dedicated SIGNALR_URL env var; fall back to deriving from API_URL.
const SIGNALR_BASE =
  import.meta.env.VITE_SIGNALR_URL ||
  (import.meta.env.VITE_API_URL || '/api').replace(/\/api$/, '') + '/hubs';

function getHubUrl(hubPath: string): string {
  const base = SIGNALR_BASE.endsWith('/')
    ? SIGNALR_BASE.slice(0, -1)
    : SIGNALR_BASE;

  // For relative paths, prefix with current origin so SignalR gets a full URL.
  if (base.startsWith('/')) {
    return `${window.location.origin}${base}/${hubPath}`;
  }

  return `${base}/${hubPath}`;
}

/**
 * Start a hub connection safely.
 *
 * Handles React StrictMode double-mount by using a cancelled flag
 * instead of calling stop() while negotiation is still in progress.
 */
function startConnection(
  conn: HubConnection,
  cancelled: { value: boolean },
  hubName: string,
) {
  conn
    .start()
    .then(() => {
      // If cleanup ran while negotiation was in progress,
      // stop the connection after it successfully starts.
      if (cancelled.value) {
        conn.stop();
      }
    })
    .catch((err) => {
      if (!cancelled.value) {
        console.warn(`${hubName} connection failed:`, err);
      }
    });
}

/**
 * Stop a hub connection only when it is safe to do so.
 */
function safeStop(
  conn: HubConnection,
  cancelled: { value: boolean },
) {
  cancelled.value = true;

  if (
    conn.state === HubConnectionState.Connected ||
    conn.state === HubConnectionState.Reconnecting
  ) {
    conn.stop();
  }
}

export function useSignalR() {
  const { isAuthenticated, user } = useAuth();
  const queryClient = useQueryClient();

  const notificationConn = useRef<HubConnection | null>(null);
  const orderConn = useRef<HubConnection | null>(null);

  const refreshQuotationQueries = useCallback(() => {
    const quotationKeys = [
      ['customer-quotations'],
      ['rep-quotations'],
      ['coordinator-quotations'],
      ['admin-quotations'],
    ] as const;

    for (const key of quotationKeys) {
      queryClient.invalidateQueries({ queryKey: key });
      queryClient.refetchQueries({
        queryKey: key,
        type: 'active',
      });
    }
  }, [queryClient]);

  const refreshOrderQueries = useCallback(() => {
    const orderKeys = [
      ['admin-orders'],
      ['rep-orders'],
      ['customer-orders'],
      ['coordinator-orders'],
      ['admin-order'],
      ['rep-order'],
      ['customer-order'],
      ['coordinator-order'],
    ] as const;

    for (const key of orderKeys) {
      queryClient.invalidateQueries({ queryKey: key });
    }
  }, [queryClient]);

  const refreshSupportQueries = useCallback(() => {
    const supportKeys = [
      ['admin-complaints'],
      ['customer-complaints'],
      ['rep-complaints'],
      ['coordinator-complaints'],
    ] as const;

    for (const key of supportKeys) {
      queryClient.invalidateQueries({ queryKey: key });
    }
  }, [queryClient]);

  const refreshPaymentReportQueries = useCallback(
    (reportId?: string) => {
      queryClient.invalidateQueries({
        queryKey: paymentReportKeys.all,
      });

      if (reportId) {
        (['admin', 'coordinator', 'rep'] as const).forEach(
          (role) => {
            queryClient.invalidateQueries({
              queryKey: paymentReportKeys.detail(role, reportId),
            });
          },
        );
      }
    },
    [queryClient],
  );

  const createConnection = useCallback(
    (hubPath: string): HubConnection => {
      const token = localStorage.getItem('accessToken') || '';

      return new HubConnectionBuilder()
        .withUrl(getHubUrl(hubPath), {
          accessTokenFactory: () => token,
        })
        .withAutomaticReconnect([
          0,
          2000,
          5000,
          10000,
          30000,
        ])
        .configureLogging(LogLevel.Warning)
        .build();
    },
    [],
  );

  // ---------------------------------------------------------------------------
  // NotificationHub
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!isAuthenticated) return;

    const cancelled = { value: false };
    const conn = createConnection('notifications');

    notificationConn.current = conn;

    /**
     * MAIN notification toast boundary.
     *
     * All persisted/in-app notifications arrive here.
     * This is the ONLY generic notification event that creates
     * the notification toast.
     */
    conn.on(
      'ReceiveNotification',
      (notification: Notification) => {
        toast(notification.message, {
          icon: '🔔',
          duration: 5000,
        });

        // Notification list/cache refresh.
        queryClient.invalidateQueries({
          queryKey: notificationQueryKeys.all(user?.id),
        });

        queryClient.invalidateQueries({
          queryKey: ['unread-count', user?.id],
        });

        // Quick request related data.
        queryClient.invalidateQueries({
          queryKey: ['rep-quick-orders'],
        });

        queryClient.invalidateQueries({
          queryKey: ['rep-quick-quotations'],
        });

        refreshOrderQueries();
        refreshQuotationQueries();
        refreshSupportQueries();
      },
    );

    /**
     * New Order event.
     *
     * IMPORTANT:
     * Do NOT show a second toast here.
     *
     * The backend notification flow already sends the
     * persisted notification through ReceiveNotification.
     *
     * This event is kept only for real-time data refresh.
     */
    conn.on(
      'NewOrder',
      (
        _data: {
          id: string;
          orderNumber: string;
          actorName?: string;
          customerName?: string;
          shopName?: string;
        },
      ) => {
        // Notification data/cache.
        queryClient.invalidateQueries({
          queryKey: notificationQueryKeys.all(user?.id),
        });

        queryClient.invalidateQueries({
          queryKey: ['unread-count', user?.id],
        });

        // Order-related data refresh.
        queryClient.invalidateQueries({
          queryKey: ['admin-orders'],
        });

        queryClient.invalidateQueries({
          queryKey: ['admin-dashboard'],
        });

        queryClient.invalidateQueries({
          queryKey: ['coordinator-orders'],
        });

        queryClient.invalidateQueries({
          queryKey: ['coordinator-quick-orders'],
        });
      },
    );

    /**
     * New Quick Request event.
     *
     * IMPORTANT:
     * Do NOT show a second toast here.
     *
     * The backend already persists and publishes the notification
     * through ReceiveNotification.
     *
     * This event is kept only for refreshing Quick Request data.
     */
    conn.on(
      'NewQuickRequest',
      (
        _data: {
          id: string;
          requestNumber: string;
          type: string;
          customerName: string;
          repName?: string;
        },
      ) => {
        // Notification data/cache.
        queryClient.invalidateQueries({
          queryKey: notificationQueryKeys.all(user?.id),
        });

        queryClient.invalidateQueries({
          queryKey: ['unread-count', user?.id],
        });

        // Quick Request data refresh.
        queryClient.invalidateQueries({
          queryKey: ['admin-quick-requests'],
        });

        queryClient.invalidateQueries({
          queryKey: ['admin-quick-orders'],
        });

        queryClient.invalidateQueries({
          queryKey: ['admin-quick-quotations'],
        });

        queryClient.invalidateQueries({
          queryKey: ['coordinator-quick-orders'],
        });

        queryClient.invalidateQueries({
          queryKey: ['coordinator-quick-quotations'],
        });
      },
    );

    /**
     * Fires after image upload.
     * Refresh data so newly uploaded images appear without
     * requiring a manual page refresh.
     */
    conn.on(
      'QuickRequestUpdated',
      (data: { id: string; type: string }) => {
        queryClient.invalidateQueries({
          queryKey: ['admin-quick-requests'],
        });

        queryClient.invalidateQueries({
          queryKey: ['admin-quick-orders'],
        });

        queryClient.invalidateQueries({
          queryKey: ['admin-quick-quotations'],
        });

        queryClient.invalidateQueries({
          queryKey: ['coordinator-quick-orders'],
        });

        queryClient.invalidateQueries({
          queryKey: ['coordinator-quick-quotations'],
        });
      },
    );

    /**
     * Order status updates have their own meaningful toast.
     * This is not a duplicate of the generic creation notification.
     */
    conn.on(
      'OrderStatusChanged',
      (data: {
        orderId: string;
        status: string;
      }) => {
        toast(
          `Order status updated to ${data.status}`,
          {
            icon: '📦',
            duration: 4000,
          },
        );

        refreshOrderQueries();
      },
    );

    /**
     * Product price update notification.
     */
    conn.on(
      'PriceUpdated',
      (data: {
        name: string;
        sellingPrice: number;
      }) => {
        toast(
          `Price updated: ${data.name}`,
          {
            icon: '💰',
            duration: 4000,
          },
        );

        queryClient.invalidateQueries({
          queryKey: ['admin-products'],
        });

        queryClient.invalidateQueries({
          queryKey: ['rep-catalog'],
        });
      },
    );

    /**
     * Payment report updates only refresh data.
     */
    conn.on(
      'PaymentReportEvent',
      (evt: PaymentReportEvent) => {
        refreshPaymentReportQueries(evt.reportId);
      },
    );

    /**
     * Product catalog updates are debounced because multiple product
     * changes can arrive in a short period.
     */
    conn.on(
      'ProductsUpdated',
      debounce(() => {
        toast(
          'Product catalog updated by admin',
          {
            icon: '🔄',
            duration: 4000,
          },
        );

        queryClient.invalidateQueries({
          queryKey: ['customer-products'],
        });

        queryClient.invalidateQueries({
          queryKey: ['customer-catalog'],
        });

        queryClient.invalidateQueries({
          queryKey: ['rep-catalog'],
        });

        queryClient.invalidateQueries({
          queryKey: ['admin-products'],
        });
      }, 3000),
    );

    startConnection(
      conn,
      cancelled,
      'NotificationHub',
    );

    return () => {
      safeStop(conn, cancelled);
    };
  }, [
    isAuthenticated,
    createConnection,
    queryClient,
    refreshOrderQueries,
    refreshQuotationQueries,
    refreshSupportQueries,
    refreshPaymentReportQueries,
    user?.id,
  ]);

  // ---------------------------------------------------------------------------
  // OrderTrackingHub
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!isAuthenticated) return;

    const cancelled = { value: false };
    const conn = createConnection('order-tracking');

    orderConn.current = conn;

    /**
     * OrderTrackingHub is used for live order-detail tracking.
     *
     * No toast here because NotificationHub owns the user-facing
     * OrderStatusChanged notification.
     */
    conn.on(
      'OrderStatusChanged',
      (_data: {
        orderId: string;
        status: string;
        reason?: string;
      }) => {
        refreshOrderQueries();
      },
    );

    startConnection(
      conn,
      cancelled,
      'OrderTrackingHub',
    );

    return () => {
      safeStop(conn, cancelled);
    };
  }, [
    isAuthenticated,
    createConnection,
    refreshOrderQueries,
  ]);

  // ---------------------------------------------------------------------------
  // Order group helpers
  // ---------------------------------------------------------------------------

  const joinOrderGroup = useCallback(
    async (orderId: string) => {
      if (
        orderConn.current?.state ===
        HubConnectionState.Connected
      ) {
        await orderConn.current.invoke(
          'JoinOrderGroup',
          orderId,
        );
      }
    },
    [],
  );

  const leaveOrderGroup = useCallback(
    async (orderId: string) => {
      if (
        orderConn.current?.state ===
        HubConnectionState.Connected
      ) {
        await orderConn.current.invoke(
          'LeaveOrderGroup',
          orderId,
        );
      }
    },
    [],
  );

  return {
    joinOrderGroup,
    leaveOrderGroup,
  };
}