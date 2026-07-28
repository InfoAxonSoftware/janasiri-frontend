import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as XLSX from 'xlsx';
import { adminGetAllCoordinators, adminDeleteCoordinator, adminGetTrashedCoordinators, adminRestoreCoordinator } from '../../services/api/coordinatorApi';
import { Users, Plus, Search, FileSpreadsheet, FileText, Check, X, MapPin, TrendingUp, Pencil, Trash2, SlidersHorizontal, RotateCcw } from 'lucide-react';
import toast from 'react-hot-toast';
import { useIsDesktop } from '../../hooks/useMediaQuery';
import MobileTileList from '../../components/common/MobileTileList';
import StatusBadge from '../../components/common/StatusBadge';

export default function AdminCoordinators() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectAllPages, setSelectAllPages] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'active' | 'trash'>('active');
  const [trashPage, setTrashPage] = useState(1);
  const [filterSubPanel, setFilterSubPanel] = useState<'status' | null>(null);
  const isDesktop = useIsDesktop();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const activeFilterCount = filterStatus !== 'all' ? 1 : 0;

  const { data, isLoading } = useQuery({
    queryKey: ['admin-coordinators', page, search],
    queryFn: () => adminGetAllCoordinators(page, 20, search || undefined),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => adminDeleteCoordinator(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-coordinators'] });
      qc.invalidateQueries({ queryKey: ['admin-coordinators-trash'] });
      toast.success('Coordinator moved to trash');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed to delete coordinator'),
    onSettled: () => setDeletingId(null),
  });

  const { data: trashData, isLoading: trashLoading } = useQuery({
    queryKey: ['admin-coordinators-trash', trashPage],
    queryFn: () => adminGetTrashedCoordinators(trashPage, 20),
    enabled: activeTab === 'trash',
  });

  const restoreMut = useMutation({
    mutationFn: (id: string) => adminRestoreCoordinator(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-coordinators-trash'] });
      qc.invalidateQueries({ queryKey: ['admin-coordinators'] });
      toast.success('Coordinator restored successfully.');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed to restore'),
  });

  const handleDelete = (id: string, fullName: string) => {
    const ok = window.confirm(`Move coordinator ${fullName} to trash?`);
    if (!ok) return;
    setDeletingId(id);
    deleteMut.mutate(id);
  };

  const coordinators = ((data as any)?.items || [])
    .filter((c: any) =>
      search ? (c.fullName + ' ' + (c.regionName || '') + ' ' + c.employeeCode).toLowerCase().includes(search.toLowerCase()) : true
    )
    .filter((c: any) =>
      filterStatus === 'all'
        ? true
        : filterStatus === 'active'
        ? c.isActive
        : !c.isActive
    );

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id); else s.add(id);
      return s;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === coordinators.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(coordinators.map((c: any) => c.id)));
  };

  const exportCoordinators = async (format: 'excel' | 'pdf', onlySelected?: boolean) => {
    const list = (onlySelected ? coordinators.filter((c: any) => selectedIds.has(c.id)) : coordinators) as any[];
    if (format === 'excel') {
      const rows = list.map((c) => ({
        'Full Name': c.fullName,
        'Employee Code': c.employeeCode || '',
        Region: c.regionName || '',
        Email: c.email || '',
        'Total Reps': c.assignedRepsCount || 0,
        'Total Customers': c.assignedCustomersCount || 0,
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Coordinators');
      XLSX.writeFile(wb, `coordinators-${Date.now()}.xlsx`);
    } else {
      const { default: jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');
      const doc = new jsPDF();
      doc.setFontSize(16);
      doc.text('Coordinators', 14, 16);
      autoTable(doc, {
        startY: 24,
        head: [['Full Name', 'Code', 'Region', 'Email', 'Reps', 'Customers']],
        body: list.map((c) => [c.fullName, c.employeeCode || '', c.regionName || '', c.email || '', c.assignedRepsCount || 0, c.assignedCustomersCount || 0]),
        styles: { fontSize: 9 },
        headStyles: { fillColor: [99, 102, 241] },
      });
      doc.save(`coordinators-${Date.now()}.pdf`);
    }
  };

  const allSelected = coordinators.length > 0 && selectedIds.size === coordinators.length;
  const selectionMode = selectedIds.size > 0 || selectAllPages;
  const headerCheckboxChecked = selectAllPages || allSelected;
  const headerCheckboxIndeterminate = !selectAllPages && selectedIds.size > 0 && selectedIds.size < coordinators.length;
  const deleteLabel = selectAllPages
    ? `Delete (all ${(data as any)?.totalCount ?? '…'})`
    : selectedIds.size > 0 ? `Delete (${selectedIds.size})` : 'Delete';

  const handleHeaderCheckbox = () => {
    if (selectAllPages) { setSelectAllPages(false); setSelectedIds(new Set()); }
    else if (selectedIds.size === coordinators.length && coordinators.length > 0) { setSelectedIds(new Set()); }
    else { setSelectedIds(new Set(coordinators.map((c: any) => c.id))); setSelectAllPages(false); }
  };

  const clearSelection = () => { setSelectedIds(new Set()); setSelectAllPages(false); };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') clearSelection(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleDeleteSelected = async () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    let failed = 0;
    for (const id of ids) {
      try { await adminDeleteCoordinator(id); }
      catch { failed++; }
    }
    qc.invalidateQueries({ queryKey: ['admin-coordinators'] });
    qc.invalidateQueries({ queryKey: ['admin-coordinators-trash'] });
    if (failed === 0) toast.success(`${ids.length} coordinator${ids.length > 1 ? 's' : ''} moved to trash`);
    else toast.error(`${ids.length - failed} moved to trash, ${failed} failed`);
    clearSelection();
    setDeleteConfirmOpen(false);
  };

  return (
    <div className="animate-fade-in flex flex-col gap-4 pb-28">
      {/* Title + Tabs */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Coordinators</h1>
          <p className="text-slate-500 text-sm mt-1">Manage sales coordinators</p>
        </div>
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
                placeholder="Search coordinators…"
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
                onClick={() => exportCoordinators('excel', selectedIds.size > 0)}
                className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 transition-all"
                title={selectedIds.size > 0 ? `Export ${selectedIds.size} selected` : 'Export all'}
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">Excel</span>
              </button>

              {/* PDF */}
              <button
                onClick={() => exportCoordinators('pdf', selectedIds.size > 0)}
                className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-rose-50 hover:text-rose-600 transition-all"
                title={selectedIds.size > 0 ? `Export ${selectedIds.size} selected` : 'Export all'}
              >
                <FileText className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">PDF</span>
              </button>

              <div className="w-px h-5 bg-slate-200 mx-0.5" />

              {/* Add */}
              <button
                onClick={() => navigate('/admin/coordinators/new')}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Add</span>
              </button>

              {/* Selection actions */}
              {selectionMode && (
                <>
                  <div className="w-px h-5 bg-slate-200 mx-0.5" />
                  {!selectAllPages && selectedIds.size === coordinators.length && coordinators.length > 0 && ((data as any)?.totalPages ?? 1) > 1 && (
                    <button onClick={() => setSelectAllPages(true)} className="hidden md:inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold text-indigo-600 hover:bg-indigo-50 transition-all">
                      Select all {(data as any)?.totalCount}
                    </button>
                  )}
                  {selectAllPages && (
                    <span className="hidden md:inline text-[10px] font-semibold text-indigo-600 px-2">All {(data as any)?.totalCount} selected</span>
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
              <div className="flex flex-wrap bg-slate-50 px-3 pt-3 gap-1">
                {[{ key: 'status', label: 'Status', count: filterStatus !== 'all' ? 1 : 0 }].map(({ key, label, count }) => (
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
                    onClick={() => { setFilterStatus('all'); setPage(1); }}
                    className="ml-auto inline-flex items-center gap-1 px-2.5 py-1.5 rounded-t-lg text-xs font-semibold text-red-500 hover:text-red-700 hover:bg-red-50 transition-all border border-transparent"
                  >
                    <X className="w-3 h-3" /> Clear all
                  </button>
                )}
              </div>
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
          ) : ((trashData as any)?.items?.length ?? 0) === 0 ? (
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
                  <th className="px-4 py-3.5 text-center text-xs font-semibold uppercase tracking-wider border-r border-slate-600">Deleted At</th>
                  <th className="px-4 py-3.5 text-center text-xs font-semibold uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(trashData as any)?.items?.map((c: any) => (
                  <tr key={c.id} className="border-b border-slate-100 text-sm">
                    <td className="px-4 py-3 border-r border-slate-100">
                      <p className="font-semibold text-slate-800">{c.fullName}</p>
                      <p className="text-xs text-slate-400">{c.employeeCode}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-600 border-r border-slate-100">{c.regionName || '—'}</td>
                    <td className="px-4 py-3 text-center text-slate-500 border-r border-slate-100">
                      {c.deletedAt ? new Date(c.deletedAt).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => restoreMut.mutate(c.id)}
                        disabled={restoreMut.isPending}
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
          {((trashData as any)?.totalPages ?? 0) > 1 && (
            <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500">{(trashData as any)?.totalCount} total · p{(trashData as any)?.page}/{(trashData as any)?.totalPages}</span>
              <div className="flex gap-1">
                <button onClick={() => setTrashPage(p => Math.max(1, p - 1))} disabled={trashPage <= 1} className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition">Prev</button>
                <button onClick={() => setTrashPage(p => Math.min((trashData as any).totalPages, p + 1))} disabled={trashPage >= ((trashData as any)?.totalPages ?? 1)} className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition">Next</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Desktop Table */}
      {activeTab === 'active' && isDesktop ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="p-10 text-center text-slate-400 text-sm">Loading coordinators…</div>
          ) : coordinators.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <Users className="w-10 h-10 mb-3 opacity-30" />
              <p className="text-sm font-medium">No coordinators found</p>
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
                  <th className="px-4 py-3.5 text-center text-xs font-semibold uppercase tracking-wider border-r border-slate-600">Total Reps</th>
                  <th className="px-4 py-3.5 text-center text-xs font-semibold uppercase tracking-wider border-r border-slate-600">Total Customers</th>
                  <th className="px-4 py-3.5 text-center text-xs font-semibold uppercase tracking-wider border-r border-slate-600">Status</th>
                  <th className="px-4 py-3.5 text-center text-xs font-semibold uppercase tracking-wider">Action</th>
                </tr>
                {!selectAllPages && selectedIds.size === coordinators.length && coordinators.length > 0 && ((data as any)?.totalPages ?? 1) > 1 && (
                  <tr className="bg-indigo-50 border-b border-indigo-100">
                    <td colSpan={7} className="px-4 py-1.5 text-center text-xs text-indigo-600">
                      All {coordinators.length} on this page selected —{' '}
                      <button onClick={() => setSelectAllPages(true)} className="font-semibold underline underline-offset-2 hover:text-indigo-800">
                        Select all {(data as any)?.totalCount} across all pages
                      </button>
                    </td>
                  </tr>
                )}
              </thead>
              <tbody>
                {coordinators.map((c: any) => {
                  const isSelected = selectedIds.has(c.id);
                  return (
                  <tr
                    key={c.id}
                    onClick={() => { if (selectionMode) toggleSelect(c.id); else navigate(`/admin/coordinators/${c.id}`); }}
                    className={`border-b border-slate-100 cursor-pointer transition-colors select-none text-sm ${
                      isSelected ? 'bg-indigo-50/70' : 'hover:bg-slate-50/70'
                    }`}
                  >
                    <td className="px-3 py-3 text-center border-r border-slate-100" onClick={e => { e.stopPropagation(); toggleSelect(c.id); }}>
                      <input type="checkbox" readOnly checked={isSelected} className="pointer-events-none accent-indigo-500 w-3.5 h-3.5" />
                    </td>
                    <td className="px-4 py-3 border-r border-slate-100">
                      <p className="font-semibold text-slate-800 text-sm">{c.fullName}</p>
                      <p className="text-xs text-slate-400">{c.employeeCode}</p>
                    </td>
                    <td className="px-4 py-3 border-r border-slate-100">
                      <p className="text-sm font-medium text-slate-800">{c.regionName || '—'}</p>
                    </td>
                    <td className="px-4 py-3 text-center border-r border-slate-100">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-semibold">
                        <Users className="w-3 h-3" /> {c.assignedRepsCount || 0}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center border-r border-slate-100">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold">
                        <TrendingUp className="w-3 h-3" /> {c.assignedCustomersCount || 0}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center border-r border-slate-100">
                      <StatusBadge status={c.isActive ? 'Active' : 'Inactive'} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          onClick={e => { e.stopPropagation(); navigate(`/admin/coordinators/${c.id}`); }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-600 text-xs font-medium hover:bg-indigo-100 transition"
                        >
                          <Pencil className="w-3.5 h-3.5" /> Edit
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); setSelectedIds(new Set([c.id])); setDeleteConfirmOpen(true); }}
                          disabled={deleteMut.isPending && deletingId === c.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 text-rose-600 text-xs font-medium hover:bg-rose-100 transition disabled:opacity-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {(data as any)?.totalPages > 1 && (
            <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500">{(data as any)?.totalCount} total · p{(data as any)?.page}/{(data as any)?.totalPages}</span>
              <div className="flex gap-1">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition">Prev</button>
                <button onClick={() => setPage(p => Math.min((data as any).totalPages, p + 1))} disabled={page >= (data as any).totalPages} className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition">Next</button>
              </div>
            </div>
          )}
        </div>
      ) : activeTab === 'active' ? (
        <MobileTileList data={coordinators} keyExtractor={c => c.id} isLoading={isLoading} emptyMessage="No coordinators found" emptyIcon={<Users className="w-10 h-10" />} page={(data as any)?.page} totalPages={(data as any)?.totalPages} onPageChange={setPage}
          renderTile={(c: any) => (
            <div className="p-4" onClick={() => navigate(`/admin/coordinators/${c.id}`)}>
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-start gap-3">
                  <button onClick={e => { e.stopPropagation(); toggleSelect(c.id); }} className={`mt-0.5 w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center transition ${selectedIds.has(c.id) ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300'}`}>
                    {selectedIds.has(c.id) && <Check className="w-3 h-3 text-white" />}
                  </button>
                  <div>
                    <p className="font-semibold text-slate-900">{c.fullName}</p>
                    <p className="text-xs text-slate-400">{c.employeeCode}</p>
                  </div>
                </div>
                <StatusBadge status={c.isActive ? 'Active' : 'Inactive'} />
              </div>
              <div className="flex items-center gap-3 text-xs mb-3">
                {c.regionName && <span className="flex items-center gap-1 text-slate-500"><MapPin className="w-3 h-3" /> {c.regionName}</span>}
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-medium"><Users className="w-3 h-3" /> {c.assignedRepsCount || 0} reps</span>
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium"><TrendingUp className="w-3 h-3" /> {c.assignedCustomersCount || 0}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={e => { e.stopPropagation(); navigate(`/admin/coordinators/${c.id}`); }}
                  className="w-full py-2 text-xs font-medium rounded-lg bg-indigo-50 text-indigo-700 active:scale-95 flex items-center justify-center gap-1.5"
                >
                  <Pencil className="w-3.5 h-3.5" /> Edit
                </button>
                <button
                  onClick={e => { e.stopPropagation(); handleDelete(c.id, c.fullName); }}
                  disabled={deleteMut.isPending && deletingId === c.id}
                  className="w-full py-2 text-xs font-medium rounded-lg bg-rose-50 text-rose-700 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" /> {deleteMut.isPending && deletingId === c.id ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          )}
        />
      ) : null}

      {/* Delete confirm dialog */}
      {deleteConfirmOpen && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h2 className="text-base font-bold text-slate-900 mb-1">Move {selectAllPages ? 'all' : selectedIds.size} coordinator{(!selectAllPages && selectedIds.size === 1) ? '' : 's'} to trash?</h2>
            <p className="text-sm text-slate-500 mb-5">They will be automatically removed after 30 days.</p>
            <div className="flex gap-3">
              <button onClick={() => { setDeleteConfirmOpen(false); if (selectedIds.size === 1) clearSelection(); }} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition">Cancel</button>
              <button onClick={handleDeleteSelected} className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition">Move to Trash</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
