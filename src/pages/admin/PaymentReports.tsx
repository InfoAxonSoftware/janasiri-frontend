// @ts-nocheck
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpDown,
  Check,
  Download,
  FileSpreadsheet,
  FileText,
  Image,
  Loader2,
  RefreshCw,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Trash2,
  X,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import {
  repPaymentsApi,
  type RepPaymentDto,
  type RepPaymentStatus,
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
  PaymentReportStatusDialog,
} from '../../components/paymentReports/PaymentReportDialogs';
import { PrivateImage } from '../../components/common/PrivateImage';

const API_BASE = import.meta.env.VITE_API_URL?.replace('/api', '') || '';
const STATUSES: RepPaymentStatus[] = [
  'AwaitingConfirmation',
  'Confirmed',
  'Approved',
  'Rejected',
];
const PAGE_SIZE = 20;

function statusLabel(status: string) {
  return status.replace(/([a-z])([A-Z])/g, '$1 $2');
}

function SortIcon({ field, sortField, sortDir }) {
  if (sortField !== field) {
    return <ArrowUpDown className="h-3 w-3 opacity-35" />;
  }

  return sortDir === 'asc'
    ? <ArrowUp className="h-3 w-3" />
    : <ArrowDown className="h-3 w-3" />;
}

export default function AdminPaymentReports() {
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'active' | 'trash'>('active');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search.trim(), 400);
  const [statusFilter, setStatusFilter] = useState('');
  const [repFilter, setRepFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [sortField, setSortField] = useState('createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [exportingPdf, setExportingPdf] = useState(false);

  const [evidencePayment, setEvidencePayment] = useState<RepPaymentDto | null>(null);
  const [statusPayment, setStatusPayment] = useState<RepPaymentDto | null>(null);
  const [confirmState, setConfirmState] = useState<{
    type: 'trash' | 'restore' | 'permanent' | 'bulk-trash';
    payment?: RepPaymentDto;
  } | null>(null);

  const queryParams = useMemo(() => ({
    page,
    pageSize: PAGE_SIZE,
    search: debouncedSearch || undefined,
    status: statusFilter || undefined,
    repId: repFilter || undefined,
    fromDate: fromDate || undefined,
    toDate: toDate || undefined,
    sortField,
    sortDir,
    view: activeTab,
  }), [
    page,
    debouncedSearch,
    statusFilter,
    repFilter,
    fromDate,
    toDate,
    sortField,
    sortDir,
    activeTab,
  ]);

  const {
    data,
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: activeTab === 'active'
      ? paymentReportKeys.list('admin', queryParams)
      : paymentReportKeys.trash('admin', queryParams),
    queryFn: () => activeTab === 'active'
      ? repPaymentsApi.getAll(queryParams)
      : repPaymentsApi.getTrash(queryParams),
    placeholderData: (previousData) => previousData,
  });

  const { data: repOptions = [] } = useQuery({
    queryKey: paymentReportKeys.repOptions('admin'),
    queryFn: repPaymentsApi.getAdminRepOptions,
    staleTime: 5 * 60 * 1000,
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
  }, [
    activeTab,
    debouncedSearch,
    statusFilter,
    repFilter,
    fromDate,
    toDate,
    sortField,
    sortDir,
  ]);

  useEffect(() => {
    if (data && page > totalPages) setPage(totalPages);
  }, [data, page, totalPages]);

  const invalidateReports = () =>
    queryClient.invalidateQueries({ queryKey: paymentReportKeys.all });

  const softDeleteMut = useMutation({
    mutationFn: repPaymentsApi.softDelete,
    onSuccess: async () => {
      setConfirmState(null);
      setSelectedIds(new Set());
      await invalidateReports();
      toast.success('Moved to trash');
    },
    onError: () => toast.error('Failed to move report to trash'),
  });

  const restoreMut = useMutation({
    mutationFn: repPaymentsApi.restore,
    onSuccess: async () => {
      setConfirmState(null);
      await invalidateReports();
      toast.success('Payment report restored');
    },
    onError: () => toast.error('Restore failed'),
  });

  const hardDeleteMut = useMutation({
    mutationFn: repPaymentsApi.hardDelete,
    onSuccess: async () => {
      setConfirmState(null);
      await invalidateReports();
      toast.success('Permanently deleted');
    },
    onError: () => toast.error('Permanent delete failed'),
  });

  const bulkDeleteMut = useMutation({
    mutationFn: (ids: string[]) => repPaymentsApi.bulkDelete(ids),
    onSuccess: async () => {
      setConfirmState(null);
      setSelectedIds(new Set());
      await invalidateReports();
      toast.success('Selected reports moved to trash');
    },
    onError: () => toast.error('Bulk delete failed'),
  });

  const bulkStatusMut = useMutation({
    mutationFn: ({ ids, status }: { ids: string[]; status: string }) =>
      repPaymentsApi.bulkStatus(ids, status),
    onSuccess: async () => {
      setSelectedIds(new Set());
      await invalidateReports();
      toast.success('Status updated');
    },
    onError: () => toast.error('Bulk status update failed'),
  });

  const updateStatusMut = useMutation({
    mutationFn: ({
      payment,
      status,
      adminNotes,
    }: {
      payment: RepPaymentDto;
      status: RepPaymentStatus;
      adminNotes?: string;
    }) => repPaymentsApi.updateStatus(payment.id, { status, adminNotes }),
    onSuccess: async () => {
      setStatusPayment(null);
      await invalidateReports();
      toast.success('Status updated');
    },
    onError: () => toast.error('Status update failed'),
  });

  const activeFilterCount =
    (statusFilter ? 1 : 0)
    + (repFilter ? 1 : 0)
    + (fromDate || toDate ? 1 : 0);

  const allPageSelected =
    activeTab === 'active'
    && payments.length > 0
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

      for (const payment of payments) {
        if (allSelected) next.delete(payment.id);
        else next.add(payment.id);
      }

      return next;
    });
  };

  const toggleSort = (field: string) => {
    if (sortField === field) {
      setSortDir((direction) => direction === 'asc' ? 'desc' : 'asc');
      return;
    }

    setSortField(field);
    setSortDir('asc');
  };

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('');
    setRepFilter('');
    setFromDate('');
    setToDate('');
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

  const exportRows = selectedIds.size > 0
    ? payments.filter((payment) => selectedIds.has(payment.id))
    : payments;

  const exportExcel = () => {
    if (exportRows.length === 0) {
      toast.error('No reports on this page to export');
      return;
    }

    const rows = exportRows.map((payment) => ({
      'Report #': payment.reportNumber,
      'Sales Rep': payment.repName,
      Customer: payment.customerName,
      'Reference #': payment.referenceNumber || '—',
      'Amount (LKR)': payment.amount,
      Evidence: payment.hasEvidence ? 'Yes' : 'No',
      Status: statusLabel(payment.status),
      'Submitted Date': formatDateTime(payment.createdAt),
      'Last Updated': payment.updatedAt
        ? formatDateTime(payment.updatedAt)
        : '',
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Payment Reports');
    XLSX.writeFile(workbook, 'payment-reports.xlsx');
    toast.success('Excel exported');
  };

  const exportPdf = async () => {
    setExportingPdf(true);

    try {
      const rows = selectedIds.size > 0
        ? await Promise.all(
            [...selectedIds].map((id) => repPaymentsApi.getByIdAdmin(id)),
          )
        : await fetchAllPaymentReports(
            activeTab === 'active'
              ? repPaymentsApi.getAll
              : repPaymentsApi.getTrash,
            queryParams,
          );

      if (rows.length === 0) {
        toast.error('No payment reports to export');
        return;
      }

      await downloadPaymentReportsPdf(rows, {
        title: 'PAYMENT REPORTS',
        view: activeTab,
        fileName: selectedIds.size === 1
          ? `${rows[0].reportNumber}.pdf`
          : 'payment-reports.pdf',
        scopeLabel: selectedIds.size > 0
          ? `${selectedIds.size} selected report(s)`
          : 'All reports matching the current filters',
      });

      toast.success(
        selectedIds.size > 0
          ? `${rows.length} selected report(s) exported`
          : `${rows.length} report(s) exported`,
      );
    } catch (error) {
      console.error('Payment report PDF export failed', error);
      toast.error('PDF export failed');
    } finally {
      setExportingPdf(false);
    }
  };

  const confirmPending =
    softDeleteMut.isPending
    || restoreMut.isPending
    || hardDeleteMut.isPending
    || bulkDeleteMut.isPending;

  const handleConfirm = () => {
    if (!confirmState) return;

    if (confirmState.type === 'bulk-trash') {
      bulkDeleteMut.mutate([...selectedIds]);
      return;
    }

    const payment = confirmState.payment;
    if (!payment) return;

    if (confirmState.type === 'trash') {
      softDeleteMut.mutate(payment.id);
    } else if (confirmState.type === 'restore') {
      restoreMut.mutate(payment.id);
    } else {
      hardDeleteMut.mutate(payment.id);
    }
  };

  return (
    <div className="animate-fade-in flex flex-col gap-4 pb-24">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Receive Payments</h1>
        <p className="mt-1 text-sm text-slate-500">
          Review and manage received payments submitted by sales representatives
        </p>
      </div>

      <div className="sticky top-0 z-30">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white/95 shadow-sm backdrop-blur-sm">
          <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 sm:flex-nowrap">
            <div className="order-1 flex shrink-0 gap-0.5 rounded-lg bg-slate-100 p-0.5">
              <button
                type="button"
                onClick={() => setActiveTab('active')}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                  activeTab === 'active'
                    ? 'bg-white text-slate-800 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Active
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('trash')}
                className={`inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                  activeTab === 'trash'
                    ? 'bg-white text-rose-600 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Trash2 className="h-3 w-3" />
                Trash
              </button>
            </div>

            <div className="group relative order-3 w-full sm:order-2 sm:flex-1">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search report #, rep or customer..."
                className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-8 pr-8 text-sm outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-500/15"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="order-2 ml-auto flex shrink-0 items-center gap-1 sm:order-3 sm:ml-0">
              <button
                type="button"
                onClick={() => setFilterPanelOpen((open) => !open)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-semibold transition ${
                  filterPanelOpen
                    ? 'bg-indigo-600 text-white'
                    : activeFilterCount > 0
                      ? 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200'
                      : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Filter</span>
                {activeFilterCount > 0 && (
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-indigo-600 text-[9px] font-bold text-white">
                    {activeFilterCount}
                  </span>
                )}
              </button>

              <div className="mx-0.5 h-5 w-px bg-slate-200" />

              <button
                type="button"
                onClick={exportExcel}
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-semibold text-slate-600 transition hover:bg-emerald-50 hover:text-emerald-700"
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                <span className="hidden lg:inline">Excel</span>
              </button>
              <button
                type="button"
                onClick={exportPdf}
                disabled={exportingPdf}
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-semibold text-slate-600 transition hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {exportingPdf
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <FileText className="h-3.5 w-3.5" />}
                <span className="hidden lg:inline">PDF</span>
              </button>

              {activeTab === 'active' && selectedIds.size > 0 && (
                <>
                  <div className="mx-0.5 h-5 w-px bg-slate-200" />
                  <select
                    defaultValue=""
                    disabled={bulkStatusMut.isPending}
                    onChange={(event) => {
                      const status = event.target.value;
                      if (!status) return;

                      bulkStatusMut.mutate({
                        ids: [...selectedIds],
                        status,
                      });

                      event.target.value = "";
                    }}
                    className="max-w-40 rounded-lg border border-indigo-200 bg-indigo-50 px-2 py-1.5 text-[10px] font-semibold text-indigo-700 outline-none"
                    aria-label="Change selected payment report statuses"
                  >
                    <option value="">Change status...</option>
                    {STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {statusLabel(status)}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setConfirmState({ type: 'bulk-trash' })}
                    className="inline-flex items-center gap-1 rounded-lg px-2.5 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span className="hidden lg:inline">
                      Trash ({selectedIds.size})
                    </span>
                  </button>
                </>
              )}
            </div>
          </div>

          {filterPanelOpen && (
            <div className="grid gap-3 border-t border-slate-200 bg-slate-50 p-4 md:grid-cols-4">
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                <option value="">All statuses</option>
                {STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {statusLabel(status)}
                  </option>
                ))}
              </select>

              <select
                value={repFilter}
                onChange={(event) => setRepFilter(event.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                <option value="">All sales reps</option>
                {repOptions.map((rep) => (
                  <option key={rep.id} value={rep.id}>
                    {rep.name}
                  </option>
                ))}
              </select>

              <input
                type="date"
                value={fromDate}
                onChange={(event) => setFromDate(event.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              />
              <input
                type="date"
                value={toDate}
                onChange={(event) => setToDate(event.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              />

              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-left text-xs font-semibold text-red-500 hover:text-red-700 md:col-span-4"
                >
                  Clear all filters
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
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
              <table className="w-full min-w-[1600px] table-fixed text-sm">
                <thead className="bg-slate-800 text-white">
                  <tr>
                    {activeTab === 'active' && (
                      <th className="w-12 px-4 py-4 text-center">
                        <input
                          type="checkbox"
                          checked={allPageSelected}
                          onChange={toggleAllOnPage}
                          className="rounded"
                        />
                      </th>
                    )}
                    <th
                      className="w-44 cursor-pointer px-4 py-4 text-left text-[11px] font-bold uppercase"
                      onClick={() => toggleSort('reportNumber')}
                    >
                      <span className="flex items-center gap-1">
                        Report
                        <SortIcon
                          field="reportNumber"
                          sortField={sortField}
                          sortDir={sortDir}
                        />
                      </span>
                    </th>
                    <th
                      className="w-44 cursor-pointer px-4 py-4 text-left text-[11px] font-bold uppercase"
                      onClick={() => toggleSort('repName')}
                    >
                      <span className="flex items-center gap-1">
                        Rep
                        <SortIcon field="repName" sortField={sortField} sortDir={sortDir} />
                      </span>
                    </th>
                    <th
                      className="w-[170px] max-w-[170px] cursor-pointer px-4 py-4 text-left text-[11px] font-bold uppercase"
                      onClick={() => toggleSort('customerName')}
                    >
                      <span className="flex items-center gap-1">
                        Customer
                        <SortIcon field="customerName" sortField={sortField} sortDir={sortDir} />
                      </span>
                    </th>
                    <th className="w-[220px] min-w-[200px] px-4 py-4 text-left text-[11px] font-bold uppercase">
                      Reference #
                    </th>
                    <th
                      className="w-40 cursor-pointer px-4 py-4 text-right text-[11px] font-bold uppercase"
                      onClick={() => toggleSort('amount')}
                    >
                      <span className="flex items-center justify-end gap-1">
                        Amount
                        <SortIcon field="amount" sortField={sortField} sortDir={sortDir} />
                      </span>
                    </th>
                    <th className="w-28 px-4 py-4 text-center text-[11px] font-bold uppercase">
                      Evidence
                    </th>
                    <th
                      className="w-44 cursor-pointer px-4 py-4 text-right text-[11px] font-bold uppercase"
                      onClick={() => toggleSort('createdAt')}
                    >
                      <span className="flex items-center justify-end gap-1">
                        Date
                        <SortIcon field="createdAt" sortField={sortField} sortDir={sortDir} />
                      </span>
                    </th>
                    <th
                      className="w-[210px] min-w-[210px] cursor-pointer px-4 py-4 text-center text-[11px] font-bold uppercase"
                      onClick={() => toggleSort('status')}
                    >
                      <span className="flex items-center justify-center gap-1">
                        Status
                        <SortIcon field="status" sortField={sortField} sortDir={sortDir} />
                      </span>
                    </th>
                    <th className="w-36 px-4 py-4 text-center text-[11px] font-bold uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-200">
                  {payments.map((payment) => (
                    <tr key={payment.id} className="transition hover:bg-slate-50">
                      {activeTab === 'active' && (
                        <td className="px-4 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(payment.id)}
                            onChange={() => toggleSelection(payment.id)}
                            className="rounded border-slate-300"
                          />
                        </td>
                      )}
                      <td className="px-4 py-3">
                        <p className="font-bold text-slate-900">
                          {payment.reportNumber}
                        </p>
                        <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-indigo-600">
                          Payment Report
                        </p>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {payment.repName}
                      </td>
                      <td className="w-[170px] max-w-[170px] truncate px-4 py-3 text-slate-700">
                        {payment.customerName}
                      </td>
                      <td className="w-[220px] min-w-[200px] px-4 py-3 text-slate-700">
                        <span className="block truncate" title={payment.referenceNumber || ''}>
                          {payment.referenceNumber || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-slate-900">
                        {formatCurrency(payment.amount)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {payment.hasEvidence && payment.imageUrl ? (
                          <button
                            type="button"
                            onClick={() => setEvidencePayment(payment)}
                            className="inline-flex rounded-lg outline-none ring-indigo-500 transition hover:ring-2 hover:ring-offset-2"
                            title="Preview evidence"
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
                      <td className="whitespace-nowrap px-4 py-3 text-right text-xs text-slate-500">
                        {formatDateTime(
                          activeTab === 'trash'
                            ? payment.adminDeletedAt ?? payment.createdAt
                            : payment.createdAt,
                        )}
                      </td>
                      <td className="w-[210px] min-w-[210px] whitespace-nowrap px-4 py-3 text-center">
                        <StatusBadge status={payment.status} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          {activeTab === 'active' ? (
                            <>
                              <button
                                type="button"
                                onClick={() => setStatusPayment(payment)}
                                title="Change status"
                                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-indigo-50 hover:text-indigo-600"
                              >
                                <RefreshCw className="h-4 w-4" />
                              </button>
                              {payment.imageUrl && (
                                <button
                                  type="button"
                                  onClick={() => handleDownload(payment)}
                                  title="Download evidence"
                                  className="rounded-lg p-1.5 text-slate-400 transition hover:bg-blue-50 hover:text-blue-600"
                                >
                                  <Download className="h-4 w-4" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => setConfirmState({
                                  type: 'trash',
                                  payment,
                                })}
                                title="Move to trash"
                                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => setConfirmState({
                                  type: 'restore',
                                  payment,
                                })}
                                title="Restore"
                                className="rounded-lg p-1.5 text-emerald-600 transition hover:bg-emerald-50"
                              >
                                <RotateCcw className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmState({
                                  type: 'permanent',
                                  payment,
                                })}
                                title="Permanently delete"
                                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-slate-100 lg:hidden">
              {payments.map((payment) => (
                <div key={payment.id} className="flex gap-3 px-4 py-4">
                  {activeTab === 'active' && (
                    <input
                      type="checkbox"
                      checked={selectedIds.has(payment.id)}
                      onChange={() => toggleSelection(payment.id)}
                      className="mt-1 rounded border-slate-300"
                    />
                  )}

                  {payment.hasEvidence && payment.imageUrl ? (
                    <button
                      type="button"
                      onClick={() => setEvidencePayment(payment)}
                      className="h-14 w-14 shrink-0"
                    >
                      <PrivateImage
                        apiPath={payment.imageUrl}
                        alt="Payment evidence"
                        className="h-14 w-14 rounded-xl border border-slate-200 object-cover"
                      />
                    </button>
                  ) : (
                    <NoEvidenceIcon />
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-slate-900">
                          {payment.reportNumber}
                        </p>
                        <p className="truncate text-xs text-slate-500">
                          {payment.customerName}
                        </p>
                      </div>
                      <StatusBadge status={payment.status} />
                    </div>
                    <p className="mt-1 text-xs text-slate-400">
                      {payment.repName}
                    </p>
                    <p className="mt-1 font-bold text-slate-900">
                      {formatCurrency(payment.amount)}
                    </p>
                    <p className="mt-1 truncate text-xs text-slate-500">
                      Ref: {payment.referenceNumber || '—'}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      {formatDateTime(payment.createdAt)}
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-col gap-1">
                    {activeTab === 'active' ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setStatusPayment(payment)}
                          className="rounded-lg p-1.5 text-indigo-600 hover:bg-indigo-50"
                        >
                          <RefreshCw className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmState({
                            type: 'trash',
                            payment,
                          })}
                          className="rounded-lg p-1.5 text-red-500 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmState({
                          type: 'restore',
                          payment,
                        })}
                        className="rounded-lg p-1.5 text-emerald-600 hover:bg-emerald-50"
                      >
                        <RotateCcw className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-slate-500">
                Showing {totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}
                {' '}–{' '}
                {Math.min(page * PAGE_SIZE, totalCount)}
                {' '}of {totalCount} reports
                {isFetching && ' · Updating...'}
              </p>
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((value) => Math.max(1, value - 1))}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 disabled:opacity-40"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Previous
                </button>
                <span className="min-w-20 text-center text-xs font-semibold text-slate-600">
                  Page {page} of {totalPages}
                </span>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 disabled:opacity-40"
                >
                  Next
                  <ArrowRight className="h-3.5 w-3.5" />
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

      <PaymentReportStatusDialog
        payment={statusPayment}
        isPending={updateStatusMut.isPending}
        onClose={() => setStatusPayment(null)}
        onConfirm={(status, adminNotes) => {
          if (!statusPayment) return;
          updateStatusMut.mutate({
            payment: statusPayment,
            status,
            adminNotes,
          });
        }}
      />

      <PaymentReportConfirmDialog
        open={!!confirmState}
        variant={
          confirmState?.type === 'restore'
            ? 'restore'
            : confirmState?.type === 'permanent'
              ? 'delete'
              : 'trash'
        }
        title={
          confirmState?.type === 'restore'
            ? 'Restore payment report?'
            : confirmState?.type === 'permanent'
              ? 'Permanently delete payment report?'
              : confirmState?.type === 'bulk-trash'
                ? 'Move selected reports to trash?'
                : 'Move payment report to trash?'
        }
        description={
          confirmState?.type === 'restore'
            ? 'This report will return to your Active list.'
            : confirmState?.type === 'permanent'
              ? 'This permanently removes the record and evidence file. This action cannot be undone.'
              : confirmState?.type === 'bulk-trash'
                ? `${selectedIds.size} selected report(s) will move to the Admin Trash only.`
                : 'This report will move to the Admin Trash only and remain visible to other roles.'
        }
        reportNumber={confirmState?.payment?.reportNumber}
        customerName={confirmState?.payment?.customerName}
        confirmLabel={
          confirmState?.type === 'restore'
            ? 'Restore'
            : confirmState?.type === 'permanent'
              ? 'Delete Permanently'
              : 'Move to Trash'
        }
        isPending={confirmPending}
        onClose={() => setConfirmState(null)}
        onConfirm={handleConfirm}
      />
    </div>
  );
}
