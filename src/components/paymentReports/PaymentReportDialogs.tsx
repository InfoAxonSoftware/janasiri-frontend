import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  Download,
  Image as ImageIcon,
  Loader2,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react';
import type {
  RepPaymentDto,
  RepPaymentStatus,
} from '../../services/api/repPaymentsApi';
import { formatCurrency } from '../../utils/formatters';
import { PrivateImage } from '../common/PrivateImage';

const STATUSES: RepPaymentStatus[] = [
  'AwaitingConfirmation',
  'Confirmed',
  'Approved',
  'Rejected',
];

function statusLabel(status: string) {
  return status.replace(/([a-z])([A-Z])/g, '$1 $2');
}

interface EvidenceLightboxProps {
  payment: RepPaymentDto | null;
  /** The payment's authenticated evidence endpoint path (payment.imageUrl), not a direct file URL. */
  imageUrl: string | null;
  onClose: () => void;
  onDownload: () => void;
}

export function PaymentEvidenceLightbox({
  payment,
  imageUrl,
  onClose,
  onDownload,
}: EvidenceLightboxProps) {
  useEffect(() => {
    if (!payment) return;

    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [payment, onClose]);

  if (!payment || !imageUrl) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm"
      onMouseDown={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Payment evidence preview"
    >
      <div
        className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-white shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-slate-900">
              {payment.reportNumber} — Payment Evidence
            </p>
            <p className="truncate text-xs text-slate-500">
              {payment.customerName} · {formatCurrency(payment.amount)}
            </p>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onDownload}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-blue-700 transition hover:bg-blue-50"
            >
              <Download className="h-4 w-4" />
              Download
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
              aria-label="Close preview"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-slate-100 p-3 sm:p-6">
          <PrivateImage
            apiPath={imageUrl}
            alt={`Payment evidence for ${payment.reportNumber}`}
            className="max-h-[76vh] max-w-full rounded-xl object-contain shadow-lg"
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}

type ConfirmVariant = 'trash' | 'delete' | 'restore';

interface ConfirmDialogProps {
  open: boolean;
  variant?: ConfirmVariant;
  title: string;
  description: string;
  reportNumber?: string;
  customerName?: string;
  confirmLabel: string;
  isPending?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function PaymentReportConfirmDialog({
  open,
  variant = 'trash',
  title,
  description,
  reportNumber,
  customerName,
  confirmLabel,
  isPending = false,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return;

    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isPending) onClose();
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, isPending, onClose]);

  if (!open) return null;

  const isDestructive = variant === 'trash' || variant === 'delete';

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm"
      onMouseDown={() => {
        if (!isPending) onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start gap-3 p-5">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
              isDestructive
                ? 'bg-red-50 text-red-600'
                : 'bg-emerald-50 text-emerald-600'
            }`}
          >
            {variant === 'restore'
              ? <RefreshCw className="h-5 w-5" />
              : variant === 'delete'
                ? <AlertTriangle className="h-5 w-5" />
                : <Trash2 className="h-5 w-5" />}
          </div>

          <div className="min-w-0 flex-1">
            <h3 className="text-base font-bold text-slate-900">
              {title}
            </h3>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              {description}
            </p>

            {(reportNumber || customerName) && (
              <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                {reportNumber && (
                  <p className="text-xs font-bold text-slate-800">
                    {reportNumber}
                  </p>
                )}
                {customerName && (
                  <p className="mt-0.5 truncate text-xs text-slate-500">
                    {customerName}
                  </p>
                )}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className={`inline-flex min-w-28 items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-60 ${
              isDestructive
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-emerald-600 hover:bg-emerald-700'
            }`}
          >
            {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

interface StatusDialogProps {
  payment: RepPaymentDto | null;
  isPending?: boolean;
  onConfirm: (
    status: RepPaymentStatus,
    adminNotes?: string,
  ) => void;
  onClose: () => void;
}

export function PaymentReportStatusDialog({
  payment,
  isPending = false,
  onConfirm,
  onClose,
}: StatusDialogProps) {
  const [status, setStatus] = useState<RepPaymentStatus>(
    'AwaitingConfirmation',
  );
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!payment) return;
    setStatus(payment.status);
    setNotes(payment.adminNotes ?? '');
  }, [payment]);

  useEffect(() => {
    if (!payment) return;

    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isPending) onClose();
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [payment, isPending, onClose]);

  if (!payment) return null;

  const unchanged =
    status === payment.status
    && notes.trim() === (payment.adminNotes ?? '').trim();

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm"
      onMouseDown={() => {
        if (!isPending) onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Update Payment Report Status
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              {payment.reportNumber} · {payment.customerName}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
              New Status
            </label>
            <div className="grid gap-2 sm:grid-cols-3">
              {STATUSES.map((option) => (
                <button
                  type="button"
                  key={option}
                  onClick={() => setStatus(option)}
                  className={`rounded-xl border px-3 py-2.5 text-xs font-semibold transition ${
                    status === option
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-500/10'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-300 hover:bg-indigo-50/50'
                  }`}
                >
                  {statusLabel(option)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={4}
              placeholder="Optional review notes..."
              className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-500/15"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isPending || unchanged}
            onClick={() => onConfirm(status, notes.trim() || undefined)}
            className="inline-flex min-w-28 items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Update Status
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function NoEvidenceIcon() {
  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100">
      <ImageIcon className="h-4 w-4 text-slate-400" />
    </div>
  );
}
