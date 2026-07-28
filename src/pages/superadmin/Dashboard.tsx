import { useState } from 'react';
import type { FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, UserPlus, LogOut, KeyRound } from 'lucide-react';
import toast from 'react-hot-toast';
import { authApi } from '../../services/api/authApi';
import { useAuth } from '../../hooks/useAuth';

export default function SuperAdminDashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [form, setForm] = useState({
    username: '',
    email: '',
    phoneNumber: '',
    password: '',
    fullName: '',
    department: '',
  });

  const createAdminMut = useMutation({
    mutationFn: () => authApi.createAdminAccount(form),
    onSuccess: () => {
      toast.success('Admin account created successfully');
      setForm({ username: '', email: '', phoneNumber: '', password: '', fullName: '', department: '' });
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Failed to create admin account');
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    if (!form.username || !form.password || !form.fullName) {
      toast.error('Username, full name, and password are required');
      return;
    }

    if (form.password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    createAdminMut.mutate();
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-5xl mx-auto px-4 lg:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </span>
            <div>
              <h1 className="text-sm lg:text-base font-bold text-slate-900">SuperAdmin Portal</h1>
              <p className="text-xs text-slate-500">Create and manage admin access</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:block text-right">
              <p className="text-sm font-semibold text-slate-800">{user?.username}</p>
              <p className="text-xs text-slate-500">{user?.role}</p>
            </div>
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
            >
              <LogOut className="w-4 h-4" />
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 lg:px-6 py-6 lg:py-8">
        <div className="rounded-2xl bg-gradient-to-br from-indigo-600 to-blue-600 text-white p-5 lg:p-6 mb-6">
          <p className="text-xs uppercase tracking-wide text-indigo-100">Access Control</p>
          <h2 className="text-xl lg:text-2xl font-bold mt-1">Create Admin Account</h2>
          <p className="text-sm text-indigo-100 mt-1">Add new admin users with secure credentials and profile details.</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 lg:p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-5">
            <UserPlus className="w-5 h-5 text-indigo-600" />
            <h3 className="font-semibold text-slate-900">New Admin Details</h3>
          </div>

          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Username *</label>
              <input
                value={form.username}
                onChange={e => setForm(p => ({ ...p, username: e.target.value }))}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300"
                placeholder="admin.user"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300"
                placeholder="admin@company.com (optional)"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Phone Number</label>
              <input
                value={form.phoneNumber}
                onChange={e => setForm(p => ({ ...p, phoneNumber: e.target.value }))}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300"
                placeholder="+9477XXXXXXX"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Full Name</label>
              <input
                value={form.fullName}
                onChange={e => setForm(p => ({ ...p, fullName: e.target.value }))}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300"
                placeholder="Administrator Name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Department</label>
              <input
                value={form.department}
                onChange={e => setForm(p => ({ ...p, department: e.target.value }))}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300"
                placeholder="Operations"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Password *</label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  value={form.password}
                  onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                  className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300"
                  placeholder="Minimum 6 characters"
                />
              </div>
            </div>

            <div className="md:col-span-2 flex justify-end mt-2">
              <button
                type="submit"
                disabled={createAdminMut.isPending}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition disabled:opacity-50"
              >
                <UserPlus className="w-4 h-4" />
                {createAdminMut.isPending ? 'Creating...' : 'Create Admin Account'}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
