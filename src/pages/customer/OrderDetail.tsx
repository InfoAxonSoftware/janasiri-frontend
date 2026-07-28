import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ordersApi } from '../../services/api/ordersApi';
import { Star } from 'lucide-react';
import toast from 'react-hot-toast';
import { useState, useEffect, useRef } from 'react';
import OrderDetailView from '../../components/orders/OrderDetailView';

export default function CustomerOrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [ratingVal, setRatingVal] = useState(0);
  const [ratingComment, setRatingComment] = useState('');
  const rootRef = useRef<HTMLDivElement | null>(null);

  // ensure detail is scrolled into view when opened via route (desktop / split view)
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    // smooth scroll the detail into view (works for split view and full page)
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    // on full-page view also ensure viewport is at top of content area
    if (window.innerWidth >= 1024) window.scrollTo({ top: Math.max(0, el.getBoundingClientRect().top + window.scrollY - 80), behavior: 'smooth' });
  }, [id]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['customer-order', id],
    queryFn: () => ordersApi.customerGetById(id || '').then(r => r.data.data),
    enabled: !!id,
  });

  const cancelMut = useMutation({
    mutationFn: (orderId: string) => ordersApi.customerCancel(orderId, 'Customer cancelled'),
    onSuccess: () => { toast.success('Order cancelled'); qc.invalidateQueries({ queryKey: ['customer-orders'] }); navigate('/shop/orders'); },
    onError: () => toast.error('Cancel failed'),
  });

  const reorderMut = useMutation({
    mutationFn: (orderId: string) => ordersApi.customerReorder(orderId),
    onSuccess: () => { toast.success('Reorder placed'); qc.invalidateQueries({ queryKey: ['customer-orders'] }); navigate('/shop/orders'); },
    onError: () => toast.error('Reorder failed'),
  });

  const rateMut = useMutation({
    mutationFn: ({ orderId, rating, comment }: { orderId: string; rating: number; comment?: string }) =>
      ordersApi.customerRate(orderId, { rating, comment }),
    onSuccess: () => { toast.success('Thanks for your rating'); qc.invalidateQueries({ queryKey: ['customer-orders'] }); },
    onError: () => toast.error('Rating failed'),
  });

  const handleCancelOrder = () => {
    if (order.status !== 'Pending') {
      toast.error('Only pending orders can be cancelled');
      return;
    }
    cancelMut.mutate(order.id);
  };

  if (isLoading) return (
    <div className="p-6">
      <div className="skeleton h-8 w-48 mb-4" />
      <div className="skeleton h-64" />
    </div>
  );

  if (error || !data) return (
    <div className="p-6">
      <div className="text-center text-slate-500">Unable to load order</div>
    </div>
  );

  const order = data;

  return (
    <div ref={rootRef}>
      <OrderDetailView order={order} backPath="/shop/orders" summaryTitle="Customer Order Summary">
        <div className="space-y-4 max-w-3xl">
          {order.status === 'Pending' && (
            <button
              onClick={handleCancelOrder}
              className="w-full py-3 border-2 border-red-200 text-red-600 rounded-xl text-sm font-semibold hover:bg-red-50 active:scale-[0.98] transition-all"
            >
              Cancel Order
            </button>
          )}

          {order.status === 'Delivered' && !order.rating && (
            <div className="bg-amber-50/50 rounded-xl p-4 space-y-3">
              <h3 className="font-semibold text-slate-900 text-sm">Rate this order</h3>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map(star => (
                  <button key={star} onClick={() => setRatingVal(star)} className="p-0.5">
                    <Star className={`w-7 h-7 ${star <= ratingVal ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}`} />
                  </button>
                ))}
              </div>
              <textarea value={ratingComment} onChange={(e) => setRatingComment(e.target.value)} rows={3} placeholder="How was your experience? (optional)" className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm outline-none resize-none" />
              <div className="flex gap-2">
                <button onClick={() => rateMut.mutate({ orderId: order.id, rating: ratingVal, comment: ratingComment || undefined })} disabled={ratingVal === 0 || rateMut.isPending} className="flex-1 lg:flex-none lg:w-auto py-2.5 bg-amber-500 text-white rounded-xl font-semibold disabled:opacity-40">{rateMut.isPending ? 'Submitting...' : 'Submit Rating'}</button>
                <button onClick={() => reorderMut.mutate(order.id)} disabled={reorderMut.isPending} className="hidden lg:inline-flex py-2.5 px-4 bg-white border border-slate-200 rounded-xl font-semibold">Reorder</button>
              </div>
            </div>
          )}

          {order.rating && (
            <div className="flex items-center gap-2 bg-amber-50 rounded-xl p-3">
              <span className="text-xs text-slate-500 font-medium">Your Rating:</span>
              <div className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map(star => (
                  <Star key={star} className={`w-4 h-4 ${star <= (order.rating || 0) ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}`} />
                ))}
              </div>
            </div>
          )}

          {order.status === 'Delivered' && (
            <button onClick={() => reorderMut.mutate(order.id)} disabled={reorderMut.isPending} className="w-full py-3 bg-gradient-to-r from-orange-500 to-rose-500 text-white rounded-xl text-sm font-semibold shadow-lg lg:hidden">{reorderMut.isPending ? 'Reordering...' : 'Reorder'}</button>
          )}
        </div>
      </OrderDetailView>
    </div>
  );
}
