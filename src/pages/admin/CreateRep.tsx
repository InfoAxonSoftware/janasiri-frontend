import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import AdminRepForm from './AdminRepForm';

export default function CreateRep() {
  const navigate = useNavigate();
  return (
    <div className="px-6 py-8 max-w-4xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">New Sales Rep</h1>
          <p className="text-sm text-slate-500 mt-1">Create a new sales representative</p>
        </div>
        <div>
          <button onClick={() => navigate('/admin/reps')} className="p-2 hover:bg-slate-100 rounded-lg"><ArrowLeft className="w-5 h-5 text-slate-400" /></button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
        <AdminRepForm onSuccess={() => navigate('/admin/reps')} onCancel={() => navigate('/admin/reps')} />
      </div>
    </div>
  );
}
