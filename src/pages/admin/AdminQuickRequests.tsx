// @ts-nocheck
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { quickRequestApi } from '../../services/api/quickRequestApi';
import type { QuickRequestDto } from '../../services/api/quickRequestApi';
import toast from 'react-hot-toast';
import {
  ShoppingCart, FileText, ChevronDown, ChevronRight, Clock,
  CheckCircle, XCircle, Package, Sparkles, Eye, X,
} from 'lucide-react';
import ConfirmModal from '../../components/common/ConfirmModal';
import { PrivateImage } from '../../components/common/PrivateImage';

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUSES = ['Pending', 'Approved', 'Rejected', 'Completed'] as const;

const STATUS_STYLES: Record<string, string> = {
  Pending:   'bg-amber-50 text-amber-700 border border-amber-200',
  Approved:  'bg-emerald-50 text-emerald-700 border border-emerald-200',
  Rejected:  'bg-red-50 text-red-700 border border-red-200',
  Completed: 'bg-violet-50 text-violet-700 border border-violet-200',
};
const STATUS_ICONS: Record<string, JSX.Element> = {
  Pending:   <Clock className="w-3 h-3" />,
  Approved:  <CheckCircle className="w-3 h-3" />,
  Rejected:  <XCircle className="w-3 h-3" />,
  Completed: <Package className="w-3 h-3" />,
};

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

// ── Image full-screen modal ───────────────────────────────────────────────────

function ImageModal({ apiPath, onClose }: { apiPath: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" onClick={onClose}>
      <button className="absolute top-4 right-4 text-white bg-white/10 rounded-full p-2 hover:bg-white/20 transition" onClick={onClose}>
        <X className="w-5 h-5" />
      </button>
      <PrivateImage apiPath={apiPath} alt="Preview" className="max-h-[90vh] max-w-[90vw] rounded-xl shadow-2xl" onClick={e => e.stopPropagation()} />
    </div>
  );
}

// ── Status update panel (inline) ──────────────────────────────────────────────

