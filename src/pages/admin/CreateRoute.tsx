import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import AdminRouteForm from './AdminRouteForm';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { repsApi } from '../../services/api/repsApi';
import toast from 'react-hot-toast';

export default function CreateRoute() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: reps } = useQuery({ queryKey: ['admin-reps'], queryFn: () => repsApi.adminGetAll().then(r => r.data.data) });
  const repList = reps && 'items' in reps ? (reps as any).items : Array.isArray(reps) ? reps : [];
  const createRouteMut = useMutation({ mutationFn: (d: Parameters<typeof repsApi.adminCreateRoute>[0]) => repsApi.adminCreateRoute(d), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-routes'] }); toast.success('Route created'); navigate('/admin/reps'); }, onError: () => toast.error('Failed to create route') });

  return (
    <div className="px-6 py-8 max-w-4xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">New Route</h1>
          <p className="text-sm text-slate-500 mt-1">Create a new delivery/visit route</p>
        </div>
        <div>
          <button onClick={() => navigate('/admin/reps')} className="p-2 hover:bg-slate-100 rounded-lg"><ArrowLeft className="w-5 h-5 text-slate-400" /></button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
        <AdminRouteForm reps={repList} onSubmit={d => createRouteMut.mutate(d)} onCancel={() => navigate('/admin/reps')} isPending={createRouteMut.isPending} />
      </div>
    </div>
  );
}
