// @ts-nocheck
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { PrivateImage } from '../../components/common/PrivateImage';
import { downloadPrivateFile } from '../../utils/fileAccess';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Check,
  ChevronRight,
  Download,
  FileSpreadsheet,
  FileText,
  Plus,
  Search,
  ShoppingCart,
  SlidersHorizontal,
  Trash2,
  RotateCcw,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { ordersApi } from '../../services/api/ordersApi';
import { customersApi } from '../../services/api/customersApi';
import { quickRequestApi } from '../../services/api/quickRequestApi';
import { formatCurrency, formatDateTime } from '../../utils/formatters';
import StatusBadge from '../../components/common/StatusBadge';
import RoleOrderTrash from '../../components/orders/RoleOrderTrash';
import type { OrderStatus } from '../../types/order.types';
import {
  downloadQuickRequestExcel,
  downloadQuickRequestPdf,
} from '../../utils/quickRequestPdf';

const BASE = import.meta.env.VITE_API_URL?.replace('/api', '') || '';
const STATUS_OPTIONS = [
  'Pending',
  'Approved',
  'Rejected',
  'Completed',
  'Cancelled',
];

const selectionKey = (row: any) =>
  `${row._isQuick ? 'quick' : 'order'}:${row.id}`;

type DeleteConfirmState =
  | {
      mode: 'single';
      rows: any[];
    }
  | {
      mode: 'bulk';
      rows: any[];
    };

