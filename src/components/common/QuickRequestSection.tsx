// @ts-nocheck
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { quickRequestApi } from '../../services/api/quickRequestApi';
import type { QuickRequestDto } from '../../services/api/quickRequestApi';
import { downloadQuickRequestPdf } from '../../utils/quickRequestPdf';
import { downloadPrivateFile } from '../../utils/fileAccess';
import { PrivateImage } from './PrivateImage';
import toast from 'react-hot-toast';
import {
  ChevronDown, ChevronRight, X, Download, FileDown,
  Clock, CheckCircle, XCircle, Package, ZoomIn,
} from 'lucide-react';

const STATUS_STYLES: Record<string, string> = {
  Pending:   'bg-amber-50 text-amber-700 border border-amber-200',
  Approved:  'bg-emerald-50 text-emerald-700 border border-emerald-200',
  Rejected:  'bg-red-50 text-red-700 border border-red-200',
  Completed: 'bg-violet-50 text-violet-700 border border-violet-200',
};
const STATUS_ICONS: Record<string, React.ReactNode> = {
  Pending:   <Clock className="w-3 h-3" />,
  Approved:  <CheckCircle className="w-3 h-3" />,
  Rejected:  <XCircle className="w-3 h-3" />,
  Completed: <Package className="w-3 h-3" />,
};
const ADMIN_STATUSES = ['Pending', 'Approved', 'Rejected', 'Completed'];

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ── Image Lightbox ─────────────────────────────────────────────────────────────

function ImageLightbox({ apiPath, onClose }: { apiPath: string; onClose: () => void }) {
  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await downloadPrivateFile(apiPath, 'photo.jpg');
    } catch {
      toast.error('Download failed');
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] bg-black/92 flex items-center justify-center"
      onClick={onClose}
    >
      {/* Close */}
      <button
        className="absolute top-4 right-4 text-white bg-white/10 rounded-full p-2.5 hover:bg-white/25 transition z-10"
        onClick={onClose}
      >
        <X className="w-5 h-5" />
      </button>

      {/* Download */}
      <button
        className="absolute bottom-6 right-6 flex items-center gap-2 text-white bg-white/15 hover:bg-white/30 rounded-xl px-4 py-2.5 text-sm font-semibold transition z-10"
        onClick={handleDownload}
      >
        <Download className="w-4 h-4" /> Download Photo
      </button>

      {/* Image */}
      <PrivateImage
        apiPath={apiPath}
        alt="Preview"
        className="max-h-[88vh] max-w-[92vw] rounded-xl shadow-2xl object-contain"
        onClick={(e) => e.stopPropagation()}
      />
    </div>,
    document.body,
  );
}

// ── Admin Status Panel ────────────────────────────────────────────────────────

function AdminStatusPanel({ req, onDone }: { req: QuickRequestDto; onDone: () => void }) {
  const qc = useQueryClient();
  const [status, setStatus] = useState(req.status);
  const [notes, setNotes] = useState(req.adminNotes || '');

  const mut = useMutation({
    mutationFn: () => quickRequestApi.adminUpdateStatus(req.id, { status, adminNotes: notes }),
    onSuccess: () => {
      toast.success('Status updated');
      qc.invalidateQueries({ queryKey: ['quick-requests'] });
      onDone();
    },
    onError: () => toast.error('Failed to update status'),
  });

  return (
    <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
      <p className="text-xs font-bold text-slate-600">Update Status</p>
      <div className="flex flex-wrap gap-2">
        {ADMIN_STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`px-3 py-1 rounded-lg text-xs font-semibold border transition ${
              status === s
                ? STATUS_STYLES[s] + ' shadow-sm'
                : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
            }`}
          >
            {s}
          </button>
        ))}
      </div>
      <textarea
        rows={2}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Admin notes (optional)…"
        className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg bg-white resize-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 outline-none"
      />
      <div className="flex gap-2">
        <button
          onClick={() => mut.mutate()}
          disabled={mut.isPending}
          className="px-4 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-xs font-semibold transition disabled:opacity-50"
        >
          {mut.isPending ? 'Saving…' : 'Save'}
        </button>
        <button
          onClick={onDone}
          className="px-4 py-1.5 border border-slate-200 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-50 transition"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface QuickRequestSectionProps {
  type: 'Order' | 'Quotation';
  isAdmin?: boolean;
}

