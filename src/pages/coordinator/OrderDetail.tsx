import { useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { CheckCircle, Loader2 } from 'lucide-react';
import { ordersApi } from '../../services/api/ordersApi';
import { customersApi } from '../../services/api/customersApi';
import OrderDetailView from '../../components/orders/OrderDetailView';

export default function CoordinatorOrderDetail() {
  const { id } = useParams();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['coordinator-order', id],
    queryFn: () => ordersApi.coordinatorGetById(id || '').then(r => r.data.data),
    enabled: !!id,
  });

  const { data: customerData } = useQuery({
    queryKey: ['coordinator-order-customer-type', data?.customerId],
    queryFn: () => customersApi.coordinatorGetById(data!.customerId).then(r => r.data.data),
    enabled: !!data?.customerId,
    staleTime: 5 * 60 * 1000,
  });

  const isTaxCustomer =
    (customerData?.customerType || '').toLowerCase().replace(/[-\s]/g, '') === 'tax';

  const approveMut = useMutation({
    mutationFn: (orderId: string) => ordersApi.coordinatorApprove(orderId),
    onSuccess: () => {
      toast.success('Order approved');
      queryClient.invalidateQueries({ queryKey: ['coordinator-orders'] });
      queryClient.invalidateQueries({ queryKey: ['coordinator-order', id] });
    },
    onError: () => toast.error('Failed to approve order'),
  });

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="skeleton h-8 w-48 mb-4" />
        <div className="skeleton h-64" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6">
        <div className="text-center text-slate-500">Unable to load order</div>
      </div>
    );
  }

  return (
    <OrderDetailView order={data} backPath="/coordinator/orders" summaryTitle="Coordinator Order Summary" isTaxCustomer={isTaxCustomer}>
      {data.status === 'Pending' ? (
        <button
          onClick={() => approveMut.mutate(data.id)}
          disabled={approveMut.isPending}
          className="w-full max-w-sm py-3 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 transition disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {approveMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
          Approve Order
        </button>
      ) : (
        <div className="inline-flex px-4 py-2 rounded-xl bg-slate-100 text-slate-600 text-sm font-medium">View only</div>
      )}
    </OrderDetailView>
  );
}