export default function RepOrders() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'active' | 'trash'>('active');
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<OrderStatus | ''>('');
  const [search, setSearch] = useState('');
  const [customerIdFilter, setCustomerIdFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const [sortField, setSortField] = useState('orderDate');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [selectedMobileOrder, setSelectedMobileOrder] = useState<any>(null);
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [filterSubPanel, setFilterSubPanel] = useState<
    'status' | 'customer' | 'date' | null
  >(null);
  const [quickLightbox, setQuickLightbox] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] =
    useState<DeleteConfirmState | null>(null);

  const longPressTimerRef = useRef<number | null>(null);
  const longPressTriggeredRef = useRef(false);

  const { data: customersData = [] } = useQuery({
    queryKey: ['rep-order-customer-names'],
    queryFn: () =>
      customersApi
        .repGetCustomers({ page: 1, pageSize: 2000 })
        .then((response) => response.data.data.items || []),
    staleTime: 5 * 60 * 1000,
  });

  const { data, isLoading } = useQuery({
    queryKey: [
      'rep-orders',
      page,
      status,
      fromDate,
      toDate,
      customerIdFilter,
      search,
      sortField,
      sortDir,
    ],
    queryFn: () =>
      ordersApi
        .repGetUnified({
          page,
          pageSize: 20,
          status: status || undefined,
          search: search || undefined,
          fromDate: fromDate || undefined,
          toDate: toDate || undefined,
          customerId: customerIdFilter || undefined,
          sortField,
          sortDirection: sortDir,
        })
        .then((response) => {
          const result: any = response.data.data;
          return {
            ...result,
            items: (result?.items || []).map((item: any) => item.kind === 'QuickOrder'
              ? { ...item.quickOrder, _isQuick: true, _quick: item.quickOrder,
                  orderNumber: item.number, orderDate: item.date, items: [], totalAmount: 0 }
              : { ...item.order, _isQuick: false }),
          };
        }),
    enabled: activeTab === 'active',
  });

  const { data: quickData = [], isLoading: quickLoading } = useQuery({
    queryKey: ['rep-quick-orders'],
    queryFn: () =>
      quickRequestApi.repGetAll('Order').then((response) => response.data.data),
    enabled: false,
    staleTime: 30_000,
  });

  const {
    data: trashData = { items: [], totalPages: 1, totalCount: 0, page: 1 },
    isLoading: trashLoading,
  } = useQuery({
    queryKey: ['rep-orders-trash', page],
    queryFn: () =>
      ordersApi.repGetTrash(page, 20).then((response) => response.data.data),
    enabled: false,
  });

  const { data: quickTrashData = [], isLoading: quickTrashLoading } = useQuery({
    queryKey: ['rep-quick-orders-trash'],
    queryFn: () =>
      quickRequestApi
        .repGetTrash('Order')
        .then((response) => response.data.data),
    enabled: false,
  });

  const customerNameById = useMemo(
    () =>
      new Map(
        (customersData || []).map((customer: any) => [
          customer.id,
          customer.shopName,
        ]),
      ),
    [customersData],
  );

  const deleteOrderMut = useMutation({
    mutationFn: (id: string) => ordersApi.repDelete(id),
    onSuccess: (_response, id) => {
      queryClient.setQueriesData(
        { queryKey: ['rep-orders'] },
        (old: any) =>
          old
            ? {
                ...old,
                items: old.items?.filter((order: any) => order.id !== id),
                totalCount: Math.max(0, (old.totalCount || 0) - 1),
              }
            : old,
      );
      queryClient.invalidateQueries({ queryKey: ['rep-orders'] });
      queryClient.invalidateQueries({
        queryKey: ['role-orders-trash', 'rep'],
      });
      toast.success('Moved to trash');
    },
    onError: () => toast.error('Delete failed'),
  });

  const deleteQuickMut = useMutation({
    mutationFn: (id: string) => quickRequestApi.repDelete(id),
    onSuccess: (_response, id) => {
      queryClient.setQueriesData(
        { queryKey: ['rep-orders'] },
        (old: any) =>
          old
            ? {
                ...old,
                items: old.items?.filter(
                  (order: any) => order.id !== id,
                ),
                totalCount: Math.max(
                  0,
                  (old.totalCount || 0) - 1,
                ),
              }
            : old,
      );
      queryClient.invalidateQueries({ queryKey: ['rep-orders'] });
      queryClient.invalidateQueries({
        queryKey: ['role-orders-trash', 'rep'],
      });
      toast.success('Moved to trash');
    },
    onError: () => toast.error('Delete failed'),
  });

  const restoreOrderMut = useMutation({
    mutationFn: (id: string) => ordersApi.repRestore(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rep-orders'] });
      queryClient.invalidateQueries({
        queryKey: ['role-orders-trash', 'rep'],
      });
      toast.success('Order restored');
    },
    onError: () => toast.error('Restore failed'),
  });

  const restoreQuickMut = useMutation({
    mutationFn: (id: string) => quickRequestApi.repRestore(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rep-orders'] });
      queryClient.invalidateQueries({
        queryKey: ['role-orders-trash', 'rep'],
      });
      toast.success('Quick order restored');
    },
    onError: () => toast.error('Restore failed'),
  });

  const bulkDeleteMut = useMutation({
    mutationFn: async (rows: any[]) => {
      await Promise.all(
        rows.map((row) =>
          row._isQuick
            ? quickRequestApi.repDelete(row.id)
            : ordersApi.repDelete(row.id),
        ),
      );
    },
    onSuccess: (_response, rows) => {
      const deletedIds = new Set(
        rows.map((row: any) => row.id),
      );

      queryClient.setQueriesData(
        { queryKey: ['rep-orders'] },
        (old: any) =>
          old
            ? {
                ...old,
                items: old.items?.filter(
                  (order: any) => !deletedIds.has(order.id),
                ),
                totalCount: Math.max(
                  0,
                  (old.totalCount || 0) - rows.length,
                ),
              }
            : old,
      );

      queryClient.invalidateQueries({ queryKey: ['rep-orders'] });
      queryClient.invalidateQueries({
        queryKey: ['role-orders-trash', 'rep'],
      });
      setSelectedKeys(new Set());
      toast.success(
        `${rows.length} order${rows.length === 1 ? '' : 's'} moved to trash`,
      );
    },
    onError: () => toast.error('Some selected orders could not be deleted'),
  });

  const regularRows = data?.items || [];

  const quickRows = useMemo(() => {
    // Quick Orders are already included in the unified backend page.
    return [];

    let rows = (quickData || []).map((request: any) => ({
      _isQuick: true,
      _quick: request,
      id: request.id,
      orderNumber: request.requestNumber,
      customerName: request.customerName,
      orderDate: request.createdAt,
      status: request.status,
      items: [],
      totalAmount: 0,
    }));

    if (status) {
      rows = rows.filter((row: any) => row.status === status);
    }

    if (customerIdFilter) {
      const selectedCustomerName = customerNameById
        .get(customerIdFilter)
        ?.toLowerCase();
      if (selectedCustomerName) {
        rows = rows.filter(
          (row: any) =>
            (row.customerName || '').toLowerCase() === selectedCustomerName,
        );
      }
    }

    if (fromDate) {
      rows = rows.filter(
        (row: any) =>
          row.orderDate &&
          String(row.orderDate).slice(0, 10) >= fromDate,
      );
    }

    if (toDate) {
      rows = rows.filter(
        (row: any) =>
          row.orderDate &&
          String(row.orderDate).slice(0, 10) <= toDate,
      );
    }

    return rows;
  }, [
    quickData,
    page,
    status,
    customerIdFilter,
    customerNameById,
    fromDate,
    toDate,
  ]);

  const visibleRows = useMemo(() => {
    const query = search.trim().toLowerCase();

    const rows = [...regularRows, ...quickRows].filter((row: any) => {
      if (!query) return true;

      const customerName = row._isQuick
        ? row.customerName
        : customerNameById.get(row.customerId) ||
          row.customerName ||
          'Customer';

      return (
        String(row.orderNumber || '')
          .toLowerCase()
          .includes(query) ||
        String(customerName).toLowerCase().includes(query)
      );
    });

    return rows.sort((first: any, second: any) => {
      let firstValue: any;
      let secondValue: any;

      switch (sortField) {
        case 'orderNumber':
          firstValue = first.orderNumber || '';
          secondValue = second.orderNumber || '';
          break;
        case 'customerName':
          firstValue = first._isQuick
            ? first.customerName || ''
            : customerNameById.get(first.customerId) ||
              first.customerName ||
              '';
          secondValue = second._isQuick
            ? second.customerName || ''
            : customerNameById.get(second.customerId) ||
              second.customerName ||
              '';
          break;
        case 'totalAmount':
          firstValue = first.totalAmount || 0;
          secondValue = second.totalAmount || 0;
          break;
        case 'status':
          firstValue = first.status || '';
          secondValue = second.status || '';
          break;
        default:
          firstValue = first.orderDate || first.createdAt || '';
          secondValue = second.orderDate || second.createdAt || '';
      }

      if (typeof firstValue === 'string') {
        firstValue = firstValue.toLowerCase();
      }
      if (typeof secondValue === 'string') {
        secondValue = secondValue.toLowerCase();
      }

      if (firstValue < secondValue) return sortDir === 'asc' ? -1 : 1;
      if (firstValue > secondValue) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [
    regularRows,
    quickRows,
    search,
    sortField,
    sortDir,
    customerNameById,
  ]);

  const selectedRows = useMemo(
    () =>
      visibleRows.filter((row: any) =>
        selectedKeys.has(selectionKey(row)),
      ),
    [visibleRows, selectedKeys],
  );

  const allVisibleSelected =
    visibleRows.length > 0 &&
    visibleRows.every((row: any) =>
      selectedKeys.has(selectionKey(row)),
    );

  const activeFilterCount =
    (status ? 1 : 0) +
    (customerIdFilter ? 1 : 0) +
    (fromDate || toDate ? 1 : 0);

  const totalPages = Math.max(1, data?.totalPages || 1);
  const regularTotalCount = data?.totalCount || 0;
  const activeTotalCount = regularTotalCount;

  useEffect(() => {
    setSelectedKeys(new Set());
    setExpandedKey(null);
  }, [page, status, customerIdFilter, fromDate, toDate, activeTab]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelectedKeys(new Set());
      }
    };

    window.addEventListener('keydown', handleEscape);

    return () => {
      window.removeEventListener('keydown', handleEscape);
      cancelLongPress();
    };
  }, []);

  const getCustomerName = (row: any) => {
    if (row._isQuick) return row.customerName || 'Customer';

    const customerName =
      customerNameById.get(row.customerId) ||
      row.customerName ||
      'Customer';

    return customerName.includes('@') ? 'Customer' : customerName;
  };

  const toggleSelection = (row: any) => {
    const key = selectionKey(row);

    setSelectedKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const cancelLongPress = () => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const startLongPress = (row: any) => {
    cancelLongPress();
    longPressTriggeredRef.current = false;

    longPressTimerRef.current = window.setTimeout(() => {
      longPressTriggeredRef.current = true;
      toggleSelection(row);

      if ('vibrate' in navigator) {
        navigator.vibrate(25);
      }
    }, 500);
  };

  const handleMobileOrderOpen = (row: any) => {
    if (longPressTriggeredRef.current) {
      longPressTriggeredRef.current = false;
      return;
    }

    if (selectedKeys.size > 0) {
      toggleSelection(row);
      return;
    }

    setSelectedMobileOrder(row);
  };

  const toggleAllVisible = () => {
    setSelectedKeys((current) => {
      const next = new Set(current);

      if (allVisibleSelected) {
        visibleRows.forEach((row: any) =>
          next.delete(selectionKey(row)),
        );
      } else {
        visibleRows.forEach((row: any) =>
          next.add(selectionKey(row)),
        );
      }

      return next;
    });
  };

  const selectAllVisible = () => {
    setSelectedKeys(
      new Set(
        visibleRows.map((row: any) =>
          selectionKey(row),
        ),
      ),
    );
  };

  const toggleExpanded = (row: any) => {
    if (selectedKeys.size > 0) {
      toggleSelection(row);
      return;
    }

    const key = selectionKey(row);
    setExpandedKey((current) => (current === key ? null : key));
  };

  const deleteSingle = (row: any) => {
    setDeleteConfirm({
      mode: 'single',
      rows: [row],
    });
  };

  const deleteSelected = () => {
    if (!selectedRows.length) return;

    setDeleteConfirm({
      mode: 'bulk',
      rows: selectedRows,
    });
  };

  const executeDeleteConfirmation = () => {
    if (!deleteConfirm || deleteConfirm.rows.length === 0) return;

    if (deleteConfirm.mode === 'bulk') {
      bulkDeleteMut.mutate(deleteConfirm.rows, {
        onSettled: () => setDeleteConfirm(null),
      });
      return;
    }

    const row = deleteConfirm.rows[0];

    setSelectedKeys((current) => {
      const next = new Set(current);
      next.delete(selectionKey(row));
      return next;
    });

    if (row._isQuick) {
      deleteQuickMut.mutate(row.id, {
        onSettled: () => setDeleteConfirm(null),
      });
    } else {
      deleteOrderMut.mutate(row.id, {
        onSettled: () => setDeleteConfirm(null),
      });
    }
  };

  const clearFilters = () => {
    setStatus('');
    setCustomerIdFilter('');
    setFromDate('');
    setToDate('');
    setPage(1);
  };

  const toggleSort = (field: string) => {
    if (sortField === field) {
      setSortDir((current) => (current === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const getMobileDateTime = (value: string | undefined) => {
    if (!value) {
      return {
        date: '—',
        time: '',
      };
    }

    const parsed = new Date(value);

    if (Number.isNaN(parsed.getTime())) {
      return {
        date: '—',
        time: '',
      };
    }

    return {
      date: parsed.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }),
      time: parsed.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      }),
    };
  };

  const trashRows = useMemo(() => {
    const regular = (trashData?.items || []).map((row: any) => ({
      ...row,
      _isQuick: false,
      displayNumber: row.orderNumber,
      deletedOn: row.repDeletedAt || row.deletedAt,
    }));

    const quick =
      page === 1
        ? (quickTrashData || []).map((row: any) => ({
            ...row,
            _isQuick: true,
            displayNumber: row.requestNumber,
            deletedOn: row.deletedAt,
            customerName: row.customerName,
          }))
        : [];

    return [...regular, ...quick].sort(
      (first: any, second: any) =>
        new Date(second.deletedOn || 0).getTime() -
        new Date(first.deletedOn || 0).getTime(),
    );
  }, [trashData, quickTrashData, page]);

  return (
    <div className="mx-auto flex w-full max-w-[1600px] animate-fade-in flex-col gap-4 px-3 pb-28 pt-2 sm:px-5 sm:pt-4 lg:px-0 lg:pt-0">
      {/* Sales Rep green header */}
      <header className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-700 via-emerald-600 to-teal-600 px-4 py-5 text-white shadow-sm sm:px-5 sm:py-6 lg:px-6">
        <div className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 left-12 h-40 w-40 rounded-full bg-emerald-300/15 blur-3xl" />

        <div className="relative flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-100">
              Sales Management
            </p>
            <h1 className="mt-1 text-xl font-bold tracking-tight sm:text-2xl">
              My Orders
            </h1>
            <p className="mt-1 text-xs text-emerald-100 sm:text-sm">
              Track and manage customer orders
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigate('/rep/orders/new')}
            className="inline-flex min-h-11 flex-shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-3.5 text-sm font-bold text-emerald-700 shadow-sm transition hover:bg-emerald-50 active:scale-[0.98] sm:px-4"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden xs:inline sm:inline">New Order</span>
            <span className="xs:hidden sm:hidden">New</span>
          </button>
        </div>
      </header>

      {/* Admin-style sticky toolbar */}
      <section className="sticky top-0 z-30 overflow-hidden rounded-2xl border border-slate-200 bg-white/95 shadow-sm backdrop-blur-sm">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-2 px-3 py-2.5 sm:flex-nowrap">
          <div className="order-1 flex flex-shrink-0 gap-0.5 rounded-lg bg-slate-100 p-0.5">
            <button
              type="button"
              onClick={() => {
                setActiveTab('active');
                setPage(1);
              }}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                activeTab === 'active'
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-500'
              }`}
            >
              Active
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('trash');
                setPage(1);
              }}
              className={`inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                activeTab === 'trash'
                  ? 'bg-white text-red-600 shadow-sm'
                  : 'text-slate-500'
              }`}
            >
              <Trash2 className="h-3 w-3" />
              Trash
            </button>
          </div>

          <div className="group relative order-3 w-full sm:order-2 sm:flex-1">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400 transition group-focus-within:text-emerald-600" />
            <input
              type="text"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search order # or customer…"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-8 pr-8 text-sm outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-500/15"
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

          <div className="order-2 ml-auto flex flex-shrink-0 items-center gap-1 sm:order-3 sm:ml-0">
            <button
              type="button"
              onClick={() => setFilterPanelOpen((current) => !current)}
              className={`inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition ${
                filterPanelOpen
                  ? 'bg-emerald-600 text-white'
                  : activeFilterCount > 0
                    ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                    : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span>Filter</span>
              {activeFilterCount > 0 && (
                <span
                  className={`inline-flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold ${
                    filterPanelOpen
                      ? 'bg-white/25 text-white'
                      : 'bg-emerald-600 text-white'
                  }`}
                >
                  {activeFilterCount}
                </span>
              )}
            </button>

            {activeTab === 'active' && selectedKeys.size > 0 && (
              <>
                <div className="mx-0.5 h-5 w-px bg-slate-200" />
                <button
                  type="button"
                  onClick={deleteSelected}
                  disabled={bulkDeleteMut.isPending}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2.5 text-xs font-semibold text-red-600 transition hover:bg-red-100 disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>
                    Delete ({selectedKeys.size})
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedKeys(new Set())}
                  className="hidden h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 lg:inline-flex"
                  aria-label="Clear selection"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </>
            )}
          </div>
        </div>

        {filterPanelOpen && activeTab === 'active' && (
          <div className="border-t border-slate-100">
            <div className="flex flex-wrap gap-1 bg-slate-50 px-3 pt-3">
              {[
                {
                  key: 'status',
                  label: 'Status',
                  count: status ? 1 : 0,
                },
                {
                  key: 'customer',
                  label: 'Customer',
                  count: customerIdFilter ? 1 : 0,
                },
                {
                  key: 'date',
                  label: 'Date',
                  count: fromDate || toDate ? 1 : 0,
                },
              ].map(({ key, label, count }) => (
                <button
                  type="button"
                  key={key}
                  onClick={() =>
                    setFilterSubPanel((current) =>
                      current === key ? null : (key as any),
                    )
                  }
                  className={`inline-flex items-center gap-1.5 rounded-t-lg border border-b-0 px-3 py-1.5 text-xs font-semibold transition ${
                    filterSubPanel === key
                      ? 'relative z-10 -mb-px border-slate-200 bg-white pb-[7px] text-slate-800'
                      : count > 0
                        ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
                        : 'border-transparent text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  {label}
                  {count > 0 && (
                    <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-600 text-[9px] font-bold text-white">
                      {count}
                    </span>
                  )}
                </button>
              ))}

              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="ml-auto inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-red-500"
                >
                  <X className="h-3 w-3" />
                  Clear all
                </button>
              )}
            </div>

            <div className="border-t border-slate-200 bg-white px-4 py-4">
              {!filterSubPanel && (
                <p className="py-2 text-center text-xs text-slate-400">
                  Select a filter category above
                </p>
              )}

              {filterSubPanel === 'status' && (
                <div>
                  <p className="mb-2.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    Filter by status
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {STATUS_OPTIONS.map((statusOption) => (
                      <button
                        type="button"
                        key={statusOption}
                        onClick={() => {
                          setStatus((current) =>
                            current === statusOption
                              ? ''
                              : (statusOption as OrderStatus),
                          );
                          setPage(1);
                        }}
                        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                          status === statusOption
                            ? 'border-emerald-600 bg-emerald-600 text-white'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:bg-emerald-50'
                        }`}
                      >
                        {status === statusOption && (
                          <Check className="h-3 w-3" />
                        )}
                        {statusOption}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {filterSubPanel === 'customer' && (
                <div>
                  <p className="mb-2.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    Filter by customer
                  </p>
                  <div className="flex max-w-md items-center gap-2">
                    <select
                      value={customerIdFilter}
                      onChange={(event) => {
                        setCustomerIdFilter(event.target.value);
                        setPage(1);
                      }}
                      className="min-h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-500/15"
                    >
                      <option value="">All Customers</option>
                      {(customersData || []).map((customer: any) => (
                        <option key={customer.id} value={customer.id}>
                          {customer.shopName}
                        </option>
                      ))}
                    </select>

                    {customerIdFilter && (
                      <button
                        type="button"
                        onClick={() => {
                          setCustomerIdFilter('');
                          setPage(1);
                        }}
                        className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-500"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              )}

              {filterSubPanel === 'date' && (
                <div>
                  <p className="mb-2.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    Filter by date range
                  </p>
                  <div className="grid max-w-md grid-cols-2 gap-3">
                    <label className="min-w-0">
                      <span className="mb-1 block text-[10px] font-semibold text-slate-400">
                        FROM
                      </span>
                      <input
                        type="date"
                        value={fromDate}
                        onChange={(event) => {
                          setFromDate(event.target.value);
                          setPage(1);
                        }}
                        className="min-h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs outline-none focus:border-emerald-400 focus:bg-white"
                      />
                    </label>

                    <label className="min-w-0">
                      <span className="mb-1 block text-[10px] font-semibold text-slate-400">
                        TO
                      </span>
                      <input
                        type="date"
                        value={toDate}
                        onChange={(event) => {
                          setToDate(event.target.value);
                          setPage(1);
                        }}
                        className="min-h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs outline-none focus:border-emerald-400 focus:bg-white"
                      />
                    </label>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {activeTab === 'active' ? (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {isLoading || quickLoading ? (
            <LoadingState label="Loading orders…" />
          ) : visibleRows.length === 0 ? (
            <EmptyState
              icon={ShoppingCart}
              title="No orders found"
              description="Try changing the filters or create a new order."
            />
          ) : (
            <>
              {/* Mobile and tablet compact order tiles */}
              <div className="lg:hidden">
                <div className="flex min-h-11 items-center border-b border-slate-100 bg-slate-50/70 px-3 py-2">
                  {selectedKeys.size > 0 ? (
                    <div className="flex w-full items-center justify-between gap-3">
                      <span className="flex-shrink-0 text-[11px] font-bold text-emerald-700">
                        {selectedKeys.size} selected
                      </span>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={selectAllVisible}
                          disabled={allVisibleSelected}
                          className="inline-flex min-h-8 items-center rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-[11px] font-bold text-emerald-700 transition active:bg-emerald-100 disabled:cursor-default disabled:opacity-45"
                        >
                          Select All
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            setSelectedKeys(new Set())
                          }
                          className="inline-flex min-h-8 items-center rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-bold text-slate-700 transition active:bg-slate-100"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <span className="ml-auto text-[10px] text-slate-400">
                      Long-press an order to select
                    </span>
                  )}
                </div>

                <div className="divide-y divide-slate-100 bg-white">
                  {visibleRows.map((row: any) => {
                    const key = selectionKey(row);
                    const selected = selectedKeys.has(key);
                    const mobileDateTime = getMobileDateTime(
                      row.orderDate || row.createdAt,
                    );

                    return (
                      <article
                        key={key}
                        role="button"
                        tabIndex={0}
                        aria-pressed={selected}
                        onPointerDown={() => startLongPress(row)}
                        onPointerUp={cancelLongPress}
                        onPointerCancel={cancelLongPress}
                        onPointerLeave={cancelLongPress}
                        onContextMenu={(event) =>
                          event.preventDefault()
                        }
                        onClick={() => handleMobileOrderOpen(row)}
                        onKeyDown={(event) => {
                          if (
                            event.key !== 'Enter' &&
                            event.key !== ' '
                          ) {
                            return;
                          }

                          event.preventDefault();
                          handleMobileOrderOpen(row);
                        }}
                        className={`relative cursor-pointer select-none px-3 py-2.5 outline-none transition active:bg-slate-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500 sm:px-4 ${
                          selected
                            ? 'bg-emerald-50/80'
                            : 'bg-white'
                        }`}
                      >
                        <div className="flex min-w-0 items-center justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-1.5">
                            {selectedKeys.size > 0 && (
                              <span
                                className={`inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border ${
                                  selected
                                    ? 'border-emerald-600 bg-emerald-600 text-white'
                                    : 'border-slate-300 bg-white text-transparent'
                                }`}
                              >
                                <Check className="h-3 w-3" />
                              </span>
                            )}

                            <p className="min-w-0 truncate text-[13px] font-black text-slate-900 sm:text-sm">
                              {row.orderNumber}
                            </p>

                            {row._isQuick && (
                              <span className="flex-shrink-0 rounded-full bg-violet-100 px-1.5 py-0.5 text-[8px] font-bold text-violet-700">
                                Quick
                              </span>
                            )}
                          </div>

                          <StatusBadge
                            status={row.status}
                            type="orders"
                          />
                        </div>

                        <div className="mt-1.5 flex min-w-0 items-center gap-1.5 overflow-hidden text-[10px] text-slate-500 sm:text-[11px]">
                          <span className="min-w-0 truncate font-semibold text-slate-600">
                            {getCustomerName(row)}
                          </span>
                          <span className="flex-shrink-0 text-slate-300">
                            |
                          </span>
                          <span className="flex-shrink-0">
                            {mobileDateTime.date}
                          </span>
                          {mobileDateTime.time && (
                            <>
                              <span className="flex-shrink-0 text-slate-300">
                                |
                              </span>
                              <span className="flex-shrink-0">
                                {mobileDateTime.time}
                              </span>
                            </>
                          )}
                        </div>

                        <p className="mt-1.5 text-sm font-black leading-5 text-emerald-700">
                          {row._isQuick
                            ? '—'
                            : formatCurrency(row.totalAmount || 0)}
                        </p>
                      </article>
                    );
                  })}
                </div>

                <Pagination
                  page={page}
                  totalPages={totalPages}
                  totalCount={activeTotalCount}
                  onChange={setPage}
                />
              </div>

              {/* Desktop table matching Admin Orders */}
              <div className="hidden overflow-x-auto lg:block">
                <table className="w-full min-w-[1000px] border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-800 text-white">
                      <th className="w-12 border-r border-slate-700 px-3 py-3 text-center">
                        <button
                          type="button"
                          onClick={toggleAllVisible}
                          className="inline-flex"
                        >
                          <SelectionBox
                            checked={allVisibleSelected}
                            dark
                          />
                        </button>
                      </th>
                      <th className="w-10 border-r border-slate-700 px-2 py-3" />
                      <SortHeader
                        label="Order"
                        field="orderNumber"
                        sortField={sortField}
                        sortDir={sortDir}
                        onSort={toggleSort}
                      />
                      <SortHeader
                        label="Customer"
                        field="customerName"
                        sortField={sortField}
                        sortDir={sortDir}
                        onSort={toggleSort}
                      />
                      <th className="border-r border-slate-700 px-3 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-slate-200">
                        Items
                      </th>
                      <SortHeader
                        label="Amount"
                        field="totalAmount"
                        sortField={sortField}
                        sortDir={sortDir}
                        onSort={toggleSort}
                        align="right"
                      />
                      <SortHeader
                        label="Date"
                        field="orderDate"
                        sortField={sortField}
                        sortDir={sortDir}
                        onSort={toggleSort}
                        align="right"
                      />
                      <SortHeader
                        label="Status"
                        field="status"
                        sortField={sortField}
                        sortDir={sortDir}
                        onSort={toggleSort}
                        align="center"
                        border={false}
                      />
                      <th className="w-14 px-3 py-3" />
                    </tr>
                  </thead>

                  <tbody>
                    {visibleRows.map((row: any) => {
                      const key = selectionKey(row);
                      const expanded = expandedKey === key;
                      const selected = selectedKeys.has(key);

                      return (
                        <Fragment key={key}>
                          <tr
                            onClick={() => toggleExpanded(row)}
                            className={`cursor-pointer border-b border-slate-100 transition select-none ${
                              selected
                                ? 'bg-emerald-50/70'
                                : expanded
                                  ? 'bg-slate-50'
                                  : 'hover:bg-slate-50/70'
                            }`}
                          >
                            <td
                              onClick={(event) => {
                                event.stopPropagation();
                                toggleSelection(row);
                              }}
                              className="border-r border-slate-100 px-3 py-3 text-center"
                            >
                              <SelectionBox checked={selected} />
                            </td>

                            <td className="border-r border-slate-100 px-2 py-3">
                              <ChevronRight
                                className={`h-4 w-4 transition-transform ${
                                  expanded
                                    ? 'rotate-90 text-emerald-600'
                                    : 'text-slate-400'
                                }`}
                              />
                            </td>

                            <td className="border-r border-slate-100 px-4 py-3">
                              <div className="flex flex-col gap-0.5">
                                <span className="font-bold text-slate-900">
                                  {row.orderNumber}
                                </span>
                                {row._isQuick ? (
                                  <span className="inline-flex w-fit rounded-full bg-violet-100 px-1.5 py-0.5 text-[9px] font-semibold text-violet-700">
                                    Quick Order
                                  </span>
                                ) : row.isFromApprovedQuotation ? (
                                  <span className="inline-flex w-fit rounded-full border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-700">
                                    From Quotation
                                  </span>
                                ) : null}
                              </div>
                            </td>

                            <td className="max-w-[280px] border-r border-slate-100 px-4 py-3">
                              <span className="line-clamp-2 text-slate-700">
                                {getCustomerName(row)}
                              </span>
                            </td>

                            <td className="border-r border-slate-100 px-3 py-3 text-center">
                              <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-slate-100 px-1.5 text-xs font-bold text-slate-600">
                                {row._isQuick
                                  ? '—'
                                  : row.items?.length || 0}
                              </span>
                            </td>

                            <td className="border-r border-slate-100 px-4 py-3 text-right font-bold tabular-nums text-slate-900">
                              {row._isQuick
                                ? '—'
                                : formatCurrency(row.totalAmount || 0)}
                            </td>

                            <td className="border-r border-slate-100 px-4 py-3 text-right text-xs text-slate-500">
                              {formatDateTime(
                                row.orderDate || row.createdAt,
                              )}
                            </td>

                            <td className="px-4 py-3 text-center">
                              <StatusBadge
                                status={row.status}
                                type="orders"
                              />
                            </td>

                            <td
                              onClick={(event) => event.stopPropagation()}
                              className="px-3 py-3 text-center"
                            >
                              <button
                                type="button"
                                onClick={() => deleteSingle(row)}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                                aria-label="Move to trash"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          </tr>

                          {expanded && (
                            <tr className="border-b border-emerald-100">
                              <td colSpan={9} className="p-0">
                                <DesktopExpandedOrder
                                  row={row}
                                  customerName={getCustomerName(row)}
                                  onOpenFull={() => {
                                    if (!row._isQuick) {
                                      navigate(`/rep/orders/${row.id}`);
                                    }
                                  }}
                                  onPreviewImage={setQuickLightbox}
                                />
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>

                <SelectionHint
                  count={selectedKeys.size}
                  onClear={() => setSelectedKeys(new Set())}
                />

                <Pagination
                  page={page}
                  totalPages={totalPages}
                  totalCount={activeTotalCount}
                  onChange={setPage}
                />
              </div>
            </>
          )}
        </section>
      ) : (
        <>
        <RoleOrderTrash role='rep' />
        <section className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {trashLoading || quickTrashLoading ? (
            <LoadingState label="Loading trash…" />
          ) : trashRows.length === 0 ? (
            <EmptyState
              icon={Trash2}
              title="Trash is empty"
              description="Items remain here until restored or permanently removed from your view."
            />
          ) : (
            <>
              <div className="divide-y divide-slate-100">
                {trashRows.map((row: any) => (
                  <div
                    key={`${row._isQuick ? 'quick' : 'order'}-${row.id}`}
                    className="flex items-center gap-3 px-4 py-3.5"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <p className="truncate text-sm font-bold text-slate-800">
                          {row.displayNumber}
                        </p>
                        {row._isQuick && (
                          <span className="flex-shrink-0 rounded-full bg-violet-100 px-1.5 py-0.5 text-[9px] font-bold text-violet-700">
                            Quick
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 truncate text-xs text-slate-500">
                        {row.customerName ||
                          customerNameById.get(row.customerId) ||
                          'Customer'}
                      </p>
                      <p className="mt-0.5 text-[10px] text-slate-400">
                        Deleted{' '}
                        {row.deletedOn
                          ? formatDateTime(row.deletedOn)
                          : '—'}
                      </p>
                    </div>

                    <StatusBadge status={row.status} type="orders" />

                    <button
                      type="button"
                      onClick={() =>
                        row._isQuick
                          ? restoreQuickMut.mutate(row.id)
                          : restoreOrderMut.mutate(row.id)
                      }
                      disabled={
                        restoreOrderMut.isPending ||
                        restoreQuickMut.isPending
                      }
                      className="inline-flex min-h-10 flex-shrink-0 items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-600 hover:text-white disabled:opacity-50"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Restore</span>
                    </button>
                  </div>
                ))}
              </div>

              <Pagination
                page={page}
                totalPages={Math.max(1, trashData?.totalPages || 1)}
                totalCount={
                  (trashData?.totalCount || 0) +
                  (page === 1 ? quickTrashData.length : 0)
                }
                onChange={setPage}
              />
            </>
          )}
        </section>
        </>
      )}

      {deleteConfirm &&
        createPortal(
          <OrderDeleteConfirmModal
            count={deleteConfirm.rows.length}
            bulk={deleteConfirm.mode === 'bulk'}
            pending={
              deleteOrderMut.isPending ||
              deleteQuickMut.isPending ||
              bulkDeleteMut.isPending
            }
            onCancel={() => {
              if (
                deleteOrderMut.isPending ||
                deleteQuickMut.isPending ||
                bulkDeleteMut.isPending
              ) {
                return;
              }

              setDeleteConfirm(null);
            }}
            onConfirm={executeDeleteConfirmation}
          />,
          document.body,
        )}

      {selectedMobileOrder &&
        createPortal(
          <MobileOrderBottomSheet
            row={selectedMobileOrder}
            customerName={getCustomerName(selectedMobileOrder)}
            onClose={() => setSelectedMobileOrder(null)}
            onOpenFull={() => {
              if (!selectedMobileOrder._isQuick) {
                const orderId = selectedMobileOrder.id;
                setSelectedMobileOrder(null);
                navigate(`/rep/orders/${orderId}`);
              }
            }}
            onPreviewImage={setQuickLightbox}
          />,
          document.body,
        )}

      {quickLightbox &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 p-4"
            onClick={() => setQuickLightbox(null)}
          >
            <button
              type="button"
              onClick={() => setQuickLightbox(null)}
              className="absolute right-4 top-4 rounded-full bg-white/10 p-2.5 text-white"
            >
              <X className="h-5 w-5" />
            </button>
            <PrivateImage
              apiPath={quickLightbox}
              alt="Quick order attachment"
              className="max-h-[88vh] max-w-[94vw] rounded-xl object-contain"
              onClick={(event) => event.stopPropagation()}
            />
          </div>,
          document.body,
        )}
    </div>
  );
}

function OrderDeleteConfirmModal({
  count,
  bulk,
  pending,
  onCancel,
  onConfirm,
}: {
  count: number;
  bulk: boolean;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const itemLabel =
    count === 1 ? 'this order' : `${count} selected orders`;

  return (
    <div className="fixed inset-0 z-[9999]">
      <button
        type="button"
        onClick={onCancel}
        aria-label="Close delete confirmation"
        className="absolute inset-0 h-full w-full bg-slate-950/55 backdrop-blur-[2px]"
      />

      <div className="absolute inset-x-0 bottom-0 sm:inset-0 sm:flex sm:items-center sm:justify-center sm:p-4">
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby="order-delete-title"
          className="relative w-full overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:max-w-md sm:rounded-2xl"
        >
          <div className="px-5 pb-[calc(env(safe-area-inset-bottom,0px)+20px)] pt-3 sm:p-6">
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-slate-200 sm:hidden" />

            <div className="flex items-start gap-3">
              <div className="inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
                <AlertTriangle className="h-5 w-5" />
              </div>

              <div className="min-w-0 flex-1">
                <h2
                  id="order-delete-title"
                  className="text-base font-bold text-slate-900"
                >
                  {bulk ? 'Move selected orders to Trash?' : 'Move order to Trash?'}
                </h2>

                <p className="mt-1 text-sm leading-5 text-slate-500">
                  {bulk
                    ? `${itemLabel} will be removed from your active orders.`
                    : 'This order will be removed from your active orders.'}
                </p>
              </div>

              <button
                type="button"
                onClick={onCancel}
                disabled={pending}
                className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200 disabled:opacity-40"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-3">
              <p className="text-xs font-semibold leading-5 text-emerald-800">
                You can restore {count === 1 ? 'it' : 'them'} later from your
                Trash. Other authorized roles will not be affected.
              </p>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={onCancel}
                disabled={pending}
                className="min-h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-40"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={onConfirm}
                disabled={pending}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 text-sm font-bold text-white transition hover:bg-rose-700 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                {pending ? 'Moving…' : 'Move to Trash'}
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function MobileOrderBottomSheet({
  row,
  customerName,
  onClose,
  onOpenFull,
  onPreviewImage,
}: {
  row: any;
  customerName: string;
  onClose: () => void;
  onOpenFull: () => void;
  onPreviewImage: (url: string) => void;
}) {
  return (
    <div className="fixed inset-0 z-[9998] lg:hidden">
      <div
        className="absolute inset-0 bg-black/45 backdrop-blur-[1px]"
        onClick={onClose}
      />

      <section className="absolute bottom-0 left-0 right-0 max-h-[88vh] overflow-hidden rounded-t-3xl bg-white shadow-2xl animate-slide-up">
        <div className="border-b border-slate-100 bg-white px-4 pb-3 pt-2">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-200" />

          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-2">
                <h2 className="truncate text-base font-bold text-slate-900">
                  {row.orderNumber}
                </h2>
                {row._isQuick && (
                  <span className="flex-shrink-0 rounded-full bg-violet-100 px-2 py-0.5 text-[9px] font-bold text-violet-700">
                    Quick Order
                  </span>
                )}
              </div>

              <p className="mt-1 truncate text-xs text-slate-500">
                {customerName}
              </p>
            </div>

            <div className="flex flex-shrink-0 items-center gap-2">
              <StatusBadge status={row.status} type="orders" />
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500"
                aria-label="Close order details"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="max-h-[calc(88vh-88px)] overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom,0px)+24px)] pt-4">
          {row._isQuick ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <CompactMetric
                  label="Date"
                  value={formatDateTime(
                    row.orderDate || row.createdAt,
                  )}
                />
                <CompactMetric
                  label="Photos"
                  value={String(row._quick?.imageUrls?.length || 0)}
                />
              </div>

              <DetailValue
                label="Request Details"
                value={row._quick?.details || 'No details'}
                multiline
              />

              {row._quick?.adminNotes && (
                <DetailValue
                  label="Admin Notes"
                  value={row._quick.adminNotes}
                  multiline
                  amber
                />
              )}

              <QuickImages
                request={row._quick}
                onPreviewImage={onPreviewImage}
              />

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => downloadQuickRequestPdf(row._quick)}
                  className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-red-100 text-sm font-semibold text-red-600"
                >
                  <FileText className="h-4 w-4" />
                  PDF
                </button>

                <button
                  type="button"
                  onClick={() => downloadQuickRequestExcel(row._quick)}
                  className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-emerald-100 text-sm font-semibold text-emerald-700"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  Excel
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2">
                <CompactMetric
                  label="Date"
                  value={formatDateTime(
                    row.orderDate || row.createdAt,
                  )}
                />
                <CompactMetric
                  label="Items"
                  value={String(row.items?.length || 0)}
                />
                <CompactMetric
                  label="Total"
                  value={formatCurrency(row.totalAmount || 0)}
                />
              </div>

              <OrderItemsCompact items={row.items || []} />

              {row.deliveryAddress && (
                <DetailValue
                  label="Delivery Address"
                  value={row.deliveryAddress}
                  multiline
                />
              )}

              {row.deliveryNotes && (
                <DetailValue
                  label="Notes"
                  value={row.deliveryNotes}
                  multiline
                />
              )}

              <button
                type="button"
                onClick={onOpenFull}
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 text-sm font-bold text-white shadow-sm"
              >
                Open Full Order
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function DesktopExpandedOrder({
  row,
  customerName,
  onOpenFull,
  onPreviewImage,
}: {
  row: any;
  customerName: string;
  onOpenFull: () => void;
  onPreviewImage: (url: string) => void;
}) {
  if (row._isQuick) {
    const request = row._quick;

    return (
      <div className="bg-gradient-to-b from-violet-50/40 to-white px-8 py-5">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_220px]">
          <div className="space-y-3">
            <DetailValue label="Customer" value={customerName} />
            <DetailValue
              label="Request Details"
              value={request.details || 'No details'}
              multiline
            />
            {request.adminNotes && (
              <DetailValue
                label="Admin Notes"
                value={request.adminNotes}
                multiline
                amber
              />
            )}
            <QuickImages
              request={request}
              onPreviewImage={onPreviewImage}
            />
          </div>

          <div className="space-y-2">
            <button
              type="button"
              onClick={() => downloadQuickRequestPdf(request)}
              className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-red-100 text-xs font-semibold text-red-600 transition hover:bg-red-50"
            >
              <FileText className="h-3.5 w-3.5" />
              Export PDF
            </button>
            <button
              type="button"
              onClick={() => downloadQuickRequestExcel(request)}
              className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-emerald-100 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              Export Excel
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-b from-slate-50 to-white px-8 py-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5 text-sm">
          <span className="font-bold text-slate-800">
            {row.orderNumber}
          </span>
          <span className="text-slate-300">•</span>
          <span className="text-slate-600">{customerName}</span>
          {row.deliveryAddress && (
            <>
              <span className="text-slate-300">•</span>
              <span className="max-w-[300px] truncate text-xs text-slate-400">
                {row.deliveryAddress}
              </span>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={onOpenFull}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-bold text-white"
        >
          Open Full Order
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-100 text-slate-500">
              <th className="px-3 py-2 text-left font-semibold">
                Item
              </th>
              <th className="px-3 py-2 text-center font-semibold">
                Qty
              </th>
              <th className="px-3 py-2 text-right font-semibold">
                Rate
              </th>
              <th className="px-3 py-2 text-right font-semibold">
                Amount
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {(row.items || []).map((item: any, index: number) => {
              const quantity = item.quantity || 0;
              const rate = item.unitPrice || item.price || 0;
              const amount =
                item.totalPrice ||
                item.lineTotal ||
                rate * quantity;

              return (
                <tr key={item.id || item.productId || index}>
                  <td className="px-3 py-2.5">
                    <p className="font-semibold text-slate-800">
                      {item.productName || item.name || 'Product'}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {item.productSKU || item.sku || ''}
                    </p>
                  </td>
                  <td className="px-3 py-2.5 text-center text-slate-600">
                    {quantity}
                  </td>
                  <td className="px-3 py-2.5 text-right text-slate-600">
                    {formatCurrency(rate)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-bold text-slate-900">
                    {formatCurrency(amount)}
                  </td>
                </tr>
              );
            })}

            {(!row.items || row.items.length === 0) && (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-8 text-center text-slate-400"
                >
                  No item details available
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex justify-end">
        <div className="min-w-[280px] space-y-2 rounded-xl bg-slate-900 px-4 py-3 text-white">
          <div className="flex items-center justify-between gap-4">
            <span className="text-xs text-slate-300">
              Total Invoice Value
            </span>
            <span className="text-base font-bold">
              {formatCurrency(row.totalAmount || 0)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function QuickImages({
  request,
  onPreviewImage,
}: {
  request: any;
  onPreviewImage: (url: string) => void;
}) {
  if (!request.imageUrls?.length) return null;

  return (
    <div>
      <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">
        Photos ({request.imageUrls.length})
      </p>
      <div className="flex flex-wrap gap-2">
        {request.imageUrls.map((url: string, index: number) => (
            <div
              key={`${url}-${index}`}
              className="group relative h-20 w-20"
            >
              <PrivateImage
                apiPath={url}
                alt={`Quick order attachment ${index + 1}`}
                onClick={() => onPreviewImage(url)}
                className="h-20 w-20 cursor-pointer rounded-xl border border-slate-200 object-cover"
              />
              <button
                type="button"
                onClick={(event) => { event.stopPropagation(); void downloadPrivateFile(url, `photo-${index + 1}`); }}
                className="absolute bottom-1 right-1 inline-flex h-6 w-6 items-center justify-center rounded-lg bg-black/60 text-white opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100"
              >
                <Download className="h-3 w-3" />
              </button>
            </div>
          ))}
      </div>
    </div>
  );
}

function OrderItemsCompact({ items }: { items: any[] }) {
  if (!items.length) {
    return (
      <p className="rounded-xl bg-white px-3 py-4 text-center text-xs text-slate-400">
        No item details available
      </p>
    );
  }

  return (
    <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
      {items.slice(0, 5).map((item: any, index: number) => {
        const quantity = item.quantity || 0;
        const rate = item.unitPrice || item.price || 0;

        return (
          <div
            key={item.id || item.productId || index}
            className="flex items-center gap-3 px-3 py-2.5"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-slate-800">
                {item.productName || item.name || 'Product'}
              </p>
              <p className="mt-0.5 text-[10px] text-slate-400">
                {quantity} × {formatCurrency(rate)}
              </p>
            </div>
          </div>
        );
      })}

      {items.length > 5 && (
        <p className="px-3 py-2 text-center text-[10px] font-semibold text-slate-400">
          +{items.length - 5} more items
        </p>
      )}
    </div>
  );
}

function DetailValue({
  label,
  value,
  multiline = false,
  amber = false,
}: {
  label: string;
  value: string;
  multiline?: boolean;
  amber?: boolean;
}) {
  return (
    <div>
      <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <div
        className={`rounded-xl border p-3 text-sm text-slate-700 ${
          amber
            ? 'border-amber-100 bg-amber-50'
            : 'border-slate-100 bg-white'
        } ${multiline ? 'whitespace-pre-wrap break-words' : ''}`}
      >
        {value}
      </div>
    </div>
  );
}

function CompactMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0 rounded-xl bg-white px-3 py-2.5">
      <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-1 break-words text-xs font-bold text-slate-900">
        {value}
      </p>
    </div>
  );
}

function SelectionBox({
  checked,
  dark = false,
}: {
  checked: boolean;
  dark?: boolean;
}) {
  return (
    <span
      className={`inline-flex h-5 w-5 items-center justify-center rounded border-2 transition ${
        checked
          ? 'border-emerald-600 bg-emerald-600'
          : dark
            ? 'border-slate-500 bg-slate-700'
            : 'border-slate-300 bg-white'
      }`}
    >
      {checked && <Check className="h-3 w-3 text-white" />}
    </span>
  );
}

function SortHeader({
  label,
  field,
  sortField,
  sortDir,
  onSort,
  align = 'left',
  border = true,
}: {
  label: string;
  field: string;
  sortField: string;
  sortDir: 'asc' | 'desc';
  onSort: (field: string) => void;
  align?: 'left' | 'right' | 'center';
  border?: boolean;
}) {
  return (
    <th
      className={`px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-200 ${
        border ? 'border-r border-slate-700' : ''
      } ${
        align === 'right'
          ? 'text-right'
          : align === 'center'
            ? 'text-center'
            : 'text-left'
      }`}
    >
      <button
        type="button"
        onClick={() => onSort(field)}
        className="inline-flex items-center gap-1.5"
      >
        {label}
        {sortField !== field ? (
          <ArrowUpDown className="h-3 w-3 opacity-40" />
        ) : sortDir === 'asc' ? (
          <ArrowUp className="h-3 w-3 text-emerald-300" />
        ) : (
          <ArrowDown className="h-3 w-3 text-emerald-300" />
        )}
      </button>
    </th>
  );
}

function SelectionHint({
  count,
  onClear,
}: {
  count: number;
  onClear: () => void;
}) {
  return (
    <div className="border-t border-slate-100 px-4 py-2.5 text-center text-[11px] text-slate-400">
      {count > 0 ? (
        <>
          {count} selected{' '}
          <span className="text-slate-300">—</span>{' '}
          <button
            type="button"
            onClick={onClear}
            className="font-semibold text-red-500"
          >
            Clear
          </button>
        </>
      ) : (
        <span className="italic">
          Use a checkbox to enter selection mode
        </span>
      )}
    </div>
  );
}

function Pagination({
  page,
  totalPages,
  totalCount,
  onChange,
}: {
  page: number;
  totalPages: number;
  totalCount: number;
  onChange: (page: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-3 py-3 sm:px-5">
      <span className="min-w-0 text-[11px] text-slate-500 sm:text-xs">
        {totalCount} total · page {page} of {totalPages}
      </span>

      <div className="flex flex-shrink-0 gap-1">
        <button
          type="button"
          onClick={() => onChange(Math.max(1, page - 1))}
          disabled={page <= 1}
          className="min-h-9 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-40"
        >
          Prev
        </button>
        <button
          type="button"
          onClick={() => onChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
          className="min-h-9 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}

function LoadingState({ label }: { label: string }) {
  return (
    <div className="px-4 py-16 text-center">
      <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
      <p className="mt-3 text-sm text-slate-500">{label}</p>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: any;
  title: string;
  description: string;
}) {
  return (
    <div className="px-5 py-16 text-center">
      <Icon className="mx-auto h-10 w-10 text-slate-300" />
      <p className="mt-3 text-sm font-bold text-slate-700">{title}</p>
      <p className="mt-1 text-xs text-slate-500">{description}</p>
    </div>
  );
}