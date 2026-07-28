import React from 'react';
import { ArrowLeft, type LucideIcon } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

export interface ActionItem {
  label: string;
  onClick: () => void;
  icon?: LucideIcon;
  variant?: 'primary' | 'secondary' | 'danger';
}

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  backTo?: string;
  /** Accepts ReactNode for full custom actions OR an array of ActionItem objects */
  actions?: React.ReactNode | ActionItem[];
}

function isActionArray(v: any): v is ActionItem[] {
  return Array.isArray(v) && v.length > 0 && typeof v[0].label === 'string';
}

function getVariantClass(variant: ActionItem['variant'], isRepSection: boolean): string {
  if (variant === 'secondary') {
    return isRepSection
      ? 'bg-white/90 text-emerald-800 border border-emerald-100 hover:bg-white'
      : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50';
  }

  if (variant === 'danger') {
    return 'bg-red-600 text-white hover:bg-red-700 shadow-sm';
  }

  return isRepSection
    ? 'bg-emerald-700 text-white hover:bg-emerald-800 shadow-sm'
    : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm';
}

export default function PageHeader({ title, subtitle, backTo, actions }: PageHeaderProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const isRepSection = location.pathname.startsWith('/rep');

  const renderActions = () => {
    if (!actions) return null;
    if (!isActionArray(actions)) return actions;
    return (
      <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
        {actions.map((a) => {
          const Icon = a.icon;
          return (
            <button
              key={a.label}
              onClick={a.onClick}
              className={`inline-flex items-center justify-center gap-1.5 flex-1 sm:flex-none min-h-[42px] px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${getVariantClass(a.variant || 'primary', isRepSection)}`}
            >
              {Icon && <Icon className="w-4 h-4" />}
              {a.label}
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 md:mb-5 lg:mb-6 rounded-2xl border px-4 py-3.5 md:px-5 md:py-4 ${
      isRepSection
        ? 'bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 border-emerald-300/40 shadow-sm shadow-emerald-500/20'
        : 'bg-white border-slate-200'
    }`}>
      <div className="flex items-center gap-3">
        {backTo && (
          <button
            onClick={() => navigate(backTo)}
            className={`p-2.5 -ml-1 rounded-xl transition-colors ${
              isRepSection ? 'hover:bg-white/15' : 'hover:bg-slate-100'
            }`}
          >
            <ArrowLeft className={`w-5 h-5 ${isRepSection ? 'text-white' : 'text-slate-500'}`} />
          </button>
        )}
        <div>
          <h1 className={`text-xl sm:text-2xl font-bold leading-tight ${isRepSection ? 'text-white' : 'text-slate-800'}`}>{title}</h1>
          {subtitle && <p className={`text-sm mt-0.5 ${isRepSection ? 'text-emerald-50' : 'text-slate-500'}`}>{subtitle}</p>}
        </div>
      </div>
      {renderActions()}
    </div>
  );
}
