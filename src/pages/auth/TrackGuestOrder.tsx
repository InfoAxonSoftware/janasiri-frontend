import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Download,
  FileText,
  PackageCheck,
  PackageSearch,
  Search,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import {
  quickRequestApi,
  type GuestQuickOrderTrackingDto,
} from '../../services/api/quickRequestApi';
import { formatDateTime } from '../../utils/formatters';

const inputClass =
  'h-12 w-full min-w-0 rounded-xl border border-[#e2dfd6] bg-[#fffdfa] px-4 text-[14px] font-medium text-[#252a24] outline-none transition placeholder:font-normal placeholder:text-[#92978c] focus:border-[#bd674d] focus:bg-white focus:ring-4 focus:ring-[#bd674d]/[0.09]';

const statusStyles: Record<string, string> = {
  Pending: 'border-amber-200 bg-amber-50 text-amber-800',
  Approved: 'border-blue-200 bg-blue-50 text-blue-800',
  Rejected: 'border-red-200 bg-red-50 text-red-700',
  Completed: 'border-emerald-200 bg-emerald-50 text-emerald-800',
};

function formatAttachmentSize(bytes: number) {
  if (!bytes || bytes < 1) return 'File size unavailable';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function StatusProgress({ status }: { status: string }) {
  const steps = [
    { label: 'Received', detail: 'Your request has reached Janasiri.', icon: PackageSearch },
    { label: 'Approved', detail: 'The team has reviewed your request.', icon: CheckCircle2 },
    { label: 'Completed', detail: 'Your order request has been completed.', icon: PackageCheck },
  ];
  const currentIndex =
    status === 'Pending' ? 0 : status === 'Approved' ? 1 : status === 'Completed' ? 2 : -1;

  if (status === 'Rejected') {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-red-100 bg-red-50 p-4">
        <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
        <div>
          <p className="text-sm font-semibold text-red-800">This request was declined</p>
          <p className="mt-1 text-sm leading-6 text-red-700">
            Please contact Janasiri if you need more information about this request.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {steps.map((step, index) => {
        const Icon = step.icon;
        const complete = index <= currentIndex;
        const active = index === currentIndex;

        return (
          <div key={step.label} className="rounded-xl border border-[#e9e6dd] bg-white p-4">
            <div className="flex items-center gap-2.5">
              <span
                className={
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-full ' +
                  (complete ? 'bg-[#e8eee3] text-[#5f7252]' : 'bg-[#f3f1eb] text-[#a2a69b]')
                }
              >
                {complete && index < currentIndex ? <Check size={17} /> : <Icon size={17} />}
              </span>
              <div className="min-w-0">
                <p className={'text-sm font-semibold ' + (complete ? 'text-[#30382d]' : 'text-[#969b90]')}>
                  {step.label}
                </p>
                <p className="mt-0.5 text-[11px] text-[#858b80]">
                  {active ? 'Current status' : complete ? 'Completed' : 'Waiting'}
                </p>
              </div>
            </div>
            <p className="mt-3 text-xs leading-5 text-[#777e72]">{step.detail}</p>
          </div>
        );
      })}
    </div>
  );
}

export default function TrackGuestOrder() {
  const [requestNumber, setRequestNumber] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [result, setResult] = useState<GuestQuickOrderTrackingDto | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const handleTrack = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!requestNumber.trim() || !phoneNumber.trim() || isLoading) return;

    setIsLoading(true);
    setResult(null);

    try {
      const response = await quickRequestApi.trackGuestOrder({
        requestNumber: requestNumber.trim().toUpperCase(),
        phoneNumber: phoneNumber.trim(),
      });
      setResult(response.data.data);
    } catch (error: any) {
      if (error?.response?.status === 429) {
        toast.error('Too many attempts. Please wait a few minutes and try again.');
      } else {
        toast.error('We could not find an order matching those details. Please check and try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const downloadAttachment = async (
    attachment: GuestQuickOrderTrackingDto['attachments'][number],
  ) => {
    if (!result || downloadingId) return;

    setDownloadingId(attachment.id);
    try {
      const response = await quickRequestApi.downloadGuestAttachment(
        result.requestNumber,
        attachment.id,
        phoneNumber.trim(),
      );
      const blobUrl = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = attachment.originalFileName || 'guest-order-attachment';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    } catch {
      toast.error('This attachment could not be downloaded. Please track your order again.');
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <main className="min-h-screen overflow-x-clip bg-[#f7f5f0] text-[#242923]">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_84%_5%,rgba(193,91,62,0.055),transparent_25%),radial-gradient(circle_at_8%_88%,rgba(105,120,88,0.06),transparent_30%)]" />

      <header className="relative z-10 border-b border-[#e8e4db] bg-[#f7f5f0]/90 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-[1180px] flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 py-3.5 sm:px-6 lg:px-8">
          <Link
            to="/quick-order"
            className="flex shrink-0 items-center gap-2 sm:gap-3 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-[#bd674d]"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#f5f1e8] p-1 shadow-sm">
              <img src="/logo.png" alt="Janasiri Distributors" className="h-full w-full object-contain" />
            </span>
            <span className="min-w-0">
              <span className="block whitespace-nowrap text-[13px] font-bold leading-tight tracking-[-0.025em] text-[#252b24] min-[375px]:text-[15px] sm:text-[16px]">Janasiri Distributors (Pvt) Ltd</span>
            </span>
          </Link>

          <Link
            to="/quick-order"
            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border border-[#e4e3dc] bg-white/75 px-3 text-[13px] font-semibold text-[#62695e] transition hover:border-[#d3c9bb] hover:bg-white hover:text-[#b9573d] sm:px-4"
          >
            <ArrowLeft size={14} />
            <span>Quick order</span>
          </Link>
        </div>
      </header>

      <div className="relative z-0 mx-auto w-full max-w-[1180px] px-3 pb-14 pt-5 sm:px-6 sm:pt-7 lg:px-8 lg:pb-20">
        <div className="mb-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#9a735f]">
            Janasiri order support
          </p>
          <h1 className="mt-1 text-[26px] font-bold tracking-[-0.04em] text-[#252b24] sm:text-[32px]">
            Track your order
          </h1>
          <p className="mt-1 text-sm leading-6 text-[#777e72]">
            Enter your order reference and contact number to view the latest order details.
          </p>
        </div>

        <section className="rounded-2xl border border-[#e8e4db] bg-white p-4 shadow-[0_8px_28px_rgba(37,42,36,0.045)] sm:p-5">
          <form
            onSubmit={handleTrack}
            className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_170px] md:items-end"
          >
            <div className="min-w-0">
              <label
                htmlFor="tracking-reference"
                className="mb-2 block text-[12px] font-semibold text-[#3d4639]"
              >
                Order reference
              </label>
              <input
                id="tracking-reference"
                name="requestNumber"
                value={requestNumber}
                onChange={(event) => setRequestNumber(event.target.value.toUpperCase())}
                placeholder="e.g. QO-AB12CD34"
                autoComplete="off"
                required
                className={inputClass}
              />
            </div>

            <div className="min-w-0">
              <label
                htmlFor="tracking-phone"
                className="mb-2 block text-[12px] font-semibold text-[#3d4639]"
              >
                Contact number
              </label>
              <input
                id="tracking-phone"
                name="phoneNumber"
                value={phoneNumber}
                onChange={(event) => setPhoneNumber(event.target.value)}
                placeholder="Enter your order contact number"
                type="tel"
                autoComplete="tel"
                required
                className={inputClass}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || !requestNumber.trim() || !phoneNumber.trim()}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#222a23] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#354236] disabled:cursor-not-allowed disabled:opacity-55"
            >
              {isLoading ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/35 border-t-white" />
              ) : (
                <Search size={16} />
              )}
              {isLoading ? 'Checking…' : 'Track order'}
            </button>
          </form>

          <p className="mt-3 flex items-center gap-2 text-[11px] leading-5 text-[#858b80]">
            <ShieldCheck size={14} className="shrink-0 text-[#7b8b6e]" />
            Your order details and attachments are shown only when both details match.
          </p>
        </section>

        <section className="mt-5">
          {!result ? (
            <div className="flex min-h-[190px] flex-col items-center justify-center rounded-2xl border border-dashed border-[#ddd9ce] bg-white/65 px-6 py-8 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#edf1e9] text-[#647454]">
                <PackageSearch size={22} strokeWidth={1.7} />
              </span>
              <h2 className="mt-3 text-sm font-bold text-[#30382d]">Your order details will appear here</h2>
              <p className="mt-1 max-w-md text-xs leading-5 text-[#858b80]">
                Enter the reference number and contact number used when submitting your order, then select Track order.
              </p>
            </div>
          ) : (
            <motion.div
              key={result.requestNumber}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <div className="rounded-2xl border border-[#e8e4db] bg-white p-5 shadow-[0_8px_28px_rgba(37,42,36,0.035)] sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#858b80]">
                      Order reference
                    </p>
                    <h2 className="mt-1 break-all text-xl font-bold tracking-[-0.03em] text-[#252b24]">
                      {result.requestNumber}
                    </h2>
                    <p className="mt-1 text-xs text-[#858b80]">{formatDateTime(result.createdAt)}</p>
                  </div>
                  <span
                    className={
                      'inline-flex shrink-0 items-center rounded-full border px-3 py-1.5 text-xs font-semibold ' +
                      (statusStyles[result.status] || statusStyles.Pending)
                    }
                  >
                    {result.status}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="rounded-xl bg-[#f7f6f1] p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#8b9186]">
                      Business name
                    </p>
                    <p className="mt-1 break-words text-sm font-semibold text-[#30382d]">
                      {result.businessName}
                    </p>
                  </div>
                  <div className="rounded-xl bg-[#f7f6f1] p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#8b9186]">
                      Contact person
                    </p>
                    <p className="mt-1 break-words text-sm font-semibold text-[#30382d]">
                      {result.contactPerson || '—'}
                    </p>
                  </div>
                  <div className="rounded-xl bg-[#f7f6f1] p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#8b9186]">
                      Contact number
                    </p>
                    <p className="mt-1 text-sm font-semibold text-[#30382d]">
                      {result.contactNumberMasked}
                    </p>
                  </div>
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl border border-[#e8e4db] bg-white shadow-[0_8px_28px_rgba(37,42,36,0.035)]">
                <div className="border-b border-[#eeece5] px-4 py-4 sm:px-6">
                  <h3 className="text-sm font-bold text-[#30382d]">Requested items</h3>
                  <p className="mt-1 text-xs text-[#858b80]">
                    {result.items.length} {result.items.length === 1 ? 'item' : 'items'}
                  </p>
                </div>

                {result.items.length > 0 ? (
                  <table className="w-full table-fixed text-left text-xs sm:text-sm">
                    <colgroup>
                      <col className="w-[38%]" />
                      <col className="w-[17%]" />
                      <col className="w-[29%]" />
                      <col className="w-[16%]" />
                    </colgroup>
                    <thead className="bg-[#f8f7f2] text-[9px] font-semibold uppercase tracking-[0.06em] text-[#858b80] sm:text-[10px]">
                      <tr>
                        <th className="px-2 py-3 sm:px-4">Item</th>
                        <th className="px-2 py-3 sm:px-3">Size</th>
                        <th className="px-2 py-3 sm:px-3">Brand</th>
                        <th className="px-2 py-3 text-right sm:px-4">Qty</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f0eee7]">
                      {result.items.map((item, index) => (
                        <tr key={String(index) + item.description} className="text-[#697164]">
                          <td className="break-words px-2 py-3 font-medium text-[#30382d] sm:px-4">
                            {item.description}
                          </td>
                          <td className="break-words px-2 py-3 sm:px-3">{item.size || '—'}</td>
                          <td className="break-words px-2 py-3 sm:px-3">{item.brand || '—'}</td>
                          <td className="px-2 py-3 text-right font-semibold tabular-nums text-[#30382d] sm:px-4">
                            {item.quantity.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="px-5 py-5 text-sm text-[#858b80]">No item details are available.</p>
                )}
              </div>

              <div className="rounded-2xl border border-[#e8e4db] bg-white p-5 shadow-[0_8px_28px_rgba(37,42,36,0.035)] sm:p-6">
                <h3 className="mb-4 text-sm font-bold text-[#30382d]">Order progress</h3>
                <StatusProgress status={result.status} />
              </div>

              <div className="rounded-2xl border border-[#e8e4db] bg-white p-5 shadow-[0_8px_28px_rgba(37,42,36,0.035)] sm:p-6">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-[#30382d]">Attachments</h3>
                    <p className="mt-1 text-xs text-[#858b80]">
                      {result.attachments.length} {result.attachments.length === 1 ? 'file' : 'files'}
                    </p>
                  </div>
                  <FileText size={19} className="text-[#8b927f]" />
                </div>

                {result.attachments.length > 0 ? (
                  <div className="space-y-2">
                    {result.attachments.map((attachment) => (
                      <div
                        key={attachment.id}
                        className="flex min-w-0 items-center gap-3 rounded-xl border border-[#eeece5] bg-[#fffdfa] px-3 py-3"
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#f3eee8] text-[#a75b43]">
                          <FileText size={17} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-[#3a4236]">
                            {attachment.originalFileName}
                          </p>
                          <p className="mt-0.5 text-[11px] text-[#8a9085]">
                            {attachment.contentType.includes('pdf') ? 'PDF document' : 'Image'}
                            {attachment.sizeBytes ? ' · ' + formatAttachmentSize(attachment.sizeBytes) : ''}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => downloadAttachment(attachment)}
                          disabled={!!downloadingId}
                          aria-label={'Download ' + attachment.originalFileName}
                          className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-[#e4e3dc] bg-white px-3 text-xs font-semibold text-[#5b6652] transition hover:border-[#cfcbbf] hover:bg-[#f8f7f2] disabled:opacity-50"
                        >
                          <Download size={14} />
                          <span className="hidden sm:inline">
                            {downloadingId === attachment.id ? 'Loading' : 'Download'}
                          </span>
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-[#858b80]">No attachments were added to this order.</p>
                )}
              </div>

              <button
                type="button"
                onClick={() => setResult(null)}
                className="inline-flex h-10 items-center gap-2 rounded-xl px-2 text-sm font-semibold text-[#68735f] transition hover:text-[#b9573d]"
              >
                <Search size={15} />
                Track another order
              </button>
            </motion.div>
          )}
        </section>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-[#8b9085]">
          <Link to="/quick-order" className="transition hover:text-[#b9573d]">
            Place a quick order
          </Link>
          <span>·</span>
          <Link to="/login" className="transition hover:text-[#b9573d]">
            Sign in
          </Link>
        </div>
      </div>
    </main>
  );
}
