import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Check,
  RotateCcw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { ordersApi } from '../../services/api/ordersApi';
import type {
  OrderTrashItem,
  UnifiedOrderItem,
} from '../../types/order.types';
import {
  formatCurrency,
  formatDateTime,
} from '../../utils/formatters';
import StatusBadge from '../common/StatusBadge';

type Role = 'admin' | 'rep' | 'coordinator';

type ConfirmAction =
  | {
      type: 'purge';
      items: OrderTrashItem[];
      count: number;
    }
  | {
      type: 'empty';
      count: number;
    };

const roleLabel: Record<Role, string> = {
  admin: 'Admin',
  rep: 'Sales Rep',
  coordinator: 'Coordinator',
};

const roleApi = {
  admin: {
    list: ordersApi.adminGetTrash,
    restore: ordersApi.adminRestoreTrash,
    purge: ordersApi.adminPurgeTrash,
    empty: ordersApi.adminEmptyTrash,
  },
  rep: {
    list: ordersApi.repGetTrash,
    restore: ordersApi.repRestoreTrash,
    purge: ordersApi.repPurgeTrash,
    empty: ordersApi.repEmptyTrash,
  },
  coordinator: {
    list: ordersApi.coordinatorGetTrash,
    restore: ordersApi.coordinatorRestoreTrash,
    purge: ordersApi.coordinatorPurgeTrash,
    empty: ordersApi.coordinatorEmptyTrash,
  },
};

const activeOrderQueryKey: Record<Role, readonly string[]> = {
  admin: ['admin-orders'],
  rep: ['rep-orders'],
  coordinator: ['coordinator-orders'],
};

const keyOf = (item: OrderTrashItem) => `${item.kind}:${item.id}`;

