import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { coordinatorGetProfile, coordinatorUpdateProfile } from '../../services/api/coordinatorApi';
import { useAuth } from '../../hooks/useAuth';
import { authApi } from '../../services/api/authApi';
import {
  User, Mail, Phone, MapPin, Calendar, BadgeCheck, Users,
  Edit3, Lock, X, Loader2,
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function CoordinatorProfile() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);

  const { data: profile, isLoading } = useQuery({
    queryKey: ['coordinator-profile-page'],
    queryFn: coordinatorGetProfile,
  });

  const [editForm, setEditForm] = useState({ fullName: '', phoneNumber: '' });
  const openEdit = () => {
    setEditForm({
      fullName: profile?.fullName || '',
      phoneNumber: profile?.phoneNumber || '',
    });
    setEditOpen(true);
  };

  const updateMut = useMutation({
    mutationFn: () => coordinatorUpdateProfile({
      fullName: editForm.fullName,
      phoneNumber: editForm.phoneNumber,
    }),
    onSuccess: () => {
      toast.success('Profile updated');
      setEditOpen(false);
      qc.invalidateQueries({ queryKey: ['coordinator-profile-page'] });
      qc.invalidateQueries({ queryKey: ['coordinator-profile'] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed to update profile'),
  });

  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const pwMut = useMutation({
    mutationFn: () => authApi.changePassword({ currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword }),
    onSuccess: () => {
      toast.success('Password changed');
      setPwOpen(false);
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed to change password'),
  });

  const submitPassword = () => {
    if (!pwForm.currentPassword || !pwForm.newPassword || !pwForm.confirmPassword) {
      toast.error('Please fill all password fields');
      return;
    }
    if (pwForm.newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    pwMut.mutate();
  };

  return (
    <div className="animate-fade-in space-y-5 pb-8">
      <div className="bg-gradient-to-br from-cyan-600 via-cyan-500 to-blue-600 text-white rounded-2xl p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/3" />
        <div className="relative flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30">
            <span className="text-2xl font-bold">{(profile?.fullName || user?.username || 'C')[0]?.toUpperCase()}</span>
          </div>
          <div>
            <h1 className="text-xl font-bold">{profile?.fullName || user?.username || 'Sales Coordinator'}</h1>
            <p className="text-cyan-100 text-sm">{profile?.employeeCode || 'No employee code'}</p>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-slate-900">Profile Details</h2>
          <button onClick={openEdit} className="p-2 text-slate-400 hover:text-cyan-600 hover:bg-cyan-50 rounded-lg transition">
            <Edit3 className="w-4 h-4" />
          </button>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            <div className="h-10 bg-slate-100 rounded-xl skeleton" />
            <div className="h-10 bg-slate-100 rounded-xl skeleton" />
            <div className="h-10 bg-slate-100 rounded-xl skeleton" />
            <div className="h-10 bg-slate-100 rounded-xl skeleton" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <InfoRow icon={<User className="w-4 h-4 text-slate-500" />} label="Full Name" value={profile?.fullName || 'N/A'} />
            <InfoRow icon={<BadgeCheck className="w-4 h-4 text-slate-500" />} label="Employee Code" value={profile?.employeeCode || 'N/A'} />
            <InfoRow icon={<Mail className="w-4 h-4 text-slate-500" />} label="Email" value={profile?.email || user?.email || 'N/A'} />
            <InfoRow icon={<Phone className="w-4 h-4 text-slate-500" />} label="Phone" value={profile?.phoneNumber || user?.phoneNumber || 'N/A'} />
            <InfoRow icon={<MapPin className="w-4 h-4 text-slate-500" />} label="Region" value={profile?.regionName || 'N/A'} />
            <InfoRow icon={<Users className="w-4 h-4 text-slate-500" />} label="Assigned Reps" value={String(profile?.assignedRepsCount || 0)} />
            <InfoRow icon={<Users className="w-4 h-4 text-slate-500" />} label="Assigned Customers" value={String(profile?.assignedCustomersCount || 0)} />
            <InfoRow
              icon={<Calendar className="w-4 h-4 text-slate-500" />}
              label="Hire Date"
              value={profile?.hireDate ? new Date(profile.hireDate).toLocaleDateString() : 'N/A'}
            />
          </div>
        )}
      </div>

      <button
        onClick={() => setPwOpen(true)}
        className="w-full py-3.5 bg-white border border-slate-200 rounded-2xl text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-all flex items-center justify-between px-5"
      >
        <span className="inline-flex items-center gap-2"><Lock className="w-4 h-4 text-slate-400" /> Change Password</span>
      </button>

      {editOpen && (
        <div className="fixed inset-0 z-50">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setEditOpen(false)} />
          <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl max-h-[85vh] overflow-y-auto animate-slide-up">
            <div className="sticky top-0 bg-white rounded-t-3xl border-b border-slate-100 px-5 py-4 z-10">
              <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-3" />
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-slate-900">Edit Profile</h2>
                <button onClick={() => setEditOpen(false)} className="p-1.5 hover:bg-slate-100 rounded-xl transition"><X className="w-5 h-5 text-slate-400" /></button>
              </div>
            </div>
            <div className="p-5 space-y-4">
              <Field label="Full Name" value={editForm.fullName} onChange={(v) => setEditForm((p) => ({ ...p, fullName: v }))} />
              <Field label="Phone Number" value={editForm.phoneNumber} onChange={(v) => setEditForm((p) => ({ ...p, phoneNumber: v }))} />
              <button
                onClick={() => updateMut.mutate()}
                disabled={updateMut.isPending}
                className="w-full py-3.5 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {updateMut.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {pwOpen && (
        <div className="fixed inset-0 z-50">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setPwOpen(false)} />
          <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl max-h-[85vh] overflow-y-auto animate-slide-up">
            <div className="sticky top-0 bg-white rounded-t-3xl border-b border-slate-100 px-5 py-4 z-10">
              <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-3" />
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-slate-900">Change Password</h2>
                <button onClick={() => setPwOpen(false)} className="p-1.5 hover:bg-slate-100 rounded-xl transition"><X className="w-5 h-5 text-slate-400" /></button>
              </div>
            </div>
            <div className="p-5 space-y-4">
              <Field label="Current Password" type="password" value={pwForm.currentPassword} onChange={(v) => setPwForm((p) => ({ ...p, currentPassword: v }))} />
              <Field label="New Password" type="password" value={pwForm.newPassword} onChange={(v) => setPwForm((p) => ({ ...p, newPassword: v }))} />
              <Field label="Confirm Password" type="password" value={pwForm.confirmPassword} onChange={(v) => setPwForm((p) => ({ ...p, confirmPassword: v }))} />
              <button
                onClick={submitPassword}
                disabled={pwMut.isPending}
                className="w-full py-3.5 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {pwMut.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Updating...</> : 'Update Password'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50/70">
      <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center">{icon}</div>
      <div>
        <p className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold">{label}</p>
        <p className="text-sm text-slate-900 font-medium">{value}</p>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-500 mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-400 outline-none transition"
      />
    </div>
  );
}
