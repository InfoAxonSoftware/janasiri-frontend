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
  UserRound,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

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
    details: '+94 81 495 0206\nTP / Hotline  ·  VAT: 114608394-7000',
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
    <main className="relative min-h-screen overflow-x-hidden bg-[#f7f5f0] text-[#242923] selection:bg-[#c15b3e]/20 lg:h-screen lg:min-h-0 lg:overflow-hidden">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_78%_10%,rgba(193,91,62,0.07),transparent_26%),radial-gradient(circle_at_10%_88%,rgba(105,120,88,0.07),transparent_30%)]" />

      <div className="relative grid min-h-screen w-full min-w-0 lg:h-full lg:min-h-0 lg:grid-cols-[1.05fr_0.95fr]">
        {/* Janasiri brand and company information */}
        <section className="relative hidden min-h-0 overflow-hidden bg-[#222a23] px-8 py-7 text-[#f7f4ed] lg:flex lg:h-full lg:flex-col xl:px-11 2xl:px-14">
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
                <p className="text-[17px] font-extrabold leading-tight tracking-[0.11em] text-white">JANASIRI</p>
                <p className="mt-1 text-[9px] font-semibold tracking-[0.22em] text-[#d6a18e]">DISTRIBUTORS (PVT) LTD</p>
              </div>
            </div>
            <span className="rounded-full border border-white/15 bg-white/[0.06] px-3 py-1.5 text-[9px] font-semibold tracking-[0.16em] text-white/65">
              SRI LANKA
            </span>
          </header>

          <div className="relative z-10 my-auto w-full max-w-[680px] py-6">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#d77c60]/30 bg-[#d77c60]/10 px-3 py-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-[#e28a6d] shadow-[0_0_12px_rgba(226,138,109,0.9)]" />
              <span className="text-[9px] font-bold uppercase tracking-[0.19em] text-[#f0b39f]">Trusted food service partner · Sri Lanka</span>
            </div>

            <h1 className="max-w-[620px] text-[clamp(2.35rem,3.35vw,3.65rem)] font-semibold leading-[1.04] tracking-[-0.055em] text-[#fbf8f1]">
              Sri Lanka&apos;s trusted <span className="font-serif italic font-normal text-[#df9278]">food service partner.</span>
            </h1>
            <p className="mt-4 max-w-[540px] text-[13px] leading-6 text-[#d5d8d0]/75 xl:text-sm">
              Simplifying supply chains for thousands of businesses across the island with reliable, optimised wholesale distribution management.
            </p>

            <div className="mt-7">
              <div className="mb-3 flex items-center justify-between gap-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.19em] text-[#d99a84]">Our locations & contact details</p>
                <span className="text-[9px] font-medium tracking-wide text-white/35">JANASIRI DISTRIBUTORS</span>
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

          <footer className="relative z-10 flex shrink-0 items-center justify-between gap-4 border-t border-white/10 pt-4 text-[10px] text-white/45">
            <p>© {new Date().getFullYear()} Janasiri Distributors (Pvt) Ltd. All rights reserved.</p>
            <a href="https://janasiri.com" target="_blank" rel="noreferrer" className="shrink-0 font-semibold tracking-[0.12em] transition hover:text-white">
              WWW.JANASIRI.COM
            </a>
          </footer>
        </section>

        {/* Sign-in panel */}
        <section className="relative flex min-h-screen min-w-0 items-center justify-center overflow-x-hidden px-5 py-7 sm:px-8 lg:h-full lg:min-h-0 lg:overflow-y-auto lg:px-9 lg:py-5 xl:px-12 2xl:px-16">
          <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[#c15b3e]/[0.07] blur-3xl lg:hidden" />

          <div className="relative w-full min-w-0 max-w-[420px] animate-fade-in-scale">
            <div className="mb-7 flex items-center gap-3 lg:hidden">
              <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl bg-white p-1 shadow-sm ring-1 ring-black/[0.05]">
                <img src="/logo.png" alt="Janasiri Distributors logo" className="h-full w-full object-contain" />
              </div>
              <div>
                <p className="text-[16px] font-extrabold tracking-[0.12em] text-[#252b24]">JANASIRI</p>
                <p className="mt-0.5 text-[9px] font-bold tracking-[0.22em] text-[#a85a43]">DISTRIBUTORS (PVT) LTD</p>
              </div>
            </div>

            <div className="mb-6">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#dce4d7] bg-[#edf1e9] px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.16em] text-[#647454]">
                <ShieldCheck size={13} strokeWidth={2} />
                Secure wholesale portal
              </div>
              <h2 className="text-[2.45rem] font-semibold leading-[1.06] tracking-[-0.055em] text-[#242923] sm:text-[2.7rem]">
                Welcome <span className="font-serif italic font-normal text-[#b9573d]">back.</span>
              </h2>
              <p className="mt-2.5 max-w-[360px] text-[13px] leading-5 text-[#777c72]">
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
                <label htmlFor="username" className="mb-1.5 block text-[12px] font-bold tracking-[0.03em] text-[#454b43]">
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
                    placeholder="Ex: jdist_coordinator"
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                    required
                    className="h-[52px] w-full min-w-0 rounded-xl border border-[#e4e3dc] bg-white/90 pl-11 pr-4 text-[13px] text-[#252a24] shadow-[0_2px_8px_rgba(37,42,36,0.025)] outline-none transition duration-200 placeholder:text-[#a6a99f] hover:border-[#d3d1c8] focus:border-[#bd674d] focus:bg-white focus:ring-4 focus:ring-[#bd674d]/[0.09]"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="mb-1.5 block text-[12px] font-bold tracking-[0.03em] text-[#454b43]">
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
                    className="h-[52px] w-full min-w-0 rounded-xl border border-[#e4e3dc] bg-white/90 pl-11 pr-12 text-[13px] text-[#252a24] shadow-[0_2px_8px_rgba(37,42,36,0.025)] outline-none transition duration-200 placeholder:text-[#a6a99f] hover:border-[#d3d1c8] focus:border-[#bd674d] focus:bg-white focus:ring-4 focus:ring-[#bd674d]/[0.09]"
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
                className="group mt-1 flex h-[54px] w-full items-center justify-center gap-3 rounded-xl bg-[#b9573d] px-6 text-[13px] font-bold text-white shadow-[0_10px_22px_rgba(185,87,61,0.19)] transition duration-200 hover:-translate-y-0.5 hover:bg-[#a94c34] hover:shadow-[0_14px_26px_rgba(185,87,61,0.24)] active:translate-y-0 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-65 disabled:hover:translate-y-0"
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

            <div className="mt-6 border-t border-[#e6e3da] pt-5 text-center">
              <p className="text-[12px] text-[#777c72]">
                New customer?{' '}
                <Link to="/customer-register" className="font-bold text-[#ae5139] decoration-[#ae5139]/40 underline-offset-4 transition hover:text-[#883c2a] hover:underline">
                  Apply for an account
                </Link>
              </p>
            </div>

            <div className="mt-5 flex flex-col items-center gap-1.5 text-center">
              <div className="inline-flex items-center gap-2 text-[10px] font-medium text-[#858a80]">
                <ShieldCheck size={13} strokeWidth={1.8} className="text-[#829071]" />
                Secure access for authorised Janasiri accounts.
              </div>
              <p className="text-[10px] text-[#a0a399]">
                Need help?{' '}
                <a href="tel:+94814950206" className="font-semibold text-[#737a6c] transition hover:text-[#a94c34]">+94 81 495 0206</a>
              </p>
            </div>

            {/* Company details remain available on smaller screens too */}
            <div className="mt-7 border-t border-[#e6e3da] pt-5 lg:hidden">
              <p className="mb-3 text-[9px] font-bold uppercase tracking-[0.18em] text-[#9a7769]">Janasiri · Locations & contact</p>
              <div className="grid grid-cols-2 gap-2">
                {companyLocations.map((location) => (
                  <MobileInfoCard key={location.title} {...location} />
                ))}
              </div>
              <a href="https://janasiri.com" target="_blank" rel="noreferrer" className="mt-4 block text-center text-[10px] font-semibold tracking-[0.12em] text-[#9a6a59]">
                WWW.JANASIRI.COM
              </a>
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
    <article className="flex min-h-[82px] min-w-0 items-start gap-3 rounded-2xl border border-white/[0.10] bg-white/[0.055] p-3.5 transition duration-200 hover:border-[#d77c60]/30 hover:bg-white/[0.08]">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#d77c60]/[0.14] text-[#e5a28d]">
        <Icon size={16} strokeWidth={1.9} />
      </div>
      <div className="min-w-0 pt-0.5">
        <h3 className="text-[10px] font-bold tracking-[0.02em] text-white/90">{title}</h3>
        <p className="mt-1 whitespace-pre-line break-words text-[10px] leading-[1.45] text-white/55">{details}</p>
      </div>
    </article>
  );
}

function MobileInfoCard({ icon: Icon, title, details }: InfoCardProps) {
  return (
    <article className="flex min-w-0 items-start gap-2 rounded-xl border border-[#e8e4db] bg-white/75 p-2.5">
      <Icon size={14} strokeWidth={1.8} className="mt-0.5 shrink-0 text-[#b9573d]" />
      <div className="min-w-0">
        <h3 className="text-[9px] font-bold text-[#454b43]">{title}</h3>
        <p className="mt-1 whitespace-pre-line break-words text-[9px] leading-[1.4] text-[#858a80]">{details}</p>
      </div>
    </article>
  );
}
