// @ts-nocheck
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { repsApi } from '../../services/api/repsApi';
import { customersApi } from '../../services/api/customersApi';
import { regionsApi } from '../../services/api/regionsApi';
import { adminGetAllCoordinators } from '../../services/api/coordinatorApi';
import { authApi } from '../../services/api/authApi';
import { formatCurrency, formatDate } from '../../utils/formatters';
import {
  ArrowLeft, MapPin, Users, User, Target, TrendingUp,
  Calendar, Trash2, Plus, ChevronRight, Power,
  Eye, EyeOff, KeyRound, Copy, Search, PencilLine, Save, Check,
} from 'lucide-react';
import toast from 'react-hot-toast';
import StatusBadge from '../../components/common/StatusBadge';
import ConfirmModal from '../../components/common/ConfirmModal';
import AdminTargetCard from '../../components/targetReports/AdminTargetCard';

// ─── Searchable multi-select panel ────────────────────────────────────────────

function SelectPanel({
  label, color, items, selectedIds, onToggle, onClear, getLabel, getSublabel,
}: {
  label: string;
  color: 'blue' | 'indigo' | 'violet';
  items: any[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  onClear: () => void;
  getLabel: (item: any) => string;
  getSublabel?: (item: any) => string;
}) {
  const [search, setSearch] = useState('');

  const filtered = items.filter(item =>
    getLabel(item).toLowerCase().includes(search.toLowerCase()) ||
    (getSublabel && getSublabel(item).toLowerCase().includes(search.toLowerCase()))
  );
  const selected = filtered.filter(i => selectedIds.includes(i.id));
  const unselected = filtered.filter(i => !selectedIds.includes(i.id));
  const sorted = [...selected, ...unselected];

  const c = {
    blue:   { accent: 'text-blue-600',   badge: 'bg-blue-100 text-blue-700',     check: 'accent-blue-600',   row: 'bg-blue-50 border-l-2 border-blue-500',     text: 'text-blue-700 font-medium' },
    indigo: { accent: 'text-indigo-600', badge: 'bg-indigo-100 text-indigo-700', check: 'accent-indigo-600', row: 'bg-indigo-50 border-l-2 border-indigo-500', text: 'text-indigo-700 font-medium' },
    violet: { accent: 'text-violet-600', badge: 'bg-violet-100 text-violet-700', check: 'accent-violet-600', row: 'bg-violet-50 border-l-2 border-violet-500', text: 'text-violet-700 font-medium' },
  }[color];

  return (
    <div className="flex flex-col border border-slate-200 rounded-xl overflow-hidden bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 bg-slate-50 border-b border-slate-200 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className={`text-[11px] font-bold uppercase tracking-wider ${c.accent}`}>{label}</span>
          {selectedIds.length > 0 && (
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${c.badge}`}>
              {selectedIds.length}
            </span>
          )}
        </div>
        {selectedIds.length > 0 && (
          <button onClick={onClear} className="text-[10px] text-slate-400 hover:text-red-500 font-medium transition">
            Clear
          </button>
        )}
      </div>
      {/* Search */}
      <div className="relative border-b border-slate-100 flex-shrink-0">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search…"
          className="w-full pl-7 pr-3 py-2 text-xs text-slate-700 bg-white focus:outline-none placeholder:text-slate-400 transition"
        />
      </div>
      {/* List */}
      <div className="overflow-y-auto divide-y divide-slate-50" style={{ maxHeight: '200px' }}>
        {items.length === 0 ? (
          <p className="text-xs text-slate-400 p-3 text-center">None available</p>
        ) : sorted.length === 0 ? (
          <p className="text-xs text-slate-400 p-3 text-center">No matches</p>
        ) : sorted.map((item: any) => {
          const isSelected = selectedIds.includes(item.id);
          return (
            <label
              key={item.id}
              className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer transition-colors ${
                isSelected ? c.row : 'hover:bg-slate-50 border-l-2 border-transparent'
              }`}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => onToggle(item.id)}
                className={`${c.check} w-3.5 h-3.5 flex-shrink-0`}
              />
              <div className="min-w-0 leading-tight flex items-baseline gap-1.5 flex-wrap">
                <span className={`text-sm truncate ${isSelected ? c.text : 'text-slate-700'}`}>
                  {getLabel(item)}
                </span>
                {getSublabel && (
                  <span className="text-[10px] text-slate-400 font-normal flex-shrink-0">{getSublabel(item)}</span>
                )}
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
}

// ─── Per-field inline editable row — double-click to edit ───────────────────

function InlineEditRow({ label, displayValue, isEditing, onDoubleClick, onCommit, onCancel, inputType = 'text' }: {
  label: string;
  displayValue: string;
  isEditing: boolean;
  onDoubleClick: () => void;
  onCommit: (val: string) => void;
  onCancel: () => void;
  inputType?: string;
}) {
  const [draft, setDraft] = useState(displayValue);
  const inputRef = useRef<HTMLInputElement>(null);
  const committedRef = useRef(false);

  useEffect(() => {
    if (isEditing) {
      setDraft(displayValue);
      committedRef.current = false;
      setTimeout(() => { inputRef.current?.focus(); inputRef.current?.select?.(); }, 0);
    }
  }, [isEditing, displayValue]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); committedRef.current = true; onCommit(draft); }
    if (e.key === 'Escape') { committedRef.current = true; onCancel(); }
  };

  const handleBlur = () => {
    if (!committedRef.current) { committedRef.current = true; onCommit(draft); }
  };

  return (
    <div className="flex items-center justify-between gap-4 px-5 py-3 group">
      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider w-28 flex-shrink-0">{label}</span>
      {isEditing ? (
        <input
          ref={inputRef}
          type={inputType}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className="flex-1 min-w-0 px-3 py-1.5 border border-blue-400 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white transition"
        />
      ) : (
        <span
          className="text-sm font-medium text-slate-800 text-right truncate flex-1 min-w-0 flex items-center justify-end gap-1.5 cursor-pointer hover:text-blue-600 transition-colors"
          onDoubleClick={onDoubleClick}
          title="Double-click to edit"
        >
          <span className="truncate">{displayValue || '—'}</span>
          <PencilLine className="w-3 h-3 opacity-0 group-hover:opacity-40 flex-shrink-0 transition-opacity" />
        </span>
      )}
    </div>
  );
}

