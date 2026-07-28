import { useQuery } from '@tanstack/react-query';
import { coordinatorGetReps } from '../../services/api/coordinatorApi';
import { Users, MapPin, Phone, Mail, Search } from 'lucide-react';
import { useState } from 'react';
import { useIsDesktop } from '../../hooks/useMediaQuery';
import PageHeader from '../../components/common/PageHeader';
import DataTable, { type Column } from '../../components/common/DataTable';
import MobileTileList from '../../components/common/MobileTileList';

export default function CoordinatorTeam() {
  const [search, setSearch] = useState('');
  const isDesktop = useIsDesktop();

  const { data: reps, isLoading } = useQuery({
    queryKey: ['coordinator-reps'],
    queryFn: coordinatorGetReps,
  });

  const filtered = (reps || []).filter((r: any) =>
    !search || r.fullName?.toLowerCase().includes(search.toLowerCase()) || r.employeeCode?.toLowerCase().includes(search.toLowerCase())
  );

  const columns: Column<any>[] = [
    {
      key: 'fullName', header: 'Name',
      render: (r) => (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center">
            <span className="text-white font-bold text-sm">{r.fullName?.[0]}</span>
          </div>
          <div>
            <p className="font-semibold text-slate-800">{r.fullName}</p>
            <p className="text-xs text-slate-400">{r.employeeCode}</p>
          </div>
        </div>
      ),
    },
    { key: 'regionName', header: 'Region', render: (r) => r.regionName || '—' },
    { key: 'subRegionName', header: 'Sub Region', render: (r) => r.subRegionName || '—' },
    { key: 'phoneNumber', header: 'Phone', render: (r) => r.phoneNumber || '—' },
    { key: 'email', header: 'Email', render: (r) => r.email || '—' },
    {
      key: 'isActive', header: 'Status', align: 'center' as const,
      render: (r) => (
        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${r.isActive ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
          {r.isActive ? 'Active' : 'Inactive'}
        </span>
      ),
    },
  ];

  return (
    <div className="animate-fade-in space-y-4 lg:space-y-6">
      <PageHeader title="My Team" subtitle={`${reps?.length || 0} assigned reps`} />

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input type="text" placeholder="Search reps..." value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 outline-none transition" />
      </div>

      {isDesktop ? (
        <DataTable columns={columns} data={filtered} isLoading={isLoading} keyExtractor={(r) => r.id}
          emptyIcon={<Users className="w-12 h-12 text-slate-300" />}
          emptyTitle="No reps found" page={1} totalPages={1} />
      ) : (
        <MobileTileList data={filtered} isLoading={isLoading} keyExtractor={(r) => r.id}
          page={1} totalPages={1}
          renderTile={(r) => (
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold text-sm">{r.fullName?.[0]}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-slate-800 text-sm truncate">{r.fullName}</p>
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${r.isActive ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                    {r.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">{r.employeeCode}</p>
                <div className="flex flex-wrap gap-3 mt-1.5 text-[11px] text-slate-500">
                  {r.regionName && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{r.regionName}</span>}
                  {r.subRegionName && <span>{r.subRegionName}</span>}
                  {r.phoneNumber && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{r.phoneNumber}</span>}
                </div>
              </div>
            </div>
          )}
        />
      )}
    </div>
  );
}
