import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ordersApi } from '../../services/api/ordersApi';
import { customersApi } from '../../services/api/customersApi';
import { formatCurrency, formatDate, formatDateTime, statusColor } from '../../utils/formatters';
import {
  ArrowLeft, FileDown, Package, XCircle, CheckCircle, RefreshCw,
  User, MapPin, Calendar, Truck, Hash, ChevronDown, SlidersHorizontal,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useEffect, useRef, useState } from 'react';
import { taxCodeToRate } from '../../utils/calculations';
import { ORDER_STATUSES } from '../../types/order.types';
import type { OrderStatus } from '../../types/order.types';

export default function AdminOrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [statusPicker, setStatusPicker] = useState<OrderStatus | ''>('');

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    if (window.innerWidth >= 1024) window.scrollTo({ top: Math.max(0, el.getBoundingClientRect().top + window.scrollY - 80), behavior: 'smooth' });
  }, [id]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-order', id],
    queryFn: () => ordersApi.adminGetById(id || '').then(r => r.data.data),
    enabled: !!id,
  });

  const { data: customerData } = useQuery({
    queryKey: ['admin-customer', data?.customerId],
    queryFn: () => customersApi.adminGetById(data!.customerId).then(r => r.data.data),
    enabled: !!data?.customerId,
  });

  const isNonTaxCustomer = ((customerData?.customerType || '').toLowerCase().replace(/[-\s]/g, '') === 'nontax');

  const downloadReceipt = async () => {
    if (!data) return;
    try {
      const { jsPDF } = await import('jspdf');
      const autoTableModule = await import('jspdf-autotable');
      const autoTable = autoTableModule.default || (autoTableModule as any);
      const doc = new jsPDF();

      const pageWidth = doc.internal.pageSize.getWidth();
      const BLUE = [31, 73, 125] as [number, number, number];
      const WHITE: [number, number, number] = [255, 255, 255];
      const DARK: [number, number, number] = [0, 0, 0];
      const LIGHT_GRAY: [number, number, number] = [242, 242, 242];

      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...DARK);
      doc.text('Janasiri Distribution Pvt Ltd', 14, 16);

      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.text('No 205 Wattarantenna Passage, Kandy, Sri Lanka', 14, 21);
      doc.text('Phone: 0814 950206  |  Hotline: 0777 675322', 14, 25);
      doc.text('Email: janasiridistributors@yahoo.com', 14, 29);

      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...BLUE);
      doc.text('PURCHASE ORDER', pageWidth - 14, 16, { align: 'right' });

      const dateLabel = 'DATE';
      const poLabel = 'PO #';
      const dateValue = new Date(data.orderDate).toLocaleDateString();
      
      let poValue = String(data.orderNumber || data.id || '').replace(/[^\x00-\x7F]/g, ''); 
      if (poValue.length > 14) {
        poValue = poValue.substring(0, 14) + '...';
      }

      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...DARK);
      doc.text(dateLabel, pageWidth - 60, 23.5);
      doc.text(poLabel, pageWidth - 60, 30);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      
      doc.setDrawColor(180, 180, 180);
      
      doc.rect(pageWidth - 48, 19, 34, 5.5, 'S'); 
      doc.setTextColor(0, 0, 0);
      doc.text(dateValue, pageWidth - 15, 23.5, { align: 'right' });
      
      doc.rect(pageWidth - 48, 25.5, 34, 5.5, 'S'); 
      doc.text(poValue, pageWidth - 15, 30, { align: 'right' });

      const sectionY = 44;

      doc.setFillColor(...BLUE);
      doc.rect(14, sectionY, pageWidth - 28, 6, 'F');
      doc.setTextColor(...WHITE);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('CUSTOMER', 16, sectionY + 4.2);

      doc.setDrawColor(180, 180, 180);
      doc.rect(14, sectionY + 6, pageWidth - 28, 18);
      doc.setTextColor(...DARK);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.text(data.customerName || '[Name]', 16, sectionY + 14);

      const tableStartY = sectionY + 30;
      const cols = isNonTaxCustomer
        ? ['Description','Item','Rate','Qty','Disc%','Disc Amt','Amount']
        : ['Description','Item','Rate','Qty','Disc%','Disc Amt','Tax','Tax Amt','Amount'];
      const rows = data.items.map((item: any) => {
        const rate = item.unitPrice;
        const qty = item.quantity;
        const discPct = item.discountPercent ?? 0;
        const lineTaxRate = taxCodeToRate(item.taxCode);
        const allIncRate = Math.round(rate * (1 + lineTaxRate) * 100) / 100;
        const discAmt = isNonTaxCustomer ? allIncRate * qty * discPct / 100 : rate * qty * discPct / 100;
        const rowNet = rate * qty - rate * qty * discPct / 100;
        const rowTax = isNonTaxCustomer ? 0 : rowNet * lineTaxRate;
        const displayRate = isNonTaxCustomer ? allIncRate : rate;
        const rowGross = isNonTaxCustomer ? allIncRate * qty : rowNet + rowTax;
        if (isNonTaxCustomer) {
          return [
            item.productName,
            item.productSKU || '',
            formatCurrency(displayRate),
            qty,
            discPct ? `${discPct}%` : '-',
            discAmt ? formatCurrency(discAmt) : '-',
            formatCurrency(rowGross),
          ];
        }
        return [
          item.productName,
          item.productSKU || '',
          formatCurrency(displayRate),
          qty,
          discPct ? `${discPct}%` : '-',
          discAmt ? formatCurrency(discAmt) : '-',
          item.taxCode || '-',
          rowTax ? formatCurrency(rowTax) : '-',
          formatCurrency(rowNet + rowTax),
        ];
      });
      while (rows.length < 8) rows.push(Array(cols.length).fill(''));

      autoTable(doc, {
        head: [cols],
        body: rows,
        startY: tableStartY,
        styles: { fontSize: 7.5, cellPadding: 1.5, overflow: 'linebreak', valign: 'middle' },
        headStyles: { fillColor: BLUE, textColor: WHITE, fontStyle: 'bold', fontSize: 7.5 },
        columnStyles: isNonTaxCustomer
          ? {
            0: { cellWidth: 55 },
            1: { cellWidth: 15 },
            2: { cellWidth: 22, halign: 'right' as const },
            3: { cellWidth: 8, halign: 'center' as const },
            4: { cellWidth: 10, halign: 'right' as const },
            5: { cellWidth: 18, halign: 'right' as const },
            6: { cellWidth: 28, halign: 'right' as const },
          }
          : {
          0: { cellWidth: 55 },                          
          1: { cellWidth: 15 },                          
          2: { cellWidth: 22, halign: 'right' },         
          3: { cellWidth: 8, halign: 'center' },         
          4: { cellWidth: 10, halign: 'right' },         
          5: { cellWidth: 18, halign: 'right' },         
          6: { cellWidth: 8, halign: 'center' },         
          7: { cellWidth: 18, halign: 'right' },         
          8: { cellWidth: 28, halign: 'right' }, 
        },
        alternateRowStyles: { fillColor: [255,255,255] },
        tableLineColor: [180,180,180],
        tableLineWidth: 0.2,
        tableWidth: 'auto',
        didDrawCell: (data: any) => { 
            const { cell } = data; 
            if (cell.section==='body'||cell.section==='head') { 
                doc.setDrawColor(180,180,180); 
                doc.setLineWidth(0.2); 
                doc.rect(cell.x,cell.y,cell.width,cell.height);
            } 
        }
      });

      const afterTableY = (doc as any).lastAutoTable.finalY;

      const totalsX = pageWidth - 80;
      const totalsStartY = afterTableY + 4;
      const grand = data.items.reduce((s: number, i: any) => s + (i.lineTotal ?? i.unitPrice * i.quantity), 0);
      const tax = 0;
      const shipping = 0;
      const other = 0;
      const totalFinal = grand + tax + shipping + other;

      const totalsRows = [
        ['SUBTOTAL', formatCurrency(grand)],
        ['TAX', tax ? formatCurrency(tax) : '-'],
        ['SHIPPING', shipping ? formatCurrency(shipping) : '-'],
        ['OTHER', other ? formatCurrency(other) : '-'],
      ];

      const rowH = 6;
      const boxRight = pageWidth - 14;
      const boxW = boxRight - totalsX;

      doc.setFontSize(8.5);
      doc.setDrawColor(180, 180, 180);
      totalsRows.forEach(([label, val], i) => {
        const y = totalsStartY + i * rowH;
        doc.setFillColor(...LIGHT_GRAY);
        doc.rect(totalsX, y - 4, boxW / 2, rowH, 'FD');
        doc.setFillColor(...WHITE);
        doc.rect(totalsX + boxW / 2, y - 4, boxW / 2, rowH, 'FD');
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...DARK);
        doc.text(label, totalsX + 2, y);
        doc.setFont('helvetica', 'normal');
        doc.text(val, boxRight - 2, y, { align: 'right' });
      });

      const totalRowY = totalsStartY + totalsRows.length * rowH;
      doc.setFillColor(...BLUE);
      doc.rect(totalsX, totalRowY - 4, boxW, rowH + 1, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...WHITE);
      doc.text('TOTAL', totalsX + 2, totalRowY);
      doc.text(formatCurrency(totalFinal), boxRight - 2, totalRowY, { align: 'right' });

      const commentsBoxX = 14;
      const commentsBoxY = afterTableY + 4;
      const commentsBoxW = totalsX - 18;
      const commentsBoxH = totalsRows.length * 6 + 10;

      doc.setFillColor(...LIGHT_GRAY);
      doc.setTextColor(...DARK);
      doc.rect(commentsBoxX, commentsBoxY, commentsBoxW, 6, 'F');
      doc.setDrawColor(180, 180, 180);
      doc.rect(commentsBoxX, commentsBoxY, commentsBoxW, commentsBoxH);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text('Comments or Special Instructions', commentsBoxX + 2, commentsBoxY + 4);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      
      if (data.deliveryNotes) {
        const splitNotes = doc.splitTextToSize(data.deliveryNotes, commentsBoxW - 4);
        doc.text(splitNotes, commentsBoxX + 2, commentsBoxY + 11);
      }

      const pageH = doc.internal.pageSize.getHeight();
      const ftY = pageH - 32;
      doc.setDrawColor(31, 73, 125);
      doc.setLineWidth(0.4);
      doc.line(14, ftY, pageWidth - 14, ftY);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(31, 73, 125);
      doc.text('HOW TO CONTACT US', 14, ftY + 5);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(80, 80, 80);
      doc.text('Janasiri Distribution Pvt Ltd  |  No 205 Wattarantenna Passage, Kandy, Sri Lanka', 14, ftY + 11);
      doc.text('HEAD OFFICE (Kandy): No 205 Wattarantenna Passage  –  0777 675322  |  KANDY: No 02 Mawilmada Road  –  0814 950206', 14, ftY + 17);
      doc.text('COLOMBO: No.41A, Gnanathilaka Road, Mount Lavinia  –  75 381 6756', 14, ftY + 22);
      doc.text('Office: 0814 950206  |  Hotline: 0777 675322  |  Email: janasiridistributors@yahoo.com', 14, ftY + 27);

      doc.save(`order-${data.orderNumber||data.id}.pdf`);
    } catch (err) {
      console.error('failed to build pdf', err);
      toast.error('Failed to generate receipt');
    }
  };

  const updateStatusMut = useMutation({
    mutationFn: ({ orderId, status }: { orderId: string; status: OrderStatus }) => ordersApi.adminUpdateStatus(orderId, { status }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-orders'] }); qc.invalidateQueries({ queryKey: ['admin-order', id] }); toast.success('Status updated'); },
    onError: () => toast.error('Failed to update status'),
  });

  const rejectMut = useMutation({
    mutationFn: (orderId: string) => ordersApi.adminReject(orderId, 'Rejected by admin'),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-orders'] }); toast.success('Order rejected'); navigate('/admin/orders'); },
    onError: () => toast.error('Failed to reject'),
  });

  useEffect(() => {
    if (data) setStatusPicker(data.status || '');
  }, [data]);

  if (isLoading) return (
    <div className="p-6">
      <div className="skeleton h-8 w-48 mb-4" />
      <div className="skeleton h-64" />
    </div>
  );

  if (error || !data) return (
    <div className="p-6">
      <div className="text-center text-slate-500">Unable to load order</div>
    </div>
  );

  const order = data;

  return (
    <div ref={rootRef} className="animate-fade-in pb-16">
      {/* Sticky top nav bar */}
      <div className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200/70 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
          <button
            onClick={() => navigate('/admin/orders')}
            className="p-2 rounded-xl hover:bg-slate-100 transition text-slate-600"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900 text-sm truncate">{order.orderNumber}</span>
              <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold shrink-0 ${statusColor(order.status)}`}>{order.status}</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-none mt-0.5">{formatDateTime(order.orderDate)}</p>
          </div>
          <button
            onClick={downloadReceipt}
            className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition shadow-sm"
          >
            <FileDown className="w-3.5 h-3.5" /> Download PDF
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-5">

        {/* Info cards grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Customer card */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
              <User className="w-4 h-4 text-blue-500" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">Customer</p>
              <p className="text-sm font-semibold text-slate-900 mt-0.5 truncate">{order.customerName}</p>
              {order.repName && <p className="text-xs text-slate-400 mt-0.5">Rep: {order.repName}</p>}
            </div>
          </div>

          {/* Delivery card */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
              <MapPin className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">Delivery</p>
              <p className="text-sm font-semibold text-slate-900 mt-0.5 truncate">{order.deliveryAddress || '—'}</p>
              {order.deliveryNotes && <p className="text-xs text-slate-400 mt-0.5 truncate">{order.deliveryNotes}</p>}
            </div>
          </div>

          {/* Dates card */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-orange-50 flex items-center justify-center shrink-0">
              <Calendar className="w-4 h-4 text-orange-500" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">Dates</p>
              <p className="text-xs text-slate-600 mt-0.5">Ordered: <span className="font-medium text-slate-800">{formatDateTime(order.orderDate)}</span></p>
              {order.requiredDeliveryDate && <p className="text-xs text-slate-600">Required: <span className="font-medium text-slate-800">{formatDate(order.requiredDeliveryDate)}</span></p>}
              {order.actualDeliveryDate && <p className="text-xs text-slate-600">Delivered: <span className="font-medium text-emerald-600">{formatDate(order.actualDeliveryDate)}</span></p>}
            </div>
          </div>
        </div>

        {/* Items table */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-2">
            <Package className="w-4 h-4 text-slate-400" />
            <h2 className="font-semibold text-slate-800 text-sm">Order Items</h2>
            <span className="ml-auto text-xs text-slate-400">{order.items?.length ?? 0} item{(order.items?.length ?? 0) !== 1 ? 's' : ''}</span>
          </div>

          {/* Desktop table */}
          <div className="overflow-x-auto hidden sm:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-100">
                  <th className="px-5 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide w-9">#</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Item Code</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Item Description</th>
                  <th className="px-5 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">Qty</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Rate</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Disc %</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Disc Amt</th>
                  {!isNonTaxCustomer && <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Tax</th>}
                  <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Line Gross</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {order.items?.map((item: any, i: number) => {
                  const qty = item.quantity || 0;
                  const rate = item.unitPrice || 0;
                  const discPct = item.discountPercent ?? 0;
                  const lineTaxRate = taxCodeToRate(item.taxCode);
                  const allIncRate = Math.round(rate * (1 + lineTaxRate) * 100) / 100;
                  const displayRate = isNonTaxCustomer ? allIncRate : rate;
                  const lineGross = isNonTaxCustomer ? allIncRate * qty : rate * qty;
                  const discAmt = isNonTaxCustomer ? (allIncRate * qty * discPct) / 100 : (rate * qty * discPct) / 100;
                  return (
                  <tr key={item.id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}>
                    <td className="px-5 py-3 text-center text-xs text-slate-400 font-medium">{i + 1}</td>
                    <td className="px-5 py-3 text-xs text-slate-500 font-mono">{item.productSKU || '—'}</td>
                    <td className="px-5 py-3 font-medium text-slate-900">{item.productName}</td>
                    <td className="px-5 py-3 text-center text-slate-700">{item.quantity}</td>
                    <td className="px-5 py-3 text-right text-slate-600">{formatCurrency(displayRate)}</td>
                    <td className="px-5 py-3 text-right text-slate-500">{discPct ? `${discPct}%` : '—'}</td>
                    <td className="px-5 py-3 text-right text-slate-500">{discAmt ? formatCurrency(discAmt) : '—'}</td>
                    {!isNonTaxCustomer && <td className="px-5 py-3 text-center text-slate-500">{item.taxCode || '—'}</td>}
                    <td className="px-5 py-3 text-right font-semibold text-slate-900">{formatCurrency(lineGross)}</td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile item cards */}
          <div className="sm:hidden divide-y divide-slate-100">
            {order.items?.map((item: any, i: number) => {
              const qty = item.quantity || 0;
              const rate = item.unitPrice || 0;
              const lineTaxRate = taxCodeToRate(item.taxCode);
              const allIncRate = Math.round(rate * (1 + lineTaxRate) * 100) / 100;
              const displayRate = isNonTaxCustomer ? allIncRate : rate;
              const computedLineGross = isNonTaxCustomer ? allIncRate * qty : rate * qty;
              return (
              <div key={item.id} className="p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500 shrink-0">{i + 1}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{item.productName}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{item.productSKU && <span className="mr-2">{item.productSKU}</span>}x{item.quantity} @ {formatCurrency(displayRate)}</p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-semibold text-slate-900">{formatCurrency(computedLineGross)}</p>
                  {item.discountPercent > 0 && <p className="text-[10px] text-emerald-600">{item.discountPercent}% off</p>}
                </div>
              </div>
              );
            })}
          </div>
        </div>

        {/* Totals + Admin actions row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Totals card */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Order Summary</h3>
            <div className="space-y-2 text-sm">
              {(() => {
                let calcSub = 0, calcDisc = 0, calcTax = 0;
                (order.items || []).forEach((item: any) => {
                  const r = item.unitPrice || 0, q = item.quantity || 0, d = item.discountPercent || 0;
                  const ltr = taxCodeToRate(item.taxCode);
                  const allIncR = Math.round(r * (1 + ltr) * 100) / 100;
                  const base = r * q, net = base - base * d / 100;
                  calcSub += isNonTaxCustomer ? allIncR * q : base;
                  calcDisc += isNonTaxCustomer ? (allIncR * q * d / 100) : (base * d / 100);
                  if (!isNonTaxCustomer) calcTax += net * ltr;
                });
                const calcTotal = calcSub - calcDisc + calcTax;
                return (
                  <>
                    <div className="flex justify-between text-slate-600"><span>Subtotal</span><span>{formatCurrency(calcSub)}</span></div>
                    {calcDisc > 0 && (
                      <div className="flex justify-between text-emerald-600"><span>Discount</span><span>- {formatCurrency(calcDisc)}</span></div>
                    )}
                    {calcTax > 0 && (
                      <div className="flex justify-between text-slate-600"><span>Tax</span><span>{formatCurrency(calcTax)}</span></div>
                    )}
                    <div className="flex justify-between font-bold text-base pt-3 border-t border-slate-100 text-indigo-700">
                      <span>Total</span><span>{formatCurrency(calcTotal)}</span>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>

          {/* Admin actions card */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Admin Actions</h3>

            {order.status === 'Pending' && (
              <div className="flex gap-2 mb-3">
                <button
                  onClick={() => rejectMut.mutate(order.id)}
                  disabled={rejectMut.isPending}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-red-50 text-red-600 border border-red-200 rounded-xl text-sm font-medium hover:bg-red-600 hover:text-white hover:border-red-600 transition disabled:opacity-50"
                >
                  <XCircle className="w-4 h-4" /> Reject
                </button>
                <button
                  onClick={() => {
                    const approveStatus = 'Approved' as OrderStatus;
                    updateStatusMut.mutate({ orderId: order.id, status: approveStatus });
                  }}
                  disabled={updateStatusMut.isPending}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 transition disabled:opacity-50"
                >
                  <CheckCircle className="w-4 h-4" /> Approve
                </button>
              </div>
            )}

            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <select
                  value={statusPicker}
                  onChange={e => setStatusPicker(e.target.value as OrderStatus | '')}
                  className="w-full appearance-none pl-3 pr-8 py-2.5 border border-slate-200 rounded-xl text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
                >
                  <option value="">Select status…</option>
                  {ORDER_STATUSES.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              </div>
              <button
                onClick={() => { if (!statusPicker) return; updateStatusMut.mutate({ orderId: order.id, status: statusPicker }); }}
                disabled={!statusPicker || statusPicker === order.status || updateStatusMut.isPending}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition disabled:opacity-40 disabled:pointer-events-none"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${updateStatusMut.isPending ? 'animate-spin' : ''}`} /> Update
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}