import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customersApi } from '../../services/api/customersApi';
import { authApi } from '../../services/api/authApi';
import { useAuth } from '../../hooks/useAuth';
import {
  User, MapPin, Store, LogOut, Shield, Phone, Mail,
  Edit3, Lock, X, Loader2, ChevronRight, Package,
  Wallet, UserCheck, Tag, Hash, Building2, Save, KeyRound, Eye, EyeOff,
} from 'lucide-react';
import ConfirmModal from '../../components/common/ConfirmModal';
import { formatCurrency } from '../../utils/formatters';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

// ─── small helpers ─────────────────────────────────────────────────────────────
function InfoField({ label, value, icon: Icon }: { label: string; value?: string | null; icon?: React.ElementType }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-slate-50 last:border-0">
      {Icon && (
        <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Icon className="w-4 h-4 text-orange-500" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">{label}</p>
        <p className="text-sm font-semibold text-slate-800 break-words">
          {value || <span className="text-slate-300 font-normal italic text-xs">Not provided</span>}
        </p>
      </div>
    </div>
  );
}

function FormField({
  label, value, onChange, placeholder, type = 'text', readOnly = false,
}: {
  label: string; value: string; onChange?: (v: string) => void;
  placeholder?: string; type?: string; readOnly?: boolean;
}) {
  const [show, setShow] = useState(false);
  const isPassword = type === 'password';
  return (
    <div>
      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">{label}</label>
      <div className="relative">
        <input
          type={isPassword && show ? 'text' : type}
          value={value}
          onChange={e => onChange?.(e.target.value)}
          placeholder={placeholder}
          readOnly={readOnly}
          className={`w-full px-4 py-3 border rounded-xl text-sm outline-none transition-all ${
            readOnly
              ? 'bg-slate-50 border-slate-100 text-slate-400 cursor-default'
              : 'bg-white border-slate-200 text-slate-800 focus:border-orange-400 focus:ring-2 focus:ring-orange-500/10'
          }`}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShow(s => !s)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        )}
      </div>
    </div>
  );
}

