import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Eye, EyeOff, Loader2, LogIn, MapPin, Phone, Building2 } from 'lucide-react';
// useSystemBranding epa, api dynamic nethuwa Janasiri ekatama hdmu.

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { login, isLoading, error, isAuthenticated, user, clearError } = useAuth();
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

  // Primary Brand Color from the new logo
  const brandPrimary = '#C15B3E';

  return (
    <div className="min-h-screen w-full flex bg-white text-slate-900 font-sans">
      
      {/* -------------------- LEFT SIDE: Business Branding & Details -------------------- */}
      <div className="hidden lg:flex lg:w-3/5 bg-slate-50 border-r border-slate-100 flex-col p-16 justify-between relative overflow-hidden">
        
        {/* Subtle background pattern (dot grid) */}
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>
        
        <div className="relative z-10 space-y-12">
          {/* Main Logo & Title */}
          <div className="flex items-center gap-5">
            <img src="/logo.png" alt="Janasiri Logo" className="w-20 h-20 object-contain rounded-full shadow-sm" />
            <div className="flex flex-col">
              <h1 className="text-3xl font-extrabold tracking-tighter text-slate-950">
                JANASIRI <span style={{ color: brandPrimary }}>DISTRIBUTORS</span>
              </h1>
              <p className="text-sm font-semibold text-slate-600 uppercase tracking-widest -mt-1">(PVT) LTD</p>
            </div>
          </div>

          <blockquote className="space-y-3">
            <p className="text-5xl font-bold text-slate-950 leading-tight tracking-tight">
              Sri Lanka's Trusted Food Service Partner.
            </p>
            <p className="text-lg text-slate-600 max-w-xl">
              Simplifying supply chains for thousands of businesses across the island. Reliable wholesale distribution management, optimized.
            </p>
          </blockquote>

          {/* Contact Details from Card */}
          <div className="grid grid-cols-2 gap-x-10 gap-y-8 pt-6 border-t border-slate-200">
            <InfoBlock icon={MapPin} title="Registered Office" details="No. 205, Wattarantenna Passage, Kandy." />
            <InfoBlock icon={MapPin} title="Warehouse Central" details="No. 02, Mawilmada Road, Kandy." />
            <InfoBlock icon={MapPin} title="Warehouse West" details="No. 41A, Gnanathilaka Road, Mount Lavinia." />
            <InfoBlock icon={Building2} title="Contact & VAT" details="+94 81 495 0206 | TP / Hotline | VAT: 114608394-7000" />
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10 flex justify-between items-center text-xs text-slate-400 pt-8 border-t border-slate-100">
          <p>&copy; {new Date().getFullYear()} Janasiri Distributors (Pvt) Ltd. All rights reserved.</p>
          <a href="https://janasiri.com" target="_blank" rel="noreferrer" className="hover:text-slate-600">WWW.JANASIRI.COM</a>
        </div>
      </div>

      {/* -------------------- RIGHT SIDE: Login Form -------------------- */}
      <div className="w-full lg:w-2/5 flex items-center justify-center p-8 md:p-12 lg:p-16">
        <div className="w-full max-w-md space-y-10 animate-fade-in-scale">
          
          {/* Mobile Logo Visibility (hidden on large screens) */}
          <div className="lg:hidden text-center flex flex-col items-center mb-10 gap-4">
             <img src="/logo.png" alt="Janasiri Logo" className="w-16 h-16 object-contain rounded-full shadow-sm" />
             <div className="flex flex-col">
              <h1 className="text-2xl font-extrabold tracking-tighter text-slate-950">
                JANASIRI <span style={{ color: brandPrimary }}>DISTRIBUTORS</span>
              </h1>
              <p className="text-xs font-semibold text-slate-600 uppercase tracking-widest -mt-1">(PVT) LTD</p>
            </div>
          </div>

          {/* Welcome Text */}
          <div className="space-y-2">
            <h2 className="text-3xl font-extrabold tracking-tighter text-slate-950">Welcome back</h2>
            <p className="text-base text-slate-600">Sign in to your wholesale management portal.</p>
          </div>

          {error && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm font-medium text-red-800 animate-scale-in">
              <div className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-7">
            {/* Username Input */}
            <div className="space-y-2">
              <label htmlFor="username" className="block text-sm font-semibold text-slate-700">
                Username
              </label>
              <input
                id="username"
                name="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Ex: jdist_coordinator"
                required
                className="w-full px-5 py-3.5 text-sm border border-slate-200 rounded-xl bg-white text-slate-900 placeholder:text-slate-400 outline-none transition duration-150 focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
              />
            </div>

            {/* Password Input */}
            <div className="space-y-2">
              <label htmlFor="password" className="block text-sm font-semibold text-slate-700">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;"
                  required
                  className="w-full px-5 py-3.5 text-sm border border-slate-200 rounded-xl bg-white text-slate-900 placeholder:text-slate-400 outline-none transition duration-150 focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-slate-400 hover:text-slate-600 transition"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Sign In Button (Branded Color) */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full font-semibold flex items-center justify-center gap-2.5 px-6 py-4 rounded-xl text-base text-white border-none cursor-pointer transition-all duration-200 shadow-lg disabled:opacity-60 disabled:cursor-not-allowed hover:shadow-xl hover:-translate-y-0.5"
              style={{
                backgroundColor: brandPrimary,
                boxShadow: `0 8px 16px ${brandPrimary}25`, // Add subtle color shadow
              }}
            >
              {isLoading ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Signing in...</>
              ) : (
                <><LogIn className="w-5 h-5" /> Sign In</>
              )}
            </button>
          </form>

          {/* Registration Section */}
          <div className="text-center pt-8 border-t border-slate-100">
            <p className="text-sm text-slate-500">
              New customer?{' '}
              <Link
                to="/customer-register"
                className="font-semibold transition hover:underline"
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

// Helper component for business info blocks
interface InfoBlockProps {
  icon: React.ElementType;
  title: string;
  details: string;
}

function InfoBlock({ icon: Icon, title, details }: InfoBlockProps) {
  return (
    <div className="flex items-start gap-3.5">
      <div className="p-2.5 rounded-xl bg-white border border-slate-100 text-slate-900 shadow-sm mt-1">
         <Icon className="w-5 h-5" strokeWidth={2.5} />
      </div>
      <div className="flex flex-col">
        <h4 className="font-bold text-slate-950 text-base">{title}</h4>
        <p className="text-sm text-slate-600 whitespace-pre-line">{details}</p>
      </div>
    </div>
  );
}