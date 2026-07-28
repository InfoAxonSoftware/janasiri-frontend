import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  CalendarDays,
  FileText,
  MapPin,
  ShoppingCart,
  Trophy,
  Users,
} from 'lucide-react';
import { repsApi } from '../../services/api/repsApi';
import { formatDate } from '../../utils/formatters';
import type { SalesTarget } from '../../types/common.types';

export default function RepDashboard() {
  const navigate = useNavigate();

  const { data: targets = [] } = useQuery({
    queryKey: ['rep-targets'],
    queryFn: () =>
      repsApi
        .repGetTargets()
        .then((response) => response.data.data),
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });

  const { data: profile } = useQuery({
    queryKey: ['rep-profile'],
    queryFn: () =>
      repsApi
        .repGetProfile()
        .then((response) => response.data.data),
    staleTime: 5 * 60 * 1000,
  });

  const sortedTargets = useMemo(() => {
    const now = Date.now();

    return [...targets].sort(
      (first: SalesTarget, second: SalesTarget) => {
        const firstStart = new Date(first.startDate).getTime();
        const firstEnd = new Date(first.endDate).getTime();
        const secondStart = new Date(second.startDate).getTime();
        const secondEnd = new Date(second.endDate).getTime();

        const firstIsCurrent =
          firstStart <= now && now <= firstEnd;
        const secondIsCurrent =
          secondStart <= now && now <= secondEnd;

        if (firstIsCurrent !== secondIsCurrent) {
          return firstIsCurrent ? -1 : 1;
        }

        return secondStart - firstStart;
      },
    );
  }, [targets]);

  const currentTarget = sortedTargets[0];

  return (
    <div className="mx-auto w-full max-w-[1600px] animate-fade-in space-y-5 px-3 pb-10 pt-2 sm:px-5 sm:pt-4 xl:px-8 xl:pt-6">
      {/* Header */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="break-words text-xl font-black leading-tight tracking-tight text-slate-900 sm:text-2xl">
            Good {getGreeting()},{' '}
            <span className="text-emerald-700">
              {profile?.fullName || 'Sales Rep'}
            </span>
          </h1>

          <p className="mt-1 text-xs text-slate-500 sm:text-sm">
            Your daily sales workspace
          </p>
        </div>

        <div className="w-full sm:w-auto">
          <div className="flex min-h-11 w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-600 shadow-sm sm:w-auto">
            <CalendarDays className="h-4 w-4 flex-shrink-0 text-slate-400" />

            <span className="min-w-0 break-words">
              {currentTarget
                ? `${formatDate(currentTarget.startDate)} – ${formatDate(
                    currentTarget.endDate,
                  )}`
                : 'No active period'}
            </span>
          </div>
        </div>
      </header>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(360px,0.8fr)]">
        {/* Quick Actions */}
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-4 py-4 sm:px-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-600">
              Sales Workspace
            </p>

            <h2 className="mt-1 text-lg font-black text-slate-900">
              Quick Actions
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              Access the main sales tools from one place
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 p-4 sm:gap-4 sm:p-5">
            <QuickActionButton
              title="New Order"
              description="Create and submit a new sales order"
              icon={ShoppingCart}
              onClick={() => navigate('/rep/orders/new')}
              primary
            />

            <QuickActionButton
              title="Customers"
              description="View assigned customers and shops"
              icon={Users}
              onClick={() => navigate('/rep/customers')}
            />

            <QuickActionButton
              title="Quotations"
              description="Create and review customer quotations"
              icon={FileText}
              onClick={() => navigate('/rep/quotations')}
            />

            <QuickActionButton
              title="My Routes"
              description="Open routes and planned visits"
              icon={MapPin}
              onClick={() => navigate('/rep/routes')}
            />
          </div>
        </section>

        {/* Target Performance */}
        <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-700 via-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-700/10">
          <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 left-6 h-44 w-44 rounded-full bg-teal-300/10 blur-3xl" />

          <div className="relative flex min-h-[410px] flex-col p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/12">
                <Trophy className="h-5 w-5 text-emerald-50" />
              </div>

              <span className="rounded-full bg-white/15 px-3 py-1.5 text-[10px] font-bold backdrop-blur-sm sm:text-xs">
                {sortedTargets.length} target
                {sortedTargets.length === 1 ? '' : 's'}
              </span>
            </div>

            <div className="mt-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-100">
                Target Performance
              </p>

              <h2 className="mt-1 text-xl font-black">
                Achievement Overview
              </h2>

              <p className="mt-1 text-xs text-emerald-100">
                Track every assigned target at a glance
              </p>
            </div>

            {sortedTargets.length > 0 ? (
              <div className="mt-5 max-h-52 space-y-2.5 overflow-y-auto pr-1">
                {sortedTargets.map((target: SalesTarget) => {
                  const percentage = Number(
                    target.achievementPercentage || 0,
                  );

                  return (
                    <div
                      key={target.id}
                      className="rounded-xl border border-white/10 bg-white/10 px-3.5 py-3 backdrop-blur-sm"
                    >
                      <div className="flex min-w-0 items-center justify-between gap-3">
                        <span className="min-w-0 break-words text-sm font-bold text-white">
                          {getTargetName(target)}
                        </span>

                        <span className="flex-shrink-0 text-base font-black tabular-nums text-white">
                          {percentage.toFixed(1)}%
                        </span>
                      </div>

                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/15">
                        <div
                          className="h-full rounded-full bg-white transition-all duration-700"
                          style={{
                            width: `${Math.min(
                              Math.max(percentage, 0),
                              100,
                            )}%`,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="mt-5 rounded-xl border border-white/10 bg-white/10 px-4 py-8 text-center text-sm text-emerald-50">
                No targets assigned
              </div>
            )}

            <button
              type="button"
              onClick={() => navigate('/rep/performance')}
              className="mt-auto inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-black text-emerald-700 shadow-sm transition active:scale-[0.99] sm:hover:bg-emerald-50"
            >
              View Performance
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

function QuickActionButton({
  title,
  description,
  icon: Icon,
  onClick,
  primary = false,
}: {
  title: string;
  description: string;
  icon: typeof ShoppingCart;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex min-h-[132px] min-w-0 flex-col justify-between rounded-2xl border p-4 text-left transition active:scale-[0.99] sm:min-h-[150px] ${
        primary
          ? 'border-emerald-600 bg-emerald-600 text-white shadow-md shadow-emerald-600/15 sm:hover:bg-emerald-700'
          : 'border-slate-200 bg-slate-50 text-slate-900 sm:hover:border-emerald-200 sm:hover:bg-emerald-50/60'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div
          className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${
            primary
              ? 'bg-white/18 text-white'
              : 'border border-slate-100 bg-white text-emerald-600 shadow-sm'
          }`}
        >
          <Icon className="h-5 w-5" />
        </div>

        <ArrowRight
          className={`h-4 w-4 flex-shrink-0 transition-transform sm:group-hover:translate-x-0.5 ${
            primary ? 'text-white/75' : 'text-slate-400'
          }`}
        />
      </div>

      <div className="mt-4 min-w-0">
        <p className="break-words text-sm font-black sm:text-base">
          {title}
        </p>

        <p
          className={`mt-1 hidden text-[11px] leading-4 sm:block ${
            primary ? 'text-emerald-50' : 'text-slate-500'
          }`}
        >
          {description}
        </p>
      </div>
    </button>
  );
}

function getTargetName(target: SalesTarget) {
  return (
    target.targetName?.trim() ||
    `${target.targetPeriod} Target`
  );
}

function getGreeting() {
  const hour = new Date().getHours();

  if (hour < 12) return 'Morning';
  if (hour < 17) return 'Afternoon';

  return 'Evening';
}