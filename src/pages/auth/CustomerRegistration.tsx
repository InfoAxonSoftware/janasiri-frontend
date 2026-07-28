import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { customerRegistrationApi } from '../../services/api/customerRegistrationApi';
import { Phone, Building2, UserCircle, Mail, AlertTriangle, FileUp, Check, ChevronLeft, ChevronRight, Building } from 'lucide-react';

// Brand Primary Color from the logo
const brandPrimary = '#C15B3E';

const STEPS = ['General', 'Professional', 'Documents', 'Review'];

// ── Shared Tailwind Classes for consistency (Matching Login Theme) ───────────
const inputCls = "w-full px-4 py-3 text-sm border border-slate-200 rounded-xl bg-white text-slate-900 placeholder:text-slate-400 outline-none transition duration-150 focus:border-slate-400 focus:ring-2 focus:ring-slate-100";
const labelCls = "block text-sm font-semibold text-slate-700 mb-1.5";
const cardCls = "bg-white border border-slate-100 rounded-2xl p-6 shadow-sm";

// ── Helper Components (Styling Updated to Light Theme) ───────────────────────────
function Field({
  label, name, value, onChange, type = 'text', required = false, placeholder, error,
}: {
  label: string; name: string; value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  type?: string; required?: boolean; placeholder?: string; error?: string;
}) {
  return (
    <div>
      <label className={labelCls}>
        {label}
        {required && <span className="text-red-500 ml-1.5">*</span>}
      </label>
      <input
        type={type} name={name} value={value} onChange={onChange}
        placeholder={placeholder || `Enter ${label.toLowerCase()}`}
        required={required}
        className={`${inputCls} ${error ? 'border-red-300 focus:border-red-400 focus:ring-red-100' : ''}`}
      />
      {error && <p className="text-xs text-red-600 mt-1.5 font-medium flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" /> {error}</p>}
    </div>
  );
}

