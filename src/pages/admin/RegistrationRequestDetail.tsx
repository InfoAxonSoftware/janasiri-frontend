import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customerRegistrationApi, type RegistrationRequest } from '../../services/api/customerRegistrationApi';
import { regionsApi } from '../../services/api/regionsApi';
import { adminGetAllCoordinators } from '../../services/api/coordinatorApi';
import { formatDate } from '../../utils/formatters';
import {
  ArrowLeft, FileText, User, Phone, Mail, MapPin, Building2,
  Calendar, CheckCircle, XCircle, Clock, UserCheck,
  Download, ExternalLink,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { openPrivateFile } from '../../utils/fileAccess';

// ── Shared small components ───────────────────────────────────────────────────
function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex justify-between items-start gap-4 py-2.5 border-b border-slate-100 last:border-0">
      <span className="text-xs text-slate-400 uppercase tracking-wider flex-shrink-0 w-36">{label}</span>
      <span className="text-sm text-slate-800 text-right break-words min-w-0 font-medium">{value}</span>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-slate-100 bg-slate-50/60">
        <span className="text-slate-500">{icon}</span>
        <h3 className="font-semibold text-slate-800 text-sm">{title}</h3>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function DocLink({ url, label, isVat = false }: { url: string; label: string; isVat?: boolean }) {
  // Documents are private and served through an authenticated API endpoint, so this must fetch
  // with the app's Bearer token rather than being a plain <a href> (see utils/fileAccess.ts).
  return (
    <button
      type="button"
      onClick={() => openPrivateFile(url)}
      className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all hover:shadow-sm w-full text-left ${
        isVat
          ? 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100'
          : 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100'
      }`}
    >
      <FileText className="w-4 h-4 flex-shrink-0" />
      <span className="text-sm font-medium flex-1">{label}</span>
      <ExternalLink className="w-3.5 h-3.5 flex-shrink-0 opacity-60" />
    </button>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function RegistrationRequestDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [reviewAction, setReviewAction] = useState<'Approve' | 'Reject' | null>(null);
  const [reviewUsername, setReviewUsername] = useState('');
  const [reviewPassword, setReviewPassword] = useState('');
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewRejectionReason, setReviewRejectionReason] = useState('');
  const [selectedRegionId, setSelectedRegionId] = useState('');
  const [selectedSubRegionId, setSelectedSubRegionId] = useState('');
  const [selectedCoordinatorId, setSelectedCoordinatorId] = useState('');

  const { data: request, isLoading } = useQuery<RegistrationRequest>({
    queryKey: ['admin-registration-request', id],
    queryFn: () => customerRegistrationApi.adminGetById(id!).then(r => r.data.data),
    enabled: !!id,
  });

  useEffect(() => {
    if (request) {
      setSelectedRegionId(request.regionId || '');
      setSelectedSubRegionId(request.subRegionId || '');
      setSelectedCoordinatorId(request.assignedCoordinatorId || '');
      // Pre-fill credentials from customer's preferences
      setReviewUsername(request.preferredUsername || request.businessRegistrationNumber || '');
      setReviewPassword(request.preferredPassword || '');
    }
  }, [request]);

  // Fetch regions, coordinators, reps for cascading dropdowns
  const { data: regions } = useQuery({
    queryKey: ['regions-all'],
    queryFn: () => regionsApi.getAll().then((r: any) => r.data),
  });

  const { data: allCoordinators } = useQuery({
    queryKey: ['admin-all-coordinators'],
    queryFn: () => adminGetAllCoordinators(1, 200),
  });

  // Filter sub-regions by selected region
  const filteredSubRegions = useMemo(() => {
    if (!regions || !selectedRegionId) return [];
    const region = (regions as any[]).find((reg: any) => reg.id === selectedRegionId);
    return region?.subRegions || [];
  }, [regions, selectedRegionId]);

  // Filter coordinators by selected region
  const filteredCoordinators = useMemo(() => {
    if (!allCoordinators?.items) return [];
    if (!selectedRegionId) return allCoordinators.items;
    return allCoordinators.items.filter((c: any) => c.regionId === selectedRegionId);
  }, [allCoordinators, selectedRegionId]);

  // Reset downstream when region changes
  const handleRegionChange = (regionId: string) => {
    setSelectedRegionId(regionId);
    setSelectedSubRegionId('');
    setSelectedCoordinatorId('');
  };

  const reviewMutation = useMutation({
    mutationFn: (data: any) => customerRegistrationApi.adminReview(id!, data).then(r => r.data.data),
    onSuccess: (result: any) => {
      toast.success(`Registration ${result.status === 'Approved' ? 'approved' : 'rejected'} successfully`);
      queryClient.invalidateQueries({ queryKey: ['admin-registration-request', id] });
      queryClient.invalidateQueries({ queryKey: ['admin-registration-requests'] });
      queryClient.invalidateQueries({ queryKey: ['admin-customers'] });
      setReviewAction(null);
    },
    onError: () => toast.error('Failed to submit review'),
  });

  const handleSubmit = () => {
    if (!reviewAction) return;
    reviewMutation.mutate({
      action: reviewAction,
      username: reviewAction === 'Approve' ? reviewUsername || undefined : undefined,
      password: reviewAction === 'Approve' ? reviewPassword : undefined,
      rejectionReason: reviewAction === 'Reject' ? reviewRejectionReason : undefined,
      reviewNotes: reviewNotes || undefined,
      regionId: reviewAction === 'Approve' ? selectedRegionId || undefined : undefined,
      subRegionId: reviewAction === 'Approve' ? selectedSubRegionId || undefined : undefined,
      assignedCoordinatorId: reviewAction === 'Approve' ? selectedCoordinatorId || undefined : undefined,
    });
  };

  const r = request;

  if (isLoading) {
    return (
      <div className="animate-fade-in space-y-4">
        <div className="h-8 w-48 bg-slate-200 rounded-lg animate-pulse" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-48 bg-slate-100 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!r) {
    return (
      <div className="text-center py-16">
        <p className="text-slate-500">Registration request not found</p>
        <button onClick={() => navigate('/admin/customers?tab=requests')} className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm">
          Back to Requests
        </button>
      </div>
    );
  }

  const isPending = r.status === 'Pending';
  const isApproved = r.status === 'Approved';

  const CONTACTS = [
    { role: 'Proprietor / Owner', prefix: 'proprietor' },
    { role: 'Manager', prefix: 'manager' },
    { role: 'Chef', prefix: 'chef' },
    { role: 'Purchasing Officer', prefix: 'purchasing' },
    { role: 'Accountant', prefix: 'accountant' },
  ];
  const contacts = CONTACTS.filter(c => (r as any)[`${c.prefix}Name`]);

  return (
    <div className="animate-fade-in space-y-5 pb-20">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-start gap-4">
        <button
          onClick={() => navigate('/admin/customers?tab=requests')}
          className="p-2 hover:bg-slate-100 rounded-lg transition mt-0.5"
        >
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl lg:text-2xl font-bold text-slate-900 truncate">{r.customerName}</h1>
            {/* Status badge */}
            {r.status === 'Pending' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                <Clock className="w-3 h-3" /> Pending
              </span>
            )}
            {r.status === 'Approved' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <CheckCircle className="w-3 h-3" /> Approved
              </span>
            )}
            {r.status === 'Rejected' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
                <XCircle className="w-3 h-3" /> Rejected
              </span>
            )}
            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
              r.customerType === 'Tax' ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-blue-50 text-blue-700 border border-blue-200'
            }`}>
              {r.customerType} Customer
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Submitted {r.createdAt ? formatDate(r.createdAt) : '—'} &nbsp;·&nbsp; Registration Request
          </p>
        </div>
      </div>

      {/* ── Content grid ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Left column (2/3) */}
        <div className="lg:col-span-2 space-y-5">

          {/* General Information */}
          <Section title="General Information" icon={<Building2 className="w-4 h-4" />}>
            <InfoRow label="Customer Name (BR)" value={r.customerName} />
            <InfoRow label="Business Registration Number" value={r.businessRegistrationNumber} />
            <InfoRow label="Business Name" value={r.businessName} />
            <InfoRow label="Registered Address" value={r.registeredAddress} />
            <InfoRow label="Business Location" value={r.businessLocation} />
            <InfoRow label="Province" value={r.province} />
            <InfoRow label="Town" value={r.town} />
            <InfoRow label="Telephone" value={r.telephone} />
            <InfoRow label="Email" value={r.email} />
            <InfoRow label="Bank & Branch" value={r.bankBranch} />
            <InfoRow label="Incorporate Date" value={r.incorporateDate ? formatDate(r.incorporateDate) : undefined} />
            {/* Preferred credentials — shown for admin reference */}
            {(r.preferredUsername || r.preferredPassword) && (
              <div className="mt-3 pt-3 border-t border-slate-100">
                <p className="text-xs font-bold text-amber-600 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                  <span className="inline-block w-2 h-2 rounded-full bg-amber-400" />
                  Customer's Preferred Login Credentials
                </p>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2">
                  {r.preferredUsername && (
                    <div className="flex justify-between items-center gap-4">
                      <span className="text-xs text-amber-600 font-medium">Preferred Username</span>
                      <span className="text-sm text-slate-900 font-semibold font-mono">{r.preferredUsername}</span>
                    </div>
                  )}
                  {r.preferredPassword && (
                    <div className="flex justify-between items-center gap-4">
                      <span className="text-xs text-amber-600 font-medium">Preferred Password</span>
                      <span className="text-sm text-slate-900 font-semibold font-mono">{r.preferredPassword}</span>
                    </div>
                  )}
                  <p className="text-[10px] text-amber-500 pt-1">These are the customer's suggestions. You can use them or set different credentials when approving.</p>
                </div>
              </div>
            )}
          </Section>

          {/* Contact Persons */}
          {contacts.length > 0 && (
            <Section title="Contact Persons" icon={<User className="w-4 h-4" />}>
              <div className="space-y-4">
                {contacts.map(({ role, prefix }) => (
                  <div key={prefix} className="bg-slate-50 rounded-xl p-3.5">
                    <p className="text-xs font-bold text-indigo-600 uppercase tracking-wider mb-2.5">{role}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {(r as any)[`${prefix}Name`] && (
                        <div className="flex items-center gap-1.5 text-sm text-slate-700">
                          <User className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                          {(r as any)[`${prefix}Name`]}
                        </div>
                      )}
                      {(r as any)[`${prefix}Tp`] && (
                        <div className="flex items-center gap-1.5 text-sm text-slate-600">
                          <Phone className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                          {(r as any)[`${prefix}Tp`]}
                        </div>
                      )}
                      {(r as any)[`${prefix}Email`] && (
                        <div className="flex items-center gap-1.5 text-sm text-slate-600 min-w-0">
                          <Mail className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                          <span className="truncate">{(r as any)[`${prefix}Email`]}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Uploaded Documents */}
          {(r.businessRegDocUrl || r.businessAddressDocUrl || r.vatDocUrl) && (
            <Section title="Uploaded Documents" icon={<Download className="w-4 h-4" />}>
              <div className="space-y-2.5">
                {r.businessRegDocUrl && (
                  <DocLink url={r.businessRegDocUrl} label="Business Registration Document" />
                )}
                {r.businessAddressDocUrl && (
                  <DocLink url={r.businessAddressDocUrl} label="Business Address Proof" />
                )}
                {r.vatDocUrl && (
                  <DocLink url={r.vatDocUrl} label="VAT Registration Document" isVat />
                )}
              </div>
            </Section>
          )}
        </div>

        {/* Right column (1/3) */}
        <div className="space-y-5">

          {/* Review result (already reviewed) */}
          {!isPending && (
            <div className={`rounded-xl p-5 border ${isApproved ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
              <p className={`font-bold text-sm mb-3 flex items-center gap-2 ${isApproved ? 'text-emerald-700' : 'text-red-700'}`}>
                {isApproved ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                {isApproved ? 'Approved' : 'Rejected'}
              </p>
              {r.regionName && (
                <p className="text-sm text-slate-700 mb-1.5">
                  <span className="text-slate-500 text-xs">Region:</span>{' '}
                  <strong>{r.regionName}</strong>
                </p>
              )}
              {r.subRegionName && (
                <p className="text-sm text-slate-700 mb-1.5">
                  <span className="text-slate-500 text-xs">Sub-Region:</span>{' '}
                  <strong>{r.subRegionName}</strong>
                </p>
              )}
              {r.assignedCoordinatorName && (
                <p className="text-sm text-slate-700 mb-1.5">
                  <span className="text-slate-500 text-xs">Coordinator:</span>{' '}
                  <strong>{r.assignedCoordinatorName}</strong>
                </p>
              )}
              {r.assignedRepName && (
                <p className="text-sm text-slate-700 mb-1.5">
                  <span className="text-slate-500 text-xs">Sales Rep:</span>{' '}
                  <strong>{r.assignedRepName}</strong>
                </p>
              )}
              {r.rejectionReason && <p className="text-sm text-red-700 mt-2"><span className="text-xs">Reason:</span> {r.rejectionReason}</p>}
              {r.reviewNotes && <p className="text-sm text-slate-600 mt-1"><span className="text-xs text-slate-500">Notes:</span> {r.reviewNotes}</p>}
              {r.reviewedAt && <p className="text-xs text-slate-400 mt-3">{formatDate(r.reviewedAt)}</p>}
            </div>
          )}

          {/* Admin Review panel (only for Pending) */}
          {isPending && (
            <Section title="Review Decision" icon={<UserCheck className="w-4 h-4" />}>
              <div className="space-y-4">
                {/* Action buttons */}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => {
                      setReviewAction('Approve');
                      setReviewRejectionReason('');
                    }}
                    className={`py-3 rounded-xl border-2 text-sm font-semibold flex items-center justify-center gap-2 transition-all ${
                      reviewAction === 'Approve'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                        : 'border-slate-200 text-slate-500 hover:border-emerald-300 hover:bg-emerald-50/50'
                    }`}
                  >
                    <CheckCircle className="w-4 h-4" /> Approve
                  </button>
                  <button
                    onClick={() => {
                      setReviewAction('Reject');
                      setReviewPassword('');
                    }}
                    className={`py-3 rounded-xl border-2 text-sm font-semibold flex items-center justify-center gap-2 transition-all ${
                      reviewAction === 'Reject'
                        ? 'border-red-500 bg-red-50 text-red-700'
                        : 'border-slate-200 text-slate-500 hover:border-red-300 hover:bg-red-50/50'
                    }`}
                  >
                    <XCircle className="w-4 h-4" /> Reject
                  </button>
                </div>

                {/* Cascading: Region → Coordinator → Rep (Approve only) */}
                {reviewAction === 'Approve' && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                        Account Username <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={reviewUsername}
                        onChange={e => setReviewUsername(e.target.value)}
                        placeholder="Set account username"
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-500/15 focus:border-indigo-300 transition font-mono"
                      />
                      {r.preferredUsername && reviewUsername !== r.preferredUsername && (
                        <button
                          type="button"
                          onClick={() => setReviewUsername(r.preferredUsername!)}
                          className="mt-1 text-[11px] text-amber-600 hover:underline"
                        >
                          ← Use customer's preferred: <strong>{r.preferredUsername}</strong>
                        </button>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                        Account Password <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={reviewPassword}
                        onChange={e => setReviewPassword(e.target.value)}
                        placeholder="Set permanent password"
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-500/15 focus:border-indigo-300 transition font-mono"
                      />
                      {r.preferredPassword && reviewPassword !== r.preferredPassword && (
                        <button
                          type="button"
                          onClick={() => setReviewPassword(r.preferredPassword!)}
                          className="mt-1 text-[11px] text-amber-600 hover:underline"
                        >
                          ← Use customer's preferred password
                        </button>
                      )}
                    </div>

                    {/* Region */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                        <MapPin className="w-3.5 h-3.5 inline mr-1" /> Region
                      </label>
                      <select
                        value={selectedRegionId}
                        onChange={e => handleRegionChange(e.target.value)}
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-500/15 focus:border-indigo-300 transition"
                      >
                        <option value="">Select region…</option>
                        {(regions || []).map((reg: any) => (
                          <option key={reg.id} value={reg.id}>{reg.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Sub-Region (filtered by region) */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                        <MapPin className="w-3.5 h-3.5 inline mr-1" /> Sub-Region
                      </label>
                      <select
                        value={selectedSubRegionId}
                        onChange={e => setSelectedSubRegionId(e.target.value)}
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-500/15 focus:border-indigo-300 transition"
                      >
                        <option value="">Select sub-region…</option>
                        {filteredSubRegions.map((sr: any) => (
                          <option key={sr.id} value={sr.id}>{sr.name}</option>
                        ))}
                      </select>
                      {selectedRegionId && filteredSubRegions.length === 0 && (
                        <p className="text-xs text-amber-600 mt-1">No sub-regions in this region</p>
                      )}
                    </div>

                    {/* Coordinator (filtered by region) */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                        <UserCheck className="w-3.5 h-3.5 inline mr-1" /> Coordinator
                      </label>
                      <select
                        value={selectedCoordinatorId}
                        onChange={e => setSelectedCoordinatorId(e.target.value)}
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-500/15 focus:border-indigo-300 transition"
                      >
                        <option value="">Select coordinator…</option>
                        {filteredCoordinators.map((c: any) => (
                          <option key={c.id} value={c.id}>{c.fullName}</option>
                        ))}
                      </select>
                      {selectedRegionId && filteredCoordinators.length === 0 && (
                        <p className="text-xs text-amber-600 mt-1">No coordinators in this region</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Rejection reason */}
                {reviewAction === 'Reject' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                      Rejection Reason <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={reviewRejectionReason}
                      onChange={e => setReviewRejectionReason(e.target.value)}
                      rows={3}
                      placeholder="Explain why the registration is being rejected…"
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white outline-none focus:ring-2 focus:ring-red-500/15 focus:border-red-300 transition resize-none"
                    />
                  </div>
                )}

                {/* Internal notes */}
                {reviewAction && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Internal Notes (optional)</label>
                    <textarea
                      value={reviewNotes}
                      onChange={e => setReviewNotes(e.target.value)}
                      rows={2}
                      placeholder="Any internal notes…"
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-500/15 focus:border-indigo-300 transition resize-none"
                    />
                  </div>
                )}

                {/* Submit */}
                <button
                  onClick={handleSubmit}
                  disabled={
                    !reviewAction
                    || (reviewAction === 'Approve' && (!reviewUsername.trim() || !reviewPassword.trim()))
                    || (reviewAction === 'Reject' && !reviewRejectionReason.trim())
                    || reviewMutation.isPending
                  }
                  className={`w-full py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                    reviewAction === 'Approve'
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
                      : reviewAction === 'Reject'
                      ? 'bg-red-600 hover:bg-red-700 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  {reviewMutation.isPending ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                      </svg>
                      Submitting…
                    </>
                  ) : reviewAction === 'Approve' ? (
                    <><CheckCircle className="w-4 h-4" /> Approve</>
                  ) : reviewAction === 'Reject' ? (
                    <><XCircle className="w-4 h-4" /> Reject Registration</>
                  ) : (
                    'Select an action above'
                  )}
                </button>
              </div>
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}
