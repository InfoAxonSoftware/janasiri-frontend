import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { reportsApi } from '../../services/api/reportsApi';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { BarChart3, DollarSign, ShoppingCart, TrendingUp, TrendingDown, Users, UserMinus } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

type Tab = 'sales' | 'products' | 'customers' | 'payments';

export default function AdminReports() {
  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [from, setFrom] = useState(thirtyDaysAgo.toISOString().split('T')[0]);
  const [to, setTo] = useState(today.toISOString().split('T')[0]);
  const [groupBy, setGroupBy] = useState('day');
  const [tab, setTab] = useState<Tab>('sales');

  const { data: salesReport, isLoading } = useQuery({ queryKey: ['sales-report', from, to, groupBy], queryFn: () => reportsApi.getSalesReport(from, to, groupBy).then(r => r.data.data), enabled: !!from && !!to });
  const { data: bestSelling } = useQuery({ queryKey: ['best-selling'], queryFn: () => reportsApi.getBestSelling({ top: 10 }).then(r => r.data.data) });
  const { data: slowMoving } = useQuery({ queryKey: ['slow-moving'], queryFn: () => reportsApi.getSlowMoving({ top: 10 }).then(r => r.data.data), enabled: tab === 'products' });
  const { data: customerActivity } = useQuery({ queryKey: ['customer-activity'], queryFn: () => reportsApi.getCustomerActivity().then(r => r.data.data), enabled: tab === 'customers' });
  const { data: lostCustomers } = useQuery({ queryKey: ['lost-customers'], queryFn: () => reportsApi.getLostCustomers().then(r => r.data.data), enabled: tab === 'customers' });
  const { data: outstanding } = useQuery({ queryKey: ['outstanding-payments'], queryFn: () => reportsApi.getOutstandingPayments().then(r => r.data.data) });

  return (
    <div className="animate-fade-in space-y-6">
      <div><h1 className="text-2xl font-bold text-slate-900">Reports</h1><p className="text-slate-500 text-sm mt-1">Sales analytics and business insights</p></div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {([['sales', 'Sales', BarChart3], ['products', 'Products', TrendingUp], ['customers', 'Customers', Users], ['payments', 'Payments', DollarSign]] as [Tab, string, typeof BarChart3][]).map(([key, label, Icon]) => (
          <button key={key} onClick={() => setTab(key)} className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition ${tab === key ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      {/* Sales Tab */}
      {tab === 'sales' && (<>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div><label className="block text-xs font-medium text-slate-600 mb-1">From</label><input type="date" value={from} onChange={e => setFrom(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none" /></div>
            <div><label className="block text-xs font-medium text-slate-600 mb-1">To</label><input type="date" value={to} onChange={e => setTo(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none" /></div>
            <div><label className="block text-xs font-medium text-slate-600 mb-1">Group By</label><select value={groupBy} onChange={e => setGroupBy(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none bg-white"><option value="day">Day</option><option value="week">Week</option><option value="month">Month</option></select></div>
          </div>
        </div>
        {salesReport && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-5"><div className="flex items-center gap-3"><span className="p-2 bg-indigo-50 rounded-lg"><DollarSign className="w-5 h-5 text-indigo-600" /></span><div><p className="text-sm text-slate-500">Total Sales</p><p className="text-xl font-bold text-slate-900">{formatCurrency(salesReport.totalSales)}</p></div></div></div>
            <div className="bg-white rounded-xl border border-slate-200 p-5"><div className="flex items-center gap-3"><span className="p-2 bg-emerald-50 rounded-lg"><ShoppingCart className="w-5 h-5 text-emerald-600" /></span><div><p className="text-sm text-slate-500">Total Orders</p><p className="text-xl font-bold text-slate-900">{salesReport.totalOrders}</p></div></div></div>
            <div className="bg-white rounded-xl border border-slate-200 p-5"><div className="flex items-center gap-3"><span className="p-2 bg-purple-50 rounded-lg"><TrendingUp className="w-5 h-5 text-purple-600" /></span><div><p className="text-sm text-slate-500">Avg Order Value</p><p className="text-xl font-bold text-slate-900">{formatCurrency(salesReport.averageOrderValue)}</p></div></div></div>
          </div>
        )}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="font-semibold text-slate-900 mb-4">Sales Breakdown</h3>
          {isLoading ? <div className="h-64 flex items-center justify-center text-slate-500">Loading...</div> : salesReport?.dailyBreakdown?.length ? (
            <ResponsiveContainer width="100%" height={300}><BarChart data={salesReport.dailyBreakdown}><CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" /><XAxis dataKey="period" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} /><Tooltip formatter={v => formatCurrency(Number(v))} /><Bar dataKey="amount" fill="#3b82f6" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer>
          ) : <div className="h-64 flex items-center justify-center text-slate-400">No data</div>}
        </div>
      </>)}

      {/* Products Tab */}
      {tab === 'products' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2"><TrendingUp className="w-5 h-5 text-emerald-500" /> Best Selling Products</h3>
            {bestSelling && Array.isArray(bestSelling) && bestSelling.length > 0 ? (
              <div className="space-y-3">{bestSelling.slice(0, 10).map((item: any, i: number) => (
                <div key={i} className="flex items-center gap-3"><span className="w-6 h-6 bg-indigo-50 text-indigo-700 rounded text-xs font-bold flex items-center justify-center">{i + 1}</span><span className="flex-1 text-sm text-slate-700 truncate">{item.productName || item.name}</span><span className="text-sm font-medium">{formatCurrency(item.revenue || item.totalRevenue || 0)}</span></div>
              ))}</div>
            ) : <p className="text-slate-400 text-sm">No data available</p>}
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2"><TrendingDown className="w-5 h-5 text-red-500" /> Slow Moving Products</h3>
            {slowMoving && Array.isArray(slowMoving) && slowMoving.length > 0 ? (
              <div className="space-y-3">{slowMoving.slice(0, 10).map((item: any, i: number) => (
                <div key={i} className="flex items-center gap-3"><span className="w-6 h-6 bg-red-50 text-red-700 rounded text-xs font-bold flex items-center justify-center">{i + 1}</span><span className="flex-1 text-sm text-slate-700 truncate">{item.productName || item.name}</span><span className="text-xs text-slate-500">{item.quantitySold || 0} sold • Stock: {item.stockQuantity || 0}</span></div>
              ))}</div>
            ) : <p className="text-slate-400 text-sm">No data available</p>}
          </div>
        </div>
      )}

      {/* Customers Tab */}
      {tab === 'customers' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2"><Users className="w-5 h-5 text-blue-500" /> Customer Activity</h3>
            {customerActivity && Array.isArray(customerActivity) && customerActivity.length > 0 ? (
              <div className="space-y-3">{customerActivity.slice(0, 15).map((item: any, i: number) => (
                <div key={i} className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50">
                  <div><p className="text-sm font-medium text-slate-900">{item.customerName || item.shopName || 'Customer'}</p><p className="text-xs text-slate-500">{item.totalOrders || 0} orders &bull; Last: {item.lastOrderDate ? formatDate(item.lastOrderDate) : 'N/A'}</p></div>
                  <span className="text-sm font-semibold text-slate-900">{formatCurrency(item.totalSpent || item.totalRevenue || 0)}</span>
                </div>
              ))}</div>
            ) : <p className="text-slate-400 text-sm">No data available</p>}
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2"><UserMinus className="w-5 h-5 text-red-500" /> Lost Customers</h3>
            {lostCustomers && Array.isArray(lostCustomers) && lostCustomers.length > 0 ? (
              <div className="space-y-3">{lostCustomers.slice(0, 15).map((item: any, i: number) => (
                <div key={i} className="flex items-center justify-between p-2 rounded-lg hover:bg-red-50/30">
                  <div><p className="text-sm font-medium text-slate-900">{item.customerName || item.shopName || 'Customer'}</p><p className="text-xs text-slate-500">Last order: {item.lastOrderDate ? formatDate(item.lastOrderDate) : 'N/A'}</p></div>
                  <span className="text-xs font-medium px-2 py-0.5 bg-red-100 text-red-700 rounded-full">{item.daysSinceLastOrder || 0} days inactive</span>
                </div>
              ))}</div>
            ) : <p className="text-slate-400 text-sm">No lost customers — great!</p>}
          </div>
        </div>
      )}

      {/* Payments Tab */}
      {tab === 'payments' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="font-semibold text-slate-900 mb-4">Outstanding Payments</h3>
          {outstanding && Array.isArray(outstanding) && outstanding.length > 0 ? (
            <div className="space-y-3">{outstanding.map((item: any, i: number) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition">
                <div><p className="text-sm font-medium text-slate-900">{item.customerName || item.shopName || 'Customer'}</p><p className="text-xs text-slate-500">Due since: {item.oldestDueDate ? formatDate(item.oldestDueDate) : 'N/A'}</p></div>
                <span className="text-sm font-bold text-red-600">{formatCurrency(item.amount || item.outstanding || 0)}</span>
              </div>
            ))}</div>
          ) : <p className="text-slate-400 text-sm">No outstanding payments</p>}
        </div>
      )}
    </div>
  );
}
