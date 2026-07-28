import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import AdminCoordinatorForm from './AdminCoordinatorForm';

export default function CreateCoordinator() {
  const navigate = useNavigate();

  return (
    <div className="px-6 py-8 max-w-4xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">New Coordinator</h1>
          <p className="text-sm text-slate-500 mt-1">Create a new sales coordinator account</p>
        </div>
        <button onClick={() => navigate('/admin/coordinators')} className="p-2 hover:bg-slate-100 rounded-lg">
          <ArrowLeft className="w-5 h-5 text-slate-400" />
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
        <AdminCoordinatorForm
          onSuccess={() => navigate('/admin/coordinators')}
          onCancel={() => navigate('/admin/coordinators')}
        />
      </div>
    </div>
  );
}
