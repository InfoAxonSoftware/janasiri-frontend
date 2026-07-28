import { useQuery } from '@tanstack/react-query';
import { coordinatorGetDashboard } from '../../services/api/coordinatorApi';
import { formatCurrency, formatRelative } from '../../utils/formatters';
import {
  Users, UserCheck, FileText, TrendingUp, ShoppingCart,
  CalendarDays, ArrowUpRight, AlertTriangle, Shield, ChevronRight
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function CoordinatorDashboard() {
  const navigate = useNavigate();

  const { data, isLoading, error } = useQuery({
    queryKey: ['coordinator-dashboard'],
    queryFn: coordinatorGetDashboard,
    refetchInterval: 30000,
  });

  if (isLoading) return <DashboardSkeleton />;
  if (error || !data) return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="text-center">
        <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-8 h-8 text-red-400" />
        </div>
        <p className="text-slate-600 font-medium">Failed to load dashboard</p>
        <p className="text-sm text-slate-400 mt-1">Please try refreshing the page</p>
      </div>
    </div>
  );

  const cards = [
    { label: 'Team Members', value: data.totalReps, icon: Users, gradient: 'from-cyan-500 to-blue-600', shadow: 'shadow-cyan-500/20' },
    { label: 'Customers', value: data.totalCustomers, icon: UserCheck, gradient: 'from-emerald-500 to-teal-600', shadow: 'shadow-emerald-500/20' },
    { label: 'Pending Approvals', value: data.pendingCustomerApprovals, icon: UserCheck, gradient: 'from-amber-500 to-orange-500', shadow: 'shadow-amber-500/20' },
    { label: 'Pending Quotations', value: data.pendingQuotations, icon: FileText, gradient: 'from-violet-500 to-purple-600', shadow: 'shadow-violet-500/20' },
    { label: 'Monthly Sales', value: formatCurrency(data.totalSalesThisMonth), icon: TrendingUp, gradient: 'from-indigo-500 to-blue-600', shadow: 'shadow-indigo-500/20' },
    { label: 'Monthly Orders', value: data.totalOrdersThisMonth, icon: ShoppingCart, gradient: 'from-rose-500 to-pink-600', shadow: 'shadow-rose-500/20' },
  ];

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-500 text-sm mt-0.5">Overview of your region&apos;s activity.</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-500 bg-white px-3 py-2 rounded-xl border border-slate-200 w-fit">
          <CalendarDays className="w-4 h-4" />
          <span>{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4 stagger-children">
        {cards.map((card) => (
          <div key={card.label} className="card card-hover p-4 group">
            <div className="flex items-center justify-between mb-3">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${card.gradient} flex items-center justify-center shadow-lg ${card.shadow} group-hover:scale-110 transition-transform`}>
                <card.icon className="w-5 h-5 text-white" />
              </div>
              <ArrowUpRight className="w-4 h-4 text-slate-300" />
            </div>
            <p className="text-xl lg:text-2xl font-bold text-slate-900">{card.value}</p>
            <p className="text-xs text-slate-500 mt-1 font-medium">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => navigate('/coordinator/approvals')} className="card p-4 text-left group active:scale-[0.97] hover:shadow-md hover:border-slate-200 transition-all">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/20 mb-3 group-hover:scale-110 transition-transform">
            <UserCheck className="w-5 h-5 text-white" />
          </div>
          <p className="font-semibold text-sm text-slate-800">Review Approvals</p>
          <p className="text-[11px] text-slate-400 mt-0.5">{data.pendingCustomerApprovals} pending</p>
        </button>
        <button onClick={() => navigate('/coordinator/quotations')} className="card p-4 text-left group active:scale-[0.97] hover:shadow-md hover:border-slate-200 transition-all">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/20 mb-3 group-hover:scale-110 transition-transform">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <p className="font-semibold text-sm text-slate-800">Review Quotations</p>
          <p className="text-[11px] text-slate-400 mt-0.5">{data.pendingQuotations} pending</p>
        </button>
      </div>

      <div className="lg:grid lg:grid-cols-2 lg:gap-6 space-y-4 lg:space-y-0">
        {/* Pending Approvals */}
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between p-4 pb-3">
            <h2 className="text-sm font-bold text-slate-800">Recent Pending Approvals</h2>
            <button onClick={() => navigate('/coordinator/approvals')} className="text-xs text-cyan-600 font-semibold flex items-center gap-0.5">
              View all <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          {data.recentPendingApprovals.length > 0 ? (
            <div className="divide-y divide-slate-50">
              {data.recentPendingApprovals.slice(0, 5).map((item) => (
                <div key={item.customerId} onClick={() => navigate('/coordinator/approvals')} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50/50 transition cursor-pointer">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-amber-700 font-bold text-sm">{item.shopName[0]}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{item.shopName}</p>
                      <p className="text-[11px] text-slate-400">{item.repName ? `By ${item.repName}` : ''} {item.city ? `• ${item.city}` : ''}</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600">Pending</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-4 pb-4">
              <div className="bg-slate-50 rounded-xl p-6 text-center">
                <UserCheck className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-400">No pending approvals</p>
              </div>
            </div>
          )}
        </div>

        {/* Pending Quotations */}
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between p-4 pb-3">
            <h2 className="text-sm font-bold text-slate-800">Recent Pending Quotations</h2>
            <button onClick={() => navigate('/coordinator/quotations')} className="text-xs text-cyan-600 font-semibold flex items-center gap-0.5">
              View all <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          {data.recentPendingQuotations.length > 0 ? (
            <div className="divide-y divide-slate-50">
              {data.recentPendingQuotations.slice(0, 5).map((item) => (
                <div key={item.quotationId} onClick={() => navigate('/coordinator/quotations')} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50/50 transition cursor-pointer">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-100 to-purple-100 flex items-center justify-center flex-shrink-0">
                      <FileText className="w-4 h-4 text-violet-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{item.quotationNumber}</p>
                      <p className="text-[11px] text-slate-400">{item.customerName} {item.repName ? `• ${item.repName}` : ''}</p>
                    </div>
                  </div>
                  <p className="text-sm font-bold text-slate-800 ml-3">{formatCurrency(item.totalAmount)}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-4 pb-4">
              <div className="bg-slate-50 rounded-xl p-6 text-center">
                <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-400">No pending quotations</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div><div className="skeleton h-8 w-48 mb-2" /><div className="skeleton h-4 w-72" /></div>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="card p-4"><div className="skeleton w-10 h-10 rounded-xl mb-3" /><div className="skeleton h-7 w-20 mb-2" /><div className="skeleton h-3 w-16" /></div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-6"><div className="skeleton h-48 rounded-xl" /></div>
        <div className="card p-6"><div className="skeleton h-48 rounded-xl" /></div>
      </div>
    </div>
  );
}
