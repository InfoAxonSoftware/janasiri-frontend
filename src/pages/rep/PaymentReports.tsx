// @ts-nocheck
import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Camera,
  CheckSquare,
  Download,
  FileText,
  History,
  Image,
  Loader2,
  PlusCircle,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  repPaymentsApi,
  type RepPaymentDto,
} from '../../services/api/repPaymentsApi';
import StatusBadge from '../../components/common/StatusBadge';
import { formatCurrency, formatDateTime } from '../../utils/formatters';
import { downloadImage } from '../../utils/quickRequestPdf';
import { paymentReportKeys } from '../../services/queryKeys/paymentReportKeys';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import {
  downloadPaymentReportsPdf,
  fetchAllPaymentReports,
} from '../../utils/paymentReportExport';
import {
  NoEvidenceIcon,
  PaymentEvidenceLightbox,
  PaymentReportConfirmDialog,
} from '../../components/paymentReports/PaymentReportDialogs';
import { PrivateImage } from '../../components/common/PrivateImage';

const API_BASE = import.meta.env.VITE_API_URL?.replace('/api', '') || '';
const PAGE_SIZE = 20;
const STATUSES = [
  'AwaitingConfirmation',
  'Confirmed',
  'Approved',
  'Rejected',
] as const;

function statusLabel(status: string) {
  return status.replace(/([a-z])([A-Z])/g, '$1 $2');
}

