import { useEffect, useMemo, useState } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useSignalR } from '../../hooks/useSignalR';
import { useQuery } from '@tanstack/react-query';
import { notificationsApi } from '../../services/api/notificationsApi';
import {
  LayoutDashboard, MapPin, Users, ShoppingCart,
  TrendingUp, LogOut, Bell, BarChart3,
  Menu, X, ChevronLeft, Zap, MessageSquare, FileText, User, Package, Sparkles, CreditCard, Warehouse
} from 'lucide-react';
import ConfirmModal from '../common/ConfirmModal';
import NotificationPanel from '../common/NotificationPanel';
import { useSectionNotificationBadges } from '../../hooks/useSectionNotificationBadges';
import { useAutoCollapseSidebar } from '../../hooks/useAutoCollapseSidebar';

const navItems = [
  { to: '/rep', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/rep/routes', icon: MapPin, label: 'Routes' },
  { to: '/rep/orders', icon: ShoppingCart, label: 'Orders' },
  { to: '/rep/quotations', icon: FileText, label: 'Quotations' },
  { to: '/rep/quick-requests', icon: Sparkles, label: 'Quick Order' },
  { to: '/rep/payment-reports', icon: CreditCard, label: 'Receive Payments' },
  { to: '/rep/products', icon: Package, label: 'Products' },
  { to: '/rep/customers', icon: Users, label: 'Clients' },
  { to: '/rep/outstanding-reports', icon: TrendingUp, label: 'Outstanding' },
  { to: '/rep/stock-reports', icon: Warehouse, label: 'Stock Reports' },
  { to: '/rep/sales-summary', icon: BarChart3, label: 'Sales Summary' },
  { to: '/rep/performance', icon: TrendingUp, label: 'Performance' },
  { to: '/rep/support', icon: MessageSquare, label: 'Support' },
  { to: '/rep/profile', icon: User, label: 'Profile' },
];

const bottomNavItems = [
  { to: '/rep', icon: LayoutDashboard, label: 'Home', end: true },
  { to: '/rep/routes', icon: MapPin, label: 'Routes' },
  { to: '/rep/orders', icon: ShoppingCart, label: 'Orders' },
  { to: '/rep/customers', icon: Users, label: 'Clients' },
  { to: '/rep/performance', icon: TrendingUp, label: 'Stats' },
  { to: '/rep/profile', icon: User, label: 'Profile' },
];

export default function RepLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const { user, logout } = useAuth();
  useSignalR();
  const navigate = useNavigate();
  const location = useLocation();

  useAutoCollapseSidebar({ sidebarOpen, setSidebarOpen });

  const userId = user?.id;

  const { data: unreadCount } = useQuery({
    queryKey: ['unread-count', userId],
    queryFn: () => notificationsApi.getUnreadCount().then(r => r.data.data),
    enabled: !!userId,
    // polling disabled to reduce backend load; updates will come via SignalR invalidation
    // refetchInterval: 30000,
  });

  const handleLogout = () => setLogoutConfirmOpen(true);

  const handleConfirmLogout = () => { setLogoutConfirmOpen(false); logout().then(() => navigate('/login')); }; 

  const currentPage = navItems.find(item =>
    item.end ? location.pathname === item.to : location.pathname.startsWith(item.to)
  );

  const sectionMap = useMemo(() => ({
    routes: ['RouteCreated', 'RouteAssigned', 'RouteUpdated', 'RouteDeleted'],
    orders: ['NewOrder', 'OrderStatusUpdate'],
    quotations: ['QuotationSubmitted', 'QuotationApproved', 'QuotationRejected'],
    customers: ['CustomerAssignment', 'CustomerApproval', 'CustomerRejection'],
    support: ['ComplaintUpdate', 'SupportResolution'],
    performance: ['TargetAchievement'],
  }), []);

  const { counts, markSectionAsRead } = useSectionNotificationBadges(userId, sectionMap);

  const activeSection = useMemo(() => {
    const path = location.pathname;
    if (path.startsWith('/rep/routes')) return 'routes';
    if (path.startsWith('/rep/orders')) return 'orders';
    if (path.startsWith('/rep/quotations')) return 'quotations';
    if (path.startsWith('/rep/customers')) return 'customers';
    if (path.startsWith('/rep/support')) return 'support';
    if (path.startsWith('/rep/performance')) return 'performance';
    return '';
  }, [location.pathname]);

  useEffect(() => {
    if (!activeSection) return;
    if ((counts[activeSection] || 0) === 0) return;
    markSectionAsRead(activeSection);
  }, [activeSection, counts, markSectionAsRead]);

  const itemSection: Record<string, string> = {
    '/rep/routes': 'routes',
    '/rep/orders': 'orders',
    '/rep/quotations': 'quotations',
    '/rep/customers': 'customers',
    '/rep/support': 'support',
    '/rep/performance': 'performance',
  };

  return (
    <div className="flex h-screen bg-slate-50">
      {/* ========== DESKTOP SIDEBAR (lg+) ========== */}
      <aside
        className={`hidden lg:flex flex-col bg-white border-r border-slate-200/80 transition-all duration-300 ease-in-out ${
          sidebarOpen ? 'w-60' : 'w-[68px]'
        }`}
      >
        {/* Sidebar Header */}
        <div className={`flex items-center h-14 border-b border-slate-100 ${sidebarOpen ? 'px-4 gap-3' : 'justify-center'}`}>
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0 overflow-hidden bg-white"
          >
            <img src="/logo.png" alt="JANASIRI DISTRIBUTORS (PVT) LTD" className="w-full h-full object-fit" />
          </div>
          {sidebarOpen && (
            <div className="overflow-hidden">
              <span className="font-bold text-slate-900 text-xs">JANASIRI DISTRIBUTORS</span>
              <p className="text-[10px] text-slate-400 -mt-0.5">Field Agent Portal</p>
            </div>
          )}
        </div>

        {/* Nav Items */}
        <nav className="flex-1 p-2.5 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `group flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-emerald-50 text-emerald-700 shadow-sm shadow-emerald-500/5'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                } ${!sidebarOpen ? 'justify-center' : ''}`
              }
            >
              {({ isActive }) => (
                <>
                  <div className={`flex-shrink-0 ${isActive ? '' : 'group-hover:scale-110 transition-transform'}`}>
                    <item.icon className={`w-[18px] h-[18px] ${isActive ? 'text-emerald-600' : ''}`} />
                  </div>
                  {sidebarOpen && (
                    <span className="flex-1">{item.label}</span>
                  )}
                  {sidebarOpen && (() => {
                    const section = itemSection[item.to];
                    const count = section ? (counts[section] || 0) : 0;
                    if (!count) return null;
                    return (
                      <span className="bg-emerald-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                        {count}
                      </span>
                    );
                  })()}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-2.5 border-t border-slate-100">
          {sidebarOpen ? (
            <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-slate-50">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center flex-shrink-0">
                <span className="text-white text-xs font-bold">{user?.username?.[0]?.toUpperCase()}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-700 truncate">{user?.username}</p>
                <p className="text-[10px] text-slate-400">Sales Rep</p>
              </div>
              <button onClick={handleLogout} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button onClick={handleLogout} className="w-full flex justify-center p-2.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition">
              <LogOut className="w-[18px] h-[18px]" />
            </button>
          )}
        </div>
      </aside>

      {/* ========== MOBILE SIDEBAR OVERLAY ========== */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
          <aside className="fixed left-0 top-0 bottom-0 w-[86vw] max-w-[360px] bg-white z-50 animate-slide-in shadow-2xl">
            <div className="flex items-center justify-between px-5 h-14 md:h-16 border-b border-slate-100 pt-safe">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                  <Zap className="w-4 h-4 text-white" />
                </div>
                <span className="font-bold text-slate-900 text-sm">Sales<span className="text-emerald-600">Rep</span></span>
              </div>
              <button onClick={() => setMobileMenuOpen(false)} className="p-2 hover:bg-slate-100 rounded-xl transition">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <nav className="p-3 space-y-0.5 overflow-y-auto h-[calc(100%-124px)] md:h-[calc(100%-136px)]">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-3 rounded-xl text-[13px] font-medium transition-all ${
                      isActive ? 'bg-emerald-50 text-emerald-700' : 'text-slate-500 hover:bg-slate-50'
                    }`
                  }
                >
                  <item.icon className="w-[18px] h-[18px]" />
                  <span className="flex-1">{item.label}</span>
                  {(() => {
                    const section = itemSection[item.to];
                    const count = section ? (counts[section] || 0) : 0;
                    if (!count) return null;
                    return (
                      <span className="bg-emerald-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                        {count}
                      </span>
                    );
                  })()}
                </NavLink>
              ))}
            </nav>
            <div className="absolute bottom-0 left-0 right-0 p-3 border-t border-slate-100 bg-white pb-safe">
              <button onClick={handleLogout} className="flex items-center gap-3 px-3 py-3 text-sm text-red-600 hover:bg-red-50 w-full rounded-xl transition">
                <LogOut className="w-[18px] h-[18px]" /><span className="font-medium">Sign Out</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* ========== MAIN CONTENT ========== */}
      {logoutConfirmOpen && (
        <ConfirmModal
          open={logoutConfirmOpen}
          title="Sign out"
          description="Are you sure you want to sign out?"
          confirmLabel="Sign out"
          confirmVariant="emerald"
          onConfirm={handleConfirmLogout}
          onCancel={() => setLogoutConfirmOpen(false)}
        />
      )}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="bg-white/85 backdrop-blur-xl border-b border-slate-200/60 px-3 md:px-4 lg:px-6 h-14 md:h-16 lg:h-14 pt-safe lg:pt-0 flex items-center justify-between flex-shrink-0 sticky top-0 z-30">
          <div className="flex items-center gap-3">
            {/* Mobile: hamburger */}
            <button className="lg:hidden p-2.5 hover:bg-slate-100 rounded-xl transition" onClick={() => setMobileMenuOpen(true)}>
              <Menu className="w-5 h-5 text-slate-600" />
            </button>
            {/* Desktop: sidebar toggle */}
            <button className="hidden lg:flex p-2 hover:bg-slate-100 rounded-xl transition" onClick={() => setSidebarOpen(!sidebarOpen)}>
              {sidebarOpen ? <ChevronLeft className="w-5 h-5 text-slate-400" /> : <Menu className="w-5 h-5 text-slate-400" />}
            </button>

            {/* Mobile: brand */}
            <div className="lg:hidden flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                <span className="text-white font-black text-xs">J</span>
              </div>
              <span className="font-bold text-slate-900 text-sm md:text-base">JANASIRI DISTRIBUTORS (PVT) LTD</span>
            </div>
            {/* Desktop: page title */}
            <div className="hidden lg:block">
              <h2 className="text-sm font-semibold text-slate-800">{currentPage?.label || 'Dashboard'}</h2>
            </div>
          </div>

          <div className="flex items-center gap-1 lg:gap-2">
            <div className="relative">
              <button
                onClick={() => setShowNotifications((v) => !v)}
                className="relative p-2.5 md:p-3 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition"
              >
                <Bell className="w-[18px] h-[18px]" />
                {(unreadCount ?? 0) > 0 && (
                  <span className="absolute top-1 right-1 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-[9px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1 shadow-lg shadow-emerald-500/30 animate-scale-in">
                    {unreadCount}
                  </span>
                )}
              </button>
              <NotificationPanel open={showNotifications} onClose={() => setShowNotifications(false)} userId={userId} accent="emerald" />
            </div>
            {/* Desktop: user info */}
            <div className="hidden lg:flex items-center gap-2.5 ml-1 pl-3 border-l border-slate-200">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-500 to-slate-600 flex items-center justify-center">
                <span className="text-white text-xs font-bold">{user?.username?.[0]?.toUpperCase()}</span>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-700">{user?.username}</p>
                <p className="text-[10px] text-slate-400">Sales Rep</p>
              </div>
              <button onClick={handleLogout} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition ml-1">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
            {/* Mobile: logout */}
            <button onClick={handleLogout} className="lg:hidden p-2.5 md:p-3 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition">
              <LogOut className="w-[18px] h-[18px]" />
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto pb-[calc(env(safe-area-inset-bottom,0px)+86px)] md:pb-[calc(env(safe-area-inset-bottom,0px)+92px)] lg:pb-0">
          <div className="px-3 pt-3 md:px-4 md:pt-4 w-full lg:px-6 lg:pt-5 lg:pb-6">
            <Outlet />
          </div>
        </main>

        {/* ========== MOBILE BOTTOM NAV (hidden on lg+) ========== */}
        <nav className="fixed bottom-0 left-0 right-0 z-40 lg:hidden bg-white/90 backdrop-blur-xl border-t border-slate-200/60 shadow-[0_-6px_20px_rgba(15,23,42,0.08)] flex-shrink-0 pb-safe">
          <div className="flex justify-around px-2 md:px-4 md:max-w-3xl md:mx-auto">
            {bottomNavItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex flex-col items-center py-2.5 md:py-3 px-2.5 min-w-[56px] md:min-w-[68px] transition-all duration-200 ${
                    isActive ? 'text-emerald-600' : 'text-slate-400'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <div className={`p-1 rounded-xl transition-all duration-200 ${isActive ? 'bg-emerald-50' : ''}`}>
                      <item.icon className={`w-5 h-5 transition-transform ${isActive ? 'scale-110' : ''}`} />
                    </div>
                    <span className={`text-[10px] mt-0.5 font-medium ${isActive ? 'text-emerald-700' : ''}`}>{item.label}</span>
                    {isActive && <div className="w-4 h-0.5 bg-emerald-500 rounded-full mt-0.5" />}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </nav>
      </div>
    </div>
  );
}
