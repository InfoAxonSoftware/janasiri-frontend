import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { customersApi } from '../../services/api/customersApi';
import toast from 'react-hot-toast';

type Props = { onSuccess?: () => void; onCancel?: () => void };

export default function RepCustomerForm({ onSuccess, onCancel }: Props) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ username: '', password: '', shopName: '', phoneNumber: '', email: '', city: '', street: '' });

  const createMut = useMutation({
    mutationFn: (d: Record<string, unknown>) => customersApi.repCreate(d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rep-customers'] });
      toast.success('Customer registered and assigned to you');
      setForm({ username: '', password: '', shopName: '', phoneNumber: '', email: '', city: '', street: '' });
      onSuccess?.();
    },
    onError: () => toast.error('Failed to register customer')
  });

  const handleCreate = () => {
    if (!form.username || !form.password || !form.shopName) return toast.error('Username, password and shop name are required');
    const payload: Record<string, unknown> = {
      username: form.username,
      password: form.password,
      shopName: form.shopName,
      phoneNumber: form.phoneNumber || undefined,
      email: form.email || undefined,
      street: form.street || undefined,
      city: form.city || undefined,
    };
    createMut.mutate(payload);
  };

  const cls = 'w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-emerald-500';

  return (
    <div className="space-y-3">
      <input value={form.shopName} onChange={e => setForm(f => ({ ...f, shopName: e.target.value }))} placeholder="Shop name*" className={cls} />
      <div className="grid grid-cols-2 gap-2">
        <input value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} placeholder="Username*" className={cls} />
        <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Password*" className={cls} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input value={form.phoneNumber} onChange={e => setForm(f => ({ ...f, phoneNumber: e.target.value }))} placeholder="Phone" className={cls} />
        <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="Email" className={cls} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} placeholder="City" className={cls} />
        <input value={form.street} onChange={e => setForm(f => ({ ...f, street: e.target.value }))} placeholder="Street" className={cls} />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button onClick={onCancel} className="w-full py-2.5 bg-slate-100 rounded-lg text-sm font-medium">Cancel</button>
        <button disabled={createMut.isPending} onClick={handleCreate} className="w-full py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">{createMut.isPending ? 'Registering...' : 'Register'}</button>
      </div>
    </div>
  );
}
