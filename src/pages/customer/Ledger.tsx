import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { customersApi } from '../../services/api/customersApi';
import { paymentsApi } from '../../services/api/paymentsApi';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { useIsDesktop } from '../../hooks/useMediaQuery';
import PageHeader from '../../components/common/PageHeader';
import DataTable, { type Column } from '../../components/common/DataTable';
import MobileTileList from '../../components/common/MobileTileList';
import StatusBadge from '../../components/common/StatusBadge';
import EmptyState from '../../components/common/EmptyState';
import BottomSheet from '../../components/common/BottomSheet';
import { Wallet, CreditCard, ShoppingBag, DollarSign, TrendingUp } from 'lucide-react';

export default function CustomerLedger() {
  const desktop = useIsDesktop();
  const [page, setPage] = useState(1);
  const [selectedPayment, setSelectedPayment] = useState<any>(null);

  const { data: ledger, isLoading: ledgerLoading } = useQuery({
    queryKey: ['customer-ledger'],
    queryFn: () => customersApi.customerGetLedger().then((r) => r.data.data),
  });

  const { data: payments, isLoading: paymentsLoading } = useQuery({
    queryKey: ['customer-payments', page],
    queryFn: () => paymentsApi.customerGetHistory({ page, pageSize: 20 }).then((r) => r.data.data),
  });

  const isLoading = ledgerLoading || paymentsLoading;
  const paymentItems = payments?.items || [];
  const totalPages = payments?.totalPages || (payments ? Math.ceil((payments as any).totalCount / 20) : 0);

  const handleRowClick = (payment: any) => {
    if (!desktop) setSelectedPayment(payment);
  };

  /* ─── Desktop Columns ─── */
  const columns: Column<any>[] = [
    {
      key: 'paymentMethod',
      header: 'Method',
      render: (p) => <span className="font-medium text-slate-900">{p.paymentMethod || 'Payment'}</span>,
    },
    {
      key: 'createdAt',
      header: 'Date',
      render: (p) => <span className="text-slate-500">{formatDate(p.createdAt)}</span>,
    },
    {
      key: 'referenceNumber',
      header: 'Reference',
      render: (p) => <span className="text-slate-500">{p.referenceNumber || '—'}</span>,
    },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      render: (p) => <span className="font-semibold text-slate-900">{formatCurrency(p.amount)}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (p) => <StatusBadge status={p.status} />,
    },
  ];

  return (
    <div className="animate-fade-in">
      {/* Hero Balance */}
      <div className="relative bg-orange-600 text-white px-5 pt-6 pb-14 overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/4 blur-2xl" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-orange-400/20 rounded-full translate-y-1/2 -translate-x-1/3 blur-xl" />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-3">
            <Wallet className="w-5 h-5 text-orange-100" />
            <span className="text-sm text-orange-100 font-medium">Current Balance</span>
          </div>
          <p className="text-3xl font-bold tracking-tight">{formatCurrency(ledger?.totalOutstanding || 0)}</p>
          <div className="flex items-center gap-1.5 mt-2">
            <TrendingUp className="w-3.5 h-3.5 text-orange-100" />
            <span className="text-xs text-orange-100">Updated in real-time</span>
          </div>
        </div>
      </div>

      <div className="px-4 lg:px-6 -mt-5 relative z-10 pb-6 space-y-4">
        {/* Summary Stats */}
        {ledger && (
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
              <div className="flex items-center gap-2 mb-2">
                <ShoppingBag className="w-4 h-4 text-orange-500" />
                <span className="text-xs text-slate-400 font-medium">Outstanding</span>
              </div>
              <p className="text-xl font-bold text-slate-900">{formatCurrency(ledger.totalOutstanding)}</p>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-4 h-4 text-emerald-500" />
                <span className="text-xs text-slate-400 font-medium">Total Paid</span>
              </div>
              <p className="text-xl font-bold text-slate-900">{formatCurrency(ledger.totalPaid)}</p>
            </div>
          </div>
        )}

        {/* Payment History */}
        <div>
          <h2 className="font-bold text-slate-900 mb-3">Payment History</h2>
          {desktop ? (
            <DataTable
              data={paymentItems}
              columns={columns}
              keyField="id"
              isLoading={isLoading}
              page={page}
              totalPages={totalPages}
              onPageChange={setPage}
              onRowClick={handleRowClick}
              emptyState={<EmptyState icon={CreditCard} title="No payment records" description="Your payment history will appear here" />}
            />
          ) : (
            <MobileTileList
              data={paymentItems}
              keyField="id"
              isLoading={isLoading}
              page={page}
              totalPages={totalPages}
              onPageChange={setPage}
              onTileClick={handleRowClick}
              emptyState={<EmptyState icon={CreditCard} title="No payment records" description="Your payment history will appear here" />}
              renderTile={(payment) => (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        payment.status === 'Verified' ? 'bg-emerald-50' : 'bg-orange-50'
                      }`}
                    >
                      <CreditCard className={`w-5 h-5 ${payment.status === 'Verified' ? 'text-emerald-600' : 'text-orange-600'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900">{payment.paymentMethod || 'Payment'}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{formatDate(payment.createdAt)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-slate-900">{formatCurrency(payment.amount)}</p>
                      <StatusBadge status={payment.status} />
                    </div>
                  </div>
                </div>
              )}
            />
          )}
        </div>
      </div>

      {/* Mobile Bottom Sheet — Payment Detail */}
      <BottomSheet open={!!selectedPayment && !desktop} onClose={() => setSelectedPayment(null)} title="Payment Detail">
        {selectedPayment && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Method</p>
                <p className="text-sm font-semibold text-slate-900 mt-0.5">{selectedPayment.paymentMethod || 'Payment'}</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Status</p>
                <div className="mt-1">
                  <StatusBadge status={selectedPayment.status} />
                </div>
              </div>
              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Date</p>
                <p className="text-sm font-semibold text-slate-900 mt-0.5">{formatDate(selectedPayment.createdAt)}</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Reference</p>
                <p className="text-sm font-semibold text-slate-900 mt-0.5">{selectedPayment.referenceNumber || '—'}</p>
              </div>
            </div>

            <div className="bg-orange-50 rounded-xl p-4 flex justify-between items-center">
              <span className="font-bold text-slate-900">Amount</span>
              <span className="text-lg font-bold text-orange-600">{formatCurrency(selectedPayment.amount)}</span>
            </div>

            {selectedPayment.notes && (
              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-xs text-slate-400 font-medium mb-1">Notes</p>
                <p className="text-sm text-slate-700">{selectedPayment.notes}</p>
              </div>
            )}
          </div>
        )}
      </BottomSheet>
    </div>
  );
}
