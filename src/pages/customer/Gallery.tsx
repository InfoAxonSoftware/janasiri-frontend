// @ts-nocheck
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { galleryApi } from '../../services/api/galleryApi';
import { Images, X, ChevronLeft, ChevronRight } from 'lucide-react';

export default function CustomerGallery() {
  const [lightboxItem, setLightboxItem] = useState(null);
  const [lightboxIdx, setLightboxIdx] = useState(0);

  const { data: galleryItems, isLoading } = useQuery({
    queryKey: ['customer-gallery'],
    queryFn: () => galleryApi.customerGetAll().then(r => r.data.data),
    staleTime: 2 * 60 * 1000,
  });

  const apiBase = import.meta.env.VITE_API_URL?.replace('/api', '') || '';

  const openLightbox = (item) => { setLightboxItem(item); setLightboxIdx(0); };
  const closeLightbox = () => { setLightboxItem(null); setLightboxIdx(0); };

  const lightboxImages = lightboxItem ? [lightboxItem.imageUrl, ...(lightboxItem.extraImageUrls || [])] : [];

  return (
    <div className="animate-fade-in flex flex-col gap-5 pb-10">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Gallery</h1>
        <p className="text-slate-500 text-sm mt-1">Browse our latest products and offers</p>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          {[...Array(12)].map((_, i) => (
            <div key={i} className="rounded-2xl overflow-hidden border border-slate-100 animate-pulse">
              <div className="aspect-square bg-slate-100" />
              <div className="p-2 space-y-1.5">
                <div className="h-3 bg-slate-100 rounded w-3/4" />
              </div>
            </div>
          ))}
        </div>
      ) : !galleryItems?.length ? (
        <div className="text-center py-24 bg-white rounded-2xl border border-slate-200 shadow-sm">
          <Images className="w-14 h-14 text-slate-200 mx-auto mb-4" />
          <h3 className="font-bold text-slate-700 text-lg mb-1">No gallery items yet</h3>
          <p className="text-sm text-slate-400">Check back soon for new showcases.</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          {galleryItems.map((item) => {
            const allImages = [item.imageUrl, ...(item.extraImageUrls || [])];
            return (
              <div
                key={item.id}
                onClick={() => openLightbox(item)}
                className="bg-white rounded-2xl overflow-hidden border border-slate-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer group"
              >
                <div className="aspect-square overflow-hidden bg-slate-50 relative">
                  <img
                    src={`${apiBase}${item.imageUrl}`}
                    alt={item.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    onError={e => { e.target.src = 'https://placehold.co/400x400?text=Image'; }}
                  />
                  {allImages.length > 1 && (
                    <span className="absolute bottom-1.5 right-1.5 bg-black/60 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                      +{allImages.length - 1}
                    </span>
                  )}
                </div>
                <div className="p-3">
                  <p className="text-sm font-bold text-slate-900 truncate leading-tight">{item.title}</p>
                  {item.description && <p className="text-xs text-slate-500 mt-0.5 line-clamp-2 leading-snug">{item.description}</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Lightbox */}
      {lightboxItem && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm"
          onClick={closeLightbox}
        >
          <div
            className="relative w-full max-w-3xl max-h-[92vh] flex flex-col bg-white rounded-2xl overflow-hidden shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={closeLightbox}
              className="absolute top-3 right-3 z-10 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition"
            >
              <X className="w-5 h-5" />
            </button>
            {/* Main image */}
            <div className="overflow-hidden relative bg-black flex items-center justify-center" style={{ minHeight: '55vh' }}>
              <img
                src={`${apiBase}${lightboxImages[lightboxIdx]}`}
                alt={lightboxItem.title}
                className="max-w-full object-contain"
                style={{ maxHeight: '60vh' }}
                onError={e => { e.target.src = 'https://placehold.co/800x600?text=Image'; }}
              />
              {lightboxImages.length > 1 && (
                <>
                  <button
                    onClick={() => setLightboxIdx(i => (i - 1 + lightboxImages.length) % lightboxImages.length)}
                    className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition"
                  ><ChevronLeft className="w-5 h-5" /></button>
                  <button
                    onClick={() => setLightboxIdx(i => (i + 1) % lightboxImages.length)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition"
                  ><ChevronRight className="w-5 h-5" /></button>
                </>
              )}
            </div>
            {/* Thumbnails */}
            {lightboxImages.length > 1 && (
              <div className="flex gap-2 px-4 py-2 overflow-x-auto border-t border-slate-100 bg-slate-50">
                {lightboxImages.map((url, idx) => (
                  <button
                    key={idx}
                    onClick={() => setLightboxIdx(idx)}
                    className={`flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden border-2 transition ${idx === lightboxIdx ? 'border-indigo-500' : 'border-transparent opacity-60 hover:opacity-100'}`}
                  >
                    <img
                      src={`${apiBase}${url}`}
                      alt=""
                      className="w-full h-full object-cover"
                      onError={e => { e.target.src = 'https://placehold.co/80x80?text=X'; }}
                    />
                  </button>
                ))}
              </div>
            )}
            <div className="p-5 border-t border-slate-100">
              <h2 className="text-xl font-bold text-slate-900 leading-tight">{lightboxItem.title}</h2>
              {lightboxItem.description && (
                <p className="text-base text-slate-600 mt-1.5 leading-relaxed">{lightboxItem.description}</p>
              )}
              {lightboxImages.length > 1 && (
                <p className="text-xs text-slate-400 mt-1">{lightboxIdx + 1} / {lightboxImages.length}</p>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
