import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { MessageCircle, Plus, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatDate } from '../../utils/formatters';
import { useIsDesktop } from '../../hooks/useMediaQuery';
import { useSupportChatHub } from '../../hooks/useSupportChatHub';
import PageHeader from '../common/PageHeader';
import DataTable, { type Column } from '../common/DataTable';
import MobileTileList from '../common/MobileTileList';
import StatusBadge from '../common/StatusBadge';
import EmptyState from '../common/EmptyState';
import BottomSheet from '../common/BottomSheet';
import SupportTicketForm from './SupportTicketForm';
import type { Complaint, ComplaintMessage, CreateComplaintRequest, SendComplaintMessageRequest } from '../../types/common.types';

type SupportRoleConfig = {
  senderRole: 'Customer' | 'SalesRep' | 'SalesCoordinator';
  listQueryKey: string;
  messageQueryPrefix: string;
  lastReadStorageKey: string;
  desktopCreatePath: string;
  getComplaints: () => Promise<Complaint[]>;
  getMessages: (id: string) => Promise<ComplaintMessage[]>;
  sendMessage: (id: string, payload: SendComplaintMessageRequest) => Promise<unknown>;
  createTicket: (payload: CreateComplaintRequest) => Promise<unknown>;
};

type Props = {
  config: SupportRoleConfig;
};

