import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { repsApi } from '../../services/api/repsApi';
import { customersApi } from '../../services/api/customersApi';
import PageHeader from '../../components/common/PageHeader';
import { Plus, Route, Trash2, UserCheck, Users, X } from 'lucide-react';
import toast from 'react-hot-toast';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function AdminRouteManagement() {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState(120);
  const [days, setDays] = useState<string[]>([]);
  const [repId, setRepId] = useState('');
  const [assignRepByRoute, setAssignRepByRoute] = useState<Record<string, string>>({});
  const [addCustomerByRoute, setAddCustomerByRoute] = useState<Record<string, string>>({});

  const { data: routes = [], isLoading: routesLoading } = useQuery({
    queryKey: ['admin-routes-all'],
    queryFn: () => repsApi.adminGetRoutes().then(r => (r.data as any).data || []),
  });

  const { data: repsData } = useQuery({
    queryKey: ['admin-reps-for-routes'],
    queryFn: () => repsApi.adminGetAll({ page: 1, pageSize: 300 }).then(r => (r.data as any).data),
  });

  const { data: customersData } = useQuery({
    queryKey: ['admin-customers-for-routes'],
    queryFn: () => customersApi.adminGetAll({ page: 1, pageSize: 800 }).then(r => (r.data as any).data),
  });

  const reps = repsData?.items || [];
  const customers = customersData?.items || [];

  const createRouteMut = useMutation({
    mutationFn: () => repsApi.adminCreateRoute({
      name,
      description: description || undefined,
      repId: repId || undefined,
      daysOfWeek: JSON.stringify(days),
      estimatedDurationMinutes: duration,
    }),
    onSuccess: () => {
      toast.success('Route created');
      setName('');
      setDescription('');
      setDuration(120);
      setDays([]);
      setRepId('');
      qc.invalidateQueries({ queryKey: ['admin-routes-all'] });
    },
    onError: () => toast.error('Failed to create route'),
  });

  const assignRouteMut = useMutation({
    mutationFn: ({ routeId, repIdValue }: { routeId: string; repIdValue: string }) => repsApi.adminAssignRoute(routeId, repIdValue),
    onSuccess: () => {
      toast.success('Route assigned to rep');
      qc.invalidateQueries({ queryKey: ['admin-routes-all'] });
    },
    onError: () => toast.error('Failed to assign route'),
  });

  const addCustomerMut = useMutation({
    mutationFn: ({ routeId, customerId, visitOrder }: { routeId: string; customerId: string; visitOrder: number }) =>
      repsApi.adminAddCustomerToRoute(routeId, { customerId, visitOrder, visitFrequency: 'Weekly' }),
    onSuccess: () => {
      toast.success('Customer linked to route');
      qc.invalidateQueries({ queryKey: ['admin-routes-all'] });
    },
    onError: () => toast.error('Failed to link customer'),
  });

  const deleteRouteMut = useMutation({
    mutationFn: (routeId: string) => repsApi.adminDeleteRoute(routeId),
    onSuccess: () => {
      toast.success('Route removed');
      qc.invalidateQueries({ queryKey: ['admin-routes-all'] });
    },
    onError: () => toast.error('Failed to remove route'),
  });

  const removeCustomerMut = useMutation({
    mutationFn: ({ routeId, customerId }: { routeId: string; customerId: string }) =>
      repsApi.adminRemoveCustomerFromRoute(routeId, customerId),
    onSuccess: () => {
      toast.success('Customer removed from route');
      qc.invalidateQueries({ queryKey: ['admin-routes-all'] });
    },
    onError: () => toast.error('Failed to remove customer'),
  });

  const removeRepMut = useMutation({
    mutationFn: ({ routeId, repId }: { routeId: string; repId: string }) =>
      repsApi.adminRemoveRepFromRoute(routeId, repId),
    onSuccess: () => {
      toast.success('Rep removed from route');
      qc.invalidateQueries({ queryKey: ['admin-routes-all'] });
    },
    onError: () => toast.error('Failed to remove rep'),
  });

  const totalCustomers = useMemo(
    () => routes.reduce((sum: number, r: any) => sum + ((r.customers || []).length), 0),
    [routes]
  );

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader title="Route Management" subtitle="Create routes, link customers, then assign sales reps" />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <StatCard label="Routes" value={String(routes.length)} icon={Route} />
        <StatCard label="Linked Customers" value={String(totalCustomers)} icon={Users} />
        <StatCard label="Assigned Reps" value={String(routes.filter((r: any) => !!r.repId).length)} icon={UserCheck} />
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-4">
        <h3 className="text-sm font-semibold text-slate-800">Create Route</h3>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-2.5">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Route name" className="md:col-span-2 px-3 py-2 border border-slate-300 rounded-lg text-sm" />
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Details" className="md:col-span-2 px-3 py-2 border border-slate-300 rounded-lg text-sm" />
          <input type="number" value={duration} onChange={(e) => setDuration(Number(e.target.value || 0))} placeholder="Duration" className="px-3 py-2 border border-slate-300 rounded-lg text-sm" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
          <select value={repId} onChange={(e) => setRepId(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white">
            <option value="">Assign rep later</option>
            {reps.map((r: any) => <option key={r.id} value={r.id}>{r.fullName}</option>)}
          </select>
          <button
            onClick={() => {
              if (!name.trim()) return;
              createRouteMut.mutate();
            }}
            disabled={createRouteMut.isPending || !name.trim()}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50 inline-flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" /> Create Route
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {DAYS.map((d) => (
            <button
              key={d}
              onClick={() => setDays((prev) => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])}
              className={`px-2.5 py-1.5 rounded-full border text-xs font-medium ${days.includes(d) ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'bg-white border-slate-300 text-slate-600'}`}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {routesLoading ? (
          <div className="bg-white border border-slate-200 rounded-xl p-5 text-sm text-slate-500">Loading routes...</div>
        ) : routes.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-5 text-sm text-slate-500">No routes available.</div>
        ) : routes.map((route: any) => {
          const routeCustomerIds = new Set((route.customers || []).map((c: any) => c.customerId));
          const availableCustomers = customers.filter((c: any) => !routeCustomerIds.has(c.id));
          const assignedRepIds = new Set((route.assignedReps || []).map((r: any) => r.repId));
          const availableReps = reps.filter((r: any) => !assignedRepIds.has(r.id));
          const selectedRep = assignRepByRoute[route.id] || '';
          const selectedCustomer = addCustomerByRoute[route.id] || '';

          return (
            <div key={route.id} className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-base font-bold text-slate-900">{route.name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{route.description || 'No details'} • {(route.daysOfWeek || []).join(', ') || 'No schedule'} • {route.estimatedDurationMinutes || 0} min</p>
                </div>
                <button
                  onClick={() => deleteRouteMut.mutate(route.id)}
                  className="px-2.5 py-1.5 border border-red-200 text-red-600 rounded-lg text-xs font-semibold inline-flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Remove
                </button>
              </div>

              {/* Assigned Reps */}
              <div>
                <p className="text-xs font-semibold text-slate-600 mb-1.5">Assigned Reps</p>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {(route.assignedReps || []).length === 0 ? (
                    <span className="text-xs text-slate-400">No reps assigned</span>
                  ) : (route.assignedReps || []).map((r: any) => (
                    <span key={r.repId} className="inline-flex items-center gap-1 bg-indigo-50 border border-indigo-200 text-indigo-700 px-2 py-1 rounded-lg text-xs font-medium">
                      {r.repName}
                      <button
                        onClick={() => removeRepMut.mutate({ routeId: route.id, repId: r.repId })}
                        className="p-0.5 hover:bg-indigo-200 rounded transition"
                        title="Remove rep"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <select value={selectedRep} onChange={(e) => setAssignRepByRoute((prev) => ({ ...prev, [route.id]: e.target.value }))} className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white">
                    <option value="">Select rep</option>
                    {availableReps.map((r: any) => <option key={r.id} value={r.id}>{r.fullName}</option>)}
                  </select>
                  <button
                    onClick={() => {
                      if (!selectedRep) return;
                      assignRouteMut.mutate({ routeId: route.id, repIdValue: selectedRep });
                      setAssignRepByRoute((prev) => ({ ...prev, [route.id]: '' }));
                    }}
                    disabled={!selectedRep || assignRouteMut.isPending}
                    className="px-3 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold disabled:opacity-50"
                  >
                    Assign
                  </button>
                </div>
              </div>

              {/* Linked Customers */}
              <div>
                <p className="text-xs font-semibold text-slate-600 mb-1.5">Linked Customers</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">
                  {(route.customers || []).length === 0 ? (
                    <p className="text-xs text-slate-400">No customers linked yet</p>
                  ) : (route.customers || []).map((c: any) => (
                    <div key={c.customerId} className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                      <span className="text-sm text-slate-700">#{c.visitOrder || 0} • {c.shopName || c.customerName}</span>
                      <button
                        onClick={() => removeCustomerMut.mutate({ routeId: route.id, customerId: c.customerId })}
                        className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition"
                        title="Remove customer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <select value={selectedCustomer} onChange={(e) => setAddCustomerByRoute((prev) => ({ ...prev, [route.id]: e.target.value }))} className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white">
                    <option value="">Add customer</option>
                    {availableCustomers.map((c: any) => <option key={c.id} value={c.id}>{c.shopName}</option>)}
                  </select>
                  <button
                    onClick={() => {
                      if (!selectedCustomer) return;
                      addCustomerMut.mutate({ routeId: route.id, customerId: selectedCustomer, visitOrder: (route.customers?.length || 0) + 1 });
                      setAddCustomerByRoute((prev) => ({ ...prev, [route.id]: '' }));
                    }}
                    disabled={!selectedCustomer || addCustomerMut.isPending}
                    className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold disabled:opacity-50"
                  >
                    Link
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon }: { label: string; value: string; icon: any }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">{label}</p>
        <Icon className="w-4 h-4 text-slate-400" />
      </div>
      <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
    </div>
  );
}
