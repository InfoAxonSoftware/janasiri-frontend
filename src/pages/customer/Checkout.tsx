import { useSelector, useDispatch } from 'react-redux';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { RootState } from '../../store/store';
import { clearCart } from '../../store/slices/cartSlice';
import { ordersApi } from '../../services/api/ordersApi';
import { customersApi } from '../../services/api/customersApi';
import { formatCurrency } from '../../utils/formatters';
import { taxCodeToRate } from '../../utils/calculations';
import { downloadPurchaseOrderPdf } from '../../utils/purchaseOrderPdf';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, CheckCircle, ShoppingCart, ShoppingBag, Package, ShieldCheck, ArrowRight, FileText } from 'lucide-react';
import type { Order } from '../../types/order.types';
import toast from 'react-hot-toast';

export default function CustomerCheckout() {
  const { items } = useSelector((state: RootState) => state.cart);
  const { user } = useSelector((state: RootState) => state.auth);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [success, setSuccess] = useState(false);
  const [lastOrder, setLastOrder] = useState<Order | null>(null);

  const { data: customerProfile, isLoading: isProfileLoading } = useQuery({
    queryKey: ['customer-profile-for-checkout-tax-mode'],
    queryFn: () => customersApi.customerGetProfile().then((r) => r.data.data),
    staleTime: 5 * 60 * 1000,
  });

  const isNonTaxCustomer =
    (customerProfile?.customerType || '').toLowerCase().replace(/[-\s]/g, '') === 'nontax';
  const isTaxCustomer = !isNonTaxCustomer;

  // Checkout page global calculations
  let totalGrossAmount = 0;
  let totalTaxAmount = 0;
  let totalDiscountAmount = 0;

  items.forEach(item => {
    const rate = item.unitPrice;
    const qty = item.quantity;
    const discPct = item.discountPercent || 0;
    
    const baseAmount = rate * qty;
    // Per-line tax: use taxCode-derived rate for accuracy across mixed tax brackets
    const lineTaxRate = taxCodeToRate(item.taxCode) || (item.taxRate ?? 0);
    const allIncRate = item.allIncPrice || Math.round(rate * (1 + lineTaxRate) * 100) / 100;
    const rowDiscountAmount = isNonTaxCustomer ? allIncRate * qty * (discPct / 100) : baseAmount * (discPct / 100);
    const rowTaxAmount = (baseAmount - baseAmount * (discPct / 100)) * lineTaxRate;
    const nonTaxLineGross = allIncRate * qty;

    totalGrossAmount += isNonTaxCustomer ? nonTaxLineGross : baseAmount;
    if (!isNonTaxCustomer) {
      totalTaxAmount += rowTaxAmount;
    }
    totalDiscountAmount += rowDiscountAmount;
  });

  const finalAmount = isNonTaxCustomer
    ? totalGrossAmount - totalDiscountAmount
    : totalGrossAmount + totalTaxAmount - totalDiscountAmount;

  const netAmount = totalGrossAmount - totalDiscountAmount;

  const placeOrderMut = useMutation({
    mutationFn: () => ordersApi.customerCreate({
      customerId: user?.id || '',
      items: items.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
        discountPercent: item.discountPercent,
      })),
    }),
    onSuccess: (resp) => {
      const order = resp.data.data as Order;
      setLastOrder(order);

      // Make orders page reload automatically after a customer creates a new order
      queryClient.invalidateQueries({ queryKey: ['customer-orders'] });

      dispatch(clearCart());
      if (typeof window !== 'undefined') {
        localStorage.removeItem('quickRows');
      }
      setSuccess(true);
      toast.success('Order placed successfully!');
    },
    onError: () => {
      toast.error('Failed to place order. Please try again.');
    },
  });

  const downloadReceipt = async () => {
    if (!lastOrder) return;
    try {
      await downloadPurchaseOrderPdf({ ...lastOrder, isTaxCustomer });
    } catch (e) {
      console.error('receipt generation error', e);
      toast.error('Failed to generate receipt PDF');
    }
  };

  /* ─────────────────────────────────────────────
     SUCCESS STATE
  ───────────────────────────────────────────── */
  if (success) {
    return (
      <div className="animate-fade-in min-h-[80vh] flex items-center justify-center px-4 py-10">
        <div className="max-w-md w-full bg-white rounded-3xl border border-slate-200 shadow-sm p-8 text-center">
          <div className="mx-auto w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mb-6">
            <CheckCircle className="w-10 h-10 text-emerald-500" />
          </div>

          <h2 className="text-2xl font-bold text-slate-900 mb-2">Order Placed!</h2>
          <p className="text-slate-500 text-sm mb-8">
            Your order has been submitted successfully and is pending approval.
          </p>

          <div className="space-y-3">
            <button
              onClick={() => navigate('/shop/orders')}
              className="w-full px-4 py-3.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-sm font-bold shadow-sm active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              View Orders <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={downloadReceipt}
              className="w-full px-4 py-3.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-sm font-bold shadow-sm active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              <FileText className="w-4 h-4 text-slate-400" /> Download Receipt
            </button>
            <button
              onClick={() => navigate('/shop/products')}
              className="w-full px-4 py-3 bg-transparent text-slate-500 hover:text-slate-800 rounded-xl text-sm font-bold transition-all mt-2"
            >
              Continue Shopping
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ─────────────────────────────────────────────
     EMPTY CART STATE
  ───────────────────────────────────────────── */
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] px-6">
        <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-5">
          <ShoppingCart className="w-10 h-10 text-slate-300" />
        </div>
        <p className="text-slate-900 font-bold text-lg mb-1">Your cart is empty</p>
        <p className="text-slate-500 text-sm mb-6">Looks like you haven't added anything yet.</p>
        <button
          onClick={() => navigate('/shop/products')}
          className="px-6 py-3.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-sm font-bold shadow-sm active:scale-95 transition-all flex items-center gap-2"
        >
          <ShoppingBag className="w-4 h-4" /> Browse Products
        </button>
      </div>
    );
  }

  if (isProfileLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] text-slate-500 font-medium">
        Loading checkout details...
      </div>
    );
  }

  /* ─────────────────────────────────────────────
     CHECKOUT VIEW
  ───────────────────────────────────────────── */
  return (
    <div className="animate-fade-in pb-32 min-h-screen">
      
      {/* Page Header */}
      <div className="px-4 lg:px-0 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Checkout</h1>
            <p className="text-sm text-slate-500 mt-1">Review your items and confirm the order</p>
          </div>
          <div className="text-right hidden sm:block">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{items.length} Items</p>
            <p className="text-lg font-black text-orange-600">{formatCurrency(finalAmount)}</p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-4 lg:px-0">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left Column: Order Items */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-6 py-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                <h2 className="font-bold text-slate-900">Order Items</h2>
                <span className="text-xs font-bold px-3 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-lg shadow-sm">
                  {items.length} Items
                </span>
              </div>

              <div className="divide-y divide-slate-100 p-2">
                {items.map((item, itemIdx) => {
                  const rate = item.unitPrice;
                  const qty = item.quantity;
                  const discPct = item.discountPercent || 0;
                  
                  const baseAmount = rate * qty;
                  const lineTaxRate = taxCodeToRate(item.taxCode) || (item.taxRate ?? 0);
                  const allIncRate = item.allIncPrice || Math.round(rate * (1 + lineTaxRate) * 100) / 100;
                  const rowDiscountAmount = isNonTaxCustomer ? allIncRate * qty * (discPct / 100) : baseAmount * (discPct / 100);
                  const displayRate = isNonTaxCustomer ? allIncRate : rate;
                  
                  // Display Total for each item
                  const displayTotal = isNonTaxCustomer ? allIncRate * qty : baseAmount;

                  return (
                    <div key={item.productId} className="px-4 py-3.5 flex items-center justify-between gap-4 hover:bg-orange-50/30 rounded-xl transition">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center flex-shrink-0 shadow-sm">
                          <span className="text-xs font-black text-white">{itemIdx + 1}</span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-slate-900 truncate">{item.productName}</p>
                          <p className="text-xs font-medium text-slate-500 mt-1 flex gap-2">
                            <span>Qty {item.quantity}</span>
                            <span>×</span>
                            <span>{formatCurrency(displayRate)}</span>
                            {item.discountPercent ? (
                              <span className="text-orange-500 font-bold ml-1">({item.discountPercent}% OFF)</span>
                            ) : null}
                          </p>
                        </div>
                      </div>
                      <p className="text-sm font-black text-slate-900 whitespace-nowrap">
                        {formatCurrency(displayTotal)}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Column: Payment Summary */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 h-fit lg:sticky lg:top-24">
            <h3 className="text-base font-bold text-slate-900 mb-6">Order Summary</h3>

            <div className="space-y-4">
              <div className="flex justify-between items-center text-sm font-bold text-slate-500">
                <span className="uppercase tracking-widest text-xs">Gross Amount</span>
                <span className="text-slate-800">{formatCurrency(totalGrossAmount)}</span>
              </div>

              <div className="flex justify-between items-center text-sm font-bold pb-5 border-b border-slate-100">
                <span className="uppercase tracking-widest text-xs text-orange-500">Discount Amount</span>
                <span className="text-orange-500">-{formatCurrency(totalDiscountAmount)}</span>
              </div>

              {!isNonTaxCustomer && (
                <>
                  <div className="flex justify-between items-center text-sm font-bold text-slate-500">
                    <span className="uppercase tracking-widest text-xs">Net Amount</span>
                    <span className="text-slate-800">{formatCurrency(netAmount)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm font-bold pb-5 border-b border-slate-100">
                    <span className="uppercase tracking-widest text-xs text-slate-500">Total Tax Amount</span>
                    <span className="text-slate-800">{formatCurrency(totalTaxAmount)}</span>
                  </div>
                </>
              )}

              <div className="flex justify-between items-center pt-1">
                <span className="text-sm font-black text-orange-700 uppercase tracking-widest">Total Invoice Value</span>
                <span className="text-2xl font-black text-orange-700">{formatCurrency(finalAmount)}</span>
              </div>
            </div>

            <div className="mt-8 rounded-2xl bg-slate-50 border border-slate-100 p-4 text-xs font-medium text-slate-500 flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 flex-shrink-0 text-slate-400" />
              <p className="leading-relaxed">Your order will be submitted securely and then reviewed for approval by our team.</p>
            </div>

            <button
              onClick={() => placeOrderMut.mutate()}
              disabled={placeOrderMut.isPending}
              className="mt-6 w-full bg-orange-600 hover:bg-orange-700 text-white py-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-md shadow-orange-600/20 active:scale-[0.98] transition-all disabled:opacity-60"
            >
              {placeOrderMut.isPending ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</>
              ) : (
                <>Place Order • {formatCurrency(finalAmount)}</>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Sticky Button */}
      <div className="fixed bottom-[4.5rem] left-0 right-0 bg-white border-t border-slate-200 p-4 z-40 pb-safe lg:hidden">
        <button
          onClick={() => placeOrderMut.mutate()}
          disabled={placeOrderMut.isPending}
          className="w-full bg-orange-600 hover:bg-orange-700 text-white py-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-md shadow-orange-600/20 active:scale-[0.98] transition-all disabled:opacity-60"
        >
          {placeOrderMut.isPending ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</>
          ) : (
            <>Place Order • {formatCurrency(finalAmount)}</>
          )}
        </button>
      </div>
    </div>
  );
}