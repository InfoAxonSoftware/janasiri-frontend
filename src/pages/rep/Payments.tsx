import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { paymentsApi } from '../../services/api/paymentsApi';
import { customersApi } from '../../services/api/customersApi';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { CreditCard, Plus, Loader2 } from 'lucide-react';
import { useIsDesktop } from '../../hooks/useMediaQuery';
import { orderDraftUtils } from '../../utils/orderDraft';
import { toApiPaymentMethod } from '../../utils/paymentUtils';
import PageHeader from '../../components/common/PageHeader';
import DataTable, { type Column } from '../../components/common/DataTable';
import MobileTileList from '../../components/common/MobileTileList';
import BottomSheet from '../../components/common/BottomSheet';
import StatusBadge from '../../components/common/StatusBadge';
import type { Payment, PaymentRecord } from '../../types/payment.types';
import toast from 'react-hot-toast';

export default function RepPayments() {
  const [page, setPage] = useState(1);
  const [showRecord, setShowRecord] = useState(false);
  const [selected, setSelected] = useState<Payment | null>(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const isDesktop = useIsDesktop();

  const { data, isLoading } = useQuery({
    queryKey: ['rep-payments', page],
    queryFn: () => paymentsApi.repGetAll({ page, pageSize: 20 }).then(r => r.data.data),
  });

  const recordMut = useMutation({
    mutationFn: (d: PaymentRecord) => paymentsApi.repRecord(d as any),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['rep-payments'] }); setShowRecord(false); toast.success('Payment recorded!'); },
    onError: () => toast.error('Failed to record payment'),
  });

  const payments = data?.items || [];
  const totalPages = data?.totalPages || (data ? Math.ceil(data.totalCount / data.pageSize) : 0);

  const columns: Column<Payment>[] = [
    {
      key: 'customerName', header: 'Customer',
      render: (p) => <span className="font-medium text-slate-800">{p.customerName || 'Customer'}</span>,
    },
    { key: 'paymentMethod', header: 'Method', render: (p) => p.paymentMethod },
    { key: 'referenceNumber', header: 'Reference', render: (p) => p.referenceNumber || '—' },
    { key: 'paymentDate', header: 'Date', render: (p) => <span className="text-sm text-slate-500">{formatDate(p.paymentDate)}</span> },
    { key: 'amount', header: 'Amount', align: 'right' as const, render: (p) => <span className="font-semibold text-emerald-600">{formatCurrency(p.amount)}</span> },
    { key: 'status', header: 'Status', align: 'center' as const, render: (p) => <StatusBadge status={p.status} type="payments" /> },
  ];

  return (
    <div className="animate-fade-in space-y-4 lg:space-y-6">
      <PageHeader title="Payments" subtitle="Record and track collections"
        actions={[{
          label: 'Record Payment',
          onClick: () => isDesktop ? navigate('/rep/payments/new') : setShowRecord(true),
          icon: Plus,
          variant: 'primary' as const,
        }]} />

      {isDesktop ? (
        <DataTable columns={columns} data={payments} isLoading={isLoading} keyExtractor={(p) => p.id}
          onRowClick={(p) => setSelected(p)} emptyIcon={<CreditCard className="w-12 h-12 text-slate-300" />}
          emptyTitle="No payments recorded" page={page} totalPages={totalPages} onPageChange={setPage} />
      ) : (
        <MobileTileList data={payments} isLoading={isLoading} keyExtractor={(p) => p.id}
          onTileClick={(p) => setSelected(p)} page={page} totalPages={totalPages} onPageChange={setPage}
          renderTile={(p) => (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-bold text-slate-800">{p.customerName || 'Customer'}</span>
                <StatusBadge status={p.status} type="payments" />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500">{p.paymentMethod} {p.referenceNumber ? `• ${p.referenceNumber}` : ''}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">{formatDate(p.paymentDate)}</p>
                </div>
                <span className="text-base font-bold text-emerald-600">{formatCurrency(p.amount)}</span>
              </div>
            </div>
          )}
        />
      )}

      {/* Payment Detail BottomSheet */}
      <BottomSheet isOpen={!!selected} onClose={() => setSelected(null)} title="Payment Details">
        {selected && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-50 rounded-xl p-3"><p className="text-xs text-slate-500">Customer</p><p className="font-semibold text-slate-900">{selected.customerName}</p></div>
              <div className="bg-slate-50 rounded-xl p-3"><p className="text-xs text-slate-500">Amount</p><p className="font-bold text-emerald-600">{formatCurrency(selected.amount)}</p></div>
              <div className="bg-slate-50 rounded-xl p-3"><p className="text-xs text-slate-500">Method</p><p className="font-medium text-slate-900">{selected.paymentMethod}</p></div>
              <div className="bg-slate-50 rounded-xl p-3"><p className="text-xs text-slate-500">Date</p><p className="font-medium text-slate-900">{formatDate(selected.paymentDate)}</p></div>
            </div>
            {selected.referenceNumber && (
              <div className="bg-slate-50 rounded-xl p-3"><p className="text-xs text-slate-500">Reference</p><p className="font-medium text-slate-900">{selected.referenceNumber}</p></div>
            )}
            <div className="flex justify-center"><StatusBadge status={selected.status} type="payments" /></div>
          </div>
        )}
      </BottomSheet>

      {/* Record Payment BottomSheet (mobile only) */}
      <BottomSheet isOpen={showRecord} onClose={() => setShowRecord(false)} title="Record Payment">
        <RecordPaymentForm onSubmit={(d) => recordMut.mutate(d)} isPending={recordMut.isPending} onCancel={() => setShowRecord(false)} />
      </BottomSheet>
    </div>
  );
}

