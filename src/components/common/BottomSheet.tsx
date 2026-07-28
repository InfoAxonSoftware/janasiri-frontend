import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export interface BottomSheetProps {
  /** Use `open` or `isOpen` — both are supported */
  open?: boolean;
  isOpen?: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  maxHeight?: string;
}

export default function BottomSheet({
  open,
  isOpen,
  onClose,
  title,
  children,
  maxHeight = '85vh',
}: BottomSheetProps) {
  const visible = open ?? isOpen ?? false;

  useEffect(() => {
    if (visible) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [visible]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && visible) onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [visible, onClose]);

  if (!visible) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end xl:items-center xl:justify-center" style={{ pointerEvents: 'auto' }}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      {/* Sheet — mobile/tablet: bottom slide-up; wide desktop: centered modal */}
      <div
        className="relative w-full xl:max-w-lg bg-white rounded-t-2xl xl:rounded-2xl shadow-2xl animate-slide-up xl:animate-fade-in overflow-hidden"
        style={{ maxHeight }}
      >
        {/* Handle bar — mobile only */}
        <div className="flex justify-center pt-3 pb-1 xl:hidden">
          <div className="w-10 h-1 rounded-full bg-slate-300" />
        </div>
        {/* Header */}
        {title && (
          <div className="flex items-center justify-between px-5 pb-3 xl:pt-5 border-b border-slate-100">
            <h3 className="text-lg font-bold text-slate-800">{title}</h3>
            <button onClick={onClose} className="p-1.5 rounded-full hover:bg-slate-100 transition-colors">
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>
        )}
        {/* Content */}
        <div className="overflow-y-auto px-5 py-4" style={{ maxHeight: `calc(${maxHeight} - 80px)` }}>
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}