export default function QuickRequestSection({ type, isAdmin = false }: QuickRequestSectionProps) {
  const [statusFilter, setStatusFilter] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['quick-requests', type, statusFilter, isAdmin ? 'admin' : 'rep'],
    queryFn: () => isAdmin
      ? quickRequestApi.adminGetAll(type, statusFilter || undefined).then((r) => r.data.data)
      : quickRequestApi.repGetAll(type).then((r) => r.data.data),
    staleTime: 30_000,
  });

  const filtered = statusFilter
    ? requests.filter((r: QuickRequestDto) => r.status === statusFilter)
    : requests;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {lightboxUrl && <ImageLightbox apiPath={lightboxUrl} onClose={() => setLightboxUrl(null)} />}

      {/* Header toolbar */}
      <div className="px-5 py-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
            type === 'Order' ? 'bg-violet-100 text-violet-700' : 'bg-emerald-100 text-emerald-700'
          }`}>
            Quick {type}s
          </span>
          {!isLoading && (
            <span className="text-xs text-slate-400">{filtered.length} record{filtered.length !== 1 ? 's' : ''}</span>
          )}
        </div>
        {/* Status filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-600 focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 outline-none"
        >
          <option value="">All Statuses</option>
          {ADMIN_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="py-16 text-center">
          <div className="w-7 h-7 border-4 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-sm text-slate-400">No quick {type.toLowerCase()}s found</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {filtered.map((r: QuickRequestDto) => (
            <div key={r.id}>
              {/* Summary row */}
              <div
                className={`px-5 py-3.5 flex items-start gap-3 cursor-pointer transition ${
                  expandedId === r.id ? 'bg-violet-50/40' : 'hover:bg-slate-50/60'
                }`}
                onClick={() => {
                  setExpandedId(expandedId === r.id ? null : r.id);
                  if (editingId === r.id) setEditingId(null);
                }}
              >
                {/* Request number */}
                <span className={`mt-0.5 shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  type === 'Order' ? 'bg-violet-100 text-violet-700' : 'bg-emerald-100 text-emerald-700'
                }`}>{type === 'Order' ? 'QO' : 'QQ'}</span>

                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-slate-900">{r.requestNumber}</span>
                    <span className="text-sm text-slate-600 truncate">{r.customerName}</span>
                    {isAdmin && r.repName && (
                      <span className="text-xs text-slate-400">({r.repName})</span>
                    )}
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${STATUS_STYLES[r.status] ?? ''}`}>
                      {STATUS_ICONS[r.status]} {r.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-xs text-slate-400">{fmtDate(r.createdAt)}</span>
                    {r.imageUrls.length > 0 && (
                      <span className="text-[11px] text-slate-400 flex items-center gap-1">
                        <ZoomIn className="w-3 h-3" /> {r.imageUrls.length} photo{r.imageUrls.length > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </div>

                {/* Chevron */}
                {expandedId === r.id
                  ? <ChevronDown className="w-4 h-4 text-slate-400 shrink-0 mt-1" />
                  : <ChevronRight className="w-4 h-4 text-slate-400 shrink-0 mt-1" />}
              </div>

              {/* Expanded detail */}
              {expandedId === r.id && (
                <div className="px-5 pb-5 pt-3 space-y-4 border-t border-violet-100 bg-violet-50/20">

                  {/* Details */}
                  <div>
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                      {type === 'Order' ? 'Order' : 'Quotation'} Details
                    </p>
                    <pre className="text-sm text-slate-800 whitespace-pre-wrap font-sans leading-relaxed bg-white border border-slate-100 rounded-xl p-3">
                      {r.details}
                    </pre>
                  </div>

                  {/* Admin notes */}
                  {r.adminNotes && (
                    <div>
                      <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Admin Notes</p>
                      <p className="text-sm text-slate-700 bg-amber-50 border border-amber-100 rounded-xl p-3">{r.adminNotes}</p>
                    </div>
                  )}

                  {/* Photos */}
                  {r.imageUrls.length > 0 && (
                    <div>
                      <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-2">
                        Attached Photos ({r.imageUrls.length})
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {r.imageUrls.map((url: string, i: number) => (
                          <div
                            key={i}
                            className="relative w-24 h-24 rounded-xl overflow-hidden border border-slate-200 cursor-pointer group shadow-sm hover:shadow-md transition-shadow"
                            onClick={(e) => { e.stopPropagation(); setLightboxUrl(url); }}
                          >
                            <PrivateImage
                              apiPath={url}
                              alt={`Photo ${i + 1}`}
                              className="w-full h-full object-cover group-hover:opacity-90 transition"
                            />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition flex items-center justify-center">
                              <ZoomIn className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Admin status panel */}
                  {isAdmin && editingId === r.id && (
                    <AdminStatusPanel req={r} onDone={() => setEditingId(null)} />
                  )}

                  {/* Action buttons */}
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); downloadQuickRequestPdf(r); }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
                    >
                      <FileDown className="w-3.5 h-3.5" /> Download PDF
                    </button>
                    {isAdmin && editingId !== r.id && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setEditingId(r.id); }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-violet-200 rounded-lg text-xs font-semibold text-violet-700 hover:bg-violet-50 transition"
                      >
                        Update Status
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
