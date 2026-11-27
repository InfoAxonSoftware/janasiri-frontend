import { useEffect, useState } from 'react';
import type { ElementType } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Building2,
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
  MapPin,
  Phone,
  ShieldCheck,
  ShoppingBag,
  UserRound,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import './Login.css';

const roleRoutes: Record<string, string> = {
  SuperAdmin: '/admin',
  Admin: '/admin',
  SalesRep: '/rep',
  Customer: '/shop',
  SalesCoordinator: '/coordinator',
};

const companyLocations = [
  {
    icon: MapPin,
    title: 'Registered Office',
    details: 'No. 205, Wattarantenna Passage, Kandy.',
  },
  {
    icon: Building2,
    title: 'Warehouse Central',
    details: 'No. 02, Mawilmada Road, Kandy.',
  },
  {
    icon: Building2,
    title: 'Warehouse West',
    details: 'No. 41A, Gnanathilaka Road, Mount Lavinia.',
  },
  {
    icon: Phone,
    title: 'Contact & VAT',
    details: 'Office: 0814-950206\nHotline: 0777-675322\nVAT: 114608394-7000',
  },
];

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { login, isLoading, error, isAuthenticated, user, clearError } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated && user) {
      navigate(roleRoutes[user.role] || '/login');
    }
  }, [isAuthenticated, user, navigate]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    clearError();
    await login(username, password);
  };

  return (
    <main className="janasiri-login relative min-h-screen overflow-x-hidden bg-[#f7f5f0] text-[#242923] selection:bg-[#c15b3e]/20 lg:h-screen lg:min-h-0 lg:overflow-hidden">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_78%_10%,rgba(193,91,62,0.07),transparent_26%),radial-gradient(circle_at_10%_88%,rgba(105,120,88,0.07),transparent_30%)]" />

      <div className="janasiri-login-grid relative grid min-h-screen w-full min-w-0 lg:h-full lg:min-h-0 lg:grid-cols-[1.05fr_0.95fr]">
        {/* Janasiri brand and company information */}
        <section className="janasiri-login-brand relative hidden min-h-0 overflow-hidden bg-[#222a23] px-8 py-7 text-[#f7f4ed] lg:flex lg:h-full lg:flex-col xl:px-11 2xl:px-14">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_8%_14%,rgba(193,91,62,0.24),transparent_34%),radial-gradient(circle_at_92%_82%,rgba(129,146,106,0.16),transparent_34%)]" />
          <div className="pointer-events-none absolute -right-36 top-24 h-[27rem] w-[27rem] rounded-full border border-white/[0.06]" />
          <div className="pointer-events-none absolute -right-20 top-40 h-[20rem] w-[20rem] rounded-full border border-[#d77c60]/20" />
          <div className="pointer-events-none absolute -bottom-48 -left-36 h-[30rem] w-[30rem] rounded-full bg-[#b94f35]/15 blur-3xl" />
          <div className="pointer-events-none absolute inset-0 opacity-[0.07]" style={{ backgroundImage: 'radial-gradient(#f7f4ed 0.7px, transparent 0.7px)', backgroundSize: '22px 22px' }} />

          <header className="relative z-10 flex shrink-0 items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl bg-[#f5f1e8] p-1 shadow-[0_8px_26px_rgba(0,0,0,0.18)]">
                <img src="/logo.png" alt="Janasiri Distributors logo" className="h-full w-full object-contain" />
              </div>
              <div>
                <p className="whitespace-nowrap text-[16px] font-bold leading-tight tracking-[-0.02em] text-white xl:text-[18px]">Janasiri Distributors (Pvt) Ltd</p>
              </div>
            </div>
          </header>

          <div className="janasiri-login-brand-content relative z-10 my-auto min-h-0 w-full max-w-[680px] py-3 xl:py-4">

            <div className="janasiri-login-truck mb-3 w-full max-w-[540px]" aria-hidden="true">
              <img src="/janasiri-delivery.svg" alt="" className="h-[clamp(66px,11vh,112px)] w-full object-contain object-left" />
            </div>
            <h1 className="janasiri-login-headline max-w-[620px] text-[clamp(2.35rem,3.35vw,3.65rem)] font-semibold leading-[1.04] tracking-[-0.055em] text-[#fbf8f1]">
              Sri Lanka&apos;s trusted <span className="font-serif italic font-normal text-[#df9278]">food service partner.</span>
            </h1>
            <p className="janasiri-login-intro mt-4 max-w-[540px] text-[13px] leading-6 text-[#d5d8d0]/75 xl:text-sm">
              Simplifying supply chains for thousands of businesses across the island with reliable, optimised wholesale distribution management.
            </p>

            <div className="janasiri-login-locations mt-5 xl:mt-7">
              <div className="janasiri-login-location-heading mb-3 flex items-center justify-between gap-4">
                <p className="text-[13px] font-bold tracking-[0.02em] text-[#e2a18b]">Our locations & contact details</p>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                {companyLocations.map((location) => (
                  <InfoCard
                    key={location.title}
                    icon={location.icon}
                    title={location.title}
                    details={location.details}
                  />
                ))}
              </div>
            </div>
          </div>

          <footer className="janasiri-login-footer relative z-10 flex shrink-0 items-center justify-between gap-4 border-t border-white/10 pt-4 text-[12px] text-white/75">
            <p>© {new Date().getFullYear()} Janasiri Distributors (Pvt) Ltd. All rights reserved.</p>
            <a href="https://janasiri.com" target="_blank" rel="noreferrer" className="shrink-0 font-semibold tracking-[0.12em] transition hover:text-white">
              WWW.JANASIRI.COM
            </a>
          </footer>
        </section>

        {/* Sign-in panel */}
        <section className="janasiri-login-signin relative flex min-h-screen min-w-0 items-center justify-center overflow-x-hidden px-5 py-7 sm:px-8 lg:h-full lg:min-h-0 lg:overflow-y-auto lg:px-9 lg:py-5 xl:px-12 2xl:px-16">
          <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[#c15b3e]/[0.07] blur-3xl lg:hidden" />

          <div className="relative w-full min-w-0 max-w-[420px] animate-fade-in-scale">
            <div className="mb-7 flex items-center gap-2 sm:gap-3 lg:hidden">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white p-1 shadow-sm ring-1 ring-black/[0.05]">
                <img src="/logo.png" alt="Janasiri Distributors logo" className="h-full w-full object-contain" />
              </div>
              <div>
                <p className="whitespace-nowrap text-[13px] font-bold leading-tight tracking-[-0.025em] text-[#252b24] min-[375px]:text-[15px] sm:text-[17px]">Janasiri Distributors (Pvt) Ltd</p>
              </div>
            </div>

            <div className="janasiri-login-signin-heading mb-6">
              <h2 className="text-[2.45rem] font-semibold leading-[1.06] tracking-[-0.055em] text-[#242923] sm:text-[2.7rem]">
                Welcome <span className="font-serif italic font-normal text-[#b9573d]">back.</span>
              </h2>
              <p className="mt-2.5 max-w-[360px] text-[14px] leading-6 text-[#62695e]">
                Sign in to your wholesale management portal.
              </p>
            </div>

            {error && (
              <div role="alert" aria-live="polite" className="mb-5 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-5 text-red-800">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-red-500" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="min-w-0 space-y-4">
              <div>
                <label htmlFor="username" className="mb-1.5 block text-[13px] font-semibold tracking-[0.005em] text-[#3d4639]">
                  Username
                </label>
                <div className="group relative">
                  <UserRound size={17} strokeWidth={1.8} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#969b91] transition-colors group-focus-within:text-[#b9573d]" />
                  <input
                    id="username"
                    name="username"
                    type="text"
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    placeholder="Enter your username"
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                    required
                    className="h-[52px] w-full min-w-0 rounded-xl border border-[#e4e3dc] bg-white/90 pl-11 pr-4 text-[15px] text-[#252a24] shadow-[0_2px_8px_rgba(37,42,36,0.025)] outline-none transition duration-200 placeholder:text-[14px] placeholder:text-[#858a80] hover:border-[#d3d1c8] focus:border-[#bd674d] focus:bg-white focus:ring-4 focus:ring-[#bd674d]/[0.09]"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="mb-1.5 block text-[13px] font-semibold tracking-[0.005em] text-[#3d4639]">
                  Password
                </label>
                <div className="group relative">
                  <LockKeyhole size={17} strokeWidth={1.8} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#969b91] transition-colors group-focus-within:text-[#b9573d]" />
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    required
                    className="h-[52px] w-full min-w-0 rounded-xl border border-[#e4e3dc] bg-white/90 pl-11 pr-12 text-[15px] text-[#252a24] shadow-[0_2px_8px_rgba(37,42,36,0.025)] outline-none transition duration-200 placeholder:text-[14px] placeholder:text-[#858a80] hover:border-[#d3d1c8] focus:border-[#bd674d] focus:bg-white focus:ring-4 focus:ring-[#bd674d]/[0.09]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((visible) => !visible)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    aria-pressed={showPassword}
                    className="absolute right-2.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-[#8d9389] transition hover:bg-[#f3f1eb] hover:text-[#3c443a] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#bd674d]"
                  >
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="group mt-1 flex h-[54px] w-full items-center justify-center gap-3 rounded-xl bg-[#b9573d] px-6 text-[15px] font-semibold text-white shadow-[0_10px_22px_rgba(185,87,61,0.19)] transition duration-200 hover:-translate-y-0.5 hover:bg-[#a94c34] hover:shadow-[0_14px_26px_rgba(185,87,61,0.24)] active:translate-y-0 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-65 disabled:hover:translate-y-0"
              >
                {isLoading ? (
                  <>
                    <Loader2 size={17} className="animate-spin" />
                    Signing in...
                  </>
                ) : (
                  <>
                    Sign In
                    <ArrowRight size={17} className="transition-transform duration-200 group-hover:translate-x-1" />
                  </>
                )}
              </button>
            </form>

            <div className="janasiri-login-register mt-6 border-t border-[#e6e3da] pt-5 text-center">
              <p className="text-[14px] text-[#62695e]">
                New customer?{' '}
                <Link to="/customer-register" className="font-bold text-[#ae5139] decoration-[#ae5139]/40 underline-offset-4 transition hover:text-[#883c2a] hover:underline">
                  Apply for an account
                </Link>
              </p>
              <Link to="/quick-order" className="group mt-4 flex items-center justify-between gap-3 rounded-xl border border-[#dfe4da] bg-[#f4f6f0] px-4 py-3 text-left transition duration-200 hover:-translate-y-0.5 hover:border-[#c8d3bf] hover:bg-[#edf1e9]">
                <span className="flex min-w-0 items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-[#647454] shadow-sm"><ShoppingBag size={16} strokeWidth={1.8} /></span>
                  <span className="min-w-0">
                    <span className="block text-[13px] font-medium text-[#62695e]">No account needed</span>
                    <span className="mt-0.5 block text-[14px] font-semibold text-[#30382d]">Direct Purchase Order</span>
                  </span>
                </span>
                <ArrowRight size={16} className="shrink-0 text-[#b9573d] transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
            <div className="janasiri-login-hotline mt-5 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-[13px] leading-5 text-[#62695e]">
              <span className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap">
                <Phone size={15} className="shrink-0 text-[#647454]" />
                <span>Hotline:</span>
                <a href="tel:+94777675322" className="inline-flex items-center font-semibold leading-5 text-[#30382d] hover:text-[#a94c34]">0777-675322</a>
              </span>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

interface InfoCardProps {
  icon: ElementType;
  title: string;
  details: string;
}

function InfoCard({ icon: Icon, title, details }: InfoCardProps) {
  return (
    <article className="janasiri-login-info-card flex min-h-[90px] min-w-0 items-start gap-3 rounded-2xl border border-white/[0.10] bg-white/[0.055] p-3.5 transition duration-200 hover:border-[#d77c60]/30 hover:bg-white/[0.08]">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#d77c60]/[0.14] text-[#e5a28d]">
        <Icon size={16} strokeWidth={1.9} />
      </div>
      <div className="min-w-0 pt-0.5">
        <h3 className="text-[13px] font-semibold tracking-[0.01em] text-white/95">{title}</h3>
        <p className="mt-1 whitespace-pre-line break-words text-[13px] leading-5 text-white/85">{details}</p>
      </div>
    </article>
  );
}
