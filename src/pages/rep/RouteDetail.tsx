import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { repsApi } from '../../services/api/repsApi';
import { MapPin, ExternalLink } from 'lucide-react';
import { useEffect } from 'react';

export default function RepRouteDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: route } = useQuery({
    queryKey: ['rep-route', id],
    queryFn: () => id ? repsApi.repGetRoute(id).then(r => r.data.data) : Promise.resolve(null),
    enabled: !!id,
  });

  const openDirections = () => {
    if (!route || !route.customers?.length) return;
    const points = route.customers
      .map(c => c.latitude && c.longitude ? `${c.latitude},${c.longitude}` : encodeURIComponent(c.customerName || ''))
      .join('%7C');
    window.open(`https://www.google.com/maps/dir/?api=1&waypoints=${points}`, '_blank');
  };

  if (!route) return <div className="p-4">Loading...</div>;

  return (
    <>
      <div className="bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-500 px-5 pt-5 pb-6 relative z-0 overflow-hidden lg:rounded-2xl lg:pb-6">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4" />
        <h1 className="text-white text-xl font-bold">Route Details</h1>
      </div>
      <div className="px-4 space-y-4 -mt-3 pb-6 relative z-10">
      <h1 className="text-xl font-bold">{route.name}</h1>
      {route.description && <p className="text-sm text-slate-600">{route.description}</p>}
      {/* map placeholder */}
      <div className="w-full h-48 bg-slate-200 rounded-lg flex items-center justify-center mb-4">
        <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400">
          <path d="M3 9l9-6 9 6v11a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1v-5H9v5a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1z" />
        </svg>
        <span className="ml-2 text-slate-500">Map view</span>
      </div>
      <button onClick={openDirections} className="px-4 py-2 bg-emerald-500 text-white rounded-lg flex items-center gap-1 text-sm">
        <ExternalLink className="w-4 h-4" /> Navigate All
      </button>
      <div className="mt-4">
        <h2 className="font-semibold">Customers</h2>
        <ul className="mt-2 space-y-2">
          {route.customers?.map(c => (
            <li key={c.customerId} className="flex items-center justify-between">
              <span>{c.customerName || 'Customer'}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Order {c.visitOrder}</span>
                <button
                  onClick={() => {
                    const dest = c.latitude && c.longitude ? `${c.latitude},${c.longitude}` : encodeURIComponent(c.customerName || '');
                    window.open(`https://www.google.com/maps/dir/?api=1&destination=${dest}`, '_blank');
                  }}
                  className="text-emerald-600 text-xs flex items-center"
                >
                  <ExternalLink className="w-3 h-3" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
    </>
  );
}