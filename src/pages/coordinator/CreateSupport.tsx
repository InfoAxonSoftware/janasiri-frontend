import { useNavigate } from 'react-router-dom';
import CoordinatorSupportForm from './SupportForm';

export default function CoordinatorCreateSupport() {
  const navigate = useNavigate();

  return (
    <div className="animate-fade-in pb-16">
      <div className="px-4 lg:px-6 pt-6 max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate(-1)} className="p-2 rounded-lg bg-slate-50 hover:bg-slate-100">
            <span className="sr-only">Back</span>
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Get Ticket</h1>
            <p className="text-sm text-slate-500 mt-0.5">Create a support ticket or complaint and chat with the team</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 max-w-2xl">
          <CoordinatorSupportForm onSuccess={() => navigate('/coordinator/support')} onCancel={() => navigate('/coordinator/support')} />
        </div>
      </div>
    </div>
  );
}
