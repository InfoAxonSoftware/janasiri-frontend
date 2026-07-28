// @ts-nocheck
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  CalendarDays,
  ChevronRight,
  MapPin,
  Phone,
  Route,
  Timer,
  Users,
} from 'lucide-react';
import { repsApi } from '../../services/api/repsApi';

export default function RepRoutes() {
  const navigate = useNavigate();
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['rep-profile'],
    queryFn: () =>
      repsApi.repGetProfile().then((response) => response.data.data),
  });

  const { data: routesData, isLoading: routesLoading } = useQuery({
    queryKey: ['rep-routes'],
    queryFn: () =>
      repsApi.repGetRoutes().then((response) => response.data.data || []),
  });

  const routes = routesData || [];
  const isLoading = profileLoading || routesLoading;

  const selectedRoute = useMemo(() => {
    if (!routes.length) return null;

    if (selectedRouteId) {
      return (
        routes.find((routeItem: any) => routeItem.id === selectedRouteId) ||
        routes[0]
      );
    }

    return routes[0];
  }, [routes, selectedRouteId]);

  const customers = selectedRoute?.customers || [];
  const regionLabel =
    profile?.regionNames?.join(', ') || 'Region not assigned';

  const todayLabel = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
  });

  const totalCustomers = useMemo(() => {
    const customerIds = new Set<string>();

    routes.forEach((routeItem: any) => {
      (routeItem.customers || []).forEach((customer: any) => {
        customerIds.add(customer.customerId);
      });
    });

    return customerIds.size;
  }, [routes]);

  return (
    <div className="mx-auto w-full max-w-[1500px] animate-fade-in space-y-4 px-3 pb-8 pt-2 sm:space-y-5 sm:px-5 sm:pt-4 lg:px-0 lg:pt-0">
      {/* Consistent Sales Rep green header */}
      <header className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-700 via-emerald-600 to-teal-600 px-4 py-5 text-white shadow-sm sm:px-5 sm:py-6 lg:px-6">
        <div className="pointer-events-none absolute -right-14 -top-16 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-20 left-10 h-40 w-40 rounded-full bg-emerald-300/15 blur-3xl" />

        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border border-white/20 bg-white/15 backdrop-blur-sm">
                <Route className="h-5 w-5 text-white" />
              </div>

              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-100">
                  Field Coverage
                </p>
                <h1 className="mt-0.5 text-xl font-bold tracking-tight text-white sm:text-2xl">
                  My Routes
                </h1>
                <p className="mt-1 break-words text-xs text-emerald-100 sm:text-sm">
                  {regionLabel}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:flex sm:items-center">
            <HeaderStat label="Routes" value={routes.length} dark />
            <HeaderStat label="Customers" value={totalCustomers} dark />
            <HeaderStat label="Today" value={todayLabel.slice(0, 3)} dark />
          </div>
        </div>
      </header>

      {isLoading ? (
        <RoutesSkeleton />
      ) : routes.length === 0 ? (
        <EmptyRoutes />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5">
          {/* Route selector */}
          <aside className="lg:col-span-4 xl:col-span-3">
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:sticky lg:top-4">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3.5">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    Assigned Routes
                  </h2>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    Select a route
                  </p>
                </div>

                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700">
                  {routes.length}
                </span>
              </div>

              {/* Mobile/tablet horizontal selector */}
              <div className="flex gap-2 overflow-x-auto p-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:hidden">
                {routes.map((routeItem: any) => (
                  <RouteChip
                    key={routeItem.id}
                    routeItem={routeItem}
                    active={selectedRoute?.id === routeItem.id}
                    onClick={() => setSelectedRouteId(routeItem.id)}
                  />
                ))}
              </div>

              {/* Desktop vertical selector */}
              <div className="hidden divide-y divide-slate-100 lg:block">
                {routes.map((routeItem: any) => (
                  <RouteRow
                    key={routeItem.id}
                    routeItem={routeItem}
                    active={selectedRoute?.id === routeItem.id}
                    onClick={() => setSelectedRouteId(routeItem.id)}
                  />
                ))}
              </div>
            </section>
          </aside>

          {/* Selected route */}
          <main className="min-w-0 space-y-4 lg:col-span-8 xl:col-span-9">
            <RouteSummary routeItem={selectedRoute} />

            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3.5 sm:px-5">
                <div className="min-w-0">
                  <h2 className="text-sm font-bold text-slate-900 sm:text-base">
                    Route Customers
                  </h2>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    {customers.length} customer
                    {customers.length === 1 ? '' : 's'}
                  </p>
                </div>

                {selectedRoute?.daysOfWeek?.length > 0 && (
                  <div className="hidden min-w-0 items-center gap-1.5 text-xs text-slate-500 sm:flex">
                    <CalendarDays className="h-4 w-4 flex-shrink-0" />
                    <span className="truncate">
                      {selectedRoute.daysOfWeek.join(', ')}
                    </span>
                  </div>
                )}
              </div>

              {customers.length === 0 ? (
                <div className="px-5 py-12 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                    <Users className="h-6 w-6" />
                  </div>
                  <p className="mt-3 text-sm font-semibold text-slate-700">
                    No customers assigned
                  </p>
                </div>
              ) : (
                <>
                  {/* Mobile customer list */}
                  <div className="divide-y divide-slate-100 md:hidden">
                    {customers.map((customer: any, index: number) => (
                      <CustomerMobileRow
                        key={customer.customerId}
                        customer={customer}
                        index={index}
                        onClick={() =>
                          navigate(`/rep/customers/${customer.customerId}`)
                        }
                      />
                    ))}
                  </div>

                  {/* Tablet / desktop customer grid */}
                  <div className="hidden grid-cols-2 gap-3 p-4 md:grid xl:grid-cols-3">
                    {customers.map((customer: any, index: number) => (
                      <CustomerCard
                        key={customer.customerId}
                        customer={customer}
                        index={index}
                        onClick={() =>
                          navigate(`/rep/customers/${customer.customerId}`)
                        }
                      />
                    ))}
                  </div>
                </>
              )}
            </section>
          </main>
        </div>
      )}
    </div>
  );
}

