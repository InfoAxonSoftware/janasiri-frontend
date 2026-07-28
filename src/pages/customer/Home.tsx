import { useQuery } from '@tanstack/react-query';
import { productsApi } from '../../services/api/productsApi';
import { ordersApi } from '../../services/api/ordersApi';
import { offersApi } from '../../services/api/offersApi';
import { customersApi } from '../../services/api/customersApi';
import { formatCurrency, formatDate } from '../../utils/formatters';
import {
  ShoppingBag, Clock, ChevronRight, Package, Sparkles, ArrowRight,
  TrendingUp, HeadphonesIcon, CheckCircle2, Receipt, Gift, FileText,
  Truck, AlertCircle, Zap, Star,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useDispatch } from 'react-redux';
import { addToCart } from '../../store/slices/cartSlice';
import type { Product } from '../../types/product.types';
import type { Order } from '../../types/order.types';
import type { SpecialOffer } from '../../types/offer.types';
import { useMemo } from 'react';

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  Pending:    { label: 'Pending',    bg: 'bg-amber-50',   text: 'text-amber-700',   dot: 'bg-amber-400' },
  Processing: { label: 'Processing', bg: 'bg-blue-50',    text: 'text-blue-700',    dot: 'bg-blue-400' },
  Shipped:    { label: 'Shipped',    bg: 'bg-purple-50',  text: 'text-purple-700',  dot: 'bg-purple-400' },
  Delivered:  { label: 'Delivered',  bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-400' },
  Cancelled:  { label: 'Cancelled',  bg: 'bg-red-50',     text: 'text-red-700',     dot: 'bg-red-400' },
};

const OFFER_GRADIENTS = [
  { card: 'from-orange-500 to-amber-500',  accent: 'text-orange-100' },
  { card: 'from-amber-500 to-orange-600',  accent: 'text-amber-100'  },
  { card: 'from-rose-500 to-orange-500',   accent: 'text-rose-100'   },
  { card: 'from-orange-600 to-rose-600',   accent: 'text-orange-100' },
  { card: 'from-amber-600 to-orange-700',  accent: 'text-amber-100'  },
  { card: 'from-orange-400 to-amber-600',  accent: 'text-orange-50'  },
];

