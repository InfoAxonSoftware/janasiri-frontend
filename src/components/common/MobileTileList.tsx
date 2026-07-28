import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface MobileTileListProps<T> {
  data: T[];
  keyField?: string;
  keyExtractor?: (row: T) => string;
  renderTile: (row: T, index: number) => React.ReactNode;
  onTileClick?: (row: T) => void;
  isLoading?: boolean;
  emptyMessage?: string;
  emptyIcon?: React.ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyState?: React.ReactNode;
  page?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
}

function SkeletonTile() {
  return (
    <div className="bg-white rounded-xl border border-slate-200/80 p-4 animate-pulse">
      <div className="flex justify-between items-start mb-3">
        <div className="h-4 w-1/3 rounded bg-slate-100" />
        <div className="h-5 w-16 rounded-full bg-slate-100" />
      </div>
      <div className="space-y-2">
        <div className="h-3 w-3/4 rounded bg-slate-100" />
        <div className="h-3 w-1/2 rounded bg-slate-100" />
      </div>
    </div>
  );
}

export default function MobileTileList<T>({
  data,
  keyField,
  keyExtractor,
  renderTile,
  onTileClick,
  isLoading = false,
  emptyMessage = 'No data found',
  emptyIcon,
  emptyTitle,
  emptyDescription,
  emptyState,
  page,
  totalPages,
  onPageChange,
}: MobileTileListProps<T>) {
  const getKey = (row: T) => {
    if (keyExtractor) return keyExtractor(row);
    if (keyField) return String((row as any)[keyField]);
    return String((row as any).id ?? Math.random());
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonTile key={i} />
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    if (emptyState) return <>{emptyState}</>;
    return (
      <div className="flex flex-col items-center gap-3 py-16">
        {emptyIcon && <div className="text-slate-300">{emptyIcon}</div>}
        <div className="text-center">
          <p className="text-slate-500 font-medium">{emptyTitle || emptyMessage}</p>
          {emptyDescription && <p className="text-sm text-slate-400 mt-1">{emptyDescription}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 md:space-y-0 md:grid md:grid-cols-2 md:gap-3">
      {data.map((row, index) => {
        const key = getKey(row);
        return (
          <div
            key={key}
            onClick={() => onTileClick?.(row)}
            className={onTileClick ? 'cursor-pointer' : ''}
          >
            {renderTile(row, index)}
          </div>
        );
      })}

      {page !== undefined && totalPages !== undefined && totalPages > 1 && onPageChange && (
        <div className="flex items-center justify-center gap-2 pt-4 md:col-span-2">
          <button onClick={() => onPageChange(page - 1)} disabled={page <= 1} className="p-2.5 rounded-lg bg-white border border-slate-200 disabled:opacity-40 transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm text-slate-600 font-medium px-3">
            {page} / {totalPages}
          </span>
          <button onClick={() => onPageChange(page + 1)} disabled={page >= totalPages} className="p-2.5 rounded-lg bg-white border border-slate-200 disabled:opacity-40 transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