function HeaderStat({
  label,
  value,
  dark = false,
}: {
  label: string;
  value: string | number;
  dark?: boolean;
}) {
  return (
    <div
      className={`min-w-0 rounded-xl px-3 py-2 text-center sm:min-w-[86px] ${
        dark
          ? 'border border-white/15 bg-white/10 backdrop-blur-sm'
          : 'bg-slate-50'
      }`}
    >
      <p
        className={`text-[9px] font-semibold uppercase tracking-wide ${
          dark ? 'text-emerald-100' : 'text-slate-400'
        }`}
      >
        {label}
      </p>
      <p
        className={`mt-0.5 truncate text-sm font-bold ${
          dark ? 'text-white' : 'text-slate-900'
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function RouteChip({
  routeItem,
  active,
  onClick,
}: {
  routeItem: any;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-w-[190px] rounded-xl border px-3.5 py-3 text-left transition active:scale-[0.99] ${
        active
          ? 'border-emerald-500 bg-emerald-50'
          : 'border-slate-200 bg-white'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <p
          className={`min-w-0 break-words text-sm font-bold leading-5 ${
            active ? 'text-emerald-800' : 'text-slate-900'
          }`}
        >
          {routeItem.name}
        </p>
        <span
          className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
            active
              ? 'bg-emerald-600 text-white'
              : 'bg-slate-100 text-slate-600'
          }`}
        >
          {(routeItem.customers || []).length}
        </span>
      </div>

      <div className="mt-2 flex items-center gap-3 text-[10px] text-slate-500">
        <span className="inline-flex items-center gap-1">
          <Timer className="h-3 w-3" />
          {routeItem.estimatedDurationMinutes || 0} min
        </span>
      </div>
    </button>
  );
}

function RouteRow({
  routeItem,
  active,
  onClick,
}: {
  routeItem: any;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 px-4 py-3.5 text-left transition ${
        active
          ? 'bg-emerald-50'
          : 'hover:bg-slate-50'
      }`}
    >
      <div
        className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ${
          active
            ? 'bg-emerald-600 text-white'
            : 'bg-slate-100 text-slate-500'
        }`}
      >
        <Route className="h-4 w-4" />
      </div>

      <div className="min-w-0 flex-1">
        <p
          className={`break-words text-sm font-bold leading-5 ${
            active ? 'text-emerald-800' : 'text-slate-900'
          }`}
        >
          {routeItem.name}
        </p>
        <p className="mt-0.5 text-[11px] text-slate-500">
          {(routeItem.customers || []).length} customers
        </p>
      </div>

      <ChevronRight
        className={`h-4 w-4 flex-shrink-0 ${
          active ? 'text-emerald-600' : 'text-slate-300'
        }`}
      />
    </button>
  );
}

