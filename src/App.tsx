import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuth } from './hooks/useAuth';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useSystemBranding } from './hooks/useSystemBranding';

// Layouts
import AdminLayout from './components/layout/AdminLayout';
import RepLayout from './components/layout/RepLayout';
import CustomerLayout from './components/layout/CustomerLayout';
import CoordinatorLayout from './components/layout/CoordinatorLayout';

// Route guard
import ProtectedRoute from './routes/ProtectedRoute';

// Auth pages
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import CustomerRegistration from './pages/auth/CustomerRegistration';
import ForceChangePassword from './pages/auth/ForceChangePassword';

// Admin pages
import AdminDashboard from './pages/admin/Dashboard';
import AdminProducts from './pages/admin/Products';
import AdminProductEditor from './pages/admin/ProductEditor';
import AdminOrders from './pages/admin/Orders';
import AdminCustomers from './pages/admin/Customers';
import AdminCustomerDetail from './pages/admin/CustomerDetail';
import CustomerSpecialPrices from './pages/admin/CustomerSpecialPrices';
import AdminCreateCustomer from './pages/admin/CreateCustomer';
import AdminReps from './pages/admin/Reps';
import AdminRepDetail from './pages/admin/RepDetail';
import CreateRep from './pages/admin/CreateRep';
import AdminOrderDetail from './pages/admin/OrderDetail';
import AdminPayments from './pages/admin/Payments';
import AdminPaymentReports from './pages/admin/PaymentReports';
import PaymentReportDetail from './pages/shared/PaymentReportDetail';
import AdminReports from './pages/admin/Reports';
import AdminOutstandingReports from './pages/admin/OutstandingReports';
import AdminStockReports from './pages/admin/StockReports';
import AdminSalesSummary from './pages/admin/SalesSummary';
import AdminSupport from './pages/admin/Support';
import AdminSupportDetail from './pages/admin/SupportDetail';
import AdminNotifications from './pages/admin/Notifications';
import AdminSettings from './pages/admin/Settings';
import AdminSpecialOffers from './pages/admin/SpecialOffers';
import AdminCoordinators from './pages/admin/Coordinators';
import AdminCoordinatorDetail from './pages/admin/CoordinatorDetail';
import CreateCoordinator from './pages/admin/CreateCoordinator';
import AdminQuotations from './pages/admin/Quotations';
import AdminRegions from './pages/admin/Regions';
import AdminRouteManagement from './pages/admin/RouteManagement.tsx';
import RegistrationRequestDetail from './pages/admin/RegistrationRequestDetail';
import AdminAccounts from './pages/admin/AdminAccounts';
import CreateAdminAccount from './pages/admin/CreateAdminAccount';

// Rep pages
import RepDashboard from './pages/rep/Dashboard';
import RepRoutes from './pages/rep/Routes';
import RepVisitDetail from './pages/rep/VisitDetail';
import RepRouteDetail from './pages/rep/RouteDetail';
import RepOrders from './pages/rep/Orders';
import RepPayments from './pages/rep/Payments';
import RepPaymentReports from './pages/rep/PaymentReports';
import RepCustomers from './pages/rep/Customers';
import RepCustomerDetail from './pages/rep/CustomerDetail';
import RepPerformance from './pages/rep/Performance';
import RepCreateOrder from './pages/rep/RepCreateOrder';
import RepCreatePayment from './pages/rep/RepCreatePayment';
import RepCreateCustomer from './pages/rep/RepCreateCustomer';
import RepSelectCustomer from './pages/rep/RepSelectCustomer';
import RepSelectProducts from './pages/rep/RepSelectProducts';
import RepOrderDetail from './pages/rep/OrderDetail';
import RepNotifications from './pages/rep/Notifications';
import RepSupport from './pages/rep/Support';
import RepCreateSupport from './pages/rep/RepCreateSupport';
import RepQuotations from './pages/rep/Quotations';
import RepCreateQuotation from './pages/rep/RepCreateQuotation';
import RepProfile from './pages/rep/RepProfile';
import RepProfileEdit from './pages/rep/RepProfileEdit';
import RepProducts from './pages/rep/RepProducts';
import RepSelectQuotationProducts from './pages/rep/RepSelectQuotationProducts';
import RepOutstandingReports from './pages/rep/RepOutstandingReports';
import RepStockReports from './pages/rep/RepStockReports';
import RepSalesSummary from './pages/rep/RepSalesSummary';
import RepQuickRequest from './pages/rep/RepQuickRequest';

