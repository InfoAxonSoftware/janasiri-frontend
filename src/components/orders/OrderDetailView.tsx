import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Calendar, FileDown, MapPin, Package, User } from 'lucide-react';
import type { ReactNode } from 'react';
import type { Order } from '../../types/order.types';
import { formatCurrency, formatDate, statusColor } from '../../utils/formatters';
import { taxCodeToRate } from '../../utils/calculations';
import { downloadPurchaseOrderPdf } from '../../utils/purchaseOrderPdf';
import { getShopName } from '../../utils/shopName';
import { customersApi } from '../../services/api/customersApi';

type Props = {
  order: Order;
  backPath: string;
  summaryTitle?: string;
  isTaxCustomer?: boolean;
  children?: ReactNode;
};

export default function OrderDetailView({ order, backPath, summaryTitle = 'Order Summary', isTaxCustomer: isTaxProp, children }: Props) {
  const navigate = useNavigate();

  const { data: customerProfile } = useQuery({
    queryKey: ['customer-profile-for-order-tax-mode'],
    queryFn: () => customersApi.customerGetProfile().then((r) => r.data.data),
    staleTime: 5 * 60 * 1000,
    enabled: isTaxProp === undefined,
  });

  const isTaxCustomer =
    isTaxProp !== undefined
      ? isTaxProp
      : (customerProfile?.customerType || '').toLowerCase().replace(/[-\s]/g, '') === 'tax';

  return (
    <div className="animate-fade-in pb-16">
      <div className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200/70 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
          <button
            onClick={() => navigate(backPath)}
            className="p-2 rounded-xl hover:bg-slate-100 transition text-slate-600"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900 text-sm truncate">{order.orderNumber}</span>
              <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold shrink-0 ${statusColor(order.status)}`}>{order.status}</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-none mt-0.5">{formatDate(order.orderDate)}</p>
          </div>
          <button
            onClick={() => downloadPurchaseOrderPdf({ ...order, isTaxCustomer })}
            className="flex items-center gap-1 px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[9px] sm:text-[10px] md:text-xs font-semibold transition shadow-sm"
            aria-label="Download order PDF"
          >
            <FileDown className="w-2.5 h-2.5 sm:w-3 sm:h-3 md:w-3.5 md:h-3.5" />
            <span className="hidden sm:inline ml-1">Download PDF</span>
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
              <User className="w-4 h-4 text-blue-500" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">Shop Name</p>
              <p className="text-sm font-semibold text-slate-900 mt-0.5 truncate">{getShopName(order)}</p>
              {order.repName && <p className="text-xs text-slate-400 mt-0.5">Rep: {order.repName}</p>}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-orange-50 flex items-center justify-center shrink-0">
              <Calendar className="w-4 h-4 text-orange-500" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">Dates</p>
              <p className="text-xs text-slate-600 mt-0.5">Ordered: <span className="font-medium text-slate-800">{formatDate(order.orderDate)}</span></p>
              {order.requiredDeliveryDate && <p className="text-xs text-slate-600">Required: <span className="font-medium text-slate-800">{formatDate(order.requiredDeliveryDate)}</span></p>}
              {order.actualDeliveryDate && <p className="text-xs text-slate-600">Delivered: <span className="font-medium text-emerald-600">{formatDate(order.actualDeliveryDate)}</span></p>}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-2">
            <Package className="w-4 h-4 text-slate-400" />
            <h2 className="font-semibold text-slate-800 text-sm">Order Items</h2>
            <span className="ml-auto text-xs text-slate-400">{order.items?.length ?? 0} item{(order.items?.length ?? 0) !== 1 ? 's' : ''}</span>
          </div>

          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full min-w-[780px] text-sm">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-100">
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide w-9">#</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Item Code</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Item Description</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">Qty</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Rate</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Disc %</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Disc Amt</th>
                  {isTaxCustomer && <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Tax Code</th>}
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Line Gross</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {order.items?.map((item: any, i: number) => {
                  const qty = item.quantity || 0;
                  const rate = item.unitPrice || 0;
                  const discPct = item.discountPercent ?? 0;
                  const lineTaxRate = taxCodeToRate(item.taxCode);
                  const allIncRate = Math.round(rate * (1 + lineTaxRate) * 100) / 100;
                  const displayRate = isTaxCustomer ? rate : allIncRate;
                  const lineGross = isTaxCustomer ? rate * qty : allIncRate * qty;
                  const discAmt = isTaxCustomer ? (rate * qty * discPct) / 100 : (allIncRate * qty * discPct) / 100;
                  return (
                    <tr key={item.id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}>
                      <td className="px-4 py-3 text-center text-xs text-slate-400 font-medium">{i + 1}</td>
                      <td className="px-4 py-3 text-xs text-slate-500 font-mono">{item.productSKU || '—'}</td>
                      <td className="px-5 py-3 font-medium text-slate-900">{item.productName}</td>
                      <td className="px-4 py-3 text-center text-slate-700">{item.quantity}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{formatCurrency(displayRate)}</td>
                      <td className="px-4 py-3 text-right text-slate-500">{discPct ? `${discPct}%` : '—'}</td>
                      <td className="px-4 py-3 text-right text-slate-500">{discAmt ? formatCurrency(discAmt) : '—'}</td>
                      {isTaxCustomer && <td className="px-4 py-3 text-center font-bold text-[10px] text-slate-500">{item.taxCode || '—'}</td>}
                      <td className="px-4 py-3 text-right font-semibold text-slate-900">{formatCurrency(lineGross)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="sm:hidden divide-y divide-slate-100">
            {order.items?.map((item: any, i: number) => {
              const qty = item.quantity || 0;
              const rate = item.unitPrice || 0;
              const discPct = item.discountPercent ?? 0;
              const lineTaxRate = taxCodeToRate(item.taxCode);
              const allIncRate = Math.round(rate * (1 + lineTaxRate) * 100) / 100;
              const displayRate = isTaxCustomer ? rate : allIncRate;
              const lineGross = isTaxCustomer ? rate * qty : allIncRate * qty;
              const discAmt = isTaxCustomer ? (rate * qty * discPct) / 100 : (allIncRate * qty * discPct) / 100;
              return (
                <div key={item.id} className="p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500 shrink-0">{i + 1}</span>
                    <div className="flex-1 flex items-center justify-between min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{item.productName}</p>
                      <p className="text-sm font-bold text-slate-900 ml-2 shrink-0">{formatCurrency(lineGross)}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-500 pl-7">
                    <p>Code: <span className="font-mono">{item.productSKU || '—'}</span></p>
                    <p className="text-right">Qty: {item.quantity}</p>
                    <p>Rate: {formatCurrency(displayRate)}</p>
                    <p className="text-right">Disc %: {discPct ? `${discPct}%` : '—'}</p>
                    <p>Disc Amt: {discAmt ? formatCurrency(discAmt) : '—'}</p>
                    {isTaxCustomer && <p className="text-right">Tax Code: {item.taxCode || '—'}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">{summaryTitle}</h3>
          <div className="space-y-2 text-sm">
            {(() => {
              let calcGross = 0, calcDisc = 0, calcTax = 0;
              (order.items || []).forEach((item: any) => {
                const r = item.unitPrice || 0, q = item.quantity || 0, d = item.discountPercent || 0;
                const ltr = taxCodeToRate(item.taxCode);
                const allIncR = Math.round(r * (1 + ltr) * 100) / 100;
                const base = r * q, net = base - base * d / 100;
                calcGross += isTaxCustomer ? base : allIncR * q;
                calcDisc += isTaxCustomer ? (base * d / 100) : (allIncR * q * d / 100);
                if (isTaxCustomer) calcTax += net * ltr;
              });
              const netAmt = calcGross - calcDisc;
              const calcTotal = isTaxCustomer ? netAmt + calcTax : netAmt;
              return (
                <>
                  <div className="flex justify-between text-slate-600"><span>Gross Amount</span><span>{formatCurrency(calcGross)}</span></div>
                  <div className="flex justify-between text-orange-500"><span>Discount Amount</span><span>- {formatCurrency(calcDisc)}</span></div>
                  {isTaxCustomer && (
                    <>
                      <div className="flex justify-between text-slate-600"><span>Net Amount</span><span>{formatCurrency(netAmt)}</span></div>
                      <div className="flex justify-between text-slate-600"><span>Total Tax Amount</span><span>{formatCurrency(calcTax)}</span></div>
                    </>
                  )}
                  <div className="flex justify-between font-bold text-base pt-3 border-t border-slate-100 text-indigo-700">
                    <span>Total Invoice Value</span><span>{formatCurrency(calcTotal)}</span>
                  </div>
                </>
              );
            })()}
          </div>
        </div>

        {children}
      </div>
    </div>
  );
}
