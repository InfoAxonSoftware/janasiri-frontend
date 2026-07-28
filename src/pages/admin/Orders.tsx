// @ts-nocheck
import { useState, useEffect, useMemo, Fragment } from 'react';
import { createPortal } from 'react-dom';
import { PrivateImage } from '../../components/common/PrivateImage';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ordersApi } from '../../services/api/ordersApi';
import { repsApi } from '../../services/api/repsApi';
import { customersApi } from '../../services/api/customersApi';
import { formatCurrency, formatDate, formatDateTime } from '../../utils/formatters';
import { taxCodeToRate } from '../../utils/calculations';
import {
  ShoppingCart, CheckCircle, XCircle, ChevronRight,
  Search, Trash2, X, FileSpreadsheet, FileText,
  SlidersHorizontal, RefreshCw, RotateCcw,
  ArrowUp, ArrowDown, ArrowUpDown, Check, Download
} from 'lucide-react';
import type { Order, OrderStatus } from '../../types/order.types';
import { ORDER_STATUSES, FILTER_ORDER_STATUSES } from '../../types/order.types';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import StatusBadge from '../../components/common/StatusBadge';
import { quickRequestApi } from '../../services/api/quickRequestApi';
import { downloadQuickRequestPdf, downloadQuickRequestExcel, downloadImage } from '../../utils/quickRequestPdf';
import RoleOrderTrash from '../../components/orders/RoleOrderTrash';

// Strip LKR prefix for display
const fmtAmt = (n: number) => formatCurrency(n).replace(/^LKR[\s\u00A0]*/i, '');
const BASE = import.meta.env.VITE_API_URL?.replace('/api', '') || '';
const QUICK_STATUSES = ['Pending', 'Approved', 'Rejected', 'Completed'];

// Sort icon helper
function SortIcon({ field, sortField, sortDir }: { field: string; sortField: string; sortDir: 'asc' | 'desc' }) {
  if (sortField !== field) return <ArrowUpDown className="w-3 h-3 opacity-30" />;
  return sortDir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />;
}