export default function CustomerHome() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const dispatch = useDispatch();

  const { data: popular, isLoading: popularLoading } = useQuery({
    queryKey: ['customer-popular'],
    queryFn: () => productsApi.customerTopSelling({ top: 8 }).then(r => r.data.data),
  });

  const { data: recentOrders, isLoading: ordersLoading } = useQuery({
    queryKey: ['customer-recent-orders'],
    queryFn: () => ordersApi.customerGetAll({ page: 1, pageSize: 5 }).then(r => r.data.data),
  });

  const { data: specialOffers = [] } = useQuery({
    queryKey: ['special-offers-public'],
    queryFn: () => offersApi.getPublic().then(r => r.data.data || []),
  });

  const { data: customerProfile } = useQuery({
    queryKey: ['customer-profile-home-tax-mode'],
    queryFn: () => customersApi.customerGetProfile().then(r => r.data.data),
    staleTime: 5 * 60 * 1000,
  });
  const isNonTaxCustomer =
    (customerProfile?.customerType || '').toLowerCase().replace(/[-\s]/g, '') === 'nontax';

  const stats = useMemo(() => {
    const total = recentOrders?.totalCount || 0;
    const pending = (recentOrders?.items || []).filter(
      (o: Order) => o.status === 'Pending' || o.status === 'Processing',
    ).length;
    const delivered = (recentOrders?.items || []).filter((o: Order) => o.status === 'Delivered').length;
    return { total, pending, delivered };
  }, [recentOrders]);

  const handleQuickAdd = (product: Product) => {
    dispatch(addToCart({
      productId: product.id,
      productName: product.name,
      unitPrice: product.sellingPrice,
      quantity: 1,
      sku: product.sku,
      lineTotal: (product.sellingPrice || 0) * 1,
    }));
  };

  const quickActions = [
    { icon: ShoppingBag,    label: 'Shop',       sub: 'Browse products', to: '/shop/products',   gradient: 'from-orange-500 to-amber-500'  },
    { icon: Receipt,        label: 'My Orders',  sub: 'Track & manage',  to: '/shop/orders',     gradient: 'from-orange-600 to-rose-500'   },
    { icon: FileText,       label: 'Quotations', sub: 'View quotes',     to: '/shop/quotations', gradient: 'from-amber-500 to-orange-600'  },
    { icon: HeadphonesIcon, label: 'Support',    sub: 'Get help',        to: '/shop/support',    gradient: 'from-orange-400 to-amber-600'  },
  ];

  return (
    <div className="animate-fade-in pb-8 space-y-6">

      {/* HERO */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-orange-500 via-rose-500 to-pink-600 text-white">
        <div className="absolute -top-12 -right-12 w-64 h-64 rounded-full bg-white/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full bg-rose-400/20 blur-2xl pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-32 rounded-full bg-orange-400/10 blur-3xl pointer-events-none" />
        <div className="relative z-10 p-6 lg:p-8">
          <div className="lg:flex lg:items-center lg:justify-between gap-8">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4 text-orange-200 animate-pulse" />
                <span className="text-sm text-orange-100 font-medium">Welcome back</span>
              </div>
              <h1 className="text-3xl lg:text-4xl font-extrabold tracking-tight mb-2">
                Hi, {customerProfile?.shopName || user?.username || 'there'}! 👋
              </h1>
              <p className="text-orange-50/80 text-sm lg:text-base max-w-md mb-6">
                Discover fresh products, exclusive offers, and shop with ease.
              </p>
              <button
                onClick={() => navigate('/shop/products')}
                className="inline-flex items-center gap-2 bg-white text-orange-600 px-6 py-3 rounded-xl text-sm font-bold shadow-xl shadow-orange-900/25 hover:shadow-2xl hover:scale-105 active:scale-95 transition-all group"
              >
                <ShoppingBag className="w-4 h-4" />
                Start Shopping
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
            <div className="hidden lg:flex flex-col gap-3 min-w-[220px]">
              {[
                { icon: Receipt,      label: 'Total Orders', value: stats.total,     color: 'text-orange-200' },
                { icon: Clock,        label: 'Pending',      value: stats.pending,   color: 'text-amber-200'  },
                { icon: CheckCircle2, label: 'Delivered',    value: stats.delivered, color: 'text-emerald-200'},
              ].map(({ icon: Icon, label, value, color }) => (
                <div key={label} className="flex items-center gap-3 bg-white/15 backdrop-blur-sm border border-white/20 rounded-xl px-4 py-3">
                  <Icon className={`w-5 h-5 ${color} flex-shrink-0`} />
                  <div>
                    <p className="text-2xl font-extrabold text-white leading-none">{value}</p>
                    <p className="text-xs text-white/70 mt-0.5">{label}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Stats mobile */}
      <div className="grid grid-cols-3 gap-3 lg:hidden">
        {[
          { icon: Receipt,      label: 'Total Orders', value: stats.total,     from: 'from-orange-500', to: 'to-amber-500'    },
          { icon: Clock,        label: 'Pending',      value: stats.pending,   from: 'from-amber-500',  to: 'to-orange-500'   },
          { icon: CheckCircle2, label: 'Delivered',    value: stats.delivered, from: 'from-emerald-500',to: 'to-teal-500'     },
        ].map(({ icon: Icon, label, value, from, to }) => (
          <div key={label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
            <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${from} ${to} flex items-center justify-center mb-2 shadow-md`}>
              <Icon className="w-4 h-4 text-white" />
            </div>
            <p className="text-2xl font-extrabold text-slate-900">{value}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* SPECIAL OFFERS */}
      {(specialOffers as SpecialOffer[]).length > 0 && (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 shadow-2xl">
          <div className="absolute -top-16 -right-16 w-80 h-80 bg-rose-500/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-16 -left-16 w-72 h-72 bg-orange-500/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-32 bg-violet-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 flex items-center justify-between px-6 pt-6 pb-5 lg:px-8 lg:pt-8">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-rose-500 to-orange-500 flex items-center justify-center shadow-lg shadow-rose-500/40 flex-shrink-0">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-extrabold text-white tracking-tight">Special Offers</h2>
                <p className="text-xs text-slate-400 mt-0.5">Exclusive deals crafted just for you</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 bg-rose-500/20 border border-rose-500/30 rounded-full px-3 py-1.5">
              <Star className="w-3 h-3 text-rose-400" />
              <span className="text-xs font-bold text-rose-300">{(specialOffers as SpecialOffer[]).length} Active</span>
            </div>
          </div>
          <div className="relative z-10 px-6 pb-6 lg:px-8 lg:pb-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {(specialOffers as SpecialOffer[]).map((offer, idx) => {
                const g = OFFER_GRADIENTS[idx % OFFER_GRADIENTS.length];
                return (
                  <div
                    key={offer.id}
                    className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${g.card} p-5 hover:scale-[1.02] hover:shadow-2xl transition-all duration-200`}
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-white/15 via-transparent to-transparent pointer-events-none rounded-2xl" />
                    <div className="absolute -top-8 -right-8 w-28 h-28 rounded-full bg-white/10 blur-2xl pointer-events-none" />
                    <div className="relative z-10 flex flex-col gap-2.5">
                      <div className="inline-flex items-center gap-1.5 bg-white/20 backdrop-blur-sm rounded-full px-3 py-1 self-start">
                        <Gift className="w-3 h-3 text-white" />
                        <span className="text-[10px] font-bold uppercase tracking-wider text-white">Special Offer</span>
                      </div>
                      <p className="text-white font-extrabold text-[15px] leading-snug line-clamp-2">
                        {offer.productName}
                      </p>
                      <div className="w-8 h-0.5 bg-white/30 rounded-full" />
                      <p className={`text-[13px] leading-relaxed ${g.accent} line-clamp-3`}>
                        {offer.offerBrief}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* QUICK ACTIONS */}
      <div>
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Quick Access</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {quickActions.map((a) => (
            <button
              key={a.label}
              onClick={() => navigate(a.to)}
              className="group bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-lg hover:border-slate-200 hover:-translate-y-0.5 active:translate-y-0 transition-all p-5 text-left"
            >
              <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${a.gradient} flex items-center justify-center mb-3 shadow-md group-hover:scale-110 transition-transform`}>
                <a.icon className="w-5 h-5 text-white" />
              </div>
              <p className="text-sm font-bold text-slate-900">{a.label}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">{a.sub}</p>
            </button>
          ))}
        </div>
      </div>

      {/* MAIN GRID */}
      <div className="grid lg:grid-cols-3 gap-6">

        {/* Trending Products */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-orange-500" />
              Trending Products
            </h2>
            <button
              onClick={() => navigate('/shop/products')}
              className="text-xs text-orange-600 font-semibold flex items-center gap-0.5 hover:text-orange-700 transition"
            >
              View all <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          {popularLoading ? (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden divide-y divide-slate-50">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3">
                  <div className="w-7 h-7 bg-slate-100 rounded-lg skeleton flex-shrink-0" />
                  <div className="flex-1 h-3 bg-slate-100 rounded-full skeleton" />
                  <div className="w-16 h-3 bg-slate-100 rounded-full skeleton" />
                </div>
              ))}
            </div>
          ) : (popular as Product[] | undefined)?.length ? (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden divide-y divide-slate-50">
              {(popular as Product[]).slice(0, 8).map((product, idx) => (
                <div
                  key={product.id}
                  onClick={() => navigate(`/shop/products?search=${encodeURIComponent(product.name)}`)}
                  className="group flex items-center justify-between gap-3 px-4 py-3 hover:bg-orange-50/40 cursor-pointer transition-all"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-orange-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-[11px] font-black text-orange-500">{idx + 1}</span>
                    </div>
                    <p className="text-[13px] font-semibold text-slate-800 truncate group-hover:text-orange-700 transition">{product.name}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <p className="text-sm font-extrabold text-orange-600">{formatCurrency(isNonTaxCustomer ? (product.sellingPrice || 0) + (product.taxAmount || 0) : product.sellingPrice)}</p>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleQuickAdd(product); }}
                      className="w-7 h-7 rounded-lg bg-orange-500 hover:bg-orange-600 text-white flex items-center justify-center active:scale-90 transition-all shadow-sm"
                    >
                      <ShoppingBag className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
              <div className="px-4 py-2.5 bg-slate-50/80">
                <button onClick={() => navigate('/shop/products')} className="w-full text-xs text-orange-600 font-semibold flex items-center justify-center gap-1 hover:text-orange-700 transition">
                  View all products <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-14 bg-white rounded-2xl border border-dashed border-slate-200 text-slate-400 gap-3">
              <Package className="w-10 h-10 text-slate-200" />
              <p className="text-sm">No products available</p>
            </div>
          )}
        </div>

        {/* Recent Orders */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <Truck className="w-4 h-4 text-orange-500" />
              Recent Orders
            </h2>
            <button
              onClick={() => navigate('/shop/orders')}
              className="text-xs text-orange-600 font-semibold flex items-center gap-0.5 hover:text-orange-700 transition"
            >
              View all <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          {ordersLoading ? (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 py-2">
                  <div className="w-2 h-2 rounded-full bg-slate-100 skeleton flex-shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 bg-slate-100 rounded-full w-2/3 skeleton" />
                    <div className="h-2.5 bg-slate-100 rounded-full w-1/3 skeleton" />
                  </div>
                  <div className="h-5 bg-slate-100 rounded-full w-16 skeleton" />
                </div>
              ))}
            </div>
          ) : (recentOrders?.items || []).length > 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden divide-y divide-slate-50">
              {(recentOrders!.items as Order[]).map((order) => {
                const cfg = STATUS_CONFIG[order.status] ?? STATUS_CONFIG['Pending'];
                return (
                  <div
                    key={order.id}
                    onClick={() => navigate(`/shop/orders/${order.id}`)}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 cursor-pointer group transition"
                  >
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-slate-900 truncate">{order.orderNumber}</p>
                      <p className="text-[11px] text-slate-400">{formatDate(order.orderDate)}</p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span className={`text-[10px] px-2 py-0.5 rounded-lg font-bold ${cfg.bg} ${cfg.text}`}>
                        {cfg.label}
                      </span>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-orange-500 group-hover:translate-x-0.5 transition-all" />
                    </div>
                  </div>
                );
              })}
              <div className="px-4 py-2.5 bg-slate-50/80">
                <button
                  onClick={() => navigate('/shop/orders')}
                  className="w-full text-xs text-orange-600 font-semibold flex items-center justify-center gap-1 hover:text-orange-700 transition"
                >
                  All orders <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 bg-white rounded-2xl border border-dashed border-slate-200 gap-2">
              <AlertCircle className="w-8 h-8 text-slate-200" />
              <p className="text-sm text-slate-400 font-medium">No orders yet</p>
              <button
                onClick={() => navigate('/shop/products')}
                className="text-xs text-orange-600 font-semibold hover:text-orange-700 transition"
              >
                Place your first order
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