// ─── Credential inline input (with optional eye toggle) ──────────────────────

function CredInlineInput({ defaultValue, inputType, showToggle, showPassword, onToggleShow, onCommit, onCancel }: {
  defaultValue: string;
  inputType: string;
  showToggle?: boolean;
  showPassword?: boolean;
  onToggleShow?: () => void;
  onCommit: (val: string) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);
  const committedRef = useRef(false);

  useEffect(() => {
    setDraft(defaultValue);
    committedRef.current = false;
    setTimeout(() => { inputRef.current?.focus(); }, 0);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); committedRef.current = true; onCommit(draft); }
    if (e.key === 'Escape') { committedRef.current = true; onCancel(); }
  };

  const handleBlur = () => {
    if (!committedRef.current) { committedRef.current = true; onCommit(draft); }
  };

  return (
    <div className="relative flex-1 min-w-0">
      <input
        ref={inputRef}
        type={inputType}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder="Enter new password"
        className={`w-full px-3 py-1.5 border border-blue-400 rounded-lg text-sm text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition ${showToggle ? 'pr-9' : ''}`}
      />
      {showToggle && (
        <button
          onMouseDown={e => { e.preventDefault(); onToggleShow?.(); }}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
          type="button"
          tabIndex={-1}
        >
          {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
        </button>
      )}
    </div>
  );
}