export default function CustomerProfile() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // 'none' | 'edit' | 'password'
  const [panel, setPanel] = useState<'none' | 'edit' | 'password'>('none');
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);

  const { data: profile, isLoading } = useQuery({
    queryKey: ['customer-profile'],
    queryFn: () => customersApi.customerGetProfile().then(r => r.data.data),
  });

  const [editForm, setEditForm] = useState({
    shopName: '', phoneNumber: '', email: '', street: '', city: '', state: '',
  });

  const openEdit = () => {
    setEditForm({
      shopName: profile?.shopName || '',
      phoneNumber: profile?.phoneNumber || '',
      email: profile?.email || '',
      street: profile?.street || '',
      city: profile?.city || '',
      state: profile?.state || '',
    });
    setPanel('edit');
  };

  const editMut = useMutation({
    mutationFn: (data: Record<string, unknown>) => customersApi.customerUpdateProfile(data),
    onSuccess: () => {
      toast.success('Profile updated successfully');
      queryClient.invalidateQueries({ queryKey: ['customer-profile'] });
      setPanel('none');
    },
    onError: () => toast.error('Update failed'),
  });

  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });

  const pwMut = useMutation({
    mutationFn: (data: { currentPassword: string; newPassword: string }) => authApi.changePassword(data),
    onSuccess: () => {
      toast.success('Password changed successfully');
      setPanel('none');
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    },
    onError: () => toast.error('Password change failed'),
  });

  const handlePasswordSubmit = () => {
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (pwForm.newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    pwMut.mutate({ currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword });
  };

  const addressStr = [profile?.street, profile?.city, profile?.state].filter(Boolean).join(', ');
  const displayName = profile?.shopName || user?.username || 'Customer';
  const initials = displayName.slice(0, 2).toUpperCase();

  // Data groups
  const businessInfo = [
    { label: 'Shop Name', value: profile?.shopName, icon: Store },
    { label: 'Customer Type', value: profile?.customerType, icon: Tag },
    { label: 'Email', value: profile?.email || user?.email, icon: Mail },
    { label: 'Phone', value: profile?.phoneNumber, icon: Phone },
    { label: 'Business Reg No.', value: profile?.businessRegistrationNumber, icon: Hash },
  ];

  const locationInfo = [
    { label: 'Street', value: profile?.street, icon: MapPin },
    { label: 'City', value: profile?.city, icon: Building2 },
    { label: 'Province', value: profile?.state, icon: MapPin },
    { label: 'Region', value: profile?.regionName, icon: Shield },
    { label: 'Sub Region', value: profile?.subRegionName, icon: Shield },
  ];

  const accountInfo = [
    { label: 'Assigned Sales Rep', value: profile?.assignedRepName, icon: UserCheck },
    { label: 'Assigned Coordinator', value: profile?.assignedCoordinatorName, icon: UserCheck },
    { label: 'Approval Status', value: profile?.approvalStatus, icon: Shield },
    {
      label: 'Member Since',
      value: profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }) : undefined,
      icon: User,
    },
  ];

  // Shared panel form body (used in both desktop inline + mobile sheet)
  const PanelBody = () => (
    panel === 'edit' ? (
      <div className="space-y-4">
        <FormField label="Shop Name" value={editForm.shopName} onChange={v => setEditForm(p => ({ ...p, shopName: v }))} placeholder="Your shop name" />
        <FormField label="Phone Number" value={editForm.phoneNumber} onChange={v => setEditForm(p => ({ ...p, phoneNumber: v }))} placeholder="07X XXX XXXX" />
        <FormField label="Email" value={editForm.email} onChange={v => setEditForm(p => ({ ...p, email: v }))} placeholder="email@example.com" type="email" />
        <FormField label="Street Address" value={editForm.street} onChange={v => setEditForm(p => ({ ...p, street: v }))} placeholder="Street" />
        <div className="grid grid-cols-2 gap-3">
          <FormField label="City" value={editForm.city} onChange={v => setEditForm(p => ({ ...p, city: v }))} placeholder="City" />
          <FormField label="Province" value={editForm.state} onChange={v => setEditForm(p => ({ ...p, state: v }))} placeholder="Province" />
        </div>
        <button
          onClick={() => editMut.mutate(editForm)}
          disabled={editMut.isPending}
          className="w-full h-12 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-bold shadow-md shadow-orange-500/20 active:scale-95 transition-all flex items-center justify-center gap-2 mt-2"
        >
          {editMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" /> Save Changes</>}
        </button>
      </div>
    ) : (
      <div className="space-y-4">
        <FormField label="Current Password" value={pwForm.currentPassword} onChange={v => setPwForm(p => ({ ...p, currentPassword: v }))} type="password" />
        <FormField label="New Password" value={pwForm.newPassword} onChange={v => setPwForm(p => ({ ...p, newPassword: v }))} type="password" />
        <FormField label="Confirm New Password" value={pwForm.confirmPassword} onChange={v => setPwForm(p => ({ ...p, confirmPassword: v }))} type="password" />
        <button
          onClick={handlePasswordSubmit}
          disabled={pwMut.isPending}
          className="w-full h-12 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-bold shadow-md shadow-orange-500/20 active:scale-95 transition-all flex items-center justify-center gap-2 mt-2"
        >
          {pwMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><KeyRound className="w-4 h-4" /> Update Password</>}
        </button>
      </div>
    )
  );

  const skeletonRows = Array.from({ length: 4 }).map((_, i) => (
    <div key={i} className="flex items-center gap-3 py-3 border-b border-slate-50 last:border-0">
      <div className="w-8 h-8 rounded-lg bg-slate-100 animate-pulse flex-shrink-0" />
      <div className="flex-1 space-y-1.5">
        <div className="h-2 w-16 bg-slate-100 rounded animate-pulse" />
        <div className="h-3 w-32 bg-slate-100 rounded animate-pulse" />
      </div>
    </div>
  ));

  return (
    <div className="animate-fade-in min-h-screen bg-slate-50">

      {/* ════════════════════════════════════════════════════════════════
          DESKTOP LAYOUT  (lg and above) — two-column, no bottom sheets
          ════════════════════════════════════════════════════════════════ */}
      <div className="hidden lg:block max-w-screen-xl mx-auto px-6 py-8">
        <div className="grid grid-cols-3 gap-6 items-start">

          {/* ── LEFT column: identity + actions ── */}
          <div className="col-span-1 space-y-4 sticky top-6">
            {/* Avatar card */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="bg-gradient-to-br from-orange-500 to-rose-500 px-6 pt-8 pb-14 text-white text-center">
                <div className="w-20 h-20 rounded-2xl bg-white/20 backdrop-blur border border-white/30 flex items-center justify-center mx-auto mb-3">
                  <span className="text-3xl font-black">{initials}</span>
                </div>
                <h2 className="font-black text-lg leading-tight">{displayName}</h2>
                <p className="text-orange-100 text-xs mt-1 truncate">{user?.email}</p>
              </div>
              {/* Stats float */}
              <div className="-mt-6 px-5 pb-5">
                <div className="bg-white border border-slate-100 rounded-xl shadow-sm p-4 grid grid-cols-2 gap-3">
                  <div className="text-center">
                    <div className="w-9 h-9 rounded-xl bg-orange-50 flex items-center justify-center mx-auto mb-1.5">
                      <Package className="w-4 h-4 text-orange-600" />
                    </div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Orders</p>
                    <p className="text-sm font-black text-slate-900">{profile?.totalOrders || 0}</p>
                  </div>
                  <div className="text-center">
                    <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center mx-auto mb-1.5">
                      <Wallet className="w-4 h-4 text-emerald-600" />
                    </div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Value</p>
                    <p className="text-xs font-black text-slate-900">{profile ? formatCurrency(profile.totalOrderValue || 0) : 'LKR 0'}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm divide-y divide-slate-50">
              <button
                onClick={openEdit}
                className="w-full flex items-center gap-3 px-5 py-4 hover:bg-orange-50 transition group"
              >
                <div className="w-9 h-9 rounded-xl bg-orange-50 group-hover:bg-orange-100 flex items-center justify-center transition">
                  <Edit3 className="w-4 h-4 text-orange-500" />
                </div>
                <div className="text-left flex-1">
                  <p className="text-sm font-bold text-slate-800">Edit Profile</p>
                  <p className="text-[10px] text-slate-400">Update your details</p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-orange-500 transition" />
              </button>
              <button
                onClick={() => setPanel('password')}
                className="w-full flex items-center gap-3 px-5 py-4 hover:bg-slate-50 transition group"
              >
                <div className="w-9 h-9 rounded-xl bg-slate-50 group-hover:bg-slate-100 flex items-center justify-center transition">
                  <Lock className="w-4 h-4 text-slate-500" />
                </div>
                <div className="text-left flex-1">
                  <p className="text-sm font-bold text-slate-800">Change Password</p>
                  <p className="text-[10px] text-slate-400">Security settings</p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition" />
              </button>
              <button
                onClick={() => navigate('/shop/support')}
                className="w-full flex items-center gap-3 px-5 py-4 hover:bg-slate-50 transition group"
              >
                <div className="w-9 h-9 rounded-xl bg-slate-50 group-hover:bg-slate-100 flex items-center justify-center transition">
                  <User className="w-4 h-4 text-slate-500" />
                </div>
                <div className="text-left flex-1">
                  <p className="text-sm font-bold text-slate-800">Support Center</p>
                  <p className="text-[10px] text-slate-400">Get help from our team</p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300 transition" />
              </button>
              <button
                onClick={() => setLogoutConfirmOpen(true)}
                className="w-full flex items-center gap-3 px-5 py-4 hover:bg-red-50 transition group"
              >
                <div className="w-9 h-9 rounded-xl bg-red-50 group-hover:bg-red-100 flex items-center justify-center transition">
                  <LogOut className="w-4 h-4 text-red-500" />
                </div>
                <span className="text-sm font-bold text-red-600">Sign Out</span>
              </button>
            </div>
          </div>

          {/* ── RIGHT column: info cards + inline panel ── */}
          <div className="col-span-2 space-y-4">

            {/* Inline edit/password panel — only on desktop */}
            {panel !== 'none' && (
              <div className="bg-white rounded-2xl border border-orange-100 shadow-sm p-6">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="font-black text-slate-900 text-base">
                    {panel === 'edit' ? 'Edit Profile' : 'Change Password'}
                  </h3>
                  <button
                    onClick={() => setPanel('none')}
                    className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition"
                  >
                    <X className="w-4 h-4 text-slate-500" />
                  </button>
                </div>
                <PanelBody />
              </div>
            )}

            {/* Business information */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
              <div className="px-6 py-4 border-b border-slate-50 flex items-center justify-between">
                <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest">Business Information</h3>
                <button onClick={openEdit} className="text-xs text-orange-500 font-bold hover:text-orange-600 flex items-center gap-1 transition">
                  <Edit3 className="w-3 h-3" /> Edit
                </button>
              </div>
              <div className="px-6 py-2">
                {isLoading ? skeletonRows : businessInfo.map(f => <InfoField key={f.label} {...f} />)}
              </div>
            </div>

            {/* Location */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
              <div className="px-6 py-4 border-b border-slate-50 flex items-center justify-between">
                <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest">Location</h3>
                <button onClick={openEdit} className="text-xs text-orange-500 font-bold hover:text-orange-600 flex items-center gap-1 transition">
                  <Edit3 className="w-3 h-3" /> Edit
                </button>
              </div>
              <div className="px-6 py-2">
                {isLoading ? skeletonRows : locationInfo.map(f => <InfoField key={f.label} {...f} />)}
              </div>
            </div>

            {/* Account info (read-only) */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
              <div className="px-6 py-4 border-b border-slate-50">
                <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest">Account & Assignment</h3>
              </div>
              <div className="px-6 py-2">
                {accountInfo.map(f => <InfoField key={f.label} {...f} />)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════
          MOBILE / TABLET LAYOUT  (below lg)
          ════════════════════════════════════════════════════════════════ */}
      <div className="lg:hidden">
        {/* Orange header */}
        <div className="relative bg-gradient-to-br from-orange-500 to-rose-500 px-6 pt-10 pb-16 text-white overflow-hidden">
          <div className="absolute top-0 right-0 w-56 h-56 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/3 blur-3xl" />
          <div className="absolute bottom-0 left-0 w-40 h-40 bg-black/5 rounded-full translate-y-1/2 -translate-x-1/4 blur-2xl" />
          <div className="relative z-10 flex flex-col items-center text-center">
            <div className="w-20 h-20 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/30 shadow-xl mb-3">
              <span className="text-3xl font-black">{initials}</span>
            </div>
            <h2 className="font-black text-xl">{displayName}</h2>
            <p className="text-orange-100 text-xs mt-1 max-w-[200px] truncate">{user?.email}</p>
            <button
              onClick={openEdit}
              className="mt-3 flex items-center gap-1.5 bg-white/20 hover:bg-white/30 border border-white/30 rounded-full px-4 py-1.5 text-xs font-bold transition"
            >
              <Edit3 className="w-3 h-3" /> Edit Profile
            </button>
          </div>
        </div>

        <div className="px-4 -mt-8 relative z-10 pb-10 space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col items-center text-center">
              <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center mb-2">
                <Package className="w-5 h-5 text-orange-600" />
              </div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Total Orders</p>
              <p className="text-base font-black text-slate-900">{profile?.totalOrders || 0}</p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col items-center text-center">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center mb-2">
                <Wallet className="w-5 h-5 text-emerald-600" />
              </div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Total Value</p>
              <p className="text-sm font-black text-slate-900">{profile ? formatCurrency(profile.totalOrderValue || 0) : 'LKR 0'}</p>
            </div>
          </div>

          {/* Business info */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
            <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between">
              <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest">Business Info</h3>
              <button onClick={openEdit} className="text-xs text-orange-500 font-bold flex items-center gap-1">
                <Edit3 className="w-3 h-3" /> Edit
              </button>
            </div>
            <div className="px-5 py-2">{isLoading ? skeletonRows : businessInfo.map(f => <InfoField key={f.label} {...f} />)}</div>
          </div>

          {/* Location */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
            <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between">
              <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest">Location</h3>
              <button onClick={openEdit} className="text-xs text-orange-500 font-bold flex items-center gap-1">
                <Edit3 className="w-3 h-3" /> Edit
              </button>
            </div>
            <div className="px-5 py-2">{isLoading ? skeletonRows : locationInfo.map(f => <InfoField key={f.label} {...f} />)}</div>
          </div>

          {/* Account */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
            <div className="px-5 py-4 border-b border-slate-50">
              <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest">Account & Assignment</h3>
            </div>
            <div className="px-5 py-2">{accountInfo.map(f => <InfoField key={f.label} {...f} />)}</div>
          </div>

          {/* Actions */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm divide-y divide-slate-50">
            <button onClick={() => setPanel('password')} className="w-full flex items-center gap-3 px-5 py-4 hover:bg-slate-50 transition group">
              <div className="w-9 h-9 rounded-xl bg-slate-50 flex items-center justify-center">
                <Lock className="w-4 h-4 text-slate-500" />
              </div>
              <div className="text-left flex-1">
                <p className="text-sm font-bold text-slate-800">Change Password</p>
                <p className="text-[10px] text-slate-400">Security settings</p>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300" />
            </button>
            <button onClick={() => navigate('/shop/support')} className="w-full flex items-center gap-3 px-5 py-4 hover:bg-slate-50 transition group">
              <div className="w-9 h-9 rounded-xl bg-slate-50 flex items-center justify-center">
                <User className="w-4 h-4 text-slate-500" />
              </div>
              <div className="text-left flex-1">
                <p className="text-sm font-bold text-slate-800">Support Center</p>
                <p className="text-[10px] text-slate-400">Get help from our team</p>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300" />
            </button>
          </div>

          <button
            onClick={() => setLogoutConfirmOpen(true)}
            className="w-full h-12 bg-red-50 border border-red-100 text-red-600 rounded-xl text-sm font-black flex items-center justify-center gap-2 hover:bg-red-500 hover:text-white transition-all active:scale-95"
          >
            <LogOut className="w-4 h-4" /> Sign Out
          </button>

          <p className="text-center text-[10px] text-slate-300 font-bold uppercase tracking-widest">Janasiri Distributors v1.2.0</p>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════
          MOBILE BOTTOM SHEET — edit / password  (hidden on lg+)
          ════════════════════════════════════════════════════════════════ */}
      {panel !== 'none' && (
        <div className="fixed inset-0 z-[100] flex items-end lg:hidden">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setPanel('none')} />
          <div className="relative w-full bg-white rounded-t-3xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white/95 backdrop-blur px-6 pt-5 pb-4 border-b border-slate-100 z-10">
              <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-4" />
              <div className="flex items-center justify-between">
                <h2 className="font-black text-slate-900 text-lg">
                  {panel === 'edit' ? 'Edit Profile' : 'Change Password'}
                </h2>
                <button onClick={() => setPanel('none')} className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center">
                  <X className="w-4 h-4 text-slate-500" />
                </button>
              </div>
            </div>
            <div className="px-6 py-5">
              <PanelBody />
            </div>
          </div>
        </div>
      )}

      {/* Logout confirm */}
      {logoutConfirmOpen && (
        <ConfirmModal
          open={logoutConfirmOpen}
          title="Sign out account"
          description="Are you sure you want to sign out? You will need to login again to manage your orders."
          confirmLabel="Sign Out"
          confirmVariant="orange"
          onConfirm={() => { setLogoutConfirmOpen(false); logout().then(() => navigate('/login')); }}
          onCancel={() => setLogoutConfirmOpen(false)}
        />
      )}
    </div>
  );
}