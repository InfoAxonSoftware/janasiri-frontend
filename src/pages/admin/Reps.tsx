// @ts-nocheck
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as XLSX from 'xlsx';
import { repsApi } from '../../services/api/repsApi';
import { regionsApi } from '../../services/api/regionsApi';
import { adminGetAllCoordinators } from '../../services/api/coordinatorApi';
import { Users, Plus, Search, Eye, FileSpreadsheet, FileText, Check, X, SlidersHorizontal, Trash2, RotateCcw } from 'lucide-react';
import toast from 'react-hot-toast';
import { useIsDesktop } from '../../hooks/useMediaQuery';
import MobileTileList from '../../components/common/MobileTileList';
import BottomSheet from '../../components/common/BottomSheet';
import StatusBadge from '../../components/common/StatusBadge';

export default function AdminReps() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [filterRegionId, setFilterRegionId] = useState('');
  const [filterCoordinatorId, setFilterCoordinatorId] = useState('');
  const [activeTab, setActiveTab] = useState<'active' | 'trash'>('active');
  const [trashPage, setTrashPage] = useState(1);
  const [filterSubPanel, setFilterSubPanel] = useState<'status' | 'region' | 'coordinator' | null>(null);
  const isDesktop = useIsDesktop();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [selectAllPages, setSelectAllPages] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const activeFilterCount = [filterStatus !== 'all', !!filterRegionId, !!filterCoordinatorId].filter(Boolean).length;

  const [repForm, setRepForm] = useState({
    fullName: '',
    employeeCode: '',
    password: '',
    regionId: '',
    subRegionId: '',
    coordinatorId: '',
    email: '',
    phoneNumber: '',
    hireDate: '',
  });

  const { data: repsData, isLoading: repsLoading } = useQuery({
    queryKey: ['admin-reps', page, search, filterStatus, filterRegionId, filterCoordinatorId],
    queryFn: () =>
      repsApi
        .adminGetAll({
          page, pageSize: 20,
          search: search || undefined,
          isActive: filterStatus === 'active' ? true : filterStatus === 'inactive' ? false : undefined,
          regionId: filterRegionId || undefined,
          coordinatorId: filterCoordinatorId || undefined,
        })
        .then(r => r.data.data),
  });

  const { data: regionsData } = useQuery({
    queryKey: ['regions'],
    queryFn: () => regionsApi.getAll().then(r => r.data || []),
  });

  const { data: coordinatorsData } = useQuery({
    queryKey: ['coordinators-list'],
    queryFn: () => adminGetAllCoordinators(1, 100).then(r => r.items || []),
  });

  const { data: trashData, isLoading: trashLoading } = useQuery({
    queryKey: ['admin-reps-trash', trashPage],
    queryFn: () => repsApi.adminGetTrash({ page: trashPage, pageSize: 20 }).then(r => r.data.data),
    enabled: activeTab === 'trash',
  });

  const regionList = Array.isArray(regionsData) ? regionsData : [];
  const coordinatorList = coordinatorsData || [];

  const createRepMut = useMutation({
    mutationFn: (d: any) => repsApi.adminCreate(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-reps'] });
      setShowCreate(false);
      setRepForm({ fullName: '', employeeCode: '', password: '', regionId: '', subRegionId: '', coordinatorId: '', email: '', phoneNumber: '', hireDate: '' });
      toast.success('Rep created successfully.');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed'),
  });

  const restoreRepMut = useMutation({
    mutationFn: (id: string) => repsApi.adminRestore(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-reps-trash'] });
      qc.invalidateQueries({ queryKey: ['admin-reps'] });
      toast.success('Rep restored successfully.');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed to restore'),
  });

  const reps = (repsData as any)?.items || [];

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === reps.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(reps.map((r: any) => r.id)));
    }
  };

  const exportReps = async (format: 'excel' | 'pdf', onlySelected?: boolean) => {
    const list = (onlySelected
      ? reps.filter((r: any) => selectedIds.has(r.id))
      : reps) as any[];

    if (format === 'excel') {
      const rows = list.map((r) => ({
        'Full Name': r.fullName,
        'Employee Code': r.employeeCode || '',
        Region: r.regionNames?.join(', ') || '',
        'Sub-Region': r.subRegionNames?.join(', ') || '',
        Coordinator: r.coordinatorNames?.join(', ') || '',
        Customers: r.assignedCustomersCount || 0,
        Status: r.isActive ? 'Active' : 'Inactive',
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Reps');
      XLSX.writeFile(wb, `reps-${Date.now()}.xlsx`);
    } else {
      const { default: jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');
      const doc = new jsPDF();
      doc.setFontSize(16);
      doc.text('Sales Reps', 14, 16);
      autoTable(doc, {
        startY: 24,
        head: [['Full Name', 'Code', 'Region', 'Sub-Region', 'Coordinator', 'Customers', 'Status']],
        body: list.map((r) => [
          r.fullName,
          r.employeeCode || '',
          r.regionNames?.join(', ') || '',
          r.subRegionNames?.join(', ') || '',
          r.coordinatorNames?.join(', ') || '',
          r.assignedCustomersCount || 0,
          r.isActive ? 'Active' : 'Inactive',
        ]),
        styles: { fontSize: 9 },
        headStyles: { fillColor: [99, 102, 241] },
      });
      doc.save(`reps-${Date.now()}.pdf`);
    }
  };

  const selectionMode = selectedIds.size > 0 || selectAllPages;
  const headerCheckboxChecked = selectAllPages || (reps.length > 0 && selectedIds.size === reps.length);
  const headerCheckboxIndeterminate = !selectAllPages && selectedIds.size > 0 && selectedIds.size < reps.length;
  const deleteLabel = selectAllPages
    ? `Delete (all ${(repsData as any)?.totalCount ?? '…'})`
    : selectedIds.size > 0 ? `Delete (${selectedIds.size})` : 'Delete';

  const handleHeaderCheckbox = () => {
    if (selectAllPages) { setSelectAllPages(false); setSelectedIds(new Set()); }
    else if (selectedIds.size === reps.length && reps.length > 0) { setSelectedIds(new Set()); }
    else { setSelectedIds(new Set(reps.map((r: any) => r.id))); setSelectAllPages(false); }
  };

  const clearSelection = () => { setSelectedIds(new Set()); setSelectAllPages(false); };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') clearSelection(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const repDeleteMut = useMutation({
    mutationFn: (id: string) => repsApi.adminDelete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-reps'] }),
  });

  const handleDeleteSelected = async () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    let failed = 0;
    for (const id of ids) {
      try { await repsApi.adminDelete(id); }
      catch { failed++; }
    }
    qc.invalidateQueries({ queryKey: ['admin-reps'] });
    qc.invalidateQueries({ queryKey: ['admin-reps-trash'] });
    if (failed === 0) toast.success(`${ids.length} rep${ids.length > 1 ? 's' : ''} moved to trash`);
    else toast.error(`${ids.length - failed} moved to trash, ${failed} failed`);
    clearSelection();
    setDeleteConfirmOpen(false);
  };

  return (
    <div className="animate-fade-in flex flex-col gap-4 pb-28">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Sales Reps</h1>
          <p className="text-slate-500 text-sm mt-1">Manage your sales team</p>
        </div>
        {/* Active / Trash tabs */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('active')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${activeTab === 'active' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <Users className="w-3.5 h-3.5" /> Active
          </button>
          <button
            onClick={() => setActiveTab('trash')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${activeTab === 'trash' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <Trash2 className="w-3.5 h-3.5" /> Trash
          </button>
        </div>
      </div>

      {/* ── Sticky Toolbar ─────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-30">
        <div className="bg-white/95 backdrop-blur-sm border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-3 py-2.5 flex flex-wrap sm:flex-nowrap items-center gap-x-2 gap-y-2">

            {/* Search */}
            <div className="relative group order-2 sm:order-1 w-full sm:w-auto sm:flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
              <input
                type="text"
                placeholder="Search reps…"
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                className="w-full pl-8 pr-7 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm placeholder-slate-400 focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/15 outline-none transition-all"
              />
              {search && (
                <button onClick={() => { setSearch(''); setPage(1); }} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Right buttons */}
            <div className="order-1 sm:order-2 ml-auto sm:ml-0 flex items-center gap-1 shrink-0">
              {/* Filter */}
              <button
                onClick={() => setFilterPanelOpen(p => !p)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                  filterPanelOpen
                    ? 'bg-indigo-600 text-white'
                    : activeFilterCount > 0
                    ? 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Filter</span>
                {activeFilterCount > 0 && (
                  <span className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold ${filterPanelOpen ? 'bg-white/30 text-white' : 'bg-indigo-600 text-white'}`}>{activeFilterCount}</span>
                )}
              </button>

              <div className="w-px h-5 bg-slate-200 mx-0.5" />

              {/* Excel */}
              <button
                onClick={() => exportReps('excel', selectedIds.size > 0)}
                className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 transition-all"
                title={selectedIds.size > 0 ? `Export ${selectedIds.size} selected` : 'Export all'}
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">Excel</span>
              </button>

              {/* PDF */}
              <button
                onClick={() => exportReps('pdf', selectedIds.size > 0)}
                className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-rose-50 hover:text-rose-600 transition-all"
                title={selectedIds.size > 0 ? `Export ${selectedIds.size} selected` : 'Export all'}
              >
                <FileText className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">PDF</span>
              </button>

              <div className="w-px h-5 bg-slate-200 mx-0.5" />

              {/* Add */}
              <button
                onClick={() => isDesktop ? navigate('/admin/reps/new') : setShowCreate(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Add Rep</span>
              </button>

              {/* Selection actions */}
              {selectionMode && (
                <>
                  <div className="w-px h-5 bg-slate-200 mx-0.5" />
                  {!selectAllPages && selectedIds.size === reps.length && reps.length > 0 && ((repsData as any)?.totalPages ?? 1) > 1 && (
                    <button onClick={() => setSelectAllPages(true)} className="hidden md:inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold text-indigo-600 hover:bg-indigo-50 transition-all">
                      Select all {(repsData as any)?.totalCount}
                    </button>
                  )}
                  {selectAllPages && (
                    <span className="hidden md:inline text-[10px] font-semibold text-indigo-600 px-2">All {(repsData as any)?.totalCount} selected</span>
                  )}
                  <button
                    onClick={() => setDeleteConfirmOpen(true)}
                    title={deleteLabel}
                    className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-semibold text-red-600 hover:bg-red-50 hover:text-red-700 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span className="hidden lg:inline">{deleteLabel}</span>
                  </button>
                  <button onClick={clearSelection} title="Clear selection (Esc)" className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Filter Panel — Quotations tabbed style */}
          {filterPanelOpen && (
            <div className="border-t border-slate-100">
              {/* Category tabs */}
              <div className="flex flex-wrap bg-slate-50 px-3 pt-3 gap-1">
                {[
                  { key: 'status', label: 'Status', count: filterStatus !== 'all' ? 1 : 0 },
                  { key: 'region', label: 'Region', count: filterRegionId ? 1 : 0 },
                  { key: 'coordinator', label: 'Coordinator', count: filterCoordinatorId ? 1 : 0 },
                ].map(({ key, label, count }) => (
                  <button
                    key={key}
                    onClick={() => setFilterSubPanel(p => p === key ? null : key as any)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-t-lg text-xs font-semibold border border-b-0 transition-all ${
                      filterSubPanel === key
                        ? 'bg-white border-slate-200 text-slate-800 -mb-px pb-[7px] z-10 relative'
                        : count > 0
                        ? 'bg-indigo-50 border-indigo-100 text-indigo-700'
                        : 'bg-transparent border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {label}
                    {count > 0 && <span className="w-4 h-4 rounded-full bg-indigo-600 text-white text-[9px] font-bold inline-flex items-center justify-center">{count}</span>}
                  </button>
                ))}
                {activeFilterCount > 0 && (
                  <button
                    onClick={() => { setFilterStatus('all'); setFilterRegionId(''); setFilterCoordinatorId(''); setPage(1); }}
                    className="ml-auto inline-flex items-center gap-1 px-2.5 py-1.5 rounded-t-lg text-xs font-semibold text-red-500 hover:text-red-700 hover:bg-red-50 transition-all border border-transparent"
                  >
                    <X className="w-3 h-3" /> Clear all
                  </button>
                )}
              </div>
              {/* Filter content panel */}
              <div className="bg-white border-t border-slate-200 px-4 py-4">
                {!filterSubPanel && <p className="text-xs text-slate-400 text-center py-2">Select a filter category above</p>}
                {filterSubPanel === 'status' && (
                  <div className="flex flex-wrap gap-2">
                    {(['all', 'active', 'inactive'] as const).map(s => (
                      <button
                        key={s}
                        onClick={() => { setFilterStatus(s); setPage(1); }}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                          filterStatus === s
                            ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                            : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-700 hover:bg-indigo-50'
                        }`}
                      >
                        {filterStatus === s && <Check className="w-3 h-3" />}
                        {s === 'all' ? 'All' : s === 'active' ? 'Active' : 'Inactive'}
                      </button>
                    ))}
                  </div>
                )}
                {filterSubPanel === 'region' && (
                  <select value={filterRegionId} onChange={e => { setFilterRegionId(e.target.value); setPage(1); }} className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/15 focus:border-indigo-400 transition cursor-pointer">
                    <option value="">All Regions</option>
                    {regionList.map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                )}
                {filterSubPanel === 'coordinator' && (
                  <select value={filterCoordinatorId} onChange={e => { setFilterCoordinatorId(e.target.value); setPage(1); }} className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/15 focus:border-indigo-400 transition cursor-pointer">
                    <option value="">All Coordinators</option>
                    {coordinatorList.map((c: any) => <option key={c.id} value={c.id}>{c.fullName}</option>)}
                  </select>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Trash Tab */}
      {activeTab === 'trash' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
            <Trash2 className="w-4 h-4 text-slate-400" />
            <span className="text-sm font-semibold text-slate-700">Trash</span>
            <span className="text-xs text-slate-400 ml-auto">Items are permanently deleted after 30 days</span>
          </div>
          {trashLoading ? (
            <div className="p-10 text-center text-slate-400 text-sm">Loading…</div>
          ) : (trashData?.items?.length ?? 0) === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <Trash2 className="w-10 h-10 mb-3 opacity-30" />
              <p className="text-sm font-medium">Trash is empty</p>
            </div>
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-slate-800 text-white">
                  <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider border-r border-slate-600">Name</th>
                  <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider border-r border-slate-600">Region</th>
                  <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider border-r border-slate-600">Coordinator</th>
                  <th className="px-4 py-3.5 text-center text-xs font-semibold uppercase tracking-wider border-r border-slate-600">Deleted At</th>
                  <th className="px-4 py-3.5 text-center text-xs font-semibold uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {trashData?.items?.map((r: any) => (
                  <tr key={r.id} className="border-b border-slate-100 text-sm">
                    <td className="px-4 py-3 border-r border-slate-100">
                      <p className="font-semibold text-slate-800">{r.fullName}</p>
                      <p className="text-xs text-slate-400">{r.employeeCode}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-600 border-r border-slate-100">{r.regionNames?.join(', ') || '—'}</td>
                    <td className="px-4 py-3 text-slate-600 border-r border-slate-100">{r.coordinatorNames?.join(', ') || '—'}</td>
                    <td className="px-4 py-3 text-center text-slate-500 border-r border-slate-100">
                      {r.deletedAt ? new Date(r.deletedAt).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => restoreRepMut.mutate(r.id)}
                        disabled={restoreRepMut.isPending}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-600 text-xs font-medium hover:bg-emerald-100 transition"
                      >
                        <RotateCcw className="w-3.5 h-3.5" /> Restore
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {(trashData?.totalPages ?? 0) > 1 && (
            <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500">{trashData?.totalCount} total · p{trashData?.page}/{trashData?.totalPages}</span>
              <div className="flex gap-1">
                <button onClick={() => setTrashPage(p => Math.max(1, p - 1))} disabled={trashPage <= 1} className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition">Prev</button>
                <button onClick={() => setTrashPage(p => Math.min(trashData!.totalPages, p + 1))} disabled={trashPage >= (trashData?.totalPages ?? 1)} className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition">Next</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Desktop table — Active Tab */}
      {activeTab === 'active' && isDesktop ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {repsLoading ? (
            <div className="p-10 text-center text-slate-400 text-sm">Loading…</div>
          ) : reps.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <Users className="w-10 h-10 mb-3 opacity-30" />
              <p className="text-sm font-medium">No reps found</p>
            </div>
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-slate-800 text-white">
                  <th className="w-10 px-3 py-3.5 text-center border-r border-slate-600">
                    <input
                      type="checkbox"
                      checked={headerCheckboxChecked}
                      ref={el => { if (el) el.indeterminate = headerCheckboxIndeterminate; }}
                      onChange={handleHeaderCheckbox}
                      className="accent-indigo-400 w-3.5 h-3.5 cursor-pointer"
                    />
                  </th>
                  <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider border-r border-slate-600">Name</th>
                  <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider border-r border-slate-600">Region</th>
                  <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider border-r border-slate-600">Sub-Region</th>
                  <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider border-r border-slate-600">Coordinator</th>
                  <th className="px-4 py-3.5 text-center text-xs font-semibold uppercase tracking-wider border-r border-slate-600">Customers</th>
                  <th className="px-4 py-3.5 text-center text-xs font-semibold uppercase tracking-wider border-r border-slate-600">Status</th>
                  <th className="px-4 py-3.5 text-center text-xs font-semibold uppercase tracking-wider">Actions</th>
                </tr>
                {!selectAllPages && selectedIds.size === reps.length && reps.length > 0 && ((repsData as any)?.totalPages ?? 1) > 1 && (
                  <tr className="bg-indigo-50 border-b border-indigo-100">
                    <td colSpan={8} className="px-4 py-1.5 text-center text-xs text-indigo-600">
                      All {reps.length} on this page selected —{' '}
                      <button onClick={() => setSelectAllPages(true)} className="font-semibold underline underline-offset-2 hover:text-indigo-800">
                        Select all {(repsData as any)?.totalCount} across all pages
                      </button>
                    </td>
                  </tr>
                )}
              </thead>
              <tbody>
                {reps.map((r: any) => {
                  const isSelected = selectedIds.has(r.id);
                  return (
                  <tr
                    key={r.id}
                    onClick={() => { if (selectionMode) toggleSelect(r.id); else navigate(`/admin/reps/${r.id}`); }}
                    className={`border-b border-slate-100 cursor-pointer transition-colors select-none text-sm ${
                      isSelected ? 'bg-indigo-50/70' : 'hover:bg-slate-50/70'
                    }`}
                  >
                    <td className="px-3 py-3 text-center border-r border-slate-100" onClick={e => { e.stopPropagation(); toggleSelect(r.id); }}>
                      <input type="checkbox" readOnly checked={isSelected} className="pointer-events-none accent-indigo-500 w-3.5 h-3.5" />
                    </td>
                    <td className="px-4 py-3 border-r border-slate-100">
                      <p className="font-semibold text-slate-800 text-sm">{r.fullName}</p>
                      <p className="text-xs text-slate-400">{r.employeeCode}</p>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-slate-800 border-r border-slate-100">{r.regionNames?.join(', ') || '—'}</td>
                    <td className="px-4 py-3 text-sm font-medium text-slate-800 border-r border-slate-100">{r.subRegionNames?.join(', ') || '—'}</td>
                    <td className="px-4 py-3 text-sm font-medium text-slate-800 border-r border-slate-100">{r.coordinatorNames?.join(', ') || '—'}</td>
                    <td className="px-4 py-3 text-center text-sm font-medium text-slate-800 border-r border-slate-100">{r.assignedCustomersCount || 0}</td>
                    <td className="px-4 py-3 text-center border-r border-slate-100"><StatusBadge status={r.isActive ? 'Active' : 'Inactive'} /></td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={e => { e.stopPropagation(); navigate(`/admin/reps/${r.id}`); }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-600 text-xs font-medium hover:bg-indigo-100 transition"
                      >
                        <Eye className="w-3.5 h-3.5" /> View
                      </button>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {(repsData as any)?.totalPages > 1 && (
            <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500">{(repsData as any)?.totalCount} total · p{(repsData as any)?.page}/{(repsData as any)?.totalPages}</span>
              <div className="flex gap-1">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition">Prev</button>
                <button onClick={() => setPage(p => Math.min((repsData as any).totalPages, p + 1))} disabled={page >= (repsData as any).totalPages} className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition">Next</button>
              </div>
            </div>
          )}
        </div>
      ) : activeTab === 'active' ? (
        <MobileTileList
          data={reps}
          keyExtractor={r => r.id}
          isLoading={repsLoading}
          emptyMessage="No reps found"
          emptyIcon={<Users className="w-10 h-10" />}
          page={repsData?.page}
          totalPages={repsData?.totalPages}
          onPageChange={setPage}
          renderTile={(r: any) => (
            <div className="p-4" onClick={() => navigate(`/admin/reps/${r.id}`)}>
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(r.id)}
                    onChange={e => { e.stopPropagation(); toggleSelect(r.id); }}
                    onClick={e => e.stopPropagation()}
                    className="mt-1 shrink-0"
                  />
                  <div>
                    <p className="font-semibold text-slate-900">{r.fullName}</p>
                    <p className="text-xs text-slate-400">{r.employeeCode} · {r.regionNames?.join(', ') || 'No region'}</p>
                  </div>
                </div>
                <StatusBadge status={r.isActive ? 'Active' : 'Inactive'} />
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-400 mb-3 ml-8">
                <span>{r.coordinatorNames?.join(', ') || 'No coordinator'}</span>
                <span>{r.assignedCustomersCount || 0} customers</span>
              </div>
              <div className="ml-8">
                <button
                  onClick={e => { e.stopPropagation(); navigate(`/admin/reps/${r.id}`); }}
                  className="w-full py-2 text-xs font-medium rounded-lg bg-indigo-50 text-indigo-700 active:scale-95 flex items-center justify-center gap-1.5"
                >
                  <Eye className="w-3.5 h-3.5" /> View Details
                </button>
              </div>
            </div>
          )}
        />
      ) : null}

      {/* Create Rep */}
      {showCreate && (
        <BottomSheet open={true} onClose={() => setShowCreate(false)} title="Create Sales Rep">
          <div className="p-5 space-y-4">
            {[
              { label: 'Full Name', key: 'fullName', type: 'text' },
              { label: 'Employee Code', key: 'employeeCode', type: 'text' },
              { label: 'Password', key: 'password', type: 'password' },
              { label: 'Email (Optional)', key: 'email', type: 'email' },
              { label: 'Phone', key: 'phoneNumber', type: 'tel' },
            ].map(f => (
              <div key={f.key}>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">{f.label}</label>
                <input
                  type={f.type}
                  value={(repForm as any)[f.key]}
                  onChange={e => setRepForm(p => ({ ...p, [f.key]: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
            ))}

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Hire Date</label>
                <input
                  type="date"
                  value={repForm.hireDate}
                  onChange={e => setRepForm(p => ({ ...p, hireDate: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
              <div />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Region</label>
                <select
                  value={repForm.regionId}
                  onChange={e => setRepForm(p => ({ ...p, regionId: e.target.value, subRegionId: '', coordinatorId: '' }))}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="">Select region…</option>
                  {regionList.map((r: any) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Sub-region</label>
                <select
                  value={repForm.subRegionId}
                  onChange={e => setRepForm(p => ({ ...p, subRegionId: e.target.value }))}
                  disabled={!repForm.regionId}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50"
                >
                  <option value="">Select sub-region…</option>
                  {regionList
                    .find((r: any) => r.id === repForm.regionId)
                    ?.subRegions?.map((s: any) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Coordinator</label>
                <select
                  value={repForm.coordinatorId}
                  onChange={e => setRepForm(p => ({ ...p, coordinatorId: e.target.value }))}
                  disabled={!repForm.regionId}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50"
                >
                  <option value="">Select coordinator…</option>
                  {coordinatorList
                    .filter((c: any) => !repForm.regionId || c.regionId === repForm.regionId)
                    .map((c: any) => (
                      <option key={c.id} value={c.id}>{c.fullName}</option>
                    ))}
                </select>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowCreate(false)} className="flex-1 py-2.5 bg-slate-100 rounded-xl text-sm font-medium text-slate-600">Cancel</button>
              <button
                onClick={() => createRepMut.mutate({
                  ...repForm,
                  email: repForm.email || undefined,
                  phoneNumber: repForm.phoneNumber || undefined,
                  hireDate: repForm.hireDate || undefined,
                  regionId: repForm.regionId || undefined,
                  subRegionId: repForm.subRegionId || undefined,
                  coordinatorId: repForm.coordinatorId || undefined,
                })}
                disabled={createRepMut.isPending || !repForm.fullName || !repForm.employeeCode || !repForm.password}
                className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium disabled:opacity-50"
              >
                {createRepMut.isPending ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </BottomSheet>
      )}

      {/* Delete confirm dialog */}
      {deleteConfirmOpen && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h2 className="text-base font-bold text-slate-900 mb-1">Move {selectAllPages ? 'all' : selectedIds.size} rep{(!selectAllPages && selectedIds.size === 1) ? '' : 's'} to trash?</h2>
            <p className="text-sm text-slate-500 mb-5">They will be automatically removed after 30 days.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirmOpen(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition">Cancel</button>
              <button onClick={handleDeleteSelected} className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition">Move to Trash</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