// Coordinator pages
import CoordinatorDashboard from './pages/coordinator/Dashboard';
import CoordinatorTeam from './pages/coordinator/Team';
import CoordinatorRouteManagement from './pages/coordinator/RouteManagement.tsx';
import CoordinatorOrders from './pages/coordinator/Orders';
import CoordinatorOrderDetail from './pages/coordinator/OrderDetail';
import CoordinatorApprovals from './pages/coordinator/Approvals';
import CoordinatorQuotations from './pages/coordinator/Quotations';
import CoordinatorNotifications from './pages/coordinator/Notifications';
import CoordinatorSupport from './pages/coordinator/Support';
import CoordinatorCreateSupport from './pages/coordinator/CreateSupport';
import CoordinatorProfile from './pages/coordinator/Profile';
import CoordinatorCustomerSpecialPrices from './pages/coordinator/CustomerSpecialPrices';
import CoordinatorPaymentReports from './pages/coordinator/PaymentReports';

// Customer pages
import CustomerHome from './pages/customer/Home';
import CustomerProducts from './pages/customer/Products';
import CustomerProductCatalog from './pages/customer/ProductCatalog';
import CustomerGallery from './pages/customer/Gallery';
import CustomerCheckout from './pages/customer/Checkout';
import CustomerOrders from './pages/customer/Orders';
import CustomerLedger from './pages/customer/Ledger';
import CustomerOrderDetail from './pages/customer/OrderDetail';
import CustomerProfile from './pages/customer/Profile';
import CustomerNotifications from './pages/customer/Notifications';
import CustomerSupport from './pages/customer/Support';
import CustomerCreateSupport from './pages/customer/CustomerCreateSupport';
import CustomerQuotations from './pages/customer/Quotations';
import CustomerCreateQuotation from './pages/customer/CreateQuotation';

// Error pages
import NotFound from './pages/NotFound';
import Unauthorized from './pages/Unauthorized';

function RootRedirect() {
  const { isAuthenticated, user } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  const routes: Record<string, string> = { SuperAdmin: '/admin', Admin: '/admin', SalesRep: '/rep', Customer: '/shop', SalesCoordinator: '/coordinator' };
  return <Navigate to={routes[user?.role || ''] || '/login'} replace />;
}

