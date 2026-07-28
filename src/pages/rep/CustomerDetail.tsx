import { useQuery } from '@tanstack/react-query';
import { customersApi } from '../../services/api/customersApi';
import { useParams, useNavigate } from 'react-router-dom';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { ArrowLeft, Store, MapPin, Calendar, TrendingUp, ShoppingBag, DollarSign } from 'lucide-react';

export default function RepCustomerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: summary, isLoading } = useQuery({
    queryKey: ['rep-customer-summary', id],
    queryFn: () => customersApi.repGetSummary(id!).then(r => r.data.data),
    enabled: !!id,
  });

  const customer = summary?.customer;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-slate-200 rounded skeleton" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => <div key={i} className="h-64 bg-slate-100 rounded-xl skeleton" />)}
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="text-center py-16">
        <p className="text-slate-500">Customer not found</p>
        <button onClick={() => navigate('/rep/customers')} className="btn-secondary mt-4">
          Back to Customers
        </button>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6 pb-6">
      {/* Header (green, reduced height, lower z-index) */}
      <div className="bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-500 px-5 pt-6 lg:pt-4 pb-12 relative overflow-hidden -mx-4 -mt-4 z-0">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4" />
        {typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches && (
          <button onClick={() => navigate('/rep/customers')} className="text-white mb-3 flex items-center gap-2 hover:opacity-80 transition">
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm">Back</span>
          </button>
        )}
        <h1 className="text-white text-xl font-bold ml-3 mt-2 lg:mt-0">{customer.shopName}</h1>
        <p className="text-emerald-200 text-sm mt-2 lg:mt-0.5 ml-3">Customer Details</p>
      </div>

      <div className="px-4 -mt-8 space-y-4 relative z-10">
        {/* Customer Info */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 space-y-4">
          <h2 className="font-bold text-slate-900 flex items-center gap-2 text-sm">
            <Store className="w-4 h-4 text-emerald-500" />
            Basic Information
          </h2>
          <div className="space-y-3">
            <div>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Shop Name</p>
              <p className="text-sm font-semibold text-slate-900">{customer.shopName}</p>
            </div>
            {customer.city && (
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Location</p>
                <p className="text-sm text-slate-700 flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {[customer.street, customer.city, customer.state].filter(Boolean).join(', ')}
                </p>
              </div>
            )}
            {customer.regionName && (
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Region</p>
                <span className="inline-block px-2 py-1 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded">
                  {customer.regionName}
                </span>
              </div>
            )}
            <div>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Joined</p>
              <p className="text-sm text-slate-700 flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {formatDate(customer.createdAt)}
              </p>
            </div>
          </div>
        </div>

        {/* Region & Rep Info */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 space-y-4">
          <h2 className="font-bold text-slate-900 flex items-center gap-2 text-sm">
            <MapPin className="w-4 h-4 text-emerald-500" />
            Assignment Details
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-slate-50 rounded-xl">
              <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Region</p>
              <p className="text-sm font-bold text-slate-900">{customer.regionName || '—'}</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl">
              <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Sub-Region</p>
              <p className="text-sm font-bold text-slate-900">{customer.subRegionName || '—'}</p>
            </div>
          </div>
        </div>

        {/* Statistics */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 space-y-4">
          <h2 className="font-bold text-slate-900 flex items-center gap-2 text-sm">
            <TrendingUp className="w-4 h-4 text-emerald-500" />
            Order Statistics
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3.5 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl">
              <div className="flex items-center gap-1.5 mb-1.5">
                <ShoppingBag className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-[10px] text-emerald-600 font-medium uppercase">Orders</span>
              </div>
              <p className="text-2xl font-bold text-emerald-900">{summary.totalOrders}</p>
            </div>
            <div className="p-3.5 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl">
              <div className="flex items-center gap-1.5 mb-1.5">
                <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-[10px] text-emerald-600 font-medium uppercase">Purchases</span>
              </div>
              <p className="text-2xl font-bold text-emerald-900">{formatCurrency(summary.totalPurchases)}</p>
            </div>
          </div>
          <div className="p-3.5 bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl">
            <div className="flex items-center gap-1.5 mb-1.5">
              <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
              <span className="text-[10px] text-emerald-600 font-medium uppercase">Total Purchases</span>
            </div>
            <p className="text-2xl font-bold text-emerald-900">{formatCurrency(summary.totalPurchases)}</p>
          </div>
          {summary.lastOrderDate && (
            <div className="pt-2">
              <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Last Order</p>
              <p className="text-sm text-slate-700">{formatDate(summary.lastOrderDate)}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
