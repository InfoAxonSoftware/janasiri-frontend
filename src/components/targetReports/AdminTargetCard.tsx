// @ts-nocheck
import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Calendar, Trash2, Upload, RefreshCw, Eye, EyeOff, History,
  Loader2, ChevronDown, ChevronRight, X,
} from 'lucide-react';
import { formatCurrency, formatDate, formatDateTime } from '../../utils/formatters';
import { targetReportsApi } from '../../services/api/targetReportsApi';
import { parseDetailedSalesReport } from '../../utils/targetReportParser';
import ConfirmModal from '../common/ConfirmModal';
import TargetReportDetailPanel from './TargetReportDetailPanel';

interface AdminTargetCardProps {
  target: any;
  repId: string;
  onDeleteClick: (id: string) => void;
}

export default function AdminTargetCard({ target: t, repId, onDeleteClick }: AdminTargetCardProps) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [historyReportId, setHistoryReportId] = useState<string | null>(null);
  const [confirmOlder, setConfirmOlder] = useState<{ payload: any } | null>(null);

  const pct = t.targetAmount > 0 ? Math.min(Math.round(t.achievementPercentage), 100) : 0;

  const { data: currentReport, isLoading: currentLoading } = useQuery({
    queryKey: ['admin-target-report-current', t.id],
    queryFn: () => targetReportsApi.getCurrent(t.id).then(r => r.data.data),
    enabled: viewOpen && t.hasReport,
  });

  const { data: history = [], isLoading: historyLoading } = useQuery({
    queryKey: ['admin-target-report-history', t.id],
    queryFn: () => targetReportsApi.getHistory(t.id).then(r => r.data.data),
    enabled: historyOpen,
  });

  const { data: historyDetail, isLoading: historyDetailLoading } = useQuery({
    queryKey: ['admin-target-report-detail', historyReportId],
    queryFn: () => targetReportsApi.getById(historyReportId!).then(r => r.data.data),
    enabled: !!historyReportId,
  });

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ['admin-rep-targets', repId] });
    qc.invalidateQueries({ queryKey: ['admin-target-report-current', t.id] });
    qc.invalidateQueries({ queryKey: ['admin-target-report-history', t.id] });
  };

  const uploadMut = useMutation({
    mutationFn: (payload: any) => targetReportsApi.upload(t.id, payload),
    onSuccess: () => {
      invalidateAll();
      setConfirmOlder(null);
      toast.success('Sales report uploaded');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Upload failed'),
  });

  const doUpload = (
    entries: any[],
    sourceRows: any[],
    fileName: string,
    force: boolean,
  ) => {
    uploadMut.mutate({
      originalFileName: fileName,
      entries,
      sourceRows,
      force,
    });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setUploading(true);
    try {
      const buffer = await file.arrayBuffer();
      let parsed;
      try {
        parsed = parseDetailedSalesReport(buffer);
      } catch (err: any) {
        toast.error(err?.message || 'Could not read Excel file.');
        return;
      }

      if (!parsed.entries.length) {
        toast.error('No valid Invoice rows found in the file.');
        return;
      }

      const needsConfirm = t.hasReport && t.reportAsAtDate
        && parsed.asAtDate && new Date(parsed.asAtDate) < new Date(t.reportAsAtDate);

      if (needsConfirm) {
        setConfirmOlder({
          payload: {
            entries: parsed.entries,
            sourceRows: parsed.sourceRows,
            fileName: file.name,
          },
        });
      } else {
        doUpload(parsed.entries, parsed.sourceRows, file.name, false);
      }
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="w-full min-w-0 overflow-hidden bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-bold text-slate-900">
              {t.targetName?.trim() || `${t.targetPeriod} Target`}
            </span>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
              t.performanceStatus === 'Target Achieved' || t.performanceStatus === 'Target Exceeded'
                ? 'bg-blue-50 text-blue-700 border-blue-200'
                : t.performanceStatus === 'On Track'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-slate-100 text-slate-600 border-slate-200'
            }`}>{t.performanceStatus}</span>
          </div>
          <p className="text-xs text-slate-400 flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {formatDate(t.startDate)} – {formatDate(t.endDate)}
          </p>
        </div>
        <button
          onClick={() => onDeleteClick(t.id)}
          className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-slate-500">Progress</span>
        <span className="text-sm font-bold text-slate-900">{pct}%</span>
      </div>
      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mb-2">
        <div
          className={`h-full rounded-full transition-all duration-700 ${pct >= 100 ? 'bg-blue-600' : 'bg-blue-400'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-slate-500">{formatCurrency(t.achievedAmount)}</span>
        <span className="text-xs text-slate-400">of {formatCurrency(t.targetAmount)}</span>
      </div>

      {t.hasReport && (
        <div className="grid grid-cols-2 gap-2 mb-3 text-xs bg-slate-50 rounded-xl p-3">
          <div><span className="text-slate-400">As At: </span><span className="font-medium text-slate-700">{formatDate(t.reportAsAtDate)}</span></div>
          <div>
            {t.exceededBy > 0
              ? <><span className="text-slate-400">Exceeded By: </span><span className="font-medium text-blue-700">{formatCurrency(t.exceededBy)}</span></>
              : <><span className="text-slate-400">Balance: </span><span className="font-medium text-amber-700">{formatCurrency(t.balanceRemaining)}</span></>}
          </div>
          <div className="col-span-2 truncate"><span className="text-slate-400">Source: </span><span className="font-medium text-slate-600">{t.reportSourceFileName || '—'}</span></div>
          <div className="col-span-2"><span className="text-slate-400">Last Updated: </span><span className="font-medium text-slate-600">{formatDateTime(t.reportUploadedAt)}</span></div>
        </div>
      )}

      {/* Report actions footer */}
      <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-100">
        <button
          disabled={uploading || uploadMut.isPending}
          onClick={() => fileRef.current?.click()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50 transition"
        >
          {uploading || uploadMut.isPending ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
          {t.hasReport ? 'Update Sales Report' : 'Upload Sales Report'}
        </button>
        <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileSelect} />

        {t.hasReport && (
          <button
            onClick={() => setViewOpen(v => !v)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              viewOpen ? 'text-violet-700 bg-violet-200 hover:bg-violet-300' : 'text-violet-600 bg-violet-50 hover:bg-violet-100'
            }`}
          >
            {viewOpen ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />} View Sales Report
          </button>
        )}

        <button
          onClick={() => setHistoryOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-200 transition"
        >
          <History className="w-3.5 h-3.5" /> Upload History
        </button>
      </div>

      {viewOpen && (
        <div className="mt-3 -mx-5 -mb-5 rounded-b-2xl overflow-hidden">
          <TargetReportDetailPanel report={currentReport} isLoading={currentLoading} showRepName={false} />
        </div>
      )}

      {/* Upload history panel */}
      {historyOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => { setHistoryOpen(false); setHistoryReportId(null); }}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2"><History className="w-4 h-4 text-slate-500" /> Upload History</h3>
              <button onClick={() => { setHistoryOpen(false); setHistoryReportId(null); }} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-3">
              {historyLoading ? (
                <div className="py-10 text-center"><Loader2 className="w-6 h-6 animate-spin text-violet-500 mx-auto" /></div>
              ) : history.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-8">No uploads yet.</p>
              ) : (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                  {history.map((h: any) => (
                    <div key={h.id}>
                      <div className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-slate-800 truncate">{h.originalFileName || 'Sales report'}</p>
                            {h.isCurrent && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">Current</span>}
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {formatDate(h.fromDate)} – {formatDate(h.asAtDate)} · {formatCurrency(h.actualSales)} · Uploaded {formatDateTime(h.uploadedAt)} by {h.uploadedBy || '—'}
                          </p>
                        </div>
                        <button
                          onClick={() => setHistoryReportId(historyReportId === h.id ? null : h.id)}
                          className="flex items-center gap-1 text-xs font-semibold text-violet-600 bg-violet-50 hover:bg-violet-100 rounded-lg px-2.5 py-1.5 flex-shrink-0"
                        >
                          {historyReportId === h.id ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />} View
                        </button>
                      </div>
                      {historyReportId === h.id && (
                        <TargetReportDetailPanel report={historyDetail} isLoading={historyDetailLoading} showRepName={false} />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!confirmOlder}
        title="Replace With Older Report?"
        description="This report's As At Date is earlier than the currently uploaded report. Replacing it will overwrite the current Actual Sales figure with an older cumulative total. Continue?"
        confirmLabel="Replace Anyway"
        confirmVariant="orange"
        onConfirm={() => {
          if (confirmOlder) {
            doUpload(
              confirmOlder.payload.entries,
              confirmOlder.payload.sourceRows,
              confirmOlder.payload.fileName,
              true,
            );
          }
        }}
        onCancel={() => setConfirmOlder(null)}
      />
    </div>
  );
}