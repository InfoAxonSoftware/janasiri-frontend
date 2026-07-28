import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { repsApi } from '../../services/api/repsApi';
import { formatDateTime } from '../../utils/formatters';
import { MapPin, ExternalLink, PlayCircle, FilePlus, CheckCircle, XCircle } from 'lucide-react';
import { useState } from 'react';
import ConfirmModal from '../../components/common/ConfirmModal';

export default function RepVisitDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [checkedIn, setCheckedIn] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const cancelMut = useMutation({
    mutationFn: (visitId: string) => repsApi.repCancelVisit(visitId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rep-visit', id] });
      queryClient.invalidateQueries({ queryKey: ['rep-today-visits'] });
      navigate('/rep/routes');
    },
  });

  const { data: visit } = useQuery({
    queryKey: ['rep-visit', id],
    queryFn: () => id ? repsApi.repGetVisit(id).then(r => r.data.data) : Promise.resolve(null),
    enabled: !!id,
  });

  const checkInMut = useMutation({
    mutationFn: (data: { customerId: string }) => repsApi.repCheckIn(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rep-visit', id] });
      queryClient.invalidateQueries({ queryKey: ['rep-today-visits'] });
      setCheckedIn(true);
    },
  });

  const checkOutMut = useMutation({
    mutationFn: ({ visitId, data }: { visitId: string; data: Record<string, unknown> }) =>
      repsApi.repCheckOut(visitId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rep-visit', id] });
      queryClient.invalidateQueries({ queryKey: ['rep-today-visits'] });
    },
  });

  const handleNavigate = () => {
    if (!visit) return;
    if (visit.latitude && visit.longitude) {
      window.open(`https://www.google.com/maps/search/?api=1&query=${visit.latitude},${visit.longitude}`, '_blank');
    } else {
      window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(visit.customerName || '')}`, '_blank');
    }
  };

  const handleAddOrder = () => {
    import('../../utils/orderDraft').then(mod => {
      mod.orderDraftUtils.setCustomer(visit!.customerId, visit!.customerName || '');
      navigate('/rep/orders/new');
    });
  };

  if (!visit) return <div className="p-4">Loading...</div>;

  return (
    <>
      <div className="bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-500 px-5 pt-5 pb-6 relative z-0 overflow-hidden lg:rounded-2xl lg:pb-6">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4" />
        <h1 className="text-white text-xl font-bold">Visit Details</h1>
      </div>
      <div className="px-4 space-y-4 -mt-3 pb-6 relative z-10">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{visit.customerName || 'Customer'}</h2>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
            visit.status === 'Cancelled' ? 'bg-red-100 text-red-700' :
            visit.status === 'CheckedIn' ? 'bg-amber-100 text-amber-700' :
            visit.status === 'Completed' ? 'bg-emerald-100 text-emerald-700' :
            'bg-slate-100 text-slate-700'
          }`}>{visit.status}</span>
        </div>
        <p className="text-sm text-slate-500">
          Planned: {visit.plannedDate ? formatDateTime(visit.plannedDate) : ''}
        </p>
        {/* contact / address card */}
        {(visit.phoneNumber || visit.street) && (
          <div className="bg-white shadow rounded-lg p-3 text-sm space-y-1">
            {visit.phoneNumber && <p className="flex items-center gap-1"><svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2 3h5l2 7-2 2v5l6-2 2 2h5" /></svg> {visit.phoneNumber}</p>}
            {visit.street && <p className="flex items-center gap-1"><svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v8a2 2 0 01-2 2h-2" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10v12H7V8z" /></svg> {visit.street}{visit.city ? `, ${visit.city}` : ''}</p>}
            {(visit.state || visit.postalCode) && <p>{visit.state}{visit.postalCode ? ` ${visit.postalCode}` : ''}</p>}
            {visit.country && <p>{visit.country}</p>}
          </div>
        )}
        {/* action buttons (stack on mobile) */}
        <div className="flex flex-col sm:flex-row gap-2">
          {/* only navigate after check-in has occurred */}
          {(visit.status === 'CheckedIn' || checkedIn) && (
            <button onClick={handleNavigate} className="w-full sm:w-auto px-4 py-3 bg-white border rounded-lg flex items-center justify-center gap-1 text-sm">
              <ExternalLink className="w-5 h-5" /> Navigate
            </button>
          )}
          {visit.status === 'Planned' && !checkedIn && (
            <button
              onClick={() => checkInMut.mutate({ customerId: visit.customerId })}
              disabled={checkedIn}
              className={`w-full sm:w-auto px-4 py-3 rounded-lg flex items-center justify-center gap-1 text-sm ${checkedIn ? 'bg-emerald-300 text-white cursor-not-allowed' : 'bg-emerald-500 text-white'}`}
            >
              <PlayCircle className="w-5 h-5" /> Start
            </button>
          )}
          {/* add order only when checked in */}
          {(visit.status === 'CheckedIn' || checkedIn) && (
            <button
              onClick={handleAddOrder}
              className="w-full sm:w-auto px-4 py-3 bg-teal-500 text-white rounded-lg flex items-center justify-center gap-1 text-sm"
            >
              <FilePlus className="w-5 h-5" /> Add Order
            </button>
          )}
          {visit.status === 'CheckedIn' && (
            <button
              onClick={() => checkOutMut.mutate({ visitId: visit.id, data: { notes: visit.notes || '', outcomeReason: '' } })}
              className="w-full sm:w-auto px-4 py-3 bg-emerald-600 text-white rounded-lg flex items-center justify-center gap-1 text-sm"
            >
              <CheckCircle className="w-5 h-5" /> Complete
            </button>
          )}
          {(visit.status === 'Planned' || visit.status === 'CheckedIn') && (
            <button
              onClick={() => setConfirmCancel(true)}
              className="w-full sm:w-auto px-4 py-3 bg-red-500 text-white rounded-lg flex items-center justify-center gap-1 text-sm"
            >
              <XCircle className="w-5 h-5" /> Cancel
            </button>
          )}
        </div>
        <div className="text-sm text-slate-400">Notes: {visit.notes || ''}</div>
        {confirmCancel && (
          <ConfirmModal
            open={true}
            title="Cancel visit?"
            description={`Are you sure you want to cancel this visit to ${visit.customerName || 'customer'}?`}
            confirmLabel="Cancel"
            confirmVariant="orange"
            onConfirm={() => {
              cancelMut.mutate(visit.id);
              setConfirmCancel(false);
            }}
            onCancel={() => setConfirmCancel(false)}
          />
        )}
      </div>
    </>
  );
}
