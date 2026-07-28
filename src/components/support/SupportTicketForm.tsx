import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import type { CreateComplaintRequest } from '../../types/common.types';

type Props = {
  listQueryKey: string;
  createTicket: (data: CreateComplaintRequest) => Promise<unknown>;
  onSuccess?: () => void;
  onCancel?: () => void;
};

export default function SupportTicketForm({ listQueryKey, createTicket, onSuccess, onCancel }: Props) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    subject: '',
    ticketType: 'Support' as 'Support' | 'Complaint',
    description: '',
    priority: 'Medium',
    orderId: '',
  });

  const createMut = useMutation({
    mutationFn: () =>
      createTicket({
        subject: form.subject.trim(),
        ticketType: form.ticketType,
        description: form.description.trim(),
        priority: form.priority,
        orderId: form.orderId.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success('Ticket submitted');
      queryClient.invalidateQueries({ queryKey: [listQueryKey] });
      setForm({
        subject: '',
        ticketType: 'Support',
        description: '',
        priority: 'Medium',
        orderId: '',
      });
      onSuccess?.();
    },
    onError: (error: any) => {
      const apiMessage = error?.response?.data?.message;
      toast.error(apiMessage || 'Failed to submit ticket');
    },
  });

  const canSubmit = form.subject.trim().length > 0 && form.description.trim().length > 0 && !createMut.isPending;

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1.5">Ticket Type</label>
        <div className="grid grid-cols-2 gap-2">
          {(['Support', 'Complaint'] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setForm((prev) => ({ ...prev, ticketType: type }))}
              className={`py-2.5 rounded-xl text-xs font-semibold transition-all ${
                form.ticketType === type ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-500 border border-slate-200'
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1.5">Subject</label>
        <input
          value={form.subject}
          onChange={(e) => setForm((prev) => ({ ...prev, subject: e.target.value }))}
          placeholder="Brief description of the issue"
          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none transition"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1.5">Description</label>
        <textarea
          value={form.description}
          onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
          placeholder="Provide details about the issue..."
          rows={4}
          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none resize-none transition"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1.5">Priority</label>
        <div className="flex gap-2">
          {['Low', 'Medium', 'High'].map((priority) => (
            <button
              key={priority}
              type="button"
              onClick={() => setForm((prev) => ({ ...prev, priority }))}
              className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                form.priority === priority ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-500 border border-slate-200'
              }`}
            >
              {priority}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1.5">
          Order ID <span className="text-slate-400 font-normal">(optional)</span>
        </label>
        <input
          value={form.orderId}
          onChange={(e) => setForm((prev) => ({ ...prev, orderId: e.target.value }))}
          placeholder="Related order ID"
          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none transition"
        />
      </div>

      <div className="grid grid-cols-2 gap-2 mt-2">
        <button type="button" onClick={onCancel} className="w-full py-2.5 bg-slate-100 rounded-lg text-sm font-medium">
          Cancel
        </button>
        <button
          type="button"
          onClick={() => createMut.mutate()}
          disabled={!canSubmit}
          className="w-full py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium disabled:opacity-60 inline-flex items-center justify-center gap-2"
        >
          {createMut.isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Submitting...
            </>
          ) : (
            'Submit Ticket'
          )}
        </button>
      </div>
    </div>
  );
}