export default function AdminOrders() {
  // Filter state
  const [activeTab, setActiveTab] = useState<'active' | 'trash'>('active');
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<OrderStatus | ''>('');
  const [search, setSearch] = useState('');
  const [repIdFilter, setRepIdFilter] = useState('');
  const [customerIdFilter, setCustomerIdFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Sort state
  const [sortField, setSortField] = useState<string>('orderDate');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // UI state
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [filterSubPanel, setFilterSubPanel] = useState<'status' | 'rep' | 'customer' | 'date' | null>(null);

  // Modal state
  const [statusChangeOrder, setStatusChangeOrder] = useState<Order | null>(null);
  const [statusPickerValue, setStatusPickerValue] = useState<OrderStatus | ''>('');
  const [rejectOrder, setRejectOrder] = useState<Order | null>(null);
  const [deleteOrder, setDeleteOrder] = useState<Order | null>(null);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [showBulkStatusModal, setShowBulkStatusModal] = useState(false);
  const [bulkStatusValue, setBulkStatusValue] = useState<OrderStatus | ''>('');
  const [quickLightbox, setQuickLightbox] = useState<string | null>(null);

  const queryClient = useQueryClient();

  useEffect(() => {
    if (statusChangeOrder) setStatusPickerValue(statusChangeOrder.status || '');
  }, [statusChangeOrder]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [page, status, fromDate, toDate, repIdFilter, customerIdFilter]);

  // Escape key clears selection
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedIds(new Set());
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Queries
  const { data: repsData } = useQuery({
    queryKey: ['reps-all'],
    queryFn: () => repsApi.adminGetAll({ pageSize: 500 }).then((r) => r.data.data?.items || []),
    staleTime: 5 * 60 * 1000,
  });

  const { data: customersData } = useQuery({
    queryKey: ['customers-all'],
    queryFn: () => customersApi.adminGetAll({ pageSize: 500 }).then((r) => r.data.data?.items || []),
    staleTime: 5 * 60 * 1000,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['admin-orders', page, status, fromDate, toDate, repIdFilter, customerIdFilter],
    queryFn: () =>
      ordersApi
        .adminGetAll({
          page,
          pageSize: 20,
          status: status ? status : undefined,
          fromDate: fromDate || undefined,
          toDate: toDate || undefined,
          repId: repIdFilter || undefined,
          customerId: customerIdFilter || undefined,
        })
        .then((r) => r.data.data),
    enabled: activeTab === 'active',
  });

  const { data: trashData, isLoading: trashLoading } = useQuery({
    queryKey: ['admin-orders-trash', page],
    queryFn: () => ordersApi.adminGetTrash(page, 20).then((r) => r.data.data),
    enabled: false,
  });

  const { data: quickTrashData = [], isLoading: quickTrashLoading } = useQuery({
    queryKey: ['admin-quick-orders-trash'],
    queryFn: () => quickRequestApi.adminGetTrash('Order').then(r => r.data.data),
    enabled: false,
  });

  const { data: quickData = [] } = useQuery({
    queryKey: ['admin-quick-orders'],
    queryFn: () => quickRequestApi.adminGetAll('Order').then(r => r.data.data),
    staleTime: 30_000,
    enabled: activeTab === 'active',
  });

  // Mutations
  const approveMut = useMutation({
    mutationFn: (id: string) => ordersApi.adminApprove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      setExpandedOrderId(null);
      toast.success('Order approved');
    },
  });

  const rejectMut = useMutation({
    mutationFn: (id: string) => ordersApi.adminReject(id, 'Rejected by admin'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      setExpandedOrderId(null);
      setRejectOrder(null);
      toast.success('Order rejected');
    },
  });

  const updateStatusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: OrderStatus }) =>
      ordersApi.adminUpdateStatus(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      setStatusChangeOrder(null);
      toast.success('Status updated');
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => ordersApi.adminDelete(id),
    onSuccess: (_, id) => {
      // Immediately remove from all cached pages so UI updates without waiting for refetch
      queryClient.setQueriesData({ queryKey: ['admin-orders'] }, (old: any) =>
        old ? { ...old, items: old.items?.filter((o: any) => o.id !== id), totalCount: Math.max(0, (old.totalCount ?? 0) - 1) } : old
      );
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      queryClient.invalidateQueries({ queryKey: ['admin-orders-trash'] });
      setDeleteOrder(null);
      toast.success('Moved to trash');
    },
  });

  const restoreMut = useMutation({
    mutationFn: (id: string) => ordersApi.adminRestore(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      queryClient.invalidateQueries({ queryKey: ['admin-orders-trash'] });
      toast.success('Order restored');
    },
  });

  const quickRestoreMut = useMutation({
    mutationFn: (id: string) => quickRequestApi.adminRestore(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-quick-orders'] });
      queryClient.invalidateQueries({ queryKey: ['admin-quick-orders-trash'] });
      toast.success('Quick order restored');
    },
  });

  const quickUpdateMut = useMutation({
    mutationFn: ({ id, status, notes }: { id: string; status: string; notes: string }) =>
      quickRequestApi.adminUpdateStatus(id, { status, adminNotes: notes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-quick-orders'] });
      toast.success('Quick order updated');
    },
    onError: () => toast.error('Failed to update'),
  });

  const orders: Order[] = (data?.items || []).filter((o: Order) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return o.orderNumber.toLowerCase().includes(q) || o.customerName.toLowerCase().includes(q);
  });

  const reps: { id: string; fullName: string }[] = repsData || [];
  const customers: { id: string; shopName: string; customerType?: string }[] = customersData || [];

  const sortedOrders = useMemo(() => {
    return [...orders].sort((a, b) => {
      let av: any, bv: any;
      switch (sortField) {
        case 'orderNumber':  av = a.orderNumber;       bv = b.orderNumber;       break;
        case 'customerName': av = a.customerName;      bv = b.customerName;      break;
        case 'repName':      av = a.repName ?? '';     bv = b.repName ?? '';     break;
        case 'status':       av = a.status;            bv = b.status;            break;
        default:             av = a.orderDate || '';   bv = b.orderDate || '';   break;
      }
      if (typeof av === 'string') av = av.toLowerCase();
      if (typeof bv === 'string') bv = bv.toLowerCase();
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [orders, sortField, sortDir]);

  const quickOrderRows = useMemo(() => {
    let rows = (quickData as any[]).map((r: any) => ({
      _isQuick: true, _quick: r,
      id: r.id, orderNumber: r.requestNumber,
      customerName: r.customerName, repName: r.repName,
      orderDate: r.createdAt, status: r.status,
      items: [] as any[], totalAmount: 0, isFromApprovedQuotation: false,
    }));
    if (status)         rows = rows.filter(r => r.status === status);
    if (repIdFilter)    rows = rows.filter(r => r._quick.repId === repIdFilter);
    if (customerIdFilter) {
      const custName = customers.find(c => c.id === customerIdFilter)?.shopName?.toLowerCase();
      if (custName) rows = rows.filter(r => (r.customerName || '').toLowerCase() === custName);
    }
    if (fromDate)  rows = rows.filter(r => r.orderDate && r.orderDate >= fromDate);
    if (toDate)    rows = rows.filter(r => r.orderDate && r.orderDate.slice(0, 10) <= toDate);
    return rows;
  }, [quickData, status, repIdFilter, customerIdFilter, customers, fromDate, toDate]);

  const allRows: any[] = useMemo(() => {
    const q = search.toLowerCase();
    const merged = [...orders, ...quickOrderRows].filter(r =>
      !q ||
      (r.orderNumber || '').toLowerCase().includes(q) ||
      (r.customerName || '').toLowerCase().includes(q) ||
      (r.repName || '').toLowerCase().includes(q)
    );
    return merged.sort((a, b) => {
      let av: any, bv: any;
      switch (sortField) {
        case 'orderNumber':  av = a.orderNumber;      bv = b.orderNumber;      break;
        case 'customerName': av = a.customerName;     bv = b.customerName;     break;
        case 'repName':      av = a.repName ?? '';    bv = b.repName ?? '';    break;
        case 'status':       av = a.status;           bv = b.status;           break;
        default:             av = a.orderDate || '';  bv = b.orderDate || '';  break;
      }
      if (typeof av === 'string') av = av.toLowerCase();
      if (typeof bv === 'string') bv = bv.toLowerCase();
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [orders, quickOrderRows, sortField, sortDir, search]);

  const activeFilterCount =
    (status ? 1 : 0) + (repIdFilter ? 1 : 0) + (customerIdFilter ? 1 : 0) + ((fromDate || toDate) ? 1 : 0);

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id); else s.add(id);
      return s;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === allRows.length && allRows.length > 0) setSelectedIds(new Set());
    else setSelectedIds(new Set(allRows.map((r: any) => r.id)));
  };

  const toggleSort = (field: string) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const handleBulkDelete = async () => {
    const ids = [...selectedIds];
    const rows = allRows.filter((r: any) => ids.includes(r.id));
    const regularIds = rows.filter((r: any) => !r._isQuick).map((r: any) => r.id);
    const quickIds = rows.filter((r: any) => r._isQuick).map((r: any) => r._quick.id);
    try {
      await Promise.all([
        ...regularIds.map((id) => ordersApi.adminDelete(id)),
        ...quickIds.map((id) => quickRequestApi.adminSoftDelete(id)),
      ]);
      // Immediately remove deleted rows from caches
      if (regularIds.length > 0) {
        queryClient.setQueriesData({ queryKey: ['admin-orders'] }, (old: any) =>
          old ? { ...old, items: old.items?.filter((o: any) => !regularIds.includes(o.id)), totalCount: Math.max(0, (old.totalCount ?? 0) - regularIds.length) } : old
        );
      }
      if (quickIds.length > 0) {
        queryClient.setQueriesData({ queryKey: ['admin-quick-orders'] }, (old: any) =>
          Array.isArray(old) ? old.filter((q: any) => !quickIds.includes(q.id)) : old
        );
      }
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      queryClient.invalidateQueries({ queryKey: ['admin-orders-trash'] });
      if (quickIds.length > 0) queryClient.invalidateQueries({ queryKey: ['admin-quick-orders'] });
      setSelectedIds(new Set());
      setBulkDeleteConfirm(false);
      toast.success(`${ids.length} item(s) deleted`);
    } catch {
      toast.error('Some deletions failed');
    }
  };

  const handleBulkStatusChange = async () => {
    if (!bulkStatusValue) return;
    const ids = [...selectedIds];
    const rowMap = new Map(allRows.map((r: any) => [r.id, r]));
    const regularIds = ids.filter(id => !rowMap.get(id)?._isQuick);
    const quickIds = ids.filter(id => rowMap.get(id)?._isQuick);
    try {
      await Promise.all([
        ...regularIds.map((id) => ordersApi.adminUpdateStatus(id, { status: bulkStatusValue as OrderStatus })),
        ...quickIds.map((id) => quickRequestApi.adminUpdateStatus(id, { status: bulkStatusValue })),
      ]);
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      if (quickIds.length > 0) queryClient.invalidateQueries({ queryKey: ['admin-quick-orders'] });
      setShowBulkStatusModal(false);
      setSelectedIds(new Set());
      toast.success(`${ids.length} order(s) updated to ${bulkStatusValue}`);
    } catch {
      toast.error('Some updates failed');
    }
  };

  // Format amount for PDF/Excel rows (plain number, no currency symbol)
  const formatAmt = (amt: number | null | undefined) => {
    if (amt == null) return '0.00';
    return amt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Export
  const exportOrders = async (format: 'excel' | 'pdf', onlySelected = false, singleRow?: any) => {
    // Single quick row — use dedicated quick request export
    if (singleRow?._isQuick) {
      if (format === 'pdf') {
        await downloadQuickRequestPdf(singleRow._quick);
      } else {
        await downloadQuickRequestExcel(singleRow._quick);
        toast.success('Excel exported');
      }
      return;
    }

    let items: Order[] = [];
    let quickItems: any[] = [];

    if (singleRow) {
      items = [singleRow];
    } else if (onlySelected && selectedIds.size > 0) {
      for (const row of allRows) {
        if (selectedIds.has(row.id)) {
          if ((row as any)._isQuick) quickItems.push((row as any)._quick);
          else items.push(row);
        }
      }
    } else {
      items = orders;
    }
    if (!items.length && !quickItems.length) { toast.error('No orders to export'); return; }

    try {
      if (format === 'excel') {
        const wb = XLSX.utils.book_new();

        for (const o of items) {
          const customer = customers.find(c => c.id === o.customerId || c.shopName === o.customerName);
          const isNonTaxCustomer = (customer?.customerType || (o as any).customerType || '').toLowerCase().replace(/[-\s]/g, '') === 'nontax';

          let totalGrossAmount = 0;
          let totalTaxAmount = 0;
          let totalDiscountAmount = 0;

          const rows: (string | number | null)[][] = [];
          rows.push(['PURCHASE ORDER']);
          rows.push([]);
          rows.push(['Order #', o.orderNumber, 'Date', formatDate(o.orderDate)]);
          rows.push(['Customer', o.customerName, 'Status', o.status]);
          rows.push(['Sales Rep', o.repName || '—']);
          rows.push([]);

          const excelHeaders = ['#', 'Item Code', 'Item Description', 'Qty', 'Rate', 'Disc %', 'Disc Amt'];
          if (!isNonTaxCustomer) excelHeaders.push('Tax');
          excelHeaders.push('Line Gross');
          rows.push(excelHeaders);

          const colWidths = [
            { wch: 5 }, { wch: 15 }, { wch: 40 }, { wch: 8 }, { wch: 15 }, { wch: 10 }, { wch: 15 },
          ];
          if (!isNonTaxCustomer) colWidths.push({ wch: 15 });
          colWidths.push({ wch: 20 });

          (o.items || []).forEach((it, i) => {
            const rate = it.unitPrice || 0;
            const qty = it.quantity || 0;
            const discPct = it.discountPercent || 0;
            const baseAmount = rate * qty;
            const rowTaxRate = taxCodeToRate(it.taxCode);
            const allIncRate = Math.round(rate * (1 + rowTaxRate) * 100) / 100;
            const displayRate = isNonTaxCustomer ? allIncRate : rate;
            const displayTotal = isNonTaxCustomer ? allIncRate * qty : baseAmount;
            const rowDiscountAmount = isNonTaxCustomer ? (allIncRate * qty * discPct) / 100 : (baseAmount * (discPct / 100));
            const rowTaxAmount = isNonTaxCustomer ? 0 : (rate * qty - baseAmount * (discPct / 100)) * rowTaxRate;

            totalGrossAmount += displayTotal;
            if (!isNonTaxCustomer) totalTaxAmount += rowTaxAmount;
            totalDiscountAmount += rowDiscountAmount;

            const rowData: any[] = [
              i + 1, it.productSKU || '—', it.productName, qty, displayRate,
              discPct ? `${discPct}%` : '—', rowDiscountAmount || '—'
            ];
            if (!isNonTaxCustomer) rowData.push(it.taxCode || '—');
            rowData.push(displayTotal);
            rows.push(rowData);
          });

          const finalAmount = isNonTaxCustomer
            ? totalGrossAmount - totalDiscountAmount
            : totalGrossAmount + totalTaxAmount - totalDiscountAmount;

          rows.push([]);
          rows.push([...Array(excelHeaders.length - 2).fill(null), 'Gross Amount', totalGrossAmount]);
          rows.push([...Array(excelHeaders.length - 2).fill(null), 'Discount Amount', -totalDiscountAmount]);
          if (!isNonTaxCustomer) {
            rows.push([...Array(excelHeaders.length - 2).fill(null), 'Net Amount', totalGrossAmount - totalDiscountAmount]);
            rows.push([...Array(excelHeaders.length - 2).fill(null), 'Total Tax Amount', totalTaxAmount]);
          }
          rows.push([...Array(excelHeaders.length - 2).fill(null), 'Total Invoice Value', finalAmount]);

          const ws = XLSX.utils.aoa_to_sheet(rows);
          ws['!cols'] = colWidths;
          const safeName = o.orderNumber.replace(/[:/\\?*[\]]/g, '-').substring(0, 31);
          XLSX.utils.book_append_sheet(wb, ws, safeName);
        }

        // Quick order sheets
        for (const qr of quickItems) {
          const qRows: any[][] = [
            ['QUICK ORDER REQUEST'], [],
            ['Request #', qr.requestNumber, 'Date', formatDate(qr.createdAt)],
            ['Customer', qr.customerName, 'Status', qr.status],
            ['Sales Rep', qr.repName || '—'], [],
            ['Request Details'], [qr.details || '—'],
          ];
          if (qr.adminNotes) { qRows.push([], ['Admin Notes'], [qr.adminNotes]); }
          const qws = XLSX.utils.aoa_to_sheet(qRows);
          qws['!cols'] = [{ wch: 20 }, { wch: 40 }, { wch: 20 }, { wch: 40 }];
          const safeName = (qr.requestNumber || 'Quick').replace(/[:/\\?*[\]]/g, '-').substring(0, 31);
          XLSX.utils.book_append_sheet(wb, qws, safeName);
        }

        const totalCount = items.length + quickItems.length;
        const xlsxFile = totalCount === 1
          ? `${items[0]?.orderNumber || quickItems[0]?.requestNumber}.xlsx`
          : 'orders-bulk-export.xlsx';
        XLSX.writeFile(wb, xlsxFile);
        toast.success('Excel exported');

      } else {
        // PDF Export
        const { jsPDF } = await import('jspdf');
        const autoTable = (await import('jspdf-autotable')).default;
        const doc = new jsPDF({ unit: 'mm', format: 'a4' });
        const pageW = doc.internal.pageSize.getWidth();
        let pageIndex = 0;

        items.forEach((o) => {
          if (pageIndex > 0) doc.addPage();
          pageIndex++;

          const customer = customers.find(c => c.id === o.customerId || c.shopName === o.customerName);
          const isNonTaxCustomer = (customer?.customerType || (o as any).customerType || '').toLowerCase().replace(/[-\s]/g, '') === 'nontax';

          doc.setFontSize(14);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(0, 0, 0);
          doc.text('JANASIRI DISTRIBUTORS (PVT) LTD', 14, 18);

          doc.setFontSize(8);
          doc.setFont('helvetica', 'normal');
          doc.text('Reg Address: No 205 Wattarantenna Passage, Kandy.', 14, 23);
          doc.text('TP: 0814 950206 / Hotline: 0777 675322', 14, 27);
          doc.text('Email: janasiridistributors@yahoo.com / Vat 114608394-7000', 14, 31);
          doc.text('Bank AC: Sampath Bank PLC / Kandy Super Grade Branch / AC: 0007 1002 3131', 14, 35);

          doc.setFontSize(11);
          doc.setFont('helvetica', 'bold');
          doc.text('PURCHASE ORDER', pageW - 14, 18, { align: 'right' });

          const boxX = pageW - 74;
          const boxY = 21;
          const boxW = 60;
          const rowH = 6;

          doc.setDrawColor(0, 0, 0);
          doc.setLineWidth(0.2);
          doc.rect(boxX, boxY, boxW, rowH * 3);
          doc.line(boxX, boxY + rowH, boxX + boxW, boxY + rowH);
          doc.line(boxX, boxY + rowH * 2, boxX + boxW, boxY + rowH * 2);
          doc.line(boxX + 20, boxY, boxX + 20, boxY + rowH * 3);

          doc.setFontSize(8);
          doc.setFont('helvetica', 'normal');
          doc.text('Date', boxX + 2, boxY + 4);
          doc.text('Inv No', boxX + 2, boxY + rowH + 4);
          doc.text('Department', boxX + 2, boxY + rowH * 2 + 4);
          doc.text(formatDate(o.orderDate), boxX + 22, boxY + 4);
          doc.text(o.orderNumber || '', boxX + 22, boxY + rowH + 4);
          doc.text('CENTRAL', boxX + 22, boxY + rowH * 2 + 4);

          const cBoxY = 44;
          const cBoxH = 28;
          const colX = pageW / 2;
          doc.rect(14, cBoxY, pageW - 28, cBoxH);
          doc.line(14, cBoxY + 8, pageW - 14, cBoxY + 8);
          doc.setFont('helvetica', 'bold');
          doc.text('Supplier / Customer', 16, cBoxY + 6);
          const shopNameStr = customers.find(c => c.id === o.customerId)?.shopName || (o as any).shopName || o.customerName || '';
          doc.setFont('helvetica', 'normal');
          doc.text('Supplier', 16, cBoxY + 14);
          doc.text('Customer', colX + 2, cBoxY + 14);
          doc.text('JANASIRI DISTRIBUTORS (PVT) LTD', 16, cBoxY + 20);
          doc.text(shopNameStr, colX + 2, cBoxY + 20);
          const cAddr = doc.splitTextToSize(o.deliveryAddress || '', (pageW / 2) - 24);
          doc.text(cAddr, 16, cBoxY + 24);

          let totalGrossAmount = 0, totalTaxAmount = 0, totalDiscountAmount = 0;
          const tCols = isNonTaxCustomer
            ? ['No', 'Item Code', 'Item Description', 'Qty', 'Rate', 'Disc %', 'Disc Amt', 'Line Gross']
            : ['No', 'Item Code', 'Item Description', 'Qty', 'Rate', 'Disc %', 'Disc Amt', 'Tax', 'Line Gross'];

          const tRows = (o.items || []).map((it, i) => {
            const rate = it.unitPrice || 0;
            const qty = it.quantity || 0;
            const discPct = it.discountPercent || 0;
            const baseAmount = rate * qty;
            const rowTaxRate = taxCodeToRate(it.taxCode);
            const allIncRate = Math.round(rate * (1 + rowTaxRate) * 100) / 100;
            const displayRate = isNonTaxCustomer ? allIncRate : rate;
            const displayTotal = isNonTaxCustomer ? allIncRate * qty : baseAmount;
            const rowDiscountAmount = isNonTaxCustomer ? (allIncRate * qty * discPct) / 100 : (baseAmount * (discPct / 100));
            const rowTaxAmount = isNonTaxCustomer ? 0 : (baseAmount - baseAmount * (discPct / 100)) * rowTaxRate;

            totalGrossAmount += displayTotal;
            if (!isNonTaxCustomer) totalTaxAmount += rowTaxAmount;
            totalDiscountAmount += rowDiscountAmount;

            if (isNonTaxCustomer) {
              return [i + 1, it.productSKU || '', it.productName, qty, formatAmt(displayRate), discPct ? `${discPct}%` : '—', rowDiscountAmount ? formatAmt(rowDiscountAmount) : '—', formatAmt(displayTotal)];
            } else {
              return [i + 1, it.productSKU || '', it.productName, qty, formatAmt(rate), discPct ? `${discPct}%` : '—', rowDiscountAmount ? formatAmt(rowDiscountAmount) : '—', it.taxCode || '—', formatAmt(displayTotal)];
            }
          });

          const MIN_ROWS = 10;
          while (tRows.length < MIN_ROWS) tRows.push(Array(tCols.length).fill(''));

          autoTable(doc, {
            head: [tCols],
            body: tRows,
            startY: 70,
            theme: 'grid',
            styles: { fontSize: 8, cellPadding: 2, textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.2 },
            headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: 'bold', halign: 'center' },
            bodyStyles: { fillColor: [255, 255, 255] },
            columnStyles: {
              0: { cellWidth: 8, halign: 'center' },
              1: { cellWidth: 20 },
              2: { cellWidth: 'auto' },
              3: { cellWidth: 10, halign: 'center' },
              ...isNonTaxCustomer
                ? { 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' }, 7: { halign: 'right' } }
                : { 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' }, 7: { cellWidth: 14, halign: 'center' }, 8: { halign: 'right' } }
            }
          });

          const afterTableY = (doc as any).lastAutoTable.finalY;
          const finalAmount = isNonTaxCustomer
            ? totalGrossAmount - totalDiscountAmount
            : totalGrossAmount + totalTaxAmount - totalDiscountAmount;

          const summaryLines: { label: string; value: string; isBold?: boolean }[] = [];
          summaryLines.push({ label: 'Gross Amount', value: formatAmt(totalGrossAmount) });
          summaryLines.push({ label: 'Discount Amount', value: `-${formatAmt(totalDiscountAmount)}` });
          if (!isNonTaxCustomer) {
            summaryLines.push({ label: 'Net Amount', value: formatAmt(totalGrossAmount - totalDiscountAmount) });
            summaryLines.push({ label: 'Total Tax Amount', value: formatAmt(totalTaxAmount) });
          }
          summaryLines.push({ label: 'Total Invoice Value', value: `LKR ${formatAmt(finalAmount)}`, isBold: true });

          const totalsRowH = 6;
          const tableConfig = (doc as any).lastAutoTable;
          const cols = tableConfig.columns;
          let totalsW = 0;
          if (isNonTaxCustomer) {
            totalsW = cols[5].width + cols[6].width + cols[7].width;
          } else {
            totalsW = cols[6].width + cols[7].width + cols[8].width;
          }
          const totalsX = pageW - 14 - totalsW;
          let currentY = afterTableY;

          doc.setLineWidth(0.2);
          doc.setDrawColor(0, 0, 0);
          summaryLines.forEach((line) => {
            doc.rect(totalsX, currentY, totalsW, totalsRowH);
            doc.setFont('helvetica', line.isBold ? 'bold' : 'normal');
            doc.text(line.label, totalsX + 2, currentY + 4);
            doc.text(line.value, pageW - 16, currentY + 4, { align: 'right' });
            currentY += totalsRowH;
          });
        });

        // Quick order pages
        quickItems.forEach((qr) => {
          if (pageIndex > 0) doc.addPage();
          pageIndex++;
          doc.setFontSize(14); doc.setFont('helvetica', 'bold'); doc.setTextColor(0, 0, 0);
          doc.text('JANASIRI DISTRIBUTORS (PVT) LTD', 14, 18);
          doc.setFontSize(8); doc.setFont('helvetica', 'normal');
          doc.text('Reg Address: No 205 Wattarantenna Passage, Kandy.', 14, 23);
          doc.text('TP: 0814 950206 / Hotline: 0777 675322', 14, 27);
          doc.text('Email: janasiridistributors@yahoo.com / Vat 114608394-7000', 14, 31);
          doc.text('Bank AC: Sampath Bank PLC / Kandy Super Grade Branch / AC: 0007 1002 3131', 14, 35);
          doc.setFontSize(11); doc.setFont('helvetica', 'bold');
          doc.text('QUICK ORDER REQUEST', pageW - 14, 18, { align: 'right' });
          const bX = pageW - 74, bY = 21, bW = 60, rH = 6;
          doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.2);
          doc.rect(bX, bY, bW, rH * 3);
          doc.line(bX, bY + rH, bX + bW, bY + rH);
          doc.line(bX, bY + rH * 2, bX + bW, bY + rH * 2);
          doc.line(bX + 20, bY, bX + 20, bY + rH * 3);
          doc.setFontSize(8); doc.setFont('helvetica', 'normal');
          doc.text('Date', bX + 2, bY + 4); doc.text('Ref No', bX + 2, bY + rH + 4); doc.text('Status', bX + 2, bY + rH * 2 + 4);
          doc.text(formatDate(qr.createdAt), bX + 22, bY + 4);
          doc.text(qr.requestNumber || '', bX + 22, bY + rH + 4);
          doc.text(qr.status || '', bX + 22, bY + rH * 2 + 4);
          const cBY = 44, cBH = 22;
          doc.rect(14, cBY, pageW - 28, cBH);
          doc.line(14, cBY + 8, pageW - 14, cBY + 8);
          doc.setFont('helvetica', 'bold'); doc.text('Customer / Representative', 16, cBY + 6);
          doc.setFont('helvetica', 'normal');
          doc.text('Customer:', 16, cBY + 14); doc.text(qr.customerName || '—', 40, cBY + 14);
          doc.text('Sales Rep:', 16, cBY + 20); doc.text(qr.repName || '—', 40, cBY + 20);
          autoTable(doc, {
            head: [['Request Details']],
            body: [[qr.details || '—']],
            startY: 72, theme: 'grid',
            styles: { fontSize: 9, cellPadding: 3, textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.2 },
            headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: 'bold' },
            bodyStyles: { fillColor: [255, 255, 255], minCellHeight: 20 },
          });
          if (qr.adminNotes) {
            const aY = (doc as any).lastAutoTable.finalY;
            autoTable(doc, {
              head: [['Admin Notes']], body: [[qr.adminNotes]],
              startY: aY + 4, theme: 'grid',
              styles: { fontSize: 9, cellPadding: 3, textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.2 },
              headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: 'bold' },
              bodyStyles: { fillColor: [255, 255, 255] },
            });
          }
        });

        const totalCount = items.length + quickItems.length;
        const pdfFile = totalCount === 1
          ? `${items[0]?.orderNumber || quickItems[0]?.requestNumber}.pdf`
          : 'orders-bulk-export.pdf';
        doc.save(pdfFile);
        toast.success('PDF exported');
      }
    } catch (err) {
      console.error('export failed', err);
      toast.error('Export failed');
    }
  };

  return (
    <div className="animate-fade-in flex flex-col gap-4 pb-28">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Orders</h1>
        <p className="text-slate-500 text-sm mt-1">Manage and track customer orders</p>
      </div>

      {/* ── Sticky Toolbar ─────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-30">
        <div className="bg-white/95 backdrop-blur-sm border border-slate-200 rounded-2xl shadow-sm overflow-hidden">

          {/* Unified toolbar row */}
          <div className="px-3 py-2.5 flex flex-wrap sm:flex-nowrap items-center gap-x-2 gap-y-2">

            {/* Active / Trash tabs */}
            <div className="flex gap-0.5 bg-slate-100 p-0.5 rounded-lg shrink-0 order-1">
              <button
                onClick={() => { setActiveTab('active'); setPage(1); setSelectedIds(new Set()); }}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${activeTab === 'active' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
              >Active</button>
              <button
                onClick={() => { setActiveTab('trash'); setPage(1); setSelectedIds(new Set()); }}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${activeTab === 'trash' ? 'bg-white shadow-sm text-rose-600' : 'text-slate-500 hover:text-slate-700'}`}
              ><Trash2 className="w-3 h-3" />Trash</button>

            </div>
            <div className="relative group order-3 sm:order-2 w-full sm:w-auto sm:flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
              <input
                type="text"
                placeholder="Search order # or customer…"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="w-full pl-8 pr-7 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm placeholder-slate-400 focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/15 outline-none transition-all"
              />
              {search && (
                <button onClick={() => { setSearch(''); setPage(1); }} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Right buttons */}
            <div className="order-2 sm:order-3 ml-auto sm:ml-0 flex items-center gap-1 shrink-0">
              {/* Filter */}
              <button
                onClick={() => setFilterPanelOpen(p => !p)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                  filterPanelOpen
                    ? 'bg-indigo-600 text-white'
                    : activeFilterCount > 0
                    ? 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Filter</span>
                {activeFilterCount > 0 && (
                  <span className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold ${filterPanelOpen ? 'bg-white/30 text-white' : 'bg-indigo-600 text-white'}`}>{activeFilterCount}</span>
                )}
              </button>

              <div className="w-px h-5 bg-slate-200 mx-0.5" />

              {/* Excel */}
              <button
                onClick={() => exportOrders('excel', selectedIds.size > 0)}
                className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 transition-all"
                title={selectedIds.size > 0 ? `Export ${selectedIds.size} selected` : 'Export all'}
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">Excel</span>
              </button>

              {/* PDF */}
              <button
                onClick={() => exportOrders('pdf', selectedIds.size > 0)}
                className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-rose-50 hover:text-rose-600 transition-all"
                title={selectedIds.size > 0 ? `Export ${selectedIds.size} selected` : 'Export all'}
              >
                <FileText className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">PDF</span>
              </button>

              {/* Selection actions */}
              {selectedIds.size > 0 && (
                <>
                  <div className="w-px h-5 bg-slate-200 mx-0.5" />
                  <button
                    onClick={() => { setBulkStatusValue(''); setShowBulkStatusModal(true); }}
                    className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-semibold text-blue-600 hover:bg-blue-50 hover:text-blue-700 transition-all"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span className="hidden lg:inline">Status</span>
                  </button>
                  <button
                    onClick={() => setBulkDeleteConfirm(true)}
                    title={`Move ${selectedIds.size} to trash`}
                    className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-semibold text-red-600 hover:bg-red-50 hover:text-red-700 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span className="hidden lg:inline">Delete ({selectedIds.size})</span>
                  </button>
                  <button onClick={() => setSelectedIds(new Set())} title="Clear selection (Esc)" className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* ── Filter Panel ─────────────────────────────────────────────── */}
          {filterPanelOpen && (
            <div className="border-t border-slate-100">
              {/* Category tabs */}
              <div className="flex flex-wrap bg-slate-50 px-3 pt-3 gap-1">
                {([
                  { key: 'status',   label: 'Status',   count: status ? 1 : 0 },
                  { key: 'rep',      label: 'Rep',      count: repIdFilter ? 1 : 0 },
                  { key: 'customer', label: 'Customer', count: customerIdFilter ? 1 : 0 },
                  { key: 'date',     label: 'Date',     count: (fromDate || toDate) ? 1 : 0 },
                ] as { key: 'status' | 'rep' | 'customer' | 'date'; label: string; count: number }[]).map(({ key, label, count }) => (
                  <button
                    key={key}
                    onClick={() => setFilterSubPanel(p => p === key ? null : key)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-t-lg text-xs font-semibold border border-b-0 transition-all ${
                      filterSubPanel === key
                        ? 'bg-white border-slate-200 text-slate-800 -mb-px pb-[7px] z-10 relative'
                        : count > 0
                        ? 'bg-indigo-50 border-indigo-100 text-indigo-700'
                        : 'bg-transparent border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {label}
                    {count > 0 && (
                      <span className="w-4 h-4 rounded-full bg-indigo-600 text-white text-[9px] font-bold inline-flex items-center justify-center">{count}</span>
                    )}
                  </button>
                ))}
                {activeFilterCount > 0 && (
                  <button
                    onClick={() => { setStatus(''); setRepIdFilter(''); setCustomerIdFilter(''); setFromDate(''); setToDate(''); setPage(1); }}
                    className="ml-auto inline-flex items-center gap-1 px-2.5 py-1.5 rounded-t-lg text-xs font-semibold text-red-500 hover:text-red-700 hover:bg-red-50 transition-all border border-transparent"
                  >
                    <X className="w-3 h-3" /> Clear all
                  </button>
                )}
              </div>

              {/* Filter content panel */}
              <div className="bg-white border-t border-slate-200 px-4 py-4">
                {!filterSubPanel && (
                  <p className="text-xs text-slate-400 text-center py-2">Select a filter category above</p>
                )}

                {filterSubPanel === 'status' && (
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2.5">Filter by Status</p>
                    <div className="flex flex-wrap gap-2">
                      {FILTER_ORDER_STATUSES.map(s => (
                        <button key={s}
                          onClick={() => { setStatus(prev => prev === s ? '' : s); setPage(1); }}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                            status === s
                              ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                              : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-700 hover:bg-indigo-50'
                          }`}
                        >
                          {status === s && <Check className="w-3 h-3" />}
                          {s.replace(/([a-z])([A-Z])/g, '$1 $2')}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {filterSubPanel === 'rep' && (
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2.5">Filter by Sales Rep</p>
                    <div className="flex flex-wrap gap-2">
                      {reps.length === 0
                        ? <span className="text-xs text-slate-400 italic">No reps loaded</span>
                        : reps.map(r => (
                          <button key={r.id}
                            onClick={() => { setRepIdFilter(prev => prev === r.id ? '' : r.id); setPage(1); }}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                              repIdFilter === r.id
                                ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                                : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-700 hover:bg-indigo-50'
                            }`}
                          >
                            {repIdFilter === r.id && <Check className="w-3 h-3" />}
                            {r.fullName}
                          </button>
                        ))
                      }
                    </div>
                  </div>
                )}

                {filterSubPanel === 'customer' && (
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2.5">Filter by Customer</p>
                    <div className="flex items-center gap-2 max-w-sm">
                      <div className="relative flex-1">
                        <select
                          value={customerIdFilter}
                          onChange={e => { setCustomerIdFilter(e.target.value); setPage(1); }}
                          className="w-full appearance-none px-3 py-2 pr-8 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 focus:bg-white transition cursor-pointer"
                        >
                          <option value="">All Customers</option>
                          {customers.map(c => <option key={c.id} value={c.id}>{c.shopName}</option>)}
                        </select>
                        <ChevronRight className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 rotate-90 pointer-events-none" />
                      </div>
                      {customerIdFilter && (
                        <button onClick={() => { setCustomerIdFilter(''); setPage(1); }} className="p-2 text-red-400 hover:text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition shrink-0">
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {filterSubPanel === 'date' && (
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2.5">Filter by Date Range</p>
                    <div className="flex items-center gap-3 max-w-sm">
                      <div className="flex-1">
                        <label className="block text-[10px] text-slate-400 font-semibold mb-1">FROM</label>
                        <input type="date" value={fromDate} onChange={e => { setFromDate(e.target.value); setPage(1); }}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 focus:bg-white transition"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="block text-[10px] text-slate-400 font-semibold mb-1">TO</label>
                        <input type="date" value={toDate} onChange={e => { setToDate(e.target.value); setPage(1); }}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 focus:bg-white transition"
                        />
                      </div>
                      {(fromDate || toDate) && (
                        <div className="pt-4">
                          <button onClick={() => { setFromDate(''); setToDate(''); setPage(1); }} className="p-2 text-red-400 hover:text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Active tab content ───────────────────────────────────────────── */}
      {activeTab === 'active' && (<>

      {/* ── Mobile card list (< lg) ──────────────────────────────────────── */}
      <div className="lg:hidden bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-10 text-center text-slate-400 text-sm">Loading orders…</div>
        ) : allRows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <ShoppingCart className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-sm font-medium">No orders found</p>
          </div>
        ) : (
          <>
            {allRows.map((order) => {
              if ((order as any)._isQuick) {
                const qr = (order as any)._quick;
                const isExpanded = expandedOrderId === qr.id;
                return (
                  <div key={qr.id}>
                    <div
                      onClick={() => { if (selectedIds.size > 0) toggleSelection(qr.id); else setExpandedOrderId(p => p === qr.id ? null : qr.id); }}
                      className={`flex items-center gap-3 px-4 py-3 border-b border-slate-100 cursor-pointer transition-colors select-none ${selectedIds.has(qr.id) ? 'bg-violet-50' : isExpanded ? 'bg-violet-50/40' : 'bg-white active:bg-slate-50'}`}
                    >
                      <div className="shrink-0" onClick={e => { e.stopPropagation(); toggleSelection(qr.id); }}>
                        <div className={`w-5 h-5 rounded flex items-center justify-center border-2 transition-colors cursor-pointer ${selectedIds.has(qr.id) ? 'bg-violet-600 border-violet-600' : 'border-slate-300 bg-white'}`}>
                          {selectedIds.has(qr.id) && <Check className="w-3 h-3 text-white" />}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800">{qr.requestNumber}</p>
                        <span className="inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-violet-100 text-violet-700">Quick Order</span>
                        <p className="text-xs text-slate-500 mt-1 truncate">{qr.customerName}{qr.repName ? ` · ${qr.repName}` : ''}</p>
                      </div>
                      <StatusBadge status={qr.status} />
                      <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                    </div>
                    {isExpanded && (
                      <div className="px-4 pb-4 pt-2 space-y-3 bg-violet-50/20 border-b border-violet-100">
                        <div>
                          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Order Details</p>
                          <pre className="text-sm text-slate-800 whitespace-pre-wrap font-sans bg-white border border-slate-100 rounded-xl p-3">{qr.details}</pre>
                        </div>
                        {qr.adminNotes && (
                          <div>
                            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Admin Notes</p>
                            <p className="text-sm text-slate-700 bg-amber-50 border border-amber-100 rounded-xl p-3">{qr.adminNotes}</p>
                          </div>
                        )}
                        {qr.imageUrls?.length > 0 && (
                          <div>
                            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-2">Photos ({qr.imageUrls.length})</p>
                            <div className="flex flex-wrap gap-2">
                              {qr.imageUrls.map((url: string, i: number) => (
                                <div key={i} className="relative group w-20 h-20">
                                  <PrivateImage apiPath={url} alt={`Photo ${i+1}`}
                                    onClick={() => setQuickLightbox(url)}
                                    className="w-20 h-20 rounded-xl object-cover border border-slate-200 cursor-pointer hover:opacity-90 transition"
                                    onError={e => { (e.target as any).style.display = 'none'; }}
                                  />
                                  <button
                                    onClick={async e => { e.stopPropagation(); await downloadImage(`${BASE}${url}`, `photo-${i+1}`); }}
                                    className="absolute bottom-1 right-1 w-6 h-6 rounded-lg bg-black/60 hover:bg-black/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                                    title="Download photo"
                                  >
                                    <Download className="w-3 h-3" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        <div className="space-y-2">
                          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Update Status</p>
                          <div className="flex flex-wrap gap-1.5">
                            {QUICK_STATUSES.map(s => (
                              <button key={s}
                                onClick={e => { e.stopPropagation(); quickUpdateMut.mutate({ id: qr.id, status: s, notes: qr.adminNotes || '' }); }}
                                disabled={quickUpdateMut.isPending}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${s === qr.status ? 'bg-slate-800 text-white border-slate-800' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'} disabled:opacity-50`}
                              >{s === qr.status ? `✓ ${s}` : s}</button>
                            ))}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={e => { e.stopPropagation(); exportOrders('pdf', false, order); }} className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg text-red-600 hover:bg-red-50 transition">
                            <FileText className="w-3.5 h-3.5" /> PDF
                          </button>
                          <button onClick={e => { e.stopPropagation(); exportOrders('excel', false, order); }} className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg text-emerald-600 hover:bg-emerald-50 transition">
                            <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              }
              const customer = customers.find(c => c.id === order.customerId || c.shopName === order.customerName);
              const isNonTaxCustomer = (customer?.customerType || (order as any).customerType || '').toLowerCase().replace(/[-\s]/g, '') === 'nontax';
              let mobGross = 0, mobTax = 0, mobDisc = 0;
              order.items?.forEach(item => {
                const r = item.unitPrice || 0;
                const q = item.quantity || 0;
                const d = item.discountPercent || 0;
                const base = r * q;
                const rTaxRate = taxCodeToRate(item.taxCode);
                const allIncR = Math.round(r * (1 + rTaxRate) * 100) / 100;
                mobGross += isNonTaxCustomer ? allIncR * q : base;
                if (!isNonTaxCustomer) mobTax += (base - base * d / 100) * rTaxRate;
                mobDisc += isNonTaxCustomer ? allIncR * q * d / 100 : base * d / 100;
              });
              const mobTotal = isNonTaxCustomer ? mobGross - mobDisc : mobGross + mobTax - mobDisc;
              const isExpanded = expandedOrderId === order.id;
              const isSelected = selectedIds.has(order.id);

              return (
                <div key={order.id}>
                  <div
                    onClick={() => {
                      if (selectedIds.size > 0) toggleSelection(order.id);
                      else setExpandedOrderId(p => p === order.id ? null : order.id);
                    }}
                    className={`flex items-center gap-3 px-4 py-3 border-b border-slate-100 transition-colors cursor-pointer select-none ${
                      isSelected ? 'bg-indigo-50' : isExpanded ? 'bg-blue-50/40' : 'bg-white active:bg-slate-50'
                    }`}
                  >
                    {/* Checkbox always visible */}
                    <div
                      className="shrink-0"
                      onClick={e => { e.stopPropagation(); toggleSelection(order.id); }}
                    >
                      <div className={`w-5 h-5 rounded flex items-center justify-center border-2 transition-colors cursor-pointer ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 bg-white'}`}>
                        {isSelected && <Check className="w-3 h-3 text-white" />}
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate leading-snug">{order.orderNumber}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5 truncate">{customers.find(c => c.id === order.customerId)?.shopName || order.customerName}</p>
                      {order.repName && <p className="text-[11px] text-slate-400 truncate">{order.repName}</p>}
                    </div>

                    <div className="shrink-0 text-right flex flex-col items-end gap-1">
                      <StatusBadge status={order.status} />
                      <p className="text-sm font-bold text-slate-900 tabular-nums">{fmtAmt(mobTotal)}</p>
                    </div>

                    <ChevronRight className={`shrink-0 w-4 h-4 text-slate-300 transition-transform duration-200 ${isExpanded && selectedIds.size === 0 ? 'rotate-90 text-blue-400' : ''}`} />
                  </div>

                  {isExpanded && (
                    <div className="bg-blue-50/30 px-4 py-3 border-b border-blue-100 space-y-2.5">
                      {/* Items */}
                      {order.items?.map((item) => {
                        const r = item.unitPrice || 0;
                        const q = item.quantity || 0;
                        const rTaxRate = taxCodeToRate(item.taxCode);
                        const allIncR = Math.round(r * (1 + rTaxRate) * 100) / 100;
                        const lineGross = isNonTaxCustomer ? allIncR * q : r * q;
                        return (
                          <div key={item.id} className="flex justify-between text-xs bg-white rounded-lg p-2.5 shadow-sm">
                            <div><span className="font-medium text-slate-800">{item.productName}</span><span className="text-slate-400 ml-2">×{item.quantity}</span></div>
                            <span className="font-semibold">{fmtAmt(lineGross)}</span>
                          </div>
                        );
                      })}

                      {/* Totals */}
                      <div className="text-xs space-y-1 bg-white border border-slate-100 rounded-xl p-3">
                        <div className="flex justify-between text-slate-500"><span>Gross</span><span>{fmtAmt(mobGross)}</span></div>
                        {!isNonTaxCustomer && <div className="flex justify-between text-slate-500"><span>Tax</span><span>{fmtAmt(mobTax)}</span></div>}
                        <div className="flex justify-between text-emerald-600"><span>Discount</span><span>-{fmtAmt(mobDisc)}</span></div>
                        <div className="flex justify-between font-bold text-orange-600 pt-1.5 border-t border-slate-100"><span>Grand Total</span><span>{fmtAmt(mobTotal)}</span></div>
                      </div>

                      {/* Status chips */}
                      <div className="flex flex-wrap gap-1.5 pt-0.5" onClick={e => e.stopPropagation()}>
                        {FILTER_ORDER_STATUSES.map(s => (
                          <button
                            key={s}
                            disabled={updateStatusMut.isPending}
                            onClick={() => { if (s !== order.status) updateStatusMut.mutate({ id: order.id, status: s }); }}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold border transition select-none ${
                              s === order.status
                                ? 'bg-black border-black text-white shadow-sm'
                                : 'bg-white border-black text-slate-700 opacity-70 hover:opacity-100 cursor-pointer'
                            }`}
                          >
                            {s === order.status && <Check className="w-2.5 h-2.5 shrink-0" />}
                            {s.replace(/([a-z])([A-Z])/g, '$1 $2')}
                          </button>
                        ))}
                      </div>

                      {/* Action buttons */}
                      <div className="flex gap-2">
                        <button onClick={(e) => { e.stopPropagation(); exportOrders('pdf', false, order); }} className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg text-red-600 hover:bg-red-50 transition">
                          <FileText className="w-3.5 h-3.5" /> PDF
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); exportOrders('excel', false, order); }} className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg text-emerald-600 hover:bg-emerald-50 transition">
                          <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); setDeleteOrder(order); setExpandedOrderId(null); }} className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg text-red-600 hover:bg-red-50 transition">
                          <Trash2 className="w-3.5 h-3.5" /> Delete
                        </button>
                      </div>

                      {/* Approve / Reject */}
                      {order.status === 'Pending' && (
                        <div className="flex gap-2 pt-0.5">
                          <button
                            onClick={(e) => { e.stopPropagation(); setRejectOrder(order); }}
                            className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg text-orange-600 hover:bg-orange-50 transition"
                          >
                            <XCircle className="w-3.5 h-3.5" /> Reject
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); approveMut.mutate(order.id); }}
                            disabled={approveMut.isPending}
                            className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg text-green-600 hover:bg-green-50 transition disabled:opacity-50"
                          >
                            <CheckCircle className="w-3.5 h-3.5" /> Approve
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            {selectedIds.size > 0 && (
              <p className="text-center text-[11px] text-indigo-500 py-3 font-medium select-none">
                {selectedIds.size} selected &mdash; <button onClick={() => setSelectedIds(new Set())} className="underline underline-offset-2">Clear (Esc)</button>
              </p>
            )}
          </>
        )}
        {data && data.totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-500">{data.totalCount} total · p{(data as any).page}/{data.totalPages}</span>
            <div className="flex gap-1">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition">Prev</button>
              <button onClick={() => setPage(p => Math.min(data.totalPages, p + 1))} disabled={page >= data.totalPages} className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition">Next</button>
            </div>
          </div>
        )}
      </div>

      {/* ── Desktop table (≥ lg) ──────────────────────────────────────────── */}
      <div className="hidden lg:block bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-10 text-center text-slate-400 text-sm">Loading orders…</div>
        ) : allRows.length === 0 ? (
          <div className="p-14 text-center">
            <ShoppingCart className="w-10 h-10 text-slate-200 mx-auto mb-2" />
            <p className="text-slate-400 text-sm">No orders found</p>
          </div>
        ) : (
          <>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-slate-800 text-white">
                  <th className="w-10 px-3 py-3.5 text-center border-r border-slate-600">
                    <input
                      type="checkbox"
                      checked={allRows.length > 0 && selectedIds.size === allRows.length}
                      ref={el => { if (el) el.indeterminate = selectedIds.size > 0 && selectedIds.size < allRows.length; }}
                      onChange={toggleAll}
                      className="accent-indigo-400 w-3.5 h-3.5 cursor-pointer"
                    />
                  </th>
                  <th className="w-8 px-2 py-3.5 border-r border-slate-600" />
                  <th onClick={() => toggleSort('orderNumber')} className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider border-r border-slate-600 cursor-pointer hover:bg-slate-700 transition-colors whitespace-nowrap select-none w-60">
                    <span className="flex items-center gap-1.5">Order <SortIcon field="orderNumber" sortField={sortField} sortDir={sortDir} /></span>
                  </th>
                  <th onClick={() => toggleSort('customerName')} className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider border-r border-slate-600 cursor-pointer hover:bg-slate-700 transition-colors select-none w-48">
                    <span className="flex items-center gap-1.5">Shop <SortIcon field="customerName" sortField={sortField} sortDir={sortDir} /></span>
                  </th>
                  <th onClick={() => toggleSort('repName')} className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider border-r border-slate-600 cursor-pointer hover:bg-slate-700 transition-colors select-none w-32">
                    <span className="flex items-center gap-1.5">Rep <SortIcon field="repName" sortField={sortField} sortDir={sortDir} /></span>
                  </th>
                  <th className="px-3 py-3.5 text-center text-xs font-semibold uppercase tracking-wider border-r border-slate-600 w-16">Items</th>
                  <th className="px-4 py-3.5 text-right text-xs font-semibold uppercase tracking-wider border-r border-slate-600 w-28 whitespace-nowrap">Total</th>
                  <th onClick={() => toggleSort('orderDate')} className="px-4 py-3.5 text-right text-xs font-semibold uppercase tracking-wider border-r border-slate-600 cursor-pointer hover:bg-slate-700 transition-colors select-none w-28 whitespace-nowrap">
                    <span className="flex items-center justify-end gap-1.5">Date <SortIcon field="orderDate" sortField={sortField} sortDir={sortDir} /></span>
                  </th>
                  <th onClick={() => toggleSort('status')} className="px-4 py-3.5 text-center text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-slate-700 transition-colors select-none w-32">
                    <span className="flex items-center justify-center gap-1.5">Status <SortIcon field="status" sortField={sortField} sortDir={sortDir} /></span>
                  </th>
                </tr>
              </thead>

              <tbody>
                {allRows.map((order) => {
                if ((order as any)._isQuick) {
                  const qr = (order as any)._quick;
                  const isExpanded = expandedOrderId === qr.id;
                  return (
                    <Fragment key={qr.id}>
                      <tr onClick={() => { if (selectedIds.size > 0) toggleSelection(qr.id); else setExpandedOrderId(p => p === qr.id ? null : qr.id); }}
                        className={`border-b border-slate-100 cursor-pointer transition-colors select-none ${selectedIds.has(qr.id) ? 'bg-violet-50/60' : isExpanded ? 'bg-violet-50/50 border-violet-100' : 'hover:bg-slate-50/70'}`}>
                        <td className="px-3 py-3 text-center border-r border-slate-100" onClick={e => { e.stopPropagation(); toggleSelection(qr.id); }}>
                          <input type="checkbox" readOnly checked={selectedIds.has(qr.id)} className="pointer-events-none accent-violet-500 w-3.5 h-3.5" />
                        </td>
                        <td className="px-2 py-3 border-r border-slate-100">
                          <ChevronRight className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-90 text-violet-500' : 'text-slate-400'}`} />
                        </td>
                        <td className="px-4 py-3 border-r border-slate-100 whitespace-nowrap">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-bold text-slate-900">{qr.requestNumber}</span>
                            <span className="inline-flex w-fit px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-violet-100 text-violet-700">Quick Order</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 border-r border-slate-100">
                          <span className="text-slate-700 truncate block">{qr.customerName}</span>
                        </td>
                        <td className="px-4 py-3 border-r border-slate-100">
                          <span className="text-slate-500">{qr.repName || '—'}</span>
                        </td>
                        <td className="px-3 py-3 text-center border-r border-slate-100">
                          <span className="text-slate-400">—</span>
                        </td>
                        <td className="px-4 py-3 text-right border-r border-slate-100">
                          <span className="text-slate-400">—</span>
                        </td>
                        <td className="px-4 py-3 text-right border-r border-slate-100 whitespace-nowrap">
                          <span className="text-slate-500">{formatDateTime(qr.createdAt)}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <StatusBadge status={qr.status} />
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="border-b border-violet-100">
                          <td colSpan={9} className="p-0">
                            <div className="bg-gradient-to-b from-violet-50/40 to-white px-8 py-5">
                              <div className="flex items-start gap-6">
                                <div className="flex-1 space-y-3">
                                  <div>
                                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">Order Details</p>
                                    <pre className="text-sm text-slate-800 whitespace-pre-wrap font-sans bg-white border border-slate-100 rounded-xl p-3">{qr.details}</pre>
                                  </div>
                                  {qr.adminNotes && (
                                    <div>
                                      <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Admin Notes</p>
                                      <p className="text-sm text-slate-700 bg-amber-50 border border-amber-100 rounded-xl p-3">{qr.adminNotes}</p>
                                    </div>
                                  )}
                                  {qr.imageUrls?.length > 0 && (
                                    <div>
                                      <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-2">Photos ({qr.imageUrls.length})</p>
                                      <div className="flex flex-wrap gap-2">
                                        {qr.imageUrls.map((url: string, i: number) => (
                                          <div key={i} className="relative group w-20 h-20">
                                            <PrivateImage apiPath={url} alt={`Photo ${i+1}`}
                                              onClick={e => { e.stopPropagation(); setQuickLightbox(url); }}
                                              className="w-20 h-20 rounded-xl object-cover border border-slate-200 cursor-pointer hover:opacity-90 transition"
                                              onError={e => { (e.target as any).style.display = 'none'; }}
                                            />
                                            <button
                                              onClick={async e => { e.stopPropagation(); await downloadImage(`${BASE}${url}`, `photo-${i+1}`); }}
                                              className="absolute bottom-1 right-1 w-6 h-6 rounded-lg bg-black/60 hover:bg-black/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                                              title="Download photo"
                                            >
                                              <Download className="w-3 h-3" />
                                            </button>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                                <div className="shrink-0 space-y-2 min-w-[190px]">
                                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Update Status</p>
                                  <div className="flex flex-col gap-1.5" onClick={e => e.stopPropagation()}>
                                    {QUICK_STATUSES.map(s => (
                                      <button key={s}
                                        onClick={() => quickUpdateMut.mutate({ id: qr.id, status: s, notes: qr.adminNotes || '' })}
                                        disabled={quickUpdateMut.isPending}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition text-left ${s === qr.status ? 'bg-slate-800 text-white border-slate-800' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'} disabled:opacity-50`}
                                      >{s === qr.status ? `✓ ${s}` : s}</button>
                                    ))}
                                  </div>
                                  <div className="flex gap-1.5 mt-1" onClick={e => e.stopPropagation()}>
                                    <button onClick={() => exportOrders('pdf', false, order)} className="flex-1 inline-flex items-center justify-center gap-1 py-1.5 text-xs font-semibold rounded-lg text-red-600 hover:bg-red-50 border border-red-100 transition">
                                      <FileText className="w-3 h-3" /> PDF
                                    </button>
                                    <button onClick={() => exportOrders('excel', false, order)} className="flex-1 inline-flex items-center justify-center gap-1 py-1.5 text-xs font-semibold rounded-lg text-emerald-600 hover:bg-emerald-50 border border-emerald-100 transition">
                                      <FileSpreadsheet className="w-3 h-3" /> Excel
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                }
                const customer = customers.find(c => c.id === order.customerId || c.shopName === order.customerName);
                const isNonTaxCustomer = (customer?.customerType || (order as any).customerType || '').toLowerCase().replace(/[-\s]/g, '') === 'nontax';
                let displayTotalGross = 0, displayTotalTax = 0, displayTotalDiscount = 0;
                order.items?.forEach(item => {
                  const rate = item.unitPrice || 0;
                  const qty = item.quantity || 0;
                  const discPct = item.discountPercent || 0;
                  const baseAmount = rate * qty;
                  const rowTaxRate = taxCodeToRate(item.taxCode);
                  const allIncRate = Math.round(rate * (1 + rowTaxRate) * 100) / 100;
                  const rowDiscountAmount = isNonTaxCustomer ? (allIncRate * qty * discPct) / 100 : (baseAmount * (discPct / 100));
                  const rowTaxAmount = isNonTaxCustomer ? 0 : (baseAmount - baseAmount * (discPct / 100)) * rowTaxRate;
                  displayTotalGross += isNonTaxCustomer ? allIncRate * qty : baseAmount;
                  if (!isNonTaxCustomer) displayTotalTax += rowTaxAmount;
                  displayTotalDiscount += rowDiscountAmount;
                });
                const displayFinalAmount = isNonTaxCustomer
                  ? displayTotalGross - displayTotalDiscount
                  : displayTotalGross + displayTotalTax - displayTotalDiscount;

                const isSelected = selectedIds.has(order.id);
                const isExpanded = expandedOrderId === order.id;

                return (
                  <Fragment key={order.id}>
                    <tr
                      onClick={() => setExpandedOrderId(p => p === order.id ? null : order.id)}
                      className={`border-b border-slate-100 cursor-pointer transition-colors select-none ${
                        isSelected ? 'bg-indigo-50/60' : isExpanded ? 'bg-blue-50/50 border-blue-100' : 'hover:bg-slate-50/70'
                      }`}
                    >
                      <td className="px-3 py-3 text-center border-r border-slate-100" onClick={e => { e.stopPropagation(); toggleSelection(order.id); }}>
                        <input type="checkbox" readOnly checked={isSelected} className="pointer-events-none accent-indigo-500 w-3.5 h-3.5" />
                      </td>
                      <td className="px-2 py-3 border-r border-slate-100">
                        <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isExpanded ? 'rotate-90 text-blue-500' : ''}`} />
                      </td>
                      <td className="px-4 py-3 border-r border-slate-100 whitespace-nowrap">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-bold text-slate-900">{order.orderNumber}</span>
                          {order.isFromApprovedQuotation && (
                            <span className="inline-flex w-fit px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">From Quotation</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 border-r border-slate-100 max-w-[180px]">
                        <span className="text-slate-700 truncate block" title={customers.find(c => c.id === order.customerId)?.shopName || order.customerName || ''}>
                          {customers.find(c => c.id === order.customerId)?.shopName || (order as any).shopName || order.customerName || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 border-r border-slate-100">
                        <span className="text-slate-500">{order.repName || '—'}</span>
                      </td>
                      <td className="px-3 py-3 text-center border-r border-slate-100">
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-600 text-xs font-bold">{order.items?.length || 0}</span>
                      </td>
                      <td className="px-4 py-3 text-right border-r border-slate-100 whitespace-nowrap">
                        <span className="font-bold text-slate-900">{fmtAmt(displayFinalAmount)}</span>
                      </td>
                      <td className="px-4 py-3 text-right border-r border-slate-100 whitespace-nowrap">
                        <span className="text-slate-500">{formatDateTime(order.orderDate)}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <StatusBadge status={order.status} />
                      </td>
                    </tr>

                    {isExpanded && (
                      <tr className="border-b border-blue-100">
                        <td colSpan={9} className="p-0">
                          <div className="bg-gradient-to-b from-slate-50 to-white px-8 py-5">
                            {/* Single row: order info (left) + all buttons (right) */}
                            <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
                              {/* Order info */}
                              <div className="flex items-center gap-1.5 text-sm flex-wrap">
                                <span className="font-semibold text-slate-700">{order.orderNumber}</span>
                                <span className="text-slate-400">·</span>
                                <span className="text-slate-500">{customers.find(c => c.id === order.customerId)?.shopName || (order as any).shopName || order.customerName || '—'}</span>
                                {order.repName && <><span className="text-slate-400">·</span><span className="text-xs text-slate-400">{order.repName}</span></>}
                                {order.deliveryAddress && <><span className="text-slate-400">·</span><span className="text-xs text-slate-400 truncate max-w-[160px]">{order.deliveryAddress}</span></>}
                              </div>

                              {/* Buttons on the right */}
                              <div className="flex items-center gap-0.5 flex-wrap justify-end" onClick={e => e.stopPropagation()}>
                                {/* Status chips */}
                                {FILTER_ORDER_STATUSES.map(s => (
                                  <button
                                    key={s}
                                    disabled={updateStatusMut.isPending}
                                    onClick={() => { if (s !== order.status) updateStatusMut.mutate({ id: order.id, status: s }); }}
                                    className={`inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-semibold transition-all select-none ${
                                      s === order.status
                                        ? 'bg-slate-100 text-slate-900'
                                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 cursor-pointer'
                                    }`}
                                  >
                                    {s === order.status && <Check className="w-3 h-3 shrink-0" />}
                                    {s.replace(/([a-z])([A-Z])/g, '$1 $2')}
                                  </button>
                                ))}

                                <div className="w-px h-5 bg-slate-200 mx-0.5" />

                                {/* PDF */}
                                <button
                                  onClick={() => exportOrders('pdf', false, order)}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-rose-50 hover:text-rose-600 transition-all"
                                >
                                  <FileText className="w-3.5 h-3.5" /> PDF
                                </button>

                                {/* Excel */}
                                <button
                                  onClick={() => exportOrders('excel', false, order)}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 transition-all"
                                >
                                  <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
                                </button>

                                <div className="w-px h-5 bg-slate-200 mx-0.5" />

                                {/* Delete */}
                                <button
                                  onClick={() => { setDeleteOrder(order); setExpandedOrderId(null); }}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-red-50 hover:text-red-600 transition-all"
                                >
                                  <Trash2 className="w-3.5 h-3.5" /> Delete
                                </button>
                              </div>
                            </div>

                            {/* Items table */}
                            {order.items && order.items.length > 0 && (
                              <div className="rounded-xl overflow-hidden border border-slate-200 mb-4">
                                <table className="w-full text-sm border-collapse">
                                  <thead>
                                    <tr className="bg-slate-200 text-black">
                                      <th className="px-3 py-2.5 w-10 text-left text-xs font-semibold uppercase tracking-wider border-r border-slate-300">No</th>
                                      <th className="px-3 py-2.5 w-28 text-left text-xs font-semibold uppercase tracking-wider border-r border-slate-300">Item Code</th>
                                      <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider border-r border-slate-300">Item Description</th>
                                      <th className="px-3 py-2.5 w-14 text-center text-xs font-semibold uppercase tracking-wider border-r border-slate-300">Qty</th>
                                      <th className="px-3 py-2.5 w-36 text-right text-xs font-semibold uppercase tracking-wider border-r border-slate-300">Rate</th>
                                      <th className="px-3 py-2.5 w-1 text-right text-xs font-semibold uppercase tracking-wider border-r border-slate-300">Disc%</th>
                                      <th className="px-3 py-2.5 w-36 text-right text-xs font-semibold uppercase tracking-wider border-r border-slate-300">Disc Amt</th>
                                      {!isNonTaxCustomer && <th className="px-3 py-2.5 w-16 text-right text-xs font-semibold uppercase tracking-wider border-r border-slate-300">Tax</th>}
                                      <th className="px-3 py-2.5 w-36 text-right text-xs font-semibold uppercase tracking-wider">Line Gross</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {order.items.map((item, i) => {
                                      const rate = item.unitPrice || 0;
                                      const qty = item.quantity || 0;
                                      const discPct = item.discountPercent || 0;
                                      const baseAmount = rate * qty;
                                      const rowTaxRate = taxCodeToRate(item.taxCode);
                                      const allIncRate = Math.round(rate * (1 + rowTaxRate) * 100) / 100;
                                      const displayRate = isNonTaxCustomer ? allIncRate : rate;
                                      const lineGross = isNonTaxCustomer ? allIncRate * qty : baseAmount;
                                      const rowDiscountAmount = isNonTaxCustomer ? (allIncRate * qty * discPct) / 100 : (baseAmount * (discPct / 100));
                                      return (
                                        <tr key={item.id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                                          <td className="px-3 py-2.5 text-center text-xs text-slate-400 font-medium border border-slate-100">{i + 1}</td>
                                          <td className="px-3 py-2.5 font-medium text-slate-900 text-sm border border-slate-100">{item.productSKU || '—'}</td>
                                          <td className="px-4 py-2.5 font-medium text-slate-900 text-sm border border-slate-100">{item.productName}</td>
                                          <td className="px-3 py-2.5 text-center text-slate-700 font-semibold border border-slate-100">{qty}</td>
                                          <td className="px-3 py-2.5 text-right text-slate-700 border border-slate-100">{fmtAmt(displayRate)}</td>
                                          <td className="px-3 py-2.5 text-right text-slate-500 border border-slate-100">{discPct ? `${discPct}%` : <span className="text-slate-300">—</span>}</td>
                                          <td className="px-3 py-2.5 text-right text-slate-500 border border-slate-100">{rowDiscountAmount ? fmtAmt(rowDiscountAmount) : <span className="text-slate-300">—</span>}</td>
                                          {!isNonTaxCustomer && <td className="px-3 py-2.5 text-center text-slate-500 border border-slate-100">{item.taxCode || <span className="text-slate-300">—</span>}</td>}
                                          <td className="px-3 py-2.5 text-right font-bold text-slate-900 border border-slate-100">{fmtAmt(lineGross)}</td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            )}

                              <div className="flex items-start gap-4 flex-wrap">
                              {order.deliveryNotes && (
                                <div className="flex-1 min-w-[180px] max-w-sm bg-violet-50 border border-violet-200 rounded-xl p-3.5">
                                  <p className="text-[10px] font-bold text-violet-600 uppercase tracking-wider mb-1.5">Special Notes</p>
                                  <p className="text-sm text-slate-700 whitespace-pre-wrap break-words leading-relaxed">{order.deliveryNotes}</p>
                                </div>
                              )}
                              <div className="w-full max-w-md space-y-1.5 text-sm bg-white border border-slate-200 rounded-xl p-3 shadow-sm ml-auto">
                                <div className="flex items-center justify-between gap-8 font-medium text-slate-500"><span>Gross Amount</span><span className="whitespace-nowrap tabular-nums">{fmtAmt(displayTotalGross)}</span></div>
                                <div className="flex items-center justify-between gap-8 font-medium text-orange-500 pb-3 border-b border-slate-100"><span>Discount Amount</span><span className="whitespace-nowrap tabular-nums">-{fmtAmt(displayTotalDiscount)}</span></div>
                                {!isNonTaxCustomer && (
                                  <>
                                    <div className="flex items-center justify-between gap-8 font-medium text-slate-500"><span>Net Amount</span><span className="whitespace-nowrap tabular-nums">{fmtAmt(displayTotalGross - displayTotalDiscount)}</span></div>
                                    <div className="flex items-center justify-between gap-8 font-medium text-slate-500 pb-3 border-b border-slate-100"><span>Total Tax Amount</span><span className="whitespace-nowrap tabular-nums">{fmtAmt(displayTotalTax)}</span></div>
                                  </>
                                )}
                                <div className="flex items-center justify-between gap-8 font-bold pt-1"><span className="text-slate-800 uppercase tracking-wider text-xs">Total Invoice Value</span><span className="text-sm text-orange-600 whitespace-nowrap tabular-nums">{fmtAmt(displayFinalAmount)}</span></div>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              </tbody>
            </table>

            {/* Bottom hint */}
            {selectedIds.size === 0 && allRows.length > 0 && (
              <p className="text-center text-[11px] text-slate-400 py-3 border-t border-slate-100 italic select-none">
                Click a checkbox to enter selection mode
              </p>
            )}
            {selectedIds.size > 0 && (
              <p className="text-center text-[11px] text-slate-400 py-3 border-t border-slate-100 select-none">
                {selectedIds.size} selected{' '}&mdash;{' '}
                <button onClick={() => setSelectedIds(new Set())} className="text-red-400 hover:text-red-600 font-medium transition-colors">Clear (Esc)</button>
              </p>
            )}

            {/* Pagination */}
            {data && data.totalPages > 1 && (
              <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs text-slate-500">
                  {data.totalCount} total · page {data.page} of {data.totalPages}
                </span>
                <div className="flex gap-1">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition">Prev</button>
                  <button onClick={() => setPage(p => Math.min(data.totalPages, p + 1))} disabled={page >= data.totalPages} className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition">Next</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      </>)} {/* end active tab */}
      {/* ── Trash tab content ────────────────────────────────────────────── */}
      {activeTab === 'trash' && (
        <>
        <RoleOrderTrash role='admin' />
        <div className="hidden bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {(trashLoading || quickTrashLoading) ? (
            <div className="p-10 text-center text-slate-400 text-sm">Loading trash…</div>
          ) : (() => {
            const repName = repIdFilter ? (reps.find(r => r.id === repIdFilter)?.fullName || '').toLowerCase() : '';
            const custName = customerIdFilter ? (customers.find(c => c.id === customerIdFilter)?.shopName || '').toLowerCase() : '';
            const regularItems = (trashData?.items || []).map((o: any) => ({ ...o, _isQuick: false, displayNumber: o.orderNumber, deletedOn: o.deletedAt }));
            const quickItems = (quickTrashData as any[]).map((q: any) => ({ ...q, _isQuick: true, displayNumber: q.requestNumber, deletedOn: q.deletedAt, shopName: q.customerName, totalAmount: null }));
            let allTrashItems = [...regularItems, ...quickItems].sort((a, b) => new Date(b.deletedOn || 0).getTime() - new Date(a.deletedOn || 0).getTime());
            // Apply active filters to trash
            if (status)           allTrashItems = allTrashItems.filter(o => o.status === status);
            if (repName)          allTrashItems = allTrashItems.filter(o => (o.repName || '').toLowerCase().includes(repName));
            if (custName)         allTrashItems = allTrashItems.filter(o => (o.customerName || o.shopName || '').toLowerCase().includes(custName));
            if (fromDate)         allTrashItems = allTrashItems.filter(o => { const d = o.deletedOn || o.orderDate || o.createdAt; return d && d >= fromDate; });
            if (toDate)           allTrashItems = allTrashItems.filter(o => { const d = o.deletedOn || o.orderDate || o.createdAt; return d && d.slice(0, 10) <= toDate; });
            if (search.trim())    { const sq = search.toLowerCase(); allTrashItems = allTrashItems.filter(o => (o.displayNumber || '').toLowerCase().includes(sq) || (o.customerName || o.shopName || '').toLowerCase().includes(sq)); }
            if (!allTrashItems.length) return (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                <Trash2 className="w-10 h-10 mb-3 opacity-20" />
                <p className="text-sm font-medium">Trash is empty</p>
                <p className="text-xs mt-1 text-slate-300">Items remain here until restored or permanently removed from your view.</p>
              </div>
            );
            return (<>
              {/* ── Mobile / tablet cards (< lg) ── */}
              <div className="lg:hidden divide-y divide-slate-100">
                {allTrashItems.map((order: any) => (
                  <div key={order.id} className="px-4 py-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-bold text-slate-700 truncate">{order.displayNumber}</p>
                          {order._isQuick && <span className="shrink-0 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-violet-100 text-violet-700">Quick</span>}
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5 truncate">{order.shopName || order.customerName || '—'}</p>
                        <p className="text-[10px] text-slate-300 mt-0.5">Deleted {order.deletedOn ? formatDateTime(order.deletedOn) : '—'}</p>
                      </div>
                      {!order._isQuick && <p className="text-sm font-bold text-slate-900 tabular-nums shrink-0">{fmtAmt(order.totalAmount)}</p>}
                    </div>
                    <div className="flex items-center justify-between mt-2.5">
                      <StatusBadge status={order.status} />
                      <button
                        onClick={() => order._isQuick ? quickRestoreMut.mutate(order.id) : restoreMut.mutate(order.id)}
                        disabled={restoreMut.isPending || quickRestoreMut.isPending}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 border border-indigo-200 rounded-lg text-xs font-medium hover:bg-indigo-600 hover:text-white hover:border-indigo-600 transition disabled:opacity-50"
                      >
                        <RotateCcw className="w-3.5 h-3.5" /> Restore
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* ── Desktop table (>= lg) ── */}
              <div className="hidden lg:block">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-slate-800 text-white">
                      <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider border-r border-slate-600">Order #</th>
                      <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider border-r border-slate-600">Customer</th>
                      <th className="px-4 py-3.5 text-right text-xs font-semibold uppercase tracking-wider border-r border-slate-600">Total</th>
                      <th className="px-4 py-3.5 text-center text-xs font-semibold uppercase tracking-wider border-r border-slate-600">Status</th>
                      <th className="px-4 py-3.5 text-right text-xs font-semibold uppercase tracking-wider border-r border-slate-600">Deleted At</th>
                      <th className="px-4 py-3.5 text-center text-xs font-semibold uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allTrashItems.map((order: any, i: number) => (
                      <tr key={order.id} className={`border-b border-slate-100 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}>
                        <td className="px-4 py-3 border-r border-slate-100 font-bold text-slate-700">
                          <div className="flex items-center gap-1.5">
                            {order.displayNumber}
                            {order._isQuick && <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-violet-100 text-violet-700">Quick</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3 border-r border-slate-100 text-slate-500">{order.shopName || order.customerName || '—'}</td>
                        <td className="px-4 py-3 border-r border-slate-100 text-right font-bold text-slate-900">{order._isQuick ? '—' : fmtAmt(order.totalAmount)}</td>
                        <td className="px-4 py-3 border-r border-slate-100 text-center"><StatusBadge status={order.status} /></td>
                        <td className="px-4 py-3 border-r border-slate-100 text-right text-slate-400 text-xs">{order.deletedOn ? formatDateTime(order.deletedOn) : '—'}</td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => order._isQuick ? quickRestoreMut.mutate(order.id) : restoreMut.mutate(order.id)}
                            disabled={restoreMut.isPending || quickRestoreMut.isPending}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 border border-indigo-200 rounded-lg text-xs font-medium hover:bg-indigo-600 hover:text-white hover:border-indigo-600 transition disabled:opacity-50"
                          >
                            <RotateCcw className="w-3.5 h-3.5" /> Restore
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>);
          })()}
          {trashData && trashData.totalPages > 1 && (
            <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500">{trashData.totalCount} total · page {trashData.page} of {trashData.totalPages}</span>
              <div className="flex gap-1">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition">Prev</button>
                <button onClick={() => setPage(p => Math.min(trashData.totalPages, p + 1))} disabled={page >= trashData.totalPages} className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition">Next</button>
              </div>
            </div>
          )}
        </div>
        </>
      )}

      {quickLightbox && createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center" onClick={() => setQuickLightbox(null)}>
          <button className="absolute top-4 right-4 text-white bg-white/10 rounded-full p-2.5 hover:bg-white/25 transition" onClick={() => setQuickLightbox(null)}>
            <X className="w-5 h-5" />
          </button>
          <PrivateImage apiPath={quickLightbox} alt="Preview" className="max-h-[88vh] max-w-[92vw] rounded-xl object-contain" onClick={e => e.stopPropagation()} />
        </div>,
        document.body
      )}

      {/* ── Per-order status change modal ──────────────────────────────────── */}
      {statusChangeOrder &&
        createPortal(
          <div className="fixed inset-0 z-50 flex flex-col items-center">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => setStatusChangeOrder(null)} />
            <div className="relative mt-16 w-full max-w-sm mx-4 bg-white rounded-2xl shadow-2xl border border-slate-200" style={{ animation: 'slideDown 0.25s ease-out both' }}>
              <div className="flex items-center justify-between p-5 border-b border-slate-100">
                <div>
                  <h3 className="font-semibold text-slate-900">Change Status</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{statusChangeOrder.orderNumber}</p>
                </div>
                <button onClick={() => setStatusChangeOrder(null)} className="p-2 hover:bg-slate-100 rounded-xl transition">
                  <X className="w-4 h-4 text-slate-400" />
                </button>
              </div>
              <div className="p-5 space-y-4">
                <select value={statusPickerValue} onChange={(e) => setStatusPickerValue(e.target.value as OrderStatus)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/15 focus:border-indigo-300 transition">
                  {FILTER_ORDER_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <div className="flex gap-3">
                  <button onClick={() => setStatusChangeOrder(null)} className="flex-1 py-2.5 bg-slate-100 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-200 transition">Cancel</button>
                  <button
                    disabled={!statusPickerValue || statusPickerValue === statusChangeOrder.status}
                    onClick={() => updateStatusMut.mutate({ id: statusChangeOrder.id, status: statusPickerValue as OrderStatus })}
                    className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition disabled:opacity-50"
                  >
                    Update
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* ── Bulk status change modal ───────────────────────────────────────── */}
      {showBulkStatusModal &&
        createPortal(
          <div className="fixed inset-0 z-50 flex flex-col items-center">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => setShowBulkStatusModal(false)} />
            <div className="relative mt-16 w-full max-w-sm mx-4 bg-white rounded-2xl shadow-2xl border border-slate-200" style={{ animation: 'slideDown 0.25s ease-out both' }}>
              <div className="flex items-center justify-between p-5 border-b border-slate-100">
                <div>
                  <h3 className="font-semibold text-slate-900">Bulk Status Change</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{selectedIds.size} orders selected</p>
                </div>
                <button onClick={() => setShowBulkStatusModal(false)} className="p-2 hover:bg-slate-100 rounded-xl transition">
                  <X className="w-4 h-4 text-slate-400" />
                </button>
              </div>
              <div className="p-5 space-y-4">
                <select value={bulkStatusValue} onChange={(e) => setBulkStatusValue(e.target.value as OrderStatus)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/15 transition">
                  <option value="">Select new status</option>
                  {FILTER_ORDER_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <div className="flex gap-3">
                  <button onClick={() => setShowBulkStatusModal(false)} className="flex-1 py-2.5 bg-slate-100 rounded-xl text-sm font-medium hover:bg-slate-200 transition">Cancel</button>
                  <button disabled={!bulkStatusValue} onClick={handleBulkStatusChange} className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition">
                    Apply to {selectedIds.size}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* ── Reject confirmation ────────────────────────────────────────────── */}
      {rejectOrder && createPortal(
        <div className="fixed inset-0 z-50 flex flex-col items-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => setRejectOrder(null)} />
          <div className="relative mt-16 w-full max-w-sm mx-4 bg-white rounded-2xl shadow-2xl border border-slate-200" style={{ animation: 'slideDown 0.25s ease-out both' }}>
            <div className="flex items-start gap-4 p-6">
              <div className="shrink-0 w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                <XCircle className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">Reject Order</h3>
                <p className="mt-1 text-sm text-slate-500">Reject order <span className="font-semibold text-slate-700">{rejectOrder.orderNumber}</span>? This cannot be undone.</p>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 pb-5">
              <button onClick={() => setRejectOrder(null)} className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition">Cancel</button>
              <button
                onClick={() => rejectMut.mutate(rejectOrder.id)}
                disabled={rejectMut.isPending}
                className="px-5 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold transition disabled:opacity-50"
              >
                {rejectMut.isPending ? 'Rejecting…' : 'Reject'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── Delete confirmation ────────────────────────────────────────────── */}
      {deleteOrder && (
        <DeleteOrderModal
          orderNumber={deleteOrder.orderNumber}
          isPending={deleteMut.isPending}
          onClose={() => setDeleteOrder(null)}
          onConfirm={() => deleteMut.mutate(deleteOrder.id)}
        />
      )}

      {/* ── Bulk delete confirmation ──────────────────────────────────────── */}
      {bulkDeleteConfirm && createPortal(
        <div className="fixed inset-0 z-50 flex flex-col items-center" style={{ pointerEvents: 'auto' }}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => setBulkDeleteConfirm(false)} />
          <div className="relative mt-16 w-full max-w-md mx-4 bg-white rounded-2xl shadow-2xl border border-slate-200" style={{ animation: 'slideDown 0.25s ease-out both' }}>
            <div className="flex items-start gap-4 p-6">
              <div className="shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-semibold text-slate-900">Move to Trash</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Move <span className="font-semibold text-slate-700">{selectedIds.size} order{selectedIds.size !== 1 ? 's' : ''}</span> to your Admin trash only?
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 pb-5">
              <button onClick={() => setBulkDeleteConfirm(false)} className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition">Cancel</button>
              <button onClick={handleBulkDelete} className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition">Move {selectedIds.size} to Trash</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

function DeleteOrderModal({ orderNumber, isPending, onClose, onConfirm }: { orderNumber: string; isPending: boolean; onClose: () => void; onConfirm: () => void }) {
  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col items-center" style={{ pointerEvents: 'auto' }}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative mt-16 w-full max-w-md mx-4 bg-white rounded-2xl shadow-2xl border border-slate-200" style={{ animation: 'slideDown 0.25s ease-out both' }}>
        <div className="flex items-start gap-4 p-6">
          <div className="shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
            <Trash2 className="w-5 h-5 text-red-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-slate-900">Move to Trash</h3>
            <p className="mt-1 text-sm text-slate-500">
              Move order <span className="font-semibold text-slate-700">{orderNumber}</span> to your Admin trash only?
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 pb-5">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition">Cancel</button>
          <button onClick={onConfirm} disabled={isPending} className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition disabled:opacity-50">
            {isPending ? 'Moving…' : 'Move to Trash'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
