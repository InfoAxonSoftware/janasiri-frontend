import CustomerSupportForm from './CustomerSupportForm';
import { ArrowLeft, HeadphonesIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function CustomerCreateSupport() {
  const navigate = useNavigate();

  return (
    <div className="animate-fade-in pb-16">
      <div className="px-4 lg:px-6 pt-6 max-w-4xl mx-auto">
        
        {/* Header */}
        <div className="flex items-center gap-4 mb-6 bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
          <button 
            onClick={() => navigate(-1)} 
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-50 hover:bg-orange-50 hover:text-orange-600 text-black focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-black flex items-center gap-2">
              <HeadphonesIcon className="w-5 h-5 text-orange-600" />
              Get Ticket
            </h1>
            <p className="text-[12px] text-gray-500 font-medium mt-0.5">
              Create a support ticket or complaint and chat with the team
            </p>
          </div>
        </div>

        {/* Form Container */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 md:p-8">
          <CustomerSupportForm 
            onSuccess={() => navigate('/shop/support')} 
            onCancel={() => navigate('/shop/support')} 
          />
        </div>
        
      </div>
    </div>
  );
}