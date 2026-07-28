import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { paymentsApi } from '../../services/api/paymentsApi';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { CreditCard, CheckCircle, XCircle, Search, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import { useIsDesktop } from '../../hooks/useMediaQuery';
import DataTable, { type Column } from '../../components/common/DataTable';
import MobileTileList from '../../components/common/MobileTileList';
import BottomSheet from '../../components/common/BottomSheet';
import StatusBadge from '../../components/common/StatusBadge';
import PageHeader from '../../components/common/PageHeader';

const statuses = ['', 'Pending', 'Verified', 'Rejected', 'Bounced'] as const;

export default function AdminPayments() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedPayment, setSelectedPayment] = useState<any>(null);
  const [ledgerCustomerId, setLedgerCustomerId] = useState<string | null>(null);
  const isDesktop = useIsDesktop();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['admin-payments', page, statusFilter],
    queryFn: () => paymentsApi.adminGetAll({ page, pageSize: 20, status: statusFilter || undefined } as any).then(r => r.data.data),
  });

  const { data: ledger } = useQuery({
    queryKey: ['admin-ledger', ledgerCustomerId],
    queryFn: () => paymentsApi.adminGetCustomerLedger(ledgerCustomerId!).then(r => r.data.data),
    enabled: !!ledgerCustomerId,
  });

  const verifyMut = useMutation({
    mutationFn: (id: string) => paymentsApi.adminVerify(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-payments'] }); setSelectedPayment(null); toast.success('Payment verified'); },
  });

  const payments = data?.items || [];

  const handleRowClick = (p: any) => {
    setSelectedPayment(p);
  };

  const columns: Column<any>[] = [
    { key: 'id', header: 'Reference', render: (p) => <span className="font-semibold text-slate-900">{p.referenceNumber || p.id?.substring(0, 8)}</span> },
    { key: 'customer', header: 'Customer', render: (p) => <span className="text-slate-700">{p.customerName || '—'}</span> },
    { key: 'order', header: 'Order #', render: (p) => <span className="text-slate-500">{p.orderNumber || '—'}</span> },
    { key: 'method', header: 'Method', render: (p) => <span className="text-slate-600">{p.paymentMethod}</span> },
    { key: 'amount', header: 'Amount', align: 'right', render: (p) => <span className="font-bold text-slate-900">{formatCurrency(p.amount)}</span> },
    { key: 'date', header: 'Date', render: (p) => <span className="text-slate-500 text-xs">{formatDate(p.paymentDate)}</span> },
    { key: 'status', header: 'Status', align: 'center', render: (p) => <StatusBadge status={p.status} /> },
    { key: 'actions', header: 'Actions', align: 'center', render: (p) => (
      <div className="flex items-center justify-center gap-1.5">
        {p.status === 'Pending' && (
          <button onClick={(e) => { e.stopPropagation(); verifyMut.mutate(p.id); }} className="p-1.5 rounded-lg hover:bg-emerald-50 text-emerald-600 transition" title="Verify"><CheckCircle className="w-4 h-4" /></button>
        )}
        {p.customerId && (
          <button onClick={(e) => { e.stopPropagation(); setLedgerCustomerId(p.customerId); }} className="p-1.5 rounded-lg hover:bg-indigo-50 text-indigo-500 transition" title="Ledger"><FileText className="w-4 h-4" /></button>
        )}
      </div>
    )},
  ];

  return (
    <div className="animate-fade-in space-y-4 lg:space-y-6">
      <PageHeader title="Payments" subtitle="Verify and manage payments" />

      {/* Status Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
        {statuses.map(s => (
          <button key={s || 'all'} onClick={() => { setStatusFilter(s); setPage(1); }} className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition ${statusFilter === s ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
            {s || 'All'}
          </button>
        ))}
      </div>

      {/* Desktop: Table | Mobile: Tiles */}
      {isDesktop ? (
        <DataTable columns={columns} data={payments} keyExtractor={p => p.id} onRowClick={handleRowClick} isLoading={isLoading} emptyMessage="No payments found" emptyIcon={<CreditCard className="w-10 h-10" />} page={data?.page} totalPages={data?.totalPages} totalCount={data?.totalCount} onPageChange={setPage} />
      ) : (
        <MobileTileList data={payments} keyExtractor={p => p.id} onTileClick={handleRowClick} isLoading={isLoading} emptyMessage="No payments found" emptyIcon={<CreditCard className="w-10 h-10" />} page={data?.page} totalPages={data?.totalPages} onPageChange={setPage}
          renderTile={(p: any) => (
            <div className="p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900 truncate">{p.referenceNumber || p.id?.substring(0, 8)}</p>
                  <p className="text-sm text-slate-500 truncate">{p.customerName || '—'}</p>
                </div>
                <StatusBadge status={p.status} />
              </div>
              <div className="flex items-center gap-4 text-xs text-slate-400 mb-3">
                <span>{p.paymentMethod}</span>
                <span>{formatDate(p.paymentDate)}</span>
                {p.orderNumber && <span>Order: {p.orderNumber}</span>}
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-slate-50">
                <p className="font-bold text-slate-900 text-lg">{formatCurrency(p.amount)}</p>
                {p.status === 'Pending' && (
                  <button onClick={(e) => { e.stopPropagation(); verifyMut.mutate(p.id); }} className="px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-50 text-emerald-700 active:scale-95">Verify</button>
                )}
              </div>
            </div>
          )}
        />
      )}

      {/* Payment Detail */}
      {selectedPayment && (
        <BottomSheet open={true} onClose={() => setSelectedPayment(null)} title="Payment Details">
          <div className="p-5 space-y-4">
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Reference</span><span className="font-medium">{selectedPayment.referenceNumber || '—'}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Customer</span><span className="font-medium">{selectedPayment.customerName || '—'}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Order</span><span>{selectedPayment.orderNumber || '—'}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Method</span><span>{selectedPayment.paymentMethod}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Date</span><span>{formatDate(selectedPayment.paymentDate)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Amount</span><span className="font-bold text-lg">{formatCurrency(selectedPayment.amount)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Status</span><StatusBadge status={selectedPayment.status} /></div>
              {selectedPayment.chequeNumber && <div className="flex justify-between"><span className="text-slate-500">Cheque #</span><span>{selectedPayment.chequeNumber}</span></div>}
              {selectedPayment.bankName && <div className="flex justify-between"><span className="text-slate-500">Bank</span><span>{selectedPayment.bankName}</span></div>}
              {selectedPayment.notes && <div className="flex justify-between"><span className="text-slate-500">Notes</span><span>{selectedPayment.notes}</span></div>}
            </div>
            {selectedPayment.status === 'Pending' && (
              <button onClick={() => verifyMut.mutate(selectedPayment.id)} className="w-full py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-medium">Verify Payment</button>
            )}
          </div>
        </BottomSheet>
      )}

      {/* Customer Ledger */}
      {ledgerCustomerId && (
        <BottomSheet open={true} onClose={() => setLedgerCustomerId(null)} title="Customer Ledger" maxHeight="85vh">
          <div className="p-5">
            {ledger ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="bg-red-50 rounded-xl p-3"><p className="text-xs text-red-500">Outstanding</p><p className="font-bold text-red-700">{formatCurrency(ledger.totalOutstanding || 0)}</p></div>
                  <div className="bg-emerald-50 rounded-xl p-3"><p className="text-xs text-emerald-500">Paid</p><p className="font-bold text-emerald-700">{formatCurrency(ledger.totalPaid || 0)}</p></div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead><tr className="bg-slate-50"><th className="px-3 py-2 text-left">Date</th><th className="px-3 py-2 text-left">Type</th><th className="px-3 py-2 text-right">Debit</th><th className="px-3 py-2 text-right">Credit</th><th className="px-3 py-2 text-right">Balance</th></tr></thead>
                    <tbody>{(ledger.entries || []).map((e: any, i: number) => (
                      <tr key={i} className="border-t border-slate-50">
                        <td className="px-3 py-2">{formatDate(e.date)}</td>
                        <td className="px-3 py-2">{e.type}</td>
                        <td className="px-3 py-2 text-right text-red-600">{e.debit ? formatCurrency(e.debit) : ''}</td>
                        <td className="px-3 py-2 text-right text-emerald-600">{e.credit ? formatCurrency(e.credit) : ''}</td>
                        <td className="px-3 py-2 text-right font-medium">{formatCurrency(e.balance)}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-slate-400 text-sm">Loading ledger...</div>
            )}
          </div>
        </BottomSheet>
      )}
    </div>
  );
}