function FileUpload({
  label, name, onChange, required = false, error,
}: {
  label: string; name: string;
  onChange: (name: string, file: File | null) => void;
  required?: boolean;
  error?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [drag, setDrag] = useState(false);

  const handle = (f: File) => { setFile(f); onChange(name, f); };

  return (
    <div>
      <label className={labelCls}>
        {label}
        {required && <span className="text-red-500 ml-1.5">*</span>}
      </label>
      <div
        onClick={() => ref.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) handle(f); }}
        className={`border-2 dashed rounded-xl px-5 py-4 flex items-center gap-4 cursor-pointer transition-all duration-150 group ${
          error ? 'border-red-300 bg-red-50/50' 
          : drag ? `border-[#C15B3E]/60 bg-[#C15B3E]/5` 
          : file ? `border-[#C15B3E]/40 bg-white shadow-inner` 
          : 'border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-slate-100/50'
        }`}
      >
        <div className={`p-2.5 rounded-lg ${file ? 'bg-[#C15B3E]/10' : 'bg-white border border-slate-200 shadow-sm'}`}>
          <FileUp className={`w-5 h-5 transition ${file ? 'text-[#C15B3E]' : 'text-slate-400'}`} strokeWidth={1.5}/>
        </div>
        <div className="flex-1 min-w-0">
          {file ? (
            <p className="text-sm text-[#C15B3E] font-medium truncate">{file.name}</p>
          ) : (
            <>
              <p className="text-sm text-slate-600 truncate">
                <span className="font-semibold" style={{ color: brandPrimary }}>Click to upload</span> or drag &amp; drop
              </p>
              <p className="text-xs text-slate-400 mt-0.5">PDF, JPG, PNG — max 10 MB</p>
            </>
          )}
        </div>
        <input
          ref={ref} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handle(f); }}
        />
      </div>
      {error && <p className="text-xs text-red-600 mt-1.5 font-medium flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" /> {error}</p>}
    </div>
  );
}

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center mb-8">
      {STEPS.map((label, i) => (
        <div key={i} className="flex items-center">
          <div className="flex flex-col items-center">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 border-2 ${
              i <= current 
              ? 'text-white border-none' 
              : 'text-slate-300 border-slate-200 bg-white'
            }`}
             style={{ 
               background: i < current ? `linear-gradient(135deg, ${brandPrimary}, #e77656)` : i === current ? brandPrimary : '',
               boxShadow: i === current ? `0 0 0 4px ${brandPrimary}20, 0 4px 10px ${brandPrimary}30` : 'none',
             }}
            >
              {i < current ? <Check className="w-4 h-4" strokeWidth={3}/> : i + 1}
            </div>
            <span className={`text-[10px] mt-2 font-semibold text-center transition-all duration-300 uppercase tracking-widest ${
              i === current ? 'text-slate-900' : i < current ? 'text-slate-500' : 'text-slate-300'
            }`}>{label}</span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={`w-10 md:w-14 h-0.5 mx-2 -mt-6 transition-all duration-500 ${
              i < current ? 'bg-[#C15B3E]' : 'bg-slate-100'
            }`}/>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Types ──────────────────────────────────────────────────────────────────────
interface FormState {
  customerName: string; registeredAddress: string; incorporateDate: string;
  businessRegistrationNumber: string;
  businessName: string; businessLocation: string; telephone: string; email: string; bankBranch: string;
  province: string; town: string;
  preferredUsername: string; preferredPassword: string;
  proprietorName: string; proprietorTp: string; proprietorEmail: string;
  managerName: string; managerTp: string; managerEmail: string;
  chefName: string; chefTp: string; chefEmail: string;
  purchasingName: string; purchasingTp: string; purchasingEmail: string;
  accountantName: string; accountantTp: string; accountantEmail: string;
}
type FilesState = { businessReg?: File; businessAddress?: File; vatDocument?: File };

const CONTACTS = [
  { role: 'Proprietor / Owner', prefix: 'proprietor' as const },
  { role: 'Manager', prefix: 'manager' as const },
  { role: 'Chef', prefix: 'chef' as const },
  { role: 'Purchasing Officer', prefix: 'purchasing' as const },
  { role: 'Accountant', prefix: 'accountant' as const },
];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^\+?[0-9\s()-]{7,20}$/;

// ── Main component ─────────────────────────────────────────────────────────────
export default function CustomerRegistration() {
  const navigate = useNavigate();
  const topRef = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(0);
  const [customerType, setCustomerType] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [form, setForm] = useState<FormState>({
    customerName: '', registeredAddress: '', incorporateDate: '',
    businessRegistrationNumber: '',
    businessName: '', businessLocation: '', telephone: '', email: '', bankBranch: '',
    province: '', town: '',
    preferredUsername: '', preferredPassword: '',
    proprietorName: '', proprietorTp: '', proprietorEmail: '',
    managerName: '', managerTp: '', managerEmail: '',
    chefName: '', chefTp: '', chefEmail: '',
    purchasingName: '', purchasingTp: '', purchasingEmail: '',
    accountantName: '', accountantTp: '', accountantEmail: '',
  });
  const [files, setFiles] = useState<FilesState>({});

  const upd = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setError('');
    setFieldErrors((prev) => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
    setForm((f) => ({ ...f, [name]: value }));
  };

  const setFile = (name: string, file: File | null) =>
    setFiles(f => ({ ...f, [name]: file ?? undefined }));

  const onFileSet = (name: string, file: File | null) => {
    setFile(name, file);
    setFieldErrors((prev) => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
  };

  const goNext = () => {
    const validation = getStepValidation(step);
    if (Object.keys(validation.fieldErrors).length > 0 || validation.formError) {
      setFieldErrors(validation.fieldErrors);
      setError(validation.formError || 'Please correct the highlighted fields.');
      topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    setFieldErrors({});
    setError('');
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setStep(s => s + 1);
  };
  const goBack = () => {
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setStep(s => s - 1);
  };

  const getStepValidation = (targetStep: number) => {
    const errors: Record<string, string> = {};

    if (targetStep === 0) {
      if (!customerType) errors.customerType = 'Please select customer type.';
      if (!form.customerName.trim()) errors.customerName = 'Customer name is required.';
      if (!form.businessRegistrationNumber.trim()) errors.businessRegistrationNumber = 'Business Registration Number is required.';
      if (!form.telephone.trim()) {
        errors.telephone = 'Telephone is required.';
      } else if (!PHONE_REGEX.test(form.telephone.trim())) {
        errors.telephone = 'Please enter a valid telephone number.';
      }
      if (form.email.trim() && !EMAIL_REGEX.test(form.email.trim())) {
        errors.email = 'Please enter a valid email address.';
      }
      return {
        fieldErrors: errors,
        formError: Object.keys(errors).length > 0 ? 'Please correct the highlighted fields.' : '',
      };
    }

    if (targetStep === 1) {
      for (const { role, prefix } of CONTACTS) {
        const email = (form as any)[`${prefix}Email`]?.trim();
        const phone = (form as any)[`${prefix}Tp`]?.trim();
        if (email && !EMAIL_REGEX.test(email)) {
          errors[`${prefix}Email`] = `Please enter a valid ${role} email.`;
        }
        if (phone && !PHONE_REGEX.test(phone)) {
          errors[`${prefix}Tp`] = `Please enter a valid ${role} telephone.`;
        }
      }
      return {
        fieldErrors: errors,
        formError: Object.keys(errors).length > 0 ? 'Please correct the highlighted fields.' : '',
      };
    }

    if (targetStep === 2) {
      if (!files.businessReg) errors.businessReg = 'Business Registration Document is required.';
      if (customerType === 'tax' && !files.vatDocument) errors.vatDocument = 'VAT Registration Document is required for Tax customers.';
      return {
        fieldErrors: errors,
        formError: Object.keys(errors).length > 0 ? 'Please upload all required documents.' : '',
      };
    }

    if (targetStep === 3 && !confirmed) {
      errors.confirmed = 'Please confirm the declaration before submitting.';
      return {
        fieldErrors: errors,
        formError: 'Please confirm the declaration before submitting.',
      };
    }

    return { fieldErrors: {}, formError: '' };
  };

  const handleSubmit = async () => {
    for (const stepIndex of [0, 1, 2, 3]) {
      const validation = getStepValidation(stepIndex);
      if (Object.keys(validation.fieldErrors).length > 0 || validation.formError) {
        setError(validation.formError || 'Please correct the highlighted fields.');
        setFieldErrors(validation.fieldErrors);
        if (step !== stepIndex) setStep(stepIndex);
        topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
    }

    setFieldErrors({});
    setSubmitting(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('customerType', customerType === 'tax' ? 'Tax' : 'NonTax');
      Object.entries(form).forEach(([k, v]) => { if (v) fd.append(k, v); });
      if (files.businessReg) fd.append('businessRegDoc', files.businessReg);
      if (files.businessAddress) fd.append('businessAddressDoc', files.businessAddress);
      if (files.vatDocument) fd.append('vatDoc', files.vatDocument);
      await customerRegistrationApi.submit(fd);
      setSubmitted(true);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setSubmitted(false); setStep(0); setConfirmed(false); setCustomerType(''); setError('');
    setFieldErrors({});
    setForm(Object.fromEntries(Object.keys(form).map(k => [k, ''])) as unknown as FormState);
    setFiles({});
  };

  // ── Success screen (Branded, Smaller & Neater) ─────────────────────────────────
  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-5 text-slate-900 font-sans relative overflow-hidden">
         <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>

        <div className="relative z-10 text-center px-6 py-8 w-full max-w-md bg-white rounded-2xl border border-slate-100 shadow-xl animate-fade-in-scale">
          

          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 border-4 border-white shadow-md"
            style={{ 
              background: `linear-gradient(135deg, ${brandPrimary}, #e77656)`,
              boxShadow: `0 4px 16px ${brandPrimary}30`,
            }}>
            <Check className="w-8 h-8 text-white" strokeWidth={3} />
          </div>

          <h2 className="text-2xl font-bold text-slate-900 mb-3">
            Registration Submitted!
          </h2>
          <p className="text-sm text-slate-600 mb-8 leading-relaxed px-4">
            Thank you for applying. Our team will review your details and contact you shortly.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-3 justify-center max-w-xs mx-auto sm:max-w-none">
            <button
              onClick={reset}
              className="flex-1 px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition hover:-translate-y-0.5 shadow-sm active:scale-95"
              style={{ backgroundColor: brandPrimary }}
            >
              New Application
            </button>
            <button
              onClick={() => navigate('/login')}
              className="flex-1 px-5 py-2.5 rounded-lg text-sm font-semibold transition bg-slate-100 text-slate-700 hover:bg-slate-200 active:bg-slate-300"
            >
              Back to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Main form (Branded Light Theme) ──────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans relative overflow-hidden" ref={topRef}>
      <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '32px 32px' }}></div>

      <div className="relative z-10 max-w-3xl mx-auto px-4 py-10 md:py-12">

        <div className="text-center mb-10 animate-fade-in-scale flex flex-col items-center">
          <img src="/logo.png" alt="Janasiri Logo" className="w-16 h-16 object-contain rounded-full shadow-sm mb-4" />
          <div className="flex flex-col">
            <h1 className="text-2xl font-extrabold tracking-tighter text-slate-950">
              JANASIRI <span style={{ color: brandPrimary }}>DISTRIBUTORS</span>
            </h1>
            <p className="text-[11px] font-semibold text-slate-600 uppercase tracking-widest mt-0.5">(PVT) LTD</p>
          </div>
          <p className="text-sm text-slate-500 mt-3 max-w-sm">New Wholesale Customer Account Registration Application</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-xl p-6 md:p-10 animate-fade-in-scale">
          
          <style>{`
            input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(0.2); cursor: pointer; }
            select { background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%2364748b' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e"); background-position: right 1rem center; background-repeat: no-repeat; background-size: 1.2em 1.2em; padding-right: 2.5rem; cursor: pointer; }
          `}</style>

          <StepIndicator current={step} />

          {/* ── Step 0: General ─────────────────────────────────────────── */}
          {step === 0 && (
            <div className="animate-fade-in space-y-7">
              <div className="flex items-center gap-3 pt-2 border-t border-slate-100 pt-5">
                <Building className="w-6 h-6 text-slate-400" strokeWidth={1.5} />
                <h2 className="text-xl font-bold tracking-tight text-slate-900">Company Details</h2>
              </div>

              <div className="space-y-2">
                <label className={labelCls}>Customer Type <span className="text-red-500 ml-1.5">*</span></label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {[
                    { val: 'non-tax', label: 'Non-Tax Customer', icon: '🏪' },
                    { val: 'tax', label: 'Tax Customer', icon: '🧾' },
                  ].map(({ val, label, icon }) => (
                    <button
                      key={val} type="button" onClick={() => {
                        setCustomerType(val);
                        setFieldErrors(prev => { const n = { ...prev }; delete n.customerType; return n; });
                      }}
                      className={`relative px-4 py-3.5 rounded-xl border-2 transition-all duration-150 text-left flex items-center gap-3 ${
                        customerType === val 
                        ? 'bg-slate-50 border-[#C15B3E]' 
                        : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                      style={{ 
                        borderColor: customerType === val ? brandPrimary : '',
                        boxShadow: customerType === val ? `0 4px 12px ${brandPrimary}15` : 'none',
                      }}
                    >
                      <span className="text-2xl">{icon}</span>
                      <div className="flex flex-col">
                         <span className={`text-sm font-bold ${customerType === val ? 'text-slate-900' : 'text-slate-700'}`}>{label}</span>
                         <span className="text-[11px] text-slate-500 mt-0.5">{val === 'tax' ? 'VAT registered business' : 'General wholesale buyer'}</span>
                      </div>
                      <div className={`absolute top-1/2 -translate-y-1/2 right-4 w-5 h-5 rounded-full flex items-center justify-center border-2 transition ${
                        customerType === val ? 'text-white border-none' : 'border-slate-200 bg-white'
                      }`} style={{ background: customerType === val ? brandPrimary : '' }}>
                        {customerType === val && <Check className="w-3 h-3" strokeWidth={3}/>}
                      </div>
                    </button>
                  ))}
                </div>
                {fieldErrors.customerType && <p className="text-xs text-red-600 mt-1.5 font-medium flex items-center gap-1.5 pt-1"><AlertTriangle className="w-3.5 h-3.5" /> {fieldErrors.customerType}</p>}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-5">
                <Field label="Customer / Company Name (as in BR)" name="customerName" value={form.customerName} onChange={upd} required error={fieldErrors.customerName} placeholder="Enter full legal name" />
                  <Field label="Business Registration Number (BR)" name="businessRegistrationNumber" value={form.businessRegistrationNumber} onChange={upd} required error={fieldErrors.businessRegistrationNumber} placeholder="Enter BR number" />
                <Field label="Incorporate / Registration Date" name="incorporateDate" value={form.incorporateDate} onChange={upd} type="date" />
                <div className="sm:col-span-2">
                  <Field label="Registered Address (as in BR)" name="registeredAddress" value={form.registeredAddress} onChange={upd} placeholder="Enter full registered office address" />
                </div>
                <Field label="Operating Business / Shop Name" name="businessName" value={form.businessName} onChange={upd} placeholder="Enter name your business operates under" />
                <Field label="Hotline / Land Telephone" name="telephone" value={form.telephone} onChange={upd} type="tel" required error={fieldErrors.telephone} placeholder="+94 ... (Primary contact)" />
                <div className="sm:col-span-2">
                  <Field label="Operating / Delivery Address" name="businessLocation" value={form.businessLocation} onChange={upd} placeholder="Where do you want goods delivered?" />
                </div>
                <Field label="Operating Email Address (Optional)" name="email" value={form.email} onChange={upd} type="email" error={fieldErrors.email} placeholder="For receiving invoices & updates (optional)" />
                <Field label="Operating Bank & Branch" name="bankBranch" value={form.bankBranch} onChange={upd} placeholder="Bank name and branch for payments" />
                <Field label="Town" name="town" value={form.town} onChange={upd} placeholder="Enter nearest major town" />
              </div>

              {/* ── Preferred Account Credentials ── */}
              <div className="pt-2">
                <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-100">
                  <UserCircle className="w-4 h-4 text-slate-400" strokeWidth={1.5} />
                  <h3 className="text-sm font-bold text-slate-700">Preferred Login Credentials</h3>
                  <span className="text-xs text-slate-400 font-normal">(optional — for admin reference)</span>
                </div>
                <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                  Enter your preferred username and password for your account. The admin will review and may use these or set different ones when approving your registration.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-5">
                  <Field label="Preferred Username" name="preferredUsername" value={form.preferredUsername} onChange={upd} placeholder="e.g. charitha@123" />
                  <Field label="Preferred Password" name="preferredPassword" value={form.preferredPassword} onChange={upd} type="password" placeholder="Your preferred password" />
                </div>
              </div>
            </div>
          )}

          {/* ── Step 1: Professional ────────────────────────────────────── */}
          {step === 1 && (
            <div className="animate-fade-in space-y-8">
               <div className="flex items-center gap-3 pt-2 border-t border-slate-100 pt-5">
                 <UserCircle className="w-6 h-6 text-slate-400" strokeWidth={1.5} />
                 <h2 className="text-xl font-bold tracking-tight text-slate-900">Key Professional Contacts</h2>
              </div>
              <div className="space-y-5">
                {CONTACTS.map(({ role, prefix }) => (
                  <div key={prefix} className={`${cardCls} hover:border-slate-200 transition p-5`}>
                    <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
                       <UserCircle className={`w-4 h-4 transition ${ (form as any)[`${prefix}Name`] ? 'text-[#C15B3E]' : 'text-slate-300'}`}/>
                       <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider">{role}</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className={labelCls}>Name</label>
                        <input type="text" name={`${prefix}Name`} value={(form as any)[`${prefix}Name`]} onChange={upd} placeholder="Full name" className={inputCls} />
                      </div>
                      <div>
                        <label className={labelCls}>Telephone</label>
                        <input type="tel" name={`${prefix}Tp`} value={(form as any)[`${prefix}Tp`]} onChange={upd} placeholder="+94..." 
                          className={`${inputCls} ${fieldErrors[`${prefix}Tp`] ? 'border-red-300 focus:border-red-400 focus:ring-red-100' : ''}`} />
                        {fieldErrors[`${prefix}Tp`] && <p className="text-xs text-red-600 mt-1.5 font-medium flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" /> {fieldErrors[`${prefix}Tp`]}</p>}
                      </div>
                      <div>
                        <label className={labelCls}>Email</label>
                        <input type="email" name={`${prefix}Email`} value={(form as any)[`${prefix}Email`]} onChange={upd} placeholder="email@..." 
                          className={`${inputCls} ${fieldErrors[`${prefix}Email`] ? 'border-red-300 focus:border-red-400 focus:ring-red-100' : ''}`} />
                        {fieldErrors[`${prefix}Email`] && <p className="text-xs text-red-600 mt-1.5 font-medium flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" /> {fieldErrors[`${prefix}Email`]}</p>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Step 2: Documents (Compact Layout) ─────────────────────────────────── */}
          {step === 2 && (
            <div className="animate-fade-in space-y-7">
               <div className="flex items-center gap-3 pt-2 border-t border-slate-100 pt-5">
                 <FileUp className="w-6 h-6 text-slate-400" strokeWidth={1.5} />
                 <h2 className="text-xl font-bold tracking-tight text-slate-900">Verification Documents</h2>
              </div>
              <p className="text-sm text-slate-600">Please upload clear copies of the following documents to verify your business. Max size 10MB per file.</p>
              
              <div className="flex flex-col gap-5">
                <FileUpload label="Business Registration (BR) Document" name="businessReg" onChange={onFileSet} required error={fieldErrors.businessReg} />
                <FileUpload label="Document to Prove Operating Address" name="businessAddress" onChange={onFileSet} />
                {customerType === 'tax' && (
                  <FileUpload label="VAT Registration Document (Required for Tax Customers)" name="vatDocument" onChange={onFileSet} required error={fieldErrors.vatDocument} />
                )}
              </div>
            </div>
          )}

          {/* ── Step 3: Review ───────────────────────────────────────────── */}
          {step === 3 && (
            <div className="animate-fade-in space-y-8">
               <div className="flex items-center gap-3 pt-2 border-t border-slate-100 pt-5">
                 <Check className="w-6 h-6 text-slate-400" strokeWidth={1.5} />
                 <h2 className="text-xl font-bold tracking-tight text-slate-900">Review & Confirmation</h2>
              </div>

              <div className="space-y-5">
                <div className={`${cardCls} p-5`}>
                   <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
                     <Building2 className="w-4 h-4 text-[#C15B3E]"/>
                     <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider">General Information</h3>
                   </div>
                  {[
                    ['Customer Type', customerType === 'tax' ? '🧾 Tax Customer' : '🏪 Non-Tax Customer'],
                    ['Company/Customer Name', form.customerName], ['Registered Address', form.registeredAddress], ['Incorporate Date', form.incorporateDate],
                    ['Business Registration Number', form.businessRegistrationNumber],
                    ['Business/Shop Name', form.businessName], ['Telephone/Hotline', form.telephone], ['Business Location Address', form.businessLocation],
                    ['operating Email', form.email], ['Bank & Branch', form.bankBranch],
                    ['Town', form.town],
                  ].filter(([, v]) => v).map(([k, v]) => (
                    <div key={k} className="flex flex-col sm:flex-row sm:justify-between items-start gap-1 sm:gap-4 py-2.5 border-b border-slate-50 last:border-none">
                      <span className="text-xs text-slate-500 font-medium">{k}</span>
                      <span className="text-sm text-slate-900 font-medium sm:text-right break-words">{v}</span>
                    </div>
                  ))}
                </div>

                <div className={`${cardCls} p-5`}>
                   <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
                     <UserCircle className="w-4 h-4 text-[#C15B3E]"/>
                     <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider">Contact Persons</h3>
                   </div>
                  {CONTACTS.filter(({ prefix }) => (form as any)[`${prefix}Name`]).length === 0 ? (
                    <p className="text-sm text-slate-400 text-center py-2">No key contacts added</p>
                  ) : CONTACTS.filter(({ prefix }) => (form as any)[`${prefix}Name`]).map(({ role, prefix }) => (
                    <div key={prefix} className="pb-3 mb-3 border-b border-slate-50 last:border-none last:pb-0 last:mb-0">
                      <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wider mb-1.5">{role}</p>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm">
                        <span className="font-semibold text-slate-900">{(form as any)[`${prefix}Name`]}</span>
                        {(form as any)[`${prefix}Tp`] && <span className="text-slate-600 flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-slate-400"/> {(form as any)[`${prefix}Tp`]}</span>}
                        {(form as any)[`${prefix}Email`] && <span className="text-slate-600 flex items-center gap-1.5 break-all"><Mail className="w-3.5 h-3.5 text-slate-400"/> {(form as any)[`${prefix}Email`]}</span>}
                      </div>
                    </div>
                  ))}
                </div>

                <div className={`${cardCls} p-5`}>
                   <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
                     <FileUp className="w-4 h-4 text-[#C15B3E]"/>
                     <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider">Verification Documents</h3>
                   </div>
                  {Object.keys(files).length === 0 ? (
                    <p className="text-sm text-slate-400 text-center py-2">No documents uploaded</p>
                  ) : (
                    <div className="space-y-2.5">
                      {Object.entries(files).map(([key, f]) => f ? (
                        <div key={key} className="flex items-center gap-3 bg-slate-50 border border-slate-100 p-2.5 rounded-lg shadow-inner">
                           <FileUp className="w-4 h-4 text-[#C15B3E] flex-shrink-0" />
                          <span className="text-sm text-slate-800 font-medium truncate">{f.name}</span>
                          <Check className="w-4 h-4 text-emerald-500 ml-auto flex-shrink-0" />
                        </div>
                      ) : null)}
                    </div>
                  )}
                </div>

                {/* Preferred credentials review */}
                {(form.preferredUsername || form.preferredPassword) && (
                  <div className={`${cardCls} p-5 border-amber-200 bg-amber-50/40`}>
                    <div className="flex items-center gap-2 mb-4 pb-3 border-b border-amber-100">
                      <UserCircle className="w-4 h-4 text-amber-600" />
                      <h3 className="text-xs font-bold text-amber-700 uppercase tracking-wider">Preferred Login Credentials</h3>
                    </div>
                    <p className="text-xs text-amber-600 mb-3">These are shared with the admin for reference when setting up your account.</p>
                    <div className="space-y-2">
                      {form.preferredUsername && (
                        <div className="flex flex-col sm:flex-row sm:justify-between items-start gap-1 sm:gap-4 py-2.5 border-b border-amber-100 last:border-none">
                          <span className="text-xs text-amber-600 font-medium">Preferred Username</span>
                          <span className="text-sm text-slate-900 font-semibold sm:text-right">{form.preferredUsername}</span>
                        </div>
                      )}
                      {form.preferredPassword && (
                        <div className="flex flex-col sm:flex-row sm:justify-between items-start gap-1 sm:gap-4 py-2.5 last:border-none">
                          <span className="text-xs text-amber-600 font-medium">Preferred Password</span>
                          <span className="text-sm text-slate-900 font-semibold sm:text-right font-mono tracking-wide">{'•'.repeat(form.preferredPassword.length)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div
                  onClick={() => {
                    setConfirmed(c => !c);
                    setFieldErrors(prev => { const n = { ...prev }; delete n.confirmed; return n; });
                  }}
                  className={`mt-6 flex items-start gap-3.5 rounded-xl border-2 p-4 cursor-pointer transition ${
                    fieldErrors.confirmed ? 'border-red-300 bg-red-50' 
                    : confirmed ? `border-[#C15B3E] bg-[#C15B3E]/5 shadow-inner` 
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                  }`}
                  style={{ borderColor: confirmed && !fieldErrors.confirmed ? brandPrimary : '' }}
                >
                  <div className={`w-5 h-5 rounded flex items-center justify-center transition border-2 mt-0.5 flex-shrink-0 ${
                    confirmed ? 'text-white border-none' : 'border-slate-300 bg-white'
                  }`} style={{ background: confirmed ? brandPrimary : '' }}>
                    {confirmed && <Check className="w-3.5 h-3.5" strokeWidth={3}/>}
                  </div>
                  <p className={`text-sm leading-relaxed ${confirmed ? 'text-slate-900 font-medium' : 'text-slate-600'}`}>
                    I/We confirm that all information and documents provided in this application are <strong className="font-semibold text-slate-900">true and correct</strong>. I authorize <strong className="font-medium text-slate-800">Janasiri Distributors (PVT) Ltd</strong> to verify and process my registration request.
                  </p>
                </div>
                {fieldErrors.confirmed && <p className="text-xs text-red-600 mt-1.5 font-medium flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" /> {fieldErrors.confirmed}</p>}
              </div>
            </div>
          )}

          {step !== 3 && error && (
            <div className="mt-6 flex items-center gap-3 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm font-medium text-red-800 animate-scale-in">
              <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* ── Navigation bar ─────────────────────────────────────────────── */}
          <div className="flex items-center justify-between mt-10 pt-6 border-t border-slate-100 gap-3">
            <button
              type="button" onClick={goBack} disabled={step === 0}
              className={`flex items-center gap-1.5 px-5 py-2.5 rounded-lg text-sm font-medium transition active:scale-95 ${
                step === 0 ? 'bg-white text-slate-300 border border-slate-200 cursor-not-allowed' 
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 active:bg-slate-300'
              }`}
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>

            <div className="hidden sm:flex items-center gap-2">
              {STEPS.map((_, i) => (
                <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === step ? 'w-6' : 'w-2'
                }`} style={{ backgroundColor: i <= step ? brandPrimary : '#e2e8f0' }} />
              ))}
            </div>

            {step < STEPS.length - 1 ? (
              <button
                type="button" onClick={goNext}
                className="flex items-center gap-1.5 px-6 py-2.5 rounded-lg text-sm font-semibold text-white transition hover:shadow-md hover:-translate-y-0.5 active:scale-95"
                style={{ backgroundColor: brandPrimary }}
              >
                Next
                <ChevronRight className="w-4 h-4" strokeWidth={2.5}/>
              </button>
            ) : (
              <button
                type="button" onClick={handleSubmit} disabled={submitting}
                className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold text-white transition hover:shadow-md hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed"
                style={{ backgroundColor: brandPrimary }}
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Submitting…
                  </>
                ) : (
                  <>
                    Submit
                    <Check className="w-4 h-4" strokeWidth={3} />
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        <div className="text-center mt-8 space-y-1.5 text-[11px] text-slate-400">
           <p>Reg Address: No 205 Wattarantenna Passage, Kandy, Sri Lanka · TP / Hotline: 0777-675322 · VAT: 114608394-7000</p>
           <p>&copy; {new Date().getFullYear()} Janasiri Distributors (Pvt) Ltd. All rights reserved.</p>
           <p className="pt-2">Already have an account? <button onClick={() => navigate('/login')} className="font-semibold text-[#C15B3E] hover:underline">Sign in here</button></p>
        </div>
      </div>
    </div>
  );
}

function Loader2({ className }: { className?: string }) {
    return (
        <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
    )
}