import React from 'react';
import { ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T, index: number) => React.ReactNode;
  className?: string;
  align?: 'left' | 'center' | 'right';
  sortable?: boolean;
  sortKey?: string;  // defaults to key if not set
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  /** Extract unique key per row — provide either keyField or keyExtractor */
  keyField?: string;
  keyExtractor?: (row: T) => string;
  onRowClick?: (row: T) => void;
  isLoading?: boolean;
  /** Simple empty text */
  emptyMessage?: string;
  emptyIcon?: React.ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
  /** Complete empty state ReactNode (takes precedence over emptyMessage/emptyTitle) */
  emptyState?: React.ReactNode;
  page?: number;
  totalPages?: number;
  totalCount?: number;
  onPageChange?: (page: number) => void;
  hoverable?: boolean;
  striped?: boolean;
  sortField?: string;
  sortDir?: 'asc' | 'desc';
  onSort?: (field: string) => void;
}

function SkeletonRow({ cols }: { cols: number }) {
  return (
    <tr className="border-b border-slate-50">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3.5">
          <div className="h-4 w-3/4 rounded bg-slate-100 animate-pulse" />
        </td>
      ))}
    </tr>
  );
}

export default function DataTable<T>({
  columns,
  data,
  keyField,
  keyExtractor,
  onRowClick,
  isLoading = false,
  emptyMessage = 'No data found',
  emptyIcon,
  emptyTitle,
  emptyDescription,
  emptyState,
  page,
  totalPages,
  totalCount,
  onPageChange,
  hoverable = true,
  striped = false,
  sortField,
  sortDir,
  onSort,
}: DataTableProps<T>) {
  const getKey = (row: T) => {
    if (keyExtractor) return keyExtractor(row);
    if (keyField) return String((row as any)[keyField]);
    return String((row as any).id ?? Math.random());
  };

  const alignClass = (align?: string) =>
    align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left';

  const renderEmpty = () => {
    if (emptyState) return emptyState;
    return (
      <div className="flex flex-col items-center gap-3">
        {emptyIcon && <div className="text-slate-300">{emptyIcon}</div>}
        <div className="text-center">
          <p className="text-slate-500 font-medium">{emptyTitle || emptyMessage}</p>
          {emptyDescription && <p className="text-sm text-slate-400 mt-1">{emptyDescription}</p>}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50/80 border-b border-slate-200/60">
              {columns.map((col) => {
                const sk = col.sortKey || col.key;
                const isSorted = sortField === sk;
                return (
                  <th
                    key={col.key}
                    onClick={col.sortable && onSort ? () => onSort(sk) : undefined}
                    className={`px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wider whitespace-nowrap ${alignClass(col.align)} ${col.className || ''} ${col.sortable && onSort ? 'cursor-pointer hover:bg-slate-100 select-none transition-colors' : ''}`}
                  >
                    {col.sortable && onSort ? (
                      <span className="inline-flex items-center gap-1">
                        {col.header}
                        {!isSorted && <ArrowUpDown className="w-3 h-3 opacity-30" />}
                        {isSorted && sortDir === 'asc' && <ArrowUp className="w-3 h-3 text-indigo-600" />}
                        {isSorted && sortDir === 'desc' && <ArrowDown className="w-3 h-3 text-indigo-600" />}
                      </span>
                    ) : col.header}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} cols={columns.length} />)
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="py-16 text-center">
                  {renderEmpty()}
                </td>
              </tr>
            ) : (
              data.map((row, index) => (
                <tr
                  key={getKey(row)}
                  onClick={() => onRowClick?.(row)}
                  className={`border-b border-slate-50 transition-colors ${onRowClick ? 'cursor-pointer' : ''} ${hoverable ? 'hover:bg-indigo-50/40' : ''} ${striped && index % 2 === 1 ? 'bg-slate-25' : ''}`}
                >
                  {columns.map((col) => (
                    <td key={col.key} className={`px-4 py-3.5 ${alignClass(col.align)} ${col.className || ''}`}>
                      {col.render(row, index)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {page !== undefined && totalPages !== undefined && onPageChange && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50/40">
          <p className="text-xs text-slate-500">
            Page {page} of {totalPages}
            {totalCount !== undefined && <span className="ml-2">({totalCount} total)</span>}
          </p>
          <div className="flex items-center gap-1">
            <button onClick={() => onPageChange(page - 1)} disabled={page <= 1} className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pg: number;
              if (totalPages <= 5) pg = i + 1;
              else if (page <= 3) pg = i + 1;
              else if (page >= totalPages - 2) pg = totalPages - 4 + i;
              else pg = page - 2 + i;
              return (
                <button key={pg} onClick={() => onPageChange(pg)} className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${pg === page ? 'bg-indigo-600 text-white shadow-sm' : 'hover:bg-slate-100 text-slate-600'}`}>
                  {pg}
                </button>
              );
            })}
            <button onClick={() => onPageChange(page + 1)} disabled={page >= totalPages} className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
