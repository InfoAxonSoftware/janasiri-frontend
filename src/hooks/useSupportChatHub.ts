import { useEffect } from 'react';
import { HubConnectionBuilder, LogLevel } from '@microsoft/signalr';
import type { ComplaintMessage } from '../types/common.types';
import { useAuth } from './useAuth';

const SIGNALR_BASE = import.meta.env.VITE_SIGNALR_URL
  || (import.meta.env.VITE_API_URL || '/api').replace(/\/api$/, '') + '/hubs';

function getHubUrl(hubPath: string): string {
  const base = SIGNALR_BASE.endsWith('/') ? SIGNALR_BASE.slice(0, -1) : SIGNALR_BASE;
  if (base.startsWith('/')) return `${window.location.origin}${base}/${hubPath}`;
  return `${base}/${hubPath}`;
}

type UseSupportChatHubOptions = {
  complaintId?: string;
  onMessage?: (message: ComplaintMessage) => void;
  onStatusChanged?: (payload: { complaintId: string; status: string }) => void;
};

export function useSupportChatHub({ complaintId, onMessage, onStatusChanged }: UseSupportChatHubOptions) {
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isAuthenticated || !complaintId) return;

    const token = localStorage.getItem('accessToken') || '';
    const connection = new HubConnectionBuilder()
      .withUrl(getHubUrl('support'), { accessTokenFactory: () => token })
      .withAutomaticReconnect([0, 2000, 5000, 10000])
      .configureLogging(LogLevel.Warning)
      .build();

    connection.on('SupportMessageReceived', (message: ComplaintMessage) => {
      if (!message?.complaintId || message.complaintId !== complaintId) return;
      onMessage?.(message);
    });

    connection.on('SupportStatusChanged', (payload: { complaintId: string; status: string }) => {
      if (!payload?.complaintId || payload.complaintId !== complaintId) return;
      onStatusChanged?.(payload);
    });

    void connection.start()
      .then(async () => {
        await connection.invoke('JoinComplaintGroup', complaintId);
      })
      .catch(() => {});

    return () => {
      void connection.invoke('LeaveComplaintGroup', complaintId).catch(() => {});
      void connection.stop();
    };
  }, [isAuthenticated, complaintId, onMessage, onStatusChanged]);
}
