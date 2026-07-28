import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { adminCreateCoordinator } from '../../services/api/coordinatorApi';
import { regionsApi } from '../../services/api/regionsApi';

interface Props {
  onSuccess?: () => void;
  onCancel?: () => void;
}

function todayDateInputValue() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export default function AdminCoordinatorForm({ onSuccess, onCancel }: Props) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    fullName: '',
    employeeCode: '',
    email: '',
    password: '',
    phoneNumber: '',
    regionId: '',
    hireDate: todayDateInputValue(),
  });

  const { data: regionsData } = useQuery({
    queryKey: ['regions'],
    queryFn: () => regionsApi.getAll().then((r: any) => r?.data || []),
  });

  const regionList = useMemo(() => (Array.isArray(regionsData) ? regionsData : []), [regionsData]);

  const createMut = useMutation({
    mutationFn: () =>
      adminCreateCoordinator({
        fullName: form.fullName,
        employeeCode: form.employeeCode,
        email: form.email || undefined,
        password: form.password,
        phoneNumber: form.phoneNumber || undefined,
        regionId: form.regionId || undefined,
        hireDate: form.hireDate,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-coordinators'] });
      toast.success('Coordinator created successfully.');
      onSuccess?.();
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed to create coordinator'),
  });

  const cls = 'w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500/20';
  const canSubmit = !!form.fullName && !!form.employeeCode && !!form.password;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-3 text-xs text-indigo-700">
        Username will be the coordinator ID number (employee code). Set a permanent password now.
        Email is optional.
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Full Name*</label>
          <input
            value={form.fullName}
            onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
            placeholder="Coordinator full name"
            className={cls}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Employee Code*</label>
          <input
            value={form.employeeCode}
            onChange={(e) => setForm((f) => ({ ...f, employeeCode: e.target.value }))}
            placeholder="COORD-001"
            className={cls}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Email</label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            placeholder="coordinator@company.com (optional)"
            className={cls}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Password*</label>
          <input
            type="password"
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            placeholder="Minimum 6 characters"
            className={cls}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Phone Number</label>
          <input
            value={form.phoneNumber}
            onChange={(e) => setForm((f) => ({ ...f, phoneNumber: e.target.value }))}
            placeholder="+9477xxxxxxx"
            className={cls}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Region</label>
          <select
            value={form.regionId}
            onChange={(e) => setForm((f) => ({ ...f, regionId: e.target.value }))}
            className={cls}
          >
            <option value="">Select region...</option>
            {regionList.map((r: any) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Hire Date</label>
          <input
            type="date"
            value={form.hireDate}
            onChange={(e) => setForm((f) => ({ ...f, hireDate: e.target.value }))}
            className={cls}
          />
        </div>
      </div>

      <div className="pt-2 grid grid-cols-2 gap-2">
        <button onClick={onCancel} className="w-full py-2.5 bg-slate-100 rounded-lg text-sm font-medium">
          Cancel
        </button>
        <button
          disabled={createMut.isPending || !canSubmit}
          onClick={() => createMut.mutate()}
          className="w-full py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
        >
          {createMut.isPending ? 'Creating...' : 'Create Coordinator'}
        </button>
      </div>
    </div>
  );
}
