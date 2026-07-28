import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { regionsApi } from '../../services/api/regionsApi';
import { MapPin, Plus, Edit, Trash2, ChevronDown, ChevronRight, X } from 'lucide-react';
import toast from 'react-hot-toast';
import ConfirmModal from '../../components/common/ConfirmModal';

interface Region {
  id: string;
  name: string;
  isActive: boolean;
  subRegions?: SubRegion[];
}

interface SubRegion {
  id: string;
  name: string;
  regionId: string;
  isActive: boolean;
}

export default function AdminRegions() {
  const qc = useQueryClient();
  const [expandedRegion, setExpandedRegion] = useState<string | null>(null);
  const [showCreateRegion, setShowCreateRegion] = useState(false);
  const [editRegion, setEditRegion] = useState<Region | null>(null);
  const [deleteRegion, setDeleteRegion] = useState<Region | null>(null);
  const [showCreateSubRegion, setShowCreateSubRegion] = useState<string | null>(null); // regionId
  const [editSubRegion, setEditSubRegion] = useState<SubRegion | null>(null);
  const [deleteSubRegion, setDeleteSubRegion] = useState<SubRegion | null>(null);
  const [regionName, setRegionName] = useState('');
  const [subRegionName, setSubRegionName] = useState('');

  const { data: regions, isLoading } = useQuery<Region[]>({
    queryKey: ['admin-regions'],
    queryFn: () => regionsApi.getAll().then((r: any) => r.data),
  });

  // Fetch sub-regions for expanded region
  const { data: subRegions } = useQuery<SubRegion[]>({
    queryKey: ['admin-sub-regions', expandedRegion],
    queryFn: () => regionsApi.getSubRegions(expandedRegion!).then((r: any) => r.data),
    enabled: !!expandedRegion,
  });

  const createRegionMut = useMutation({
    mutationFn: (name: string) => regionsApi.adminCreate({ name }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-regions'] }); setShowCreateRegion(false); setRegionName(''); toast.success('Region created'); },
    onError: () => toast.error('Failed to create region'),
  });

  const updateRegionMut = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => regionsApi.adminUpdate(id, { name }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-regions'] }); setEditRegion(null); setRegionName(''); toast.success('Region updated'); },
    onError: () => toast.error('Failed to update region'),
  });

  const deleteRegionMut = useMutation({
    mutationFn: (id: string) => regionsApi.adminDelete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-regions'] }); setDeleteRegion(null); toast.success('Region deleted'); },
    onError: () => toast.error('Failed to delete region'),
  });

  const createSubRegionMut = useMutation({
    mutationFn: ({ regionId, name }: { regionId: string; name: string }) => regionsApi.adminCreateSubRegion({ regionId, name }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-sub-regions', expandedRegion] }); setShowCreateSubRegion(null); setSubRegionName(''); toast.success('Sub-region created'); },
    onError: () => toast.error('Failed to create sub-region'),
  });

  const updateSubRegionMut = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => regionsApi.adminUpdateSubRegion(id, { name }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-sub-regions', expandedRegion] }); setEditSubRegion(null); setSubRegionName(''); toast.success('Sub-region updated'); },
    onError: () => toast.error('Failed to update sub-region'),
  });

  const deleteSubRegionMut = useMutation({
    mutationFn: (id: string) => regionsApi.adminDeleteSubRegion(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-sub-regions', expandedRegion] }); setDeleteSubRegion(null); toast.success('Sub-region deleted'); },
    onError: () => toast.error('Failed to delete sub-region'),
  });

  const toggleExpand = (regionId: string) => {
    setExpandedRegion(prev => prev === regionId ? null : regionId);
  };

  return (
    <div className="animate-fade-in space-y-5 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Regions & Sub-Regions</h1>
          <p className="text-sm text-slate-500 mt-1">Manage geographic regions and their sub-regions</p>
        </div>
        <button
          onClick={() => { setShowCreateRegion(true); setRegionName(''); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition shadow-sm"
        >
          <Plus className="w-4 h-4" /> Add Region
        </button>
      </div>

      {/* Regions list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />)}
        </div>
      ) : !regions?.length ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center">
          <MapPin className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">No regions created yet</p>
          <button onClick={() => { setShowCreateRegion(true); setRegionName(''); }} className="mt-3 text-sm text-indigo-600 font-medium">Create your first region</button>
        </div>
      ) : (
        <div className="space-y-3">
          {regions.map((region) => (
            <div key={region.id} className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
              {/* Region row */}
              <div className="flex items-center gap-3 px-5 py-4">
                <button onClick={() => toggleExpand(region.id)} className="p-1 hover:bg-slate-100 rounded-lg transition">
                  {expandedRegion === region.id ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
                </button>
                <MapPin className="w-4 h-4 text-indigo-500" />
                <span className="font-semibold text-slate-900 flex-1">{region.name}</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${region.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                  {region.isActive ? 'Active' : 'Inactive'}
                </span>
                <button onClick={() => { setEditRegion(region); setRegionName(region.name); }} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition">
                  <Edit className="w-4 h-4" />
                </button>
                <button onClick={() => setDeleteRegion(region)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Sub-regions (expanded) */}
              {expandedRegion === region.id && (
                <div className="border-t border-slate-100 bg-slate-50/50">
                  <div className="px-5 py-3">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Sub-Regions</span>
                      <button
                        onClick={() => { setShowCreateSubRegion(region.id); setSubRegionName(''); }}
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-medium hover:bg-indigo-100 transition"
                      >
                        <Plus className="w-3 h-3" /> Add
                      </button>
                    </div>

                    {!subRegions?.length ? (
                      <p className="text-sm text-slate-400 py-2">No sub-regions yet</p>
                    ) : (
                      <div className="space-y-2">
                        {subRegions.map((sub) => (
                          <div key={sub.id} className="flex items-center gap-3 px-3 py-2.5 bg-white rounded-lg border border-slate-100">
                            <span className="text-sm text-slate-700 flex-1">{sub.name}</span>
                            <button onClick={() => { setEditSubRegion(sub); setSubRegionName(sub.name); }} className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition">
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => setDeleteSubRegion(sub)} className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-500 transition">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Inline create sub-region */}
                    {showCreateSubRegion === region.id && (
                      <div className="flex items-center gap-2 mt-3">
                        <input
                          autoFocus
                          value={subRegionName}
                          onChange={e => setSubRegionName(e.target.value)}
                          placeholder="Sub-region name"
                          className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500/15 focus:border-indigo-300"
                          onKeyDown={e => { if (e.key === 'Enter' && subRegionName.trim()) createSubRegionMut.mutate({ regionId: region.id, name: subRegionName.trim() }); }}
                        />
                        <button
                          onClick={() => { if (subRegionName.trim()) createSubRegionMut.mutate({ regionId: region.id, name: subRegionName.trim() }); }}
                          disabled={!subRegionName.trim() || createSubRegionMut.isPending}
                          className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
                        >
                          Add
                        </button>
                        <button onClick={() => { setShowCreateSubRegion(null); setSubRegionName(''); }} className="p-2 hover:bg-slate-100 rounded-lg">
                          <X className="w-4 h-4 text-slate-400" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create Region Modal */}
      {showCreateRegion && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Create Region</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-2">Region Name</label>
              <input
                autoFocus
                type="text"
                value={regionName}
                onChange={e => setRegionName(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/15 focus:border-indigo-300"
                placeholder="e.g. Western Province"
                onKeyDown={e => { if (e.key === 'Enter' && regionName.trim()) createRegionMut.mutate(regionName.trim()); }}
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowCreateRegion(false)} className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50 transition">Cancel</button>
              <button onClick={() => { if (regionName.trim()) createRegionMut.mutate(regionName.trim()); }} disabled={!regionName.trim() || createRegionMut.isPending} className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium disabled:opacity-50">
                {createRegionMut.isPending ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Region Modal */}
      {editRegion && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Edit Region</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-2">Region Name</label>
              <input
                autoFocus
                type="text"
                value={regionName}
                onChange={e => setRegionName(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/15 focus:border-indigo-300"
                onKeyDown={e => { if (e.key === 'Enter' && regionName.trim()) updateRegionMut.mutate({ id: editRegion.id, name: regionName.trim() }); }}
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setEditRegion(null)} className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50 transition">Cancel</button>
              <button onClick={() => { if (regionName.trim()) updateRegionMut.mutate({ id: editRegion.id, name: regionName.trim() }); }} disabled={!regionName.trim() || updateRegionMut.isPending} className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium disabled:opacity-50">
                {updateRegionMut.isPending ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Sub-Region Modal */}
      {editSubRegion && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Edit Sub-Region</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-2">Sub-Region Name</label>
              <input
                autoFocus
                type="text"
                value={subRegionName}
                onChange={e => setSubRegionName(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/15 focus:border-indigo-300"
                onKeyDown={e => { if (e.key === 'Enter' && subRegionName.trim()) updateSubRegionMut.mutate({ id: editSubRegion.id, name: subRegionName.trim() }); }}
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setEditSubRegion(null)} className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50 transition">Cancel</button>
              <button onClick={() => { if (subRegionName.trim()) updateSubRegionMut.mutate({ id: editSubRegion.id, name: subRegionName.trim() }); }} disabled={!subRegionName.trim() || updateSubRegionMut.isPending} className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium disabled:opacity-50">
                {updateSubRegionMut.isPending ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Region Confirm */}
      {deleteRegion && (
        <ConfirmModal
          open={true}
          title="Delete Region"
          description={`Are you sure you want to delete "${deleteRegion.name}"? All sub-regions will also be deleted.`}
          confirmLabel="Delete"
          onConfirm={() => deleteRegionMut.mutate(deleteRegion.id)}
          onCancel={() => setDeleteRegion(null)}
        />
      )}

      {/* Delete Sub-Region Confirm */}
      {deleteSubRegion && (
        <ConfirmModal
          open={true}
          title="Delete Sub-Region"
          description={`Are you sure you want to delete "${deleteSubRegion.name}"?`}
          confirmLabel="Delete"
          onConfirm={() => deleteSubRegionMut.mutate(deleteSubRegion.id)}
          onCancel={() => setDeleteSubRegion(null)}
        />
      )}
    </div>
  );
}
