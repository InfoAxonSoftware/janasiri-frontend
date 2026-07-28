import type { RepPaymentQueryParams } from '../api/repPaymentsApi';

export type PaymentReportRole = 'admin' | 'coordinator' | 'rep';

export const paymentReportKeys = {
  all: ['payment-reports'] as const,

  lists: () =>
    [...paymentReportKeys.all, 'list'] as const,

  list: (
    role: PaymentReportRole,
    filters: RepPaymentQueryParams = {},
  ) =>
    [...paymentReportKeys.lists(), role, filters] as const,

  trash: (
    role: PaymentReportRole,
    filters: RepPaymentQueryParams = {},
  ) =>
    [...paymentReportKeys.all, 'trash', role, filters] as const,

  detail: (
    role: PaymentReportRole,
    reportId: string,
  ) =>
    [...paymentReportKeys.all, 'detail', role, reportId] as const,

  repOptions: (role: 'admin' | 'coordinator') =>
    [...paymentReportKeys.all, 'rep-options', role] as const,
};