export default function UnifiedSupportPage({ config }: Props) {
  const desktop = useIsDesktop();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const chatContainerRef = useRef<HTMLDivElement | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  const [messageText, setMessageText] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Open' | 'InProgress' | 'Resolved' | 'Closed'>('All');
  const [lastReadMap, setLastReadMap] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem(config.lastReadStorageKey);
    if (!saved) return {};
    try {
      return JSON.parse(saved) as Record<string, string>;
    } catch {
      return {};
    }
  });

  const isSelectedTicketClosed = selectedComplaint?.status === 'Resolved' || selectedComplaint?.status === 'Closed';

  const { data: complaints, isLoading } = useQuery({
    queryKey: [config.listQueryKey],
    queryFn: config.getComplaints,
  });

  const complaintList = complaints || [];

  const filteredComplaintList = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return complaintList.filter((ticket) => {
      const statusMatch = statusFilter === 'All' || ticket.status === statusFilter;
      if (!statusMatch) return false;

      if (!normalizedSearch) return true;

      return (
        ticket.subject.toLowerCase().includes(normalizedSearch) ||
        ticket.description.toLowerCase().includes(normalizedSearch) ||
        (ticket.ticketType || '').toLowerCase().includes(normalizedSearch)
      );
    });
  }, [complaintList, searchTerm, statusFilter]);

  const { data: messages = [] } = useQuery({
    queryKey: [config.messageQueryPrefix, selectedComplaint?.id],
    queryFn: () => config.getMessages(selectedComplaint!.id),
    enabled: !!selectedComplaint?.id,
  });

  const ticketMessageQueries = useQueries({
    queries: filteredComplaintList.map((ticket) => ({
      queryKey: [config.messageQueryPrefix, ticket.id, 'preview'],
      queryFn: () => config.getMessages(ticket.id),
      staleTime: 15000,
    })),
  });

  const unreadByTicket = useMemo(() => {
    const unreadMap: Record<string, number> = {};

    filteredComplaintList.forEach((ticket, index) => {
      const ticketMessages = (ticketMessageQueries[index]?.data || []) as ComplaintMessage[];
      const lastReadAt = lastReadMap[ticket.id] ? new Date(lastReadMap[ticket.id]).getTime() : 0;

      unreadMap[ticket.id] = ticketMessages.filter((m) => {
        if (m.senderRole === config.senderRole || m.isSystemMessage) return false;
        return new Date(m.createdAt).getTime() > lastReadAt;
      }).length;
    });

    return unreadMap;
  }, [filteredComplaintList, ticketMessageQueries, lastReadMap, config.senderRole]);

  useEffect(() => {
    localStorage.setItem(config.lastReadStorageKey, JSON.stringify(lastReadMap));
  }, [config.lastReadStorageKey, lastReadMap]);

  useEffect(() => {
    if (!selectedComplaint?.id || !messages.length) return;
    const latestMessage = messages[messages.length - 1];
    setLastReadMap((prev) => ({ ...prev, [selectedComplaint.id]: latestMessage.createdAt }));
  }, [selectedComplaint?.id, messages]);

  useEffect(() => {
    const container = chatContainerRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }, [messages.length, selectedComplaint?.id]);

  const sendMessageMut = useMutation({
    mutationFn: ({ id, message }: { id: string; message: string }) =>
      config.sendMessage(id, { message }),
    onSuccess: () => {
      if (selectedComplaint?.id) {
        queryClient.invalidateQueries({ queryKey: [config.messageQueryPrefix, selectedComplaint.id] });
        setMessageText('');
      }
    },
    onError: (error: any) => {
      const apiMessage = error?.response?.data?.message;
      toast.error(apiMessage || 'Failed to send message');
    },
  });

  useSupportChatHub({
    complaintId: selectedComplaint?.id,
    onMessage: () => {
      if (selectedComplaint?.id) {
        queryClient.invalidateQueries({ queryKey: [config.messageQueryPrefix, selectedComplaint.id] });
      }
    },
    onStatusChanged: (payload) => {
      queryClient.invalidateQueries({ queryKey: [config.listQueryKey] });
      setSelectedComplaint((prev) => (prev && prev.id === payload.complaintId ? { ...prev, status: payload.status } : prev));
    },
  });

  const handleNewComplaint = () => {
    if (desktop) {
      navigate(config.desktopCreatePath);
      return;
    }
    setShowForm(true);
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case 'Resolved':
        return <CheckCircle className="w-4 h-4 text-emerald-500" />;
      case 'InProgress':
        return <Clock className="w-4 h-4 text-blue-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-amber-500" />;
    }
  };

  const priorityBadge = (priority: string) => {
    const map: Record<string, string> = {
      High: 'bg-red-50 text-red-600',
      Low: 'bg-slate-100 text-slate-500',
      Medium: 'bg-orange-50 text-orange-600',
    };
    return map[priority] || map.Medium;
  };

  const columns: Column<Complaint>[] = [
    {
      key: 'subject',
      header: 'Subject',
      render: (c) => (
        <div className="flex items-center gap-2">
          {statusIcon(c.status)}
          <span className="font-medium text-slate-900">{c.subject}</span>
          {unreadByTicket[c.id] > 0 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-rose-500 text-white">{unreadByTicket[c.id]}</span>
          )}
          {c.ticketType && (
            <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-indigo-50 text-indigo-600">{c.ticketType}</span>
          )}
        </div>
      ),
    },
    {
      key: 'priority',
      header: 'Priority',
      render: (c) => <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${priorityBadge(c.priority)}`}>{c.priority}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (c) => <StatusBadge status={c.status} />,
    },
    {
      key: 'createdAt',
      header: 'Date',
      render: (c) => <span className="text-slate-500">{formatDate(c.createdAt)}</span>,
    },
    {
      key: 'resolvedAt',
      header: 'Resolved',
      render: (c) =>
        c.resolvedAt ? <span className="text-emerald-500 text-xs">{formatDate(c.resolvedAt)}</span> : <span className="text-slate-300">—</span>,
    },
  ];

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Support"
        subtitle="Create and track your tickets"
        actions={[{ label: 'Get Ticket', icon: Plus, onClick: handleNewComplaint }]}
      />

      <div className="px-4 lg:px-6 pb-6 space-y-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-3 sm:p-4">
          <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search tickets by subject, description, or type"
              className="w-full md:max-w-md rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
            <div className="flex flex-wrap gap-2">
              {(['All', 'Open', 'InProgress', 'Resolved', 'Closed'] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                    statusFilter === status ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {status === 'InProgress' ? 'In Progress' : status}
                </button>
              ))}
            </div>
          </div>
        </div>

        {desktop ? (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <div className="xl:col-span-2">
              <DataTable
                data={filteredComplaintList}
                columns={columns}
                keyField="id"
                isLoading={isLoading}
                page={1}
                totalPages={1}
                onPageChange={() => {}}
                onRowClick={setSelectedComplaint}
                emptyState={
                  <EmptyState
                    icon={MessageCircle}
                    title="No tickets"
                    description="Need help? Create a support ticket"
                    action={{ label: 'Get Ticket', onClick: handleNewComplaint }}
                  />
                }
              />
            </div>

            <div className="xl:col-span-1">
              {!selectedComplaint ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center sticky top-24">
                  <MessageCircle className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-700">Select a ticket to chat</p>
                  <p className="text-xs text-slate-500 mt-1">Click any ticket row to open conversation with support team.</p>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3 sticky top-24">
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-semibold text-slate-900 line-clamp-1">{selectedComplaint.subject}</h3>
                      <StatusBadge status={selectedComplaint.status} />
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      {selectedComplaint.ticketType && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-indigo-50 text-indigo-600">{selectedComplaint.ticketType}</span>
                      )}
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${priorityBadge(selectedComplaint.priority)}`}>{selectedComplaint.priority}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-2">Created {formatDate(selectedComplaint.createdAt)}</p>
                    <p className="text-sm text-slate-600 mt-2 whitespace-pre-wrap">{selectedComplaint.description}</p>
                  </div>

                  <div>
                    <p className="text-xs text-slate-400 font-medium mb-2">Conversation</p>
                    <div ref={chatContainerRef} className="h-72 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
                      {!messages.length ? (
                        <p className="text-xs text-slate-400">No messages yet</p>
                      ) : (
                        messages.map((m) => (
                          <div
                            key={m.id}
                            className={`rounded-lg px-3 py-2 text-sm ${
                              m.senderRole === config.senderRole
                                ? 'bg-indigo-600 text-white ml-8'
                                : m.isSystemMessage
                                  ? 'bg-slate-200 text-slate-700'
                                  : 'bg-white text-slate-800 border border-slate-200 mr-8'
                            }`}
                          >
                            <p className="text-[11px] opacity-80 mb-1">
                              {m.senderName} • {formatDate(m.createdAt)}
                            </p>
                            <p>{m.message}</p>
                          </div>
                        ))
                      )}
                    </div>

                    {isSelectedTicketClosed && (
                      <p className="text-xs text-amber-600 mt-2">This ticket is resolved/closed. Chat is disabled.</p>
                    )}

                    <div className="mt-2 flex gap-2">
                      <input
                        value={messageText}
                        onChange={(e) => setMessageText(e.target.value)}
                        placeholder={isSelectedTicketClosed ? 'Ticket is closed' : 'Type a message...'}
                        disabled={isSelectedTicketClosed}
                        className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                      />
                      <button
                        onClick={() => selectedComplaint && sendMessageMut.mutate({ id: selectedComplaint.id, message: messageText.trim() })}
                        disabled={isSelectedTicketClosed || !messageText.trim() || sendMessageMut.isPending}
                        className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-medium disabled:opacity-50"
                      >
                        Send
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <MobileTileList
            data={filteredComplaintList}
            keyField="id"
            isLoading={isLoading}
            page={1}
            totalPages={1}
            onPageChange={() => {}}
            onTileClick={setSelectedComplaint}
            emptyState={
              <EmptyState
                icon={MessageCircle}
                title="No tickets"
                description="Need help? Create a support ticket"
                action={{ label: 'Get Ticket', onClick: handleNewComplaint }}
              />
            }
            renderTile={(c) => (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    {statusIcon(c.status)}
                    <h3 className="text-sm font-semibold text-slate-900">{c.subject}</h3>
                  </div>
                  <div className="flex items-center gap-1">
                    {unreadByTicket[c.id] > 0 && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-rose-500 text-white">{unreadByTicket[c.id]}</span>
                    )}
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${priorityBadge(c.priority)}`}>{c.priority}</span>
                  </div>
                </div>
                {c.ticketType && <p className="text-[10px] text-indigo-600 font-semibold mb-1">{c.ticketType}</p>}
                <p className="text-xs text-slate-500 mb-3 line-clamp-2">{c.description}</p>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-400">{formatDate(c.createdAt)}</span>
                  <StatusBadge status={c.status} />
                </div>
                {c.resolvedAt && <p className="text-[10px] text-emerald-500 mt-2">Resolved on {formatDate(c.resolvedAt)}</p>}
              </div>
            )}
          />
        )}
      </div>

      <BottomSheet open={!!selectedComplaint && !desktop} onClose={() => setSelectedComplaint(null)} title={selectedComplaint?.subject || 'Ticket'}>
        {selectedComplaint && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <StatusBadge status={selectedComplaint.status} />
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${priorityBadge(selectedComplaint.priority)}`}>
                {selectedComplaint.priority}
              </span>
            </div>

            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-xs text-slate-400 font-medium mb-1">Description</p>
              <p className="text-sm text-slate-700">{selectedComplaint.description}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Created</p>
                <p className="text-sm font-semibold text-slate-900 mt-0.5">{formatDate(selectedComplaint.createdAt)}</p>
              </div>
              {selectedComplaint.resolvedAt && (
                <div className="bg-emerald-50 rounded-xl p-3">
                  <p className="text-[10px] text-emerald-400 font-medium uppercase tracking-wider">Resolved</p>
                  <p className="text-sm font-semibold text-emerald-700 mt-0.5">{formatDate(selectedComplaint.resolvedAt)}</p>
                </div>
              )}
            </div>

            {selectedComplaint.resolution && (
              <div className="bg-emerald-50 rounded-xl p-3">
                <p className="text-xs text-emerald-400 font-medium mb-1">Resolution</p>
                <p className="text-sm text-emerald-700">{selectedComplaint.resolution}</p>
              </div>
            )}

            <div>
              <p className="text-xs text-slate-400 font-medium mb-2">Conversation</p>
              <div ref={chatContainerRef} className="max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
                {!messages.length ? (
                  <p className="text-xs text-slate-400">No messages yet</p>
                ) : (
                  messages.map((m) => (
                    <div
                      key={m.id}
                      className={`rounded-lg px-3 py-2 text-sm ${
                        m.senderRole === config.senderRole
                          ? 'bg-indigo-600 text-white ml-8'
                          : m.isSystemMessage
                            ? 'bg-slate-200 text-slate-700'
                            : 'bg-white text-slate-800 border border-slate-200 mr-8'
                      }`}
                    >
                      <p className="text-[11px] opacity-80 mb-1">
                        {m.senderName} • {formatDate(m.createdAt)}
                      </p>
                      <p>{m.message}</p>
                    </div>
                  ))
                )}
              </div>

              {isSelectedTicketClosed && (
                <p className="text-xs text-amber-600">This ticket is resolved/closed. Chat is disabled.</p>
              )}

              <div className="mt-2 flex gap-2">
                <input
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder={isSelectedTicketClosed ? 'Ticket is closed' : 'Type a message...'}
                  disabled={isSelectedTicketClosed}
                  className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                />
                <button
                  onClick={() => selectedComplaint && sendMessageMut.mutate({ id: selectedComplaint.id, message: messageText.trim() })}
                  disabled={isSelectedTicketClosed || !messageText.trim() || sendMessageMut.isPending}
                  className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-medium disabled:opacity-50"
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        )}
      </BottomSheet>

      <BottomSheet open={showForm && !desktop} onClose={() => setShowForm(false)} title="Get Ticket">
        <SupportTicketForm
          listQueryKey={config.listQueryKey}
          createTicket={config.createTicket}
          onSuccess={() => setShowForm(false)}
          onCancel={() => setShowForm(false)}
        />
      </BottomSheet>
    </div>
  );
}
