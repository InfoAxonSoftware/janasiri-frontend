import { useQuery } from '@tanstack/react-query';
import { reportsApi } from '../../services/api/reportsApi';
import { repsApi } from '../../services/api/repsApi';
import {
  DollarSign, ShoppingCart, Package, Users, AlertTriangle,
  TrendingUp, UserCheck, CreditCard, ArrowUpRight, ArrowDownRight, CalendarDays,
  FileText
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Area, AreaChart } from 'recharts';
import { formatCurrency } from '../../utils/formatters';

export default function AdminDashboard() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: () => reportsApi.getDashboard().then(r => r.data.data),
    refetchInterval: 30000,
  });

  const { data: routeProgress } = useQuery({
    queryKey: ['admin-route-progress'],
    queryFn: () => repsApi.adminGetRouteProgress().then(r => r.data.data),
    refetchInterval: 60000,
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
    { label: 'Monthly Sales', value: formatCurrency(data.totalSalesMonth), icon: DollarSign, gradient: 'from-indigo-500 to-purple-600', shadow: 'shadow-indigo-500/20' },
    { label: 'Total Orders', value: data.totalOrders, icon: ShoppingCart, gradient: 'from-emerald-500 to-teal-600', shadow: 'shadow-emerald-500/20' },
    { label: 'Pending Orders', value: data.pendingOrders, icon: AlertTriangle, gradient: 'from-amber-500 to-orange-500', shadow: 'shadow-amber-500/20' },
    { label: 'Total Products', value: data.totalProducts, icon: Package, gradient: 'from-blue-500 to-cyan-500', shadow: 'shadow-blue-500/20' },
    { label: 'Total Quotations', value: data.totalQuotations, icon: FileText, gradient: 'from-indigo-500 to-blue-500', shadow: 'shadow-indigo-500/20' },
    { label: 'Pending Quotations', value: data.pendingQuotations, icon: AlertTriangle, gradient: 'from-yellow-500 to-orange-500', shadow: 'shadow-yellow-500/20' },
    { label: 'Customers', value: data.totalCustomers, icon: Users, gradient: 'from-violet-500 to-purple-600', shadow: 'shadow-violet-500/20' },
    { label: 'Active Reps', value: data.activeReps, icon: UserCheck, gradient: 'from-teal-500 to-green-500', shadow: 'shadow-teal-500/20' },
  ];

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-500 text-sm mt-0.5">Welcome back! Here&apos;s your business overview.</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-500 bg-white px-3 py-2 rounded-xl border border-slate-200 w-fit">
          <CalendarDays className="w-4 h-4" />
          <span>{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 stagger-children">
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

      {/* Route progress widget */}
      {routeProgress && routeProgress.length > 0 && (
        <div className="card p-4">
          <h3 className="font-semibold text-slate-900 mb-2">Rep Route Strike Rate (today)</h3>
          <div className="space-y-3">
            {routeProgress.map(p => (
              <div key={p.repId} className="flex items-center gap-2">
                <span className="text-xs w-24 truncate">{p.repName}</span>
                <div className="flex-1 h-2 bg-slate-100 rounded overflow-hidden">
                  <div className="h-full bg-emerald-500" style={{ width: `${Math.round(p.strikeRate * 100)}%` }} />
                </div>
                <span className="text-xs w-8 text-right">{Math.round(p.strikeRate * 100)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
        {/* Sales Trend */}
        <div className="card p-5 lg:p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-semibold text-slate-900">Sales Trend</h3>
              <p className="text-xs text-slate-400 mt-0.5">Last 7 days performance</p>
            </div>
            <div className="flex items-center gap-1.5 text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg text-xs font-medium">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Active</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={data.salesTrend}>
              <defs>
                <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip
                formatter={(value) => formatCurrency(Number(value))}
                contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', fontSize: '13px' }}
              />
              <Area type="monotone" dataKey="amount" stroke="#6366f1" strokeWidth={2.5} fill="url(#salesGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Top Products */}
        <div className="card p-5 lg:p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-semibold text-slate-900">Top Products</h3>
              <p className="text-xs text-slate-400 mt-0.5">Best performers by revenue</p>
            </div>
          </div>
          {data.topProducts.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-slate-400 text-sm">No product data yet</div>
          ) : (
            <div className="space-y-4">
              {data.topProducts.map((product, index) => (
                <div key={product.productId} className="flex items-center gap-3.5 group">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                    index === 0 ? 'bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-lg shadow-amber-500/20' :
                    index === 1 ? 'bg-gradient-to-br from-slate-300 to-slate-400 text-white' :
                    index === 2 ? 'bg-gradient-to-br from-amber-600 to-amber-700 text-white' :
                    'bg-slate-100 text-slate-500'
                  }`}>
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{product.productName}</p>
                    <p className="text-xs text-slate-400">{product.quantitySold} units sold</p>
                  </div>
                  <span className="text-sm font-semibold text-slate-900">{formatCurrency(product.revenue)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Order Volume Chart */}
      <div className="card p-5 lg:p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="font-semibold text-slate-900">Order Volume</h3>
            <p className="text-xs text-slate-400 mt-0.5">Daily order count - last 7 days</p>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data.salesTrend} barSize={32}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', fontSize: '13px' }} />
            <Bar dataKey="orderCount" fill="#8b5cf6" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <div className="skeleton h-8 w-48 mb-2" />
        <div className="skeleton h-4 w-72" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="card p-4">
            <div className="skeleton w-10 h-10 rounded-xl mb-3" />
            <div className="skeleton h-7 w-20 mb-2" />
            <div className="skeleton h-3 w-16" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-6"><div className="skeleton h-64 rounded-xl" /></div>
        <div className="card p-6"><div className="skeleton h-64 rounded-xl" /></div>
      </div>
    </div>
  );
}
