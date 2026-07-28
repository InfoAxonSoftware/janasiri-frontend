import RepCustomerForm from './RepCustomerForm';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function RepCreateCustomer() {
  const navigate = useNavigate();

  return (
    <div className="animate-fade-in pb-16">
      <div className="px-4 lg:px-6 pt-6 max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate(-1)} className="p-2 rounded-lg bg-slate-50 hover:bg-slate-100">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Register Customer</h1>
            <p className="text-sm text-slate-500 mt-0.5">Create a new customer and assign to this sales rep</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 max-w-2xl">
          <RepCustomerForm onSuccess={() => navigate('/rep/customers')} onCancel={() => navigate('/rep/customers')} />
        </div>
      </div>
    </div>
  );
}
