// @ts-nocheck
import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Camera,
  CheckCircle2,
  FileText,
  ImagePlus,
  Send,
  ShoppingCart,
  User,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { quickRequestApi } from '../../services/api/quickRequestApi';

type RequestType = 'Order' | 'Quotation';

function ImagePreview({
  url,
  onClose,
}: {
  url: string;
  onClose: () => void;
}) {
  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 p-4"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
        aria-label="Close preview"
      >
        <X className="h-5 w-5" />
      </button>

      <img
        src={url}
        alt="Attachment preview"
        className="max-h-[90vh] max-w-[94vw] rounded-2xl object-contain shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      />
    </div>,
    document.body,
  );
}

export default function RepQuickRequest() {
  const queryClient = useQueryClient();
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const [type, setType] = useState<RequestType>('Order');
  const [customerName, setCustomerName] = useState('');
  const [details, setDetails] = useState('');
  const [pendingImages, setPendingImages] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [fullPreview, setFullPreview] = useState<string | null>(null);

  const submitMutation = useMutation({
    mutationFn: async () => {
      /*
       * The existing backend creates the Quick Request first and uploads images
       * afterwards. It currently expects a non-empty details value, so an
       * image-only request uses a small neutral description internally.
       */
      const requestDetails = details.trim() || 'Image attachment only';

      const response = await quickRequestApi.create({
        type,
        customerName: customerName.trim(),
        details: requestDetails,
      });

      const created = response.data.data;

      if (pendingImages.length > 0) {
        await quickRequestApi.uploadImages(created.id, pendingImages);
      }

      return created;
    },

    onSuccess: () => {
      toast.success(`${type} submitted successfully`);

      setCustomerName('');
      setDetails('');
      setPendingImages([]);
      setPreviewUrls([]);
      setFullPreview(null);

      queryClient.invalidateQueries({
        queryKey: ['rep-quick-requests'],
      });

      queryClient.invalidateQueries({
        queryKey: ['rep-orders'],
      });
    },

    onError: (error: any) =>
      toast.error(
        error?.response?.data?.message || 'Submission failed',
      ),
  });

  const addImages = (files: FileList | null) => {
    if (!files) return;

    const selectedFiles = Array.from(files);
    const validTypes = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
    ];

    const validFiles = selectedFiles.filter(
      (file) =>
        validTypes.includes(file.type) &&
        file.size <= 10 * 1024 * 1024,
    );

    if (validFiles.length < selectedFiles.length) {
      toast.error(
        'Some files were skipped. Use supported images under 10 MB.',
      );
    }

    setPendingImages((current) => [
      ...current,
      ...validFiles,
    ]);

    validFiles.forEach((file) => {
      const reader = new FileReader();

      reader.onload = (event) => {
        const result = event.target?.result as string;
        if (!result) return;

        setPreviewUrls((current) => [
          ...current,
          result,
        ]);
      };

      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index: number) => {
    setPendingImages((current) =>
      current.filter(
        (_, currentIndex) => currentIndex !== index,
      ),
    );

    setPreviewUrls((current) =>
      current.filter(
        (_, currentIndex) => currentIndex !== index,
      ),
    );
  };

  const handleSubmit = () => {
    if (!customerName.trim()) {
      toast.error('Customer name is required');
      return;
    }

    if (!details.trim() && pendingImages.length === 0) {
      toast.error('Enter request details or attach an image');
      return;
    }

    submitMutation.mutate();
  };

  const canSubmit =
    customerName.trim().length > 0 &&
    (details.trim().length > 0 || pendingImages.length > 0) &&
    !submitMutation.isPending;

  return (
    <div className="mx-auto w-full max-w-6xl animate-fade-in space-y-4 px-3 pb-16 pt-2 sm:px-5 sm:pt-4 lg:px-0 lg:pt-0">
      {fullPreview && (
        <ImagePreview
          url={fullPreview}
          onClose={() => setFullPreview(null)}
        />
      )}

      {/* Header */}
      <section className="relative overflow-hidden rounded-2xl bg-emerald-700 px-4 py-5 text-white shadow-sm sm:px-6 sm:py-6">
        <div className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 left-10 h-44 w-44 rounded-full bg-emerald-300/10 blur-3xl" />

        <div className="relative flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-100">
              Sales Request
            </p>

            <h1 className="mt-1 text-xl font-black tracking-tight sm:text-2xl">
              Quick Order / Quotation
            </h1>

            <p className="mt-1 text-xs text-emerald-100 sm:text-sm">
              Enter request details, attach photos, or use both
            </p>
          </div>

          <div className="hidden h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-white/10 sm:flex">
            {type === 'Order' ? (
              <ShoppingCart className="h-5 w-5" />
            ) : (
              <FileText className="h-5 w-5" />
            )}
          </div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
        <main className="min-w-0 space-y-4">
          {/* Request basics */}
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="grid gap-4 p-4 sm:grid-cols-[220px_minmax(0,1fr)] sm:p-5">
              <div>
                <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-slate-400">
                  Type
                </label>

                <div className="grid grid-cols-2 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-1">
                  {(['Order', 'Quotation'] as const).map(
                    (requestType) => (
                      <button
                        key={requestType}
                        type="button"
                        onClick={() => setType(requestType)}
                        className={`inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-bold transition ${
                          type === requestType
                            ? 'bg-emerald-700 text-white shadow-sm'
                            : 'text-slate-500 hover:bg-white'
                        }`}
                      >
                        {requestType === 'Order' ? (
                          <ShoppingCart className="h-3.5 w-3.5" />
                        ) : (
                          <FileText className="h-3.5 w-3.5" />
                        )}

                        {requestType}
                      </button>
                    ),
                  )}
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-slate-400">
                  Customer / Shop
                </label>

                <div className="relative">
                  <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                  <input
                    value={customerName}
                    onChange={(event) =>
                      setCustomerName(event.target.value)
                    }
                    placeholder="Enter customer or shop name"
                    className="min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm font-semibold text-slate-900 outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-500/15"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Request details */}
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center gap-2.5 border-b border-slate-100 px-4 py-3.5 sm:px-5">
              <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                <FileText className="h-4 w-4" />
              </div>

              <div>
                <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">
                  Request
                </p>

                <h2 className="mt-0.5 text-sm font-black text-slate-900">
                  Request Details
                </h2>
              </div>
            </div>

            <div className="p-4 sm:p-5">
              <textarea
                value={details}
                onChange={(event) => setDetails(event.target.value)}
                placeholder="Type the requested items, quantities, notes, or any other details here..."
                rows={7}
                className="min-h-[160px] w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium leading-6 text-slate-900 outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-500/15"
              />

              <div className="mt-2 flex items-center justify-between gap-3 text-[10px] font-semibold text-slate-400">
                <span>Text or photo is required</span>
                <span>{details.length} characters</span>
              </div>
            </div>
          </section>

          {/* Photos */}
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3.5 sm:px-5">
              <div className="flex items-center gap-2.5">
                <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                  <ImagePlus className="h-4 w-4" />
                </div>

                <div>
                  <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">
                    Attachments
                  </p>

                  <h2 className="mt-0.5 text-sm font-black text-slate-900">
                    Photos
                  </h2>
                </div>
              </div>

              {pendingImages.length > 0 && (
                <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-bold text-emerald-700">
                  {pendingImages.length}
                </span>
              )}
            </div>

            <div className="p-4 sm:p-5">
              <div className="flex flex-wrap gap-2.5">
                {previewUrls.map((url, index) => (
                  <div
                    key={`${url}-${index}`}
                    className="group relative h-[76px] w-[76px] overflow-visible rounded-xl border border-slate-200 bg-slate-100 sm:h-20 sm:w-20"
                  >
                    <button
                      type="button"
                      onClick={() => setFullPreview(url)}
                      className="h-full w-full overflow-hidden rounded-xl"
                    >
                      <img
                        src={url}
                        alt={`Attachment ${index + 1}`}
                        className="h-full w-full object-cover"
                      />
                    </button>

                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className="absolute -right-2 -top-2 inline-flex h-7 w-7 items-center justify-center rounded-full border border-rose-100 bg-white text-rose-600 shadow-md transition active:scale-95 active:bg-rose-50"
                      aria-label="Remove image"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={() => galleryRef.current?.click()}
                  className="inline-flex h-20 w-24 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 text-slate-500 transition active:border-emerald-400 active:bg-emerald-50 active:text-emerald-700"
                >
                  <ImagePlus className="h-5 w-5" />
                  <span className="text-[10px] font-bold">
                    Gallery
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => cameraRef.current?.click()}
                  className="inline-flex h-20 w-24 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 text-slate-500 transition active:border-emerald-400 active:bg-emerald-50 active:text-emerald-700"
                >
                  <Camera className="h-5 w-5" />
                  <span className="text-[10px] font-bold">
                    Camera
                  </span>
                </button>
              </div>

              <input
                ref={galleryRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(event) => {
                  addImages(event.target.files);
                  event.target.value = '';
                }}
              />

              <input
                ref={cameraRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(event) => {
                  addImages(event.target.files);
                  event.target.value = '';
                }}
              />
            </div>
          </section>

          {/* Mobile submit — summary is intentionally hidden on phones */}
          <section className="lg:hidden">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 text-sm font-black text-white shadow-lg shadow-emerald-700/15 transition active:scale-[0.99] active:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
            >
              {submitMutation.isPending ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Submit {type}
                </>
              )}
            </button>

            <p className="mt-2 text-center text-[10px] font-medium text-slate-400">
              Add request details, a photo, or both
            </p>
          </section>
        </main>

        {/* Desktop summary / submit */}
        <aside className="hidden min-w-0 lg:block">
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:sticky lg:top-4">
            <div className="bg-emerald-700 px-4 py-4 text-white">
              <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-emerald-100">
                Request Summary
              </p>

              <h2 className="mt-1 text-lg font-black">
                {type}
              </h2>
            </div>

            <div className="p-4">
              <div className="space-y-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                  <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">
                    Customer
                  </p>

                  <p className="mt-1 break-words text-sm font-black text-slate-900">
                    {customerName.trim() || 'Not entered'}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">
                      Request Overview
                    </p>

                    <span className="flex-shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold text-slate-500">
                      {details.trim()
                        ? `${details
                            .trim()
                            .split(/\r?\n/)
                            .filter((line) => line.trim()).length} lines`
                        : 'Image only'}
                    </span>
                  </div>

                  {details.trim() ? (
                    <div className="mt-2 max-h-72 overflow-y-auto rounded-lg bg-slate-50 px-3 py-2.5">
                      <p className="whitespace-pre-wrap break-words text-xs font-semibold leading-5 text-slate-700">
                        {details.trim()}
                      </p>
                    </div>
                  ) : (
                    <p className="mt-2 rounded-lg bg-slate-50 px-3 py-3 text-xs font-semibold text-slate-400">
                      No text details entered. This request will use the attached image.
                    </p>
                  )}
                </div>

                <SummaryRow
                  label="Photos"
                  value={String(pendingImages.length)}
                />
              </div>

              <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-3">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-700" />

                  <p className="text-[11px] font-semibold leading-5 text-emerald-800">
                    Review the request overview before submitting.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 text-sm font-black text-white shadow-lg shadow-emerald-700/15 transition active:scale-[0.99] active:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
              >
                {submitMutation.isPending ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Submit {type}
                  </>
                )}
              </button>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function SummaryRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="flex-shrink-0 text-slate-500">
        {label}
      </span>

      <span className="min-w-0 break-words text-right font-bold text-slate-900">
        {value}
      </span>
    </div>
  );
}
