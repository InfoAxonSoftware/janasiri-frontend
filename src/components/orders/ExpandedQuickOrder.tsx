import { FileText, FileSpreadsheet, Download, Eye, Paperclip, ClipboardList, CalendarDays, Check, UserRound, Users } from 'lucide-react';
import { PrivateImage } from '../common/PrivateImage';
import StatusBadge from '../common/StatusBadge';
import GuestQuickOrderDetails from './GuestQuickOrderDetails';
import GuestOrderRepAssignment from './GuestOrderRepAssignment';
import { openPrivateFile, downloadPrivateFile } from '../../utils/fileAccess';
import { formatDateTime } from '../../utils/formatters';
import toast from 'react-hot-toast';

type Props = {
  request: any;
  manageReps?: boolean;
  statuses?: readonly string[];
  onStatusChange?: (status: string) => void;
  statusPending?: boolean;
  onExport?: (format: 'pdf' | 'excel') => void;
  onPreviewImage?: (url: string) => void;
  inset?: boolean;
};

function FileSize({ bytes }: { bytes?: number }) {
  if (!bytes) return null;
  return <span className="text-[10px] text-slate-400">{bytes < 1024 ? bytes + ' B' : bytes < 1048576 ? (bytes / 1024).toFixed(1) + ' KB' : (bytes / 1048576).toFixed(1) + ' MB'}</span>;
}

