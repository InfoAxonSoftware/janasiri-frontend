import React from 'react';
import { createPortal } from 'react-dom';

type Props = {
  open: boolean;
  title?: string;
  description?: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /**
   * Visual variant for the confirm button. Defaults to 'orange'.
   * Supported: 'orange' | 'emerald' | 'indigo' | 'red'
   */
  confirmVariant?: 'orange' | 'emerald' | 'indigo' | 'red';
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ConfirmModal({ open, title = 'Confirm', description, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', confirmVariant = 'orange', onConfirm, onCancel }: Props) {
  if (!open) return null;

  const desc = description || message || '';

  const confirmClass =
    confirmVariant === 'emerald'
      ? 'py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700'
      : confirmVariant === 'indigo'
        ? 'py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700'
        : confirmVariant === 'red'
          ? 'py-2.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700'
          : 'py-2.5 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600';

  return createPortal(
    <div role="dialog" aria-modal="true" aria-labelledby="confirm-modal-title" aria-describedby="confirm-modal-desc" className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" style={{ pointerEvents: 'auto' }}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onCancel} />

      <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl z-10 w-full sm:w-[92vw] sm:max-w-md max-h-[90vh] overflow-y-auto animate-slide-up sm:animate-none pb-safe">
        <div className="sticky top-0 bg-white pt-3 pb-2 px-6 border-b border-slate-100 z-10">
          <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-3" />
          <div className="flex items-center justify-between">
            <h3 id="confirm-modal-title" className="font-bold text-slate-900 text-lg">{title}</h3>
            <button onClick={onCancel} aria-label="Close" className="p-2 hover:bg-slate-100 rounded-xl">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-5 h-5 text-slate-400"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>

        <div className="p-6">
          {desc && <p id="confirm-modal-desc" className="text-sm text-slate-500">{desc}</p>}

          <div className="mt-6 flex flex-col gap-3">
            <button onClick={onConfirm} className={`${confirmClass} w-full sm:w-auto`}>{confirmLabel}</button>
            <button onClick={onCancel} className="w-full sm:w-auto py-2.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-medium">{cancelLabel}</button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
