import { useState, Fragment } from 'react';
import { useQuery } from '@tanstack/react-query';
import { stockApi } from '../../services/api/stockApi';
import type { StockReportSummary } from '../../services/api/stockApi';
import { Warehouse, ChevronDown, ChevronRight } from 'lucide-react';
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

export default function RepStockReports() {
  const [expandedRegionId, setExpandedRegionId] = useState<string | null>(null);

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['rep-stock-reports'],
    queryFn: () => stockApi.getRepReports().then(r => r.data.data),
    staleTime: 5 * 60 * 1000,
  });

  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: ['rep-stock-detail', expandedRegionId],
    queryFn: () => stockApi.getRepReportByRegion(expandedRegionId!).then(r => r.data.data),
    enabled: !!expandedRegionId,
  });

  if (isLoading) {
    return (
      <div className="animate-fade-in space-y-5 pb-10">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Stock Reports</h1>
          <p className="text-sm text-slate-500 mt-0.5">Stock summary reports for your regions</p>
        </div>
        <div className="py-20 text-center">
          <div className="w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-slate-500 mt-4">Loading reports…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-5 pb-10">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Stock Reports</h1>
        <p className="text-sm text-slate-500 mt-0.5">Stock summary reports for your assigned regions</p>
      </div>

      {reports.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-200 py-20 text-center">
          <Warehouse className="w-12 h-12 mx-auto text-slate-200 mb-4" />
          <p className="text-lg font-semibold text-slate-700">No reports available</p>
          <p className="text-sm text-slate-400 mt-1">Stock reports for your regions will appear here once uploaded by admin</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
            <Warehouse className="w-4 h-4 text-violet-600" />
            <h2 className="text-sm font-bold text-slate-800">Uploaded Reports</h2>
            <span className="px-2 py-0.5 bg-violet-100 text-violet-700 text-[10px] font-bold rounded-full">{reports.length}</span>
          </div>
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
                  <th className="w-24 px-3 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reports.map((report: StockReportSummary) => (
                  <Fragment key={report.id}>
                    <tr className={`transition-colors ${expandedRegionId === report.regionId ? 'bg-violet-50/40' : 'hover:bg-slate-50/60'}`}>
                      <td className="px-4 py-3 font-semibold text-slate-900">{report.regionName}</td>
                      <td className="px-3 py-3 text-center text-slate-600">{fmtDate(report.dateAsOf)}</td>
                      <td className="px-3 py-3 text-center text-slate-500">{report.rowCount}</td>
                      <td className="px-3 py-3 text-right text-slate-600">{fmtMoney(report.totalOnHand)}</td>
                      <td className="px-3 py-3 text-right text-slate-900 font-semibold">{fmtMoney(report.totalAmount)}</td>
                      <td className="px-3 py-3 text-center text-slate-500 text-xs">{fmtDate(report.uploadedAt)}</td>
                      <td className="px-3 py-3 text-right">
                        <button onClick={() => setExpandedRegionId(expandedRegionId === report.regionId ? null : report.regionId)}
                          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition flex items-center gap-1 ml-auto ${
                            expandedRegionId === report.regionId
                              ? 'text-violet-700 bg-violet-200 hover:bg-violet-300'
                              : 'text-violet-600 bg-violet-50 hover:bg-violet-100'
                          }`}>
                          {expandedRegionId === report.regionId ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />} View
                        </button>
                      </td>
                    </tr>
                    {expandedRegionId === report.regionId && (
                      <tr>
                        <td colSpan={7} className="p-0">
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
        </div>
      )}
    </div>
  );
}