function StatusPanel({ request, onClose }: { request: QuickRequestDto; onClose: () => void }) {
  const qc = useQueryClient();
  const [status, setStatus] = useState(request.status);
  const [notes, setNotes] = useState(request.adminNotes ?? '');

  const mut = useMutation({
    mutationFn: () => quickRequestApi.adminUpdateStatus(request.id, { status, adminNotes: notes || undefined }),
    onSuccess: () => {
      toast.success('Status updated');
      qc.invalidateQueries({ queryKey: ['admin-quick-requests'] });
      onClose();
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Update failed'),
  });

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-lg p-5 space-y-4" onClick={e => e.stopPropagation()}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-slate-900">Update Status</p>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition"><X className="w-4 h-4" /></button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {STATUSES.map(s => (
          <button key={s} onClick={() => setStatus(s)}
            className={`px-3 py-2 rounded-xl text-sm font-semibold transition text-left flex items-center gap-2 ${
              status === s ? STATUS_STYLES[s] + ' ring-2 ring-offset-1 ring-current' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
            }`}>
            {STATUS_ICONS[s]} {s}
          </button>
        ))}
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-500 mb-1">Admin Notes (optional)</label>
        <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)}
          placeholder="Add a note for the rep…"
          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 outline-none resize-none" />
      </div>

      <button onClick={() => mut.mutate()} disabled={mut.isPending}
        className="w-full py-2 bg-violet-600 text-white rounded-xl text-sm font-semibold hover:bg-violet-700 disabled:opacity-50 transition">
        {mut.isPending ? 'Saving…' : 'Save'}
      </button>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AdminQuickRequests() {
  const [activeTab, setActiveTab] = useState<'Order' | 'Quotation'>('Order');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [statusPanelId, setStatusPanelId] = useState<string | null>(null);
  const [fullPreview, setFullPreview] = useState<string | null>(null);

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['admin-quick-requests', activeTab, statusFilter],
    queryFn: () => quickRequestApi.adminGetAll(activeTab, statusFilter || undefined)
      .then(r => r.data.data),
    staleTime: 30_000,
  });

  const counts = {
    Order: requests.filter((r: QuickRequestDto) => r.type === 'Order').length,
    Quotation: requests.filter((r: QuickRequestDto) => r.type === 'Quotation').length,
  };

  return (
    <div className="animate-fade-in space-y-5 pb-10">
      {fullPreview && <ImageModal apiPath={fullPreview} onClose={() => setFullPreview(null)} />}

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-violet-500" /> Quick Requests
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Quick orders and quotations submitted by sales reps</p>
        </div>
      </div>

      {/* ── Tabs + filters ─────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3">
          {/* Type tabs */}
          <div className="inline-flex rounded-xl border border-slate-200 overflow-hidden">
            {(['Order', 'Quotation'] as const).map(t => (
              <button key={t} onClick={() => { setActiveTab(t); setExpandedId(null); setStatusPanelId(null); }}
                className={`px-4 py-2 text-sm font-semibold transition flex items-center gap-2 ${
                  activeTab === t
                    ? t === 'Order' ? 'bg-violet-600 text-white' : 'bg-emerald-600 text-white'
                    : 'bg-white text-slate-600 hover:bg-slate-50'
                }`}>
                {t === 'Order' ? <ShoppingCart className="w-3.5 h-3.5" /> : <FileText className="w-3.5 h-3.5" />}
                Quick {t}s
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-1 ${
                  activeTab === t ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                }`}>{activeTab === t ? requests.length : ''}</span>
              </button>
            ))}
          </div>

          {/* Status filter */}
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 outline-none">
            <option value="">All Statuses</option>
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="py-16 text-center">
            <div className="w-7 h-7 border-4 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : requests.length === 0 ? (
          <div className="py-16 text-center">
            <Sparkles className="w-10 h-10 mx-auto text-slate-200 mb-3" />
            <p className="text-sm text-slate-400">No quick {activeTab.toLowerCase()}s found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-[11px] uppercase tracking-wider">
                  <th className="text-left px-4 py-3 font-semibold">No.</th>
                  <th className="text-left px-4 py-3 font-semibold">Customer</th>
                  <th className="text-left px-4 py-3 font-semibold">Rep</th>
                  <th className="text-center px-3 py-3 font-semibold">Status</th>
                  <th className="text-center px-3 py-3 font-semibold">Photos</th>
                  <th className="text-left px-3 py-3 font-semibold">Date</th>
                  <th className="w-28 px-3 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {requests.map((r: QuickRequestDto) => (
                  <>
                    {/* Summary row */}
                    <tr key={r.id}
                      className={`transition-colors cursor-pointer ${expandedId === r.id ? 'bg-violet-50/50' : 'hover:bg-slate-50/60'}`}
                      onClick={() => { setExpandedId(expandedId === r.id ? null : r.id); setStatusPanelId(null); }}>
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs font-bold text-slate-700">{r.requestNumber}</span>
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-900">{r.customerName}</td>
                      <td className="px-4 py-3 text-slate-600">{r.repName}</td>
                      <td className="px-3 py-3 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold ${STATUS_STYLES[r.status]}`}>
                          {STATUS_ICONS[r.status]} {r.status}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center text-slate-500 text-xs">
                        {r.imageUrls.length > 0
                          ? <span className="flex items-center justify-center gap-1"><Eye className="w-3 h-3" />{r.imageUrls.length}</span>
                          : '—'}
                      </td>
                      <td className="px-3 py-3 text-slate-500 text-xs whitespace-nowrap">{fmtDate(r.createdAt)}</td>
                      <td className="px-3 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={e => { e.stopPropagation(); setStatusPanelId(statusPanelId === r.id ? null : r.id); setExpandedId(r.id); }}
                            className="px-2.5 py-1.5 text-xs font-semibold text-violet-600 bg-violet-50 rounded-lg hover:bg-violet-100 transition">
                            Status
                          </button>
                          {expandedId === r.id
                            ? <ChevronDown className="w-4 h-4 text-slate-400" />
                            : <ChevronRight className="w-4 h-4 text-slate-400" />}
                        </div>
                      </td>
                    </tr>

                    {/* Expanded detail */}
                    {expandedId === r.id && (
                      <tr key={`${r.id}-detail`}>
                        <td colSpan={7} className="p-0">
                          <div className="border-t-2 border-violet-100 bg-violet-50/30 px-6 py-5 space-y-5">
                            {/* Status panel inline */}
                            {statusPanelId === r.id && (
                              <div className="max-w-sm">
                                <StatusPanel request={r} onClose={() => setStatusPanelId(null)} />
                              </div>
                            )}

                            {/* Details */}
                            <div>
                              <p className="text-xs font-semibold text-slate-500 mb-1.5">
                                {r.type} Details
                              </p>
                              <pre className="text-sm text-slate-800 whitespace-pre-wrap font-sans leading-relaxed bg-white border border-slate-100 rounded-xl p-4">{r.details}</pre>
                            </div>

                            {/* Admin notes */}
                            {r.adminNotes && (
                              <div>
                                <p className="text-xs font-semibold text-slate-500 mb-1">Admin Notes</p>
                                <p className="text-sm text-slate-700 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">{r.adminNotes}</p>
                              </div>
                            )}

                            {/* Images */}
                            {r.imageUrls.length > 0 && (
                              <div>
                                <p className="text-xs font-semibold text-slate-500 mb-2">Attached Photos ({r.imageUrls.length})</p>
                                <div className="flex flex-wrap gap-3">
                                  {r.imageUrls.map((url, i) => (
                                    <PrivateImage key={i} apiPath={url} alt=""
                                      className="w-24 h-24 rounded-xl object-cover border border-slate-200 cursor-pointer hover:opacity-80 transition"
                                      onClick={() => setFullPreview(url)} />
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Meta */}
                            <div className="text-xs text-slate-400 flex flex-wrap gap-4 pt-1">
                              <span>Submitted by <strong className="text-slate-600">{r.repName}</strong></span>
                              <span>On <strong className="text-slate-600">{fmtDate(r.createdAt)}</strong></span>
                              {r.updatedAt && <span>Updated <strong className="text-slate-600">{fmtDate(r.updatedAt)}</strong></span>}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
