import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { customerSupportConfig } from '../support/roleSupportConfigs';
import { Send, UserCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';

type Props = { onSuccess?: () => void; onCancel?: () => void };

export default function CustomerSupportForm({ onSuccess, onCancel }: Props) {
  const queryClient = useQueryClient();
  
  const [formData, setFormData] = useState({
    name: '',
    position: '',
    email: '',
    phone: '',
    subject: '',
    message: ''
  });

  const createMut = useMutation({
    mutationFn: (data: any) => customerSupportConfig.createTicket(data),
    onSuccess: () => {
      toast.success('Support ticket created successfully!');
      queryClient.invalidateQueries({ queryKey: [customerSupportConfig.listQueryKey] });
      if (onSuccess) onSuccess();
    },
    onError: () => {
      toast.error('Failed to create ticket. Please try again.');
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.email.trim() || !formData.subject.trim() || !formData.message.trim()) {
      toast.error("Please fill in all required fields (*)");
      return;
    }

    // Combine contact info into message so the backend receives it properly
    const fullMessage = `Contact Info:\nName: ${formData.name}\nPosition: ${formData.position || 'N/A'}\nEmail: ${formData.email}\nPhone: ${formData.phone || 'N/A'}\n\nMessage:\n${formData.message}`;

    createMut.mutate({
      subject: formData.subject,
      message: fullMessage,
      // Sending extra fields just in case your backend supports them
      contactName: formData.name,
      contactEmail: formData.email,
      contactPhone: formData.phone,
      contactPosition: formData.position
    });
  };

  const inputClass = "w-full px-4 py-2.5 text-sm text-black font-medium bg-gray-50/50 border border-gray-200 rounded-xl focus:outline-none focus:ring-0 focus:border-orange-400 transition-all placeholder-gray-400";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col space-y-6">
      
      {/* Contact By Section */}
      <div>
        <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5 mb-4">
          <UserCircle2 className="w-4 h-4" /> Contact By
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] font-bold text-black uppercase tracking-widest mb-1.5">Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Your Name"
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-black uppercase tracking-widest mb-1.5">Position</label>
            <input
              type="text"
              value={formData.position}
              onChange={(e) => setFormData({ ...formData, position: e.target.value })}
              placeholder="e.g. Manager"
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-black uppercase tracking-widest mb-1.5">Email *</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="your@email.com"
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-black uppercase tracking-widest mb-1.5">Phone</label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="07X XXX XXXX"
              className={inputClass}
            />
          </div>
        </div>
      </div>

      <hr className="border-gray-100" />

      {/* Message Details */}
      <div>
        <label className="block text-[10px] font-bold text-black uppercase tracking-widest mb-1.5">Subject *</label>
        <input
          type="text"
          value={formData.subject}
          onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
          placeholder="e.g. Order #1024 Delivery issue"
          className={inputClass}
        />
      </div>

      <div className="flex-1">
        <label className="block text-[10px] font-bold text-black uppercase tracking-widest mb-1.5">Message *</label>
        <textarea
          value={formData.message}
          onChange={(e) => setFormData({ ...formData, message: e.target.value })}
          placeholder="Describe your issue or request in detail..."
          className={`${inputClass} min-h-[120px] resize-none`}
        />
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button 
          type="button" 
          onClick={onCancel} 
          className="flex-1 py-3 border border-gray-200 text-black font-bold rounded-xl hover:bg-gray-50 transition-colors text-sm"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={createMut.isPending}
          className="flex-[2] py-3 bg-orange-600 text-white font-bold rounded-xl hover:bg-gray-800 active:scale-95 transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-50"
        >
          {createMut.isPending ? 'Submitting...' : (
            <>
              Submit Ticket
              <Send className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </form>
  );
}