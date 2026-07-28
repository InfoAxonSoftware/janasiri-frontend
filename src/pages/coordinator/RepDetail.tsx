import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  coordinatorAddCustomerToRoute,
  coordinatorCreateRouteForRep,
  coordinatorDeleteRoute,
  coordinatorGetRepById,
  coordinatorGetRepCustomers,
  coordinatorGetRepPerformance,
  coordinatorGetRepRoutes,
  coordinatorRemoveCustomerFromRoute,
} from '../../services/api/coordinatorApi';
import PageHeader from '../../components/common/PageHeader';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function CoordinatorRepDetail() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { repId } = useParams<{ repId: string }>();
  const [newRouteName, setNewRouteName] = useState('');
  const [newRouteDays, setNewRouteDays] = useState<string[]>([]);
  const [routeCustomerToAdd, setRouteCustomerToAdd] = useState<Record<string, string>>({});

  const repQuery = useQuery({
    queryKey: ['coordinator-rep', repId],
    queryFn: () => coordinatorGetRepById(repId!),
    enabled: !!repId,
  });

  const performanceQuery = useQuery({
    queryKey: ['coordinator-rep-performance', repId],
    queryFn: () => coordinatorGetRepPerformance(repId!),
    enabled: !!repId,
  });

  const customersQuery = useQuery({
    queryKey: ['coordinator-rep-customers', repId],
    queryFn: () => coordinatorGetRepCustomers(repId!, 1, 200),
    enabled: !!repId,
  });

  const routesQuery = useQuery({
    queryKey: ['coordinator-rep-routes', repId],
    queryFn: () => coordinatorGetRepRoutes(repId!),
    enabled: !!repId,
  });

  const createRouteMut = useMutation({
    mutationFn: () => coordinatorCreateRouteForRep(repId!, {
      name: newRouteName,
      daysOfWeek: newRouteDays,
    }),
    onSuccess: () => {
      toast.success('Route created');
      setNewRouteName('');
      setNewRouteDays([]);
      qc.invalidateQueries({ queryKey: ['coordinator-rep-routes', repId] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed to create route'),
  });

  const deleteRouteMut = useMutation({
    mutationFn: (routeId: string) => coordinatorDeleteRoute(routeId),
    onSuccess: () => {
      toast.success('Route deleted');
      qc.invalidateQueries({ queryKey: ['coordinator-rep-routes', repId] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed to delete route'),
  });

  const addCustomerToRouteMut = useMutation({
    mutationFn: ({ routeId, customerId, visitOrder }: { routeId: string; customerId: string; visitOrder: number }) =>
      coordinatorAddCustomerToRoute(routeId, { customerId, visitOrder, visitFrequency: 'Weekly' }),
    onSuccess: (_, vars) => {
      toast.success('Customer added to route');
      setRouteCustomerToAdd((prev) => ({ ...prev, [vars.routeId]: '' }));
      qc.invalidateQueries({ queryKey: ['coordinator-rep-routes', repId] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed to add customer to route'),
  });

  const removeCustomerFromRouteMut = useMutation({
    mutationFn: ({ routeId, customerId }: { routeId: string; customerId: string }) => coordinatorRemoveCustomerFromRoute(routeId, customerId),
    onSuccess: () => {
      toast.success('Customer removed from route');
      qc.invalidateQueries({ queryKey: ['coordinator-rep-routes', repId] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed to remove customer from route'),
  });

  const assignedCustomers = customersQuery.data?.items || [];

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  if (!repId) return null;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/coordinator/team')}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium border border-slate-200 rounded-lg hover:bg-slate-50"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
      </div>

      <PageHeader
        title={repQuery.data?.fullName || 'Rep Details'}
        subtitle={repQuery.data?.employeeCode || 'Performance, customers and routes'}
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500">Total Sales</p>
          <p className="text-2xl font-bold text-slate-900">{(performanceQuery.data?.totalSales || 0).toLocaleString()}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500">Total Orders</p>
          <p className="text-2xl font-bold text-slate-900">{performanceQuery.data?.totalOrders || 0}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500">Assigned Customers</p>
          <p className="text-2xl font-bold text-slate-900">{assignedCustomers.length}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500">Assigned Routes</p>
          <p className="text-2xl font-bold text-slate-900">{routesQuery.data?.length || 0}</p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <h3 className="font-semibold text-slate-900 mb-3">Assigned Customers</h3>
        <div className="space-y-2">
          {assignedCustomers.map((c: any) => (
            <div key={c.id} className="flex items-center justify-between border border-slate-200 rounded-lg p-3">
              <div>
                <p className="font-medium text-slate-900">{c.shopName}</p>
                <p className="text-xs text-slate-500">{c.email || 'No email'} • {c.phoneNumber || 'No phone'}</p>
              </div>
            </div>
          ))}
          {assignedCustomers.length === 0 && (
            <p className="text-sm text-slate-500">No customers assigned yet.</p>
          )}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
        <h3 className="font-semibold text-slate-900">Routes</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <input
            className="md:col-span-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
            placeholder="Route name"
            value={newRouteName}
            onChange={(e) => setNewRouteName(e.target.value)}
          />
          <button
            onClick={() => newRouteName.trim() && createRouteMut.mutate()}
            disabled={!newRouteName.trim() || createRouteMut.isPending}
            className="md:col-span-1 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold inline-flex items-center justify-center gap-1 disabled:opacity-50"
          >
            <Plus className="w-4 h-4" /> Add Route
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {days.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setNewRouteDays((prev) => prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d])}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border ${newRouteDays.includes(d) ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'bg-white border-slate-200 text-slate-600'}`}
            >
              {d}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {(routesQuery.data || []).map((route: any) => {
            const existingIds = new Set((route.customers || []).map((x: any) => x.customerId));
            const availableForRoute = assignedCustomers.filter((c: any) => !existingIds.has(c.id));
            return (
              <div key={route.id} className="border border-slate-200 rounded-lg p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-slate-900">{route.name}</p>
                    <p className="text-xs text-slate-500">{(route.daysOfWeek || []).join(', ') || 'No days'}</p>
                  </div>
                  <button
                    onClick={() => deleteRouteMut.mutate(route.id)}
                    disabled={deleteRouteMut.isPending}
                    className="px-2.5 py-1.5 border border-red-200 text-red-600 rounded-lg text-xs font-semibold inline-flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Remove Route
                  </button>
                </div>

                <div className="flex gap-2">
                  <select
                    className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                    value={routeCustomerToAdd[route.id] || ''}
                    onChange={(e) => setRouteCustomerToAdd((prev) => ({ ...prev, [route.id]: e.target.value }))}
                  >
                    <option value="">Add customer to route</option>
                    {availableForRoute.map((c: any) => (
                      <option key={c.id} value={c.id}>{c.shopName}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => {
                      const customerId = routeCustomerToAdd[route.id];
                      if (!customerId) return;
                      addCustomerToRouteMut.mutate({ routeId: route.id, customerId, visitOrder: (route.customers?.length || 0) + 1 });
                    }}
                    disabled={!routeCustomerToAdd[route.id] || addCustomerToRouteMut.isPending}
                    className="px-3 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold disabled:opacity-50"
                  >
                    Add
                  </button>
                </div>

                <div className="space-y-2">
                  {(route.customers || []).map((c: any) => (
                    <div key={c.customerId} className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg p-2.5">
                      <p className="text-sm text-slate-800">{c.shopName || c.customerName}</p>
                      <button
                        onClick={() => removeCustomerFromRouteMut.mutate({ routeId: route.id, customerId: c.customerId })}
                        disabled={removeCustomerFromRouteMut.isPending}
                        className="px-2 py-1 border border-red-200 text-red-600 rounded-md text-xs font-semibold"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  {(route.customers || []).length === 0 && <p className="text-xs text-slate-500">No customers in this route.</p>}
                </div>
              </div>
            );
          })}
          {(routesQuery.data || []).length === 0 && (
            <p className="text-sm text-slate-500">No routes created for this rep yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
