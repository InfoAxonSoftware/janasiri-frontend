import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

type Props = {
  open: boolean;
  title?: string;
  description?: string;
  initial?: number;
  min?: number;
  max?: number | undefined;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: (value: number) => void;
  onCancel: () => void;
};

export default function QuantityModal({ open, title = 'Edit quantity', description, initial = 1, min = 1, max, confirmLabel = 'OK', cancelLabel = 'Cancel', onConfirm, onCancel }: Props) {
  const [value, setValue] = useState(String(initial));

  useEffect(() => {
    setValue(String(initial));
  }, [initial, open]);

  if (!open) return null;

  const save = () => {
    let n = Math.max(min, Math.floor(Number(value) || min));
    if (typeof max === 'number' && n > max) n = max;
    onConfirm(n);
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ pointerEvents: 'auto' }}>
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative z-10 w-full max-w-md bg-white rounded-2xl p-4 sm:p-6 shadow-2xl">
        <h3 className="text-lg font-bold text-slate-900">{title}</h3>
        {description && <p className="text-sm text-slate-500 mt-2">{description}</p>}

        <div className="mt-4 flex items-center gap-3">
          <input
            inputMode="numeric"
            type="number"
            min={min}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') save(); }}
            className="w-full sm:w-40 px-3 py-2 border border-slate-200 rounded-lg text-lg font-bold text-center outline-none"
          />
          <div className="flex-1 text-sm text-slate-500">{max ? `Max ${max}` : ''}</div>
        </div>

        <div className="mt-5 flex justify-end gap-3">
          <button onClick={onCancel} className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50">{cancelLabel}</button>
          <button onClick={save} className="px-4 py-2 rounded-xl bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600">{confirmLabel}</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
