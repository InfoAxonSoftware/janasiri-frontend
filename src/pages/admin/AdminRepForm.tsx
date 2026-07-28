import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { repsApi } from '../../services/api/repsApi';
import { regionsApi } from '../../services/api/regionsApi';
import { adminGetAllCoordinators } from '../../services/api/coordinatorApi';
import toast from 'react-hot-toast';

type Props = { rep?: { id?: string }; onSuccess?: () => void; onCancel?: () => void };

function MultiCheckList({
  label,
  options,
  selected,
  onChange,
  getId,
  getLabel,
}: {
  label: string;
  options: any[];
  selected: string[];
  onChange: (ids: string[]) => void;
  getId: (o: any) => string;
  getLabel: (o: any) => string;
}) {
  const toggle = (id: string) => {
    onChange(selected.includes(id) ? selected.filter(s => s !== id) : [...selected, id]);
  };
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</label>
      <div className="border border-slate-200 rounded-lg max-h-32 overflow-y-auto bg-white">
        {options.length === 0 ? (
          <p className="text-xs text-slate-400 p-2">None available</p>
        ) : options.map(opt => (
          <label key={getId(opt)} className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50 cursor-pointer text-sm">
            <input
              type="checkbox"
              checked={selected.includes(getId(opt))}
              onChange={() => toggle(getId(opt))}
              className="accent-indigo-600"
            />
            {getLabel(opt)}
          </label>
        ))}
      </div>
      {selected.length > 0 && (
        <p className="text-xs text-indigo-600">{selected.length} selected</p>
      )}
    </div>
  );
}

export default function AdminRepForm({ rep, onSuccess, onCancel }: Props) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    email: '',
    password: '',
    fullName: '',
    phoneNumber: '',
    employeeCode: '',
    hireDate: '',
    isActive: true,
  });
  const [selectedRegionIds, setSelectedRegionIds] = useState<string[]>([]);
  const [selectedSubRegionIds, setSelectedSubRegionIds] = useState<string[]>([]);
  const [selectedCoordinatorIds, setSelectedCoordinatorIds] = useState<string[]>([]);

  const { data: regionsData } = useQuery({
    queryKey: ['regions'],
    queryFn: () => regionsApi.getAll().then(r => r.data || []),
  });

  const { data: coordinatorsData } = useQuery({
    queryKey: ['coordinators-list'],
    queryFn: () => adminGetAllCoordinators(1, 100).then(r => r.items || []),
  });

  const regionList = Array.isArray(regionsData) ? regionsData : [];
  const coordinators = coordinatorsData || [];

  const allSubRegions = useMemo(() => {
    return regionList.flatMap((r: any) => (r.subRegions || []).map((s: any) => ({ ...s, regionName: r.name })));
  }, [regionList]);

  const createMut = useMutation({
    mutationFn: (d: any) => repsApi.adminCreate(d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-reps'] });
      toast.success('Rep created successfully.');
      onSuccess?.();
    },
    onError: () => toast.error('Failed to create rep'),
  });

  const handleCreate = () => {
    if (!form.fullName || !form.employeeCode || !form.password) {
      return toast.error('Full name, employee code, and password are required');
    }
    createMut.mutate({
      email: form.email || undefined,
      password: form.password,
      fullName: form.fullName,
      phoneNumber: form.phoneNumber || undefined,
      employeeCode: form.employeeCode || undefined,
      hireDate: form.hireDate || undefined,
      regionIds: selectedRegionIds,
      subRegionIds: selectedSubRegionIds,
      coordinatorIds: selectedCoordinatorIds,
    });
  };

  const cls = 'w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-emerald-500';

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-3 text-xs text-indigo-700">
        Username will be the rep employee code. Set a permanent password now.
        Email is optional.
      </div>

      <input
        value={form.fullName}
        onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))}
        placeholder="Full name*"
        className={cls}
      />
      <input
        value={form.employeeCode}
        onChange={e => setForm(f => ({ ...f, employeeCode: e.target.value }))}
        placeholder="Employee code*"
        className={cls}
      />
      <div className="grid grid-cols-2 gap-2">
        <input
          type="password"
          value={form.password}
          onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
          placeholder="Password*"
          className={cls}
        />
        <input
          value={form.phoneNumber}
          onChange={e => setForm(f => ({ ...f, phoneNumber: e.target.value }))}
          placeholder="Phone"
          className={cls}
        />
      </div>
      <input
        value={form.email}
        onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
        placeholder="Email (optional)"
        className={cls}
      />
      <input
        type="date"
        value={form.hireDate}
        onChange={e => setForm(f => ({ ...f, hireDate: e.target.value }))}
          className={cls}
        />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <MultiCheckList
          label="Regions"
          options={regionList}
          selected={selectedRegionIds}
          onChange={setSelectedRegionIds}
          getId={(r: any) => r.id}
          getLabel={(r: any) => r.name}
        />
        <MultiCheckList
          label="Sub-Regions"
          options={allSubRegions}
          selected={selectedSubRegionIds}
          onChange={setSelectedSubRegionIds}
          getId={(s: any) => s.id}
          getLabel={(s: any) => `${s.name} (${s.regionName})`}
        />
        <MultiCheckList
          label="Coordinators"
          options={coordinators}
          selected={selectedCoordinatorIds}
          onChange={setSelectedCoordinatorIds}
          getId={(c: any) => c.id}
          getLabel={(c: any) => c.fullName}
        />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button onClick={onCancel} className="w-full py-2.5 bg-slate-100 rounded-lg text-sm font-medium">Cancel</button>
        <button
          disabled={createMut.isPending}
          onClick={handleCreate}
          className="w-full py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
        >
          {createMut.isPending ? 'Creating...' : 'Create'}
        </button>
      </div>
    </div>
  );
}
