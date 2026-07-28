import { useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { supportApi } from '../../services/api/supportApi';
import { formatDate, statusColor } from '../../utils/formatters';
import { useSupportChatHub } from '../../hooks/useSupportChatHub';
import type { Complaint } from '../../types/common.types';

type LocationState = { complaint?: Complaint };

async function fetchAdminComplaintById(id: string): Promise<Complaint> {
  const pageSize = 50;
  const first = await supportApi.adminGetComplaints({ page: 1, pageSize });
  const firstData = first.data.data;
  const fromFirst = firstData.items.find((item: Complaint) => item.id === id);
  if (fromFirst) return fromFirst;

  for (let page = 2; page <= firstData.totalPages; page += 1) {
    const res = await supportApi.adminGetComplaints({ page, pageSize });
    const found = res.data.data.items.find((item: Complaint) => item.id === id);
    if (found) return found;
  }

  throw new Error('Ticket not found');
}

export default function AdminSupportDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const state = (location.state as LocationState) || {};
  const [messageText, setMessageText] = useState('');

  const initialComplaint = useMemo(() => {
    if (!id || !state.complaint) return undefined;
    return state.complaint.id === id ? state.complaint : undefined;
  }, [id, state.complaint]);

  const complaintQuery = useQuery({
    queryKey: ['admin-complaint', id],
    queryFn: () => fetchAdminComplaintById(id!),
    enabled: !!id,
    initialData: initialComplaint,
  });

  const complaint = complaintQuery.data;
  const isClosed = complaint?.status === 'Resolved' || complaint?.status === 'Closed';

  const { data: messages = [] } = useQuery({
    queryKey: ['admin-complaint-messages', id],
    queryFn: () => supportApi.adminGetMessages(id!).then(r => r.data.data || []),
    enabled: !!id,
  });

  const updateStatusMut = useMutation({
    mutationFn: ({ status }: { status: string }) => supportApi.adminUpdateStatus(id!, status),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['admin-complaints'] });
      queryClient.setQueryData(['admin-complaint', id], response.data.data);
      toast.success('Status updated');
    },
    onError: () => toast.error('Failed to update status'),
  });

  const sendMessageMut = useMutation({
    mutationFn: (message: string) => supportApi.adminSendMessage(id!, { message }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-complaint-messages', id] });
      setMessageText('');
    },
    onError: () => toast.error('Failed to send message'),
  });

  useSupportChatHub({
    complaintId: id,
    onMessage: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-complaint-messages', id] });
    },
    onStatusChanged: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-complaints'] });
      queryClient.invalidateQueries({ queryKey: ['admin-complaint', id] });
    },
  });

  const priorityColor = (p: string) => {
    switch (p?.toLowerCase()) {
      case 'high': case 'urgent': return 'bg-red-100 text-red-700';
      case 'medium': return 'bg-amber-100 text-amber-700';
      default: return 'bg-slate-100 text-slate-600';
    }
  };

  if (complaintQuery.isLoading) {
    return <div className="p-8 text-center text-slate-500">Loading ticket details...</div>;
  }

  if (complaintQuery.isError || !complaint) {
    return (
      <div className="space-y-4">
        <button onClick={() => navigate('/admin/support')} className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900">
          <ArrowLeft className="w-4 h-4" /> Back to support
        </button>
        <div className="bg-white border border-slate-200 rounded-2xl p-6 text-sm text-slate-600">Unable to load this ticket.</div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      <button onClick={() => navigate('/admin/support')} className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900">
        <ArrowLeft className="w-4 h-4" /> Back to support
      </button>

      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{complaint.subject}</h1>
            <p className="text-slate-500 text-sm mt-1">Customer: {complaint.customerName}</p>
            {complaint.contactName && (
              <p className="text-slate-500 text-sm mt-1">Contact: {complaint.contactName}</p>
            )}
            {complaint.contactPosition && (
              <p className="text-slate-500 text-sm mt-1">Position: {complaint.contactPosition}</p>
            )}
            {(complaint.contactEmail || complaint.contactPhone) && (
              <p className="text-slate-500 text-sm mt-1">
                {complaint.contactEmail && <>Email: {complaint.contactEmail}</>}
                {complaint.contactEmail && complaint.contactPhone && ' • '}
                {complaint.contactPhone && <>Phone: {complaint.contactPhone}</>}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${priorityColor(complaint.priority)}`}>{complaint.priority}</span>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColor(complaint.status)}`}>{complaint.status}</span>
          </div>
        </div>

        <div className="text-sm text-slate-700 bg-slate-50 rounded-xl p-4 leading-relaxed">{complaint.description}</div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
          <div className="bg-slate-50 rounded-xl p-3">
            <p className="text-xs text-slate-500">Created</p>
            <p className="font-medium mt-1">{formatDate(complaint.createdAt)}</p>
          </div>
          <div className="bg-slate-50 rounded-xl p-3">
            <p className="text-xs text-slate-500">Resolved</p>
            <p className="font-medium mt-1">{complaint.resolvedAt ? formatDate(complaint.resolvedAt) : 'Not yet'}</p>
          </div>
          <div className="bg-slate-50 rounded-xl p-3">
            <p className="text-xs text-slate-500">Ticket Type</p>
            <p className="font-medium mt-1">{complaint.ticketType || 'Complaint'}</p>
          </div>
        </div>

        <div>
          <p className="text-xs text-slate-500 mb-2">Update Status</p>
          <div className="flex flex-wrap gap-2">
            {['Open', 'InProgress', 'Resolved', 'Closed'].filter(s => s !== complaint.status).map(s => (
              <button key={s} onClick={() => updateStatusMut.mutate({ status: s })} disabled={updateStatusMut.isPending} className={`px-4 py-2 text-sm font-medium rounded-xl transition ${s === 'Resolved' ? 'bg-emerald-600 text-white hover:bg-emerald-700' : s === 'InProgress' ? 'bg-blue-600 text-white hover:bg-blue-700' : s === 'Closed' ? 'bg-slate-600 text-white hover:bg-slate-700' : 'bg-amber-500 text-white hover:bg-amber-600'}`}>
                {s === 'InProgress' ? 'In Progress' : s}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
        <p className="text-xs text-slate-500 mb-2">Conversation</p>
        <div className="h-72 overflow-y-auto border border-slate-200 rounded-xl p-3 space-y-2 bg-slate-50/60">
          {!messages.length ? <p className="text-xs text-slate-400">No messages yet</p> : messages.map(m => (
            <div key={m.id} className={`rounded-lg px-3 py-2 text-sm ${m.senderRole === 'Admin' ? 'bg-indigo-600 text-white ml-8' : m.isSystemMessage ? 'bg-slate-200 text-slate-700' : 'bg-white text-slate-800 mr-8 border border-slate-200'}`}>
              <div className="text-[11px] opacity-80 mb-1">{m.senderName} • {formatDate(m.createdAt)}</div>
              <div>{m.message}</div>
            </div>
          ))}
        </div>

        {isClosed && (
          <p className="mt-2 text-xs text-amber-600">This ticket is resolved/closed. Chat is disabled.</p>
        )}

        <div className="mt-2 flex gap-2">
          <input
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            placeholder={isClosed ? 'Ticket is closed' : 'Type a reply...'}
            disabled={isClosed}
            className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
          />
          <button
            onClick={() => sendMessageMut.mutate(messageText)}
            disabled={isClosed || !messageText.trim() || sendMessageMut.isPending}
            className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-medium disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