export default function RoleOrderTrash({ role }: { role: Role }) {
  const queryClient = useQueryClient();
  const api = roleApi[role];

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [status, setStatus] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(
      () => setDebouncedSearch(search.trim()),
      350,
    );

    return () => window.clearTimeout(timer);
  }, [search]);

  const params = useMemo(
    () => ({
      page,
      pageSize: 20,
      search: debouncedSearch || undefined,
      status: status || undefined,
      sortField: 'date',
      sortDirection: 'desc' as const,
    }),
    [page, debouncedSearch, status],
  );

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['role-orders-trash', role, params],
    queryFn: () =>
      api.list(params).then((response) => response.data.data!),
  });

  const items = [...(data?.items || [])] as UnifiedOrderItem[];
  const selectedItems = items.filter((item) =>
    selected.has(keyOf(item)),
  );
  const allSelected =
    items.length > 0 &&
    items.every((item) => selected.has(keyOf(item)));

  useEffect(() => {
    setSelected(new Set());
  }, [page, debouncedSearch, status, role]);

  const removeItemsFromTrashCache = (
    removedItems: OrderTrashItem[],
  ) => {
    const removedKeys = new Set(removedItems.map(keyOf));

    queryClient.setQueriesData(
      { queryKey: ['role-orders-trash', role] },
      (old: any) => {
        if (!old) return old;

        const previousItems = old.items || [];
        const nextItems = previousItems.filter(
          (item: UnifiedOrderItem) =>
            !removedKeys.has(keyOf(item)),
        );
        const removedCount =
          previousItems.length - nextItems.length;

        return {
          ...old,
          items: nextItems,
          totalCount: Math.max(
            0,
            (old.totalCount || 0) - removedCount,
          ),
        };
      },
    );
  };

  const refreshTrash = async () => {
    await queryClient.invalidateQueries({
      queryKey: ['role-orders-trash', role],
    });

    await queryClient.refetchQueries({
      queryKey: ['role-orders-trash', role],
      type: 'active',
    });
  };

  const refreshActiveOrders = () =>
    queryClient.invalidateQueries({
      queryKey: activeOrderQueryKey[role],
    });

  const moveBackOnePageWhenEmpty = (removedCount: number) => {
    if (page > 1 && removedCount >= items.length) {
      setPage((current) => Math.max(1, current - 1));
    }
  };

  const restoreMutation = useMutation({
    mutationFn: (trashItems: OrderTrashItem[]) =>
      api.restore(trashItems),
    onSuccess: async (_response, restored) => {
      removeItemsFromTrashCache(restored);
      setSelected(new Set());
      moveBackOnePageWhenEmpty(restored.length);
      await refreshActiveOrders();
      await refreshTrash();
      toast.success(
        `${restored.length} item${
          restored.length === 1 ? '' : 's'
        } restored`,
      );
    },
    onError: () => toast.error('Restore failed'),
  });

  const purgeMutation = useMutation({
    mutationFn: (trashItems: OrderTrashItem[]) =>
      api.purge(trashItems),
    onSuccess: async (_response, removed) => {
      removeItemsFromTrashCache(removed);
      setSelected(new Set());
      moveBackOnePageWhenEmpty(removed.length);
      await refreshTrash();
      toast.success(
        `${removed.length} item${
          removed.length === 1 ? '' : 's'
        } permanently removed from your view`,
      );
    },
    onError: () => toast.error('Permanent delete failed'),
  });

  const emptyMutation = useMutation({
    mutationFn: api.empty,
    onSuccess: async () => {
      queryClient.setQueriesData(
        { queryKey: ['role-orders-trash', role] },
        (old: any) =>
          old
            ? {
                ...old,
                items: [],
                totalCount: 0,
                totalPages: 1,
                page: 1,
              }
            : old,
      );
      setSelected(new Set());
      setPage(1);
      await refreshTrash();
      toast.success(`${roleLabel[role]} trash emptied`);
    },
    onError: () => toast.error('Empty Trash failed'),
  });

  const permanentlyRemove = (trashItems: OrderTrashItem[]) => {
    if (!trashItems.length) return;

    setConfirmAction({
      type: 'purge',
      items: trashItems,
      count: trashItems.length,
    });
  };

  const emptyTrash = () => {
    if (!items.length) return;

    setConfirmAction({
      type: 'empty',
      count: totalCount || items.length,
    });
  };

  const executeConfirmedAction = () => {
    if (!confirmAction) return;

    if (confirmAction.type === 'purge') {
      purgeMutation.mutate(confirmAction.items, {
        onSettled: () => setConfirmAction(null),
      });
      return;
    }

    emptyMutation.mutate(undefined, {
      onSettled: () => setConfirmAction(null),
    });
  };

  const toggle = (item: UnifiedOrderItem) => {
    setSelected((current) => {
      const next = new Set(current);
      const key = keyOf(item);

      if (next.has(key)) next.delete(key);
      else next.add(key);

      return next;
    });
  };

  const togglePage = () => {
    setSelected((current) => {
      const next = new Set(current);

      items.forEach((item) => {
        const key = keyOf(item);

        if (allSelected) next.delete(key);
        else next.add(key);
      });

      return next;
    });
  };

  const clearSearch = () => {
    setSearch('');
    setDebouncedSearch('');
    setPage(1);
  };

  const totalPages = Math.max(1, data?.totalPages || 1);
  const currentPage = data?.page || page;
  const totalCount = data?.totalCount || 0;
  const hasItems = items.length > 0;

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 p-3 backdrop-blur sm:p-4">
        {/* Mobile-first controls */}
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
          <button
            type="button"
            onClick={togglePage}
            disabled={!hasItems}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-40 sm:justify-start"
          >
            <SelectionBox checked={allSelected} />
            Select Page
          </button>

          <button
            type="button"
            onClick={emptyTrash}
            disabled={!hasItems || emptyMutation.isPending}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-rose-600 px-3 text-xs font-bold text-white transition hover:bg-rose-700 disabled:opacity-40 sm:order-last"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {emptyMutation.isPending ? 'Emptying…' : 'Empty Trash'}
          </button>

          <div className="relative col-span-2 min-w-0 sm:flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search order, quick order or customer"
              className="min-h-10 w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-9 text-sm outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/10"
            />
            {search && (
              <button
                type="button"
                onClick={clearSearch}
                className="absolute right-2.5 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
            className="col-span-2 min-h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 sm:col-span-1 sm:w-auto"
          >
            <option value="">All statuses</option>
            <option>Pending</option>
            <option>Approved</option>
            <option>Rejected</option>
            <option>Completed</option>
            <option>Cancelled</option>
          </select>
        </div>

        <div className="mt-3 flex items-start justify-between gap-3">
          <p className="text-[11px] leading-4 text-slate-500 sm:text-xs">
            Items remain here until restored or permanently removed
            from your view.
          </p>

          {isFetching && !isLoading && (
            <span className="flex-shrink-0 text-[10px] font-semibold text-emerald-600">
              Updating…
            </span>
          )}
        </div>

        {selectedItems.length > 0 && (
          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-2.5 sm:flex sm:items-center sm:justify-between sm:gap-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-bold text-slate-700">
                {selectedItems.length} selected
              </span>
              <button
                type="button"
                onClick={() => setSelected(new Set())}
                className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 sm:hidden"
              >
                Clear
              </button>
            </div>

            <div className="mt-2 grid grid-cols-2 gap-2 sm:mt-0 sm:flex">
              <button
                type="button"
                onClick={() =>
                  restoreMutation.mutate(selectedItems)
                }
                disabled={restoreMutation.isPending}
                className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 text-xs font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                {restoreMutation.isPending
                  ? 'Restoring…'
                  : 'Restore'}
              </button>

              <button
                type="button"
                onClick={() => permanentlyRemove(selectedItems)}
                disabled={purgeMutation.isPending}
                className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-rose-600 px-3 text-xs font-bold text-white transition hover:bg-rose-700 disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {purgeMutation.isPending ? 'Removing…' : 'Remove'}
              </button>

              <button
                type="button"
                onClick={() => setSelected(new Set())}
                className="hidden min-h-10 items-center justify-center rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-500 transition hover:bg-white hover:text-slate-800 sm:inline-flex"
              >
                Clear
              </button>
            </div>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="p-12 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
          <p className="mt-3 text-sm text-slate-400">
            Loading trash…
          </p>
        </div>
      ) : !hasItems ? (
        <div className="px-6 py-16 text-center">
          <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
            <Trash2 className="h-7 w-7 text-slate-300" />
          </div>
          <p className="mt-4 text-sm font-bold text-slate-700">
            Trash is empty
          </p>
          <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-slate-400">
            Items remain here until restored or permanently removed
            from your view.
          </p>
        </div>
      ) : (
        <>
          {/* Mobile and tablet cards */}
          <div className="space-y-2.5 bg-slate-50/60 p-2.5 sm:p-3 lg:hidden">
            {items.map((item) => {
              const checked = selected.has(keyOf(item));
              const typed: OrderTrashItem[] = [
                { id: item.id, kind: item.kind },
              ];
              const customer =
                item.shopName || item.customerName || 'Customer';
              const hasTotal =
                item.kind !== 'QuickOrder' &&
                item.totalAmount != null;

              return (
                <article
                  key={keyOf(item)}
                  className={`overflow-hidden rounded-xl border bg-white shadow-sm transition ${
                    checked
                      ? 'border-emerald-400 bg-emerald-50/20'
                      : 'border-slate-200'
                  }`}
                >
                  <div className="px-3 py-3">
                    <div className="flex min-w-0 items-start gap-2.5">
                      <button
                        type="button"
                        onClick={() => toggle(item)}
                        className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center"
                        aria-label={`Select ${item.number}`}
                      >
                        <SelectionBox checked={checked} />
                      </button>

                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-center justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-1.5">
                            <p className="truncate text-sm font-bold text-slate-900">
                              {item.number}
                            </p>
                            {item.kind === 'QuickOrder' && (
                              <span className="flex-shrink-0 rounded-full bg-violet-100 px-1.5 py-0.5 text-[8px] font-bold text-violet-700">
                                Quick
                              </span>
                            )}
                          </div>

                          <StatusBadge
                            status={item.status}
                            type="orders"
                          />
                        </div>

                        <p className="mt-1.5 truncate text-xs font-medium text-slate-600">
                          {customer}
                        </p>

                        <div className="mt-2 flex min-w-0 items-end justify-between gap-3">
                          <p className="min-w-0 truncate text-[10px] text-slate-400">
                            Deleted{' '}
                            {item.deletedAt
                              ? formatDateTime(item.deletedAt)
                              : '—'}
                          </p>

                          {hasTotal && (
                            <p className="flex-shrink-0 text-xs font-bold text-slate-900">
                              {formatCurrency(item.totalAmount || 0)}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 border-t border-slate-100 bg-slate-50/70">
                    <button
                      type="button"
                      onClick={() =>
                        restoreMutation.mutate(typed)
                      }
                      disabled={restoreMutation.isPending}
                      className="inline-flex min-h-11 items-center justify-center gap-1.5 border-r border-slate-100 text-xs font-bold text-emerald-700 transition active:bg-emerald-50 disabled:opacity-50"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Restore
                    </button>

                    <button
                      type="button"
                      onClick={() => permanentlyRemove(typed)}
                      disabled={purgeMutation.isPending}
                      className="inline-flex min-h-11 items-center justify-center gap-1.5 text-xs font-bold text-rose-600 transition active:bg-rose-50 disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Remove
                    </button>
                  </div>
                </article>
              );
            })}
          </div>

          {/* Desktop rows */}
          <div className="hidden divide-y divide-slate-100 lg:block">
            {items.map((item) => {
              const checked = selected.has(keyOf(item));
              const typed: OrderTrashItem[] = [
                { id: item.id, kind: item.kind },
              ];

              return (
                <article
                  key={keyOf(item)}
                  className={`flex items-center gap-3 px-4 py-3.5 transition hover:bg-slate-50 ${
                    checked ? 'bg-emerald-50/50' : ''
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggle(item)}
                    className="inline-flex h-8 w-8 items-center justify-center"
                    aria-label={`Select ${item.number}`}
                  >
                    <SelectionBox checked={checked} />
                  </button>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-slate-900">
                        {item.number}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                        {item.kind === 'QuickOrder'
                          ? 'Quick Order'
                          : 'Order'}
                      </span>
                      <StatusBadge
                        status={item.status}
                        type="orders"
                      />
                    </div>

                    <p className="mt-1 truncate text-sm text-slate-600">
                      {item.shopName ||
                        item.customerName ||
                        'Customer'}
                    </p>

                    <p className="mt-1 text-xs text-slate-400">
                      Deleted{' '}
                      {item.deletedAt
                        ? formatDateTime(item.deletedAt)
                        : '—'}
                    </p>
                  </div>

                  {item.kind !== 'QuickOrder' &&
                    item.totalAmount != null && (
                      <p className="flex-shrink-0 text-sm font-bold text-slate-900">
                        {formatCurrency(item.totalAmount || 0)}
                      </p>
                    )}

                  <div className="flex flex-shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        restoreMutation.mutate(typed)
                      }
                      disabled={restoreMutation.isPending}
                      className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-emerald-200 px-3 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-50"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Restore
                    </button>

                    <button
                      type="button"
                      onClick={() => permanentlyRemove(typed)}
                      disabled={purgeMutation.isPending}
                      className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-rose-200 px-3 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Permanently Delete
                    </button>
                  </div>
                </article>
              );
            })}
          </div>

          <Pagination
            page={currentPage}
            totalPages={totalPages}
            totalCount={totalCount}
            onChange={setPage}
          />
        </>
      )}

      {confirmAction &&
        createPortal(
          <TrashConfirmModal
            action={confirmAction}
            pending={
              purgeMutation.isPending || emptyMutation.isPending
            }
            onCancel={() => {
              if (
                purgeMutation.isPending ||
                emptyMutation.isPending
              ) {
                return;
              }

              setConfirmAction(null);
            }}
            onConfirm={executeConfirmedAction}
          />,
          document.body,
        )}
    </section>
  );
}

function TrashConfirmModal({
  action,
  pending,
  onCancel,
  onConfirm,
}: {
  action: ConfirmAction;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const isEmptyTrash = action.type === 'empty';
  const itemLabel =
    action.count === 1 ? '1 item' : `${action.count} items`;

  return (
    <div className="fixed inset-0 z-[9999]">
      <button
        type="button"
        aria-label="Close confirmation"
        onClick={onCancel}
        className="absolute inset-0 h-full w-full bg-slate-950/55 backdrop-blur-[2px]"
      />

      <div className="absolute inset-x-0 bottom-0 sm:inset-0 sm:flex sm:items-center sm:justify-center sm:p-4">
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby="trash-confirm-title"
          className="relative w-full overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:max-w-md sm:rounded-2xl"
        >
          <div className="px-5 pb-5 pt-3 sm:p-6">
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-slate-200 sm:hidden" />

            <div className="flex items-start gap-3">
              <div className="inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
                <AlertTriangle className="h-5 w-5" />
              </div>

              <div className="min-w-0 flex-1">
                <h2
                  id="trash-confirm-title"
                  className="text-base font-bold text-slate-900"
                >
                  {isEmptyTrash
                    ? 'Empty Trash?'
                    : 'Permanently remove?'}
                </h2>

                <p className="mt-1 text-sm leading-5 text-slate-500">
                  {isEmptyTrash
                    ? `This will permanently remove ${itemLabel} from your view.`
                    : `This will permanently remove ${itemLabel} from your view.`}
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

            <div className="mt-4 rounded-xl border border-amber-100 bg-amber-50 px-3 py-3">
              <p className="text-xs font-semibold leading-5 text-amber-800">
                Other authorized roles will not be affected.
                This action only removes these records from your
                current role view.
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
                {pending
                  ? isEmptyTrash
                    ? 'Emptying…'
                    : 'Removing…'
                  : isEmptyTrash
                    ? 'Empty Trash'
                    : 'Remove'}
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function SelectionBox({ checked }: { checked: boolean }) {
  return (
    <span
      className={`inline-flex h-5 w-5 items-center justify-center rounded border-2 transition ${
        checked
          ? 'border-emerald-600 bg-emerald-600'
          : 'border-slate-300 bg-white'
      }`}
    >
      {checked && <Check className="h-3 w-3 text-white" />}
    </span>
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
    <div className="flex items-center justify-between gap-3 border-t border-slate-200 bg-white px-3 py-3 sm:px-4">
      <span className="min-w-0 text-[11px] text-slate-500 sm:text-xs">
        {totalCount} total · page {page} of {totalPages}
      </span>

      <div className="flex flex-shrink-0 gap-1.5">
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
          onClick={() =>
            onChange(Math.min(totalPages, page + 1))
          }
          disabled={page >= totalPages}
          className="min-h-9 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}