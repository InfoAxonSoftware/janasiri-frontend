import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import PageHeader from '../../components/common/PageHeader';
import { repsApi } from '../../services/api/repsApi';

export default function RepProfileEdit() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: profile, isLoading } = useQuery({
    queryKey: ['rep-profile-page'],
    queryFn: () => repsApi.repGetProfile().then((r) => r.data.data),
  });

  const [form, setForm] = useState({ fullName: '', phoneNumber: '', hireDate: '' });

  useEffect(() => {
    if (!profile) return;
    setForm({
      fullName: profile.fullName || '',
      phoneNumber: profile.phoneNumber || '',
      hireDate: profile.hireDate ? String(profile.hireDate).split('T')[0] : '',
    });
  }, [profile]);

  const updateProfileMutation = useMutation({
    mutationFn: () =>
      repsApi.repUpdateProfile({
        fullName: form.fullName,
        phoneNumber: form.phoneNumber,
        hireDate: form.hireDate || undefined,
      }),
    onSuccess: () => {
      toast.success('Profile updated');
      queryClient.invalidateQueries({ queryKey: ['rep-profile-page'] });
      queryClient.invalidateQueries({ queryKey: ['rep-profile'] });
      navigate('/rep/profile');
    },
    onError: (error: any) => toast.error(error?.response?.data?.message || 'Failed to update profile'),
  });

  return (
    <div className="animate-fade-in space-y-5 pb-8">
      <PageHeader title="Edit Profile" subtitle="Update your sales rep account details" backTo="/rep/profile" />

      <div className="bg-white border border-slate-200 rounded-2xl p-5 md:p-6 max-w-3xl">
        {isLoading ? (
          <div className="space-y-3">
            <div className="h-10 bg-slate-100 rounded-xl skeleton" />
            <div className="h-10 bg-slate-100 rounded-xl skeleton" />
            <div className="h-10 bg-slate-100 rounded-xl skeleton" />
          </div>
        ) : (
          <div className="space-y-4">
            <Field
              label="Full Name"
              value={form.fullName}
              onChange={(value) => setForm((prev) => ({ ...prev, fullName: value }))}
            />
            <Field
              label="Phone Number"
              value={form.phoneNumber}
              onChange={(value) => setForm((prev) => ({ ...prev, phoneNumber: value }))}
            />
            <Field
              label="Hire Date"
              type="date"
              value={form.hireDate}
              onChange={(value) => setForm((prev) => ({ ...prev, hireDate: value }))}
            />

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => navigate('/rep/profile')}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-medium hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => updateProfileMutation.mutate()}
                disabled={updateProfileMutation.isPending}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold hover:from-emerald-700 hover:to-teal-700 transition disabled:opacity-60 inline-flex items-center gap-2"
              >
                {updateProfileMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-500 mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 outline-none transition"
      />
    </div>
  );
}
