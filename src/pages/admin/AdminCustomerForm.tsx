// @ts-nocheck
import { useState, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customerRegistrationApi } from '../../services/api/customerRegistrationApi';
import { regionsApi } from '../../services/api/regionsApi';
import { customersApi } from '../../services/api/customersApi';
import toast from 'react-hot-toast';
import { ChevronLeft, ChevronRight, Check, Upload, X, Users, MapPin, FileText, ClipboardCheck, Building2 } from 'lucide-react';

// ── Styles ────────────────────────────────────────────────────────────────────
const INPUT = 'w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 bg-white outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/15 transition placeholder-slate-400';
const LABEL = 'block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide';
const SECTION = 'bg-slate-50/60 border border-slate-200/80 rounded-2xl p-5';

const STEPS = [
  { label: 'General', icon: Building2 },
  { label: 'Contacts', icon: Users },
  { label: 'Documents', icon: FileText },
  { label: 'Assignment', icon: MapPin },
  { label: 'Review', icon: ClipboardCheck },
];

const CONTACTS = [
  { role: 'Proprietor / Owner', prefix: 'proprietor' },
  { role: 'Manager', prefix: 'manager' },
  { role: 'Chef', prefix: 'chef' },
  { role: 'Purchasing Officer', prefix: 'purchasing' },
  { role: 'Accountant', prefix: 'accountant' },
];

// ── Shared components ─────────────────────────────────────────────────────────
function Field({ label, name, value, onChange, type = 'text', required = false, placeholder }) {
  return (
    <div>
      <label className={LABEL}>{label}{required && <span className="text-red-400 ml-0.5">*</span>}</label>
      <input type={type} name={name} value={value} onChange={onChange}
        placeholder={placeholder || `Enter ${label.toLowerCase()}`} required={required} className={INPUT} />
    </div>
  );
}

function SelectField({ label, name, value, onChange, children, disabled }) {
  return (
    <div>
      <label className={LABEL}>{label}</label>
      <select name={name} value={value} onChange={onChange} disabled={disabled}
        className={`${INPUT} cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed`}>
        {children}
      </select>
    </div>
  );
}

function FileUpload({ label, name, onChange, required = false }) {
  const ref = useRef(null);
  const [file, setFile] = useState(null);
  const [drag, setDrag] = useState(false);

  const handle = (f) => { setFile(f); onChange(name, f); };
  const clear = (e) => {
    e.stopPropagation();
    setFile(null);
    onChange(name, null);
    if (ref.current) ref.current.value = '';
  };

  return (
    <div>
      <label className={LABEL}>{label}{required && <span className="text-red-400 ml-0.5">*</span>}</label>
      <div
        onClick={() => ref.current?.click()}
        onDragOver={e => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={e => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) handle(f); }}
        className={`relative flex items-center gap-3 px-4 py-3.5 rounded-xl border-2 border-dashed cursor-pointer transition-all
          ${drag ? 'border-indigo-400 bg-indigo-50/60' : file ? 'border-indigo-300 bg-indigo-50/40' : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50'}`}
      >
        <Upload className={`w-5 h-5 flex-shrink-0 ${file ? 'text-indigo-500' : 'text-slate-400'}`} />
        <div className="flex-1 min-w-0">
          {file ? (
            <p className="text-sm font-medium text-indigo-700 truncate">{file.name}</p>
          ) : (
            <p className="text-sm text-slate-500"><span className="text-indigo-600 font-medium">Click to upload</span> or drag &amp; drop</p>
          )}
          <p className="text-xs text-slate-400 mt-0.5">PDF, JPG, PNG — max 10 MB</p>
        </div>
        {file && (
          <button onClick={clear} className="p-1 rounded-lg hover:bg-red-100 transition text-slate-400 hover:text-red-500">
            <X className="w-4 h-4" />
          </button>
        )}
        <input ref={ref} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handle(f); }} />
      </div>
    </div>
  );
}

