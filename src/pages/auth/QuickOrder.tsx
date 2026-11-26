import { useRef, useState, type ChangeEvent, type DragEvent, type FormEvent, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { quickRequestApi } from '../../services/api/quickRequestApi';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  Eye,
  Loader2,
  ClipboardList,
  FileImage,
  FileText,
  ImagePlus,
  Paperclip,
  PackageSearch,
  Phone,
  Plus,
  Send,
  ShieldCheck,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react';

type OrderItem = {
  id: number;
  description: string;
  size: string;
  brand: string;
  quantity: string;
};

type AttachmentKind = 'documents' | 'images';

const MAX_FILES_PER_KIND = 8;
const MAX_PDF_SIZE = 10 * 1024 * 1024;
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const MAX_TOTAL_ATTACHMENT_SIZE = 50 * 1024 * 1024;

const inputClass =
  'h-[54px] w-full min-w-0 rounded-xl border border-[#e2dfd6] bg-[#fffdfa] px-4 text-[15px] font-medium leading-6 text-[#252a24] outline-none transition duration-200 placeholder:font-normal placeholder:text-[#92978c] hover:border-[#cfcbbf] focus:border-[#bd674d] focus:bg-white focus:ring-4 focus:ring-[#bd674d]/[0.09] sm:px-[18px]';
const labelClass = 'mb-2 block text-[13px] font-semibold tracking-[0.005em] text-[#3d4639]';

function makeItem(id: number): OrderItem {
  return { id, description: '', size: '', brand: '', quantity: '' };
}

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return Math.max(1, Math.round(bytes / 1024)) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function SectionHeading({
  icon,
  title,
}: {
  icon: ReactNode;
  title: string;
}) {
  return (
    <div className="flex items-center gap-3.5 border-b border-[#eeece5] px-5 py-5 sm:px-7 sm:py-6">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#edf1e9] text-[#647454]">
        {icon}
      </div>
      <h2 className="text-[17px] font-bold tracking-[-0.02em] text-[#252b24] sm:text-[18px]">{title}</h2>
    </div>
  );
}

function Field({
  id,
  label,
  placeholder,
  value,
  onChange,
  required = false,
  type = 'text',
}: {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: string;
}) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className={labelClass}>
        {label}
        {required && <span className="ml-1 text-[#b9573d]">*</span>}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        autoComplete={id === 'phoneNumber' ? 'tel' : id === 'contactPerson' ? 'name' : 'organization'}
        className={inputClass}
      />
    </div>
  );
}
function AttachmentPanel({
  kind,
  title,
  description,
  accept,
  files,
  onAdd,
  onRemove,
}: {
  kind: AttachmentKind;
  title: string;
  description: string;
  accept: string;
  files: File[];
  onAdd: (files: FileList | File[]) => void;
  onRemove: (index: number) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const isImage = kind === 'images';

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    onAdd(event.dataTransfer.files);
  };

  return (
    <div className="min-w-0 rounded-2xl border border-[#e9e6dd] bg-[#fffdfa] p-4 sm:p-5">
      <div className="mb-3 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f5eee8] text-[#b9573d]">
          {isImage ? <ImagePlus size={18} strokeWidth={1.8} /> : <FileText size={18} strokeWidth={1.8} />}
        </div>
        <div className="min-w-0">
          <h3 className="text-[15px] font-bold text-[#30372f]">{title}</h3>
          <p className="mt-1 text-[12px] leading-5 text-[#777e72]">{description}</p>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple
        className="hidden"
        onChange={(event: ChangeEvent<HTMLInputElement>) => {
          if (event.target.files?.length) onAdd(event.target.files);
          event.target.value = '';
        }}
      />

      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={
          'group flex min-h-[112px] cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-3 py-4 text-center transition duration-200 ' +
          (dragging
            ? 'border-[#b9573d] bg-[#f8eee9]'
            : 'border-[#dcd9cf] bg-white hover:border-[#bd806c] hover:bg-[#fcf8f3]')
        }
      >
        <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-full bg-[#edf1e9] text-[#647454] transition group-hover:scale-105">
          <UploadCloud size={17} strokeWidth={1.8} />
        </div>
        <p className="text-[13px] font-semibold text-[#454b43]">
          <span className="text-[#b9573d]">Choose files</span> or drag them here
        </p>
        <p className="mt-1 text-[12px] text-[#858a80]">Up to {MAX_FILES_PER_KIND} files · {isImage ? '5 MB' : '10 MB'} each</p>
      </div>

      {files.length > 0 && (
        <div className="mt-3 space-y-2">
          {files.map((file, index) => (
            <div key={file.name + file.size + index} className="flex min-w-0 items-center gap-2.5 rounded-xl border border-[#eeece5] bg-white px-3 py-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#f4f1e9] text-[#718064]">
                {isImage ? <FileImage size={15} /> : <Paperclip size={15} />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-[#454b43]">{file.name}</p>
                <p className="mt-0.5 text-[12px] text-[#858a80]">{formatFileSize(file.size)}</p>
              </div>
              <button
                type="button"
                onClick={() => onRemove(index)}
                aria-label={'Remove ' + file.name}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#969b91] transition hover:bg-[#f8eeea] hover:text-[#b9573d]"
              >
                <X size={15} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ItemFields({
  item,
  index,
  onChange,
  onRemove,
  canRemove,
}: {
  item: OrderItem;
  index: number;
  onChange: (id: number, field: keyof Omit<OrderItem, 'id'>, value: string) => void;
  onRemove: (id: number) => void;
  canRemove: boolean;
}) {
  return (
    <div className="rounded-xl border border-[#eae7df] bg-[#fffdfa] p-3 sm:p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="inline-flex items-center gap-2 text-[13px] font-bold text-[#454b43]">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#edf1e9] text-[12px] text-[#647454]">
            {String(index + 1).padStart(2, '0')}
          </span>
          Item details
        </span>
        {canRemove && (
          <button
            type="button"
            onClick={() => onRemove(item.id)}
            aria-label={'Remove item ' + (index + 1)}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-[12px] font-semibold text-[#96958b] transition hover:bg-[#f8eeea] hover:text-[#b9573d]"
          >
            <Trash2 size={13} />
            Remove
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="col-span-2 min-w-0 sm:col-span-2">
          <label htmlFor={'description-' + item.id} className={labelClass}>Item description</label>
          <input
            id={'description-' + item.id}
            value={item.description}
            onChange={(event) => onChange(item.id, 'description', event.target.value)}
            placeholder="e.g. Basmati rice, cooking oil..."
            className={inputClass}
          />
        </div>
        <div className="min-w-0">
          <label htmlFor={'size-' + item.id} className={labelClass}>Size</label>
          <input
            id={'size-' + item.id}
            value={item.size}
            onChange={(event) => onChange(item.id, 'size', event.target.value)}
            placeholder="e.g. 5 kg"
            className={inputClass}
          />
        </div>
        <div className="min-w-0">
          <label htmlFor={'brand-' + item.id} className={labelClass}>Brand</label>
          <input
            id={'brand-' + item.id}
            value={item.brand}
            onChange={(event) => onChange(item.id, 'brand', event.target.value)}
            placeholder="Preferred brand"
            className={inputClass}
          />
        </div>
        <div className="col-span-2 min-w-0 sm:col-span-1">
          <label htmlFor={'quantity-' + item.id} className={labelClass}>Quantity</label>
          <input
            id={'quantity-' + item.id}
            type="number"
            min="1"
            step="1"
            inputMode="numeric"
            value={item.quantity}
            onChange={(event) => onChange(item.id, 'quantity', event.target.value)}
            placeholder="Enter qty"
            className={inputClass + ' no-number-spin'}
          />
        </div>
      </div>
    </div>
  );
}

export default function QuickOrder() {
  const [businessName, setBusinessName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [items, setItems] = useState<OrderItem[]>([makeItem(1)]);
  const [documents, setDocuments] = useState<File[]>([]);
  const [images, setImages] = useState<File[]>([]);
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [confirmed, setConfirmed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedRequest, setSubmittedRequest] = useState<{ requestNumber: string; id: string } | null>(null);
  const [website, setWebsite] = useState('');
  const nextId = useRef(2);

  const updateItem = (id: number, field: keyof Omit<OrderItem, 'id'>, value: string) => {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
  };

  const addItem = () => {
    setItems((current) => [...current, makeItem(nextId.current++)]);
  };

  const removeItem = (id: number) => {
    setItems((current) => current.length > 1 ? current.filter((item) => item.id !== id) : current);
  };

  const addAttachments = (kind: AttachmentKind, incoming: FileList | File[]) => {
    const selected = Array.from(incoming);
    const setter = kind === 'documents' ? setDocuments : setImages;
    const current = kind === 'documents' ? documents : images;
    const valid: File[] = [];

    for (const file of selected) {
      const maxSize = kind === 'documents' ? MAX_PDF_SIZE : MAX_IMAGE_SIZE;
      if (file.size > maxSize) {
        toast.error(file.name + (kind === 'documents' ? ' exceeds the 10 MB PDF limit.' : ' exceeds the 5 MB image limit.'));
        continue;
      }
      if (kind === 'images' && !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        toast.error('Please select a JPG, PNG or WEBP image.');
        continue;
      }
      if (kind === 'documents' && (!/\.pdf$/i.test(file.name) || file.type !== 'application/pdf')) {
        toast.error('Only PDF documents are supported.');
        continue;
      }
      valid.push(file);
    }

    const merged = [...current, ...valid].filter((file, index, all) =>
      all.findIndex((candidate) => candidate.name === file.name && candidate.size === file.size && candidate.lastModified === file.lastModified) === index,
    );
    if (merged.length > MAX_FILES_PER_KIND) {
      toast.error('You can attach up to ' + MAX_FILES_PER_KIND + ' ' + kind + '.');
    }
    const nextDocuments = kind === 'documents' ? merged : documents;
    const nextImages = kind === 'images' ? merged : images;
    const totalSize = [...nextDocuments, ...nextImages].reduce((sum, file) => sum + file.size, 0);
    if (totalSize > MAX_TOTAL_ATTACHMENT_SIZE) {
      toast.error('Combined attachments cannot exceed 50 MB.');
      return;
    }
    setter(merged.slice(0, MAX_FILES_PER_KIND));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const completedItems = items.filter((item) => item.description.trim() && Number(item.quantity) > 0);
    if (completedItems.length === 0) {
      toast.error('Please add at least one item description and quantity.');
      document.getElementById('item-details')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    const incomplete = items.some((item) => (item.description.trim() && (!item.quantity || Number(item.quantity) < 1)) || (!item.description.trim() && (item.size.trim() || item.brand.trim() || item.quantity.trim())));
    if (incomplete) {
      toast.error('Please complete or clear each started item row.');
      document.getElementById('item-details')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setStep(2);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const submitGuestOrder = async () => {
    if (!confirmed || isSubmitting) return;

    setIsSubmitting(true);
    const form = new FormData();
    const orderItems = items
      .filter((item) => item.description.trim() && Number(item.quantity) > 0)
      .map((item) => ({
        description: item.description.trim(),
        size: item.size.trim(),
        brand: item.brand.trim(),
        quantity: Number(item.quantity),
      }));

    form.append('businessName', businessName.trim());
    form.append('contactPerson', contactPerson.trim());
    form.append('phoneNumber', phoneNumber.trim());
    form.append('itemsJson', JSON.stringify(orderItems));
    form.append('website', website);
    [...documents, ...images].forEach((file) => form.append('attachments', file));

    try {
      const response = await quickRequestApi.submitGuest(form);
      const request = response.data.data;
      setSubmittedRequest({ id: request.id, requestNumber: request.requestNumber });
      setStep(4);
      toast.success('Your guest order request has been sent to Janasiri Distributors.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error: any) {
      const message =
        error?.response?.data?.message ||
        error?.response?.data?.errors?.[0] ||
        'We could not send your order. Please check your connection and try again.';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };
  return (
    <main className="min-h-screen overflow-x-clip bg-[#f7f5f0] text-[#242923]">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_84%_5%,rgba(193,91,62,0.065),transparent_25%),radial-gradient(circle_at_8%_88%,rgba(105,120,88,0.07),transparent_30%)]" />

      <header className="relative z-10 border-b border-[#e8e4db] bg-[#f7f5f0]/90 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-[1240px] items-center justify-between gap-3 px-4 py-3.5 sm:px-6 lg:px-8">
          <Link to="/login" className="flex min-w-0 items-center gap-3 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-[#bd674d]">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#f5f1e8] p-1 shadow-sm">
              <img src="/logo.png" alt="Janasiri Distributors" className="h-full w-full object-contain" />
            </span>
            <span className="min-w-0">
              <span className="block text-[16px] font-bold tracking-[-0.02em] text-[#252b24]">Janasiri</span>
              <span className="mt-0.5 block text-[13px] font-semibold tracking-[0.08em] text-[#647454]">Distributors</span>
            </span>
          </Link>
          <div className="flex shrink-0 items-center gap-2">
            <Link to="/track-order" className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-[#d9dfd2] bg-[#edf1e9] px-3 text-[12px] font-semibold text-[#53644a] transition hover:border-[#bdc9b1] hover:bg-[#e5ecdf] sm:gap-2 sm:px-4 sm:text-[13px]">
              <PackageSearch size={15} />
              <span className="hidden sm:inline">Track order</span>
              <span className="sm:hidden">Track</span>
            </Link>
            <Link to="/login" className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border border-[#e4e3dc] bg-white/75 px-3 text-[13px] font-semibold text-[#62695e] transition hover:border-[#d3c9bb] hover:bg-white hover:text-[#b9573d] sm:px-4">
              <ArrowLeft size={14} />
              <span className="hidden sm:inline">Back to sign in</span>
              <span className="sm:hidden">Sign in</span>
            </Link>
          </div>
        </div>
      </header>

      <div className="relative z-0 mx-auto w-full max-w-[1240px] px-3 pb-12 pt-3 sm:px-6 sm:pt-5 lg:px-8 lg:pb-16">


        {step < 4 && (
          <div className="mb-5 flex items-center justify-between gap-2 rounded-2xl border border-[#e8e4db] bg-white px-4 py-4 shadow-[0_6px_22px_rgba(37,42,36,0.025)] sm:mb-6 sm:px-6">
            {[
              { number: 1, label: 'Order details' },
              { number: 2, label: 'Review order' },
              { number: 3, label: 'Confirm & send' },
            ].map((item, index) => {
              const active = step === item.number;
              const complete = step > item.number;
              return (
                <div key={item.number} className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
                  <span className={'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[12px] font-bold transition ' + (complete ? 'bg-[#647454] text-white' : active ? 'bg-[#222a23] text-white ring-4 ring-[#edf1e9]' : 'bg-[#f1f0eb] text-[#989b91]')}>
                    {complete ? <Check size={15} /> : '0' + item.number}
                  </span>
                  <span className={'hidden min-w-0 truncate text-[13px] font-semibold sm:block ' + (active ? 'text-[#30382d]' : complete ? 'text-[#647454]' : 'text-[#9a9d94]')}>{item.label}</span>
                  {index < 2 && <span className={'h-px min-w-3 flex-1 ' + (complete ? 'bg-[#9eae91]' : 'bg-[#e8e5dc]')} />}
                </div>
              );
            })}
          </div>
        )}

        <AnimatePresence mode="wait" initial={false}>
        {step === 1 && (
          <motion.form
            key="order-details"
            initial={{ opacity: 0, y: 18, scale: 0.99, filter: 'blur(4px)' }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -12, scale: 0.99, filter: 'blur(4px)' }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            onSubmit={handleSubmit}
            className="space-y-4 sm:space-y-5"
          >
          <div aria-hidden="true" className="pointer-events-none absolute -left-[10000px] top-auto h-px w-px overflow-hidden">
            <label htmlFor="website">Website</label>
            <input id="website" name="website" tabIndex={-1} autoComplete="off" value={website} onChange={(event) => setWebsite(event.target.value)} />
          </div>
          <section className="overflow-hidden rounded-[20px] border border-[#e8e4db] bg-white shadow-[0_8px_28px_rgba(37,42,36,0.035)] sm:rounded-[24px]">
            <SectionHeading
              icon={<Building2 size={18} strokeWidth={1.8} />}
              title="Business details"
            />
            <div className="grid gap-4 px-4 py-5 sm:grid-cols-2 sm:gap-5 sm:px-6 sm:py-6 lg:grid-cols-3">
              <Field id="businessName" label="Business name" placeholder="Enter your business name" value={businessName} onChange={setBusinessName} required />
              <Field id="contactPerson" label="Contact person" placeholder="Who should we speak to?" value={contactPerson} onChange={setContactPerson} required />
              <Field id="phoneNumber" label="Contact number" placeholder="+94 7X XXX XXXX" value={phoneNumber} onChange={setPhoneNumber} required type="tel" />
            </div>
          </section>

          <section id="item-details" className="overflow-hidden rounded-[20px] border border-[#e8e4db] bg-white shadow-[0_8px_28px_rgba(37,42,36,0.035)] sm:rounded-[24px]">
            <SectionHeading
              icon={<ClipboardList size={18} strokeWidth={1.8} />}
              title="Order items"
            />
            <div className="px-4 py-4 sm:px-6 sm:py-5">
              <div className="mb-4 hidden grid-cols-[42px_minmax(0,2.2fr)_minmax(90px,0.8fr)_minmax(110px,1fr)_minmax(90px,0.8fr)_38px] items-center gap-3 rounded-xl bg-[#f7f6f1] px-3 py-3 text-[12px] font-semibold text-[#62695e] md:grid">
                <span>No.</span>
                <span>Item</span>
                <span>Size</span>
                <span>Brand</span>
                <span>Qty</span>
                <span />
              </div>

              <div className="space-y-3">
                {items.map((item, index) => (
                  <div key={item.id}>
                    <div className="hidden md:grid md:grid-cols-[42px_minmax(0,2.2fr)_minmax(90px,0.8fr)_minmax(110px,1fr)_minmax(90px,0.8fr)_38px] md:items-center md:gap-3 md:border-b md:border-[#eeece5] md:pb-3">
                      <span className="pl-2 text-[13px] font-semibold tabular-nums text-[#62695e]">{String(index + 1).padStart(2, '0')}</span>
                      <input aria-label={'Item ' + (index + 1) + ' description'} value={item.description} onChange={(event) => updateItem(item.id, 'description', event.target.value)} placeholder="Enter item description" className={inputClass + ' h-11'} />
                      <input aria-label={'Item ' + (index + 1) + ' size'} value={item.size} onChange={(event) => updateItem(item.id, 'size', event.target.value)} placeholder="Size" className={inputClass + ' h-11'} />
                      <input aria-label={'Item ' + (index + 1) + ' brand'} value={item.brand} onChange={(event) => updateItem(item.id, 'brand', event.target.value)} placeholder="Brand" className={inputClass + ' h-11'} />
                      <input aria-label={'Item ' + (index + 1) + ' quantity'} type="number" min="1" step="1" inputMode="numeric" value={item.quantity} onChange={(event) => updateItem(item.id, 'quantity', event.target.value)} placeholder="Qty" className={inputClass + ' no-number-spin h-11'} />
                      <span className="flex justify-center">
                        {items.length > 1 && (
                          <button type="button" onClick={() => removeItem(item.id)} aria-label={'Remove item ' + (index + 1)} className="flex h-8 w-8 items-center justify-center rounded-lg text-[#a0a399] transition hover:bg-[#f8eeea] hover:text-[#b9573d]">
                            <X size={15} />
                          </button>
                        )}
                      </span>
                    </div>
                    <div className="md:hidden">
                      <ItemFields item={item} index={index} onChange={updateItem} onRemove={removeItem} canRemove={items.length > 1} />
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex flex-col gap-3 border-t border-[#eeece5] pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[13px] text-[#777e72]">Size and brand are optional.</p>
                <button type="button" onClick={addItem} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[#d9dfd3] bg-[#f7f8f4] px-4 text-[14px] font-semibold text-[#536348] transition hover:border-[#9eac91] hover:bg-[#edf1e9]">
                  <Plus size={15} />
                  Add item
                </button>
              </div>
            </div>
          </section>

          <section className="overflow-hidden rounded-[20px] border border-[#e8e4db] bg-white shadow-[0_8px_28px_rgba(37,42,36,0.035)] sm:rounded-[24px]">
            <SectionHeading
              icon={<Paperclip size={18} strokeWidth={1.8} />}
              title="Attachments"
            />
            <div className="grid gap-4 px-4 py-5 sm:grid-cols-2 sm:gap-5 sm:px-6 sm:py-6">
              <AttachmentPanel
                kind="documents"
                title="Attach documents"
                description="PDF files · up to 10 MB each"
                accept=".pdf,application/pdf"
                files={documents}
                onAdd={(files) => addAttachments('documents', files)}
                onRemove={(index) => setDocuments((current) => current.filter((_, i) => i !== index))}
              />
              <AttachmentPanel
                kind="images"
                title="Attach photos"
                description="JPG, PNG or WEBP · up to 5 MB each"
                accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                files={images}
                onAdd={(files) => addAttachments('images', files)}
                onRemove={(index) => setImages((current) => current.filter((_, i) => i !== index))}
              />
            </div>
          </section>

          <div className="flex justify-end pt-1">
            <button type="submit" className="group inline-flex h-12 w-full items-center justify-center gap-2.5 rounded-xl bg-[#b9573d] px-6 text-[14px] font-semibold text-white shadow-[0_10px_22px_rgba(185,87,61,0.19)] transition duration-200 hover:-translate-y-0.5 hover:bg-[#a94c34] active:translate-y-0 sm:w-auto sm:min-w-[220px]">
              <Eye size={17} />
              Review order
              <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
            </button>
          </div>
          </motion.form>
        )}

        {step === 2 && (
          <motion.section key="review-order" initial={{ opacity: 0, y: 18, scale: 0.99, filter: 'blur(4px)' }} animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }} exit={{ opacity: 0, y: -12, scale: 0.99, filter: 'blur(4px)' }} transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }} className="overflow-hidden rounded-[22px] border border-[#e8e4db] bg-white shadow-[0_10px_34px_rgba(37,42,36,0.045)]">
            <SectionHeading
              icon={<Eye size={18} strokeWidth={1.8} />}
              title="Review your order"
            />
            <div className="space-y-5 px-4 py-5 sm:px-6 sm:py-6">
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  { label: 'Business name', value: businessName },
                  { label: 'Contact person', value: contactPerson },
                  { label: 'Contact number', value: phoneNumber },
                ].map((detail) => (
                  <div key={detail.label} className="min-w-0 rounded-xl border border-[#ece9e1] bg-[#fffdfa] px-4 py-3.5">
                    <p className="text-[12px] font-semibold text-[#777e72]">{detail.label}</p>
                    <p className="mt-1.5 break-words text-[15px] font-semibold leading-6 text-[#30382d]">{detail.value}</p>
                  </div>
                ))}
              </div>

              <div>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="text-[15px] font-bold text-[#30382d]">Order items</h3>
                  <span className="rounded-full bg-[#edf1e9] px-2.5 py-1 text-[12px] font-semibold text-[#647454]">{items.filter((item) => item.description.trim()).length} items</span>
                </div>
                <div className="overflow-hidden rounded-xl border border-[#e9e6dd]">
                  <div className="hidden grid-cols-[minmax(0,2fr)_minmax(90px,1fr)_minmax(100px,1fr)_80px] gap-3 bg-[#f7f6f1] px-4 py-3 text-[12px] font-semibold text-[#62695e] sm:grid">
                    <span>ITEM</span><span>SIZE</span><span>BRAND</span><span className="text-right">QTY</span>
                  </div>
                  {items.filter((item) => item.description.trim()).map((item, index) => (
                    <div key={item.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 border-t border-[#eeece5] px-4 py-3 first:border-t-0 sm:grid-cols-[minmax(0,2fr)_minmax(90px,1fr)_minmax(100px,1fr)_80px] sm:items-center">
                      <div className="min-w-0">
                        <p className="text-[14px] font-semibold text-[#30382d]">{String(index + 1).padStart(2, '0')}. {item.description}</p>
                        {(item.size || item.brand) && <p className="mt-1 text-[12px] text-[#777e72] sm:hidden">{[item.size, item.brand].filter(Boolean).join(' · ')}</p>}
                      </div>
                      <span className="hidden text-[13px] text-[#62695e] sm:block">{item.size || '—'}</span>
                      <span className="hidden text-[13px] text-[#62695e] sm:block">{item.brand || '—'}</span>
                      <span className="self-center text-right text-[14px] font-bold tabular-nums text-[#536348]">× {item.quantity}</span>
                    </div>
                  ))}
                </div>
              </div>

              {(documents.length + images.length) > 0 && (
                <div className="rounded-xl border border-[#ece9e1] bg-[#fffdfa] p-4">
                  <h3 className="mb-3 text-[15px] font-bold text-[#454b43]">Attachments ({documents.length + images.length})</h3>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {[...documents, ...images].map((file, index) => (
                      <div key={file.name + file.size + index} className="flex min-w-0 items-center gap-2 rounded-lg bg-[#f7f6f1] px-3 py-2.5">
                        <Paperclip size={15} className="shrink-0 text-[#718064]" />
                        <span className="truncate text-[13px] text-[#454b43]">{file.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex flex-col-reverse gap-3 border-t border-[#eeece5] pt-5 sm:flex-row sm:items-center sm:justify-between">
                <button type="button" onClick={() => setStep(1)} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-[#e4e3dc] bg-white px-5 text-[14px] font-semibold text-[#62695e] transition hover:bg-[#f7f6f1]">
                  <ArrowLeft size={15} /> Back to edit
                </button>
                <button type="button" onClick={() => { setConfirmed(false); setStep(3); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="group inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#b9573d] px-6 text-[14px] font-semibold text-white shadow-[0_10px_22px_rgba(185,87,61,0.16)] transition hover:-translate-y-0.5 hover:bg-[#a94c34] sm:min-w-[240px]">
                  Continue to confirmation <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
                </button>
              </div>
            </div>
          </motion.section>
        )}

        {step === 3 && (
          <motion.section key="confirm-order" initial={{ opacity: 0, y: 18, scale: 0.99, filter: 'blur(4px)' }} animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }} exit={{ opacity: 0, y: -12, scale: 0.99, filter: 'blur(4px)' }} transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }} className="w-full overflow-hidden rounded-[22px] border border-[#e8e4db] bg-white shadow-[0_10px_34px_rgba(37,42,36,0.045)]">
            <SectionHeading
              icon={<ShieldCheck size={18} strokeWidth={1.8} />}
              title="Confirm & send"
            />
            <div className="px-5 py-6 sm:px-8 sm:py-8">
              <div className="rounded-2xl bg-[#f7f6f1] p-5 sm:p-6">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#edf1e9] text-[#647454]"><ClipboardList size={19} /></span>
                  <div>
                    <h3 className="text-[17px] font-bold text-[#30382d]">Ready to send?</h3>
                    <p className="mt-1.5 text-[14px] leading-6 text-[#62695e]">Your request for <strong className="text-[#3d4639]">{businessName}</strong> includes <strong className="text-[#3d4639]">{items.filter((item) => item.description.trim()).length} items</strong>{(documents.length + images.length) > 0 && <> and <strong className="text-[#3d4639]">{documents.length + images.length} attachments</strong></>}.</p>
                  </div>
                </div>
                <div className="mt-5 grid gap-3 border-t border-[#e5e2d9] pt-4 sm:grid-cols-2">
                  <div><p className="text-[12px] font-semibold text-[#777e72]">Contact person</p><p className="mt-1 text-[14px] font-semibold text-[#3d4639]">{contactPerson}</p></div>
                  <div><p className="text-[12px] font-semibold text-[#777e72]">Contact number</p><p className="mt-1 text-[14px] font-semibold text-[#3d4639]">{phoneNumber}</p></div>
                </div>
              </div>

              <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-[#e7e4db] bg-white p-4 transition hover:border-[#c8d3bf]">
                <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-[#647454]" />
                <span className="text-[14px] leading-6 text-[#62695e]">I confirm that the business details, item descriptions and quantities above are correct, and I agree that Janasiri may contact me about this request.</span>
              </label>

              <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
                <button type="button" disabled={isSubmitting} onClick={() => setStep(2)} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-[#e4e3dc] bg-white px-5 text-[14px] font-semibold text-[#62695e] transition hover:bg-[#f7f6f1] disabled:opacity-50">
                  <ArrowLeft size={15} /> Back to review
                </button>
                <button type="button" onClick={submitGuestOrder} disabled={!confirmed || isSubmitting} className="inline-flex h-12 items-center justify-center gap-2.5 rounded-xl bg-[#222a23] px-6 text-[14px] font-semibold text-white shadow-[0_10px_22px_rgba(34,42,35,0.16)] transition hover:-translate-y-0.5 hover:bg-[#354236] disabled:cursor-not-allowed disabled:opacity-45 sm:min-w-[220px]">
                  {isSubmitting ? <><Loader2 size={16} className="animate-spin" /> Sending order...</> : <><Send size={15} /> Send order request</>}
                </button>
              </div>
            </div>
          </motion.section>
        )}

        {step === 4 && submittedRequest && (
          <motion.section key="order-success" initial={{ opacity: 0, y: 18, scale: 0.97, filter: 'blur(4px)' }} animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }} exit={{ opacity: 0, y: -10, scale: 0.99 }} transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }} className="mx-auto max-w-[650px] overflow-hidden rounded-[24px] border border-[#e8e4db] bg-white px-5 py-9 text-center shadow-[0_12px_40px_rgba(37,42,36,0.06)] sm:px-9 sm:py-12">
            <motion.div initial={{ scale: 0.72, rotate: -10 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 280, damping: 18 }} className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#edf1e9] text-[#647454]"><CheckCircle2 size={31} strokeWidth={1.7} /></motion.div>
            <p className="mt-6 text-[13px] font-bold text-[#b9573d]">Request submitted</p>
            <h2 className="mt-2 text-[25px] font-semibold tracking-[-0.04em] text-[#252b24] sm:text-[30px]">Thank you, {contactPerson}.</h2>
            <p className="mx-auto mt-3 max-w-[430px] text-[15px] leading-7 text-[#62695e]">Your order request has been received by Janasiri Distributors. Our team will review your request and contact you using the number you provided.</p>
            <div className="mx-auto mt-7 max-w-[360px] rounded-2xl border border-[#e7e4db] bg-[#f7f6f1] p-5">
              <p className="text-[12px] font-semibold text-[#777e72]">Order reference</p>
              <p className="mt-1.5 font-mono text-[21px] font-bold tracking-[0.06em] text-[#30382d]">{submittedRequest.requestNumber}</p>
              <span className="mt-3 inline-flex rounded-full bg-[#e9efe3] px-3 py-1.5 text-[12px] font-semibold text-[#647454]">Pending review</span>
            </div>
            <Link to="/login" className="mt-7 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#222a23] px-6 text-[14px] font-semibold text-white transition hover:bg-[#354236]">Back to Janasiri <ArrowRight size={15} /></Link>
          </motion.section>
        )}
        </AnimatePresence>
        <footer className="flex flex-col items-center justify-between gap-2 px-2 pt-6 text-center text-[12px] text-[#777e72] sm:flex-row sm:text-left">
          <span>© {new Date().getFullYear()} Janasiri Distributors (Pvt) Ltd.</span>
          <span className="inline-flex items-center gap-2"><Phone size={14} /> Need help? <a href="tel:+94814950206" className="font-semibold text-[#62695e] hover:text-[#b9573d]">+94 81 495 0206</a></span>
        </footer>
      </div>


    </main>
  );
}
