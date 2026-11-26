import { parseGuestQuickOrderDetails } from '../../utils/guestQuickOrderDetails';
export { parseGuestQuickOrderDetails };

function DetailValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg bg-slate-50 px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-slate-800">{value || '—'}</p>
    </div>
  );
}

export default function GuestQuickOrderDetails({ request }: { request: any }) {
  if (request?.createdBy !== 'Quick Order Portal') {
    return (
      <pre className="whitespace-pre-wrap rounded-xl border border-slate-100 bg-white p-3 font-sans text-sm text-slate-800">
        {request?.details || 'No additional details provided.'}
      </pre>
    );
  }

  const parsed = parseGuestQuickOrderDetails(request.details || '');

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <DetailValue label="Business name" value={request.customerName || ''} />
        <DetailValue label="Contact person" value={parsed.contactPerson} />
        <DetailValue label="Contact number" value={parsed.contactNumber} />
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-slate-800">Requested items</p>
            <p className="mt-0.5 text-xs text-slate-500">
              {parsed.items.length} {parsed.items.length === 1 ? 'item' : 'items'} submitted
            </p>
          </div>
          <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
            Guest order
          </span>
        </div>

        {parsed.items.length > 0 ? (
          <div className="w-full">
            <table className="w-full table-fixed text-left text-xs sm:text-sm">
              <colgroup>
                <col className="w-[8%]" />
                <col className="w-[39%]" />
                <col className="w-[15%]" />
                <col className="w-[24%]" />
                <col className="w-[14%]" />
              </colgroup>
              <thead className="bg-slate-50 text-[9px] font-semibold uppercase tracking-[0.06em] text-slate-500 sm:text-[10px]">
                <tr>
                  <th className="px-2 py-3 sm:px-3">S/N</th>
                  <th className="px-2 py-3 sm:px-3">Item description</th>
                  <th className="px-2 py-3 sm:px-3">Size</th>
                  <th className="px-2 py-3 sm:px-3">Brand</th>
                  <th className="px-2 py-3 text-right sm:px-3">Qty</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {parsed.items.map((item, index) => (
                  <tr key={String(index) + item.description} className="text-slate-700">
                    <td className="px-2 py-3 text-[11px] tabular-nums text-slate-400 sm:px-3">{index + 1}</td>
                    <td className="break-words px-2 py-3 font-medium text-slate-800 sm:px-3">{item.description}</td>
                    <td className="break-words px-2 py-3 sm:px-3">{item.size || '—'}</td>
                    <td className="break-words px-2 py-3 sm:px-3">{item.brand || '—'}</td>
                    <td className="px-2 py-3 text-right font-semibold tabular-nums sm:px-3">{item.quantity.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="px-4 py-5 text-sm text-slate-500">Item details are not available in the saved request.</p>
        )}
      </div>
    </div>
  );
}
