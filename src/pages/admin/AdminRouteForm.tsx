import { useState } from 'react';

type Props = { reps: { id: string; fullName?: string; username?: string }[]; initial?: any; onSubmit: (d: any) => void; onCancel?: () => void; isPending?: boolean };

export default function AdminRouteForm({ reps, initial, onSubmit, onCancel, isPending }: Props) {
  const [form, setForm] = useState({ name: initial?.name || '', description: initial?.description || '', repId: initial?.repId || '', daysOfWeek: initial?.daysOfWeek || 'Monday,Wednesday,Friday', estimatedDurationMinutes: initial?.estimatedDurationMinutes?.toString() || '120' });
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));
  const cls = 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none';

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Name *</label>
        <input value={form.name} onChange={e => set('name', e.target.value)} className={cls} />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
        <input value={form.description} onChange={e => set('description', e.target.value)} className={cls} />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Assign to Rep *</label>
        <select value={form.repId} onChange={e => set('repId', e.target.value)} className={cls + ' bg-white'}>
          <option value="">Select rep</option>
          {reps.map(r => <option key={r.id} value={r.id}>{r.fullName || r.username}</option>)}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Days of Week</label>
        <input value={form.daysOfWeek} onChange={e => set('daysOfWeek', e.target.value)} className={cls} placeholder="Monday,Wednesday,Friday" />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Est. Duration (min)</label>
        <input type="number" value={form.estimatedDurationMinutes} onChange={e => set('estimatedDurationMinutes', e.target.value)} className={cls} />
      </div>

      <div className="flex gap-3 mt-6">
        <button onClick={onCancel} className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-medium transition">Cancel</button>
        <button onClick={() => onSubmit({ ...form, estimatedDurationMinutes: parseInt(form.estimatedDurationMinutes || '0') })} disabled={isPending || !form.name || !form.repId} className="flex-1 py-2.5 bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg text-sm font-medium transition disabled:opacity-50">{isPending ? 'Creating...' : 'Create Route'}</button>
      </div>
    </div>
  );
}
