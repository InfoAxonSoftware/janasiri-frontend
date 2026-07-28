import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { productsApi } from '../../services/api/productsApi';
import type { Product, CreateProductRequest } from '../../types/product.types';
import { X } from 'lucide-react';

export default function ProductEditor() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { id } = useParams(); // id is present when editing
  const isNew = !id;

  const { data: productData, isFetching: loadingProduct } = useQuery({
    queryKey: ['admin-product', id],
    queryFn: () => productsApi.getById(id as string).then(r => r.data.data),
    enabled: !!id,
  });


  const createMut = useMutation({ mutationFn: (d: CreateProductRequest) => productsApi.create(d), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-products'] }); toast.success('Product created'); navigate('/admin/products'); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: { id: string; data: Partial<CreateProductRequest> }) => productsApi.update(id, data), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-products'] }); toast.success('Product updated'); navigate('/admin/products'); } });

  const [form, setForm] = useState({
    name: '', sku: '', sellingPrice: '', quantity: '',
    // import metadata
    discountPercent: '',
    discountAmount: '',
    taxCode: '',
    taxAmount: '',
    totalAmount: '',
  });
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    if (!productData) return;
    setForm({
      name: productData.name || '',
      sku: productData.sku || '',
      sellingPrice: productData.sellingPrice?.toString() || '',
      quantity: productData.quantity?.toString() || '',
      // metadata
      discountPercent: productData.discountPercent?.toString() || '',
      discountAmount: productData.discountAmount?.toString() || '',
      taxCode: productData.taxCode || '',
      taxAmount: productData.taxAmount?.toString() || '',
      totalAmount: productData.totalAmount?.toString() || '',
    });
  }, [productData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: Partial<CreateProductRequest> = {
      name: form.name,
      sku: form.sku,
      sellingPrice: parseFloat(form.sellingPrice) || 0,
      quantity: parseInt(form.quantity) || 0,
      // metadata fields
      discountPercent: form.discountPercent ? parseFloat(form.discountPercent) : undefined,
      discountAmount: form.discountAmount ? parseFloat(form.discountAmount) : undefined,
      taxCode: form.taxCode || undefined,
      taxAmount: form.taxAmount ? parseFloat(form.taxAmount) : undefined,
      totalAmount: form.totalAmount ? parseFloat(form.totalAmount) : undefined,
    };
    if (isNew) createMut.mutate(payload as CreateProductRequest);
    else if (id) updateMut.mutate({ id, data: payload });
  };

  const inputCls = 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none';

  return (
    <div className="px-6 py-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{isNew ? 'New Product' : 'Edit Product'}</h1>
          <p className="text-sm text-slate-500 mt-1">{isNew ? 'Create a new product' : `Update ${productData?.name || ''}`}</p>
        </div>
        <div>
          <button onClick={() => navigate('/admin/products')} className="p-2 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5 text-slate-400" /></button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Name *</label>
              <input required value={form.name} onChange={e => set('name', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">SKU *</label>
              <input required value={form.sku} onChange={e => set('sku', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Rate *</label>
              <input required type="number" step="0.01" value={form.sellingPrice} onChange={e => set('sellingPrice', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Quantity *</label>
              <input required type="number" value={form.quantity} onChange={e => set('quantity', e.target.value)} className={inputCls} />
            </div>
          </div>

          {/* import metadata section (read-only by default) */}
          <div className="mt-4 p-4 bg-slate-50 rounded-lg">
            <h3 className="text-sm font-semibold text-slate-700 mb-2">Import info (optional)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-600 mb-1">Discount %</label>
                <input readOnly value={form.discountPercent} className={inputCls + ' bg-slate-100'} />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">Discount Amt</label>
                <input readOnly value={form.discountAmount} className={inputCls + ' bg-slate-100'} />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">Tax Code</label>
                <input readOnly value={form.taxCode} className={inputCls + ' bg-slate-100'} />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">Tax Amt</label>
                <input readOnly value={form.taxAmount} className={inputCls + ' bg-slate-100'} />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs text-slate-600 mb-1">Total Amount</label>
                <input readOnly value={form.totalAmount} className={inputCls + ' bg-slate-100'} />
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => navigate('/admin/products')} className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-medium transition">Cancel</button>
            <button type="submit" disabled={createMut.isPending || updateMut.isPending} className="flex-1 py-2.5 bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg text-sm font-medium transition disabled:opacity-50">{createMut.isPending || updateMut.isPending ? 'Saving...' : isNew ? 'Create' : 'Update'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
