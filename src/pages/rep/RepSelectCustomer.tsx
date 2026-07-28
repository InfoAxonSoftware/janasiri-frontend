import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Check,
  CheckCircle2,
  MapPin,
  Phone,
  Search,
  Store,
  User,
  X,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { customersApi } from '../../services/api/customersApi';
import { orderDraftUtils } from '../../utils/orderDraft';
import { formatCurrency } from '../../utils/formatters';

function getCustomerTaxLabel(customer: any) {
  const customerType = String(
    customer?.customerType || '',
  )
    .toLowerCase()
    .replace(/[-_\s]/g, '');

  return customerType === 'nontax'
    ? 'Non-Tax'
    : 'Tax';
}

export default function RepSelectCustomer() {
  const navigate = useNavigate();
  const draft = orderDraftUtils.get();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState(
    draft.customerId || '',
  );

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['rep-customers-all'],
    queryFn: () =>
      customersApi
        .repGetCustomers({
          page: 1,
          pageSize: 2000,
        })
        .then((response) => response.data.data),
  });

  const allCustomers = data?.items || [];

  const filteredCustomers = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    if (!query) {
      return allCustomers;
    }

    return allCustomers.filter((customer: any) => {
      const searchableValues = [
        customer.shopName,
        customer.contactPerson,
        customer.email,
        customer.phoneNumber,
        customer.city,
      ];

      return searchableValues.some((value) =>
        String(value || '')
          .toLowerCase()
          .includes(query),
      );
    });
  }, [allCustomers, searchTerm]);

  const selectedCustomer = useMemo(
    () =>
      allCustomers.find(
        (customer: any) =>
          customer.id === selectedCustomerId,
      ),
    [allCustomers, selectedCustomerId],
  );

  const confirmSelection = () => {
    if (!selectedCustomer) {
      toast.error('Please select a customer');
      return;
    }

    const displayName =
      selectedCustomer.shopName ||
      'Customer';

    orderDraftUtils.setCustomer(
      selectedCustomer.id,
      displayName,
    );

    toast.success(`${displayName} selected`);

    // Return to the existing Create Order history entry instead of
    // pushing another /rep/orders/new entry onto the browser stack.
    navigate(-1);
  };

  return (
    <div className="mx-auto w-full max-w-7xl animate-fade-in px-3 pb-16 pt-2 sm:px-5 sm:pt-4 lg:px-6 lg:pb-20">
      {/* Header */}
      <section className="relative overflow-hidden rounded-2xl bg-emerald-700 px-4 py-5 text-white shadow-sm sm:px-5 sm:py-6">
        <div className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-white/10 blur-3xl" />

        <div className="relative flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-100">
              Create Order
            </p>
            <h1 className="mt-0.5 text-xl font-bold tracking-tight sm:text-2xl">
              Select Customer
            </h1>
            <p className="mt-1 text-xs leading-5 text-emerald-100 sm:text-sm">
              Choose the shop receiving this order
            </p>
          </div>

          {!isLoading && (
            <div className="hidden rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-right sm:block">
              <p className="text-[9px] font-bold uppercase tracking-wide text-emerald-100">
                Customers
              </p>
              <p className="mt-0.5 text-sm font-black text-white">
                {filteredCustomers.length}
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Search and Continue */}
      <section className="sticky top-2 z-30 mt-3 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-sm backdrop-blur-md sm:p-4">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-slate-400" />

            <input
              type="search"
              value={searchTerm}
              onChange={(event) =>
                setSearchTerm(event.target.value)
              }
              placeholder="Search customer"
              className="min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-9 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-500/15"
            />

            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition active:bg-slate-100 active:text-slate-700"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <button
            type="button"
            disabled={!selectedCustomer}
            onClick={confirmSelection}
            className="inline-flex min-h-11 flex-shrink-0 items-center justify-center gap-1.5 rounded-xl bg-emerald-700 px-3.5 text-xs font-black text-white transition active:scale-[0.98] disabled:bg-slate-200 disabled:text-slate-400 sm:px-5 sm:text-sm"
          >
            Continue
            <Check className="h-4 w-4" />
          </button>
        </div>

        {!isLoading && (
          <div className="mt-2 flex min-w-0 items-center justify-between gap-3 px-1 text-[11px]">
            <span className="truncate text-slate-500">
              {searchTerm
                ? `${filteredCustomers.length} matching`
                : `${allCustomers.length} customers`}
            </span>

            {selectedCustomer && (
              <span className="max-w-[52%] truncate font-bold text-emerald-700">
                {selectedCustomer.shopName ||
                  'Customer'}
              </span>
            )}
          </div>
        )}
      </section>

      {/* Loading */}
      {isLoading && (
        <>
          <div className="mt-4 space-y-2 md:hidden">
            {Array.from({ length: 8 }).map((_, index) => (
              <div
                key={index}
                className="flex h-14 animate-pulse items-center justify-between rounded-xl border border-slate-200 bg-white px-4"
              >
                <div className="h-4 w-2/3 rounded bg-slate-200" />
                <div className="h-6 w-16 rounded-full bg-slate-100" />
              </div>
            ))}
          </div>

          <div className="hidden grid-cols-2 gap-3 py-4 md:grid lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="h-40 animate-pulse rounded-2xl border border-slate-200 bg-white p-4"
              >
                <div className="h-4 w-2/3 rounded bg-slate-200" />
                <div className="mt-3 h-3 w-1/2 rounded bg-slate-100" />
                <div className="mt-6 grid grid-cols-2 gap-2">
                  <div className="h-12 rounded-xl bg-slate-100" />
                  <div className="h-12 rounded-xl bg-slate-100" />
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Error */}
      {!isLoading && isError && (
        <section className="mt-4 rounded-2xl border border-red-100 bg-white px-5 py-12 text-center shadow-sm">
          <p className="text-sm font-bold text-slate-800">
            Could not load customers
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Check the connection and try again.
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            className="mt-4 rounded-xl bg-emerald-700 px-5 py-2.5 text-xs font-bold text-white"
          >
            Retry
          </button>
        </section>
      )}

      {/* Empty */}
      {!isLoading &&
        !isError &&
        filteredCustomers.length === 0 && (
          <section className="mt-4 rounded-2xl border border-slate-200 bg-white px-5 py-14 text-center shadow-sm">
            <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
              <User className="h-7 w-7" />
            </div>
            <h2 className="mt-4 text-base font-bold text-slate-800">
              No customers found
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Try a different shop name, phone or city.
            </p>
          </section>
        )}

      {/* Customers */}
      {!isLoading &&
        !isError &&
        filteredCustomers.length > 0 && (
          <>
            {/* Mobile: customer name + tax type only */}
            <div className="mt-4 space-y-2 md:hidden">
              {filteredCustomers.map((customer: any) => {
                const isSelected =
                  selectedCustomerId === customer.id;

                const displayName =
                  customer.shopName ||
                  customer.contactPerson ||
                  'Unnamed Customer';

                const taxLabel =
                  getCustomerTaxLabel(customer);

                return (
                  <button
                    key={customer.id}
                    type="button"
                    onClick={() =>
                      setSelectedCustomerId((current) =>
                        current === customer.id
                          ? ''
                          : customer.id,
                      )
                    }
                    className={`flex min-h-14 w-full items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left transition active:scale-[0.99] ${
                      isSelected
                        ? 'border-emerald-600 bg-emerald-50 ring-2 ring-emerald-500/10'
                        : 'border-slate-200 bg-white active:bg-slate-50'
                    }`}
                    aria-pressed={isSelected}
                  >
                    <div
                      className={`inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full ${
                        isSelected
                          ? 'bg-emerald-700 text-white'
                          : 'border border-slate-300 bg-white text-transparent'
                      }`}
                    >
                      <Check className="h-4 w-4" />
                    </div>

                    <p className="min-w-0 flex-1 break-words text-sm font-bold leading-5 text-slate-900">
                      {displayName}
                    </p>

                    <span
                      className={`inline-flex flex-shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${
                        taxLabel === 'Non-Tax'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {taxLabel}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Tablet and desktop: detailed cards */}
            <div className="mt-4 hidden grid-cols-2 gap-3 md:grid lg:grid-cols-3">
              {filteredCustomers.map((customer: any) => {
                const isSelected =
                  selectedCustomerId === customer.id;

                const displayName =
                  customer.shopName ||
                  customer.contactPerson ||
                  'Unnamed Customer';

                const taxLabel =
                  getCustomerTaxLabel(customer);

                return (
                  <button
                    key={customer.id}
                    type="button"
                    onClick={() =>
                      setSelectedCustomerId((current) =>
                        current === customer.id
                          ? ''
                          : customer.id,
                      )
                    }
                    className={`group relative min-w-0 rounded-2xl border p-4 text-left shadow-sm transition active:scale-[0.99] ${
                      isSelected
                        ? 'border-emerald-500 bg-emerald-50/70 ring-2 ring-emerald-500/10'
                        : 'border-slate-200 bg-white hover:border-emerald-300 hover:shadow-md'
                    }`}
                    aria-pressed={isSelected}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl ${
                          isSelected
                            ? 'bg-emerald-700 text-white'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        <Store className="h-5 w-5" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h2 className="line-clamp-2 text-sm font-black leading-5 text-slate-900 sm:text-base">
                              {displayName}
                            </h2>

                            <span
                              className={`mt-1.5 inline-flex rounded-full px-2 py-0.5 text-[9px] font-bold ${
                                taxLabel === 'Non-Tax'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              {taxLabel}
                            </span>
                          </div>

                          <div
                            className={`inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full ${
                              isSelected
                                ? 'bg-emerald-700 text-white'
                                : 'border border-slate-300 bg-white text-transparent'
                            }`}
                          >
                            <CheckCircle2 className="h-4 w-4" />
                          </div>
                        </div>

                        <div className="mt-2 space-y-1.5">
                          {customer.contactPerson && (
                            <CustomerInfoLine
                              icon={User}
                              value={customer.contactPerson}
                            />
                          )}

                          {(customer.city ||
                            customer.phoneNumber) && (
                            <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                              {customer.city && (
                                <CustomerInfoLine
                                  icon={MapPin}
                                  value={customer.city}
                                />
                              )}

                              {customer.phoneNumber && (
                                <CustomerInfoLine
                                  icon={Phone}
                                  value={customer.phoneNumber}
                                />
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3">
                      <CustomerMetric
                        label="Balance"
                        value={formatCurrency(
                          customer.currentBalance || 0,
                        )}
                      />

                      <CustomerMetric
                        label="Credit Limit"
                        value={formatCurrency(
                          customer.creditLimit || 0,
                        )}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}


    </div>
  );
}

function CustomerInfoLine({
  icon: Icon,
  value,
}: {
  icon: typeof User;
  value: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-1.5 text-[11px] text-slate-500">
      <Icon className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" />
      <span className="truncate">{value}</span>
    </div>
  );
}

function CustomerMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0 rounded-xl bg-slate-50 px-2.5 py-2">
      <p className="text-[8px] font-bold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-1 break-words text-[11px] font-black leading-4 text-slate-800 sm:text-xs">
        {value}
      </p>
    </div>
  );
}