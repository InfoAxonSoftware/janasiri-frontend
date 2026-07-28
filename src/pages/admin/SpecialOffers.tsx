import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Gift, Plus, Pencil, Trash2, Sparkles,
  Search, X, SlidersHorizontal, ArrowUpDown,
  Check, ChevronRight, CheckCircle, XCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { offersApi } from '../../services/api/offersApi';
import { productsApi } from '../../services/api/productsApi';
import type { SpecialOffer } from '../../types/offer.types';
import type { Product } from '../../types/product.types';

export default function AdminSpecialOffers() {
  const qc = useQueryClient();

  // ── Data ──────────────────────────────────────────────────────────────
  const { data: offers = [], isLoading } = useQuery<SpecialOffer[]>({
    queryKey: ['special-offers-admin'],
    queryFn: () => offersApi.adminGetAll().then(r => r.data.data || []),
  });

  const { data: productsData, isLoading: productsLoading } = useQuery({
    queryKey: ['special-offer-products-dropdown'],
    queryFn: () => productsApi.getAll({ page: 1, pageSize: 500, sortBy: 'name', sortDir: 'asc' }).then(r => r.data.data),
  });
  const products = useMemo(() => productsData?.items || [], [productsData]);

  // ── Form + toolbar state ──────────────────────────────────────────────
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ productName: '', offerBrief: '', isActive: true });

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [toolbarPanel, setToolbarPanel] = useState<'filter' | 'sort' | null>(null);
  const [sortField, setSortField] = useState<'productName' | 'createdAt'>('createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SpecialOffer | null>(null);

  // ── Mutations ─────────────────────────────────────────────────────────
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['special-offers-admin'] });
    qc.invalidateQueries({ queryKey: ['special-offers-public'] });
  };

  const createMut = useMutation({
    mutationFn: (data: any) => offersApi.adminCreate(data),
    onSuccess: () => { invalidate(); resetForm(); toast.success('Offer created'); },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed to create offer'),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => offersApi.adminUpdate(id, data),
    onSuccess: () => { invalidate(); resetForm(); toast.success('Offer updated'); },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed to update offer'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => offersApi.adminDelete(id),
    onSuccess: () => { invalidate(); setDeleteTarget(null); toast.success('Offer deleted'); },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed to delete offer'),
  });

  const toggleActiveMut = useMutation({
    mutationFn: (offer: SpecialOffer) =>
      offersApi.adminUpdate(offer.id, {
        productName: offer.productName,
        offerBrief: offer.offerBrief,
        isActive: !offer.isActive,
      }),
    onSuccess: () => { invalidate(); toast.success('Status updated'); },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed to update status'),
  });

  // ── Helpers ───────────────────────────────────────────────────────────
  const resetForm = () => {
    setForm({ productName: '', offerBrief: '', isActive: true });
    setEditingId(null);
    setShowForm(false);
  };

  const startEdit = (offer: SpecialOffer) => {
    setEditingId(offer.id);
    setForm({ productName: offer.productName, offerBrief: offer.offerBrief, isActive: offer.isActive });
    setShowForm(true);
    setToolbarPanel(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSave = () => {
    if (!form.productName.trim() || !form.offerBrief.trim()) {
      toast.error('Please select a product and enter an offer brief');
      return;
    }
    const payload = {
      productName: form.productName.trim(),
      offerBrief: form.offerBrief.trim(),
      isActive: form.isActive,
    };
    if (editingId) updateMut.mutate({ id: editingId, data: payload });
    else createMut.mutate(payload);
  };

  const togglePanel = (p: 'filter' | 'sort') =>
    setToolbarPanel(prev => prev === p ? null : p);

  // ── Filtered + sorted list ─────────────────────────────────────────────
  const filteredOffers = useMemo(() => {
    let result = [...offers];
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(o =>
        o.productName.toLowerCase().includes(q) || o.offerBrief.toLowerCase().includes(q)
      );
    }
    if (statusFilter === 'active') result = result.filter(o => o.isActive);
    if (statusFilter === 'inactive') result = result.filter(o => !o.isActive);
    result.sort((a, b) => {
      const va = sortField === 'productName' ? a.productName : a.createdAt;
      const vb = sortField === 'productName' ? b.productName : b.createdAt;
      const cmp = va < vb ? -1 : va > vb ? 1 : 0;
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return result;
  }, [offers, search, statusFilter, sortField, sortDir]);

  const inputCls =
    'w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/15 focus:border-indigo-300 transition';

  return (
    <div className="animate-fade-in flex flex-col gap-4 pb-28">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Special Offers</h1>
        <p className="text-slate-500 text-sm mt-1">Create and manage customer-facing special offers</p>
      </div>

      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-30">
        <div className="bg-white/95 backdrop-blur-md border border-slate-200/70 rounded-2xl shadow-[0_2px_16px_-4px_rgba(0,0,0,0.08)] overflow-hidden">

          {/* Row 1: Search + counter */}
          <div className="px-4 pt-3 pb-3 flex items-center gap-2.5 flex-wrap">
            <div className="relative flex-1 min-w-[180px] group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-rose-500 transition-colors" />
              <input
                type="text"
                placeholder="Search product or offer…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm placeholder-slate-400 focus:bg-white focus:border-rose-400 focus:ring-2 focus:ring-rose-500/15 outline-none transition-all"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="hidden sm:block h-7 w-px bg-slate-200" />
            <span className="hidden sm:inline text-xs text-slate-400 select-none">
              {filteredOffers.length} offer{filteredOffers.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Row 2: Control bar */}
          <div className="px-2 py-1 sm:px-3 sm:py-1.5 bg-slate-50/80 border-t border-slate-100 flex items-center">
            <button
              onClick={() => togglePanel('filter')}
              className={`flex-1 inline-flex items-center justify-center gap-1 sm:gap-1.5 px-1.5 sm:px-3 py-2 sm:py-1.5 rounded-lg text-[11px] sm:text-xs font-medium transition-all ${toolbarPanel === 'filter' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" />
              <span>Filter</span>
              {statusFilter !== 'all' && (
                <span className="inline-flex items-center justify-center min-w-[16px] h-4 rounded-full bg-indigo-600 text-white text-[9px] font-bold leading-none px-1">1</span>
              )}
            </button>
            <div className="w-px h-5 bg-slate-200" />
            <button
              onClick={() => togglePanel('sort')}
              className={`flex-1 inline-flex items-center justify-center gap-1 sm:gap-1.5 px-1.5 sm:px-3 py-2 sm:py-1.5 rounded-lg text-[11px] sm:text-xs font-medium transition-all ${toolbarPanel === 'sort' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              <ArrowUpDown className="w-3.5 h-3.5 shrink-0" />
              <span>Sort</span>
            </button>
            <div className="w-px h-5 bg-slate-200" />
            <button
              onClick={() => { resetForm(); setShowForm(s => !s); setToolbarPanel(null); }}
              className={`flex-1 inline-flex items-center justify-center gap-1 sm:gap-1.5 px-1.5 sm:px-3 py-2 sm:py-1.5 rounded-lg text-[11px] sm:text-xs font-medium transition-all ${showForm && !editingId ? 'bg-rose-100 text-rose-700' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              <Plus className="w-3.5 h-3.5 shrink-0" />
              <span>New Offer</span>
            </button>
          </div>

          {/* Filter Panel */}
          {toolbarPanel === 'filter' && (
            <div className="px-3 py-2.5 sm:px-4 sm:py-3 border-t border-slate-100 bg-white">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                {(['all', 'active', 'inactive'] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium border transition-all ${statusFilter === s ? 'bg-black border-black text-white' : 'bg-white border-black text-slate-700 hover:bg-black hover:text-white'}`}
                  >
                    {statusFilter === s && <Check className="w-3 h-3" />}
                    {s === 'all' ? 'All Offers' : s === 'active' ? 'Active' : 'Inactive'}
                  </button>
                ))}
                {statusFilter !== 'all' && (
                  <button onClick={() => setStatusFilter('all')} className="ml-auto text-xs text-red-500 hover:text-red-700 font-medium">clear</button>
                )}
              </div>
            </div>
          )}

          {/* Sort Panel */}
          {toolbarPanel === 'sort' && (
            <div className="px-3 py-2.5 sm:px-4 sm:py-3 border-t border-slate-100 bg-white">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <button
                  onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border bg-white border-black text-slate-700 hover:bg-black hover:text-white transition-all"
                >
                  {sortDir === 'asc' ? '↑ Ascending' : '↓ Descending'}
                </button>
                <div className="w-px h-4 bg-slate-200 mx-0.5" />
                {([
                  { field: 'createdAt' as const, label: 'Date Added' },
                  { field: 'productName' as const, label: 'Product Name' },
                ]).map(({ field, label }) => (
                  <button
                    key={field}
                    onClick={() => { if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else setSortField(field); }}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium border transition-all ${sortField === field ? 'bg-black border-black text-white' : 'bg-white border-black text-slate-700 hover:bg-black hover:text-white'}`}
                  >
                    {sortField === field && <Check className="w-3 h-3" />}{label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Create / Edit Form Panel ──────────────────────────────────────── */}
      {showForm && (
        <div
          className="bg-white rounded-2xl border border-rose-200 shadow-sm overflow-hidden"
          style={{ animation: 'fadeIn 0.2s ease-out both' }}
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-rose-100 bg-rose-50/50">
            <div className="flex items-center gap-2.5">
              <span className="p-2 bg-rose-100 rounded-xl">
                <Gift className="w-4 h-4 text-rose-600" />
              </span>
              <div>
                <h2 className="text-sm font-semibold text-slate-900">{editingId ? 'Edit Offer' : 'New Special Offer'}</h2>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {editingId ? 'Update the offer details below' : 'Fill in the details to create a new offer'}
                </p>
              </div>
            </div>
            <button onClick={resetForm} className="p-2 hover:bg-rose-100 rounded-xl transition text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Product <span className="text-red-400">*</span>
              </label>
              <select
                value={form.productName}
                onChange={e => setForm(p => ({ ...p, productName: e.target.value }))}
                className={inputCls}
                disabled={productsLoading}
              >
                <option value="">{productsLoading ? 'Loading…' : 'Select a product'}</option>
                {products.map((p: Product) => (
                  <option key={p.id} value={p.name}>{p.name}</option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-1 lg:col-span-2">
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Offer Brief <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={form.offerBrief}
                onChange={e => setForm(p => ({ ...p, offerBrief: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && handleSave()}
                className={inputCls}
                placeholder="e.g. Buy 2 and get Rs.200 off this week"
              />
            </div>

            <div className="sm:col-span-2 lg:col-span-3 flex items-center justify-between flex-wrap gap-3">
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <button
                  type="button"
                  onClick={() => setForm(p => ({ ...p, isActive: !p.isActive }))}
                  className={`relative w-9 h-5 rounded-full transition-colors ${form.isActive ? 'bg-emerald-500' : 'bg-slate-300'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.isActive ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
                <span className="text-sm text-slate-700">Show on customer banner</span>
                <span className={`text-xs font-semibold ${form.isActive ? 'text-emerald-600' : 'text-slate-400'}`}>
                  {form.isActive ? 'Active' : 'Inactive'}
                </span>
              </label>
              <div className="flex items-center gap-2">
                <button
                  onClick={resetForm}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={createMut.isPending || updateMut.isPending}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700 disabled:opacity-50 transition"
                >
                  {editingId ? <Pencil className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                  {(createMut.isPending || updateMut.isPending)
                    ? 'Saving…'
                    : editingId ? 'Update Offer' : 'Create Offer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Offers List ───────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-10 text-center text-slate-400 text-sm">Loading offers…</div>
        ) : filteredOffers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <Gift className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-sm font-medium">
              {search || statusFilter !== 'all' ? 'No offers match your filters' : 'No special offers yet'}
            </p>
            {!showForm && (
              <button
                onClick={() => { resetForm(); setShowForm(true); }}
                className="mt-3 flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 transition"
              >
                <Plus className="w-3.5 h-3.5" /> Create First Offer
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Desktop table (≥ lg) */}
            <table className="hidden lg:table w-full text-[12px] border-collapse border border-slate-200">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200">
                  <th className="px-3 py-3.5 w-8 border-r border-slate-200" />
                  <th className="px-4 py-3.5 text-left text-xs font-bold text-slate-700 uppercase tracking-wider border-r border-slate-200">Product</th>
                  <th className="px-4 py-3.5 text-left text-xs font-bold text-slate-700 uppercase tracking-wider border-r border-slate-200">Offer Brief</th>
                  <th className="px-4 py-3.5 text-center text-xs font-bold text-slate-700 uppercase tracking-wider border-r border-slate-200">Status</th>
                  <th className="px-4 py-3.5 text-center text-xs font-bold text-slate-700 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredOffers.map(offer => (
                  <>
                    <tr
                      key={offer.id}
                      onClick={() => setExpandedId(p => p === offer.id ? null : offer.id)}
                      className={`border-b border-slate-100 cursor-pointer transition-colors select-none ${
                        expandedId === offer.id ? 'bg-rose-50/40 border-rose-100' : 'hover:bg-slate-50/70'
                      }`}
                    >
                      <td className="px-3 py-3.5 border border-slate-200">
                        <ChevronRight className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${expandedId === offer.id ? 'rotate-90 text-rose-400' : ''}`} />
                      </td>
                      <td className="px-4 py-3.5 border border-slate-200">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-rose-50 to-amber-50 flex items-center justify-center shrink-0">
                            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                          </div>
                          <span className="font-semibold text-slate-900 text-xs">{offer.productName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-slate-500 border border-slate-200 max-w-xs">
                        <p className="truncate">{offer.offerBrief}</p>
                      </td>
                      <td className="px-4 py-3.5 text-center border border-slate-200">
                        <button
                          onClick={e => { e.stopPropagation(); toggleActiveMut.mutate(offer); }}
                          disabled={toggleActiveMut.isPending}
                          title="Click to toggle"
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all disabled:opacity-50 ${
                            offer.isActive
                              ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                              : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                          }`}
                        >
                          {offer.isActive
                            ? <><CheckCircle className="w-3 h-3" /> Active</>
                            : <><XCircle className="w-3 h-3" /> Inactive</>}
                        </button>
                      </td>
                      <td className="px-4 py-3.5 border border-slate-200" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => startEdit(offer)} title="Edit" className="p-1.5 rounded-lg hover:bg-indigo-50 text-indigo-600 transition">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => setDeleteTarget(offer)} title="Delete" className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>

                    {expandedId === offer.id && (
                      <tr key={`${offer.id}-exp`} className="border-b border-rose-100">
                        <td colSpan={5} className="p-0">
                          <div className="bg-gradient-to-b from-rose-50/60 to-slate-50/30 px-8 py-5" style={{ animation: 'fadeIn 0.18s ease-out both' }}>
                            <div className="flex items-start gap-4">
                              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-100 to-amber-100 flex items-center justify-center shrink-0">
                                <Sparkles className="w-5 h-5 text-amber-500" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-slate-900">{offer.productName}</p>
                                <p className="text-sm text-slate-600 mt-1 leading-relaxed">{offer.offerBrief}</p>
                                <div className="flex items-center gap-3 mt-3">
                                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold ${offer.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                                    {offer.isActive ? <><CheckCircle className="w-3 h-3" /> Active</> : <><XCircle className="w-3 h-3" /> Inactive</>}
                                  </span>
                                  <span className="text-xs text-slate-400">
                                    Added {new Date(offer.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <button
                                  onClick={() => startEdit(offer)}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-medium hover:bg-indigo-600 hover:text-white hover:border-indigo-600 transition"
                                >
                                  <Pencil className="w-3.5 h-3.5" /> Edit
                                </button>
                                <button
                                  onClick={() => setDeleteTarget(offer)}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 text-red-600 border border-red-200 text-xs font-medium hover:bg-red-600 hover:text-white hover:border-red-600 transition"
                                >
                                  <Trash2 className="w-3.5 h-3.5" /> Delete
                                </button>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>

            {/* Mobile card list (< lg) */}
            <div className="lg:hidden">
              {filteredOffers.map(offer => (
                <div key={offer.id}>
                  <div
                    onClick={() => setExpandedId(p => p === offer.id ? null : offer.id)}
                    className={`flex items-center gap-3 px-4 py-3 border-b border-slate-100 transition-colors cursor-default select-none ${expandedId === offer.id ? 'bg-rose-50/40' : 'active:bg-slate-50'}`}
                  >
                    <div className="shrink-0 w-9 h-9 rounded-xl bg-gradient-to-br from-rose-50 to-amber-50 flex items-center justify-center">
                      <Sparkles className="w-4 h-4 text-amber-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{offer.productName}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5 truncate">{offer.offerBrief}</p>
                    </div>
                    <span className={`shrink-0 inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold ${offer.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                      {offer.isActive ? 'Active' : 'Inactive'}
                    </span>
                    <ChevronRight className={`shrink-0 w-4 h-4 text-slate-300 transition-transform duration-200 ${expandedId === offer.id ? 'rotate-90 text-rose-400' : ''}`} />
                  </div>
                  {expandedId === offer.id && (
                    <div className="bg-rose-50/30 px-4 py-3 border-b border-rose-100 space-y-3">
                      <p className="text-sm text-slate-700 leading-relaxed">{offer.offerBrief}</p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => toggleActiveMut.mutate(offer)}
                          disabled={toggleActiveMut.isPending}
                          className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-lg disabled:opacity-50 transition ${offer.isActive ? 'bg-slate-100 text-slate-600' : 'bg-emerald-50 text-emerald-700'}`}
                        >
                          {offer.isActive ? <><XCircle className="w-3.5 h-3.5" /> Deactivate</> : <><CheckCircle className="w-3.5 h-3.5" /> Activate</>}
                        </button>
                        <button onClick={() => startEdit(offer)} className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-lg bg-indigo-50 text-indigo-700">
                          <Pencil className="w-3.5 h-3.5" /> Edit
                        </button>
                        <button onClick={() => setDeleteTarget(offer)} className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-lg bg-red-50 text-red-600">
                          <Trash2 className="w-3.5 h-3.5" /> Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── Delete Confirm Modal ──────────────────────────────────────────── */}
      {deleteTarget && createPortal(
        <div className="fixed inset-0 z-50 flex items-start justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => setDeleteTarget(null)} />
          <div
            className="relative mt-20 w-full max-w-sm mx-4 bg-white rounded-2xl shadow-2xl border border-slate-200"
            style={{ animation: 'slideDown 0.25s ease-out both' }}
          >
            <div className="p-6 text-center">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <h3 className="font-semibold text-slate-900 mb-1">Delete Offer?</h3>
              <p className="text-sm text-slate-500 mb-5">
                Are you sure you want to delete the offer for{' '}
                <span className="font-semibold text-slate-700">"{deleteTarget.productName}"</span>?
                This cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteTarget(null)}
                  className="flex-1 py-2.5 bg-slate-100 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-200 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={() => deleteMut.mutate(deleteTarget.id)}
                  disabled={deleteMut.isPending}
                  className="flex-1 py-2.5 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 disabled:opacity-50 transition"
                >
                  {deleteMut.isPending ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}