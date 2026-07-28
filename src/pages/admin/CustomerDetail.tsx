import { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customersApi } from '../../services/api/customersApi';
import { regionsApi } from '../../services/api/regionsApi';
import api from '../../services/api/axiosConfig';
import { openPrivateFile } from '../../utils/fileAccess';

// ─── Customer ZIP Export ──────────────────────────────────────────────────────
async function handleCustomerExport(summary: any) {
  if (!summary) return;

  // jsPDF is already bundled; JSZip loaded from CDN (no npm install needed)
  const { jsPDF } = await import('jspdf');
  const JSZip: any = await new Promise((resolve, reject) => {
    if ((window as any).JSZip) { resolve((window as any).JSZip); return; }
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js';
    s.onload = () => resolve((window as any).JSZip);
    s.onerror = () => reject(new Error('JSZip load failed'));
    document.head.appendChild(s);
  });

  const { customer, registrationRequest, totalPurchases, totalOrders } = summary;
  const doc = new jsPDF();
  let y = 20;

  const checkPage = () => { if (y > 270) { doc.addPage(); y = 20; } };
  const sectionTitle = (t: string) => {
    checkPage();
    doc.setFontSize(12); doc.setTextColor(79, 70, 229); doc.setFont('helvetica', 'bold');
    doc.text(t, 14, y); y += 2;
    doc.setDrawColor(226, 232, 240); doc.line(14, y, 196, y); y += 7;
  };
  const field = (label: string, value: string | null | undefined) => {
    if (!value) return; checkPage();
    doc.setFontSize(9); doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139); doc.text(label, 14, y);
    doc.setTextColor(30, 41, 59);
    const lines = doc.splitTextToSize(String(value), 112);
    doc.text(lines, 88, y); y += Math.max(lines.length * 5, 5) + 1;
  };

  // ── Title ──────────────────────────────────────────────────────────────────
  doc.setFontSize(18); doc.setTextColor(79, 70, 229); doc.setFont('helvetica', 'bold');
  doc.text('Customer Profile', 105, y, { align: 'center' }); y += 8;
  doc.setFontSize(9); doc.setTextColor(100, 116, 139); doc.setFont('helvetica', 'normal');
  doc.text(`Generated: ${new Date().toLocaleString()}`, 105, y, { align: 'center' }); y += 10;
  doc.setDrawColor(226, 232, 240); doc.line(14, y, 196, y); y += 10;

  // ── General Information ────────────────────────────────────────────────────
  sectionTitle('General Information');
  field('Shop Name', customer?.shopName);
  field('Customer Type', registrationRequest?.customerType ?? 'NonTax');
  field('Business Reg #', customer?.businessRegistrationNumber);
  field('Phone', customer?.phoneNumber);
  field('Email', customer?.email);
  field('Address', [customer?.street, customer?.city, customer?.state].filter(Boolean).join(', '));
  field('Status', customer?.isActive ? 'Active' : 'Inactive');
  field('Approval Status', customer?.approvalStatus);
  field('Joined', customer?.createdAt ? new Date(customer.createdAt).toLocaleDateString() : '');
  y += 4;

  // ── Assignment ─────────────────────────────────────────────────────────────
  sectionTitle('Assignment');
  field('Region', customer?.regionName);
  field('Sub-Region', customer?.subRegionName);
  field('Coordinator', customer?.assignedCoordinatorName);
  y += 4;

  // ── Credentials ───────────────────────────────────────────────────────────
  sectionTitle('Credentials');
  field('Username', customer?.username);
  field('Password', customer?.temporaryPassword);
  y += 4;

  // ── Order Statistics ──────────────────────────────────────────────────────
  sectionTitle('Order Statistics');
  field('Total Orders', String(totalOrders ?? 0));
  field('Total Purchases (LKR)', Number(totalPurchases ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  y += 4;

  // ── Registration & Professional Details ───────────────────────────────────
  if (registrationRequest) {
    sectionTitle('Registration & Professional Details');
    field('Customer Name', registrationRequest.customerName);
    field('Registered Address', registrationRequest.registeredAddress);
    if (registrationRequest.incorporateDate)
      field('Incorporate Date', new Date(registrationRequest.incorporateDate).toLocaleDateString());
    field('Business Name', registrationRequest.businessName);
    field('Business Location', registrationRequest.businessLocation);
    field('Bank Branch', registrationRequest.bankBranch);
    field('Telephone', registrationRequest.telephone);
    field('Email', registrationRequest.email);
    y += 4;

    if (registrationRequest.proprietorName || registrationRequest.managerName) {
      sectionTitle('Key Contacts');
      if (registrationRequest.proprietorName) field('Proprietor', `${registrationRequest.proprietorName}${registrationRequest.proprietorTp ? '  ·  ' + registrationRequest.proprietorTp : ''}`);
      if (registrationRequest.managerName) field('Manager', `${registrationRequest.managerName}${registrationRequest.managerTp ? '  ·  ' + registrationRequest.managerTp : ''}`);
      if (registrationRequest.chefName) field('Chef', `${registrationRequest.chefName}${registrationRequest.chefTp ? '  ·  ' + registrationRequest.chefTp : ''}`);
      if (registrationRequest.purchasingName) field('Purchasing', `${registrationRequest.purchasingName}${registrationRequest.purchasingTp ? '  ·  ' + registrationRequest.purchasingTp : ''}`);
      if (registrationRequest.accountantName) field('Accountant', `${registrationRequest.accountantName}${registrationRequest.accountantTp ? '  ·  ' + registrationRequest.accountantTp : ''}`);
      y += 4;
    }

    const docNames = [
      registrationRequest.businessRegDocPath && 'Business Registration Document',
      registrationRequest.businessAddressDocPath && 'Business Address Document',
      registrationRequest.vatDocPath && 'VAT Registration Document',
    ].filter(Boolean) as string[];
    if (docNames.length > 0) {
      sectionTitle('Attached Documents');
      docNames.forEach(d => {
        checkPage();
        doc.setFontSize(9); doc.setTextColor(30, 41, 59);
        doc.text(`\u2022 ${d}  (see documents/ folder in ZIP)`, 20, y); y += 6;
      });
    }
  }

  const pdfBlob = doc.output('blob');

  // ── Build ZIP ──────────────────────────────────────────────────────────────
  const zip = new JSZip();
  const safeName = (customer?.shopName ?? 'customer').replace(/[^a-z0-9_\-]/gi, '_');
  zip.file(`${safeName}-details.pdf`, pdfBlob);

  if (registrationRequest) {
    // Documents are private and served through authenticated API endpoints (never a plain URL),
    // so they must be fetched with the shared axios instance, not a bare fetch().
    const docsFolder = zip.folder('documents')!;
    await Promise.all(
      [
        { path: registrationRequest.businessRegDocPath, name: 'business-reg' },
        { path: registrationRequest.businessAddressDocPath, name: 'business-address' },
        { path: registrationRequest.vatDocPath, name: 'vat-doc' },
      ]
        .filter(d => d.path)
        .map(async ({ path, name }) => {
          try {
            const relativePath = (path as string).replace(/^\/api(?=\/)/, '');
            const res = await api.get(relativePath, { responseType: 'blob' });
            const contentType = res.headers['content-type'] as string | undefined;
            const ext = contentType?.includes('pdf') ? 'pdf' : contentType?.split('/').pop() ?? 'bin';
            docsFolder.file(`${name}.${ext}`, res.data as Blob);
          } catch { /* skip missing docs */ }
        })
    );
  }

  const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(zipBlob);
  a.download = `${safeName}-export.zip`;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
}
import { adminGetAllCoordinators } from '../../services/api/coordinatorApi';
import { authApi } from '../../services/api/authApi';
import { useParams, useNavigate } from 'react-router-dom';
import { formatCurrency, formatDate } from '../../utils/formatters';
import {
  ArrowLeft, Store, MapPin, User, Calendar, TrendingUp,
  ShoppingBag, DollarSign, ToggleLeft, ToggleRight,
  UserCheck, Building2, Phone, Mail, Package, FileText as FileTextIcon, KeyRound, PencilLine, Copy,
  Check, X as XIcon, Eye, EyeOff, Upload
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../hooks/useAuth';

// ── Shared small components (same as RegistrationRequestDetail) ──────────────
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

function displayEmailValue(email?: string | null) {
  if (!email || !email.trim()) return '-';
  const normalized = email.trim().toLowerCase();
  if (normalized.endsWith('@customer.local') || normalized.startsWith('no-email-')) return '-';
  return email;
}

function toDateInputValue(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

// Inline editable row — double-click to edit
function InlineEditRow({
  label,
  displayValue,
  isEditing,
  onDoubleClick,
  onCommit,
  onCancel,
  type = 'text',
  options,
}: {
  label: string;
  displayValue?: string | null;
  isEditing: boolean;
  onDoubleClick: () => void;
  onCommit: (val: string) => void;
  onCancel: () => void;
  type?: 'text' | 'select';
  options?: { value: string; label: string }[];
}) {
  const [draft, setDraft] = useState(displayValue || '');
  const inputRef = useRef<HTMLInputElement & HTMLSelectElement>(null);

  useEffect(() => {
    if (isEditing) {
      setDraft(displayValue || '');
      setTimeout(() => { inputRef.current?.focus(); (inputRef.current as HTMLInputElement)?.select?.(); }, 0);
    }
  }, [isEditing, displayValue]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); onCommit(draft); }
    if (e.key === 'Escape') { onCancel(); }
  };

  return (
    <div className="flex justify-between items-center gap-4 py-2.5 border-b border-slate-100 last:border-0 group min-h-[40px]">
      <span className="text-xs text-slate-400 uppercase tracking-wider flex-shrink-0 w-36">{label}</span>
      {isEditing ? (
        type === 'select' ? (
          <select
            ref={inputRef as any}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={() => onCommit(draft)}
            onKeyDown={handleKeyDown}
            className="text-sm px-2.5 py-1.5 border border-indigo-400 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500/20 outline-none max-w-[200px]"
            autoFocus
          >
            {options?.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
        ) : (
          <input
            ref={inputRef as any}
            type="text"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={() => onCommit(draft)}
            onKeyDown={handleKeyDown}
            className="text-sm px-2.5 py-1.5 border border-indigo-400 rounded-lg focus:ring-2 focus:ring-indigo-500/20 outline-none w-full max-w-[220px]"
          />
        )
      ) : (
        <span
          className="text-sm text-slate-800 text-right break-words min-w-0 font-medium flex items-center justify-end gap-1.5 cursor-pointer group-hover:text-indigo-600 transition-colors"
          onDoubleClick={onDoubleClick}
          title="Double-click to edit"
        >
          <span>{displayValue || '—'}</span>
          <PencilLine className="w-3 h-3 opacity-0 group-hover:opacity-40 flex-shrink-0 transition-opacity" />
        </span>
      )}
    </div>
  );
}

export default function AdminCustomerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isCoordinatorView = user?.role === 'SalesCoordinator';
  const customersBasePath = isCoordinatorView ? '/coordinator/customers' : '/admin/customers';

  // Assignment edit state
  const [editingAssignment, setEditingAssignment] = useState(false);
  const [selectedRegionId, setSelectedRegionId] = useState('');
  const [selectedSubRegionId, setSelectedSubRegionId] = useState('');
  const [selectedCoordinatorId, setSelectedCoordinatorId] = useState('');
  const [generatedTempPassword, setGeneratedTempPassword] = useState('');
  const [editingRegistration, setEditingRegistration] = useState(false);

  // Inline field editing state
  const [editingField, setEditingField] = useState<string | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<{
    field: string; label: string; oldValue: string; newValue: string; apiType: 'update' | 'reg' | 'password';
  } | null>(null);

  // Password input state (for Credentials section)
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [registrationFiles, setRegistrationFiles] = useState<{
    businessRegDoc?: File;
    businessAddressDoc?: File;
    vatDoc?: File;
  }>({});

  const [quickDocFiles, setQuickDocFiles] = useState<{
    businessRegDoc?: File;
    businessAddressDoc?: File;
    vatDoc?: File;
  }>({});
  const [registrationForm, setRegistrationForm] = useState({
    customerType: 'NonTax',
    customerName: '',
    businessRegistrationNumber: '',
    registeredAddress: '',
    incorporateDate: '',
    businessName: '',
    businessLocation: '',
    telephone: '',
    email: '',
    bankBranch: '',
    province: '',
    town: '',
    proprietorName: '',
    proprietorTp: '',
    proprietorEmail: '',
    managerName: '',
    managerTp: '',
    managerEmail: '',
    chefName: '',
    chefTp: '',
    chefEmail: '',
    purchasingName: '',
    purchasingTp: '',
    purchasingEmail: '',
    accountantName: '',
    accountantTp: '',
    accountantEmail: '',
    regionId: '',
    subRegionId: '',
    assignedCoordinatorId: '',
  });

  const { data: summary, isLoading } = useQuery({
    queryKey: [isCoordinatorView ? 'coordinator-customer-summary' : 'admin-customer-summary', id],
    queryFn: () => (isCoordinatorView ? customersApi.coordinatorGetSummary(id!) : customersApi.adminGetSummary(id!)).then(r => r.data.data),
    enabled: !!id,
  });

  const customer = summary?.customer;

  const syncRegistrationFormFromSummary = () => {
    if (!summary?.registrationRequest || !customer) return;

    const registration = summary.registrationRequest;
    setRegistrationForm({
      customerType: registration.customerType || 'NonTax',
      customerName: registration.customerName || '',
      businessRegistrationNumber: registration.businessRegistrationNumber || customer.businessRegistrationNumber || '',
      registeredAddress: registration.registeredAddress || '',
      incorporateDate: toDateInputValue(registration.incorporateDate),
      businessName: registration.businessName || '',
      businessLocation: registration.businessLocation || '',
      telephone: registration.telephone || customer.phoneNumber || '',
      email: registration.email || (displayEmailValue(customer.email) === '-' ? '' : customer.email || ''),
      bankBranch: registration.bankBranch || '',
      province: registration.province || '',
      town: registration.town || '',
      proprietorName: registration.proprietorName || '',
      proprietorTp: registration.proprietorTp || '',
      proprietorEmail: registration.proprietorEmail || '',
      managerName: registration.managerName || '',
      managerTp: registration.managerTp || '',
      managerEmail: registration.managerEmail || '',
      chefName: registration.chefName || '',
      chefTp: registration.chefTp || '',
      chefEmail: registration.chefEmail || '',
      purchasingName: registration.purchasingName || '',
      purchasingTp: registration.purchasingTp || '',
      purchasingEmail: registration.purchasingEmail || '',
      accountantName: registration.accountantName || '',
      accountantTp: registration.accountantTp || '',
      accountantEmail: registration.accountantEmail || '',
      regionId: customer.regionId || '',
      subRegionId: customer.subRegionId || '',
      assignedCoordinatorId: customer.assignedCoordinatorId || '',
    });
  };

  // Populate fields when customer loads
  useEffect(() => {
    if (customer) {
      setSelectedRegionId(customer.regionId || '');
      setSelectedSubRegionId(customer.subRegionId || '');
      setSelectedCoordinatorId(customer.assignedCoordinatorId || '');
    }
  }, [customer]);

  useEffect(() => {
    syncRegistrationFormFromSummary();
  }, [summary?.registrationRequest, customer]);

  // Fetch lookups for assignment editing
  const { data: regions } = useQuery({
    queryKey: ['regions-all'],
    queryFn: () => regionsApi.getAll().then((r: any) => r.data),
    enabled: editingAssignment || editingRegistration,
  });

  const { data: allCoordinators } = useQuery({
    queryKey: ['admin-all-coordinators'],
    queryFn: () => adminGetAllCoordinators(1, 200),
    enabled: editingAssignment || editingRegistration,
  });

  // Cascading filters
  const filteredSubRegions = useMemo(() => {
    if (!regions || !selectedRegionId) return [];
    const region = (regions as any[]).find((reg: any) => reg.id === selectedRegionId);
    return region?.subRegions || [];
  }, [regions, selectedRegionId]);

  const filteredCoordinators = useMemo(() => {
    if (!allCoordinators?.items) return [];
    if (!selectedRegionId) return allCoordinators.items;
    return allCoordinators.items.filter((c: any) => c.regionId === selectedRegionId);
  }, [allCoordinators, selectedRegionId]);

  const registrationSubRegions = useMemo(() => {
    if (!regions || !registrationForm.regionId) return [];
    const region = (regions as any[]).find((reg: any) => reg.id === registrationForm.regionId);
    return region?.subRegions || [];
  }, [regions, registrationForm.regionId]);

  const registrationCoordinators = useMemo(() => {
    if (!allCoordinators?.items) return [];
    if (!registrationForm.regionId) return allCoordinators.items;
    return allCoordinators.items.filter((c: any) => c.regionId === registrationForm.regionId);
  }, [allCoordinators, registrationForm.regionId]);

  const handleRegionChange = (regionId: string) => {
    setSelectedRegionId(regionId);
    setSelectedSubRegionId('');
    setSelectedCoordinatorId('');
  };

  const toggleStatusMut = useMutation({
    mutationFn: (isActive: boolean) => customersApi.adminToggleStatus(id!, isActive),
    onSuccess: (_, isActive) => {
      queryClient.invalidateQueries({ queryKey: ['admin-customer-summary', id] });
      queryClient.invalidateQueries({ queryKey: ['admin-customers'] });
      toast.success(`Customer ${isActive ? 'activated' : 'deactivated'} successfully`);
    },
    onError: () => toast.error('Failed to update customer status'),
  });

  const updateAssignmentMut = useMutation({
    mutationFn: (data: Record<string, unknown>) => customersApi.adminUpdate(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-customer-summary', id] });
      queryClient.invalidateQueries({ queryKey: ['admin-customers'] });
      toast.success('Assignment updated successfully');
      setEditingAssignment(false);
    },
    onError: () => toast.error('Failed to update assignment'),
  });

  const updateRegistrationMut = useMutation({
    mutationFn: (formData: FormData) => customersApi.adminUpdateRegistrationDetails(id!, formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-customer-summary', id] });
      queryClient.invalidateQueries({ queryKey: ['admin-customers'] });
      toast.success('Customer details updated successfully');
      setEditingRegistration(false);
      setRegistrationFiles({});
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Failed to update customer details');
    },
  });

  const uploadDocsMut = useMutation({
    mutationFn: (formData: FormData) => customersApi.adminUpdateRegistrationDetails(id!, formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-customer-summary', id] });
      queryClient.invalidateQueries({ queryKey: ['admin-customers'] });
      toast.success('Documents uploaded successfully');
      setQuickDocFiles({});
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Failed to upload documents');
    },
  });

  const resetTempPasswordMut = useMutation({
    mutationFn: () => {
      if (!customer?.userId) {
        throw new Error('Customer user id is missing');
      }
      return authApi.adminResetUserTempPassword(customer.userId);
    },
    onSuccess: (res: any) => {
      setGeneratedTempPassword(res.data.data.temporaryPassword);
      queryClient.invalidateQueries({ queryKey: ['admin-customer-summary', id] });
      toast.success('New password generated');
    },
    onError: () => toast.error('Failed to generate password'),
  });

  // Inline field update mutations
  const inlineUpdateMut = useMutation({
    mutationFn: (data: Record<string, unknown>) => customersApi.adminUpdate(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-customer-summary', id] });
      queryClient.invalidateQueries({ queryKey: ['admin-customers'] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to update field'),
  });

  const inlineRegUpdateMut = useMutation({
    mutationFn: (formData: FormData) => customersApi.adminUpdateRegistrationDetails(id!, formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-customer-summary', id] });
      queryClient.invalidateQueries({ queryKey: ['admin-customers'] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to update field'),
  });

  const setPasswordMut = useMutation({
    mutationFn: (password: string) => {
      if (!customer?.userId) throw new Error('Customer user id is missing');
      return authApi.adminSetUserPassword(customer.userId, password);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-customer-summary', id] });
      toast.success('Password updated successfully');
      setNewPasswordInput('');
      setShowNewPassword(false);
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to update password'),
  });

  const handleStartInlineEdit = (field: string, currentValue: string) => {
    setEditingField(field);
  };

  const handleInlineCommit = (field: string, label: string, oldValue: string, newValue: string, apiType: 'update' | 'reg' | 'password') => {
    const trimmed = newValue.trim();
    if (trimmed === oldValue.trim()) {
      // No change
      setEditingField(null);
      return;
    }
    setPendingConfirm({ field, label, oldValue, newValue: trimmed, apiType });
    setEditingField(null);
  };

  const handleConfirmSave = async () => {
    if (!pendingConfirm) return;
    const { field, label, newValue, apiType } = pendingConfirm;
    try {
      if (apiType === 'password') {
        await setPasswordMut.mutateAsync(newValue);
      } else if (apiType === 'reg') {
        const formData = new FormData();
        formData.append(field, newValue);
        await inlineRegUpdateMut.mutateAsync(formData);
      } else {
        await inlineUpdateMut.mutateAsync({ [field]: newValue || null });
      }
      toast.success(`${label} updated successfully`);
      setPendingConfirm(null);
    } catch {
      // Handled by mutation error handler
      setPendingConfirm(null);
    }
  };

  const handleSaveAssignment = () => {
    updateAssignmentMut.mutate({
      regionId: selectedRegionId || null,
      subRegionId: selectedSubRegionId || null,
      assignedCoordinatorId: selectedCoordinatorId || null,
    });
  };

  const updateRegistrationField = (field: string, value: string) => {
    setRegistrationForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSaveRegistration = () => {
    const formData = new FormData();
    formData.append('customerType', registrationForm.customerType);
    formData.append('customerName', registrationForm.customerName);
    formData.append('businessRegistrationNumber', registrationForm.businessRegistrationNumber);
    formData.append('registeredAddress', registrationForm.registeredAddress);
    formData.append('incorporateDate', registrationForm.incorporateDate);
    formData.append('businessName', registrationForm.businessName);
    formData.append('businessLocation', registrationForm.businessLocation);
    formData.append('telephone', registrationForm.telephone);
    formData.append('email', registrationForm.email);
    formData.append('bankBranch', registrationForm.bankBranch);
    formData.append('province', registrationForm.province);
    formData.append('town', registrationForm.town);
    formData.append('proprietorName', registrationForm.proprietorName);
    formData.append('proprietorTp', registrationForm.proprietorTp);
    formData.append('proprietorEmail', registrationForm.proprietorEmail);
    formData.append('managerName', registrationForm.managerName);
    formData.append('managerTp', registrationForm.managerTp);
    formData.append('managerEmail', registrationForm.managerEmail);
    formData.append('chefName', registrationForm.chefName);
    formData.append('chefTp', registrationForm.chefTp);
    formData.append('chefEmail', registrationForm.chefEmail);
    formData.append('purchasingName', registrationForm.purchasingName);
    formData.append('purchasingTp', registrationForm.purchasingTp);
    formData.append('purchasingEmail', registrationForm.purchasingEmail);
    formData.append('accountantName', registrationForm.accountantName);
    formData.append('accountantTp', registrationForm.accountantTp);
    formData.append('accountantEmail', registrationForm.accountantEmail);
    formData.append('regionId', registrationForm.regionId);
    formData.append('subRegionId', registrationForm.subRegionId);
    formData.append('assignedCoordinatorId', registrationForm.assignedCoordinatorId);

    if (registrationFiles.businessRegDoc) formData.append('businessRegDoc', registrationFiles.businessRegDoc);
    if (registrationFiles.businessAddressDoc) formData.append('businessAddressDoc', registrationFiles.businessAddressDoc);
    if (registrationFiles.vatDoc) formData.append('vatDoc', registrationFiles.vatDoc);

    updateRegistrationMut.mutate(formData);
  };

  const resetRegistrationEditor = () => {
    setEditingRegistration(false);
    setRegistrationFiles({});
    syncRegistrationFormFromSummary();
  };

  const handleQuickUploadDocs = () => {
    if (!quickDocFiles.businessRegDoc && !quickDocFiles.businessAddressDoc && !quickDocFiles.vatDoc) {
      toast.error('Please select at least one document to upload');
      return;
    }
    const formData = new FormData();
    if (quickDocFiles.businessRegDoc) formData.append('businessRegDoc', quickDocFiles.businessRegDoc);
    if (quickDocFiles.businessAddressDoc) formData.append('businessAddressDoc', quickDocFiles.businessAddressDoc);
    if (quickDocFiles.vatDoc) formData.append('vatDoc', quickDocFiles.vatDoc);
    uploadDocsMut.mutate(formData);
  };
  const visibleTempPassword = generatedTempPassword || customer?.temporaryPassword || '';

  if (isLoading) {
    return (
      <div className="animate-fade-in space-y-4">
        <div className="h-8 w-48 bg-slate-200 rounded-lg animate-pulse" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-48 bg-slate-100 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="text-center py-16">
        <p className="text-slate-500">Customer not found</p>
        <button onClick={() => navigate('/admin/customers')} className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm">
          Back to Customers
        </button>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-5 pb-20">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-start gap-4">
        <button
          onClick={() => navigate(customersBasePath)}
          className="p-2 hover:bg-slate-100 rounded-lg transition mt-0.5"
        >
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl lg:text-2xl font-bold text-slate-900 truncate">{customer.shopName}</h1>
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${customer.isActive
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-slate-100 text-slate-500 border border-slate-200'
              }`}>
              {customer.isActive ? 'Active' : 'Inactive'}
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Joined {customer.createdAt ? formatDate(customer.createdAt) : '—'} &nbsp;·&nbsp; Customer Details
          </p>
        </div>
        {!isCoordinatorView ? (
          <>
            <button
              onClick={async (e) => {
                const btn = e.currentTarget;
                btn.disabled = true;
                const orig = btn.innerHTML;
                btn.innerHTML = '<svg class="w-4 h-4 animate-spin inline-block" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>&nbsp;Exporting…';
                try { await handleCustomerExport(summary); }
                catch { alert('Export failed. Please try again.'); }
                finally { btn.innerHTML = orig; btn.disabled = false; }
              }}
              className="hidden lg:inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition disabled:opacity-60"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
              Export ZIP
            </button>

            <button
              onClick={() => navigate(`/admin/customers/${id}/special-prices`)}
              className="hidden lg:inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition"
            >
              <DollarSign className="w-5 h-5" />
              Special Prices
            </button>

            <button
              onClick={() => toggleStatusMut.mutate(!customer.isActive)}
              disabled={toggleStatusMut.isPending}
              className={`hidden lg:inline-flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm transition ${customer.isActive
                  ? 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200'
                  : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                }`}
            >
              {customer.isActive ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
              {customer.isActive ? 'Deactivate' : 'Activate'}
            </button>
          </>
        ) : (
          <button
            onClick={() => navigate(`/coordinator/customers/${id}/special-prices`)}
            className="hidden lg:inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition"
          >
            <DollarSign className="w-5 h-5" />
            Special Prices
          </button>
        )}
      </div>

      {/* ── Content grid ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Left column (2/3) */}
        <div className="lg:col-span-2 space-y-5">

          {/* General Information */}
          <Section title="General Information" icon={<Building2 className="w-4 h-4" />}>
            {!isCoordinatorView ? (
              <>
                <InlineEditRow
                  label="Shop Name"
                  displayValue={customer.shopName}
                  isEditing={editingField === 'shopName'}
                  onDoubleClick={() => handleStartInlineEdit('shopName', customer.shopName || '')}
                  onCommit={(v) => handleInlineCommit('shopName', 'Shop Name', customer.shopName || '', v, 'update')}
                  onCancel={() => setEditingField(null)}
                />
                <InlineEditRow
                  label="Business Reg #"
                  displayValue={customer.businessRegistrationNumber}
                  isEditing={editingField === 'businessRegistrationNumber'}
                  onDoubleClick={() => handleStartInlineEdit('businessRegistrationNumber', customer.businessRegistrationNumber || '')}
                  onCommit={(v) => handleInlineCommit('businessRegistrationNumber', 'Business Registration #', customer.businessRegistrationNumber || '', v, 'reg')}
                  onCancel={() => setEditingField(null)}
                />
                <InlineEditRow
                  label="Email"
                  displayValue={displayEmailValue(customer.email) === '-' ? '' : displayEmailValue(customer.email)}
                  isEditing={editingField === 'email'}
                  onDoubleClick={() => handleStartInlineEdit('email', displayEmailValue(customer.email) === '-' ? '' : customer.email || '')}
                  onCommit={(v) => handleInlineCommit('email', 'Email', displayEmailValue(customer.email) === '-' ? '' : customer.email || '', v, 'reg')}
                  onCancel={() => setEditingField(null)}
                />
                <InlineEditRow
                  label="Phone"
                  displayValue={customer.phoneNumber}
                  isEditing={editingField === 'phoneNumber'}
                  onDoubleClick={() => handleStartInlineEdit('phoneNumber', customer.phoneNumber || '')}
                  onCommit={(v) => handleInlineCommit('phoneNumber', 'Phone Number', customer.phoneNumber || '', v, 'update')}
                  onCancel={() => setEditingField(null)}
                />
                <InlineEditRow
                  label="Street"
                  displayValue={customer.street}
                  isEditing={editingField === 'street'}
                  onDoubleClick={() => handleStartInlineEdit('street', customer.street || '')}
                  onCommit={(v) => handleInlineCommit('street', 'Street', customer.street || '', v, 'update')}
                  onCancel={() => setEditingField(null)}
                />
                <InlineEditRow
                  label="City"
                  displayValue={customer.city}
                  isEditing={editingField === 'city'}
                  onDoubleClick={() => handleStartInlineEdit('city', customer.city || '')}
                  onCommit={(v) => handleInlineCommit('city', 'City', customer.city || '', v, 'update')}
                  onCancel={() => setEditingField(null)}
                />
                <InlineEditRow
                  label="State / Province"
                  displayValue={customer.state}
                  isEditing={editingField === 'state'}
                  onDoubleClick={() => handleStartInlineEdit('state', customer.state || '')}
                  onCommit={(v) => handleInlineCommit('state', 'State / Province', customer.state || '', v, 'update')}
                  onCancel={() => setEditingField(null)}
                />
                <p className="text-[10px] text-slate-400 mt-2 italic">Double-click any value to edit inline</p>
              </>
            ) : (
              <>
                <InfoRow label="Business Reg #" value={customer.businessRegistrationNumber} />
                <InfoRow label="Email" value={displayEmailValue(customer.email)} />
                <InfoRow label="Phone" value={customer.phoneNumber} />
                <InfoRow label="Street" value={customer.street} />
                <InfoRow label="City" value={customer.city} />
                <InfoRow label="State / Province" value={customer.state} />
              </>
            )}
          </Section>

          {!isCoordinatorView && (
            <Section title="Credentials" icon={<KeyRound className="w-4 h-4" />}>
              <div className="flex flex-col gap-1">
                
                {/* Username Row — double-click to edit */}
                <InlineEditRow
                  label="Username"
                  displayValue={customer.businessRegistrationNumber || customer.username}
                  isEditing={editingField === 'credUsername'}
                  onDoubleClick={() => handleStartInlineEdit('credUsername', customer.businessRegistrationNumber || customer.username || '')}
                  onCommit={(v) => handleInlineCommit('businessRegistrationNumber', 'Username', customer.businessRegistrationNumber || customer.username || '', v, 'reg')}
                  onCancel={() => setEditingField(null)}
                />

                {/* Current password display */}
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 py-2.5 border-b border-slate-100">
                  <span className="text-xs text-slate-400 uppercase tracking-wider flex-shrink-0 w-36">Current Password</span>
                  <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/60 px-3 py-1.5 rounded-lg w-fit">
                    <span className="text-sm text-slate-700 font-medium select-all">
                      {visibleTempPassword || '-'}
                    </span>
                    {visibleTempPassword && (
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(visibleTempPassword);
                          toast.success('Password copied!');
                        }}
                        className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors ml-1"
                        title="Copy Password"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Set New Password Row */}
                <div className="pt-2 mt-1">
                  <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-2">Set New Password</p>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1 max-w-xs">
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        value={newPasswordInput}
                        onChange={e => setNewPasswordInput(e.target.value)}
                        placeholder="Enter new password…"
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/15 focus:border-indigo-400 outline-none pr-9"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && newPasswordInput.trim()) {
                            setPendingConfirm({ field: 'password', label: 'Password', oldValue: '(current password)', newValue: newPasswordInput.trim(), apiType: 'password' });
                            setNewPasswordInput('');
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(p => !p)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showNewPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    <button
                      onClick={() => {
                        if (!newPasswordInput.trim()) return;
                        setPendingConfirm({ field: 'password', label: 'Password', oldValue: '(current password)', newValue: newPasswordInput.trim(), apiType: 'password' });
                        setNewPasswordInput('');
                      }}
                      disabled={!newPasswordInput.trim() || setPasswordMut.isPending}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 transition"
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                      {setPasswordMut.isPending ? 'Saving…' : 'Set Password'}
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1.5">Admin sets the password directly. Customer will use this on next login.</p>
                </div>
                
              </div>
            </Section>
          )}

          {/* Current Assignment */}
          <Section title="Current Assignment" icon={<UserCheck className="w-4 h-4" />}>
            <InfoRow label="Region" value={customer.regionName || '—'} />
            <InfoRow label="Sub-Region" value={customer.subRegionName || '—'} />
            <InfoRow label="Coordinator" value={customer.assignedCoordinatorName || '—'} />
          </Section>

          {/* Registration and professional details from submitted customer form */}
          <Section title="Registration & Professional Details" icon={<FileTextIcon className="w-4 h-4" />}>
            {!summary.registrationRequest && (
              <p className="text-sm text-slate-500">No registration form details found for this customer yet.</p>
            )}

            {summary.registrationRequest && !editingRegistration && (
              <>
                <InfoRow label="Customer Type" value={summary.registrationRequest.customerType} />
                <InfoRow label="Owner Name" value={summary.registrationRequest.customerName} />
                <InfoRow label="Business Reg #" value={summary.registrationRequest.businessRegistrationNumber || customer.businessRegistrationNumber} />
                <InfoRow label="Incorporate Date" value={summary.registrationRequest.incorporateDate ? formatDate(summary.registrationRequest.incorporateDate) : undefined} />
                <InfoRow label="Registered Address" value={summary.registrationRequest.registeredAddress} />
                <InfoRow label="Business Name" value={summary.registrationRequest.businessName} />
                <InfoRow label="Business Location" value={summary.registrationRequest.businessLocation} />
                <InfoRow label="Telephone" value={summary.registrationRequest.telephone} />
                <InfoRow label="Email" value={displayEmailValue(summary.registrationRequest.email)} />
                <InfoRow label="Bank Branch" value={summary.registrationRequest.bankBranch} />
                <InfoRow label="Province" value={summary.registrationRequest.province} />
                <InfoRow label="Town" value={summary.registrationRequest.town} />

                <div className="pt-2 mt-1 border-t border-slate-100">
                  <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">Professional Contacts</p>
                </div>
                {(summary.registrationRequest.proprietorName || summary.registrationRequest.proprietorTp || summary.registrationRequest.proprietorEmail) && (
                  <InfoRow
                    label="Proprietor"
                    value={[
                      summary.registrationRequest.proprietorName,
                      summary.registrationRequest.proprietorTp,
                      summary.registrationRequest.proprietorEmail,
                    ].filter(Boolean).join(' — ')}
                  />
                )}
                {(summary.registrationRequest.managerName || summary.registrationRequest.managerTp || summary.registrationRequest.managerEmail) && (
                  <InfoRow
                    label="Manager"
                    value={[
                      summary.registrationRequest.managerName,
                      summary.registrationRequest.managerTp,
                      summary.registrationRequest.managerEmail,
                    ].filter(Boolean).join(' — ')}
                  />
                )}
                {(summary.registrationRequest.chefName || summary.registrationRequest.chefTp || summary.registrationRequest.chefEmail) && (
                  <InfoRow
                    label="Chef"
                    value={[
                      summary.registrationRequest.chefName,
                      summary.registrationRequest.chefTp,
                      summary.registrationRequest.chefEmail,
                    ].filter(Boolean).join(' — ')}
                  />
                )}
                {(summary.registrationRequest.purchasingName || summary.registrationRequest.purchasingTp || summary.registrationRequest.purchasingEmail) && (
                  <InfoRow
                    label="Purchasing Officer"
                    value={[
                      summary.registrationRequest.purchasingName,
                      summary.registrationRequest.purchasingTp,
                      summary.registrationRequest.purchasingEmail,
                    ].filter(Boolean).join(' — ')}
                  />
                )}
                {(summary.registrationRequest.accountantName || summary.registrationRequest.accountantTp || summary.registrationRequest.accountantEmail) && (
                  <InfoRow
                    label="Accountant"
                    value={[
                      summary.registrationRequest.accountantName,
                      summary.registrationRequest.accountantTp,
                      summary.registrationRequest.accountantEmail,
                    ].filter(Boolean).join(' — ')}
                  />
                )}

                {(summary.registrationRequest.businessRegDocPath || summary.registrationRequest.businessAddressDocPath || summary.registrationRequest.vatDocPath) && (
                  <div className="mt-3 pt-3 border-t border-slate-100">
                    <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">Submitted Documents</p>
                    <div className="flex flex-wrap gap-2">
                      {summary.registrationRequest.businessRegDocPath && (
                        <button type="button" onClick={() => openPrivateFile(summary.registrationRequest!.businessRegDocPath!)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-medium border border-indigo-200 hover:bg-indigo-100 transition">
                          <FileTextIcon className="w-3.5 h-3.5" /> Business Reg Doc
                        </button>
                      )}
                      {summary.registrationRequest.businessAddressDocPath && (
                        <button type="button" onClick={() => openPrivateFile(summary.registrationRequest!.businessAddressDocPath!)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-medium border border-indigo-200 hover:bg-indigo-100 transition">
                          <FileTextIcon className="w-3.5 h-3.5" /> Business Address Doc
                        </button>
                      )}
                      {summary.registrationRequest.vatDocPath && (
                        <button type="button" onClick={() => openPrivateFile(summary.registrationRequest!.vatDocPath!)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-medium border border-indigo-200 hover:bg-indigo-100 transition">
                          <FileTextIcon className="w-3.5 h-3.5" /> VAT Doc
                        </button>
                      )}
                     
                      
                    </div>
                  </div>
                )}

                {!isCoordinatorView && (
                  <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end">
                    <button
                      onClick={() => setEditingRegistration(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700"
                    >
                      <PencilLine className="w-3.5 h-3.5" /> Edit All Details
                    </button>
                  </div>
                )}
              </>
            )}

            {/* ── Admin: Quick Document Upload (always visible, outside edit mode) ─── */}
            {!isCoordinatorView && !editingRegistration && (
              <div className="mt-4 pt-4 border-t border-slate-100">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Upload className="w-3.5 h-3.5" /> Upload / Replace Documents
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { key: 'businessRegDoc' as const, label: 'Business Reg Doc', currentPath: summary.registrationRequest?.businessRegDocPath },
                    { key: 'businessAddressDoc' as const, label: 'Business Address Doc', currentPath: summary.registrationRequest?.businessAddressDocPath },
                    ...(summary.registrationRequest?.customerType !== 'NonTax'
                      ? [{ key: 'vatDoc' as const, label: 'VAT Doc', currentPath: summary.registrationRequest?.vatDocPath }]
                      : []),
                  ].map(({ key, label, currentPath }) => (
                    <div key={key} className="rounded-xl border-2 border-dashed border-slate-200 hover:border-indigo-300 p-3 transition-colors">
                      <p className="text-xs font-semibold text-slate-600 mb-1.5">{label}</p>
                      {currentPath && (
                        <a
                          href={currentPath}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[10px] text-indigo-600 hover:underline mb-1.5"
                        >
                          <FileTextIcon className="w-3 h-3" /> View current
                        </a>
                      )}
                      {!currentPath && (
                        <p className="text-[10px] text-slate-400 mb-1.5">No document uploaded yet</p>
                      )}
                      <label className="flex items-center gap-1.5 cursor-pointer group">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 group-hover:bg-indigo-50 group-hover:text-indigo-700 text-xs font-medium text-slate-600 transition-colors border border-slate-200">
                          <Upload className="w-3 h-3" />
                          {quickDocFiles[key] ? quickDocFiles[key]!.name : (currentPath ? 'Replace' : 'Choose file')}
                        </span>
                        <input
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png"
                          className="hidden"
                          onChange={e => setQuickDocFiles(prev => ({ ...prev, [key]: e.target.files?.[0] }))}
                        />
                      </label>
                    </div>
                  ))}
                </div>
                <div className="flex justify-end mt-3">
                  <button
                    onClick={handleQuickUploadDocs}
                    disabled={uploadDocsMut.isPending || (!quickDocFiles.businessRegDoc && !quickDocFiles.businessAddressDoc && !quickDocFiles.vatDoc)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 disabled:opacity-40 transition"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    {uploadDocsMut.isPending ? 'Uploading…' : 'Upload Documents'}
                  </button>
                </div>
              </div>
            )}

            {summary.registrationRequest && editingRegistration && !isCoordinatorView && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Customer Type</label>
                    <select
                      value={registrationForm.customerType}
                      onChange={e => updateRegistrationField('customerType', e.target.value)}
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white"
                    >
                      <option value="NonTax">NonTax</option>
                      <option value="Tax">Tax</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Customer Name</label>
                    <input value={registrationForm.customerName} onChange={e => updateRegistrationField('customerName', e.target.value)} className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Business Reg Number</label>
                    <input value={registrationForm.businessRegistrationNumber} onChange={e => updateRegistrationField('businessRegistrationNumber', e.target.value)} className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Incorporate Date</label>
                    <input type="date" value={registrationForm.incorporateDate} onChange={e => updateRegistrationField('incorporateDate', e.target.value)} className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Registered Address</label>
                    <textarea value={registrationForm.registeredAddress} onChange={e => updateRegistrationField('registeredAddress', e.target.value)} rows={2} className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Business Location</label>
                    <textarea value={registrationForm.businessLocation} onChange={e => updateRegistrationField('businessLocation', e.target.value)} rows={2} className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Business Name</label>
                    <input value={registrationForm.businessName} onChange={e => updateRegistrationField('businessName', e.target.value)} className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Telephone</label>
                    <input value={registrationForm.telephone} onChange={e => updateRegistrationField('telephone', e.target.value)} className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Email</label>
                    <input value={registrationForm.email} onChange={e => updateRegistrationField('email', e.target.value)} className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm" placeholder="Leave empty to show -" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Bank Branch</label>
                    <input value={registrationForm.bankBranch} onChange={e => updateRegistrationField('bankBranch', e.target.value)} className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Province</label>
                    <input value={registrationForm.province} onChange={e => updateRegistrationField('province', e.target.value)} className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Town</label>
                    <input value={registrationForm.town} onChange={e => updateRegistrationField('town', e.target.value)} className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm" />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Region</label>
                    <select
                      value={registrationForm.regionId}
                      onChange={e => {
                        updateRegistrationField('regionId', e.target.value);
                        updateRegistrationField('subRegionId', '');
                        updateRegistrationField('assignedCoordinatorId', '');
                      }}
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white"
                    >
                      <option value="">Select region...</option>
                      {(regions || []).map((reg: any) => (
                        <option key={reg.id} value={reg.id}>{reg.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Sub Region</label>
                    <select
                      value={registrationForm.subRegionId}
                      onChange={e => updateRegistrationField('subRegionId', e.target.value)}
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white"
                    >
                      <option value="">Select sub region...</option>
                      {registrationSubRegions.map((sr: any) => (
                        <option key={sr.id} value={sr.id}>{sr.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Coordinator</label>
                    <select
                      value={registrationForm.assignedCoordinatorId}
                      onChange={e => updateRegistrationField('assignedCoordinatorId', e.target.value)}
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white"
                    >
                      <option value="">Select coordinator...</option>
                      {registrationCoordinators.map((coordinator: any) => (
                        <option key={coordinator.id} value={coordinator.id}>{coordinator.fullName}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100">
                  <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Professional Contacts</p>
                  <div className="space-y-3">
                    {[
                      { title: 'Proprietor', nameKey: 'proprietorName', tpKey: 'proprietorTp', emailKey: 'proprietorEmail' },
                      { title: 'Manager', nameKey: 'managerName', tpKey: 'managerTp', emailKey: 'managerEmail' },
                      { title: 'Chef', nameKey: 'chefName', tpKey: 'chefTp', emailKey: 'chefEmail' },
                      { title: 'Purchasing Officer', nameKey: 'purchasingName', tpKey: 'purchasingTp', emailKey: 'purchasingEmail' },
                      { title: 'Accountant', nameKey: 'accountantName', tpKey: 'accountantTp', emailKey: 'accountantEmail' },
                    ].map(cfg => (
                      <div key={cfg.title} className="grid grid-cols-1 md:grid-cols-4 gap-2 rounded-lg border border-slate-200 p-3">
                        <div className="md:col-span-1 text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center">{cfg.title}</div>
                        <input
                          value={(registrationForm as any)[cfg.nameKey]}
                          onChange={e => updateRegistrationField(cfg.nameKey, e.target.value)}
                          placeholder="Name"
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                        />
                        <input
                          value={(registrationForm as any)[cfg.tpKey]}
                          onChange={e => updateRegistrationField(cfg.tpKey, e.target.value)}
                          placeholder="Telephone"
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                        />
                        <input
                          value={(registrationForm as any)[cfg.emailKey]}
                          onChange={e => updateRegistrationField(cfg.emailKey, e.target.value)}
                          placeholder="Email"
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100">
                  <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Documents</p>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {summary.registrationRequest.businessRegDocPath && (
                      <button type="button" onClick={() => openPrivateFile(summary.registrationRequest!.businessRegDocPath!)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-medium border border-indigo-200 hover:bg-indigo-100 transition">
                        <FileTextIcon className="w-3.5 h-3.5" /> Current Business Reg Doc
                      </button>
                    )}
                    {summary.registrationRequest.businessAddressDocPath && (
                      <button type="button" onClick={() => openPrivateFile(summary.registrationRequest!.businessAddressDocPath!)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-medium border border-indigo-200 hover:bg-indigo-100 transition">
                        <FileTextIcon className="w-3.5 h-3.5" /> Current Address Doc
                      </button>
                    )}
                    {summary.registrationRequest.vatDocPath && registrationForm.customerType !== 'NonTax' && (
                      <button type="button" onClick={() => openPrivateFile(summary.registrationRequest!.vatDocPath!)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-medium border border-indigo-200 hover:bg-indigo-100 transition">
                        <FileTextIcon className="w-3.5 h-3.5" /> Current VAT Doc
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Replace Business Reg Doc</label>
                      <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={e => setRegistrationFiles(prev => ({ ...prev, businessRegDoc: e.target.files?.[0] }))} className="w-full text-xs" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Replace Address Doc</label>
                      <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={e => setRegistrationFiles(prev => ({ ...prev, businessAddressDoc: e.target.files?.[0] }))} className="w-full text-xs" />
                    </div>
                    {registrationForm.customerType !== 'NonTax' && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Replace VAT Doc</label>
                      <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={e => setRegistrationFiles(prev => ({ ...prev, vatDoc: e.target.files?.[0] }))} className="w-full text-xs" />
                    </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    onClick={resetRegistrationEditor}
                    className="px-3 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveRegistration}
                    disabled={updateRegistrationMut.isPending}
                    className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {updateRegistrationMut.isPending ? 'Saving...' : 'Save Details'}
                  </button>
                </div>
              </div>
            )}
          </Section>

          {/* Order Statistics */}
          <Section title="Order Statistics" icon={<TrendingUp className="w-4 h-4" />}>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="p-4 bg-gradient-to-br from-indigo-50 to-violet-50 rounded-xl">
                <div className="flex items-center gap-2 mb-2">
                  <ShoppingBag className="w-4 h-4 text-indigo-600" />
                  <span className="text-xs text-indigo-600 font-medium uppercase">Total Orders</span>
                </div>
                <p className="text-2xl font-bold text-indigo-900">{summary.totalOrders}</p>
              </div>
              <div className="p-4 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs text-emerald-600 font-medium uppercase">Total Purchases</span>
                </div>
                <p className="text-2xl font-bold text-emerald-900">{formatCurrency(summary.totalPurchases)}</p>
              </div>
              {summary.lastOrderDate && (
                <div className="p-4 bg-gradient-to-br from-orange-50 to-rose-50 rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="w-4 h-4 text-orange-600" />
                    <span className="text-xs text-orange-600 font-medium uppercase">Last Order</span>
                  </div>
                  <p className="text-sm font-bold text-orange-900">{formatDate(summary.lastOrderDate)}</p>
                </div>
              )}
            </div>
            {summary.frequentProducts?.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Frequent Products</p>
                <div className="flex flex-wrap gap-2">
                  {summary.frequentProducts.map((p: string, i: number) => (
                    <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                      <Package className="w-3 h-3" /> {p}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </Section>
        </div>

        {/* Right column (1/3) */}
        <div className="space-y-5">

          {/* Status Card */}
          <div className={`rounded-xl p-5 border ${customer.isActive ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
            <p className={`font-bold text-sm mb-1 flex items-center gap-2 ${customer.isActive ? 'text-emerald-700' : 'text-slate-600'}`}>
              {customer.isActive ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
              {customer.isActive ? 'Active Customer' : 'Inactive Customer'}
            </p>
            <p className="text-xs text-slate-400 mb-3">
              Joined {customer.createdAt ? formatDate(customer.createdAt) : '—'}
            </p>

            {/* Mobile toggle */}
            {!isCoordinatorView ? (
              <>
                <button
                  onClick={() => toggleStatusMut.mutate(!customer.isActive)}
                  disabled={toggleStatusMut.isPending}
                  className={`lg:hidden w-full mt-1 py-2.5 rounded-xl text-sm font-semibold transition ${customer.isActive
                      ? 'bg-red-600 hover:bg-red-700 text-white'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    }`}
                >
                  {customer.isActive ? 'Deactivate' : 'Activate'}
                </button>

                <button
                  onClick={() => navigate(`/admin/customers/${id}/special-prices`)}
                  className="lg:hidden w-full mt-2 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold"
                >
                  <DollarSign className="w-4 h-4 inline mr-2" />
                  Special Prices
                </button>

                <button
                  onClick={async (e) => {
                    const btn = e.currentTarget;
                    btn.disabled = true;
                    try { await handleCustomerExport(summary); }
                    catch { alert('Export failed. Please try again.'); }
                    finally { btn.disabled = false; }
                  }}
                  className="lg:hidden w-full mt-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold disabled:opacity-60"
                >
                  <svg className="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                  Export ZIP
                </button>
              </>
            ) : (
              <button
                onClick={() => navigate(`/coordinator/customers/${id}/special-prices`)}
                className="lg:hidden w-full mt-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold"
              >
                <DollarSign className="w-4 h-4 inline mr-2" />
                Special Prices
              </button>
            )}
          </div>

          {/* Change Assignment Panel */}
          {!isCoordinatorView && (
            <Section title="Change Assignment" icon={<UserCheck className="w-4 h-4" />}>
              {!editingAssignment ? (
                <button
                  onClick={() => setEditingAssignment(true)}
                  className="w-full py-3 rounded-xl border-2 border-slate-200 text-sm font-semibold text-slate-600 hover:border-indigo-300 hover:bg-indigo-50/50 transition-all"
                >
                  Edit Region / Coordinator
                </button>
              ) : (
                <div className="space-y-3">
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

                  {/* Sub-Region */}
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
                  </div>

                  {/* Coordinator */}
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

                  {/* Action buttons */}
                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={() => setEditingAssignment(false)}
                      className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveAssignment}
                      disabled={updateAssignmentMut.isPending}
                      className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold transition disabled:opacity-40"
                    >
                      {updateAssignmentMut.isPending ? 'Saving…' : 'Save Changes'}
                    </button>
                  </div>
                </div>
              )}
            </Section>
          )}
        </div>
      </div>

      {/* ── Inline Edit Confirmation Modal ──────────────────────────────── */}
      {pendingConfirm && createPortal(
        <div className="fixed inset-0 z-50 flex flex-col items-center" style={{ pointerEvents: 'auto' }}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => setPendingConfirm(null)} />
          <div
            className="relative mt-16 w-full max-w-sm mx-4 bg-white rounded-2xl shadow-2xl border border-slate-200"
            style={{ animation: 'slideDown 0.25s ease-out both' }}
          >
            <div className="flex items-start gap-4 p-6 pb-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                <PencilLine className="w-5 h-5 text-indigo-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-semibold text-slate-900">Update {pendingConfirm.label}?</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Confirm this change for <span className="font-semibold text-slate-700">{customer.shopName}</span>
                </p>
              </div>
            </div>

            <div className="mx-6 rounded-xl bg-slate-50 border border-slate-200 p-3.5 mb-5 space-y-2">
              <div className="flex items-start gap-2 text-sm">
                <span className="text-slate-400 w-14 shrink-0 font-medium">From:</span>
                <span className="font-medium text-slate-500 line-through break-words min-w-0">{pendingConfirm.oldValue || '(empty)'}</span>
              </div>
              <div className="h-px bg-slate-200" />
              <div className="flex items-start gap-2 text-sm">
                <span className="text-slate-400 w-14 shrink-0 font-medium">To:</span>
                <span className="font-bold text-slate-900 break-words min-w-0">{pendingConfirm.apiType === 'password' ? '••••••••' : pendingConfirm.newValue}</span>
              </div>
            </div>

            <div className="flex justify-end gap-3 px-6 pb-5">
              <button
                onClick={() => setPendingConfirm(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmSave}
                disabled={inlineUpdateMut.isPending || inlineRegUpdateMut.isPending || setPasswordMut.isPending}
                className="px-5 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition flex items-center gap-1.5"
              >
                {(inlineUpdateMut.isPending || inlineRegUpdateMut.isPending || setPasswordMut.isPending)
                  ? 'Saving…'
                  : <><Check className="w-4 h-4" /> Save</>
                }
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
