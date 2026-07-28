import type { StockReportDetail, StockReportRow } from '../../services/api/stockApi';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Formats a DateOnly ("2026-07-23") or DateTimeOffset ("2026-07-24T21:39:29+05:30") string by
// reading its digits directly, never through a JS Date object — a Date would convert to the
// viewer's browser timezone and shift the day/hour away from the value that was actually uploaded.
function fmtDateOnly(iso: string | null): string {
  if (!iso) return '';
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso;
  const [, y, mo, d] = m;
  return `${d} ${MONTHS[parseInt(mo, 10) - 1]} ${y}`;
}

function fmtExportedAt(iso: string | null): string {
  if (!iso) return '';
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/);
  if (!m) return iso;
  const [, y, mo, d, h, mi, s] = m;
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h12 = ((hour + 11) % 12) + 1;
  return `${d}-${mo}-${y} ${String(h12).padStart(2, '0')}:${mi}:${s} ${ampm}`;
}

const fmtMoney = (n: number | null) =>
  n == null ? '' : n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtOnHand = (n: number | null) => {
  if (n == null) return '';
  return Number.isInteger(n)
    ? n.toLocaleString('en-US')
    : n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

function RowView({ row }: { row: StockReportRow }) {
  switch (row.rowType) {
    case 'GroupHeader':
      return (
        <tr className="bg-emerald-100 border-y border-emerald-200">
          <td colSpan={6} className="px-3 py-2 font-bold text-slate-800 text-[11px]">{row.groupName}</td>
        </tr>
      );
    case 'GroupSubtotal':
      return (
        <tr className="bg-slate-50 border-t-2 border-slate-300 font-bold">
          <td className="px-3 py-2 border border-slate-200" />
          <td className="px-3 py-2 border border-slate-200" />
          <td className="px-3 py-2 border border-slate-200" />
          <td className="px-3 py-2 border border-slate-200" />
          <td className="px-3 py-2 text-right border border-slate-200">{fmtOnHand(row.onHand)}</td>
          <td className="px-3 py-2 text-right border border-slate-200">{fmtMoney(row.amount)}</td>
        </tr>
      );
    case 'GrandTotal':
      return (
        <tr className="sticky bottom-0 bg-amber-100 border-t-2 border-amber-400 font-bold text-[11px] shadow-[0_-2px_8px_-2px_rgba(0,0,0,0.08)]">
          <td className="px-3 py-2.5 border border-amber-300" />
          <td className="px-3 py-2.5 border border-amber-300 text-slate-800 font-extrabold uppercase tracking-wide">Total</td>
          <td className="px-3 py-2.5 border border-amber-300" />
          <td className="px-3 py-2.5 border border-amber-300" />
          <td className="px-3 py-2.5 text-right border border-amber-300">{fmtOnHand(row.onHand)}</td>
          <td className="px-3 py-2.5 text-right border border-amber-300">{fmtMoney(row.amount)}</td>
        </tr>
      );
    case 'Blank':
      return (
        <tr>
          <td colSpan={6} className="h-2" />
        </tr>
      );
    case 'Item':
    default:
      return (
        <tr className="border-b border-slate-100 hover:bg-slate-50/40 transition-colors">
          <td className="px-3 py-1.5 text-slate-600">{row.groupName}</td>
          <td className="px-3 py-1.5 font-mono text-slate-700 whitespace-nowrap">{row.item}</td>
          <td className="px-3 py-1.5 text-slate-700">{row.salesDescription}</td>
          <td className="px-3 py-1.5 text-right">{fmtMoney(row.costExVat)}</td>
          <td className="px-3 py-1.5 text-right">{fmtOnHand(row.onHand)}</td>
          <td className="px-3 py-1.5 text-right font-semibold text-slate-900">{fmtMoney(row.amount)}</td>
        </tr>
      );
  }
}

export default function StockReportTable({ report }: { report: StockReportDetail }) {
  return (
    <div>
      <div className="px-4 py-4 text-center border-b border-slate-200 bg-white">
        <p className="text-sm font-bold text-slate-900">{report.companyName}</p>
        <p className="text-xs font-semibold text-slate-700 mt-0.5">{report.reportTitle}</p>
        {report.dateAsOf && <p className="text-[11px] text-slate-500 mt-1">DATE AS OF : {fmtDateOnly(report.dateAsOf)}</p>}
        {report.exportedAt && <p className="text-[11px] text-slate-400">Export Date and Time {fmtExportedAt(report.exportedAt)}</p>}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse min-w-[720px]">
          <thead>
            <tr className="bg-amber-400 text-slate-900">
              {['GroupName', 'Item', 'SalesDescription', 'Cost (Ex vat)', 'OnHand', 'Amount'].map((h, i) => (
                <th
                  key={h}
                  className={`px-3 py-2.5 font-bold text-[11px] border border-amber-300 ${i >= 3 ? 'text-right' : 'text-left'}`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {report.rows.length === 0 ? (
              <tr><td colSpan={6} className="py-10 text-center text-slate-400">No rows in this report</td></tr>
            ) : (
              report.rows.map(row => <RowView key={row.id} row={row} />)
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
