// @ts-nocheck
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  adminGetCoordinator, adminUpdateCoordinator, adminAssignRepToCoordinator,
} from '../../services/api/coordinatorApi';
import { authApi } from '../../services/api/authApi';
import { repsApi } from '../../services/api/repsApi';
import { customersApi } from '../../services/api/customersApi';
import { regionsApi } from '../../services/api/regionsApi';
import {
  ArrowLeft, MapPin, Users, User, TrendingUp,
  ChevronRight, Power, UserPlus, UserMinus,
  Eye, EyeOff, KeyRound, Copy, PencilLine, Save, Check,
} from 'lucide-react';
import toast from 'react-hot-toast';
import StatusBadge from '../../components/common/StatusBadge';
import ConfirmModal from '../../components/common/ConfirmModal';

// --- Per-field inline editable row ------------------------------------------

function InlineEditRow({ label, displayValue, isEditing, onDoubleClick, onCommit, onCancel, inputType = 'text' }) {
  const [draft, setDraft] = useState(displayValue);
  const inputRef = useRef(null);
  const committedRef = useRef(false);

  useEffect(() => {
    if (isEditing) {
      setDraft(displayValue);
      committedRef.current = false;
      setTimeout(() => { inputRef.current?.focus(); inputRef.current?.select?.(); }, 0);
    }
  }, [isEditing, displayValue]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); committedRef.current = true; onCommit(draft); }
    if (e.key === 'Escape') { committedRef.current = true; onCancel(); }
  };

  const handleBlur = () => {
    if (!committedRef.current) { committedRef.current = true; onCommit(draft); }
  };

  return (
    <div className="flex items-center justify-between gap-4 px-5 py-3.5 group">
      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider w-32 flex-shrink-0">{label}</span>
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

// --- Credential inline input -------------------------------------------------

function CredInlineInput({ defaultValue, inputType, showToggle, showPassword, onToggleShow, onCommit, onCancel }) {
  const [draft, setDraft] = useState(defaultValue);
  const inputRef = useRef(null);
  const committedRef = useRef(false);

  useEffect(() => {
    setDraft(defaultValue);
    committedRef.current = false;
    setTimeout(() => { inputRef.current?.focus(); }, 0);
  }, []);

  const handleKeyDown = (e) => {
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

// --- Main Page ----------------------------------------------------------------

export default function AdminCoordinatorDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [activeTab, setActiveTab] = useState('details');

  // Inline edit
  const [editingField, setEditingField] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);

  // Region assignment
  const [selectedRegionId, setSelectedRegionId] = useState('');

  // Confirm modal
  const [pendingConfirm, setPendingConfirm] = useState(null);

  // Assign/unassign rep
  const [showAssignRep, setShowAssignRep] = useState(false);
  const [selectedRepId, setSelectedRepId] = useState('');
  const [unassignRepId, setUnassignRepId] = useState(null);
  const [unassigningRepId, setUnassigningRepId] = useState(null);

  // --- Queries ----------------------------------------------------------------

  const { data: coordinator, isLoading } = useQuery({
    queryKey: ['admin-coordinator', id],
    queryFn: () => adminGetCoordinator(id),
    enabled: !!id,
  });

  useEffect(() => {
    if (!coordinator) return;
    setSelectedRegionId(coordinator.regionId || '');
  }, [coordinator]);

  const { data: repsData } = useQuery({
    queryKey: ['admin-coordinator-reps', id],
    queryFn: () => repsApi.adminGetAll({ page: 1, pageSize: 200, coordinatorId: id }).then(r => r.data.data),
    enabled: !!id,
  });

  const { data: customersData } = useQuery({
    queryKey: ['admin-coordinator-customers', id],
    queryFn: () => customersApi.adminGetAll({ page: 1, pageSize: 200, assignedCoordinatorId: id }).then(r => r.data.data),
    enabled: !!id,
  });

  const { data: regionsData } = useQuery({
    queryKey: ['regions'],
    queryFn: () => regionsApi.getAll().then(r => r.data || []),
  });

  const { data: allRepsData } = useQuery({
    queryKey: ['admin-reps-all'],
    queryFn: () => repsApi.adminGetAll({ page: 1, pageSize: 200 }).then(r => r.data.data),
    enabled: showAssignRep,
  });

  // --- Mutations --------------------------------------------------------------

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['admin-coordinator', id] });
    qc.invalidateQueries({ queryKey: ['admin-coordinators'] });
  };

  const updateInfoMut = useMutation({
    mutationFn: (data) => adminUpdateCoordinator(id, data),
    onSuccess: () => { invalidate(); setPendingConfirm(null); toast.success('Saved'); },
    onError: (e) => { toast.error(e?.response?.data?.message || 'Failed to update'); setPendingConfirm(null); },
  });

  const setPasswordMut = useMutation({
    mutationFn: (password) => authApi.adminSetUserPassword(coordinator.userId, password),
    onSuccess: () => { invalidate(); setPendingConfirm(null); toast.success('Password updated'); },
    onError: (e) => { toast.error(e?.response?.data?.message || 'Failed to update password'); setPendingConfirm(null); },
  });

  const handleInfoCommit = (field, label, currentRaw, newVal) => {
    setEditingField(null);
    const trimmed = newVal.trim();
    if (trimmed === currentRaw.trim()) return;
    setPendingConfirm({ field, label, oldValue: currentRaw || '(empty)', newValue: trimmed, type: 'info' });
  };

  const handleCredCommit = (type, field, label, oldVal, newVal) => {
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

  const regionChanged = selectedRegionId !== (coordinator?.regionId || '');

  const updateRegionMut = useMutation({
    mutationFn: () => adminUpdateCoordinator(id, { regionId: selectedRegionId || null }),
    onSuccess: () => { invalidate(); toast.success('Region saved'); },
    onError: (e) => toast.error(e?.response?.data?.message || 'Failed to save region'),
  });

  const toggleActiveMut = useMutation({
    mutationFn: () => adminUpdateCoordinator(id, { isActive: !coordinator?.isActive }),
    onSuccess: () => { invalidate(); toast.success(coordinator?.isActive ? 'Coordinator deactivated' : 'Coordinator activated'); },
    onError: (e) => toast.error(e?.response?.data?.message || 'Failed'),
  });

  const assignRepMut = useMutation({
    mutationFn: () => adminAssignRepToCoordinator(id, selectedRepId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-coordinator-reps', id] });
      qc.invalidateQueries({ queryKey: ['admin-coordinator', id] });
      setShowAssignRep(false);
      setSelectedRepId('');
      toast.success('Rep assigned');
    },
    onError: (e) => toast.error(e?.response?.data?.message || 'Failed to assign rep'),
  });

  const unassignRepMut = useMutation({
    mutationFn: (repId) => repsApi.adminUnassignCoordinator(repId),
    onMutate: (repId) => setUnassigningRepId(repId),
    onSettled: () => { setUnassigningRepId(null); setUnassignRepId(null); },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-coordinator-reps', id] });
      qc.invalidateQueries({ queryKey: ['admin-coordinator', id] });
      toast.success('Rep unassigned');
    },
    onError: (e) => toast.error(e?.response?.data?.message || 'Failed to unassign rep'),
  });

  // --- Derived ----------------------------------------------------------------

  const reps = repsData?.items || [];
  const customers = customersData?.items || [];
  const regionList = Array.isArray(regionsData) ? regionsData : [];

  // --- Loading / Not found ----------------------------------------------------

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-9 h-9 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!coordinator) {
    return (
      <div className="text-center py-32 text-slate-400">
        <User className="w-12 h-12 mx-auto mb-3 opacity-20" />
        <p className="font-medium">Coordinator not found.</p>
        <button onClick={() => navigate('/admin/coordinators')} className="mt-4 text-blue-600 text-sm font-medium hover:underline">
          Back to Coordinators
        </button>
      </div>
    );
  }

  const tabs = [
    { id: 'details', label: 'Details', icon: User },
    { id: 'reps', label: 'Reps', icon: Users, count: coordinator.assignedRepsCount },
    { id: 'customers', label: 'Customers', icon: TrendingUp, count: coordinator.assignedCustomersCount },
  ];

  // --- Render -----------------------------------------------------------------

  return (
    <div className="space-y-5 pb-16">

      {/* Page Header */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-start gap-4">
          <button
            onClick={() => navigate('/admin/coordinators')}
            className="p-2 rounded-lg hover:bg-slate-100 transition text-slate-400 flex-shrink-0 mt-0.5"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center flex-shrink-0 shadow-sm select-none">
            <span className="text-white font-bold text-xl">{coordinator.fullName?.charAt(0)?.toUpperCase() || '?'}</span>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-0.5">
              <h1 className="text-xl font-bold text-slate-900">{coordinator.fullName}</h1>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                coordinator.isActive
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-slate-100 text-slate-500 border-slate-200'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${coordinator.isActive ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                {coordinator.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
            <p className="text-sm text-slate-400 mb-3">{coordinator.employeeCode} · Coordinator</p>
            <div className="flex flex-wrap gap-x-5 gap-y-1.5">
              <div className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-sm font-semibold text-slate-700">{coordinator.assignedRepsCount ?? reps.length}</span>
                <span className="text-xs text-slate-400">reps</span>
              </div>
              <div className="flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-sm font-semibold text-slate-700">{coordinator.assignedCustomersCount ?? customers.length}</span>
                <span className="text-xs text-slate-400">customers</span>
              </div>
              {coordinator.regionName && (
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-sm font-semibold text-slate-700">{coordinator.regionName}</span>
                </div>
              )}
            </div>
          </div>

          <button
            onClick={() => toggleActiveMut.mutate()}
            disabled={toggleActiveMut.isPending}
            className={`hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition flex-shrink-0 disabled:opacity-50 ${
              coordinator.isActive
                ? 'border-red-200 text-red-600 bg-red-50 hover:bg-red-100'
                : 'border-emerald-200 text-emerald-600 bg-emerald-50 hover:bg-emerald-100'
            }`}
          >
            <Power className="w-4 h-4" />
            {toggleActiveMut.isPending ? '…' : coordinator.isActive ? 'Deactivate' : 'Activate'}
          </button>
        </div>
      </div>

      {/* Tab Bar */}
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

      {/* DETAILS TAB */}
      {activeTab === 'details' && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

          {/* Left: Info + Credentials */}
          <div className="lg:col-span-3 space-y-5">

            {/* Coordinator Info */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100">
                <User className="w-4 h-4 text-blue-500" />
                <h3 className="text-sm font-semibold text-slate-800">Coordinator Info</h3>
              </div>
              <div className="divide-y divide-slate-50">
                <InlineEditRow
                  label="Full Name"
                  displayValue={coordinator.fullName || ''}
                  isEditing={editingField === 'fullName'}
                  onDoubleClick={() => setEditingField('fullName')}
                  onCommit={v => handleInfoCommit('fullName', 'Full Name', coordinator.fullName || '', v)}
                  onCancel={() => setEditingField(null)}
                />
                <InlineEditRow
                  label="Employee Code"
                  displayValue={coordinator.employeeCode || ''}
                  isEditing={editingField === 'employeeCode'}
                  onDoubleClick={() => setEditingField('employeeCode')}
                  onCommit={v => handleInfoCommit('employeeCode', 'Employee Code', coordinator.employeeCode || '', v)}
                  onCancel={() => setEditingField(null)}
                />
                <InlineEditRow
                  label="Phone"
                  displayValue={coordinator.phoneNumber || ''}
                  isEditing={editingField === 'phoneNumber'}
                  onDoubleClick={() => setEditingField('phoneNumber')}
                  onCommit={v => handleInfoCommit('phoneNumber', 'Phone', coordinator.phoneNumber || '', v)}
                  onCancel={() => setEditingField(null)}
                  inputType="tel"
                />
                <InlineEditRow
                  label="Email"
                  displayValue={coordinator.email || ''}
                  isEditing={editingField === 'email'}
                  onDoubleClick={() => setEditingField('email')}
                  onCommit={v => handleInfoCommit('email', 'Email', coordinator.email || '', v)}
                  onCancel={() => setEditingField(null)}
                  inputType="email"
                />
                <InlineEditRow
                  label="Hire Date"
                  displayValue={coordinator.hireDate ? coordinator.hireDate.split('T')[0] : ''}
                  isEditing={editingField === 'hireDate'}
                  onDoubleClick={() => setEditingField('hireDate')}
                  onCommit={v => handleInfoCommit('hireDate', 'Hire Date', coordinator.hireDate ? coordinator.hireDate.split('T')[0] : '', v)}
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
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider w-32 flex-shrink-0">Username</span>
                  <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
                    <span className="text-sm font-medium text-slate-800 font-mono truncate">
                      {coordinator.employeeCode || coordinator.username || '—'}
                    </span>
                    <button
                      onClick={() => { navigator.clipboard.writeText(coordinator.employeeCode || coordinator.username || ''); toast.success('Copied!'); }}
                      className="p-1 text-slate-400 hover:text-blue-600 rounded transition flex-shrink-0"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Password */}
                <div className="flex items-center justify-between gap-4 px-5 py-3 group">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider w-32 flex-shrink-0">Password</span>
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
                        <span>{coordinator.temporaryPassword ? (showCurrentPassword ? coordinator.temporaryPassword : '••••••••') : '—'}</span>
                        <PencilLine className="w-3 h-3 opacity-0 group-hover:opacity-40 flex-shrink-0 transition-opacity" />
                      </span>
                      {coordinator.temporaryPassword && (
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
                            onClick={() => { navigator.clipboard.writeText(coordinator.temporaryPassword); toast.success('Password copied!'); }}
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

          {/* Right: Region Assignment + Reps Preview */}
          <div className="lg:col-span-2 space-y-5">

            {/* Region Assignment */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <MapPin className="w-4 h-4 text-blue-500" />
                  <h3 className="text-sm font-semibold text-slate-800">Region Assignment</h3>
                  {regionChanged && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full border border-amber-200 animate-pulse">
                      Unsaved
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {regionChanged && (
                    <button
                      onClick={() => setSelectedRegionId(coordinator.regionId || '')}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200 transition"
                    >
                      Reset
                    </button>
                  )}
                  <button
                    onClick={() => updateRegionMut.mutate()}
                    disabled={!regionChanged || updateRegionMut.isPending}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Save className="w-3 h-3" />
                    {updateRegionMut.isPending ? 'Saving…' : 'Save Region'}
                  </button>
                </div>
              </div>

              {coordinator.regionName && (
                <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/60">
                  <div className="flex items-baseline gap-1.5 text-xs">
                    <span className="font-semibold text-blue-600 flex-shrink-0">Region:</span>
                    <span className="text-slate-700">{coordinator.regionName}</span>
                  </div>
                </div>
              )}

              <div className="p-5">
                <select
                  value={selectedRegionId}
                  onChange={e => setSelectedRegionId(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                >
                  <option value="">No region assigned</option>
                  {regionList.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>
            </div>

           
          </div>
        </div>
      )}

      {/* REPS TAB */}
      {activeTab === 'reps' && (
        <div className="space-y-4">
          <button
            onClick={() => setShowAssignRep(true)}
            className="w-full flex items-center justify-center gap-2 py-3.5 border-2 border-dashed border-blue-200 rounded-xl text-blue-600 text-sm font-semibold hover:bg-blue-50 hover:border-blue-300 transition"
          >
            <UserPlus className="w-4 h-4" />
            Assign Sales Rep
          </button>

          {reps.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p className="font-medium text-slate-500">No reps assigned yet</p>
              <p className="text-sm mt-1">Use the button above to assign a sales rep.</p>
            </div>
          ) : (
            <>
              <p className="text-sm text-slate-500">{reps.length} rep{reps.length !== 1 ? 's' : ''} assigned</p>
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="divide-y divide-slate-100">
                  {reps.map((r) => (
                    <div key={r.id} className="flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50 transition">
                      <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center font-bold text-blue-600 text-sm flex-shrink-0 select-none">
                        {(r.fullName || '?').charAt(0).toUpperCase()}
                      </div>
                      <button onClick={() => navigate(`/admin/reps/${r.id}`)} className="flex-1 min-w-0 text-left">
                        <p className="text-sm font-semibold text-slate-800 truncate">{r.fullName}</p>
                        <p className="text-xs text-slate-400">{r.employeeCode}</p>
                      </button>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <StatusBadge status={r.isActive ? 'Active' : 'Inactive'} />
                        <button
                          onClick={() => setUnassignRepId(r.id)}
                          disabled={unassigningRepId === r.id}
                          className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition disabled:opacity-50"
                          title="Unassign rep"
                        >
                          <UserMinus className="w-4 h-4" />
                        </button>
                        <button onClick={() => navigate(`/admin/reps/${r.id}`)} className="text-slate-300 hover:text-slate-500 transition">
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* CUSTOMERS TAB */}
      {activeTab === 'customers' && (
        <div className="space-y-3">
          <p className="text-sm text-slate-500">
            {customers.length} customer{customers.length !== 1 ? 's' : ''} assigned
          </p>

          {customers.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p className="font-medium text-slate-500">No customers assigned</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="divide-y divide-slate-100">
                {customers.map((c) => (
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

      {/* Inline Field Confirm Modal */}
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
                  Confirm this change for <span className="font-semibold text-slate-700">{coordinator.fullName}</span>
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

      {/* Unassign Rep Confirm */}
      <ConfirmModal
        open={!!unassignRepId}
        title="Unassign Sales Rep"
        description="Remove this sales rep from the coordinator? The rep will no longer be managed by this coordinator."
        confirmLabel="Unassign"
        confirmVariant="orange"
        onConfirm={() => { if (unassignRepId) unassignRepMut.mutate(unassignRepId); }}
        onCancel={() => setUnassignRepId(null)}
      />

      {/* Assign Rep Modal */}
      {showAssignRep && createPortal(
        <div className="fixed inset-0 z-50 flex flex-col items-center" style={{ pointerEvents: 'auto' }}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => { setShowAssignRep(false); setSelectedRepId(''); }} />
          <div
            className="relative mt-16 w-full max-w-sm mx-4 bg-white rounded-2xl shadow-2xl border border-slate-200"
            style={{ animation: 'slideDown 0.25s ease-out both' }}
          >
            <div className="flex items-center gap-3 p-6 pb-4">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                <UserPlus className="w-5 h-5 text-blue-600" />
              </div>
              <h3 className="text-base font-semibold text-slate-900">Assign Sales Rep</h3>
            </div>
            <div className="px-6 pb-5 space-y-4">
              <select
                value={selectedRepId}
                onChange={e => setSelectedRepId(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
              >
                <option value="">Choose a rep…</option>
                {(allRepsData?.items || []).map((r) => (
                  <option key={r.id} value={r.id}>{r.fullName} ({r.employeeCode})</option>
                ))}
              </select>
              <div className="flex gap-3">
                <button
                  onClick={() => { setShowAssignRep(false); setSelectedRepId(''); }}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={() => assignRepMut.mutate()}
                  disabled={!selectedRepId || assignRepMut.isPending}
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-40 transition"
                >
                  {assignRepMut.isPending ? 'Assigning…' : 'Assign'}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
