import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Pencil, Plus, ShieldCheck, Trash2, KeyRound, Copy } from 'lucide-react';
import toast from 'react-hot-toast';
import PageHeader from '../../components/common/PageHeader';
import DataTable, { type Column } from '../../components/common/DataTable';
import EmptyState from '../../components/common/EmptyState';
import BottomSheet from '../../components/common/BottomSheet';
import ConfirmModal from '../../components/common/ConfirmModal';
import StatusBadge from '../../components/common/StatusBadge';
import { authApi } from '../../services/api/authApi';
import type { AdminAccountInfo, UpdateAdminAccountRequest } from '../../types/auth.types';

const initialEditForm = {
  email: '',
  phoneNumber: '',
  fullName: '',
  department: '',
};

const toUpdatePayload = (form: typeof initialEditForm, isActive: boolean): UpdateAdminAccountRequest => ({
  email: form.email,
  phoneNumber: form.phoneNumber,
  fullName: form.fullName,
  department: form.department,
  isActive,
});

export default function AdminAccounts() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [editTarget, setEditTarget] = useState<AdminAccountInfo | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminAccountInfo | null>(null);
  const [generatedTempPassword, setGeneratedTempPassword] = useState<{ username: string; password: string } | null>(null);
  const [form, setForm] = useState(initialEditForm);

  const { data: admins = [], isLoading } = useQuery({
    queryKey: ['superadmin-admin-accounts'],
    queryFn: () => authApi.getAdminAccounts().then((r) => r.data.data || []),
  });

  const filteredAdmins = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    if (!normalized) return admins;

    return admins.filter((admin) =>
      admin.fullName.toLowerCase().includes(normalized)
      || admin.email.toLowerCase().includes(normalized)
      || admin.username.toLowerCase().includes(normalized)
      || (admin.department || '').toLowerCase().includes(normalized)
    );
  }, [admins, search]);

  const updateMut = useMutation({
    mutationFn: ({ userId, payload }: { userId: string; payload: UpdateAdminAccountRequest }) => authApi.updateAdminAccount(userId, payload),
    onSuccess: () => {
      toast.success('Admin account updated');
      queryClient.invalidateQueries({ queryKey: ['superadmin-admin-accounts'] });
      setEditTarget(null);
      setForm(initialEditForm);
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Failed to update admin');
    },
  });

  const deleteMut = useMutation({
    mutationFn: (userId: string) => authApi.deleteAdminAccount(userId),
    onSuccess: () => {
      toast.success('Admin account deactivated');
      queryClient.invalidateQueries({ queryKey: ['superadmin-admin-accounts'] });
      setDeleteTarget(null);
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Failed to delete admin');
    },
  });

  const resetTempPasswordMut = useMutation({
    mutationFn: (userId: string) => authApi.adminResetUserTempPassword(userId),
    onSuccess: (res) => {
      const payload = res.data.data;
      setGeneratedTempPassword({ username: payload.username, password: payload.temporaryPassword });
      queryClient.invalidateQueries({ queryKey: ['superadmin-admin-accounts'] });
      toast.success('Password reset successfully');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Failed to reset password');
    },
  });

  const copyTempPassword = async () => {
    if (!generatedTempPassword?.password) return;
    try {
      await navigator.clipboard.writeText(generatedTempPassword.password);
      toast.success('Password copied');
    } catch {
      toast.error('Could not copy password');
    }
  };

  const startCreate = () => navigate('/admin/admin-accounts/new');

  const selectedGeneratedPassword = generatedTempPassword?.password
    || (generatedTempPassword?.username
      ? admins.find(a => a.username === generatedTempPassword.username)?.temporaryPassword
      : undefined)
    || '';

  const startEdit = (target: AdminAccountInfo) => {
    setEditTarget(target);
    setForm({
      email: target.email,
      phoneNumber: target.phoneNumber || '',
      fullName: target.fullName || '',
      department: target.department || '',
    });
  };

  const columns: Column<AdminAccountInfo>[] = [
    {
      key: 'fullName',
      header: 'Admin',
      render: (admin) => (
        <div>
          <p className="font-semibold text-slate-900">{admin.fullName || admin.email}</p>
          <p className="text-xs text-slate-500">{admin.email}</p>
        </div>
      ),
    },
    {
      key: 'department',
      header: 'Department',
      render: (admin) => <span className="text-sm text-slate-600">{admin.department || 'Not set'}</span>,
    },
    {
      key: 'username',
      header: 'Username',
      render: (admin) => <span className="text-xs font-mono text-slate-600">{admin.username}</span>,
    },
    {
      key: 'mustChangePassword',
      header: 'Password Status',
      render: (admin) => (
        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${admin.mustChangePassword ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
          {admin.mustChangePassword ? 'Reset required' : 'No forced reset'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (admin) => <StatusBadge status={admin.isActive ? 'Open' : 'Closed'} />,
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (admin) => (
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              startEdit(admin);
            }}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            <Pencil className="w-3.5 h-3.5" />
            Edit
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              resetTempPasswordMut.mutate(admin.userId);
            }}
            className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 px-2.5 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-50"
          >
            <KeyRound className="w-3.5 h-3.5" />
            Reset Password
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setDeleteTarget(admin);
            }}
            className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2.5 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete
          </button>
        </div>
      ),
    },
  ];

  const canSubmit = true;

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Admin Section"
        subtitle="Create, edit, and deactivate admin accounts"
        actions={[{ label: 'Create Admin', icon: Plus, onClick: startCreate }]}
      />

      <div className="px-4 lg:px-6 pb-6 space-y-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-3 sm:p-4">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, username, or department"
            className="w-full md:max-w-md rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
          />
        </div>

        <DataTable
          data={filteredAdmins}
          columns={columns}
          keyField="userId"
          isLoading={isLoading}
          page={1}
          totalPages={1}
          onPageChange={() => {}}
          emptyState={
            <EmptyState
              icon={ShieldCheck}
              title="No admin accounts"
              description="Create the first admin account for your operations team."
              action={{ label: 'Create Admin', onClick: startCreate }}
            />
          }
        />
      </div>

      <BottomSheet
        open={!!editTarget}
        onClose={() => {
          setEditTarget(null);
          setForm(initialEditForm);
        }}
        title="Edit Admin Account"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
              placeholder="admin@company.com"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none transition"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Full Name</label>
            <input
              value={form.fullName || ''}
              onChange={(e) => setForm((prev) => ({ ...prev, fullName: e.target.value }))}
              placeholder="Administrator Name"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none transition"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Phone Number</label>
            <input
              value={form.phoneNumber}
              onChange={(e) => setForm((prev) => ({ ...prev, phoneNumber: e.target.value }))}
              placeholder="+9477XXXXXXX"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none transition"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Department</label>
            <input
              value={form.department || ''}
              onChange={(e) => setForm((prev) => ({ ...prev, department: e.target.value }))}
              placeholder="Operations"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none transition"
            />
          </div>

          {editTarget && (
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Status</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setEditTarget((prev) => (prev ? { ...prev, isActive: true } : prev))}
                  className={`py-2.5 rounded-xl text-xs font-semibold transition ${editTarget.isActive ? 'bg-emerald-500 text-white' : 'bg-slate-50 text-slate-500 border border-slate-200'}`}
                >
                  Active
                </button>
                <button
                  type="button"
                  onClick={() => setEditTarget((prev) => (prev ? { ...prev, isActive: false } : prev))}
                  className={`py-2.5 rounded-xl text-xs font-semibold transition ${!editTarget.isActive ? 'bg-rose-500 text-white' : 'bg-slate-50 text-slate-500 border border-slate-200'}`}
                >
                  Inactive
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 mt-2">
            <button
              type="button"
              onClick={() => {
                setEditTarget(null);
                setForm(initialEditForm);
              }}
              className="w-full py-2.5 bg-slate-100 rounded-lg text-sm font-medium"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={updateMut.isPending || !canSubmit}
              onClick={() => {
                if (!editTarget) return;
                updateMut.mutate({
                  userId: editTarget.userId,
                  payload: toUpdatePayload(form, editTarget.isActive),
                });
              }}
              className="w-full py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium disabled:opacity-60"
            >
              {updateMut.isPending ? 'Updating...' : 'Update Admin'}
            </button>
          </div>
        </div>
      </BottomSheet>

      <ConfirmModal
        open={!!deleteTarget}
        title="Delete admin account"
        description={`Are you sure you want to deactivate ${deleteTarget?.email || 'this account'}?`}
        confirmLabel={deleteMut.isPending ? 'Deleting...' : 'Delete'}
        confirmVariant="orange"
        onConfirm={() => deleteTarget && deleteMut.mutate(deleteTarget.userId)}
        onCancel={() => setDeleteTarget(null)}
      />

      <BottomSheet
        open={!!generatedTempPassword}
        onClose={() => setGeneratedTempPassword(null)}
        title="New Password"
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-600">Share this new password securely with the user.</p>
          <div className="rounded-xl border border-slate-200 p-3 bg-slate-50">
            <p className="text-xs text-slate-500">Username</p>
            <p className="text-sm font-semibold text-slate-800 break-all">{generatedTempPassword?.username}</p>
          </div>
          <div className="rounded-xl border border-indigo-200 p-3 bg-indigo-50">
            <p className="text-xs text-indigo-700">Generated Password</p>
            <div className="mt-1 flex items-center justify-between gap-2">
              <p className="text-sm font-mono font-semibold text-indigo-800">{selectedGeneratedPassword}</p>
              <button
                type="button"
                onClick={copyTempPassword}
                className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-700 hover:text-indigo-900"
              >
                <Copy className="w-3.5 h-3.5" /> Copy
              </button>
            </div>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}
