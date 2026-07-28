// @ts-nocheck
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  AlertTriangle,
  CalendarDays,
  MapPin,
  Package,
  Phone,
  ReceiptText,
  RefreshCw,
  ShoppingCart,
  User,
  X,
  XCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { ordersApi } from '../../services/api/ordersApi';
import { customersApi } from '../../services/api/customersApi';
import {
  formatCurrency,
  formatDateTime,
} from '../../utils/formatters';
import StatusBadge from '../../components/common/StatusBadge';

function getDefinedNumber(...values: unknown[]) {
  for (const value of values) {
    if (
      value !== null &&
      value !== undefined &&
      value !== ''
    ) {
      const numericValue = Number(value);

      if (Number.isFinite(numericValue)) {
        return numericValue;
      }
    }
  }

  return undefined;
}

function getItemQuantity(item: any) {
  return getDefinedNumber(
    item?.quantity,
    item?.qty,
  ) ?? 0;
}

function getItemRate(item: any) {
  return getDefinedNumber(
    item?.unitPrice,
    item?.price,
    item?.sellingPrice,
    item?.rate,
  ) ?? 0;
}

function getItemAmount(item: any) {
  const quantity = getItemQuantity(item);
  const rate = getItemRate(item);

  return (
    getDefinedNumber(
      item?.totalPrice,
      item?.lineTotal,
      item?.totalAmount,
      item?.amount,
    ) ??
    rate * quantity
  );
}

function getItemName(item: any) {
  return (
    item?.productName ||
    item?.name ||
    item?.product?.name ||
    'Product'
  );
}

function getItemCode(item: any) {
  return (
    item?.productSKU ||
    item?.sku ||
    item?.productCode ||
    item?.product?.sku ||
    ''
  );
}

