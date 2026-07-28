import React from 'react';

const colorMap: Record<string, string> = {
  // Order statuses
  Pending:            'bg-blue-50 text-blue-700 ring-blue-200',
  Approved:           'bg-emerald-50 text-emerald-700 ring-emerald-200',
  Processing:         'bg-sky-50 text-sky-700 ring-sky-200',
  Dispatched:         'bg-violet-50 text-violet-700 ring-violet-200',
  Delivered:          'bg-teal-50 text-teal-700 ring-teal-200',
  Completed:          'bg-yellow-50 text-yellow-700 ring-yellow-200',
  Cancelled:          'bg-slate-100 text-slate-500 ring-slate-200',
  Rejected:           'bg-red-50 text-red-700 ring-red-200',
  OnHold:             'bg-orange-50 text-orange-600 ring-orange-200',
  PartiallyDelivered: 'bg-teal-50 text-teal-700 ring-teal-200',
  SalesOrderDone:     'bg-indigo-50 text-indigo-700 ring-indigo-200',
  // Quotation statuses
  Draft:              'bg-purple-50 text-purple-700 ring-purple-200',
  Submitted:          'bg-blue-50 text-blue-700 ring-blue-200',
  UnderReview:        'bg-amber-50 text-amber-700 ring-amber-200',
  ConvertedToOrder:   'bg-emerald-50 text-emerald-700 ring-emerald-200',
  Expired:            'bg-slate-100 text-slate-500 ring-slate-200',
  SalesQuotationDone: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
  // Quick Request statuses
  Deleted:            'bg-slate-200 text-slate-600 ring-slate-300',
  // Payment statuses
  Verified:           'bg-emerald-50 text-emerald-700 ring-emerald-200',
  Allocated:          'bg-blue-50 text-blue-700 ring-blue-200',
  Bounced:            'bg-red-50 text-red-700 ring-red-200',
  PendingApproval:    'bg-blue-50 text-blue-700 ring-blue-200',
  // Rep payment report statuses (Approved reuses the emerald "Approved" mapping above)
  AwaitingConfirmation: 'bg-amber-50 text-amber-700 ring-amber-200',
  Confirmed:          'bg-blue-50 text-blue-700 ring-blue-200',
  // Customer / user statuses
  Active:             'bg-emerald-50 text-emerald-700 ring-emerald-200',
  Inactive:           'bg-slate-100 text-slate-600 ring-slate-200',
  // Visit statuses
  Planned:            'bg-blue-50 text-blue-700 ring-blue-200',
  CheckedIn:          'bg-teal-50 text-teal-700 ring-teal-200',
  CheckedOut:         'bg-emerald-50 text-emerald-700 ring-emerald-200',
  Skipped:            'bg-slate-100 text-slate-600 ring-slate-200',
  // Trash / deleted
  Trashed:            'bg-zinc-200 text-zinc-600 ring-zinc-300',
  // Boolean statuses
  true:               'bg-emerald-50 text-emerald-700 ring-emerald-200',
  false:              'bg-red-50 text-red-700 ring-red-200',
};

export interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
  /** Optional — unused, for backward compatibility */
  type?: string;
}

export default function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  const classes = colorMap[status] || 'bg-slate-100 text-slate-600 ring-slate-200';
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs';
  // Add space before caps — "OnHold" → "On Hold"
  const label = status.replace(/([a-z])([A-Z])/g, '$1 $2');

  return (
    <span className={`inline-flex items-center rounded-lg font-semibold ring-1 ring-inset whitespace-nowrap ${classes} ${sizeClasses}`}>
      {label}
    </span>
  );
}