type Tab = 'details' | 'targets' | 'customers';

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function AdminRepDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [activeTab, setActiveTab] = useState<Tab>('details');

  // Inline edit
  const [editingField, setEditingField] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);

  // Territory
  const [selectedRegionIds, setSelectedRegionIds] = useState<string[]>([]);
  const [selectedSubRegionIds, setSelectedSubRegionIds] = useState<string[]>([]);
  const [selectedCoordIds, setSelectedCoordIds] = useState<string[]>([]);

  // Targets
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [targetForm, setTargetForm] = useState({
    targetName: '',
    targetPeriod: 'Monthly',
    startDate: '',
    endDate: '',
    targetAmount: '',
  });

  // ── Queries ────────────────────────────────────────────────────────────────

  const { data: rep, isLoading: repLoading } = useQuery({
    queryKey: ['admin-rep', id],
    queryFn: () => repsApi.adminGetById(id!).then(r => r.data.data),
    enabled: !!id,
  });

  useEffect(() => {
    if (!rep) return;
    setSelectedRegionIds(rep.regionIds || []);
    setSelectedSubRegionIds(rep.subRegionIds || []);
    setSelectedCoordIds(rep.coordinatorIds || []);
  }, [rep]);

  const { data: performance } = useQuery({
    queryKey: ['admin-rep-performance', id],
    queryFn: () => repsApi.adminGetPerformance(id!, {
      from: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString(),
      to: new Date().toISOString(),
    }).then(r => r.data.data),
    enabled: !!id,
  });

  const { data: targets } = useQuery({
    queryKey: ['admin-rep-targets', id],
    queryFn: () => repsApi.adminGetTargets(id!).then(r => r.data.data),
    enabled: !!id,
  });

  const { data: customersData } = useQuery({
    queryKey: ['admin-rep-customers', id],
    queryFn: () => customersApi.adminGetAll({ page: 1, pageSize: 200, assignedRepId: id }).then(r => r.data.data),
    enabled: !!id,
  });

  const { data: regions } = useQuery({
    queryKey: ['regions'],
    queryFn: () => regionsApi.getAll().then(r => r.data || []),
  });

  const { data: coordinatorsData } = useQuery({
    queryKey: ['coordinators-list'],
    queryFn: () => adminGetAllCoordinators(1, 100).then(r => r.items || []),
  });

  // ── Mutations ──────────────────────────────────────────────────────────────

  const invalidateRep = () => {
    qc.invalidateQueries({ queryKey: ['admin-rep', id] });
    qc.invalidateQueries({ queryKey: ['admin-reps'] });
  };

  const [pendingConfirm, setPendingConfirm] = useState<{
    field: string; label: string; oldValue: string; newValue: string; type: 'info' | 'password';
  } | null>(null);

  const updateInfoMut = useMutation({
    mutationFn: (data: any) => repsApi.adminUpdate(id!, data),
    onSuccess: () => { invalidateRep(); setPendingConfirm(null); toast.success('Saved'); },
    onError: (e: any) => { toast.error(e?.response?.data?.message || 'Failed to update'); setPendingConfirm(null); },
  });

  const setPasswordMut = useMutation({
    mutationFn: (password: string) => authApi.adminSetUserPassword(rep!.userId, password),
    onSuccess: () => { invalidateRep(); setPendingConfirm(null); toast.success('Password updated'); },
    onError: (e: any) => { toast.error(e?.response?.data?.message || 'Failed to update password'); setPendingConfirm(null); },
  });

  const handleInfoCommit = (field: string, label: string, currentRaw: string, newVal: string) => {
    setEditingField(null);
    const trimmed = newVal.trim();
    if (trimmed === currentRaw.trim()) return;
    setPendingConfirm({ field, label, oldValue: currentRaw || '(empty)', newValue: trimmed, type: 'info' });
  };

  const handleCredCommit = (type: 'info' | 'password', field: string, label: string, oldVal: string, newVal: string) => {
    setEditingField(null);
    setShowPassword(false);
    const trimmed = newVal.trim();
    if (!trimmed) return;
    setPendingConfirm({ field, label, oldValue: oldVal || '(empty)', newValue: trimmed, type });
  };

  const handleConfirmSave = () => {
    if (!pendingConfirm) return;
    if (pendingConfirm.type === 'password') {
      setPasswordMut.mutate(pendingConfirm.newValue);
    } else {
      updateInfoMut.mutate({ [pendingConfirm.field]: pendingConfirm.newValue || null });
    }
  };

  const updateAssignmentMut = useMutation({
    mutationFn: (data: any) => repsApi.adminUpdate(id!, data),
    onSuccess: () => { invalidateRep(); toast.success('Territory saved'); },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed to save assignment'),
  });

  const toggleActiveMut = useMutation({
    mutationFn: () => repsApi.adminUpdate(id!, { isActive: !rep?.isActive }),
    onSuccess: () => { invalidateRep(); toast.success(rep?.isActive ? 'Rep deactivated' : 'Rep activated'); },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed'),
  });

  const setTargetMut = useMutation({
    mutationFn: (data: any) => repsApi.adminSetTarget(id!, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-rep-targets', id] });
      setTargetForm({
        targetName: '',
        targetPeriod: 'Monthly',
        startDate: '',
        endDate: '',
        targetAmount: '',
      });
      toast.success('Target added');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed'),
  });

  const deleteTargetMut = useMutation({
    mutationFn: (tid: string) => repsApi.adminDeleteTarget(tid),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-rep-targets', id] });
      setDeleteTargetId(null);
      toast.success('Target deleted');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed'),
  });

  // ── Derived ────────────────────────────────────────────────────────────────

  const customers = customersData?.items || [];
  const coordinators = coordinatorsData || [];
  const regionList = Array.isArray(regions) ? regions : [];

  const allSubRegions = useMemo(() =>
    regionList.flatMap((r: any) => (r.subRegions || []).map((s: any) => ({ ...s, regionName: r.name }))),
    [regionList]
  );

  const assignmentChanged =
    JSON.stringify([...selectedRegionIds].sort()) !== JSON.stringify([...(rep?.regionIds || [])].sort()) ||
    JSON.stringify([...selectedSubRegionIds].sort()) !== JSON.stringify([...(rep?.subRegionIds || [])].sort()) ||
    JSON.stringify([...selectedCoordIds].sort()) !== JSON.stringify([...(rep?.coordinatorIds || [])].sort());

  const achievementPct = performance
    ? Math.min(Math.round((performance.achievedAmount / (performance.targetAmount || 1)) * 100), 100)
    : 0;

  // ── Loading / not found ────────────────────────────────────────────────────

  if (repLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-9 h-9 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!rep) {
    return (
      <div className="text-center py-32 text-slate-400">
        <User className="w-12 h-12 mx-auto mb-3 opacity-20" />
        <p className="font-medium">Rep not found.</p>
        <button onClick={() => navigate('/admin/reps')} className="mt-4 text-blue-600 text-sm font-medium hover:underline">
          ← Back to Reps
        </button>
      </div>
    );
  }

  const tabs = [
    { id: 'details' as Tab,   label: 'Details',   icon: User },
    { id: 'targets' as Tab,   label: 'Targets',   icon: Target, count: targets?.length ?? 0 },
    { id: 'customers' as Tab, label: 'Customers', icon: Users,  count: rep?.assignedCustomersCount ?? customers.length },
  ];

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5 pb-16">

      {/* ── Page Header ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-start gap-4">
          <button
            onClick={() => navigate('/admin/reps')}
            className="p-2 rounded-lg hover:bg-slate-100 transition text-slate-400 flex-shrink-0 mt-0.5"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          {/* Avatar */}
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center flex-shrink-0 shadow-sm select-none">
            <span className="text-white font-bold text-xl">{rep.fullName?.charAt(0)?.toUpperCase() || '?'}</span>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-0.5">
              <h1 className="text-xl font-bold text-slate-900">{rep.fullName}</h1>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                rep.isActive
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-slate-100 text-slate-500 border-slate-200'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${rep.isActive ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                {rep.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
            <p className="text-sm text-slate-400 mb-3">{rep.employeeCode} · Sales Representative</p>

            {/* Inline stats */}
            <div className="flex flex-wrap gap-x-5 gap-y-1.5">
              <div className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-sm font-semibold text-slate-700">{rep.assignedCustomersCount ?? customers.length}</span>
                <span className="text-xs text-slate-400">customers</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-sm font-semibold text-slate-700">{targets?.length ?? 0}</span>
                <span className="text-xs text-slate-400">targets</span>
              </div>
              {performance && <>
                <div className="flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-sm font-semibold text-slate-700">{achievementPct}%</span>
                  <span className="text-xs text-slate-400">achievement</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-slate-400">Sales:</span>
                  <span className="text-sm font-semibold text-slate-700">{formatCurrency(performance.totalSales)}</span>
                </div>
              </>}
            </div>
          </div>

          <button
            onClick={() => toggleActiveMut.mutate()}
            disabled={toggleActiveMut.isPending}
            className={`hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition flex-shrink-0 disabled:opacity-50 ${
              rep.isActive
                ? 'border-red-200 text-red-600 bg-red-50 hover:bg-red-100'
                : 'border-emerald-200 text-emerald-600 bg-emerald-50 hover:bg-emerald-100'
            }`}
          >
            <Power className="w-4 h-4" />
            {toggleActiveMut.isPending ? '…' : rep.isActive ? 'Deactivate' : 'Activate'}
          </button>
        </div>
      </div>

      {/* ── Tab Bar ── */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                active ? 'bg-white text-blue-700 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {tab.count !== undefined && tab.count > 0 && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  active ? 'bg-blue-100 text-blue-600' : 'bg-slate-200 text-slate-500'
                }`}>{tab.count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* ════════════════════════════════════════
          DETAILS TAB
      ════════════════════════════════════════ */}
      {activeTab === 'details' && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

          {/* Left: Info + Credentials */}
          <div className="lg:col-span-2 space-y-5">

            {/* Representative Info */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100">
                <User className="w-4 h-4 text-blue-500" />
                <h3 className="text-sm font-semibold text-slate-800">Representative Info</h3>
              </div>
              <div className="divide-y divide-slate-50">
                <InlineEditRow
                  label="Full Name"
                  displayValue={rep.fullName || ''}
                  isEditing={editingField === 'fullName'}
                  onDoubleClick={() => setEditingField('fullName')}
                  onCommit={v => handleInfoCommit('fullName', 'Full Name', rep.fullName || '', v)}
                  onCancel={() => setEditingField(null)}
                />
                <InlineEditRow
                  label="Employee Code"
                  displayValue={rep.employeeCode || ''}
                  isEditing={editingField === 'employeeCode'}
                  onDoubleClick={() => setEditingField('employeeCode')}
                  onCommit={v => handleInfoCommit('employeeCode', 'Employee Code', rep.employeeCode || '', v)}
                  onCancel={() => setEditingField(null)}
                />
                <InlineEditRow
                  label="Phone"
                  displayValue={rep.phoneNumber || ''}
                  isEditing={editingField === 'phoneNumber'}
                  onDoubleClick={() => setEditingField('phoneNumber')}
                  onCommit={v => handleInfoCommit('phoneNumber', 'Phone', rep.phoneNumber || '', v)}
                  onCancel={() => setEditingField(null)}
                  inputType="tel"
                />
                <InlineEditRow
                  label="Email"
                  displayValue={rep.email || ''}
                  isEditing={editingField === 'email'}
                  onDoubleClick={() => setEditingField('email')}
                  onCommit={v => handleInfoCommit('email', 'Email', rep.email || '', v)}
                  onCancel={() => setEditingField(null)}
                  inputType="email"
                />
                <InlineEditRow
                  label="Hire Date"
                  displayValue={rep.hireDate ? rep.hireDate.split('T')[0] : ''}
                  isEditing={editingField === 'hireDate'}
                  onDoubleClick={() => setEditingField('hireDate')}
                  onCommit={v => handleInfoCommit('hireDate', 'Hire Date', rep.hireDate ? rep.hireDate.split('T')[0] : '', v)}
                  onCancel={() => setEditingField(null)}
                  inputType="date"
                />
              </div>
              <p className="px-5 py-2 text-[10px] text-slate-400 italic border-t border-slate-50">Double-click any value to edit</p>
            </div>

            {/* Login Credentials */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100">
                <KeyRound className="w-4 h-4 text-blue-500" />
                <h3 className="text-sm font-semibold text-slate-800">Login Credentials</h3>
              </div>

              <div className="divide-y divide-slate-50">
                {/* Username */}
                <div className="flex items-center justify-between gap-4 px-5 py-3 group">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider w-28 flex-shrink-0">Username</span>
                  {editingField === 'credUsername' ? (
                    <CredInlineInput
                      defaultValue={rep.employeeCode || rep.username || ''}
                      inputType="text"
                      onCommit={v => handleCredCommit('info', 'employeeCode', 'Username', rep.employeeCode || rep.username || '', v)}
                      onCancel={() => setEditingField(null)}
                    />
                  ) : (
                    <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
                      <span
                        className="text-sm font-medium text-slate-800 font-mono truncate flex items-center gap-1.5 cursor-pointer hover:text-blue-600 transition-colors"
                        onDoubleClick={() => setEditingField('credUsername')}
                        title="Double-click to edit"
                      >
                        <span className="truncate">{rep.employeeCode || rep.username || '—'}</span>
                        <PencilLine className="w-3 h-3 opacity-0 group-hover:opacity-40 flex-shrink-0 transition-opacity" />
                      </span>
                      <button
                        onClick={() => { navigator.clipboard.writeText(rep.employeeCode || rep.username || ''); toast.success('Copied!'); }}
                        className="p-1 text-slate-400 hover:text-blue-600 rounded transition flex-shrink-0"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Password */}
                <div className="flex items-center justify-between gap-4 px-5 py-3 group">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider w-28 flex-shrink-0">Password</span>
                  {editingField === 'credPassword' ? (
                    <CredInlineInput
                      defaultValue={''}
                      inputType={showPassword ? 'text' : 'password'}
                      showToggle
                      showPassword={showPassword}
                      onToggleShow={() => setShowPassword(p => !p)}
                      onCommit={v => { handleCredCommit('password', 'password', 'Password', '(current password)', v); }}
                      onCancel={() => { setEditingField(null); setShowPassword(false); }}
                    />
                  ) : (
                    <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
                      <span
                        className="text-sm font-medium text-slate-800 font-mono flex items-center gap-1.5 cursor-pointer hover:text-blue-600 transition-colors"
                        onDoubleClick={() => setEditingField('credPassword')}
                        title="Double-click to change password"
                      >
                        <span>{rep.temporaryPassword ? (showCurrentPassword ? rep.temporaryPassword : '••••••••') : '—'}</span>
                        <PencilLine className="w-3 h-3 opacity-0 group-hover:opacity-40 flex-shrink-0 transition-opacity" />
                      </span>
                      {rep.temporaryPassword && (
                        <>
                          <button
                            onMouseDown={e => { e.preventDefault(); setShowCurrentPassword(p => !p); }}
                            className="p-1 text-slate-400 hover:text-slate-600 rounded transition flex-shrink-0"
                            type="button"
                            title={showCurrentPassword ? 'Hide password' : 'Show password'}
                          >
                            {showCurrentPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            onClick={() => { navigator.clipboard.writeText(rep.temporaryPassword); toast.success('Password copied!'); }}
                            className="p-1 text-slate-400 hover:text-blue-600 rounded transition flex-shrink-0"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <p className="px-5 py-2 text-[10px] text-slate-400 italic border-t border-slate-50">Double-click any value to edit</p>
            </div>
          </div>

          {/* Right: Territory Assignment */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <MapPin className="w-4 h-4 text-blue-500" />
                  <h3 className="text-sm font-semibold text-slate-800">Territory Assignment</h3>
                  {assignmentChanged && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full border border-amber-200 animate-pulse">
                      Unsaved
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {assignmentChanged && (
                    <button
                      onClick={() => {
                        setSelectedRegionIds(rep.regionIds || []);
                        setSelectedSubRegionIds(rep.subRegionIds || []);
                        setSelectedCoordIds(rep.coordinatorIds || []);
                      }}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200 transition"
                    >
                      Reset
                    </button>
                  )}
                  <button
                    onClick={() => updateAssignmentMut.mutate({
                      regionIds: selectedRegionIds,
                      subRegionIds: selectedSubRegionIds,
                      coordinatorIds: selectedCoordIds,
                    })}
                    disabled={!assignmentChanged || updateAssignmentMut.isPending}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Save className="w-3 h-3" />
                    {updateAssignmentMut.isPending ? 'Saving…' : 'Save Assignment'}
                  </button>
                </div>
              </div>

              {/* Selected summary — labeled text */}
              {(selectedRegionIds.length > 0 || selectedSubRegionIds.length > 0 || selectedCoordIds.length > 0) && (
                <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/60 space-y-1.5">
                  {selectedRegionIds.length > 0 && (
                    <div className="flex items-baseline gap-1.5 flex-wrap text-xs">
                      <span className="font-semibold text-blue-600 flex-shrink-0">Regions:</span>
                      <span className="text-slate-700">{selectedRegionIds.map(rid => regionList.find((x: any) => x.id === rid)?.name).filter(Boolean).join(', ')}</span>
                    </div>
                  )}
                  {selectedSubRegionIds.length > 0 && (
                    <div className="flex items-baseline gap-1.5 flex-wrap text-xs">
                      <span className="font-semibold text-indigo-600 flex-shrink-0">Sub-Regions:</span>
                      <span className="text-slate-700">{selectedSubRegionIds.map(sid => allSubRegions.find((x: any) => x.id === sid)?.name).filter(Boolean).join(', ')}</span>
                    </div>
                  )}
                  {selectedCoordIds.length > 0 && (
                    <div className="flex items-baseline gap-1.5 flex-wrap text-xs">
                      <span className="font-semibold text-violet-600 flex-shrink-0">Coordinators:</span>
                      <span className="text-slate-700">{selectedCoordIds.map(cid => coordinators.find((x: any) => x.id === cid)?.fullName).filter(Boolean).join(', ')}</span>
                    </div>
                  )}
                </div>
              )}

              <div className="p-5 mb-12 grid grid-cols-1 md:grid-cols-3 gap-4">
                <SelectPanel
                  label="Regions"
                  color="blue"
                  items={regionList}
                  selectedIds={selectedRegionIds}
                  onToggle={itemId => setSelectedRegionIds(prev => prev.includes(itemId) ? prev.filter(x => x !== itemId) : [...prev, itemId])}
                  onClear={() => setSelectedRegionIds([])}
                  getLabel={(item: any) => item.name}
                />
                <SelectPanel
                  label="Sub-Regions"
                  color="indigo"
                  items={allSubRegions}
                  selectedIds={selectedSubRegionIds}
                  onToggle={itemId => setSelectedSubRegionIds(prev => prev.includes(itemId) ? prev.filter(x => x !== itemId) : [...prev, itemId])}
                  onClear={() => setSelectedSubRegionIds([])}
                  getLabel={(item: any) => item.name}
                  getSublabel={(item: any) => item.regionName}
                />
                <SelectPanel
                  label="Coordinators"
                  color="violet"
                  items={coordinators}
                  selectedIds={selectedCoordIds}
                  onToggle={itemId => setSelectedCoordIds(prev => prev.includes(itemId) ? prev.filter(x => x !== itemId) : [...prev, itemId])}
                  onClear={() => setSelectedCoordIds([])}
                  getLabel={(item: any) => item.fullName}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════
          TARGETS TAB
      ════════════════════════════════════════ */}
      {activeTab === 'targets' && (
        <div className="space-y-5">

          {/* Add Target */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100">
              <Plus className="w-4 h-4 text-blue-500" />
              <h3 className="text-sm font-semibold text-slate-800">New Target</h3>
            </div>
            <div className="p-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4 mb-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Target Name</label>
                  <input
                    type="text"
                    maxLength={100}
                    placeholder="e.g. July Main Target"
                    value={targetForm.targetName}
                    onChange={e => setTargetForm(p => ({ ...p, targetName: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Period</label>
                  <select
                    value={targetForm.targetPeriod}
                    onChange={e => setTargetForm(p => ({ ...p, targetPeriod: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                  >
                    <option>Monthly</option>
                    <option>Quarterly</option>
                    <option>Yearly</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Start Date</label>
                  <input type="date" value={targetForm.startDate} onChange={e => setTargetForm(p => ({ ...p, startDate: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">End Date</label>
                  <input type="date" value={targetForm.endDate} onChange={e => setTargetForm(p => ({ ...p, endDate: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Amount (LKR)</label>
                  <input type="number" placeholder="0" value={targetForm.targetAmount} onChange={e => setTargetForm(p => ({ ...p, targetAmount: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition" />
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  onClick={() => setTargetMut.mutate({
                    targetName: targetForm.targetName.trim(),
                    targetPeriod: targetForm.targetPeriod,
                    startDate: targetForm.startDate,
                    endDate: targetForm.endDate,
                    targetAmount: Number(targetForm.targetAmount),
                  })}
                  disabled={
                    setTargetMut.isPending ||
                    !targetForm.targetName.trim() ||
                    !targetForm.startDate ||
                    !targetForm.endDate ||
                    !targetForm.targetAmount
                  }
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  {setTargetMut.isPending ? 'Adding…' : 'Add Target'}
                </button>
              </div>
            </div>
          </div>

          {/* Targets list */}
          {!targets || targets.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <Target className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p className="font-medium text-slate-500">No targets set yet</p>
              <p className="text-sm mt-1">Add a target using the form above.</p>
            </div>
          ) : (
            <div className="grid w-full grid-cols-1 gap-5">
              {targets.map((t: any) => (
                <AdminTargetCard key={t.id} target={t} repId={id!} onDeleteClick={setDeleteTargetId} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════
          CUSTOMERS TAB
      ════════════════════════════════════════ */}
      {activeTab === 'customers' && (
        <div className="space-y-3">
          <p className="text-sm text-slate-500">
            {customers.length} customer{customers.length !== 1 ? 's' : ''} assigned
          </p>

          {customers.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p className="font-medium text-slate-500">No customers assigned</p>
              <p className="text-sm mt-1">Customers become visible to reps through route assignment.</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="divide-y divide-slate-100">
                {customers.map((c: any) => (
                  <div key={c.id} className="flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50 transition">
                    <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center font-bold text-blue-600 text-sm flex-shrink-0 select-none">
                      {(c.shopName || c.fullName || '?').charAt(0).toUpperCase()}
                    </div>
                    <button onClick={() => navigate(`/admin/customers/${c.id}`)} className="flex-1 min-w-0 text-left">
                      <p className="text-sm font-semibold text-slate-800 truncate">{c.shopName || c.fullName}</p>
                      <p className="text-xs text-slate-400 truncate">{c.email || 'No email'}</p>
                    </button>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <StatusBadge status={c.isActive ? 'Active' : 'Inactive'} />
                      <button onClick={() => navigate(`/admin/customers/${c.id}`)} className="text-slate-300 hover:text-slate-500 transition">
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Inline Field Confirm Modal ── */}
      {pendingConfirm && createPortal(
        <div className="fixed inset-0 z-50 flex flex-col items-center" style={{ pointerEvents: 'auto' }}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => setPendingConfirm(null)} />
          <div
            className="relative mt-16 w-full max-w-sm mx-4 bg-white rounded-2xl shadow-2xl border border-slate-200"
            style={{ animation: 'slideDown 0.25s ease-out both' }}
          >
            <div className="flex items-start gap-4 p-6 pb-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                <PencilLine className="w-5 h-5 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-semibold text-slate-900">Update {pendingConfirm.label}?</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Confirm this change for <span className="font-semibold text-slate-700">{rep.fullName}</span>
                </p>
              </div>
            </div>
            <div className="mx-6 rounded-xl bg-slate-50 border border-slate-200 p-3.5 mb-5 space-y-2">
              <div className="flex items-start gap-2 text-sm">
                <span className="text-slate-400 w-14 shrink-0 font-medium">From:</span>
                <span className="font-medium text-slate-500 line-through break-words min-w-0">{pendingConfirm.oldValue}</span>
              </div>
              <div className="h-px bg-slate-200" />
              <div className="flex items-start gap-2 text-sm">
                <span className="text-slate-400 w-14 shrink-0 font-medium">To:</span>
                <span className="font-bold text-slate-900 break-words min-w-0">
                  {pendingConfirm.type === 'password' ? '••••••••' : pendingConfirm.newValue}
                </span>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 pb-5">
              <button
                onClick={() => setPendingConfirm(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmSave}
                disabled={updateInfoMut.isPending || setPasswordMut.isPending}
                className="px-5 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition flex items-center gap-1.5"
              >
                {(updateInfoMut.isPending || setPasswordMut.isPending)
                  ? 'Saving…'
                  : <><Check className="w-4 h-4" /> Save</>}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── Confirm Modal ── */}
      <ConfirmModal
        open={!!deleteTargetId}
        title="Delete Target"
        description="Are you sure you want to delete this sales target? This action cannot be undone."
        confirmLabel="Delete"
        confirmVariant="orange"
        onConfirm={() => { if (deleteTargetId) deleteTargetMut.mutate(deleteTargetId); }}
        onCancel={() => setDeleteTargetId(null)}
      />
    </div>
  );
}