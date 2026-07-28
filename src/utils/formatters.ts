import { formatDistanceToNow } from 'date-fns';

export const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR', minimumFractionDigits: 2 }).format(amount);

export const formatNumber = (amount: number) =>
  new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);

// Sri Lanka is UTC+5:30, no daylight saving
const SL_TIME_ZONE = 'Asia/Colombo';

function toUtcDate(d: string | Date) {
  if (typeof d === 'string') {
    // append Z if no timezone present so that JS treats it as UTC
    if (!/\dZ$/.test(d) && !/[+-]\d\d:\d\d$/.test(d)) {
      d = d + 'Z';
    }
  }
  return new Date(d);
}

function formatInSriLanka(date: string | Date, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: SL_TIME_ZONE,
    ...options,
  }).format(toUtcDate(date));
}

export const formatDate = (date: string | Date) =>
  formatInSriLanka(date, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

export const formatDateTime = (date: string | Date) =>
  `${formatInSriLanka(date, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })} | ${formatInSriLanka(date, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })}`;

export const formatRelative = (date: string | Date) =>
  formatDistanceToNow(toUtcDate(date), { addSuffix: true });

export const formatPhone = (phone: string) => phone;

export const statusColor = (status: string): string => {
  const map: Record<string, string> = {
    Pending: 'bg-yellow-100 text-yellow-800',
    Approved: 'bg-blue-100 text-blue-800',
    Processing: 'bg-indigo-100 text-indigo-800',
    Dispatched: 'bg-purple-100 text-purple-800',
    Delivered: 'bg-green-100 text-green-800',
    Cancelled: 'bg-red-100 text-red-800',
    Rejected: 'bg-red-100 text-red-800',
    Verified: 'bg-green-100 text-green-800',
    InStock: 'bg-green-100 text-green-800',
    OutOfStock: 'bg-red-100 text-red-800',
    LowStock: 'bg-yellow-100 text-yellow-800',
    Discontinued: 'bg-gray-100 text-gray-800',
    Active: 'bg-green-100 text-green-800',
    Inactive: 'bg-gray-100 text-gray-800',
  };
  return map[status] || 'bg-gray-100 text-gray-800';
};

export const cn = (...classes: (string | undefined | false)[]) =>
  classes.filter(Boolean).join(' ');