function StepIndicator({ current }) {
  return (
    <div className="flex items-center justify-center mb-8 overflow-x-auto pb-1">
      {STEPS.map(({ label, icon: Icon }, i) => (
        <div key={i} className="flex items-center flex-shrink-0">
          <div className="flex flex-col items-center">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-all
              ${i < current ? 'bg-indigo-600 text-white' : i === current ? 'bg-indigo-600 text-white ring-4 ring-indigo-100' : 'bg-slate-100 text-slate-400'}`}>
              {i < current ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
            </div>
            <span className={`text-[10px] mt-1.5 font-semibold transition-all whitespace-nowrap
              ${i === current ? 'text-indigo-600' : i < current ? 'text-indigo-400' : 'text-slate-400'}`}>
              {label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={`w-6 sm:w-10 h-0.5 mb-4 mx-1 transition-all ${i < current ? 'bg-indigo-500' : 'bg-slate-200'}`} />
          )}
        </div>
      ))}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function AdminCustomerForm({ onSuccess, onCancel }) {
  const queryClient = useQueryClient();
  const topRef = useRef(null);

  const [step, setStep] = useState(0);
  const [customerType, setCustomerType] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    customerName: '', registeredAddress: '', incorporateDate: '',
    businessRegistrationNumber: '', password: '',
    businessName: '', businessLocation: '', telephone: '', email: '', bankBranch: '',
    province: '', town: '',
    proprietorName: '', proprietorTp: '', proprietorEmail: '',
    managerName: '', managerTp: '', managerEmail: '',
    chefName: '', chefTp: '', chefEmail: '',
    purchasingName: '', purchasingTp: '', purchasingEmail: '',
    accountantName: '', accountantTp: '', accountantEmail: '',
  });
  const [files, setFiles] = useState({});
  const [assign, setAssign] = useState({ regionId: '', subRegionId: '', coordinatorId: '' });

  const upd = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  const updAssign = (e) => {
    const { name, value } = e.target;
    setAssign(a => ({ ...a, [name]: value, ...(name === 'regionId' ? { subRegionId: '' } : {}) }));
  };
  const setFile = (name, file) => setFiles(f => ({ ...f, [name]: file ?? undefined }));

  const { data: filterOptions } = useQuery({
    queryKey: ['admin-customer-filters'],
    queryFn: () => customersApi.adminGetFilterOptions().then(r => r.data.data),
  });

  const { data: regionsData } = useQuery({
    queryKey: ['regions-all'],
    queryFn: () => regionsApi.getAll().then(r => r.data),
  });

  const subRegions = useMemo(() => {
    if (!regionsData || !assign.regionId) return [];
    const region = (regionsData || []).find(r => r.id === assign.regionId);
    return region?.subRegions || [];
  }, [regionsData, assign.regionId]);

  const createMut = useMutation({
    mutationFn: (fd) => customerRegistrationApi.adminCreate(fd),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-customers'] });
      queryClient.invalidateQueries({ queryKey: ['admin-registration-requests'] });
      toast.success('Customer created successfully.');
      onSuccess?.();
    },
    onError: (err) => {
      const msg = err?.response?.data?.message || 'Failed to create customer. Please try again.';
      setError(msg);
      toast.error(msg);
    },
  });

  const scroll = () => topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const goNext = () => { scroll(); setStep(s => s + 1); };
  const goBack = () => { scroll(); setStep(s => s - 1); };

  const canNext = () => {
    if (step === 0) return !!(customerType && form.customerName && form.businessRegistrationNumber && form.password && form.telephone);
    if (step === 2) return customerType === 'tax' ? !!files.vatDocument : true;
    if (step === 4) return confirmed;
    return true;
  };

  const handleSubmit = () => {
    setError('');
    const fd = new FormData();
    fd.append('customerType', customerType === 'tax' ? 'Tax' : 'NonTax');
    Object.entries(form).forEach(([k, v]) => {
      if (k === 'email') return;
      if (v) fd.append(k, v);
    });
    fd.append('email', form.email?.trim() || '');
    if (files.businessReg) fd.append('businessRegDoc', files.businessReg);
    if (files.businessAddress) fd.append('businessAddressDoc', files.businessAddress);
    if (files.vatDocument) fd.append('vatDoc', files.vatDocument);
    if (assign.regionId) fd.append('regionId', assign.regionId);
    if (assign.subRegionId) fd.append('subRegionId', assign.subRegionId);
    if (assign.coordinatorId) fd.append('assignedCoordinatorId', assign.coordinatorId);
    
    createMut.mutate(fd);
  };

  const coordName = (id) => filterOptions?.coordinators?.find(c => c.id === id)?.name || id;
  const regionName = (id) => (regionsData || []).find(r => r.id === id)?.name || id;
  const subRegionName = (id) => subRegions.find(s => s.id === id)?.name || id;

  return (
    <div ref={topRef}>
      <StepIndicator current={step} />

      {/* ── Step 0: General ─────────────────────────────────────────── */}
      {step === 0 && (
        <div>
          <SectionTitle>General Details</SectionTitle>
          <div className="mb-5">
            <label className={LABEL}>Customer Type <span className="text-red-400">*</span></label>
            <div className="grid grid-cols-2 gap-3">
              {[{ val: 'non-tax', label: 'Non-Tax Customer', icon: '🏪' }, { val: 'tax', label: 'Tax Customer', icon: '🧾' }].map(({ val, label, icon }) => (
                <button key={val} type="button" onClick={() => setCustomerType(val)}
                  className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 text-sm font-semibold transition-all
                    ${customerType === val ? 'border-indigo-500 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-100' : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'}`}>
                  <span>{icon}</span><span>{label}</span>
                </button>
              ))}
            </div>
            {customerType === 'tax' && (
              <p className="mt-2.5 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                ⚠ VAT registration document will be required in Step 3 (Documents).
              </p>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Customer Name in BR" name="customerName" value={form.customerName} onChange={upd} required />
            <Field label="Business Registration Number" name="businessRegistrationNumber" value={form.businessRegistrationNumber} onChange={upd} required />
            <Field label="Account Password" name="password" value={form.password} onChange={upd} type="password" required />
            <Field label="Incorporate Date" name="incorporateDate" value={form.incorporateDate} onChange={upd} type="date" />
            <div className="sm:col-span-2">
              <Field label="Registered Address in BR" name="registeredAddress" value={form.registeredAddress} onChange={upd} />
            </div>
            <Field label="General Business Name" name="businessName" value={form.businessName} onChange={upd} />
            <Field label="Telephone" name="telephone" value={form.telephone} onChange={upd} type="tel" required />
            <div className="sm:col-span-2">
              <Field label="Business Location Address" name="businessLocation" value={form.businessLocation} onChange={upd} />
            </div>
            <Field label="Email (Optional)" name="email" value={form.email} onChange={upd} type="email" placeholder="customer@email.com (optional)" />
            <Field label="Operating Bank & Branch" name="bankBranch" value={form.bankBranch} onChange={upd} />
            <SelectField label="Province" name="province" value={form.province} onChange={upd}>
              <option value="">Select Province</option>
              {['Western','Central','Southern','Northern','Eastern','North Western','North Central','Uva','Sabaragamuwa'].map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </SelectField>
            <Field label="Town" name="town" value={form.town} onChange={upd} placeholder="Enter town name" />
          </div>
        </div>
      )}

      {/* ── Step 1: Professional ────────────────────────────────────── */}
      {step === 1 && (
        <div>
          <SectionTitle>Professional Details</SectionTitle>
          <p className="text-xs text-slate-500 mb-5">All contact fields are optional. Fill in what's available.</p>
          <div className="space-y-4">
            {CONTACTS.map(({ role, prefix }) => (
              <div key={prefix} className={SECTION}>
                <p className="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-3">{role}</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Field label="Name" name={`${prefix}Name`} value={form[`${prefix}Name`]} onChange={upd} placeholder="Full name" />
                  <Field label="Telephone" name={`${prefix}Tp`} value={form[`${prefix}Tp`]} onChange={upd} type="tel" placeholder="+94..." />
                  <Field label="Email" name={`${prefix}Email`} value={form[`${prefix}Email`]} onChange={upd} type="email" placeholder="email@..." />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Step 2: Documents ────────────────────────────────────────── */}
      {step === 2 && (
        <div>
          <SectionTitle>Required Documents</SectionTitle>
          <div className="space-y-4">
            <FileUpload label="Business Registration Document" name="businessReg" onChange={setFile} required />
            <FileUpload label="Document to Prove Business Address" name="businessAddress" onChange={setFile} />
            {customerType === 'tax' && (
              <div className="rounded-2xl ring-2 ring-amber-200 p-0.5">
                <FileUpload label="VAT Registration Document" name="vatDocument" onChange={setFile} required />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Step 3: Assignment ───────────────────────────────────────── */}
      {step === 3 && (
        <div>
          <SectionTitle>Assignment</SectionTitle>
          <p className="text-xs text-slate-500 mb-5">Assign the customer to a region and coordinator. Sales rep linkage is managed through routes.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SelectField label="Region" name="regionId" value={assign.regionId} onChange={updAssign}>
              <option value="">Select Region</option>
              {(regionsData || []).map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </SelectField>
            <SelectField label="Sub-Region" name="subRegionId" value={assign.subRegionId} onChange={updAssign} disabled={!assign.regionId}>
              <option value="">Select Sub-Region</option>
              {subRegions.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </SelectField>
            <SelectField label="Coordinator" name="coordinatorId" value={assign.coordinatorId} onChange={updAssign}>
              <option value="">Select Coordinator</option>
              {(filterOptions?.coordinators || []).map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </SelectField>
          </div>
          <div className="mt-4 p-4 bg-indigo-50 border border-indigo-200 rounded-xl">
            <p className="text-xs font-semibold text-indigo-700 mb-1">What happens after creation?</p>
            <ul className="text-xs text-indigo-600 space-y-0.5 list-disc list-inside">
              <li>A new user account is automatically created for this customer.</li>
              <li>Email is optional and email notifications are currently disabled system-wide.</li>
            </ul>
          </div>
        </div>
      )}

      {/* ── Step 4: Review ───────────────────────────────────────────── */}
      {step === 4 && (
        <div>
          <SectionTitle>Review & Confirm</SectionTitle>
          <div className="space-y-4">
            <div className={SECTION}>
              <ReviewSectionTitle>General Information</ReviewSectionTitle>
              <ReviewGrid rows={[
                ['Customer Type', customerType === 'tax' ? 'Tax Customer' : 'Non-Tax Customer'],
                ['Business Registration Number', form.businessRegistrationNumber],
                ['Customer Name', form.customerName], ['Email', form.email],
                ['Telephone', form.telephone], ['Registered Address', form.registeredAddress],
                ['Business Name', form.businessName], ['Business Location', form.businessLocation],
                ['Bank & Branch', form.bankBranch], ['Province', form.province], ['Town', form.town],
              ]} />
            </div>
            <div className={SECTION}>
              <ReviewSectionTitle>Contact Persons</ReviewSectionTitle>
              {CONTACTS.filter(({ prefix }) => form[`${prefix}Name`]).length === 0 ? (
                <p className="text-sm text-slate-400">No contacts added</p>
              ) : CONTACTS.filter(({ prefix }) => form[`${prefix}Name`]).map(({ role, prefix }) => (
                <div key={prefix} className="mb-3 pb-3 border-b border-slate-100 last:border-0 last:mb-0 last:pb-0">
                  <p className="text-xs font-bold text-indigo-500 uppercase tracking-widest mb-1">{role}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-sm text-slate-700">
                    <span>{form[`${prefix}Name`]}</span>
                    {form[`${prefix}Tp`] && <span className="text-slate-500">{form[`${prefix}Tp`]}</span>}
                    {form[`${prefix}Email`] && <span className="text-slate-500">{form[`${prefix}Email`]}</span>}
                  </div>
                </div>
              ))}
            </div>
            <div className={SECTION}>
              <ReviewSectionTitle>Documents</ReviewSectionTitle>
              {Object.keys(files).length === 0 ? (
                <p className="text-sm text-slate-400">No documents uploaded</p>
              ) : Object.entries(files).map(([key, f]) => f ? (
                <div key={key} className="flex items-center gap-2 py-1">
                  <FileText className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                  <span className="text-sm text-slate-700 truncate">{f.name}</span>
                </div>
              ) : null)}
            </div>
            <div className={SECTION}>
              <ReviewSectionTitle>Assignment</ReviewSectionTitle>
              <ReviewGrid rows={[
                ['Region', assign.regionId ? regionName(assign.regionId) : '—'],
                ['Sub-Region', assign.subRegionId ? subRegionName(assign.subRegionId) : '—'],
                ['Coordinator', assign.coordinatorId ? coordName(assign.coordinatorId) : '—'],
              ]} />
            </div>
            <button type="button" onClick={() => setConfirmed(c => !c)}
              className={`w-full flex items-start gap-3 text-left px-4 py-3.5 rounded-xl border-2 transition-all
                ${confirmed ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 bg-slate-50 hover:border-indigo-200'}`}>
              <div className={`w-5 h-5 rounded-md flex-shrink-0 mt-0.5 flex items-center justify-center border-2 transition-all
                ${confirmed ? 'border-indigo-600 bg-indigo-600' : 'border-slate-300 bg-white'}`}>
                {confirmed && <Check className="w-3 h-3 text-white" />}
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">
                I confirm the details above are <strong className="text-slate-800">true and correct</strong>.
                {' '}Email notifications are disabled, so no email will be sent.
              </p>
            </button>
            {error && (
              <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
                <X className="w-4 h-4 flex-shrink-0" />{error}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Navigation ───────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mt-8 pt-5 border-t border-slate-100">
        <button type="button" onClick={step === 0 ? onCancel : goBack}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-600 hover:bg-slate-50 transition">
          <ChevronLeft className="w-4 h-4" />
          {step === 0 ? 'Cancel' : 'Back'}
        </button>
        <div className="flex items-center gap-1.5">
          {STEPS.map((_, i) => (
            <div key={i} className={`h-1.5 rounded-full transition-all ${i === step ? 'w-6 bg-indigo-600' : i < step ? 'w-2 bg-indigo-300' : 'w-2 bg-slate-200'}`} />
          ))}
        </div>
        {step < STEPS.length - 1 ? (
          <button type="button" onClick={goNext} disabled={!canNext()}
            className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-sm">
            Next <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button type="button" onClick={handleSubmit} disabled={!confirmed || createMut.isPending}
            className="flex items-center gap-1.5 px-6 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-sm">
            {createMut.isPending ? (
              <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />Creating...</>
            ) : (
              <><Check className="w-4 h-4" />Create Customer</>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <div className="flex items-center gap-2 mb-5">
      <div className="w-1 h-5 bg-indigo-600 rounded-full" />
      <h3 className="text-base font-bold text-slate-800">{children}</h3>
    </div>
  );
}

function ReviewSectionTitle({ children }) {
  return <p className="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-3">{children}</p>;
}

function ReviewGrid({ rows }) {
  return (
    <div className="divide-y divide-slate-100">
      {rows.map(([k, v]) => (
        <div key={k} className="flex items-start justify-between gap-4 py-2">
          <span className="text-xs text-slate-500 flex-shrink-0 min-w-[120px]">{k}</span>
          <span className="text-sm text-slate-800 text-right break-words">{v || '—'}</span>
        </div>
      ))}
    </div>
  );
}
