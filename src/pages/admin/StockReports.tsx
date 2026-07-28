import { useState, useRef, Fragment } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { stockApi } from '../../services/api/stockApi';
import type { StockReportSummary } from '../../services/api/stockApi';
import { regionsApi } from '../../services/api/regionsApi';
import toast from 'react-hot-toast';
import {
  Upload, Trash2, ChevronDown, ChevronRight, Warehouse, RefreshCw, FileSpreadsheet, AlertCircle,
} from 'lucide-react';
import ConfirmModal from '../../components/common/ConfirmModal';
import StockReportTable from '../../components/common/StockReportTable';

const fmtDate = (d: string | null) => {
  if (!d) return '';
  const m = d.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return d;
  const [, y, mo, day] = m;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${day} ${months[parseInt(mo, 10) - 1]} ${y}`;
};

const fmtMoney = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function AdminStockReports() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [selectedRegionId, setSelectedRegionId] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [viewingRegionId, setViewingRegionId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ regionId: string; regionName: string } | null>(null);

  const { data: regions = [] } = useQuery({
    queryKey: ['regions'],
    queryFn: () => regionsApi.getAll().then(r => r.data),
  });

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['admin-stock-reports'],
    queryFn: () => stockApi.getAllReports().then(r => r.data.data),
  });

  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: ['admin-stock-detail', viewingRegionId],
    queryFn: () => stockApi.getReportByRegion(viewingRegionId!).then(r => r.data.data),
    enabled: !!viewingRegionId,
  });

  const deleteMut = useMutation({
    mutationFn: (regionId: string) => stockApi.deleteReport(regionId),
    onSuccess: (_, regionId) => {
      toast.success('Report deleted');
      qc.invalidateQueries({ queryKey: ['admin-stock-reports'] });
      if (viewingRegionId === regionId) setViewingRegionId(null);
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Delete failed'),
  });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !selectedRegionId) return;

    setUploading(true);
    try {
      await stockApi.uploadReport(selectedRegionId, file);
      await qc.invalidateQueries({ queryKey: ['admin-stock-reports'] });
      if (viewingRegionId === selectedRegionId)
        await qc.invalidateQueries({ queryKey: ['admin-stock-detail', selectedRegionId] });
      toast.success(`Uploaded stock report for ${regions.find((r: any) => r.id === selectedRegionId)?.name ?? ''}`);
      setSelectedRegionId('');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const reportMap = new Map((reports as StockReportSummary[]).map(r => [r.regionId, r]));

  return (
    <div className="animate-fade-in space-y-5 pb-10">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Stock Reports</h1>
          <p className="text-sm text-slate-500 mt-0.5">Upload & manage stock summary reports by region</p>
        </div>
      </div>

      {/* Upload Panel */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 relative z-10">
        <h2 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
          <Upload className="w-4 h-4 text-emerald-600" /> Upload Excel Report
        </h2>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Region *</label>
            <select value={selectedRegionId} onChange={e => setSelectedRegionId(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 outline-none">
              <option value="">Select region…</option>
              {regions.map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <button
            disabled={!selectedRegionId || uploading}
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition">
            {uploading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
            {uploading ? 'Uploading…' : 'Choose Excel File'}
          </button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileSelect} />
        </div>
        {reportMap.has(selectedRegionId) && (
          <p className="mt-2 text-xs text-amber-600 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5" />
            A report already exists for this region — uploading will replace it.
          </p>
        )}
      </div>

      {/* Reports Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <Warehouse className="w-4 h-4 text-violet-600" />
            Uploaded Reports
            {reports.length > 0 && <span className="px-2 py-0.5 bg-violet-100 text-violet-700 text-[10px] font-bold rounded-full">{reports.length}</span>}
          </h2>
        </div>
        {isLoading ? (
          <div className="py-14 text-center"><div className="w-7 h-7 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" /></div>
        ) : reports.length === 0 ? (
          <div className="py-14 text-center">
            <FileSpreadsheet className="w-10 h-10 mx-auto text-slate-200 mb-3" />
            <p className="text-sm text-slate-400">No stock reports uploaded yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-[11px] uppercase tracking-wider">
                  <th className="text-left px-4 py-3 font-semibold">Region</th>
                  <th className="text-center px-3 py-3 font-semibold">Date As Of</th>
                  <th className="text-center px-3 py-3 font-semibold">Rows</th>
                  <th className="text-right px-3 py-3 font-semibold">Total On Hand</th>
                  <th className="text-right px-3 py-3 font-semibold">Total Amount</th>
                  <th className="text-center px-3 py-3 font-semibold">Uploaded</th>
                  <th className="text-center px-3 py-3 font-semibold">By</th>
                  <th className="w-32 px-3 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reports.map((r: StockReportSummary) => (
                  <Fragment key={r.id}>
                    <tr className={`transition-colors ${viewingRegionId === r.regionId ? 'bg-violet-50/40' : 'hover:bg-slate-50/60'}`}>
                      <td className="px-4 py-3 font-semibold text-slate-900">{r.regionName}</td>
                      <td className="px-3 py-3 text-center text-slate-600">{fmtDate(r.dateAsOf)}</td>
                      <td className="px-3 py-3 text-center text-slate-500">{r.rowCount}</td>
                      <td className="px-3 py-3 text-right text-slate-600">{fmtMoney(r.totalOnHand)}</td>
                      <td className="px-3 py-3 text-right text-slate-900 font-semibold">{fmtMoney(r.totalAmount)}</td>
                      <td className="px-3 py-3 text-center text-slate-500 text-xs">{fmtDate(r.uploadedAt)}</td>
                      <td className="px-3 py-3 text-center text-slate-500 text-xs truncate max-w-[120px]">{r.uploadedBy || '—'}</td>
                      <td className="px-3 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => setViewingRegionId(viewingRegionId === r.regionId ? null : r.regionId)}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition flex items-center gap-1 ${
                              viewingRegionId === r.regionId
                                ? 'text-violet-700 bg-violet-200 hover:bg-violet-300'
                                : 'text-violet-600 bg-violet-50 hover:bg-violet-100'
                            }`}>
                            {viewingRegionId === r.regionId ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />} View
                          </button>
                          <button onClick={() => setDeleteTarget({ regionId: r.regionId, regionName: r.regionName })}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 transition">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {viewingRegionId === r.regionId && (
                      <tr>
                        <td colSpan={8} className="p-0">
                          <div className="border-t-2 border-violet-200">
                            {detailLoading || !detail ? (
                              <div className="py-10 text-center"><div className="w-6 h-6 border-4 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto" /></div>
                            ) : (
                              <StockReportTable report={detail} />
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmModal
        open={!!deleteTarget}
        title="Delete Report"
        description={`Delete the stock report for "${deleteTarget?.regionName}"? This cannot be undone.`}
        confirmLabel="Delete"
        confirmVariant="red"
        onConfirm={() => { if (deleteTarget) { deleteMut.mutate(deleteTarget.regionId); setDeleteTarget(null); } }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
