import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  coordinatorAddCustomerToRoute,
  coordinatorAssignRoute,
  coordinatorCreateRoute,
  coordinatorDeleteRoute,
  coordinatorGetCustomers,
  coordinatorGetReps,
  coordinatorGetRoutes,
} from '../../services/api/coordinatorApi';
import PageHeader from '../../components/common/PageHeader';
import { Plus, Route, Trash2, UserCheck, Users } from 'lucide-react';
import toast from 'react-hot-toast';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function CoordinatorRouteManagement() {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [days, setDays] = useState<string[]>([]);
  const [repId, setRepId] = useState('');
  const [assignRepByRoute, setAssignRepByRoute] = useState<Record<string, string>>({});
  const [addCustomerByRoute, setAddCustomerByRoute] = useState<Record<string, string>>({});

  const { data: routes = [], isLoading: routesLoading } = useQuery({
    queryKey: ['coordinator-routes-all'],
    queryFn: coordinatorGetRoutes,
  });

  const { data: reps = [] } = useQuery({
    queryKey: ['coordinator-reps-for-routes'],
    queryFn: coordinatorGetReps,
  });

  const { data: customersData } = useQuery({
    queryKey: ['coordinator-customers-for-routes'],
    queryFn: () => coordinatorGetCustomers(1, 800),
  });

  const customers = customersData?.items || [];

  const createRouteMut = useMutation({
    mutationFn: () => coordinatorCreateRoute({
      name,
      repId: repId || undefined,
      daysOfWeek: days,
    }),
    onSuccess: () => {
      toast.success('Route created');
      setName('');
      setDays([]);
      setRepId('');
      qc.invalidateQueries({ queryKey: ['coordinator-routes-all'] });
    },
    onError: () => toast.error('Failed to create route'),
  });

  const assignRouteMut = useMutation({
    mutationFn: ({ routeId, repIdValue }: { routeId: string; repIdValue: string }) => coordinatorAssignRoute(routeId, repIdValue),
    onSuccess: () => {
      toast.success('Route assigned');
      qc.invalidateQueries({ queryKey: ['coordinator-routes-all'] });
    },
    onError: () => toast.error('Failed to assign route'),
  });

  const addCustomerMut = useMutation({
    mutationFn: ({ routeId, customerId, visitOrder }: { routeId: string; customerId: string; visitOrder: number }) =>
      coordinatorAddCustomerToRoute(routeId, { customerId, visitOrder, visitFrequency: 'Weekly' }),
    onSuccess: () => {
      toast.success('Customer linked to route');
      qc.invalidateQueries({ queryKey: ['coordinator-routes-all'] });
    },
    onError: () => toast.error('Failed to link customer'),
  });

  const deleteRouteMut = useMutation({
    mutationFn: (routeId: string) => coordinatorDeleteRoute(routeId),
    onSuccess: () => {
      toast.success('Route deleted');
      qc.invalidateQueries({ queryKey: ['coordinator-routes-all'] });
    },
    onError: () => toast.error('Failed to delete route'),
  });

  const totalCustomers = useMemo(
    () => routes.reduce((sum: number, r: any) => sum + ((r.customers || []).length), 0),
    [routes]
  );

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader title="Route Manage" subtitle="Create route -> link customers -> assign sales rep" />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <StatCard label="Routes" value={String(routes.length)} icon={Route} />
        <StatCard label="Linked Customers" value={String(totalCustomers)} icon={Users} />
        <StatCard label="Assigned Reps" value={String(routes.filter((r: any) => !!r.repId).length)} icon={UserCheck} />
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-4">
        <h3 className="text-sm font-semibold text-slate-800">Create Route</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Route name" className="md:col-span-2 px-3 py-2 border border-slate-300 rounded-lg text-sm" />
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
            className="px-4 py-2 bg-cyan-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50 inline-flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" /> Create Route
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {DAYS.map((d) => (
            <button
              key={d}
              onClick={() => setDays((prev) => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])}
              className={`px-2.5 py-1.5 rounded-full border text-xs font-medium ${days.includes(d) ? 'bg-cyan-50 border-cyan-300 text-cyan-700' : 'bg-white border-slate-300 text-slate-600'}`}
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
          const selectedRep = assignRepByRoute[route.id] || '';
          const selectedCustomer = addCustomerByRoute[route.id] || '';

          return (
            <div key={route.id} className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-base font-bold text-slate-900">{route.name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{(route.daysOfWeek || []).join(', ') || 'No schedule'}</p>
                  <p className="text-xs text-cyan-700 mt-1">Rep: {route.repName || 'Not assigned yet'}</p>
                </div>
                <button
                  onClick={() => deleteRouteMut.mutate(route.id)}
                  className="px-2.5 py-1.5 border border-red-200 text-red-600 rounded-lg text-xs font-semibold inline-flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Remove
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                <div className="flex gap-2">
                  <select value={selectedRep} onChange={(e) => setAssignRepByRoute((prev) => ({ ...prev, [route.id]: e.target.value }))} className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white">
                    <option value="">Select rep</option>
                    {reps.map((r: any) => <option key={r.id} value={r.id}>{r.fullName}</option>)}
                  </select>
                  <button
                    onClick={() => selectedRep && assignRouteMut.mutate({ routeId: route.id, repIdValue: selectedRep })}
                    disabled={!selectedRep || assignRouteMut.isPending}
                    className="px-3 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold disabled:opacity-50"
                  >
                    Assign Rep
                  </button>
                </div>

                <div className="flex gap-2">
                  <select value={selectedCustomer} onChange={(e) => setAddCustomerByRoute((prev) => ({ ...prev, [route.id]: e.target.value }))} className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white">
                    <option value="">Add customer</option>
                    {availableCustomers.map((c: any) => <option key={c.id} value={c.id}>{c.shopName}</option>)}
                  </select>
                  <button
                    onClick={() => selectedCustomer && addCustomerMut.mutate({ routeId: route.id, customerId: selectedCustomer, visitOrder: (route.customers?.length || 0) + 1 })}
                    disabled={!selectedCustomer || addCustomerMut.isPending}
                    className="px-3 py-2 bg-cyan-600 text-white rounded-lg text-xs font-semibold disabled:opacity-50"
                  >
                    Link
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {(route.customers || []).length === 0 ? (
                  <p className="text-xs text-slate-500">No customers linked to this route yet.</p>
                ) : (route.customers || []).map((c: any) => (
                  <div key={c.customerId} className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700">
                    #{c.visitOrder || 0} • {c.shopName || c.customerName}
                  </div>
                ))}
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