function RouteSummary({ routeItem }: { routeItem: any }) {
  if (!routeItem) return null;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-600">
            Selected Route
          </p>
          <h2 className="mt-1 break-words text-lg font-bold leading-6 text-slate-950 sm:text-xl">
            {routeItem.name}
          </h2>

          {routeItem.description && (
            <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500 sm:text-sm">
              {routeItem.description}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-shrink-0">
          <SummaryPill
            icon={Users}
            label="Customers"
            value={(routeItem.customers || []).length}
          />
          <SummaryPill
            icon={Timer}
            label="Duration"
            value={`${routeItem.estimatedDurationMinutes || 0} min`}
          />
        </div>
      </div>

      {routeItem.daysOfWeek?.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {routeItem.daysOfWeek.map((day: string) => (
            <span
              key={day}
              className="rounded-lg bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-600"
            >
              {day}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}

function SummaryPill({
  icon: Icon,
  label,
  value,
}: {
  icon: any;
  label: string;
  value: string | number;
}) {
  return (
    <div className="min-w-0 rounded-xl bg-slate-50 px-3 py-2.5 sm:min-w-[110px]">
      <div className="flex items-center gap-1.5 text-slate-400">
        <Icon className="h-3.5 w-3.5" />
        <p className="text-[9px] font-semibold uppercase tracking-wide">
          {label}
        </p>
      </div>
      <p className="mt-1 break-words text-sm font-bold text-slate-900">
        {value}
      </p>
    </div>
  );
}

function CustomerMobileRow({
  customer,
  index,
  onClick,
}: {
  customer: any;
  index: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-[74px] w-full items-center gap-3 px-4 py-3 text-left transition active:bg-slate-50"
    >
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-700">
        {customer.visitOrder || index + 1}
      </div>

      <div className="min-w-0 flex-1">
        <p className="break-words text-sm font-bold leading-5 text-slate-900">
          {customer.shopName || customer.customerName}
        </p>

        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
          {customer.visitFrequency && (
            <span>{customer.visitFrequency}</span>
          )}

          {customer.phoneNumber && (
            <span className="inline-flex items-center gap-1">
              <Phone className="h-3 w-3" />
              {customer.phoneNumber}
            </span>
          )}
        </div>
      </div>

      <ChevronRight className="h-4 w-4 flex-shrink-0 text-slate-300" />
    </button>
  );
}

function CustomerCard({
  customer,
  index,
  onClick,
}: {
  customer: any;
  index: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-w-0 items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 text-left transition hover:border-emerald-200 hover:bg-emerald-50/50"
    >
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-white text-sm font-bold text-emerald-700 shadow-sm">
        {customer.visitOrder || index + 1}
      </div>

      <div className="min-w-0 flex-1">
        <p className="break-words text-sm font-bold leading-5 text-slate-900">
          {customer.shopName || customer.customerName}
        </p>

        <div className="mt-2 space-y-1 text-[11px] text-slate-500">
          {customer.visitFrequency && (
            <p>{customer.visitFrequency}</p>
          )}

          {customer.phoneNumber && (
            <p className="flex items-center gap-1.5 break-words">
              <Phone className="h-3 w-3 flex-shrink-0" />
              {customer.phoneNumber}
            </p>
          )}

          {customer.latitude && customer.longitude && (
            <p className="flex items-center gap-1.5">
              <MapPin className="h-3 w-3 flex-shrink-0" />
              Location mapped
            </p>
          )}
        </div>
      </div>

      <ChevronRight className="mt-1 h-4 w-4 flex-shrink-0 text-slate-300" />
    </button>
  );
}

function RoutesSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-12">
      <div className="h-52 animate-pulse rounded-2xl bg-slate-100 lg:col-span-4 xl:col-span-3" />
      <div className="space-y-4 lg:col-span-8 xl:col-span-9">
        <div className="h-36 animate-pulse rounded-2xl bg-slate-100" />
        <div className="h-72 animate-pulse rounded-2xl bg-slate-100" />
      </div>
    </div>
  );
}

function EmptyRoutes() {
  return (
    <section className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-16 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
        <Route className="h-7 w-7" />
      </div>
      <p className="mt-4 font-bold text-slate-700">
        No routes assigned
      </p>
      <p className="mt-1 text-sm text-slate-500">
        Contact your coordinator for route assignments.
      </p>
    </section>
  );
}