import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { UserRound, UserMinus } from 'lucide-react';
import toast from 'react-hot-toast';
import { quickRequestApi, type QuickRequestDto } from '../../services/api/quickRequestApi';
import { useAuth } from '../../hooks/useAuth';

export default function GuestOrderRepAssignment({ request, compact = false }: { request: QuickRequestDto; compact?: boolean }) {
  const { user } = useAuth();
  const client = useQueryClient();
  const [selected, setSelected] = useState('');
  const options = useQuery({
    queryKey: ['guest-order-eligible-reps', user?.id, request.id, request.repId],
    queryFn: () => quickRequestApi.getEligibleReps(request.id).then(r => r.data.data),
    retry: false,
    staleTime: 0,
  });
  const refresh = () => Promise.all([
    client.invalidateQueries({ queryKey: ['admin-quick-orders'] }),
    client.invalidateQueries({ queryKey: ['coordinator-quick-orders'] }),
    client.invalidateQueries({ queryKey: ['rep-quick-orders'] }),
    client.invalidateQueries({ queryKey: ['guest-order-eligible-reps'] }),
  ]);
  const assignment = useMutation({
    mutationFn: (repId: string | null) => quickRequestApi.assignRep(request.id, repId, request.repId ?? null),
    onSuccess: async (_, repId) => {
      setSelected('');
      toast.success(repId ? 'Sales rep assigned' : 'Sales rep assignment removed');
      await refresh();
    },
    onError: async (error: unknown) => {
      const response = (error as { response?: { status?: number; data?: { message?: string } } })?.response;
      toast.error(response?.data?.message || 'Could not update assignment. Please try again.');
      if (response?.status === 409 || response?.status === 403 || response?.status === 404) await refresh();
    },
  });
  const reps = options.data ?? [];
  return (
    <section className={compact ? "mt-3 border-t border-slate-200 pt-3" : "rounded-xl border border-slate-200 bg-white p-3 sm:p-4"} onClick={e => e.stopPropagation()}>
      <div className={compact ? "flex flex-col items-start gap-1.5" : "flex flex-wrap items-center justify-between gap-2"}>
        <div className={compact ? "flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500" : "flex items-center gap-2 text-sm font-semibold text-slate-800"}>
          <UserRound className="h-4 w-4 text-indigo-600" /> Assigned sales rep
        </div>
        <span className={request.repId ? 'rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700' : 'rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700'}>
          {request.repId ? (request.repName || 'Assigned') : 'Unassigned'}
        </span>
      </div>
      {options.isError ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-600">
          Could not load available sales reps.
          <button type="button" onClick={() => options.refetch()} className="font-semibold text-indigo-600">Retry</button>
        </div>
      ) : (
        <div className={compact ? "mt-2 flex flex-col gap-1.5" : "mt-3 flex flex-wrap items-center gap-2"}>
          <select aria-label="Select sales rep" value={selected} onChange={e => setSelected(e.target.value)}
            disabled={options.isLoading || assignment.isPending || !reps.length}
            className={compact ? "w-full min-w-0 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 disabled:opacity-50" : "min-w-0 flex-1 basis-40 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 disabled:opacity-50"}>
            <option value="">{options.isLoading ? 'Loading sales reps...' : reps.length ? 'Select sales rep' : 'No eligible sales reps'}</option>
            {reps.map(rep => <option key={rep.id} value={rep.id}>{rep.fullName}{rep.employeeCode ? ' - ' + rep.employeeCode : ''}</option>)}
          </select>
          <button type="button" disabled={!selected || selected === request.repId || assignment.isPending || !reps.some(rep => rep.id === selected)}
            onClick={() => assignment.mutate(selected)}
            className={"rounded-lg bg-indigo-600 px-3 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-40 " + (compact ? "w-full py-1.5" : "py-2")}>
            {assignment.isPending ? 'Saving...' : request.repId ? 'Change rep' : 'Assign rep'}
          </button>
          {request.repId && <button type="button" disabled={assignment.isPending || options.isLoading}
            onClick={() => { if (window.confirm('Remove the assigned sales rep? The order will not be deleted.')) assignment.mutate(null); }}
            className={"inline-flex items-center justify-center gap-1 rounded-lg border border-red-100 px-3 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-40 " + (compact ? "w-full py-1.5" : "py-2")}>
            <UserMinus className="h-4 w-4" /> Unassign
          </button>}
        </div>
      )}
    </section>
  );
}
