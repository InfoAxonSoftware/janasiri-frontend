import React from 'react';
import type { LucideIcon } from 'lucide-react';

export interface ActionObject {
  label: string;
  onClick: () => void;
}

export interface EmptyStateProps {
  /** Accepts a ReactNode (e.g. <Package className="…" />) OR a LucideIcon component reference (e.g. Package) */
  icon: React.ReactNode | LucideIcon;
  title: string;
  description?: string;
  /** Accepts a ReactNode (e.g. <button>…</button>) OR an ActionObject */
  action?: React.ReactNode | ActionObject;
}

function isActionObject(v: any): v is ActionObject {
  return v && typeof v === 'object' && typeof v.label === 'string' && typeof v.onClick === 'function' && !React.isValidElement(v);
}

function isLucideIcon(v: any): v is LucideIcon {
  if (React.isValidElement(v)) return false;
  // Lucide icons can come as function components or forwardRef component objects.
  const isFnComponent = typeof v === 'function';
  const isForwardRefComponent = !!(v && typeof v === 'object' && '$$typeof' in v && typeof (v as any).render === 'function');
  return isFnComponent || isForwardRefComponent;
}

export default function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  const renderIcon = () => {
    if (isLucideIcon(icon)) {
      const Icon = icon as LucideIcon;
      return <Icon className="w-12 h-12 text-slate-300" />;
    }
    return icon;
  };

  const renderAction = () => {
    if (!action) return null;
    if (isActionObject(action)) {
      return (
        <button
          onClick={action.onClick}
          className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors shadow-sm"
        >
          {action.label}
        </button>
      );
    }
    return <div className="mt-4">{action}</div>;
  };

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="mb-4">{renderIcon()}</div>
      <h3 className="text-lg font-semibold text-slate-600 mb-1">{title}</h3>
      {description && <p className="text-sm text-slate-400 text-center max-w-sm">{description}</p>}
      {renderAction()}
    </div>
  );
}
