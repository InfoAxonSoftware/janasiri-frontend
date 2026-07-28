import UnifiedSupportPage from '../../components/support/UnifiedSupportPage';
import { customerSupportConfig } from '../support/roleSupportConfigs';
import { Phone, Mail, MapPin, LifeBuoy } from 'lucide-react';

export default function CustomerSupport() {
  return (
    <div className="animate-fade-in space-y-6 pb-20">
      
      {/* Page Header */}
      <div className="flex items-center justify-between gap-3 px-4 lg:px-0">
        <div>
          <h1 className="text-2xl font-bold text-black flex items-center gap-2">
            <LifeBuoy className="w-6 h-6 text-orange-600" />
            Help & Support
          </h1>
          <p className="text-sm text-gray-500 mt-1">Get in touch with our team or manage your support tickets below.</p>
        </div>
      </div>

      <div className="px-4 lg:px-0 max-w-screen-xl mx-auto space-y-6">
        
        {/* Quick Contact Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm hover:shadow transition-shadow group">
            <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center mb-4 group-hover:bg-orange-50 transition-colors">
              <Phone className="w-5 h-5 text-black group-hover:text-orange-600" />
            </div>
            <h3 className="text-sm font-bold text-black mb-1">Hotline & Telephone</h3>
            <p className="text-[11px] text-gray-500 mb-3">Call us directly for urgent inquiries.</p>
            <div className="space-y-1">
              <p className="text-sm font-bold text-black">0777 675 322</p>
              <p className="text-sm font-bold text-black">0814 950 206</p>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm hover:shadow transition-shadow group">
            <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center mb-4 group-hover:bg-orange-50 transition-colors">
              <Mail className="w-5 h-5 text-black group-hover:text-orange-600" />
            </div>
            <h3 className="text-sm font-bold text-black mb-1">Email Support</h3>
            <p className="text-[11px] text-gray-500 mb-3">Drop us an email. We usually reply within 24 hours.</p>
            <a href="mailto:janasiridistributors@yahoo.com" className="text-sm font-bold text-black hover:text-orange-600 transition-colors break-all">
              janasiridistributors<br/>@yahoo.com
            </a>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm hover:shadow transition-shadow group">
            <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center mb-4 group-hover:bg-orange-50 transition-colors">
              <MapPin className="w-5 h-5 text-black group-hover:text-orange-600" />
            </div>
            <h3 className="text-sm font-bold text-black mb-1">Head Office</h3>
            <p className="text-[11px] text-gray-500 mb-3">Visit us for direct business inquiries.</p>
            <p className="text-sm font-bold text-black leading-snug">
              No 205 Wattarantenna Passage,<br />Kandy.
            </p>
          </div>
        </div>

        {/* Existing Ticket Dashboard */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden p-2">
           <UnifiedSupportPage config={customerSupportConfig} />
        </div>

      </div>
    </div>
  );
}