export default function RepOrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [cancelDialogOpen, setCancelDialogOpen] =
    useState(false);

  useEffect(() => {
    const element = rootRef.current;
    if (!element) return;

    element.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
    });

    if (window.innerWidth >= 1024) {
      window.scrollTo({
        top: Math.max(
          0,
          element.getBoundingClientRect().top +
            window.scrollY -
            80,
        ),
        behavior: 'smooth',
      });
    }
  }, [id]);

  const {
    data,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['rep-order', id],
    queryFn: () =>
      ordersApi
        .repGetById(id || '')
        .then((response) => response.data.data),
    enabled: Boolean(id),
  });

  const order: any = data;

  const { data: customerData } = useQuery({
    queryKey: [
      'rep-order-customer-type',
      order?.customerId,
    ],
    queryFn: () =>
      customersApi
        .repGetById(order.customerId)
        .then((response) => response.data.data),
    enabled: Boolean(order?.customerId),
    staleTime: 5 * 60 * 1000,
  });

  const cancelMutation = useMutation({
    mutationFn: (orderId: string) =>
      ordersApi.repCancel(
        orderId,
        'Rep cancelled',
      ),
    onSuccess: () => {
      toast.success('Order cancelled');

      queryClient.invalidateQueries({
        queryKey: ['rep-orders'],
      });

      queryClient.invalidateQueries({
        queryKey: ['rep-order', id],
      });

      setCancelDialogOpen(false);
      navigate('/rep/orders');
    },
    onError: (mutationError: any) =>
      toast.error(
        mutationError?.response?.data?.message ||
          'Cancel failed',
      ),
  });

  const items = useMemo(
    () =>
      Array.isArray(order?.items)
        ? order.items
        : [],
    [order?.items],
  );

  const customerType = String(
    customerData?.customerType ||
      order?.customerType ||
      '',
  )
    .toLowerCase()
    .replace(/[-_\s]/g, '');

  const isTaxCustomer =
    order?.isTaxCustomer === true ||
    customerType === 'tax';

  const customerName =
    order?.customerName ||
    customerData?.shopName ||
    'Customer';

  const customerCity =
    customerData?.city ||
    order?.customerCity ||
    '';

  const customerPhone =
    customerData?.phoneNumber ||
    order?.customerPhone ||
    '';

  const calculatedGross = items.reduce(
    (sum: number, item: any) =>
      sum +
      getItemRate(item) *
        getItemQuantity(item),
    0,
  );

  const calculatedDiscount = items.reduce(
    (sum: number, item: any) =>
      sum +
      (getDefinedNumber(
        item?.discountAmount,
        item?.totalDiscount,
      ) ?? 0),
    0,
  );

  const calculatedTax = items.reduce(
    (sum: number, item: any) =>
      sum +
      (getDefinedNumber(
        item?.taxAmount,
        item?.totalTax,
      ) ?? 0),
    0,
  );

  const grossAmount =
    getDefinedNumber(
      order?.grossAmount,
      order?.subTotal,
      order?.subtotal,
    ) ?? calculatedGross;

  const discountAmount =
    getDefinedNumber(
      order?.discountAmount,
      order?.totalDiscount,
      order?.discountTotal,
    ) ?? calculatedDiscount;

  const taxAmount =
    getDefinedNumber(
      order?.taxAmount,
      order?.totalTax,
      order?.taxTotal,
    ) ?? calculatedTax;

  const totalAmount =
    getDefinedNumber(order?.totalAmount) ??
    grossAmount -
      discountAmount +
      (isTaxCustomer ? taxAmount : 0);

  const totalQuantity = items.reduce(
    (sum: number, item: any) =>
      sum + getItemQuantity(item),
    0,
  );

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-4 px-3 py-3 sm:px-5 lg:px-0">
        <div className="h-36 animate-pulse rounded-2xl bg-slate-100" />
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_290px]">
          <div className="h-96 animate-pulse rounded-2xl bg-slate-100" />
          <div className="h-72 animate-pulse rounded-2xl bg-slate-100" />
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="mx-auto w-full max-w-xl px-3 py-10 sm:px-5">
        <section className="rounded-2xl border border-slate-200 bg-white px-5 py-12 text-center shadow-sm">
          <ReceiptText className="mx-auto h-11 w-11 text-slate-300" />

          <h1 className="mt-4 text-base font-black text-slate-800">
            Unable to load order
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Check the connection and try again.
          </p>

          <div className="mt-5 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => navigate('/rep/orders')}
              className="min-h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700"
            >
              Orders
            </button>

            <button
              type="button"
              onClick={() => refetch()}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 text-sm font-bold text-white"
            >
              <RefreshCw className="h-4 w-4" />
              Retry
            </button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      className="mx-auto w-full max-w-6xl animate-fade-in space-y-4 px-3 pb-16 pt-2 sm:px-5 sm:pt-4 lg:px-0 lg:pt-0"
    >
      {/* Mobile/tablet-first header */}
      <section className="relative overflow-hidden rounded-2xl bg-emerald-700 px-4 py-5 text-white shadow-sm sm:px-5 sm:py-6">
        <div className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full bg-white/10 blur-3xl" />

        <div className="relative">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-100">
            Full Order
          </p>

          <div className="mt-1 flex min-w-0 items-center justify-between gap-3">
            <h1 className="min-w-0 break-words text-xl font-black tracking-tight sm:text-2xl">
              {order.orderNumber}
            </h1>

            <div className="flex-shrink-0 rounded-full bg-white px-2.5 py-1">
              <StatusBadge
                status={order.status}
                type="orders"
              />
            </div>
          </div>

          <p className="mt-1.5 break-words text-sm font-semibold text-emerald-50">
            {customerName}
          </p>

          <p className="mt-1 text-xs text-emerald-100">
            {formatDateTime(
              order.orderDate ||
                order.createdAt,
            )}
          </p>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <HeaderMetric
              label="Lines"
              value={String(items.length)}
            />
            <HeaderMetric
              label="Quantity"
              value={String(totalQuantity)}
            />
            <HeaderMetric
              label="Type"
              value={
                isTaxCustomer
                  ? 'Tax'
                  : 'Non-Tax'
              }
            />
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_290px] md:items-start">
        <main className="min-w-0 space-y-4">
          {/* Customer details */}
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center gap-2.5 border-b border-slate-100 px-4 py-3.5">
              <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                <User className="h-4 w-4" />
              </div>

              <div>
                <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">
                  Customer
                </p>
                <h2 className="mt-0.5 text-sm font-black text-slate-900">
                  {customerName}
                </h2>
              </div>
            </div>

            {(customerCity ||
              customerPhone) && (
              <div className="flex flex-wrap gap-x-5 gap-y-2 px-4 py-3 text-xs text-slate-500">
                {customerCity && (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-slate-400" />
                    {customerCity}
                  </span>
                )}

                {customerPhone && (
                  <span className="inline-flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 text-slate-400" />
                    {customerPhone}
                  </span>
                )}
              </div>
            )}
          </section>

          {/* Items */}
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3.5">
              <div className="flex items-center gap-2.5">
                <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                  <Package className="h-4 w-4" />
                </div>

                <div>
                  <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">
                    Order Items
                  </p>
                  <h2 className="mt-0.5 text-sm font-black text-slate-900">
                    {items.length} product
                    {items.length === 1 ? '' : 's'}
                  </h2>
                </div>
              </div>

              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600">
                Qty {totalQuantity}
              </span>
            </div>

            {items.length === 0 ? (
              <div className="px-4 py-12 text-center text-sm text-slate-400">
                No item details available
              </div>
            ) : (
              <>
                {/* Phone */}
                <div className="divide-y divide-slate-100 md:hidden">
                  {items.map(
                    (item: any, index: number) => {
                      const quantity =
                        getItemQuantity(item);
                      const rate =
                        getItemRate(item);
                      const amount =
                        getItemAmount(item);

                      return (
                        <div
                          key={
                            item.id ||
                            item.productId ||
                            index
                          }
                          className="px-4 py-3"
                        >
                          <div className="flex min-w-0 items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="break-words text-[13px] font-bold leading-5 text-slate-900">
                                {getItemName(item)}
                              </p>

                              <p className="mt-0.5 text-[10px] text-slate-400">
                                {quantity} ×{' '}
                                {formatCurrency(rate)}
                                {getItemCode(item)
                                  ? ` · ${getItemCode(item)}`
                                  : ''}
                              </p>
                            </div>

                            <p className="flex-shrink-0 whitespace-nowrap text-sm font-black text-slate-900">
                              {formatCurrency(amount)}
                            </p>
                          </div>
                        </div>
                      );
                    },
                  )}
                </div>

                {/* Tablet and desktop */}
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full min-w-[640px] text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500">
                        <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wide">
                          Product
                        </th>
                        <th className="px-3 py-3 text-center text-[10px] font-bold uppercase tracking-wide">
                          Qty
                        </th>
                        <th className="px-3 py-3 text-right text-[10px] font-bold uppercase tracking-wide">
                          Unit Price
                        </th>
                        <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wide">
                          Amount
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100">
                      {items.map(
                        (item: any, index: number) => (
                          <tr
                            key={
                              item.id ||
                              item.productId ||
                              index
                            }
                          >
                            <td className="px-4 py-3">
                              <p className="font-bold text-slate-800">
                                {getItemName(item)}
                              </p>

                              {getItemCode(item) && (
                                <p className="mt-0.5 font-mono text-[9px] text-slate-400">
                                  {getItemCode(item)}
                                </p>
                              )}
                            </td>

                            <td className="px-3 py-3 text-center font-bold text-slate-700">
                              {getItemQuantity(item)}
                            </td>

                            <td className="px-3 py-3 text-right text-slate-600">
                              {formatCurrency(
                                getItemRate(item),
                              )}
                            </td>

                            <td className="px-4 py-3 text-right font-black text-slate-900">
                              {formatCurrency(
                                getItemAmount(item),
                              )}
                            </td>
                          </tr>
                        ),
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>

          {(order.deliveryAddress ||
            order.deliveryNotes ||
            order.notes) && (
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              {order.deliveryAddress && (
                <DetailBlock
                  label="Delivery Address"
                  value={order.deliveryAddress}
                />
              )}

              {(order.deliveryNotes ||
                order.notes) && (
                <div
                  className={
                    order.deliveryAddress
                      ? 'mt-4'
                      : ''
                  }
                >
                  <DetailBlock
                    label="Notes"
                    value={
                      order.deliveryNotes ||
                      order.notes
                    }
                  />
                </div>
              )}
            </section>
          )}
        </main>

        {/* Summary: below items on phone, sticky on tablet */}
        <aside className="min-w-0">
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm md:sticky md:top-4">
            <div className="bg-emerald-700 px-4 py-3.5 text-white">
              <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-emerald-100">
                Invoice
              </p>

              <div className="mt-0.5 flex items-center justify-between gap-3">
                <h2 className="text-base font-black">
                  Order Summary
                </h2>

                <ShoppingCart className="h-4.5 w-4.5 text-emerald-100" />
              </div>
            </div>

            <div className="p-4">
              <div className="space-y-3">
                <SummaryLine
                  label="Gross Amount"
                  value={formatCurrency(
                    grossAmount,
                  )}
                />

                <SummaryLine
                  label="Discount"
                  value={`-${formatCurrency(
                    discountAmount,
                  )}`}
                />

                {isTaxCustomer && (
                  <SummaryLine
                    label="Tax"
                    value={`+${formatCurrency(
                      taxAmount,
                    )}`}
                  />
                )}
              </div>

              <div className="mt-4 rounded-xl bg-emerald-50 px-3.5 py-3">
                <p className="text-[9px] font-bold uppercase tracking-wide text-emerald-700">
                  Total Invoice Value
                </p>

                <p className="mt-1 break-words text-2xl font-black leading-tight text-emerald-800">
                  {formatCurrency(totalAmount)}
                </p>
              </div>

              <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                <div className="inline-flex items-center gap-2 text-xs text-slate-500">
                  <CalendarDays className="h-3.5 w-3.5" />
                  Created
                </div>

                <span className="text-right text-[10px] font-semibold text-slate-700">
                  {formatDateTime(
                    order.orderDate ||
                      order.createdAt,
                  )}
                </span>
              </div>

              {order.status === 'Pending' && (
                <button
                  type="button"
                  onClick={() =>
                    setCancelDialogOpen(true)
                  }
                  className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 text-sm font-bold text-red-600 transition active:bg-red-50"
                >
                  <XCircle className="h-4 w-4" />
                  Cancel Order
                </button>
              )}
            </div>
          </section>
        </aside>
      </div>

      {cancelDialogOpen &&
        createPortal(
          <CancelOrderDialog
            pending={cancelMutation.isPending}
            onClose={() => {
              if (!cancelMutation.isPending) {
                setCancelDialogOpen(false);
              }
            }}
            onConfirm={() =>
              cancelMutation.mutate(order.id)
            }
          />,
          document.body,
        )}
    </div>
  );
}

function HeaderMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-white/15 bg-white/10 px-2.5 py-2 text-center backdrop-blur-sm">
      <p className="text-[8px] font-bold uppercase tracking-wide text-emerald-100">
        {label}
      </p>

      <p className="mt-1 break-words text-xs font-black text-white">
        {value}
      </p>
    </div>
  );
}

