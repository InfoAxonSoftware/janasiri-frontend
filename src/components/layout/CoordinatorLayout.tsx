import { useEffect, useMemo, useState } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useSignalR } from '../../hooks/useSignalR';
import { useQuery } from '@tanstack/react-query';
import { notificationsApi } from '../../services/api/notificationsApi';
import {
  LayoutDashboard, Users, UserCheck, FileText,
  LogOut, Bell, Menu, X, ChevronLeft,
  Shield, UsersRound, ShoppingCart, MessageSquare, User, MapPin, CreditCard
} from 'lucide-react';
import ConfirmModal from '../common/ConfirmModal';
import NotificationPanel from '../common/NotificationPanel';
import { useSectionNotificationBadges } from '../../hooks/useSectionNotificationBadges';
import { useAutoCollapseSidebar } from '../../hooks/useAutoCollapseSidebar';

const navItems = [
  { to: '/coordinator', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/coordinator/team', icon: UsersRound, label: 'My Team' },
  { to: '/coordinator/routes', icon: MapPin, label: 'Route Manage' },
  { to: '/coordinator/customers', icon: Users, label: 'Customers' },
  { to: '/coordinator/orders', icon: ShoppingCart, label: 'Orders' },
  { to: '/coordinator/approvals', icon: UserCheck, label: 'Approvals' },
  { to: '/coordinator/support', icon: MessageSquare, label: 'Support' },
  { to: '/coordinator/quotations', icon: FileText, label: 'Quotations' },
  { to: '/coordinator/payment-reports', icon: CreditCard, label: 'Receive Payments' },
  { to: '/coordinator/profile', icon: User, label: 'Profile' },
];

const bottomNavItems = [
  { to: '/coordinator', icon: LayoutDashboard, label: 'Home', end: true },
  { to: '/coordinator/team', icon: UsersRound, label: 'Team' },
  { to: '/coordinator/routes', icon: MapPin, label: 'Routes' },
  { to: '/coordinator/orders', icon: ShoppingCart, label: 'Orders' },
  { to: '/coordinator/support', icon: MessageSquare, label: 'Support' },
  { to: '/coordinator/approvals', icon: UserCheck, label: 'Approvals' },
  { to: '/coordinator/quotations', icon: FileText, label: 'Quotes' },
  { to: '/coordinator/profile', icon: User, label: 'Profile' },
];

export default function CoordinatorLayout() {
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
    approvals: ['CustomerRegistration', 'CustomerApproval', 'CustomerRejection', 'CustomerAssignment'],
    support: ['ComplaintUpdate', 'SupportResolution'],
    customers: ['CustomerRegistration', 'CustomerApproval', 'CustomerRejection', 'CustomerAssignment'],
  }), []);

  const { counts, markSectionAsRead } = useSectionNotificationBadges(userId, sectionMap);

  const activeSection = useMemo(() => {
    const path = location.pathname;
    if (path.startsWith('/coordinator/routes')) return 'routes';
    if (path.startsWith('/coordinator/orders')) return 'orders';
    if (path.startsWith('/coordinator/quotations')) return 'quotations';
    if (path.startsWith('/coordinator/approvals')) return 'approvals';
    if (path.startsWith('/coordinator/support')) return 'support';
    if (path.startsWith('/coordinator/customers')) return 'customers';
    return '';
  }, [location.pathname]);

  useEffect(() => {
    if (!activeSection) return;
    if ((counts[activeSection] || 0) === 0) return;
    markSectionAsRead(activeSection);
  }, [activeSection, counts, markSectionAsRead]);

  const itemSection: Record<string, string> = {
    '/coordinator/routes': 'routes',
    '/coordinator/orders': 'orders',
    '/coordinator/quotations': 'quotations',
    '/coordinator/approvals': 'approvals',
    '/coordinator/support': 'support',
    '/coordinator/customers': 'customers',
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
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 flex-shrink-0">
            <span className="text-white font-black text-xs">J</span>
          </div>
          {sidebarOpen && (
            <div className="overflow-hidden">
              <span className="font-bold text-slate-900 text-sm">JANASIRI DISTRIBUTORS (PVT) LTD</span>
              <p className="text-[10px] text-slate-400 -mt-0.5">Coordinator Portal</p>
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
                    ? 'bg-cyan-50 text-cyan-700 shadow-sm shadow-cyan-500/5'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                } ${!sidebarOpen ? 'justify-center' : ''}`
              }
            >
              {({ isActive }) => (
                <>
                  <div className={`flex-shrink-0 ${isActive ? '' : 'group-hover:scale-110 transition-transform'}`}>
                    <item.icon className={`w-[18px] h-[18px] ${isActive ? 'text-cyan-600' : ''}`} />
                  </div>
                  {sidebarOpen && (
                    <span className="flex-1">{item.label}</span>
                  )}
                  {sidebarOpen && (() => {
                    const section = itemSection[item.to];
                    const count = section ? (counts[section] || 0) : 0;
                    if (!count) return null;
                    return (
                      <span className="bg-cyan-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
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
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center flex-shrink-0">
                <span className="text-white text-xs font-bold">{user?.username?.[0]?.toUpperCase()}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-700 truncate">{user?.username}</p>
                <p className="text-[10px] text-slate-400">Coordinator</p>
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
          <aside className="fixed left-0 top-0 bottom-0 w-72 bg-white z-50 animate-slide-in shadow-2xl">
            <div className="flex items-center justify-between px-5 h-14 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                  <Shield className="w-4 h-4 text-white" />
                </div>
                <span className="font-bold text-slate-900 text-sm">Sales<span className="text-cyan-600">Coord</span></span>
              </div>
              <button onClick={() => setMobileMenuOpen(false)} className="p-2 hover:bg-slate-100 rounded-xl transition">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <nav className="p-3 space-y-0.5">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all ${
                      isActive ? 'bg-cyan-50 text-cyan-700' : 'text-slate-500 hover:bg-slate-50'
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
                      <span className="bg-cyan-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                        {count}
                      </span>
                    );
                  })()}
                </NavLink>
              ))}
            </nav>
            <div className="absolute bottom-0 left-0 right-0 p-3 border-t border-slate-100">
              <button onClick={handleLogout} className="flex items-center gap-3 px-3 py-2.5 text-sm text-red-600 hover:bg-red-50 w-full rounded-xl transition">
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
        <header className="bg-white/80 backdrop-blur-xl border-b border-slate-200/60 px-4 lg:px-6 h-14 flex items-center justify-between flex-shrink-0 sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <button className="lg:hidden p-2 hover:bg-slate-100 rounded-xl transition" onClick={() => setMobileMenuOpen(true)}>
              <Menu className="w-5 h-5 text-slate-600" />
            </button>
            <button className="hidden lg:flex p-2 hover:bg-slate-100 rounded-xl transition" onClick={() => setSidebarOpen(!sidebarOpen)}>
              {sidebarOpen ? <ChevronLeft className="w-5 h-5 text-slate-400" /> : <Menu className="w-5 h-5 text-slate-400" />}
            </button>
            <div className="lg:hidden flex items-center gap-2">
              <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0 overflow-hidden bg-white"
          >
            <img src="/logo.png" alt="JANASIRI DISTRIBUTORS (PVT) LTD" className="w-full h-full object-fit" />
          </div>
              <span className="font-bold text-slate-900 text-xs">JANASIRI DISTRIBUTORS</span>
            </div>
            <div className="hidden lg:block">
              <h2 className="text-sm font-semibold text-slate-800">{currentPage?.label || 'Dashboard'}</h2>
            </div>
          </div>

          <div className="flex items-center gap-1 lg:gap-2">
            <div className="relative">
              <button
                onClick={() => setShowNotifications((v) => !v)}
                className="relative p-2.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition"
              >
                <Bell className="w-[18px] h-[18px]" />
                {(unreadCount ?? 0) > 0 && (
                  <span className="absolute top-1 right-1 bg-gradient-to-r from-cyan-500 to-blue-500 text-white text-[9px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1 shadow-lg shadow-cyan-500/30 animate-scale-in">
                    {unreadCount}
                  </span>
                )}
              </button>
              <NotificationPanel open={showNotifications} onClose={() => setShowNotifications(false)} userId={userId} />
            </div>
            <div className="hidden lg:flex items-center gap-2.5 ml-1 pl-3 border-l border-slate-200">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                <span className="text-white text-xs font-bold">{user?.username?.[0]?.toUpperCase()}</span>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-700">{user?.username}</p>
                <p className="text-[10px] text-slate-400">Coordinator</p>
              </div>
              <button onClick={handleLogout} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition ml-1">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
            <button onClick={handleLogout} className="lg:hidden p-2.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition">
              <LogOut className="w-[18px] h-[18px]" />
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto pb-20 lg:pb-0">
          <div className="lg:p-6 w-full">
            <Outlet />
          </div>
        </main>

        {/* ========== MOBILE BOTTOM NAV ========== */}
        <nav className="fixed bottom-0 left-0 right-0 z-40 lg:hidden bg-white/90 backdrop-blur-xl border-t border-slate-200/60 flex-shrink-0 pb-safe">
          <div className="flex justify-around px-2">
            {bottomNavItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex flex-col items-center py-2 px-3 min-w-[56px] transition-all duration-200 ${
                    isActive ? 'text-cyan-600' : 'text-slate-400'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <div className={`p-1 rounded-xl transition-all duration-200 ${isActive ? 'bg-cyan-50' : ''}`}>
                      <item.icon className={`w-5 h-5 transition-transform ${isActive ? 'scale-110' : ''}`} />
                    </div>
                    <span className={`text-[10px] mt-0.5 font-medium ${isActive ? 'text-cyan-700' : ''}`}>{item.label}</span>
                    {isActive && <div className="w-4 h-0.5 bg-cyan-500 rounded-full mt-0.5" />}
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
