import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { customersApi } from '../../services/api/customersApi';
import { Users, MapPin, Search, Store, Phone, Eye, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useIsDesktop } from '../../hooks/useMediaQuery';
import PageHeader from '../../components/common/PageHeader';
import MobileTileList from '../../components/common/MobileTileList';
import BottomSheet from '../../components/common/BottomSheet';
import StatusBadge from '../../components/common/StatusBadge';
import type { Customer } from '../../types/customer.types';

export default function RepCustomers() {
  const navigate = useNavigate();
  const isDesktop = useIsDesktop();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Customer | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['rep-customers', page, search],
    queryFn: () => customersApi.repGetCustomers({ page, pageSize: 20, search: search || undefined }).then(r => r.data.data),
  });

  const customers = data?.items || [];
  const totalPages = data?.totalPages || 0;

  const activeCount = useMemo(
    () => customers.filter((c) => (c.approvalStatus || 'Active').toLowerCase() !== 'rejected').length,
    [customers]
  );

  const handleClick = (c: Customer) => {
    if (isDesktop) navigate(`/rep/customers/${c.id}`);
    else setSelected(c);
  };

  const getTaxType = (customer: Customer) => {
    const type = (customer.customerType || '').toLowerCase();
    return type.includes('tax') && !type.includes('non') ? 'Tax' : 'Non Tax';
  };

  return (
    <div className="animate-fade-in space-y-4 lg:space-y-6">
      <PageHeader title="My Customers" subtitle={`${data?.totalCount || 0} assigned customers`} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <p className="text-xs text-slate-500">Total on this page</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{customers.length}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <p className="text-xs text-slate-500">Active on this page</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{activeCount}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <p className="text-xs text-slate-500">Total assigned</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{data?.totalCount || 0}</p>
        </div>
      </div>

      <div className="relative max-w-lg">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search by shop, city, region..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="w-full pl-10 pr-10 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300 outline-none transition"
        />
        {search && (
          <button
            onClick={() => {
              setSearch('');
              setPage(1);
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {isDesktop ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="p-10 text-center text-slate-400 text-sm">Loading customers</div>
          ) : customers.length === 0 ? (
            <div className="p-14 text-center">
              <Users className="w-10 h-10 text-slate-200 mx-auto mb-2" />
              <p className="text-slate-500 font-medium">No customers found</p>
              <p className="text-slate-400 text-sm mt-1">Try changing your search or register a new customer.</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Shop</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Contact</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Location</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Type</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Action</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50/70 transition-colors">
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center flex-shrink-0">
                          <span className="text-white font-bold text-sm">{c.shopName[0]}</span>
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-800 truncate">{c.shopName}</p>
                          {c.email && <p className="text-xs text-slate-400 truncate">{c.email}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-sm text-slate-600">
                      <div className="flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        <span>{c.phoneNumber || '—'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-sm text-slate-600">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        <span>{c.city || c.regionName || '—'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-sm text-slate-600">
                      <div className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 bg-slate-100 text-slate-600 text-xs font-medium">
                        <Store className="w-3.5 h-3.5" />
                        {getTaxType(c)}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <StatusBadge status={c.approvalStatus || 'Active'} type="customers" />
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <button
                        onClick={() => navigate(`/rep/customers/${c.id}`)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-semibold hover:bg-emerald-100 transition"
                      >
                        <Eye className="w-3.5 h-3.5" /> View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {!!data && totalPages > 1 && (
            <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500">{data.totalCount} total • page {page} of {totalPages}</span>
              <div className="flex gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition"
                >
                  Prev
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <MobileTileList data={customers} isLoading={isLoading} keyExtractor={(c) => c.id}
          onTileClick={handleClick} page={page} totalPages={totalPages} onPageChange={setPage}
          renderTile={(c) => (
            <div>
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-bold text-sm">{c.shopName[0]}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-800 text-sm">{c.shopName}</p>
                  <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-0.5">
                    {c.city && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{c.city}</span>}
                    {c.regionName && <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-500 font-medium">{c.regionName}</span>}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <span className="inline-flex items-center gap-1 rounded-full px-2 py-1 bg-slate-100 text-slate-600 text-[11px] font-medium">
                    <Store className="w-3 h-3" /> {getTaxType(c)}
                  </span>
                </div>
              </div>
            </div>
          )}
        />
      )}

      {/* Customer Detail BottomSheet */}
      <BottomSheet isOpen={!!selected} onClose={() => setSelected(null)} title={selected?.shopName || 'Customer'}>
        {selected && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center">
                <span className="text-white font-bold text-lg">{selected.shopName[0]}</span>
              </div>
              <div>
                <p className="font-bold text-slate-900">{selected.shopName}</p>
                <StatusBadge status={selected.approvalStatus || 'Active'} type="customers" />
              </div>
            </div>
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-xs text-slate-500">Type</p>
              <p className="font-bold text-slate-900">{getTaxType(selected)}</p>
            </div>
            <div className="space-y-2 text-sm">
              {selected.city && <div className="flex items-center gap-2 text-slate-600"><MapPin className="w-4 h-4 text-slate-400" />{selected.city}</div>}
              {selected.regionName && <div className="flex items-center gap-2 text-slate-600"><span className="text-slate-400">Region:</span>{selected.regionName}</div>}
            </div>
            <button onClick={() => { navigate(`/rep/customers/${selected.id}`); setSelected(null); }}
              className="w-full py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 transition">
              View Full Details
            </button>
          </div>
        )}
      </BottomSheet>
    </div>
  );
}