export default function App() {
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuth();
  useSystemBranding();

  // clear react‑query cache when user signs out (or a different user logs in).
  // prevents showing leftover notification counts from a previous session.
  useEffect(() => {
    if (!isAuthenticated) {
      queryClient.clear();
    }
  }, [isAuthenticated, queryClient]);

  return (
    <BrowserRouter>
      <Toaster position="top-right" toastOptions={{ duration: 3000, className: 'toast', style: { fontSize: '14px' } }} />
      <Routes>
        {/* Root redirect */}
        <Route path="/" element={<RootRedirect />} />

        {/* Auth */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/customer-register" element={<CustomerRegistration />} />
        <Route path="/change-password" element={<ProtectedRoute><ForceChangePassword /></ProtectedRoute>} />
        <Route path="/unauthorized" element={<Unauthorized />} />

        {/* Admin routes */}
        <Route path="/admin" element={<ProtectedRoute allowedRoles={['Admin', 'SuperAdmin']}><AdminLayout /></ProtectedRoute>}>
          <Route index element={<AdminDashboard />} />
          <Route path="admin-accounts" element={<ProtectedRoute allowedRoles={['SuperAdmin']}><AdminAccounts /></ProtectedRoute>} />
          <Route path="admin-accounts/new" element={<ProtectedRoute allowedRoles={['SuperAdmin']}><CreateAdminAccount /></ProtectedRoute>} />
          <Route path="products" element={<AdminProducts />} />
          <Route path="products/new" element={<AdminProductEditor />} />
          <Route path="products/:id/edit" element={<AdminProductEditor />} />
          <Route path="orders" element={<AdminOrders />} />
          <Route path="orders/:id" element={<AdminOrderDetail />} />
          <Route path="customers" element={<AdminCustomers />} />
          <Route path="customers/new" element={<AdminCreateCustomer />} />
          <Route path="customers/:id" element={<AdminCustomerDetail />} />
          <Route path="customers/:id/special-prices" element={<CustomerSpecialPrices />} />
          <Route path="reps" element={<AdminReps />} />
          <Route path="reps/new" element={<CreateRep />} />
          <Route path="reps/:id" element={<AdminRepDetail />} />
          <Route path="payments" element={<AdminPayments />} />
          <Route path="payment-reports" element={<AdminPaymentReports />} />
          <Route path="payment-reports/:reportId" element={<PaymentReportDetail role="admin" />} />
          <Route path="reports" element={<AdminReports />} />
          <Route path="outstanding-reports" element={<AdminOutstandingReports />} />
          <Route path="stock-reports" element={<AdminStockReports />} />
          <Route path="sales-summary" element={<AdminSalesSummary />} />
          <Route path="support" element={<AdminSupport />} />
          <Route path="support/:id" element={<AdminSupportDetail />} />
          <Route path="notifications" element={<AdminNotifications />} />
          <Route path="special-offers" element={<AdminSpecialOffers />} />
          <Route path="settings" element={<AdminSettings />} />
          <Route path="coordinators" element={<AdminCoordinators />} />
          <Route path="coordinators/new" element={<CreateCoordinator />} />
          <Route path="coordinators/:id" element={<AdminCoordinatorDetail />} />
          <Route path="regions" element={<AdminRegions />} />
          <Route path="routes" element={<AdminRouteManagement />} />
          <Route path="quotations" element={<AdminQuotations />} />
          <Route path="customer-registrations/:id" element={<RegistrationRequestDetail />} />
        </Route>

        {/* Rep routes */}
        <Route path="/rep" element={<ProtectedRoute allowedRoles={['SalesRep']}><RepLayout /></ProtectedRoute>}>
          <Route index element={<RepDashboard />} />
          <Route path="payments" element={<RepPayments />} />
          <Route path="payments/new" element={<RepCreatePayment />} />
          <Route path="routes" element={<RepRoutes />} />
          <Route path="routes/:id" element={<RepRouteDetail />} />
          <Route path="visits/:id" element={<RepVisitDetail />} />
          <Route path="orders" element={<RepOrders />} />
          <Route path="orders/:id" element={<RepOrderDetail />} />
          <Route path="orders/new" element={<RepCreateOrder />} />
          <Route path="orders/new/customers" element={<RepSelectCustomer />} />
          <Route path="orders/new/products" element={<RepSelectProducts />} />
          <Route path="customers" element={<RepCustomers />} />
          <Route path="customers/new" element={<RepCreateCustomer />} />
          <Route path="customers/:id" element={<RepCustomerDetail />} />
          <Route path="performance" element={<RepPerformance />} />
          <Route path="notifications" element={<RepNotifications />} />
          <Route path="support" element={<RepSupport />} />
          <Route path="support/new" element={<RepCreateSupport />} />
          <Route path="quotations" element={<RepQuotations />} />
          <Route path="quotations/new" element={<RepCreateQuotation />} />
          <Route path="quotations/new/products" element={<RepSelectQuotationProducts />} />
          <Route path="products" element={<RepProducts />} />
          <Route path="outstanding-reports" element={<RepOutstandingReports />} />
          <Route path="stock-reports" element={<RepStockReports />} />
          <Route path="sales-summary" element={<RepSalesSummary />} />
          <Route path="quick-requests" element={<RepQuickRequest />} />
          <Route path="payment-reports" element={<RepPaymentReports />} />
          <Route path="payment-reports/:reportId" element={<PaymentReportDetail role="rep" />} />
          <Route path="profile" element={<RepProfile />} />
          <Route path="profile/edit" element={<RepProfileEdit />} />
        </Route>

        {/* Customer routes */}
        <Route path="/shop" element={<ProtectedRoute allowedRoles={['Customer']}><CustomerLayout /></ProtectedRoute>}>
          <Route index element={<CustomerHome />} />
          <Route path="catalog" element={<CustomerProductCatalog />} />
          <Route path="gallery" element={<CustomerGallery />} />
          <Route path="products" element={<CustomerProducts />} />
          <Route path="checkout" element={<CustomerCheckout />} />
          <Route path="orders" element={<CustomerOrders />}>
            <Route path=":id" element={<CustomerOrderDetail />} />
          </Route>
          <Route path="ledger" element={<CustomerLedger />} />
          <Route path="notifications" element={<CustomerNotifications />} />
          <Route path="support" element={<CustomerSupport />} />
          <Route path="support/new" element={<CustomerCreateSupport />} />
          <Route path="quotations" element={<CustomerQuotations />} />
          <Route path="quotations/new" element={<CustomerCreateQuotation />} />
          <Route path="profile" element={<CustomerProfile />} />
        </Route>

        {/* Coordinator routes */}
        <Route path="/coordinator" element={<ProtectedRoute allowedRoles={['SalesCoordinator']}><CoordinatorLayout /></ProtectedRoute>}>
          <Route index element={<CoordinatorDashboard />} />
          <Route path="team" element={<CoordinatorTeam />} />
          <Route path="routes" element={<CoordinatorRouteManagement />} />
          <Route path="customers" element={<AdminCustomers />} />
          <Route path="customers/:id" element={<AdminCustomerDetail />} />
          <Route path="customers/:id/special-prices" element={<CoordinatorCustomerSpecialPrices />} />
          <Route path="orders" element={<CoordinatorOrders />} />
          <Route path="orders/:id" element={<CoordinatorOrderDetail />} />
          <Route path="approvals" element={<CoordinatorApprovals />} />
          <Route path="support" element={<CoordinatorSupport />} />
          <Route path="support/new" element={<CoordinatorCreateSupport />} />
          <Route path="quotations" element={<CoordinatorQuotations />} />
          <Route path="notifications" element={<CoordinatorNotifications />} />
          <Route path="payment-reports" element={<CoordinatorPaymentReports />} />
          <Route path="payment-reports/:reportId" element={<PaymentReportDetail role="coordinator" />} />
          <Route path="profile" element={<CoordinatorProfile />} />
        </Route>

        {/* 404 */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
