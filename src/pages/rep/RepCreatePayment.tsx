import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customersApi } from '../../services/api/customersApi';
import { paymentsApi } from '../../services/api/paymentsApi';
import { formatCurrency } from '../../utils/formatters';
import { ArrowLeft, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { orderDraftUtils } from '../../utils/orderDraft';
import { toApiPaymentMethod } from '../../utils/paymentUtils';

export default function RepCreatePayment() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const draft = orderDraftUtils.get();
  const [customerId, setCustomerId] = useState(draft.customerId || '');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('Cash');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [chequeNumber, setChequeNumber] = useState('');
  const [bankName, setBankName] = useState('');
  const [notes, setNotes] = useState('');

  const { data: customersList } = useQuery({
    queryKey: ['rep-customers-dropdown'],
    queryFn: () => customersApi.repGetCustomers({ page: 1, pageSize: 200 }).then(r => r.data.data),
  });

  const recordMut = useMutation({
    mutationFn: (d: any) => paymentsApi.repRecord(d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rep-payments'] });
      toast.success('Payment recorded!');
      navigate('/rep/payments');
    },
    onError: () => toast.error('Failed to record payment'),
  });

  const cls = 'w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500/20 outline-none';

  return (
    <div className="animate-fade-in pb-16">
      <div className="px-4 lg:px-6 pt-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate(-1)} className="p-2 rounded-lg bg-slate-50 hover:bg-slate-100">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Record Payment</h1>
            <p className="text-sm text-slate-500 mt-0.5">Record a collection for a customer</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Customer *</label>
              <select
                value={customerId || draft.customerId || ''}
                onChange={e => {
                  const id = e.target.value;
                  setCustomerId(id);
                  const sel = customersList?.items?.find((c: any) => c.id === id);
                  if (sel) orderDraftUtils.setCustomer(sel.id, sel.shopName || sel.phoneNumber || sel.id);
                }}
                className={cls}
              >
                <option value="">Select customer...</option>
                {customersList?.items?.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.shopName || c.contactPerson} — {c.city}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Amount (LKR) *</label>
                <input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} className={cls} placeholder="0.00" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Payment Method</label>
                <select value={method} onChange={e => setMethod(e.target.value)} className={cls + ' bg-white'}>
                  <option>Cash</option>
                  <option>Cheque</option>
                  <option>BankTransfer</option>
                  <option>Card</option>
                </select>
              </div>
            </div>

            {method === 'Cheque' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Cheque Number</label>
                  <input value={chequeNumber} onChange={e => setChequeNumber(e.target.value)} className={cls} />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Bank Name</label>
                  <input value={bankName} onChange={e => setBankName(e.target.value)} className={cls} />
                </div>
              </div>
            )}

            {method === 'BankTransfer' && (
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Reference Number</label>
                <input value={referenceNumber} onChange={e => setReferenceNumber(e.target.value)} className={cls} />
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Notes</label>
              <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} className={cls + ' resize-none'} placeholder="Optional notes" />
            </div>

            <div className="mt-4">
              <button onClick={() => recordMut.mutate({ customerId: customerId || draft.customerId, amount: parseFloat(amount), paymentMethod: toApiPaymentMethod(method), referenceNumber: referenceNumber || undefined, chequeNumber: chequeNumber || undefined, bankName: bankName || undefined, notes: notes || undefined })} disabled={recordMut.isPending || !(customerId || draft.customerId) || !amount} className="w-full py-3.5 bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-700 transition disabled:opacity-50 active:scale-95">
                {recordMut.isPending ? 'Recording...' : `Record ${amount ? formatCurrency(parseFloat(amount)) : 'Payment'}`}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