export default function RepPaymentReports() {
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'active' | 'trash'>('active');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search.trim(), 400);
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [exportingPdf, setExportingPdf] = useState(false);
  const [mobileSection, setMobileSection] = useState<'submit' | 'history'>('submit');
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const [customerName, setCustomerName] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [formError, setFormError] = useState('');

  const [evidencePayment, setEvidencePayment] = useState<RepPaymentDto | null>(null);
  const [confirmState, setConfirmState] = useState<{
    type: 'trash' | 'restore' | 'bulk-trash';
    payment?: RepPaymentDto;
  } | null>(null);

  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const queryParams = useMemo(() => ({
    page,
    pageSize: PAGE_SIZE,
    search: debouncedSearch || undefined,
    status: statusFilter || undefined,
    sortField: 'createdAt',
    sortDir: 'desc' as const,
    view: activeTab,
  }), [page, debouncedSearch, statusFilter, activeTab]);

  const {
    data,
    isLoading,
    isError,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: activeTab === 'active'
      ? paymentReportKeys.list('rep', queryParams)
      : paymentReportKeys.trash('rep', queryParams),
    queryFn: () => repPaymentsApi.getRepPayments(queryParams),
    placeholderData: (previousData) => previousData,
  });

  const payments = data?.items ?? [];
  const totalCount = data?.totalCount ?? 0;
  const totalPages = Math.max(
    1,
    data?.totalPages ?? Math.ceil(totalCount / PAGE_SIZE),
  );

  useEffect(() => {
    setPage(1);
    setSelectedIds(new Set());
  }, [activeTab, debouncedSearch, statusFilter]);

  useEffect(() => {
    if (data && page > totalPages) setPage(totalPages);
  }, [data, page, totalPages]);

  useEffect(() => () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
  }, [imagePreview]);

  const invalidateReports = () =>
    queryClient.invalidateQueries({ queryKey: paymentReportKeys.all });

  const createMut = useMutation({
    mutationFn: repPaymentsApi.create,
    onSuccess: async () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview);

      setCustomerName('');
      setReferenceNumber('');
      setAmount('');
      setImageFile(null);
      setImagePreview(null);
      setFormError('');
      setPage(1);
      setMobileSection('history');

      await invalidateReports();
      toast.success('Payment report submitted');
    },
    onError: (error: any) => {
      setFormError(
        error?.response?.data?.message
        || error?.response?.data?.errors?.[0]
        || 'Failed to submit payment report.',
      );
    },
  });

  const trashMut = useMutation({
    mutationFn: repPaymentsApi.repTrash,
    onSuccess: async () => {
      setConfirmState(null);
      setSelectedIds(new Set());
      await invalidateReports();
      toast.success('Moved to trash');
    },
    onError: () => toast.error('Failed to move report to trash'),
  });

  const restoreMut = useMutation({
    mutationFn: repPaymentsApi.repRestore,
    onSuccess: async () => {
      setConfirmState(null);
      await invalidateReports();
      toast.success('Payment report restored');
    },
    onError: () => toast.error('Restore failed'),
  });

  const bulkTrashMut = useMutation({
    mutationFn: (ids: string[]) => Promise.all(
      ids.map((id) => repPaymentsApi.repTrash(id)),
    ),
    onSuccess: async (_, ids) => {
      setConfirmState(null);
      setSelectedIds(new Set());
      await invalidateReports();
      toast.success(`${ids.length} report(s) moved to trash`);
    },
    onError: () => toast.error('Some reports could not be moved to trash'),
  });

  const allPageSelected =
    payments.length > 0
    && payments.every((payment) => selectedIds.has(payment.id));

  const toggleSelection = (id: string) => {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllOnPage = () => {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      const allSelected = payments.every((payment) => next.has(payment.id));
      payments.forEach((payment) => {
        if (allSelected) next.delete(payment.id);
        else next.add(payment.id);
      });
      return next;
    });
  };

  const exportPdf = async () => {
    setExportingPdf(true);
    try {
      const rows = selectedIds.size > 0
        ? await Promise.all(
            [...selectedIds].map((id) => repPaymentsApi.getRepById(id)),
          )
        : await fetchAllPaymentReports(
            repPaymentsApi.getRepPayments,
            queryParams,
          );

      if (rows.length === 0) {
        toast.error('No payment reports to export');
        return;
      }

      await downloadPaymentReportsPdf(rows, {
        title: 'MY PAYMENT REPORTS',
        view: activeTab,
        fileName: selectedIds.size === 1
          ? `${rows[0].reportNumber}.pdf`
          : 'my-payment-reports.pdf',
        scopeLabel: selectedIds.size > 0
          ? `${selectedIds.size} selected report(s)`
          : 'All reports matching the current filters',
      });

      toast.success(`${rows.length} report(s) exported`);
    } catch (error) {
      console.error('Sales rep payment PDF export failed', error);
      toast.error('PDF export failed');
    } finally {
      setExportingPdf(false);
    }
  };

  const handleImageChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (imagePreview) URL.revokeObjectURL(imagePreview);

    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setShowImagePicker(false);
    event.target.value = '';
  };

  const removeSelectedImage = () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(null);
    setImagePreview(null);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    setFormError('');

    const normalizedName = customerName.trim();
    const normalizedReference = referenceNumber.trim();
    const parsedAmount = Number.parseFloat(amount);

    if (!normalizedName) {
      setFormError('Customer name is required.');
      return;
    }

    if (!normalizedReference) {
      setFormError('Reference number is required.');
      return;
    }

    if (normalizedReference.length > 100) {
      setFormError('Reference number must not exceed 100 characters.');
      return;
    }

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setFormError('Enter a valid amount.');
      return;
    }

    createMut.mutate({
      customerName: normalizedName,
      referenceNumber: normalizedReference,
      amount: parsedAmount,
      image: imageFile,
    });
  };

  const handleDownload = async (payment: RepPaymentDto) => {
    if (!payment.imageUrl) return;

    try {
      await downloadImage(
        `${API_BASE}${payment.imageUrl}`,
        `payment-${payment.reportNumber}`,
      );
    } catch {
      toast.error('Download failed');
    }
  };

  const handleConfirm = () => {
    if (!confirmState) return;

    if (confirmState.type === 'bulk-trash') {
      bulkTrashMut.mutate([...selectedIds]);
      return;
    }

    if (!confirmState.payment) return;

    if (confirmState.type === 'trash') {
      trashMut.mutate(confirmState.payment.id);
    } else {
      restoreMut.mutate(confirmState.payment.id);
    }
  };

  return (
    <div className="animate-fade-in flex flex-col gap-5 pb-24">
      <div className="hidden lg:block">
        <h1 className="text-2xl font-bold text-slate-900">
          Receive Payments 
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Submit customer payments and track their review status
        </p>
      </div>

      <div className="lg:hidden">
        <div className="mb-3">
          <h1 className="text-xl font-bold text-slate-900">
            Receive Payments
          </h1>
          <p className="mt-0.5 text-xs text-slate-500">
            Fast reporting while you are on the road
          </p>
        </div>

        <div className="grid grid-cols-2 rounded-2xl border border-slate-200 bg-slate-100 p-1 shadow-sm">
          <button
            type="button"
            onClick={() => setMobileSection('submit')}
            className={`flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 text-sm font-bold transition ${
              mobileSection === 'submit'
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-slate-500'
            }`}
          >
            <PlusCircle className="h-4 w-4" />
            Submit Report
          </button>
          <button
            type="button"
            onClick={() => setMobileSection('history')}
            className={`flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 text-sm font-bold transition ${
              mobileSection === 'history'
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-slate-500'
            }`}
          >
            <History className="h-4 w-4" />
            My Reports
          </button>
        </div>
      </div>

      <div className={`${mobileSection === 'submit' ? 'block' : 'hidden'} rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 lg:block`}>
        <h2 className="text-lg font-semibold text-slate-900">
          Submit Payment
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Evidence is optional. JPEG, PNG, WebP and GIF files are supported.
        </p>

        <form
          onSubmit={handleSubmit}
          className="mt-5 grid gap-5 lg:grid-cols-[1fr_220px]"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
                Customer Name
              </label>
              <input
                value={customerName}
                onChange={(event) => setCustomerName(event.target.value)}
                className="min-h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-base outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-500/15 sm:text-sm"
                placeholder="Enter customer name"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
                Reference Number
              </label>
              <input
                type="text"
                required
                maxLength={100}
                value={referenceNumber}
                onChange={(event) => setReferenceNumber(event.target.value)}
                className="min-h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-base outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-500/15 sm:text-sm"
                placeholder="Enter reference number"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
                Amount (LKR)
              </label>
              <input
                type="number"
                inputMode="decimal"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                className="min-h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-base outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-500/15 sm:text-sm"
                placeholder="0.00"
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
                Payment Evidence
              </label>

              {imagePreview ? (
                <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <img
                    src={imagePreview}
                    alt="Selected payment evidence"
                    className="h-20 w-20 rounded-xl border border-slate-200 object-cover sm:h-16 sm:w-16"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-700">
                      {imageFile?.name}
                    </p>
                    <p className="text-xs text-slate-400">
                      Ready to upload
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={removeSelectedImage}
                    className="rounded-lg p-2 text-red-500 transition hover:bg-red-50"
                    aria-label="Remove selected evidence"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3 lg:hidden">
                    <button
                      type="button"
                      onClick={() => cameraRef.current?.click()}
                      className="flex min-h-20 flex-col items-center justify-center gap-2 rounded-2xl border border-indigo-200 bg-indigo-50 px-3 text-sm font-bold text-indigo-700 active:scale-[0.98]"
                    >
                      <Camera className="h-6 w-6" />
                      Take Photo
                    </button>
                    <button
                      type="button"
                      onClick={() => galleryRef.current?.click()}
                      className="flex min-h-20 flex-col items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-700 active:scale-[0.98]"
                    >
                      <Image className="h-6 w-6" />
                      Gallery
                    </button>
                  </div>

                  <div className="relative hidden lg:block">
                    <button
                      type="button"
                      onClick={() => setShowImagePicker((open) => !open)}
                      className="inline-flex items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600 transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
                    >
                      <Upload className="h-4 w-4" />
                      Add Evidence
                    </button>

                    {showImagePicker && (
                      <div className="absolute left-0 top-full z-20 mt-2 w-52 overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
                        <button
                          type="button"
                          onClick={() => cameraRef.current?.click()}
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-600 hover:bg-slate-50"
                        >
                          <Camera className="h-4 w-4" />
                          Take Photo
                        </button>
                        <button
                          type="button"
                          onClick={() => galleryRef.current?.click()}
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-600 hover:bg-slate-50"
                        >
                          <Image className="h-4 w-4" />
                          Choose Image
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}

              <input
                ref={cameraRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleImageChange}
                className="hidden"
              />
              <input
                ref={galleryRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={handleImageChange}
                className="hidden"
              />
            </div>

            {formError && (
              <div className="md:col-span-2">
                <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                  {formError}
                </p>
              </div>
            )}
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              disabled={createMut.isPending}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-base font-bold text-white shadow-sm transition hover:bg-indigo-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 sm:text-sm"
            >
              {createMut.isPending
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Upload className="h-4 w-4" />}
              Submit Report
            </button>
          </div>
        </form>
      </div>

      <div className={`${mobileSection === 'history' ? 'block' : 'hidden'} overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:block`}>
        {/* Mobile & tablet controls */}
        <div className="border-b border-slate-200 p-3 lg:hidden">
          <div className="grid grid-cols-2 rounded-xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setActiveTab('active')}
              className={`min-h-10 rounded-lg text-sm font-bold transition ${
                activeTab === 'active'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500'
              }`}
            >
              Active
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('trash')}
              className={`flex min-h-10 items-center justify-center gap-1.5 rounded-lg text-sm font-bold transition ${
                activeTab === 'trash'
                  ? 'bg-white text-rose-600 shadow-sm'
                  : 'text-slate-500'
              }`}
            >
              <Trash2 className="h-4 w-4" />
              Trash
            </button>
          </div>

          <div className="mt-3 flex gap-2">
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search customer or report #"
                className="min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-9 text-sm outline-none focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-500/15"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setMobileFiltersOpen((open) => !open)}
              className={`relative flex min-h-11 min-w-11 items-center justify-center rounded-xl border ${
                mobileFiltersOpen || statusFilter
                  ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                  : 'border-slate-200 bg-white text-slate-600'
              }`}
              aria-label="Filter reports"
            >
              <SlidersHorizontal className="h-5 w-5" />
              {statusFilter && (
                <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-indigo-600" />
              )}
            </button>
          </div>

          {mobileFiltersOpen && (
            <div className="mt-3">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Filter by status
              </p>
              <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                <button
                  type="button"
                  onClick={() => setStatusFilter('')}
                  className={`min-h-10 shrink-0 rounded-full border px-4 text-xs font-bold ${
                    !statusFilter
                      ? 'border-indigo-600 bg-indigo-600 text-white'
                      : 'border-slate-200 bg-white text-slate-600'
                  }`}
                >
                  All
                </button>
                {STATUSES.map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setStatusFilter(status)}
                    className={`min-h-10 shrink-0 rounded-full border px-4 text-xs font-bold ${
                      statusFilter === status
                        ? 'border-indigo-600 bg-indigo-600 text-white'
                        : 'border-slate-200 bg-white text-slate-600'
                    }`}
                  >
                    {statusLabel(status)}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mt-3 flex items-center justify-between gap-2">
            <label className="flex min-h-10 items-center gap-2 rounded-xl px-2 text-xs font-bold text-slate-600">
              <input
                type="checkbox"
                checked={allPageSelected}
                onChange={toggleAllOnPage}
                className="h-5 w-5 rounded border-slate-300 accent-indigo-600"
              />
              Select this page
            </label>

            <button
              type="button"
              onClick={exportPdf}
              disabled={exportingPdf}
              className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 disabled:opacity-50"
            >
              {exportingPdf
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <FileText className="h-4 w-4 text-rose-500" />}
              {selectedIds.size > 0 ? `PDF (${selectedIds.size})` : 'PDF'}
            </button>
          </div>

          {selectedIds.size > 0 && (
            <div className="mt-3 flex items-center justify-between rounded-xl border border-indigo-200 bg-indigo-50 p-2.5">
              <div className="flex items-center gap-2 text-sm font-bold text-indigo-800">
                <CheckSquare className="h-4 w-4" />
                {selectedIds.size} selected
              </div>
              {activeTab === 'active' && (
                <button
                  type="button"
                  onClick={() => setConfirmState({ type: 'bulk-trash' })}
                  className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-red-600 px-3 text-xs font-bold text-white"
                >
                  <Trash2 className="h-4 w-4" />
                  Move to Trash
                </button>
              )}
            </div>
          )}
        </div>

        {/* Desktop controls */}
        <div className="hidden items-center gap-2 border-b border-slate-200 p-3 lg:flex">
          <div className="flex shrink-0 gap-0.5 rounded-lg bg-slate-100 p-0.5">
            <button
              type="button"
              onClick={() => setActiveTab('active')}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
                activeTab === 'active'
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-500'
              }`}
            >
              Active
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('trash')}
              className={`inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-semibold ${
                activeTab === 'trash'
                  ? 'bg-white text-rose-600 shadow-sm'
                  : 'text-slate-500'
              }`}
            >
              <Trash2 className="h-3 w-3" />
              Trash
            </button>
          </div>

          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search report # or customer..."
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-8 pr-8 text-sm outline-none focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-500/15"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600"
          >
            <option value="">All statuses</option>
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {statusLabel(status)}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={exportPdf}
            disabled={exportingPdf}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-semibold text-slate-600 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
          >
            {exportingPdf
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <FileText className="h-3.5 w-3.5" />}
            PDF
          </button>

          {activeTab === 'active' && selectedIds.size > 0 && (
            <button
              type="button"
              onClick={() => setConfirmState({ type: 'bulk-trash' })}
              className="inline-flex items-center gap-1 rounded-lg px-2.5 py-2 text-xs font-semibold text-red-600 hover:bg-red-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Trash ({selectedIds.size})
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : isError ? (
          <div className="space-y-3 py-20 text-center">
            <AlertCircle className="mx-auto h-8 w-8 text-red-300" />
            <p className="text-sm text-slate-500">
              Failed to load payment reports.
            </p>
            <button
              type="button"
              onClick={() => refetch()}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold"
            >
              Retry
            </button>
          </div>
        ) : payments.length === 0 ? (
          <div className="py-20 text-center">
            <Image className="mx-auto mb-2 h-9 w-9 text-slate-200" />
            <p className="text-sm text-slate-400">
              {activeTab === 'trash'
                ? 'Trash is empty'
                : 'No payment reports found'}
            </p>
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[1400px] table-fixed text-sm">
                <thead className="bg-slate-800 text-white">
                  <tr>
                    <th className="w-12 px-3 py-4 text-center">
                      <input
                        type="checkbox"
                        checked={allPageSelected}
                        onChange={toggleAllOnPage}
                        className="h-3.5 w-3.5 rounded border-slate-400 accent-indigo-600"
                        aria-label="Select all reports on this page"
                      />
                    </th>
                    <th className="w-44 px-5 py-4 text-left text-[11px] font-bold uppercase">
                      Report
                    </th>
                    <th className="w-[170px] max-w-[170px] px-5 py-4 text-left text-[11px] font-bold uppercase">
                      Customer
                    </th>
                    <th className="w-[220px] min-w-[200px] px-5 py-4 text-left text-[11px] font-bold uppercase">
                      Reference #
                    </th>
                    <th className="w-40 px-5 py-4 text-right text-[11px] font-bold uppercase">
                      Amount
                    </th>
                    <th className="w-28 px-5 py-4 text-center text-[11px] font-bold uppercase">
                      Evidence
                    </th>
                    <th className="w-44 px-5 py-4 text-right text-[11px] font-bold uppercase">
                      Date
                    </th>
                    <th className="w-[210px] min-w-[210px] px-5 py-4 text-center text-[11px] font-bold uppercase">
                      Status
                    </th>
                    <th className="w-28 px-5 py-4 text-center text-[11px] font-bold uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-200">
                  {payments.map((payment) => (
                    <tr key={payment.id} className="transition hover:bg-slate-50">
                      <td className="px-3 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(payment.id)}
                          onChange={() => toggleSelection(payment.id)}
                          className="h-3.5 w-3.5 rounded border-slate-300 accent-indigo-600"
                          aria-label={`Select ${payment.reportNumber}`}
                        />
                      </td>
                      <td className="px-5 py-3">
                        <p className="font-bold text-slate-900">
                          {payment.reportNumber}
                        </p>
                        <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-indigo-600">
                          Payment Report
                        </p>
                      </td>
                      <td className="w-[170px] max-w-[170px] truncate px-5 py-3 text-slate-700">
                        {payment.customerName}
                      </td>
                      <td className="w-[220px] min-w-[200px] px-5 py-3 text-slate-700">
                        <span className="block truncate" title={payment.referenceNumber || ''}>
                          {payment.referenceNumber || '—'}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right font-bold text-slate-900">
                        {formatCurrency(payment.amount)}
                      </td>
                      <td className="px-5 py-3 text-center">
                        {payment.hasEvidence && payment.imageUrl ? (
                          <button
                            type="button"
                            onClick={() => setEvidencePayment(payment)}
                            className="inline-flex rounded-lg transition hover:ring-2 hover:ring-indigo-500 hover:ring-offset-2"
                          >
                            <PrivateImage
                              apiPath={payment.imageUrl}
                              alt="Payment evidence"
                              className="h-10 w-10 rounded-lg border border-slate-200 object-cover"
                            />
                          </button>
                        ) : (
                          <div className="flex justify-center">
                            <NoEvidenceIcon />
                          </div>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 text-right text-xs text-slate-500">
                        {formatDateTime(
                          activeTab === 'trash'
                            ? payment.salesRepDeletedAt ?? payment.createdAt
                            : payment.createdAt,
                        )}
                      </td>
                      <td className="w-[210px] min-w-[210px] whitespace-nowrap px-5 py-3 text-center">
                        <StatusBadge status={payment.status} />
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-center gap-1">
                          {payment.imageUrl && (
                            <button
                              type="button"
                              onClick={() => handleDownload(payment)}
                              title="Download evidence"
                              className="rounded-lg p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-600"
                            >
                              <Download className="h-4 w-4" />
                            </button>
                          )}
                          {activeTab === 'active' ? (
                            <button
                              type="button"
                              onClick={() => setConfirmState({
                                type: 'trash',
                                payment,
                              })}
                              title="Move to trash"
                              className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmState({
                                type: 'restore',
                                payment,
                              })}
                              title="Restore"
                              className="rounded-lg p-1.5 text-emerald-600 hover:bg-emerald-50"
                            >
                              <RotateCcw className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid gap-3 bg-slate-50 p-3 md:grid-cols-2 lg:hidden">
              {payments.map((payment) => {
                const selected = selectedIds.has(payment.id);
                const displayDate = activeTab === 'trash'
                  ? payment.salesRepDeletedAt ?? payment.createdAt
                  : payment.createdAt;

                return (
                  <article
                    key={payment.id}
                    className={`rounded-2xl border bg-white p-4 shadow-sm transition ${
                      selected
                        ? 'border-indigo-400 ring-2 ring-indigo-500/10'
                        : 'border-slate-200'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleSelection(payment.id)}
                        className="mt-0.5 h-5 w-5 shrink-0 rounded border-slate-300 accent-indigo-600"
                        aria-label={`Select ${payment.reportNumber}`}
                      />

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-extrabold text-slate-900">
                              {payment.reportNumber}
                            </p>
                            <p className="mt-0.5 truncate text-sm text-slate-500">
                              {payment.customerName}
                            </p>
                          </div>
                          <StatusBadge status={payment.status} />
                        </div>

                        <p className="mt-3 text-xl font-extrabold tracking-tight text-slate-900">
                          {formatCurrency(payment.amount)}
                        </p>
                        <p className="mt-1 truncate text-xs font-medium text-slate-500">
                          Ref: {payment.referenceNumber || '—'}
                        </p>
                        <p className="mt-1 text-xs font-medium text-slate-400">
                          {formatDateTime(displayDate)}
                        </p>
                      </div>
                    </div>

                    {payment.hasEvidence && payment.imageUrl ? (
                      <button
                        type="button"
                        onClick={() => setEvidencePayment(payment)}
                        className="mt-4 flex min-h-16 w-full items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-left active:scale-[0.99]"
                      >
                        <PrivateImage
                          apiPath={payment.imageUrl}
                          alt="Payment evidence"
                          className="h-12 w-12 rounded-lg border border-slate-200 object-cover"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-slate-700">
                            View payment evidence
                          </p>
                          <p className="text-xs text-slate-400">
                            Tap to open full image
                          </p>
                        </div>
                        <Image className="h-5 w-5 shrink-0 text-indigo-500" />
                      </button>
                    ) : (
                      <div className="mt-4 flex min-h-12 items-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-400">
                        <NoEvidenceIcon />
                        No evidence attached
                      </div>
                    )}

                    <div className="mt-3 grid grid-cols-2 gap-2">
                      {payment.imageUrl ? (
                        <button
                          type="button"
                          onClick={() => void handleDownload(payment)}
                          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 active:bg-slate-50"
                        >
                          <Download className="h-4 w-4 text-blue-600" />
                          Download
                        </button>
                      ) : (
                        <div />
                      )}

                      <button
                        type="button"
                        onClick={() => setConfirmState({
                          type: activeTab === 'active' ? 'trash' : 'restore',
                          payment,
                        })}
                        className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 text-xs font-bold ${
                          activeTab === 'active'
                            ? 'border border-red-200 bg-red-50 text-red-700'
                            : 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                        }`}
                      >
                        {activeTab === 'active' ? (
                          <>
                            <Trash2 className="h-4 w-4" />
                            Move to Trash
                          </>
                        ) : (
                          <>
                            <RotateCcw className="h-4 w-4" />
                            Restore
                          </>
                        )}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>

            <div className="border-t border-slate-200 bg-white px-3 py-4 sm:px-4">
              <div className="mb-3 flex items-center justify-between lg:mb-0">
                <p className="text-xs font-medium text-slate-500">
                  {totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}
                  {' '}–{' '}
                  {Math.min(page * PAGE_SIZE, totalCount)}
                  {' '}of {totalCount}
                  {isFetching && ' · Updating...'}
                </p>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600 lg:hidden">
                  Page {page} / {totalPages}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 lg:flex lg:items-center lg:justify-end lg:gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((value) => Math.max(1, value - 1))}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 disabled:opacity-40 lg:min-h-0 lg:rounded-lg lg:py-1.5 lg:text-xs"
                >
                  <ArrowLeft className="h-4 w-4 lg:h-3.5 lg:w-3.5" />
                  Previous
                </button>
                <span className="hidden min-w-20 text-center text-xs font-semibold text-slate-600 lg:inline">
                  Page {page} of {totalPages}
                </span>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3 text-sm font-bold text-indigo-700 disabled:opacity-40 lg:min-h-0 lg:rounded-lg lg:bg-white lg:py-1.5 lg:text-xs lg:text-slate-700"
                >
                  Next
                  <ArrowRight className="h-4 w-4 lg:h-3.5 lg:w-3.5" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <PaymentEvidenceLightbox
        payment={evidencePayment}
        imageUrl={
          evidencePayment?.imageUrl
            ? evidencePayment.imageUrl
            : null
        }
        onClose={() => setEvidencePayment(null)}
        onDownload={() => {
          if (evidencePayment) void handleDownload(evidencePayment);
        }}
      />

      <PaymentReportConfirmDialog
        open={!!confirmState}
        variant={confirmState?.type === 'restore' ? 'restore' : 'trash'}
        title={
          confirmState?.type === 'restore'
            ? 'Restore payment report?'
            : confirmState?.type === 'bulk-trash'
              ? 'Move selected reports to trash?'
              : 'Move payment report to trash?'
        }
        description={
          confirmState?.type === 'restore'
            ? 'This report will return to your Active list.'
            : confirmState?.type === 'bulk-trash'
              ? `${selectedIds.size} selected report(s) will move to your Sales Rep Trash only.`
              : 'This report will move to your Sales Rep Trash only. Admin and Coordinator visibility will not change.'
        }
        reportNumber={confirmState?.payment?.reportNumber}
        customerName={confirmState?.payment?.customerName}
        confirmLabel={
          confirmState?.type === 'restore'
            ? 'Restore'
            : 'Move to Trash'
        }
        isPending={trashMut.isPending || restoreMut.isPending || bulkTrashMut.isPending}
        onClose={() => setConfirmState(null)}
        onConfirm={handleConfirm}
      />
    </div>
  );
}