function SummaryLine({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 text-xs">
      <span className="text-slate-500">
        {label}
      </span>

      <span className="text-right font-bold text-slate-900">
        {value}
      </span>
    </div>
  );
}

function DetailBlock({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <p className="mt-1.5 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">
        {value}
      </p>
    </div>
  );
}

function CancelOrderDialog({
  pending,
  onClose,
  onConfirm,
}: {
  pending: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[9999]">
      <button
        type="button"
        onClick={onClose}
        aria-label="Close cancellation confirmation"
        className="absolute inset-0 h-full w-full bg-slate-950/55 backdrop-blur-[2px]"
      />

      <div className="absolute inset-x-0 bottom-0 sm:inset-0 sm:flex sm:items-center sm:justify-center sm:p-4">
        <section className="relative w-full overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:max-w-md sm:rounded-2xl">
          <div className="px-5 pb-[calc(env(safe-area-inset-bottom,0px)+20px)] pt-3 sm:p-6">
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-slate-200 sm:hidden" />

            <div className="flex items-start gap-3">
              <div className="inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-red-50 text-red-600">
                <AlertTriangle className="h-5 w-5" />
              </div>

              <div className="min-w-0 flex-1">
                <h2 className="text-base font-black text-slate-900">
                  Cancel this order?
                </h2>

                <p className="mt-1 text-sm leading-5 text-slate-500">
                  This action changes the order status to Cancelled.
                </p>
              </div>

              <button
                type="button"
                onClick={onClose}
                disabled={pending}
                className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 disabled:opacity-40"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={pending}
                className="min-h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 disabled:opacity-40"
              >
                Keep Order
              </button>

              <button
                type="button"
                onClick={onConfirm}
                disabled={pending}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-red-600 px-4 text-sm font-bold text-white disabled:opacity-50"
              >
                <XCircle className="h-4 w-4" />
                {pending
                  ? 'Cancelling...'
                  : 'Cancel Order'}
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}