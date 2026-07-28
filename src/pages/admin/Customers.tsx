// @ts-nocheck
import { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customersApi } from '../../services/api/customersApi';
import { customerRegistrationApi } from '../../services/api/customerRegistrationApi';
import { regionsApi } from '../../services/api/regionsApi';
import { adminGetAllCoordinators } from '../../services/api/coordinatorApi';
import { repsApi } from '../../services/api/repsApi';
import { formatCurrency, formatDate } from '../../utils/formatters';
import * as XLSX from 'xlsx';
import {
  Users, Plus, Search, X, SlidersHorizontal,
  ArrowUpDown, ArrowUp, ArrowDown,
  FileSpreadsheet, FileText, Check, ChevronRight,
  Clock, CheckCircle, XCircle, Eye, ClipboardList, Upload,
  Trash2, RotateCcw, AlertTriangle,
} from 'lucide-react';
import StatusBadge from '../../components/common/StatusBadge';
import { useAuth } from '../../hooks/useAuth';
import toast from 'react-hot-toast';

type SortField = 'shopName' | 'totalOrderValue' | 'createdAt';
type StatusFilter = '' | 'Approved' | 'PendingApproval' | 'Rejected';
type MainTab = 'customers' | 'requests' | 'trash';

export default function AdminCustomers() {
  const { user } = useAuth();
  const isCoordinatorView = user?.role === 'SalesCoordinator';
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const defaultTab = !isCoordinatorView && params.get('tab') === 'requests' ? 'requests' : 'customers';
  const [activeTab, setActiveTab] = useState<MainTab>(defaultTab);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('');
  const [coordinatorFilter, setCoordinatorFilter] = useState('');
  const [regionFilter, setRegionFilter] = useState('');
  const [subRegionFilter, setSubRegionFilter] = useState('');
  const [sortBy, setSortBy] = useState<SortField>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [filterSubPanel, setFilterSubPanel] = useState<'status' | 'region' | 'coordinator' | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectAllPages, setSelectAllPages] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [trashPage, setTrashPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [reqPage, setReqPage] = useState(1);
  const [isImporting, setIsImporting] = useState(false);
  const importFileRef = useRef<HTMLInputElement>(null);

  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const toggleFilter = () => setFilterPanelOpen(p => !p);

  const selectionMode = selectedIds.size > 0 || selectAllPages;
  const clearSelection = () => { setSelectedIds(new Set()); setSelectAllPages(false); };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') clearSelection(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const softDeleteMut = useMutation({
    mutationFn: (id: string) => customersApi.adminSoftDelete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-customers'] });
      queryClient.invalidateQueries({ queryKey: ['admin-customers-trash'] });
    },
  });

  const restoreMut = useMutation({
    mutationFn: (id: string) => customersApi.adminRestore(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-customers'] });
      queryClient.invalidateQueries({ queryKey: ['admin-customers-trash'] });
    },
  });

  const handleDeleteSelected = async () => {
    let ids: string[];
    if (selectAllPages) {
      const toastId = toast.loading('Fetching all customers…');
      try {
        const allData = await customersApi.adminGetAll({
          page: 1, pageSize: data?.totalCount || 9999,
          search: search || undefined,
          sortBy, sortOrder,
          approvalStatus: statusFilter || undefined,
          assignedCoordinatorId: coordinatorFilter || undefined,
          regionId: regionFilter || undefined,
          subRegionId: subRegionFilter || undefined,
        } as any).then((r: any) => r.data.data);
        ids = (allData?.items || []).map((c: any) => c.id);
        toast.dismiss(toastId);
      } catch {
        toast.error('Failed to fetch all customers', { id: toastId });
        return;
      }
    } else {
      if (!selectedIds.size) return;
      ids = Array.from(selectedIds);
    }
    let failed = 0;
    for (const id of ids) {
      try { await customersApi.adminSoftDelete(id); }
      catch { failed++; }
    }
    queryClient.invalidateQueries({ queryKey: ['admin-customers'] });
    queryClient.invalidateQueries({ queryKey: ['admin-customers-trash'] });
    if (failed === 0) toast.success(`${ids.length} customer${ids.length > 1 ? 's' : ''} moved to trash`);
    else toast.error(`${ids.length - failed} moved to trash, ${failed} failed`);
    setSelectedIds(new Set());
    setSelectAllPages(false);
  };

  // Filter options
  const { data: filters } = useQuery({
    queryKey: [isCoordinatorView ? 'coordinator-customer-filters' : 'admin-customer-filters'],
    queryFn: () =>
      (isCoordinatorView
        ? customersApi.coordinatorGetFilterOptions()
        : customersApi.adminGetFilterOptions()
      ).then(r => r.data.data),
  });

  // Regions with sub-regions (admin view) — use a distinct key to avoid type collision with CustomerDetail
  const { data: regionsLookup } = useQuery<any[]>({
    queryKey: ['regions-list-for-customers-filter'],
    queryFn: () => regionsApi.getAll().then((r: any) => r.data || r),
    enabled: !isCoordinatorView,
  });

  const filteredSubRegions = useMemo(() => {
    if (!regionFilter) return [];
    if (isCoordinatorView) return filters?.subRegions || [];
    const region = (regionsLookup || []).find((r: any) => r.id === regionFilter);
    return region?.subRegions || [];
  }, [regionsLookup, filters, regionFilter, isCoordinatorView]);

  // All coordinators for import lookup
  const { data: allCoordinatorsData } = useQuery({
    queryKey: ['admin-all-coordinators-import'],
    queryFn: () => adminGetAllCoordinators(1, 500),
    enabled: !isCoordinatorView,
  });

  // All reps for import lookup
  const { data: allRepsData } = useQuery({
    queryKey: ['admin-all-reps-import'],
    queryFn: () => repsApi.adminGetAll({ pageSize: 500 }).then(r => r.data.data),
    enabled: !isCoordinatorView,
  });

  // Import handler
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset input so same file can be re-imported
    e.target.value = '';

    setIsImporting(true);
    const toastId = toast.loading('Preparing import…');

    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

      if (!rows.length) {
        toast.error('The file has no rows', { id: toastId });
        setIsImporting(false);
        return;
      }

      const regions: any[] = regionsLookup || [];
      const coordinators: any[] = allCoordinatorsData?.items || [];
      const reps: any[] = allRepsData?.items || [];

      const normalize = (s: string) => (s || '').toString().trim().toLowerCase();

      let created = 0;
      let failed = 0;
      const errors: string[] = [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const shopName = (row['Shop Name'] || '').toString().trim();
        if (!shopName) { failed++; errors.push(`Row ${i + 2}: Missing Shop Name`); continue; }

        const rawTaxType = (row['Tax Type'] || '').toString().trim().toLowerCase();
        const customerType = rawTaxType === 'tax' ? 'Tax' : 'NonTax';

        // Region lookup
        const regionNameRaw = (row['Region'] || '').toString().trim();
        const region = regions.find((r: any) => normalize(r.name) === normalize(regionNameRaw));
        const regionId = region?.id || undefined;

        // Sub-region lookup (within the matched region or across all)
        const subRegionNameRaw = (row['Sub Region'] || '').toString().trim();
        let subRegionId: string | undefined;
        if (subRegionNameRaw) {
          const subRegions: any[] = region ? (region.subRegions || []) : regions.flatMap((r: any) => r.subRegions || []);
          const sr = subRegions.find((s: any) => normalize(s.name) === normalize(subRegionNameRaw));
          subRegionId = sr?.id;
        }

        // Coordinator lookup
        const coordinatorNameRaw = (row['Coordinator'] || '').toString().trim();
        let coordinatorId: string | undefined;
        if (coordinatorNameRaw) {
          const coord = coordinators.find((c: any) =>
            normalize(c.fullName) === normalize(coordinatorNameRaw) ||
            normalize(c.username) === normalize(coordinatorNameRaw)
          );
          coordinatorId = coord?.id;
        }

        // Rep lookup
        const repNameRaw = (row['Rep'] || '').toString().trim();
        let repId: string | undefined;
        if (repNameRaw) {
          const rep = reps.find((r: any) =>
            normalize(r.fullName) === normalize(repNameRaw) ||
            normalize(r.username) === normalize(repNameRaw)
          );
          repId = rep?.id;
        }

        // Generate a unique username: sanitize shop name + random suffix
        const base = shopName.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '').slice(0, 20);
        const suffix = Math.floor(1000 + Math.random() * 9000);
        const username = `${base}_${suffix}`;
        const password = `Import@${suffix}`;

        toast.loading(`Importing ${i + 1}/${rows.length}: ${shopName}`, { id: toastId });

        try {
          await customersApi.adminCreate({
            username,
            password,
            phoneNumber: '',
            shopName,
            customerType,
            regionId: regionId || null,
            subRegionId: subRegionId || null,
            assignedCoordinatorId: coordinatorId || null,
            assignedRepId: repId || null,
          });
          created++;
        } catch (err: any) {
          failed++;
          const msg = err?.response?.data?.message || err?.message || 'Unknown error';
          errors.push(`Row ${i + 2} (${shopName}): ${msg}`);
        }
      }

      queryClient.invalidateQueries({ queryKey: ['admin-customers'] });

      if (failed === 0) {
        toast.success(`Import complete — ${created} customers created`, { id: toastId });
      } else {
        toast.error(`Import done — ${created} created, ${failed} failed`, { id: toastId });
        console.warn('Import errors:', errors);
      }
    } catch (err: any) {
      toast.error(`Failed to read file: ${err?.message || 'Unknown error'}`, { id: toastId });
    } finally {
      setIsImporting(false);
    }
  };

  // Main customers query
  const { data, isLoading } = useQuery({
    queryKey: [
      isCoordinatorView ? 'coordinator-customers-admin-view' : 'admin-customers',
      page, search, sortBy, sortOrder,
      statusFilter, coordinatorFilter, regionFilter, subRegionFilter,
    ],
    queryFn: () =>
      (isCoordinatorView ? customersApi.coordinatorGetAll : customersApi.adminGetAll)({
        page, pageSize: 20,
        search: search || undefined,
        sortBy, sortOrder,
        approvalStatus: statusFilter || undefined,
        assignedCoordinatorId: coordinatorFilter || undefined,
        regionId: regionFilter || undefined,
        subRegionId: subRegionFilter || undefined,
      } as any).then(r => r.data.data),
  });
  const customers: any[] = data?.items || [];

  // Trash customers query (admin only)
  const { data: trashData, isLoading: trashLoading } = useQuery({
    queryKey: ['admin-customers-trash', trashPage],
    queryFn: () => customersApi.adminGetTrash({ page: trashPage, pageSize: 20 }).then(r => r.data.data),
    enabled: !isCoordinatorView && activeTab === 'trash',
  });
  const trashedCustomers: any[] = trashData?.items || [];

  // Always-enabled pending count — fixes badge not showing when on Customers tab
  const { data: pendingCountData } = useQuery({
    queryKey: ['admin-registration-requests-count'],
    queryFn: () =>
      customerRegistrationApi.adminGetAll({ page: 1, pageSize: 1, status: 'Pending' })
        .then(r => r.data.data),
    enabled: !isCoordinatorView,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
  const pendingCount: number = pendingCountData?.totalCount ?? 0;

  // Registration requests (fetched only when on requests tab)
  const { data: reqData, isLoading: reqLoading } = useQuery({
    queryKey: ['admin-registration-requests', reqPage],
    queryFn: () =>
      customerRegistrationApi.adminGetAll({ page: reqPage, pageSize: 20, status: 'Pending' })
        .then(r => r.data.data),
    enabled: !isCoordinatorView && activeTab === 'requests',
  });
  const reqItems: any[] = reqData?.items || [];

  const getCustomerTaxLabel = (c: any) => {
    const rawType = c?.customerType ?? c?.taxType;
    if (typeof rawType === 'string') {
      const n = rawType.trim().toLowerCase();
      if (n === 'tax') return 'Tax';
      if (n === 'nontax' || n === 'non tax' || n === 'non-tax') return 'Non Tax';
      return rawType;
    }
    if (typeof c?.isTaxCustomer === 'boolean') return c.isTaxCustomer ? 'Tax' : 'Non Tax';
    return 'Non Tax';
  };

  const clearFilters = () => {
    setSearch(''); setStatusFilter(''); setCoordinatorFilter('');
    setRegionFilter(''); setSubRegionFilter(''); setPage(1);
  };
  const activeFilterCount = [statusFilter, coordinatorFilter, regionFilter, subRegionFilter].filter(Boolean).length;

  const SortTh = ({ field, label, className = '' }: { field: SortField; label: string; className?: string }) => (
    <th
      className={`px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider border-r border-slate-600 cursor-pointer select-none hover:bg-slate-700 transition-colors ${className}`}
      onClick={() => {
        if (sortBy === field) setSortOrder(d => (d === 'asc' ? 'desc' : 'asc'));
        else { setSortBy(field); setSortOrder('asc'); }
      }}
    >
      <span className="flex items-center gap-1">
        {label}
        {sortBy === field
          ? (sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-300" /> : <ArrowDown className="w-3 h-3 text-indigo-300" />)
          : <ArrowUpDown className="w-3 h-3 text-slate-400" />}
      </span>
    </th>
  );

  const exportCustomers = async (format: 'excel' | 'pdf') => {
    let items: any[];

    if (selectAllPages) {
      const toastId = toast.loading('Fetching all customers for export…');
      try {
        const allData = await customersApi.adminGetAll({
          page: 1, pageSize: data?.totalCount || 9999,
          search: search || undefined,
          sortBy, sortOrder,
          approvalStatus: statusFilter || undefined,
          assignedCoordinatorId: coordinatorFilter || undefined,
          regionId: regionFilter || undefined,
          subRegionId: subRegionFilter || undefined,
        } as any).then((r: any) => r.data.data);
        items = allData?.items || [];
        toast.dismiss(toastId);
      } catch {
        toast.error('Failed to fetch all customers', { id: toastId });
        return;
      }
    } else if (selectedIds.size > 0) {
      items = customers.filter((c: any) => selectedIds.has(c.id));
    } else {
      items = customers;
    }

    if (!items.length) return;

    if (format === 'excel') {
      const wb = XLSX.utils.book_new();
      const rows = items.map((c: any) => ({
        'Shop Name': c.shopName,
        'Tax Type': getCustomerTaxLabel(c),
        'Region': c.regionName || '',
        'Sub-Region': c.subRegionName || '',
        'Coordinator': c.assignedCoordinatorName || '',
        'Assigned Rep': c.assignedRepName || '',
        'Total Orders': c.totalOrders || 0,
        'Total Order Value': c.totalOrderValue || 0,
        'Status': c.approvalStatus || (c.isActive ? 'Active' : 'Inactive'),
        'Created': c.createdAt ? formatDate(c.createdAt) : '',
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, 'Customers');
      XLSX.writeFile(wb, 'customers-export.xlsx');
      toast.success(`Exported ${items.length} customers to Excel`);
    } else {
      const { jsPDF } = await import('jspdf');
      const autoTable = (await import('jspdf-autotable')).default;
      const doc = new jsPDF();
      autoTable(doc, {
        head: [['Shop Name', 'Tax Type', 'Region', 'Coordinator', 'Rep', 'Orders', 'Order Value', 'Status']],
        body: items.map((c: any) => [
          c.shopName, getCustomerTaxLabel(c),
          c.regionName || '', c.assignedCoordinatorName || '',
          c.assignedRepName || '', c.totalOrders || 0,
          formatCurrency(c.totalOrderValue || 0),
          c.approvalStatus || (c.isActive ? 'Active' : 'Inactive'),
        ]),
        styles: { fontSize: 8 },
        startY: 20,
      });
      doc.save('customers-export.pdf');
      toast.success(`Exported ${items.length} customers to PDF`);
    }
  };

  return (
    <>
    <div className="animate-fade-in flex flex-col gap-4 pb-10">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Customers</h1>
        <p className="text-slate-500 text-sm mt-1">
          {isCoordinatorView
            ? 'View customer accounts in your assigned region'
            : 'Manage customer accounts and registration requests'}
        </p>
      </div>

      {/* ═══════════════════ CUSTOMERS TAB ═══════════════════ */}
      {activeTab === 'customers' && (
        <>
          {/* Sticky Toolbar */}
          <div className="sticky top-0 z-30">
            <div className="bg-white/95 backdrop-blur-sm border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              {/* Row 1: Tabs + Search + Add */}
              <div className="px-3 py-2.5 flex flex-wrap sm:flex-nowrap items-center gap-x-2 gap-y-2">

                {/* Tabs */}
                <div className="flex gap-0.5 bg-slate-100 p-0.5 rounded-lg shrink-0 order-1">
                  <button
                    onClick={() => { setActiveTab('customers'); clearSelection(); }}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                      activeTab === 'customers' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Customers
                    {data?.totalCount != null && <span className="ml-1 text-[10px] text-slate-400">{data.totalCount}</span>}
                  </button>
                  {!isCoordinatorView && (
                    <>
                      <button
                        onClick={() => { setActiveTab('requests'); clearSelection(); }}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                          activeTab === 'requests' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        Requests
                        {pendingCount > 0 && (
                          <span className="inline-flex items-center justify-center min-w-[16px] h-4 rounded-full bg-amber-500 text-white text-[9px] font-bold px-1">{pendingCount}</span>
                        )}
                      </button>
                      <button
                        onClick={() => { setActiveTab('trash'); clearSelection(); }}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                          activeTab === 'trash' ? 'bg-white shadow-sm text-rose-600' : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        <Trash2 className="w-3 h-3" />Trash
                      </button>
                    </>
                  )}
                </div>

                {/* Search */}
                <div className="relative group order-3 sm:order-2 w-full sm:w-auto sm:flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                  <input
                    type="text"
                    placeholder="Search shop name, email…"
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
                <div className="order-2 sm:order-3 ml-auto sm:ml-0 flex items-center gap-1 shrink-0">
                  {/* Filter */}
                  <button
                    onClick={toggleFilter}
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
                    onClick={() => exportCustomers('excel')}
                    className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 transition-all"
                    title={selectedIds.size > 0 ? `Export ${selectedIds.size} selected` : 'Export all'}
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span className="hidden lg:inline">{selectedIds.size > 0 ? `Excel (${selectedIds.size})` : 'Excel'}</span>
                  </button>

                  {/* PDF */}
                  <button
                    onClick={() => exportCustomers('pdf')}
                    className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-rose-50 hover:text-rose-600 transition-all"
                    title={selectedIds.size > 0 ? `Export ${selectedIds.size} selected` : 'Export all'}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span className="hidden lg:inline">{selectedIds.size > 0 ? `PDF (${selectedIds.size})` : 'PDF'}</span>
                  </button>

                  {!isCoordinatorView && (
                    <>
                      <div className="w-px h-5 bg-slate-200 mx-0.5" />
                      {/* Import */}
                      <button
                        onClick={() => importFileRef.current?.click()}
                        disabled={isImporting}
                        className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 transition-all disabled:opacity-50"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span className="hidden lg:inline">{isImporting ? 'Importing…' : 'Import'}</span>
                      </button>
                      <input
                        ref={importFileRef}
                        type="file"
                        accept=".xlsx,.xls"
                        className="hidden"
                        onChange={handleImportFile}
                      />
                      <div className="w-px h-5 bg-slate-200 mx-0.5" />
                      {/* Add */}
                      <button
                        onClick={() => navigate('/admin/customers/new')}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-all"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Add</span>
                      </button>
                    </>
                  )}

                  {/* Selection delete actions */}
                  {selectionMode && (selectedIds.size > 0 || selectAllPages) && (
                    <>
                      <div className="w-px h-5 bg-slate-200 mx-0.5" />
                      <button
                        onClick={() => setDeleteConfirmOpen(true)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-semibold text-red-600 hover:bg-red-50 transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span className="hidden lg:inline">
                          {selectAllPages ? `Trash all (${data?.totalCount ?? '…'})` : `Trash (${selectedIds.size})`}
                        </span>
                      </button>
                      <button onClick={() => { clearSelection(); }} className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
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
                      { key: 'status', label: 'Status', count: statusFilter ? 1 : 0 },
                      ...(!isCoordinatorView ? [{ key: 'region', label: 'Region', count: (regionFilter || subRegionFilter) ? 1 : 0 }] : []),
                      ...(!isCoordinatorView ? [{ key: 'coordinator', label: 'Coordinator', count: coordinatorFilter ? 1 : 0 }] : []),
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
                        onClick={clearFilters}
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
                        {(['', 'Approved', 'PendingApproval', 'Rejected'] as const).map(s => (
                          <button
                            key={s}
                            onClick={() => { setStatusFilter(s); setPage(1); }}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                              statusFilter === s
                                ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                                : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-700 hover:bg-indigo-50'
                            }`}
                          >
                            {statusFilter === s && <Check className="w-3 h-3" />}
                            {s === '' ? 'All' : s === 'PendingApproval' ? 'Pending' : s}
                          </button>
                        ))}
                      </div>
                    )}
                    {filterSubPanel === 'region' && !isCoordinatorView && (
                      <div className="flex flex-wrap gap-3">
                        <select
                          value={regionFilter}
                          onChange={e => { setRegionFilter(e.target.value); setSubRegionFilter(''); setPage(1); }}
                          className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/15 focus:border-indigo-400 transition cursor-pointer"
                        >
                          <option value="">All Regions</option>
                          {(regionsLookup || []).map((r: any) => (
                            <option key={r.id} value={r.id}>{r.name}</option>
                          ))}
                        </select>
                        {regionFilter && filteredSubRegions.length > 0 && (
                          <select
                            value={subRegionFilter}
                            onChange={e => { setSubRegionFilter(e.target.value); setPage(1); }}
                            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/15 focus:border-indigo-400 transition cursor-pointer"
                          >
                            <option value="">All Sub-regions</option>
                            {filteredSubRegions.map((sr: any) => (
                              <option key={sr.id} value={sr.id}>{sr.name}</option>
                            ))}
                          </select>
                        )}
                      </div>
                    )}
                    {filterSubPanel === 'coordinator' && !isCoordinatorView && (
                      <select
                        value={coordinatorFilter}
                        onChange={e => { setCoordinatorFilter(e.target.value); setPage(1); }}
                        className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/15 focus:border-indigo-400 transition cursor-pointer"
                      >
                        <option value="">All Coordinators</option>
                        {filters?.coordinators?.map((c: any) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Customers table / cards */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {isLoading ? (
              <div className="p-12 text-center text-slate-400 text-sm">Loading customers…</div>
            ) : !customers.length ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                <Users className="w-10 h-10 mb-3 opacity-30" />
                <p className="text-sm font-medium">No customers found</p>
              </div>
            ) : (
              <>
                {/* Desktop table (≥ lg) */}
                <table className="hidden lg:table w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-slate-800 text-white">
                      <th className="w-10 px-3 py-3.5 border-r border-slate-600 text-center">
                        <input
                          type="checkbox"
                          checked={selectAllPages || (customers.length > 0 && selectedIds.size === customers.length)}
                          ref={el => { if (el) el.indeterminate = !selectAllPages && selectedIds.size > 0 && selectedIds.size < customers.length; }}
                          onChange={() => {
                            if (selectAllPages) { setSelectAllPages(false); setSelectedIds(new Set()); }
                            else if (selectedIds.size === customers.length) { setSelectedIds(new Set()); }
                            else { setSelectedIds(new Set(customers.map((c: any) => c.id))); setSelectAllPages(false); }
                          }}
                          className="accent-indigo-400 w-3.5 h-3.5 cursor-pointer"
                        />
                      </th>
                      <SortTh field="shopName" label="Shop Name" />
                      <th className="px-4 py-3.5 text-center text-xs font-semibold uppercase tracking-wider border-r border-slate-600">Tax Type</th>
                      <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider border-r border-slate-600">Region</th>
                      <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider border-r border-slate-600">Sub-Region</th>
                      <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider border-r border-slate-600">Coordinator</th>
                      <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider border-r border-slate-600">Rep</th>
                      <th className="px-4 py-3.5 text-center text-xs font-semibold uppercase tracking-wider border-r border-slate-600">Status</th>
                      <SortTh field="createdAt" label="Created" />
                      <th className="px-4 py-3.5 text-center text-xs font-semibold uppercase tracking-wider">Action</th>
                    </tr>
                    {!selectAllPages && selectedIds.size === customers.length && customers.length > 0 && (data?.totalPages ?? 1) > 1 && (
                      <tr className="bg-indigo-50 border-b border-indigo-100">
                        <td colSpan={10} className="px-4 py-1.5 text-center text-xs text-indigo-600">
                          All {customers.length} on this page selected —{' '}
                          <button onClick={() => setSelectAllPages(true)} className="font-semibold underline underline-offset-2 hover:text-indigo-800">
                            Select all {data?.totalCount} across all pages
                          </button>
                        </td>
                      </tr>
                    )}
                  </thead>
                  <tbody>
                    {customers.map((c: any) => {
                      const isSelected = selectedIds.has(c.id);
                      return (
                      <tr
                        key={c.id}
                        onClick={() => {
                          if (selectionMode) {
                            setSelectedIds(prev => {
                              const next = new Set(prev);
                              if (next.has(c.id)) next.delete(c.id); else next.add(c.id);
                              return next;
                            });
                          }
                        }}
                        className={`border-b border-slate-100 cursor-pointer transition-colors select-none text-sm ${
                          isSelected ? 'bg-indigo-50/70' : 'hover:bg-slate-50/70'
                        }`}
                      >
                        <td className="px-3 py-3 text-center border-r border-slate-100" onClick={e => {
                          e.stopPropagation();
                          setSelectedIds(prev => { const next = new Set(prev); if (next.has(c.id)) next.delete(c.id); else next.add(c.id); return next; });
                        }}>
                          <input type="checkbox" readOnly checked={isSelected} className="pointer-events-none accent-indigo-500 w-3.5 h-3.5" />
                        </td>
                        <td className="px-4 py-3 border-r border-slate-100">
                          <p className="font-semibold text-slate-800 text-sm truncate max-w-[180px]" title={c.shopName}>
                            {c.shopName}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-center border-r border-slate-100">
                          <span className={`inline-flex whitespace-nowrap px-2 py-0.5 rounded-full text-[10px] font-medium ${
                            getCustomerTaxLabel(c) === 'Tax' ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'
                          }`}>
                            {getCustomerTaxLabel(c)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600 font-medium border-r border-slate-100 max-w-[110px] truncate">{c.regionName || '—'}</td>
                        <td className="px-4 py-3 text-sm text-slate-600 font-medium border-r border-slate-100 max-w-[110px] truncate">{c.subRegionName || '—'}</td>
                        <td className="px-4 py-3 text-sm text-slate-600 font-medium border-r border-slate-100 max-w-[120px] truncate">{c.assignedCoordinatorName || '—'}</td>
                        <td className="px-4 py-3 text-sm text-slate-600 font-medium border-r border-slate-100 max-w-[110px] truncate">{c.assignedRepName || '—'}</td>
                        <td className="px-4 py-3 text-center border-r border-slate-100">
                          <StatusBadge status={c.approvalStatus || (c.isActive ? 'Active' : 'Inactive')} />
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-500 border-r border-slate-100 whitespace-nowrap">{c.createdAt ? formatDate(c.createdAt) : '—'}</td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={e => { e.stopPropagation(); navigate(`/admin/customers/${c.id}`); }}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[11px] font-medium transition"
                          >
                            <Eye className="w-3 h-3" /> View
                          </button>
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Mobile cards */}
                <div className="lg:hidden divide-y divide-slate-100">
                  {customers.map((c: any) => (
                    <div key={c.id} className="p-4">
                      <div
                        className="flex items-start justify-between gap-2 cursor-pointer"
                        onClick={() => setExpandedId(p => (p === c.id ? null : c.id))}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-slate-900 text-sm truncate">{c.shopName}</p>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {c.regionName || 'No region'} · {getCustomerTaxLabel(c)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <StatusBadge status={c.approvalStatus || (c.isActive ? 'Active' : 'Inactive')} />
                          <ChevronRight
                            className={`w-4 h-4 text-slate-400 transition-transform ${expandedId === c.id ? 'rotate-90' : ''}`}
                          />
                        </div>
                      </div>
                      {expandedId === c.id && (
                        <div className="mt-3 pt-3 border-t border-slate-100 space-y-2 text-xs">
                          <div className="flex justify-between"><span className="text-slate-400">Coordinator</span><span className="font-medium">{c.assignedCoordinatorName || '—'}</span></div>
                          <div className="flex justify-between"><span className="text-slate-400">Rep</span><span className="font-medium">{c.assignedRepName || '—'}</span></div>
                          <div className="flex justify-between"><span className="text-slate-400">Sub-Region</span><span className="font-medium">{c.subRegionName || '—'}</span></div>
                          <div className="flex justify-between"><span className="text-slate-400">Total Orders</span><span className="font-bold text-slate-900">{c.totalOrders ?? 0}</span></div>
                          <div className="flex justify-between"><span className="text-slate-400">Order Value</span><span className="font-bold">{formatCurrency(c.totalOrderValue || 0)}</span></div>
                          <div className="flex justify-between"><span className="text-slate-400">Created</span><span>{c.createdAt ? formatDate(c.createdAt) : '—'}</span></div>
                          <button
                            onClick={() => navigate(`/admin/customers/${c.id}`)}
                            className="w-full mt-2 py-2 rounded-xl bg-indigo-600 text-white text-xs font-medium"
                          >
                            View Details
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
            {/* Pagination */}
            {data && data.totalPages > 1 && (
              <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs text-slate-500">
                  {data.totalCount} total · page {data.page} of {data.totalPages}
                </span>
                <div className="flex gap-1">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition"
                  >
                    Prev
                  </button>
                  <button
                    onClick={() => setPage(p => Math.min(data.totalPages, p + 1))}
                    disabled={page >= data.totalPages}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ═══════════════ REGISTRATION REQUESTS TAB ═══════════════ */}
      {!isCoordinatorView && activeTab === 'requests' && (
        <div className="flex flex-col gap-4">
          {/* Sticky tab bar */}
          <div className="sticky top-0 z-30">
            <div className="bg-white/95 backdrop-blur-sm border border-slate-200 rounded-2xl shadow-sm px-3 py-2.5">
              <div className="flex gap-0.5 bg-slate-100 p-0.5 rounded-lg w-fit">
                <button onClick={() => setActiveTab('customers')} className="px-3 py-1.5 rounded-md text-xs font-semibold transition-all text-slate-500 hover:text-slate-700">
                  Customers {data?.totalCount != null && <span className="ml-1 text-[10px] text-slate-400">{data.totalCount}</span>}
                </button>
                <button className="px-3 py-1.5 rounded-md text-xs font-semibold transition-all bg-white shadow-sm text-slate-800">
                  Requests {pendingCount > 0 && <span className="ml-1 inline-flex items-center justify-center min-w-[16px] h-4 rounded-full bg-amber-500 text-white text-[9px] font-bold px-1">{pendingCount}</span>}
                </button>
                <button onClick={() => setActiveTab('trash')} className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold transition-all text-slate-500 hover:text-slate-700">
                  <Trash2 className="w-3 h-3" />Trash
                </button>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">Pending registration requests awaiting review</p>
            <span className="text-xs text-slate-400">{reqData?.totalCount ?? pendingCount} pending</span>
          </div>
          {reqLoading ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400 text-sm">
              Loading requests…
            </div>
          ) : !reqItems.length ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 flex flex-col items-center text-slate-400">
              <ClipboardList className="w-12 h-12 mb-3 opacity-30" />
              <p className="text-sm font-medium">No pending registration requests</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="hidden lg:table w-full text-[12px] border-collapse">
                <thead>
                  <tr className="bg-slate-800 text-white">
                    <th className="text-left px-5 py-3.5 font-semibold text-xs uppercase tracking-wider border-r border-slate-600">Customer</th>
                    <th className="text-center px-5 py-3.5 font-semibold text-xs uppercase tracking-wider border-r border-slate-600">Type</th>
                    <th className="text-left px-5 py-3.5 font-semibold text-xs uppercase tracking-wider border-r border-slate-600">Contact</th>
                    <th className="text-center px-5 py-3.5 font-semibold text-xs uppercase tracking-wider border-r border-slate-600">Status</th>
                    <th className="text-left px-5 py-3.5 font-semibold text-xs uppercase tracking-wider border-r border-slate-600">Submitted</th>
                    <th className="text-center px-5 py-3.5 font-semibold text-xs uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {reqItems.map((r: any) => (
                    <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50 transition-all">
                        <td className="px-5 py-3.5 border-r border-slate-100">
                          <p className="font-semibold text-slate-800 text-xs">{r.customerName}</p>
                          <p className="text-[11px] text-slate-400">{r.businessName || '—'}</p>
                        </td>
                        <td className="px-5 py-3.5 text-center border-r border-slate-100">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            r.customerType === 'Tax' ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'
                          }`}>
                            {r.customerType}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 border-r border-slate-100">
                          <p className="text-xs text-slate-700">{r.email}</p>
                          <p className="text-[11px] text-slate-400">{r.telephone}</p>
                        </td>
                        <td className="px-5 py-3.5 text-center border-r border-slate-100">
                          {r.status === 'Pending' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                              <Clock className="w-3 h-3" /> Pending
                            </span>
                          )}
                          {r.status === 'Approved' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle className="w-3 h-3" /> Approved
                            </span>
                          )}
                          {r.status === 'Rejected' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-200">
                              <XCircle className="w-3 h-3" /> Rejected
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-xs text-slate-500 border-r border-slate-100">
                          {r.createdAt ? formatDate(r.createdAt) : '—'}
                        </td>
                        <td className="px-5 py-3.5 text-center">
                          <button
                            onClick={() => navigate(`/admin/customer-registrations/${r.id}`)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-medium transition"
                          >
                            <Eye className="w-3.5 h-3.5" /> Review
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {reqData && reqData.totalPages > 1 && (
                <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs text-slate-500">
                    {reqData.totalCount} total · page {reqData.page} of {reqData.totalPages}
                  </span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setReqPage(p => Math.max(1, p - 1))}
                      disabled={reqPage <= 1}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition"
                    >
                      Prev
                    </button>
                    <button
                      onClick={() => setReqPage(p => Math.min(reqData.totalPages, p + 1))}
                      disabled={reqPage >= reqData.totalPages}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════ TRASH TAB ═══════════════════ */}
      {!isCoordinatorView && activeTab === 'trash' && (
        <div className="flex flex-col gap-4">
          {/* Sticky tab bar */}
          <div className="sticky top-0 z-30">
            <div className="bg-white/95 backdrop-blur-sm border border-slate-200 rounded-2xl shadow-sm px-3 py-2.5">
              <div className="flex gap-0.5 bg-slate-100 p-0.5 rounded-lg w-fit">
                <button onClick={() => setActiveTab('customers')} className="px-3 py-1.5 rounded-md text-xs font-semibold transition-all text-slate-500 hover:text-slate-700">
                  Customers {data?.totalCount != null && <span className="ml-1 text-[10px] text-slate-400">{data.totalCount}</span>}
                </button>
                <button onClick={() => setActiveTab('requests')} className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold transition-all text-slate-500 hover:text-slate-700">
                  Requests {pendingCount > 0 && <span className="ml-1 inline-flex items-center justify-center min-w-[16px] h-4 rounded-full bg-amber-500 text-white text-[9px] font-bold px-1">{pendingCount}</span>}
                </button>
                <button className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold transition-all bg-white shadow-sm text-rose-600">
                  <Trash2 className="w-3 h-3" />Trash
                </button>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">Soft-deleted customers — restore to reinstate or they will be cleaned up automatically.</p>
            <span className="text-xs text-slate-400">{trashData?.totalCount ?? 0} in trash</span>
          </div>
          {trashLoading ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400 text-sm">
              Loading trash…
            </div>
          ) : !trashedCustomers.length ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 flex flex-col items-center text-slate-400">
              <Trash2 className="w-12 h-12 mb-3 opacity-30" />
              <p className="text-sm font-medium">Trash is empty</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <table className="hidden lg:table w-full text-[12px] border-collapse">
                <thead>
                  <tr className="bg-slate-800 text-white">
                    <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider border-r border-slate-600">Shop Name</th>
                    <th className="px-4 py-3.5 text-center text-xs font-semibold uppercase tracking-wider border-r border-slate-600">Tax Type</th>
                    <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider border-r border-slate-600">Region</th>
                    <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider border-r border-slate-600">Deleted</th>
                    <th className="px-4 py-3.5 text-center text-xs font-semibold uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {trashedCustomers.map((c: any) => (
                    <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3.5 border-r border-slate-100">
                        <p className="font-semibold text-slate-800 text-xs truncate max-w-[200px]">{c.shopName}</p>
                      </td>
                      <td className="px-4 py-3.5 text-center border-r border-slate-100">
                        <span className={`inline-flex whitespace-nowrap px-2 py-0.5 rounded-full text-[10px] font-medium ${
                          getCustomerTaxLabel(c) === 'Tax' ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'
                        }`}>
                          {getCustomerTaxLabel(c)}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-slate-500 font-medium border-r border-slate-100">{c.regionName || '—'}</td>
                      <td className="px-4 py-3.5 text-xs text-slate-500 border-r border-slate-100 whitespace-nowrap">{c.deletedAt ? formatDate(c.deletedAt) : '—'}</td>
                      <td className="px-4 py-3.5 text-center">
                        <button
                          onClick={() => {
                            restoreMut.mutate(c.id, {
                              onSuccess: () => toast.success(`${c.shopName} restored`),
                              onError: () => toast.error('Restore failed'),
                            });
                          }}
                          disabled={restoreMut.isPending}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[11px] font-medium transition disabled:opacity-50"
                        >
                          <RotateCcw className="w-3 h-3" /> Restore
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {/* Mobile trash cards */}
              <div className="lg:hidden divide-y divide-slate-100">
                {trashedCustomers.map((c: any) => (
                  <div key={c.id} className="p-4 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 text-sm truncate">{c.shopName}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{c.regionName || 'No region'} · {getCustomerTaxLabel(c)}</p>
                    </div>
                    <button
                      onClick={() => restoreMut.mutate(c.id, {
                        onSuccess: () => toast.success(`${c.shopName} restored`),
                      })}
                      className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-medium transition"
                    >
                      <RotateCcw className="w-3 h-3" /> Restore
                    </button>
                  </div>
                ))}
              </div>
              {trashData && trashData.totalPages > 1 && (
                <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs text-slate-500">{trashData.totalCount} total · page {trashData.page} of {trashData.totalPages}</span>
                  <div className="flex gap-1">
                    <button onClick={() => setTrashPage(p => Math.max(1, p - 1))} disabled={trashPage <= 1}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition">Prev</button>
                    <button onClick={() => setTrashPage(p => Math.min(trashData.totalPages, p + 1))} disabled={trashPage >= trashData.totalPages}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition">Next</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>

      {/* Delete confirm dialog */}
      {deleteConfirmOpen && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h2 className="text-base font-bold text-slate-900 mb-1">
              Move {selectAllPages ? `all ${data?.totalCount ?? '…'}` : selectedIds.size} customer{(!selectAllPages && selectedIds.size === 1) ? '' : 's'} to trash?
            </h2>
            <p className="text-sm text-slate-500 mb-5">They can be restored from the Trash tab.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirmOpen(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition">Cancel</button>
              <button onClick={() => { setDeleteConfirmOpen(false); handleDeleteSelected(); }} className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition">Move to Trash</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