function RecordPaymentForm({ onSubmit, isPending, onCancel }: { onSubmit: (d: PaymentRecord) => void; isPending: boolean; onCancel: () => void }) {
  const [customerId, setCustomerId] = useState(orderDraftUtils.get().customerId || '');
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

  const cls = 'w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300';

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">Customer *</label>
        <select value={customerId} onChange={e => setCustomerId(e.target.value)} className={cls}>
          <option value="">Select customer...</option>
          {customersList?.items?.map((c: any) => (
            <option key={c.id} value={c.id}>{c.shopName || c.contactPerson} — {c.city}</option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Amount (LKR) *</label>
          <input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} className={cls} placeholder="0.00" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Payment Method</label>
          <select value={method} onChange={e => setMethod(e.target.value)} className={cls}>
            <option>Cash</option><option>Cheque</option><option>BankTransfer</option><option>Card</option>
          </select>
        </div>
      </div>
      {method === 'Cheque' && (
        <div className="grid grid-cols-2 gap-3">
          <div><label className="block text-sm font-medium text-slate-700 mb-1.5">Cheque Number</label><input value={chequeNumber} onChange={e => setChequeNumber(e.target.value)} className={cls} /></div>
          <div><label className="block text-sm font-medium text-slate-700 mb-1.5">Bank Name</label><input value={bankName} onChange={e => setBankName(e.target.value)} className={cls} /></div>
        </div>
      )}
      {method === 'BankTransfer' && (
        <div><label className="block text-sm font-medium text-slate-700 mb-1.5">Reference Number</label><input value={referenceNumber} onChange={e => setReferenceNumber(e.target.value)} className={cls} /></div>
      )}
      <div><label className="block text-sm font-medium text-slate-700 mb-1.5">Notes</label><textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} className={cls + ' resize-none'} placeholder="Optional notes" /></div>
      <div className="flex gap-2 pt-2">
        <button onClick={onCancel} className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
        <button onClick={() => onSubmit({ customerId, amount: parseFloat(amount), paymentMethod: toApiPaymentMethod(method), referenceNumber: referenceNumber || undefined, chequeNumber: chequeNumber || undefined, bankName: bankName || undefined, notes: notes || undefined })}
          disabled={isPending || !customerId || !amount}
          className="flex-1 px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 transition disabled:opacity-50 flex items-center justify-center gap-2">
          {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          {isPending ? 'Recording...' : `Record ${amount ? formatCurrency(parseFloat(amount)) : 'Payment'}`}
        </button>
      </div>
    </div>
  );
}
