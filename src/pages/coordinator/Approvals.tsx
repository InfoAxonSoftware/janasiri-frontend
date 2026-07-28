import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customerRegistrationApi, type RegistrationRequest } from '../../services/api/customerRegistrationApi';
import { formatRelative } from '../../utils/formatters';
import { UserCheck, MapPin, X, Check, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useIsDesktop } from '../../hooks/useMediaQuery';
import PageHeader from '../../components/common/PageHeader';
import DataTable, { type Column } from '../../components/common/DataTable';
import MobileTileList from '../../components/common/MobileTileList';
import BottomSheet from '../../components/common/BottomSheet';

export default function CoordinatorApprovals() {
  const queryClient = useQueryClient();
  const isDesktop = useIsDesktop();
  const [page, setPage] = useState(1);
  const [approveTarget, setApproveTarget] = useState<RegistrationRequest | null>(null);
  const [approvePassword, setApprovePassword] = useState('');
  const [rejectTarget, setRejectTarget] = useState<RegistrationRequest | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['coordinator-registration-approvals', page],
    queryFn: () => customerRegistrationApi.coordinatorGetAll({ page, pageSize: 20, status: 'Pending' }).then(r => r.data.data),
  });

  const approveMut = useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) => customerRegistrationApi.coordinatorReview(id, {
      action: 'Approve',
      password,
    }),
    onSuccess: () => {
      toast.success('Customer approved');
      setApproveTarget(null);
      setApprovePassword('');
      queryClient.invalidateQueries({ queryKey: ['coordinator-registration-approvals'] });
      queryClient.invalidateQueries({ queryKey: ['coordinator-dashboard'] });
    },
    onError: () => toast.error('Failed to approve customer'),
  });

  const rejectMut = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => customerRegistrationApi.coordinatorReview(id, {
      action: 'Reject',
      rejectionReason: reason,
    }),
    onSuccess: () => {
      toast.success('Customer rejected');
      setRejectTarget(null);
      setRejectReason('');
      queryClient.invalidateQueries({ queryKey: ['coordinator-registration-approvals'] });
      queryClient.invalidateQueries({ queryKey: ['coordinator-dashboard'] });
    },
    onError: () => toast.error('Failed to reject customer'),
  });

  const handleApprove = () => {
    if (!approveTarget || !approvePassword.trim()) {
      toast.error('Password is required to approve this customer');
      return;
    }
    approveMut.mutate({
      id: approveTarget.id,
      password: approvePassword,
    });
  };

  const customers = data?.items || [];
  const totalPages = data ? Math.ceil(data.totalCount / data.pageSize) : 0;
  const inputCls = 'w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300';

  const columns: Column<RegistrationRequest>[] = [
    {
      key: 'shopName', header: 'Shop',
      render: (c) => (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
            <span className="text-white font-bold text-sm">{(c.customerName || '?')[0]}</span>
          </div>
          <div>
            <p className="font-semibold text-slate-800">{c.customerName}</p>
            <p className="text-xs text-slate-400">{c.regionName || 'No region'}</p>
          </div>
        </div>
      ),
    },
    { key: 'email', header: 'Contact', render: (c) => <div><p className="text-sm">{c.email || '—'}</p><p className="text-xs text-slate-400">{c.telephone || ''}</p></div> },
    { key: 'assignedRepName', header: 'Rep', render: (c) => c.assignedRepName || '—' },
    { key: 'createdAt', header: 'Registered', render: (c) => <span className="text-xs text-slate-500">{formatRelative(c.createdAt)}</span> },
    {
      key: 'actions', header: 'Actions', align: 'center' as const,
      render: (c) => (
        <div className="flex items-center gap-2 justify-center">
          <button onClick={(e) => { e.stopPropagation(); setApproveTarget(c); }}
            className="px-3 py-1.5 bg-emerald-500 text-white text-xs font-semibold rounded-lg hover:bg-emerald-600 transition flex items-center gap-1">
            <Check className="w-3.5 h-3.5" /> Approve
          </button>
          <button onClick={(e) => { e.stopPropagation(); setRejectTarget(c); }}
            className="px-3 py-1.5 border border-red-200 text-red-600 text-xs font-semibold rounded-lg hover:bg-red-50 transition flex items-center gap-1">
            <X className="w-3.5 h-3.5" /> Reject
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="animate-fade-in space-y-4 lg:space-y-6">
          <PageHeader title="Customer Approvals" subtitle={`${data?.totalCount || 0} pending registration requests`} />

      {isDesktop ? (
        <DataTable columns={columns} data={customers} isLoading={isLoading} keyExtractor={(c) => c.id}
          emptyIcon={<UserCheck className="w-12 h-12 text-emerald-300" />} emptyTitle="No pending approvals"
          emptyDescription="All customer registrations have been reviewed."
          page={page} totalPages={totalPages} onPageChange={setPage} />
      ) : (
        <MobileTileList data={customers} isLoading={isLoading} keyExtractor={(c) => c.id}
          page={page} totalPages={totalPages} onPageChange={setPage}
          renderTile={(c) => (
            <div>
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-bold text-sm">{(c.customerName || '?')[0]}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-800 text-sm">{c.customerName}</p>
                  <div className="flex flex-wrap gap-2 mt-1 text-[11px] text-slate-400">
                    {c.regionName && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{c.regionName}</span>}
                    {c.email && <span>{c.email}</span>}
                  </div>
                  <p className="text-[10px] text-slate-300 mt-1">{formatRelative(c.createdAt)}</p>
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <button onClick={(e) => { e.stopPropagation(); setApproveTarget(c); }}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-500 text-white text-xs font-semibold rounded-xl hover:bg-emerald-600 transition">
                  <Check className="w-3.5 h-3.5" /> Approve
                </button>
                <button onClick={(e) => { e.stopPropagation(); setRejectTarget(c); }}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 border border-red-200 text-red-600 text-xs font-semibold rounded-xl hover:bg-red-50 transition">
                  <X className="w-3.5 h-3.5" /> Reject
                </button>
              </div>
            </div>
          )}
        />
      )}

      {/* Approve BottomSheet */}
      <BottomSheet isOpen={!!approveTarget} onClose={() => setApproveTarget(null)} title={`Approve ${approveTarget?.customerName || ''}`}>
        {approveTarget && (
          <div className="space-y-4">
            <p className="text-sm text-slate-500">Approve this customer and set a permanent password. Sales rep ownership is managed through route assignment.</p>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Password</label>
              <input
                type="password"
                value={approvePassword}
                onChange={e => setApprovePassword(e.target.value)}
                placeholder="Set permanent password"
                className={inputCls}
              />
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => { setApproveTarget(null); setApprovePassword(''); }} className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
              <button onClick={handleApprove} disabled={approveMut.isPending || !approvePassword.trim()}
                className="flex-1 px-4 py-2.5 bg-emerald-500 text-white rounded-xl text-sm font-semibold hover:bg-emerald-600 transition flex items-center justify-center gap-2 disabled:opacity-50">
                {approveMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Approve
              </button>
            </div>
          </div>
        )}
      </BottomSheet>

      {/* Reject BottomSheet */}
      <BottomSheet isOpen={!!rejectTarget} onClose={() => { setRejectTarget(null); setRejectReason(''); }} title={`Reject ${rejectTarget?.customerName || ''}`}>
        {rejectTarget && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Reason for rejection</label>
              <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={3} placeholder="Provide a reason..."
                className={inputCls + ' resize-none'} />
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => { setRejectTarget(null); setRejectReason(''); }} className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
              <button onClick={() => rejectMut.mutate({ id: rejectTarget.id, reason: rejectReason })} disabled={rejectMut.isPending || !rejectReason.trim()}
                className="flex-1 px-4 py-2.5 bg-red-500 text-white rounded-xl text-sm font-semibold hover:bg-red-600 transition disabled:opacity-50 flex items-center justify-center gap-2">
                {rejectMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />} Reject
              </button>
            </div>
          </div>
        )}
      </BottomSheet>
    </div>
  );
}
