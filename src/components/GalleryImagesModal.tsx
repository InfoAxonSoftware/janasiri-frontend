import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ImagePlus, Images, Trash2, X } from 'lucide-react';
import type { GalleryItem } from '../services/api/galleryApi';

interface GalleryImagesModalProps {
  item: GalleryItem;
  onClose: () => void;
  onAddImage: () => void;
  onRemoveImage: (index: number) => void;
  adding: boolean;
  removing: boolean;
}

export default function GalleryImagesModal({
  item, onClose, onAddImage, onRemoveImage, adding, removing,
}: GalleryImagesModalProps) {
  const [pendingRemoveIndex, setPendingRemoveIndex] = useState<number | null>(null);
  const apiBase = import.meta.env.VITE_API_URL?.replace('/api', '') || '';
  const images = [item.imageUrl, ...(item.extraImageUrls || [])];

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !removing) onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose, removing]);

  return createPortal(
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-3 sm:p-6">
      <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={() => { if (!removing) onClose(); }} />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="gallery-images-title"
        className="relative flex max-h-[90dvh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-6">
          <div className="min-w-0">
            <h3 id="gallery-images-title" className="truncate text-base font-bold text-slate-900">{item.title}</h3>
            <p className="mt-0.5 text-xs text-slate-500">{images.length} photo{images.length === 1 ? '' : 's'} · Manage gallery images</p>
          </div>
          <button
            type="button"
            autoFocus
            onClick={onClose}
            disabled={removing}
            aria-label="Close image gallery"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 focus-visible:outline-2 focus-visible:outline-indigo-500"
          ><X className="h-5 w-5" /></button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {images.map((src, index) => (
              <div key={src + index} className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                <div className="aspect-square bg-white p-2">
                  <img
                    src={`${apiBase}${src}`}
                    alt={index === 0 ? `${item.title} cover` : `${item.title} image ${index + 1}`}
                    className="h-full w-full object-contain"
                  />
                </div>
                <div className="border-t border-slate-100 p-2">
                  <p className="mb-1.5 truncate text-xs font-medium text-slate-700">{index === 0 ? 'Cover photo' : `Photo ${index + 1}`}</p>
                  {index === 0 ? (
                    <span className="flex h-9 items-center justify-center rounded-lg bg-indigo-50 text-xs font-semibold text-indigo-700">Cover</span>
                  ) : pendingRemoveIndex === index - 1 ? (
                    <div className="flex flex-wrap gap-1">
                      <button type="button" onClick={() => setPendingRemoveIndex(null)} className="min-h-9 flex-1 rounded-lg bg-slate-200 px-1 text-[11px] font-semibold text-slate-700">Cancel</button>
                      <button
                        type="button"
                        disabled={removing}
                        onClick={() => { onRemoveImage(index - 1); setPendingRemoveIndex(null); }}
                        className="min-h-9 flex-1 rounded-lg bg-red-600 px-1 text-[11px] font-semibold text-white disabled:opacity-50"
                      >Remove?</button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={removing}
                      onClick={() => setPendingRemoveIndex(index - 1)}
                      className="flex min-h-9 w-full items-center justify-center gap-1 rounded-lg bg-red-50 px-1 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
                    ><Trash2 className="h-3.5 w-3.5" /> Remove</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
        <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-100 p-3 sm:px-5">
          <span className="flex items-center gap-1.5 text-xs text-slate-500"><Images className="h-4 w-4" /> {images.length} images</span>
          <button
            type="button"
            disabled={adding || removing}
            onClick={onAddImage}
            className="flex min-h-10 items-center gap-2 rounded-xl bg-indigo-600 px-4 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          ><ImagePlus className="h-4 w-4" /> {adding ? 'Adding…' : 'Add image'}</button>
        </footer>
      </section>
    </div>,
    document.body
  );
}
