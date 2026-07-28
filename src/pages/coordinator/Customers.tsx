import { useQuery } from '@tanstack/react-query';
import { coordinatorGetCustomers } from '../../services/api/coordinatorApi';
import { formatCurrency } from '../../utils/formatters';
import { Users, MapPin, Search, Store } from 'lucide-react';
import { useState } from 'react';
import { useIsDesktop } from '../../hooks/useMediaQuery';
import PageHeader from '../../components/common/PageHeader';
import DataTable, { type Column } from '../../components/common/DataTable';
import MobileTileList from '../../components/common/MobileTileList';
import BottomSheet from '../../components/common/BottomSheet';
import StatusBadge from '../../components/common/StatusBadge';
import type { Customer } from '../../types/customer.types';

export default function CoordinatorCustomers() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Customer | null>(null);
  const isDesktop = useIsDesktop();

  const { data, isLoading } = useQuery({
    queryKey: ['coordinator-customers', page, search],
    queryFn: () => coordinatorGetCustomers(page, 20, search || undefined),
  });

  const customers = data?.items || [];
  const totalPages = data ? Math.ceil(data.totalCount / data.pageSize) : 0;

  const columns: Column<Customer>[] = [
    {
      key: 'shopName', header: 'Shop',
      render: (c) => (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center">
            <span className="text-white font-bold text-sm">{c.shopName[0]}</span>
          </div>
          <div>
            <p className="font-semibold text-slate-800">{c.shopName}</p>
            {c.city && <p className="text-xs text-slate-400">{c.city}</p>}
          </div>
        </div>
      ),
    },
    { key: 'regionName', header: 'Region', render: (c) => (c as any).regionName || '—' },
    { key: 'assignedRepName', header: 'Rep', render: (c) => c.assignedRepName || '—' },
    {
      key: 'approvalStatus', header: 'Status', align: 'center' as const,
      render: (c) => <StatusBadge status={c.approvalStatus || 'Active'} type="customers" />,
    },
  ];

  return (
    <div className="animate-fade-in space-y-4 lg:space-y-6">
      <PageHeader title="Region Customers" subtitle={`${data?.totalCount || 0} customers in your region`} />

      <div className="relative max-w-md">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input type="text" placeholder="Search customers..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 outline-none transition" />
      </div>

      {isDesktop ? (
        <DataTable columns={columns} data={customers} isLoading={isLoading} keyExtractor={(c) => c.id}
          onRowClick={(c) => setSelected(c)} emptyIcon={<Users className="w-12 h-12 text-slate-300" />}
          emptyTitle="No customers found" page={page} totalPages={totalPages}
          onPageChange={setPage} />
      ) : (
        <MobileTileList data={customers} isLoading={isLoading} keyExtractor={(c) => c.id}
          onTileClick={(c) => setSelected(c)} page={page} totalPages={totalPages} onPageChange={setPage}
          renderTile={(c) => (
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold text-sm">{c.shopName[0]}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-slate-800 text-sm truncate">{c.shopName}</p>
                  <StatusBadge status={c.approvalStatus || 'Active'} type="customers" />
                </div>
                <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-0.5">
                  {c.city && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{c.city}</span>}
                  {(c as any).regionName && <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-500 font-medium">{(c as any).regionName}</span>}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-sm font-bold text-slate-800">{c.assignedRepName || 'No Rep'}</p>
                <p className="text-[10px] text-slate-400">{formatCurrency(c.totalOrderValue || 0)}</p>
              </div>
            </div>
          )}
        />
      )}

      {/* Customer Detail BottomSheet */}
      <BottomSheet isOpen={!!selected} onClose={() => setSelected(null)} title="Customer Details">
        {selected && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center">
                <Store className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="font-bold text-slate-900">{selected.shopName}</p>
                <StatusBadge status={selected.approvalStatus || 'Active'} type="customers" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-xs text-slate-500">Total Orders</p>
                <p className="font-bold text-slate-900">{(selected as any).totalOrders || 0}</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-xs text-slate-500">Order Value</p>
                <p className="font-bold text-slate-900">{formatCurrency((selected as any).totalOrderValue || 0)}</p>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              {selected.city && <div className="flex items-center gap-2 text-slate-600"><MapPin className="w-4 h-4 text-slate-400" />{selected.city}</div>}
              {(selected as any).regionName && <div className="flex items-center gap-2 text-slate-600"><span className="text-slate-400">Region:</span>{(selected as any).regionName}</div>}
              {selected.assignedRepName && <div className="flex items-center gap-2 text-slate-600"><span className="text-slate-400">Rep:</span>{selected.assignedRepName}</div>}
              {selected.email && <div className="flex items-center gap-2 text-slate-600"><span className="text-slate-400">Email:</span>{selected.email}</div>}
              {selected.phoneNumber && <div className="flex items-center gap-2 text-slate-600"><span className="text-slate-400">Phone:</span>{selected.phoneNumber}</div>}
            </div>
          </div>
        )}
      </BottomSheet>
    </div>
  );
}