export default function ExpandedQuickOrder({ request, manageReps = false, statuses, onStatusChange, statusPending, onExport, onPreviewImage, inset = false }: Props) {
  const guest = request.createdBy === 'Quick Order Portal';
  const attachments = request.attachments?.length ? request.attachments : (request.imageUrls || []).map((url: string, index: number) => ({
    id: 'legacy-' + index, url, originalFileName: 'Photo ' + (index + 1), contentType: 'image/*', sizeBytes: 0,
  }));
  const hasActions = !!onStatusChange || !!onExport;
  const assigned = request.assignedReps ?? (request.repId ? [{ id: request.repId, fullName: request.repName }] : []);
  return (
    <div onClick={e => e.stopPropagation()} className={inset ? 'min-w-0 space-y-3' : 'min-w-0 space-y-3 bg-slate-50/70 p-3 sm:p-4 xl:p-5'}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 pb-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500"><ClipboardList size={17} /></span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="break-all text-sm font-bold text-slate-900">{request.requestNumber}</span>
              <span className={'rounded-full px-2 py-0.5 text-[10px] font-semibold ' + (guest ? 'bg-blue-100 text-blue-700' : 'bg-violet-100 text-violet-700')}>{guest ? 'Guest order' : 'Quick order'}</span>
            </div>
            <p className="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-slate-500"><CalendarDays size={12} /> {formatDateTime(request.createdAt)}</p>
          </div>
        </div>
        <StatusBadge status={request.status} />
      </div>

      <div className={hasActions ? 'grid min-w-0 items-start gap-3 xl:grid-cols-[minmax(0,1fr)_230px]' : 'min-w-0'}>
        <div className="min-w-0 space-y-3">
          <section className="min-w-0 rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
            <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold text-slate-700"><UserRound size={15} className="text-slate-400" /> Order details</h3>
            {!guest && <div className="mb-3 rounded-lg bg-slate-50 px-3 py-2"><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Customer / business</p><p className="mt-1 break-words text-sm font-semibold text-slate-800">{request.customerName || '—'}</p></div>}
            {!guest && <p className="mb-1.5 text-xs font-medium text-slate-500">Request message</p>}
            <GuestQuickOrderDetails request={request} />
          </section>
        </div>
        {hasActions && <aside className="min-w-0 space-y-3">
          {onStatusChange && <section className="rounded-xl border border-slate-200 bg-white p-3">
            <h3 className="mb-2 text-xs font-semibold text-slate-700">Update status</h3>
            <div className="grid grid-cols-2 gap-1.5 xl:grid-cols-1">
              {statuses?.map(s => <button key={s} type="button" disabled={statusPending} aria-pressed={s === request.status} onClick={() => onStatusChange(s)}
                className={'flex min-h-9 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-left text-xs font-semibold transition disabled:opacity-50 ' + (s === request.status ? 'border-slate-800 bg-slate-800 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50')}>
                {s === request.status && <Check size={13} />} {s}
              </button>)}
            </div>
          </section>}
          {onExport && <section className="rounded-xl border border-slate-200 bg-white p-3">
            <h3 className="mb-2 text-xs font-semibold text-slate-700">Export order</h3>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => onExport('pdf')} className="flex items-center justify-center gap-1 rounded-lg border border-red-100 bg-red-50/50 py-2 text-xs font-semibold text-red-600 hover:bg-red-50"><FileText size={14} /> PDF</button>
              <button type="button" onClick={() => onExport('excel')} className="flex items-center justify-center gap-1 rounded-lg border border-emerald-100 bg-emerald-50/50 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"><FileSpreadsheet size={14} /> Excel</button>
            </div>
          </section>}
        </aside>}
      </div>
      <div className={manageReps || assigned.length > 0 ? 'grid min-w-0 items-start gap-3 xl:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)]' : 'min-w-0'}>
        <section className="min-w-0 rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="flex items-center gap-2 text-xs font-semibold text-slate-700"><Paperclip size={15} className="text-slate-400" /> Attachments</h3>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">{attachments.length}</span>
            </div>
            {attachments.length === 0 ? <p className="rounded-lg border border-dashed border-slate-200 px-3 py-3 text-xs text-slate-500">No attachments submitted.</p> :
              <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,112px),1fr))] gap-2">
                {attachments.map((a: any, i: number) => {
                  const pdf = a.contentType?.toLowerCase() === 'application/pdf' || a.originalFileName?.toLowerCase().endsWith('.pdf');
                  const name = a.originalFileName || (pdf ? 'Purchase order.pdf' : 'Photo ' + (i + 1));
                  const view = async () => {
                    try { if (!pdf && onPreviewImage) onPreviewImage(a.url); else await openPrivateFile(a.url); }
                    catch { toast.error('Unable to open attachment'); }
                  };
                  return <div key={a.id || i} className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white">
                    <button type="button" title={'Open ' + name} onClick={view} className="flex h-[70px] w-full items-center justify-center overflow-hidden bg-slate-50 hover:bg-slate-100">
                      {pdf ? <FileText size={27} className="text-red-500" /> : <PrivateImage apiPath={a.url} alt={name} className="h-full w-full object-cover" />}
                    </button>
                    <div className="px-2 py-2">
                      <p className="truncate text-[11px] font-medium text-slate-700" title={name}>{name}</p>
                      <FileSize bytes={a.sizeBytes} />
                      <div className="mt-1.5 flex gap-1">
                        <button type="button" onClick={view} className="flex min-w-0 flex-1 items-center justify-center gap-1 rounded-md bg-slate-50 py-1.5 text-[10px] font-semibold text-slate-600 hover:bg-slate-100"><Eye size={12} /> View</button>
                        <button type="button" title={'Download ' + name} aria-label={'Download ' + name} onClick={async () => { try { await downloadPrivateFile(a.url, name); } catch { toast.error('Download failed'); } }} className="rounded-md bg-slate-50 px-2 text-slate-600 hover:bg-slate-100"><Download size={13} /></button>
                      </div>
                    </div>
                  </div>;
                })}
              </div>}
          </section>
        {manageReps ? <GuestOrderRepAssignment key={request.id + String(request.assignmentVersion)} request={request} /> :
        assigned.length > 0 && <section className="rounded-xl border border-slate-200 bg-white p-3"><h3 className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-700"><Users size={15} className="text-slate-400" /> Assigned sales reps</h3><div className="flex flex-wrap gap-1.5">{assigned.map((r: any) => <span key={r.id} className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-700">{r.fullName || 'Assigned rep'}</span>)}</div></section>}
      </div>
      {request.adminNotes && <section className="rounded-xl border border-amber-100 bg-amber-50/60 p-3"><h3 className="text-xs font-semibold text-amber-800">Admin notes</h3><p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-700">{request.adminNotes}</p></section>}
    </div>
  );
}
