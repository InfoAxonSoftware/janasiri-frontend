import { useEffect, useId, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Users, X, Check, ChevronDown, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api/axiosConfig';
import { quickRequestApi } from '../../services/api/quickRequestApi';
import { useAuth } from '../../hooks/useAuth';

type Rep = { id: string; fullName: string; employeeCode: string };
type Request = { id: string; repId?: string | null; repName?: string | null; assignedReps?: Rep[]; assignmentVersion?: string | null };
type Kind = 'quick' | 'orders' | 'quotations';
type Snapshot = { assignedReps: Rep[]; eligibleReps: Rep[]; assignmentVersion: string | null };

export default function GuestOrderRepAssignment({ request, kind = 'quick' }: { request: Request; kind?: Kind; compact?: boolean }) {
  const { user } = useAuth();
  const client = useQueryClient();
  const [draft, setDraft] = useState<string[] | null>(null);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const dropdownId = useId();
  useEffect(() => {
    if (!editing) return;
    const handleOutside = (event: PointerEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setEditing(false);
        setSearch('');
      }
    };
    document.addEventListener('pointerdown', handleOutside);
    return () => document.removeEventListener('pointerdown', handleOutside);
  }, [editing]);
  const isAdmin = user?.role === 'Admin' || user?.role === 'SuperAdmin';
  const localAssigned = request.assignedReps ?? (request.repId ? [{ id: request.repId, fullName: request.repName || 'Assigned rep', employeeCode: '' }] : []);
  const endpoint = '/admin/rep-assignments/' + kind + '/' + request.id;
  const options = useQuery({
    queryKey: ['record-rep-assignment', user?.id, kind, request.id, request.assignmentVersion, localAssigned.map(r => r.id)],
    queryFn: async (): Promise<Snapshot> => kind === 'quick'
      ? { assignedReps: localAssigned, eligibleReps: (await quickRequestApi.getEligibleReps(request.id)).data.data, assignmentVersion: request.assignmentVersion ?? null }
      : (await api.get<{ data: Snapshot }>(endpoint)).data.data,
    enabled: !!user?.id && (kind === 'quick' || isAdmin),
    retry: false,
    staleTime: 0,
  });
  const assigned = options.data?.assignedReps ?? localAssigned;
  const assignedIds = assigned.map(r => r.id);
  const reps = options.data?.eligibleReps ?? [];
  const canEdit = (id: string) => isAdmin || reps.some(r => r.id === id);
  const desired = draft ?? assignedIds;
  const changed = desired.length !== assignedIds.length || desired.some(id => !assignedIds.includes(id));
  const refresh = () => Promise.all(
    ['admin-quick-orders','admin-orders','coordinator-quick-orders','coordinator-orders','rep-quick-orders','rep-orders','admin-quotations','admin-quick-quotations','coordinator-quotations','coordinator-quick-quotations','rep-quotations','rep-quick-quotations','record-rep-assignment'].map(key => client.invalidateQueries({ queryKey: [key] }))
  );
  const assignment = useMutation({
    mutationFn: (repIds: string[]) => {
      const version = options.data?.assignmentVersion ?? request.assignmentVersion ?? null;
      return kind === 'quick'
        ? quickRequestApi.assignReps(request.id, repIds, assignedIds, version)
        : api.put(endpoint, { repIds, expectedRepIds: assignedIds, expectedVersion: version });
    },
    onSuccess: async () => { setDraft(null); setEditing(false); await refresh(); toast.success('Sales rep assignments updated'); },
    onError: async (error: unknown) => {
      const response = (error as { response?: { status?: number; data?: { message?: string } } })?.response;
      toast.error(response?.data?.message || 'Could not update assignments. Please try again.');
      if ([403,404,409].includes(response?.status ?? 0)) { setDraft(null); setEditing(false); await refresh(); }
    },
  });
  const pending = assignment.isPending || options.isFetching || options.isError || !options.data;
  const all = [...assigned, ...reps.filter(r => !assignedIds.includes(r.id))];
  const filtered = all.filter(r => (r.fullName + ' ' + r.employeeCode).toLowerCase().includes(search.toLowerCase()));
  if (kind !== 'quick' && !isAdmin) return null;
  return (
    <section className="min-w-0 w-full rounded-xl border border-slate-200 bg-white p-3 sm:p-4" onClick={e => e.stopPropagation()}>
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
        <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-600">
          <Users className="h-4 w-4 text-indigo-600" /> Assigned sales reps
        </div>
        <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">{assigned.length}</span>
      </div>

      <div className="mt-3 grid min-w-0 items-start gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr))]">
        <div className="min-w-0">
          <p className="mb-2 text-[11px] font-semibold text-slate-500">Currently assigned</p>
          {assigned.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-200 px-3 py-2 text-xs text-amber-700">No sales reps assigned</p>
          ) : (
            <ul className="max-h-48 space-y-1.5 overflow-y-auto pr-1" aria-label="Assigned sales reps">
              {assigned.map(rep => (
                <li key={rep.id} className="flex min-w-0 items-center gap-2 rounded-lg bg-indigo-50/80 px-2.5 py-1.5">
                  <span className="min-w-0 flex-1">
                    <span className="block break-words text-xs font-semibold text-indigo-700">{rep.fullName || 'Assigned rep'}</span>
                    {rep.employeeCode && <span className="block text-[10px] text-slate-500">{rep.employeeCode}</span>}
                  </span>
                  {!canEdit(rep.id) && <span className="shrink-0 text-[10px] text-slate-500">Other team</span>}
                  {canEdit(rep.id) && (
                    <button type="button" title={'Remove ' + rep.fullName} aria-label={'Unassign ' + rep.fullName}
                      disabled={pending || changed}
                      onClick={() => { if (window.confirm('Remove ' + rep.fullName + ' from this record?')) assignment.mutate(assignedIds.filter(id => id !== rep.id)); }}
                      className="shrink-0 rounded-md p-1 text-indigo-500 hover:bg-red-100 hover:text-red-600 disabled:opacity-40">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="min-w-0 space-y-2" ref={dropdownRef} onKeyDown={e => { if (e.key === 'Escape') { setEditing(false); setSearch(''); } }}>
          <p className="text-[11px] font-semibold text-slate-500">Manage assignments</p>
          {options.isError ? (
            <p className="text-xs text-slate-500">Could not load assignments. <button type="button" onClick={() => options.refetch()} className="font-semibold text-indigo-600">Retry</button></p>
          ) : (
            <>
              <button type="button" disabled={pending}
                aria-expanded={editing} aria-controls={dropdownId}
                onClick={() => { setEditing(v => !v); setSearch(''); }}
                className="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-left text-xs font-medium text-slate-700 hover:border-indigo-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-50">
                <span className="min-w-0 truncate">{options.isLoading ? 'Loading sales reps...' : changed ? desired.length + ' selected' : 'Select sales reps'}</span>
                <ChevronDown className={'h-4 w-4 shrink-0 text-slate-500 transition-transform ' + (editing ? 'rotate-180' : '')} />
              </button>
              {editing && (
                <div id={dropdownId} className="rounded-lg border border-slate-200 bg-white shadow-sm">
                  <div className="relative border-b border-slate-100 p-2">
                    <Search className="pointer-events-none absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                    <input autoFocus aria-label="Search sales reps" placeholder="Search name or code..." value={search}
                      onChange={e => setSearch(e.target.value)}
                      className="w-full rounded-md border border-slate-200 py-2 pl-8 pr-2 text-xs outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400" />
                  </div>
                  <div className="max-h-48 space-y-0.5 overflow-y-auto p-1.5" role="group" aria-label="Select sales reps">
                    {!filtered.length && <p className="px-2 py-3 text-xs text-slate-500">No matching reps</p>}
                    {filtered.map(rep => (
                      <label key={rep.id} className={'flex min-w-0 items-center gap-2 rounded-md px-2 py-2 text-xs text-slate-700 ' + (canEdit(rep.id) ? 'cursor-pointer hover:bg-indigo-50' : 'opacity-60')}>
                        <input type="checkbox" checked={desired.includes(rep.id)} disabled={pending || !canEdit(rep.id)}
                          onChange={e => { const checked = e.target.checked; setDraft(prev => { const ids = prev ?? assignedIds; return checked ? [...new Set([...ids, rep.id])] : ids.filter(id => id !== rep.id); }); }}
                          className="h-4 w-4 shrink-0 accent-indigo-600" />
                        <span className="min-w-0 flex-1 break-words">{rep.fullName}{rep.employeeCode ? ' · ' + rep.employeeCode : ''}</span>
                        {!canEdit(rep.id) && <span className="shrink-0 text-[10px] text-slate-400">Other team</span>}
                      </label>
                    ))}
                  </div>
                  <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-3 py-2">
                    <span className="text-[11px] text-slate-500">{desired.length} selected</span>
                    <button type="button" onClick={() => { setEditing(false); setSearch(''); }} className="text-xs font-semibold text-indigo-600">Done</button>
                  </div>
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" disabled={pending || !changed} onClick={() => assignment.mutate(desired)}
                  className="inline-flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-40">
                  <Check className="h-3.5 w-3.5 shrink-0" /> {assignment.isPending ? 'Saving...' : assigned.length ? 'Save changes' : 'Assign reps'}
                </button>
                <button type="button" disabled={assignment.isPending || (!changed && !editing)}
                  onClick={() => { setDraft(null); setEditing(false); setSearch(''); }}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40">Cancel</button>
              </div>
              {changed && <p className="text-[11px] text-indigo-600">{desired.length} reps selected. Save to apply changes.</p>}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
