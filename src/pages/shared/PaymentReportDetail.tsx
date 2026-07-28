import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Download, ExternalLink, Image as ImageIcon, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { repPaymentsApi } from '../../services/api/repPaymentsApi';
import StatusBadge from '../../components/common/StatusBadge';
import { formatDateTime, formatCurrency } from '../../utils/formatters';
import { downloadImage } from '../../utils/quickRequestPdf';
import { openPrivateFile } from '../../utils/fileAccess';
import { PrivateImage } from '../../components/common/PrivateImage';
import { paymentReportKeys, type PaymentReportRole } from '../../services/queryKeys/paymentReportKeys';

const STATUSES = ['AwaitingConfirmation', 'Confirmed', 'Approved', 'Rejected'] as const;

interface PaymentReportDetailProps {
  role: PaymentReportRole;
}

export default function PaymentReportDetail({ role }: PaymentReportDetailProps) {
  const { reportId } = useParams<{ reportId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [statusValue, setStatusValue] = useState('');
  const [notesValue, setNotesValue] = useState('');
  const [editingStatus, setEditingStatus] = useState(false);

  const fetchers: Record<PaymentReportRole, () => Promise<any>> = {
    admin: () => repPaymentsApi.getByIdAdmin(reportId!),
    coordinator: () => repPaymentsApi.getForCoordinatorById(reportId!),
    rep: () => repPaymentsApi.getRepById(reportId!),
  };

  const { data: payment, isLoading, isError, refetch } = useQuery({
    queryKey: paymentReportKeys.detail(role, reportId!),
    queryFn: fetchers[role],
    enabled: !!reportId,
    retry: false,
  });

  const updateMut = useMutation({
    mutationFn: (payload: { status: string; adminNotes?: string }) =>
      role === 'coordinator'
        ? repPaymentsApi.coordinatorUpdateStatus(reportId!, payload)
        : repPaymentsApi.updateStatus(reportId!, payload),
    onSuccess: (updated) => {
      qc.setQueryData(paymentReportKeys.detail(role, reportId!), updated);
      qc.invalidateQueries({ queryKey: paymentReportKeys.all });
      setEditingStatus(false);
      toast.success('Status updated');
    },
    onError: () => toast.error('Failed to update status'),
  });

  const backTo = `/${role}/payment-reports`;

  const handleDownload = async () => {
    if (!payment?.imageUrl) return;
    try {
      await downloadImage(payment.imageUrl, `payment-${payment.customerName}`);
    } catch {
      toast.error('Download failed');
    }
  };

  const openStatusEditor = () => {
    if (!payment) return;
    setStatusValue(payment.status);
    setNotesValue(payment.adminNotes ?? '');
    setEditingStatus(true);
  };

  const canChangeStatus = role === 'admin' || role === 'coordinator';

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 size={28} className="animate-spin text-slate-400" />
      </div>
    );
  }

  if (isError || !payment) {
    return (
      <div className="max-w-2xl mx-auto p-6 text-center space-y-3">
        <p className="text-slate-500 text-sm">This payment report could not be found, or you don't have access to it.</p>
        <div className="flex justify-center gap-2">
          <button onClick={() => refetch()} className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 hover:bg-slate-50">Retry</button>
          <button onClick={() => navigate(backTo)} className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 hover:bg-slate-50">Back to list</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
        <button onClick={() => navigate(backTo)} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700">
          <ArrowLeft size={16} /> Back to Payment Reports
        </button>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-6 space-y-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs text-slate-400 font-medium">{payment.reportNumber}</p>
              <h1 className="text-lg font-bold text-slate-800">{payment.customerName}</h1>
            </div>
            <StatusBadge status={payment.status} size="md" />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
            <div><p className="text-xs text-slate-500">Sales Rep</p><p className="font-medium">{payment.repName}</p></div>
            {payment.coordinatorName && (
              <div><p className="text-xs text-slate-500">Coordinator</p><p className="font-medium">{payment.coordinatorName}</p></div>
            )}
            <div><p className="text-xs text-slate-500">Reference #</p><p className="font-medium">{payment.referenceNumber || '—'}</p></div>
            <div><p className="text-xs text-slate-500">Amount</p><p className="font-semibold text-blue-700">{formatCurrency(payment.amount)}</p></div>
            <div><p className="text-xs text-slate-500">Submitted</p><p>{formatDateTime(payment.createdAt)}</p></div>
            {payment.updatedAt && (
              <div><p className="text-xs text-slate-500">Last Updated</p><p>{formatDateTime(payment.updatedAt)}{payment.updatedBy ? ` — ${payment.updatedBy}` : ''}</p></div>
            )}
          </div>

          {payment.adminNotes && (
            <div>
              <p className="text-xs text-slate-500 mb-1">Notes</p>
              <p className="text-sm italic bg-slate-50 rounded-xl px-3 py-2">{payment.adminNotes}</p>
            </div>
          )}

          <div>
            <p className="text-xs text-slate-500 mb-2">Payment Evidence</p>
            {payment.hasEvidence && payment.imageUrl ? (
              <div className="relative inline-block">
                <PrivateImage apiPath={payment.imageUrl} alt="evidence" className="max-h-80 rounded-xl border border-slate-200 object-contain" />
                <div className="absolute top-2 right-2 flex gap-1">
                  <button type="button" onClick={() => openPrivateFile(payment.imageUrl!)}
                    className="bg-white/90 rounded-lg p-1.5 hover:bg-white" title="Open full size">
                    <ExternalLink size={14} className="text-slate-600" />
                  </button>
                  <button onClick={handleDownload} className="bg-white/90 rounded-lg p-1.5 hover:bg-white" title="Download">
                    <Download size={14} className="text-slate-600" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-slate-400 bg-slate-50 rounded-xl px-4 py-6 justify-center">
                <ImageIcon size={20} /> <span className="text-sm">No evidence uploaded</span>
              </div>
            )}
          </div>

          {canChangeStatus && (
            <div className="border-t border-slate-100 pt-4">
              {!editingStatus ? (
                <button onClick={openStatusEditor}
                  className="bg-blue-600 text-white rounded-xl py-2 px-4 text-sm font-medium hover:bg-blue-700">
                  Change Status
                </button>
              ) : (
                <div className="space-y-3 max-w-sm">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
                    <select value={statusValue} onChange={e => setStatusValue(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                      {STATUSES.map(s => <option key={s} value={s}>{s.replace(/([a-z])([A-Z])/g, '$1 $2')}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Notes (optional)</label>
                    <textarea value={notesValue} onChange={e => setNotesValue(e.target.value)} rows={3}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Add a note…" />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setEditingStatus(false)} className="flex-1 border border-slate-200 rounded-xl py-2 text-sm hover:bg-slate-50">Cancel</button>
                    <button
                      onClick={() => updateMut.mutate({ status: statusValue, adminNotes: notesValue || undefined })}
                      disabled={updateMut.isPending}
                      className="flex-1 bg-blue-600 text-white rounded-xl py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-60 flex items-center justify-center gap-1">
                      {updateMut.isPending && <Loader2 size={14} className="animate-spin" />} Save
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
