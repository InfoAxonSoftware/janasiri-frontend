import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import {
  Eye,
  EyeOff,
  Loader2,
  LogIn,
  ShieldCheck,
  BarChart3,
  Package,
} from 'lucide-react';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const {
    login,
    isLoading,
    error,
    isAuthenticated,
    user,
    clearError,
  } = useAuth();

  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated && user) {
      const routes: Record<string, string> = {
        SuperAdmin: '/admin',
        Admin: '/admin',
        SalesRep: '/rep',
        Customer: '/shop',
        SalesCoordinator: '/coordinator',
      };

      navigate(routes[user.role] || '/login');
    }
  }, [isAuthenticated, user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    await login(username, password);
  };

  const brandPrimary = '#C15B3E';

  return (
    <div className="min-h-screen w-full flex bg-white text-slate-900 font-sans">

      {/* =========================
          LEFT SIDE
      ========================== */}
      <div className="hidden lg:flex lg:w-3/5 bg-slate-50 border-r border-slate-100 flex-col p-16 justify-between relative overflow-hidden">

        {/* Background pattern */}
        <div
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage:
              'radial-gradient(#000 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />

        <div className="relative z-10 flex flex-col justify-center flex-1">

          {/* Demo Branding */}
          <div className="flex items-center gap-5 mb-14">

            <div
              className="w-20 h-20 rounded-2xl flex items-center justify-center shadow-lg"
              style={{ backgroundColor: brandPrimary }}
            >
              <BarChart3
                className="w-10 h-10 text-white"
                strokeWidth={2.2}
              />
            </div>

            <div className="flex flex-col">
              <h1 className="text-3xl font-extrabold tracking-tight text-slate-950">
                DISTRIBUTION
              </h1>

              <p
                className="text-sm font-bold uppercase tracking-[0.25em]"
                style={{ color: brandPrimary }}
              >
                Management System
              </p>
            </div>
          </div>

          {/* Main Heading */}
          <div className="space-y-5 max-w-2xl">

            <span
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border"
              style={{
                color: brandPrimary,
                borderColor: `${brandPrimary}40`,
                backgroundColor: `${brandPrimary}08`,
              }}
            >
              <ShieldCheck className="w-4 h-4" />
              Demo Environment
            </span>

            <h2 className="text-5xl font-extrabold leading-[1.08] tracking-tight text-slate-950">
              Smarter distribution.
              <br />
              <span style={{ color: brandPrimary }}>
                Better business.
              </span>
            </h2>

            <p className="text-lg leading-8 text-slate-600 max-w-xl">
              A modern distribution management platform designed to
              simplify sales, customers, products, orders and business
              operations from one place.
            </p>
          </div>

          {/* Feature Cards */}
          <div className="grid grid-cols-3 gap-4 mt-14 max-w-2xl">

            <FeatureCard
              icon={Package}
              title="Inventory"
              description="Products & stock"
            />

            <FeatureCard
              icon={BarChart3}
              title="Analytics"
              description="Reports & insights"
            />

            <FeatureCard
              icon={ShieldCheck}
              title="Secure"
              description="Role-based access"
            />

          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10 flex items-center justify-between pt-8 border-t border-slate-200">

          <p className="text-xs text-slate-400">
            Demo System • {new Date().getFullYear()}
          </p>

          <p className="text-xs font-medium text-slate-400">
            Distribution Management Platform
          </p>

        </div>
      </div>

      {/* =========================
          RIGHT SIDE
      ========================== */}
      <div className="w-full lg:w-2/5 flex items-center justify-center p-8 md:p-12 lg:p-16">

        <div className="w-full max-w-md">

          {/* Mobile Branding */}
          <div className="lg:hidden text-center mb-10">

            <div
              className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center shadow-lg mb-4"
              style={{ backgroundColor: brandPrimary }}
            >
              <BarChart3
                className="w-8 h-8 text-white"
                strokeWidth={2.2}
              />
            </div>

            <h1 className="text-2xl font-extrabold tracking-tight text-slate-950">
              DISTRIBUTION
            </h1>

            <p
              className="text-xs font-bold uppercase tracking-[0.22em] mt-1"
              style={{ color: brandPrimary }}
            >
              Management System
            </p>

          </div>

          {/* Login Heading */}
          <div className="space-y-3 mb-9">

            <span
              className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider"
              style={{ color: brandPrimary }}
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: brandPrimary }}
              />
              Demo Access
            </span>

            <h2 className="text-3xl font-extrabold tracking-tight text-slate-950">
              Welcome back
            </h2>

            <p className="text-base text-slate-500">
              Sign in to access the management portal.
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-3 px-4 py-3.5 mb-6 rounded-xl bg-red-50 border border-red-200 text-sm font-medium text-red-800 animate-scale-in">

              <div className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0 mt-1.5" />

              <span>{error}</span>

            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-6">

            {/* Username */}
            <div className="space-y-2">

              <label
                htmlFor="username"
                className="block text-sm font-semibold text-slate-700"
              >
                Username
              </label>

              <input
                id="username"
                name="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                required
                autoComplete="username"
                className="
                  w-full
                  px-4
                  py-3.5
                  text-sm
                  border
                  border-slate-200
                  rounded-xl
                  bg-white
                  text-slate-900
                  placeholder:text-slate-400
                  outline-none
                  transition-all
                  duration-200
                  focus:border-slate-400
                  focus:ring-4
                  focus:ring-slate-100
                  hover:border-slate-300
                "
              />

            </div>

            {/* Password */}
            <div className="space-y-2">

              <label
                htmlFor="password"
                className="block text-sm font-semibold text-slate-700"
              >
                Password
              </label>

              <div className="relative">

                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  autoComplete="current-password"
                  className="
                    w-full
                    px-4
                    py-3.5
                    pr-12
                    text-sm
                    border
                    border-slate-200
                    rounded-xl
                    bg-white
                    text-slate-900
                    placeholder:text-slate-400
                    outline-none
                    transition-all
                    duration-200
                    focus:border-slate-400
                    focus:ring-4
                    focus:ring-slate-100
                    hover:border-slate-300
                  "
                />

                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="
                    absolute
                    right-3
                    top-1/2
                    -translate-y-1/2
                    p-2
                    rounded-lg
                    text-slate-400
                    hover:text-slate-600
                    hover:bg-slate-50
                    transition
                  "
                  aria-label={
                    showPassword
                      ? 'Hide password'
                      : 'Show password'
                  }
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>

              </div>

            </div>

            {/* Sign In */}
            <button
              type="submit"
              disabled={isLoading}
              className="
                w-full
                flex
                items-center
                justify-center
                gap-2.5
                px-6
                py-4
                rounded-xl
                text-base
                font-semibold
                text-white
                border-none
                transition-all
                duration-200
                disabled:opacity-60
                disabled:cursor-not-allowed
                hover:-translate-y-0.5
                active:translate-y-0
              "
              style={{
                backgroundColor: brandPrimary,
                boxShadow: `0 10px 24px ${brandPrimary}25`,
              }}
            >

              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  Sign In
                </>
              )}

            </button>

          </form>

          {/* Demo Notice */}
          <div className="mt-8">

            <div className="flex items-start gap-3 p-4 rounded-xl bg-slate-50 border border-slate-100">

              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{
                  backgroundColor: `${brandPrimary}12`,
                  color: brandPrimary,
                }}
              >
                <ShieldCheck className="w-5 h-5" />
              </div>

              <div>
                <p className="text-sm font-semibold text-slate-800">
                  Demo Environment
                </p>

                <p className="text-xs text-slate-500 mt-1 leading-5">
                  This interface is provided for system demonstration
                  and evaluation purposes.
                </p>
              </div>

            </div>

          </div>

          {/* Registration */}
          <div className="text-center mt-8 pt-7 border-t border-slate-100">

            <p className="text-sm text-slate-500">
              New customer?{' '}

              <Link
                to="/customer-register"
                className="font-semibold hover:underline transition"
                style={{ color: brandPrimary }}
              >
                Apply for an account
              </Link>
            </p>

          </div>

        </div>
      </div>
    </div>
  );
}

/* =========================
   Feature Card
========================= */

interface FeatureCardProps {
  icon: React.ElementType;
  title: string;
  description: string;
}

function FeatureCard({
  icon: Icon,
  title,
  description,
}: FeatureCardProps) {
  return (
    <div className="
      bg-white
      border
      border-slate-200
      rounded-2xl
      p-5
      shadow-sm
      transition
      hover:shadow-md
      hover:-translate-y-0.5
    ">

      <div className="
        w-10
        h-10
        rounded-xl
        bg-slate-100
        flex
        items-center
        justify-center
        mb-4
      ">
        <Icon
          className="w-5 h-5 text-slate-700"
          strokeWidth={2.2}
        />
      </div>

      <h3 className="text-sm font-bold text-slate-900">
        {title}
      </h3>

      <p className="text-xs text-slate-500 mt-1 leading-5">
        {description}
      </p>

    </div>
  );
}