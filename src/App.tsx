import React, { Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useLocalState } from "./lib/storage";
import { Loader2 } from "lucide-react";
import { Toaster } from "sonner";


const Dashboard = React.lazy(() => import("./routes/index"));
const BillingPage = React.lazy(() => import("./routes/billing"));
const CustomersPage = React.lazy(() => import("./routes/customers"));
const ExpensesPage = React.lazy(() => import("./routes/expenses"));
const GirviPage = React.lazy(() => import("./routes/girvi"));
const InventoryPage = React.lazy(() => import("./routes/inventory"));
const KarigarsPage = React.lazy(() => import("./routes/karigars"));
const PurchasesPage = React.lazy(() => import("./routes/purchases"));
const RepairsPage = React.lazy(() => import("./routes/repairs"));
const ReportsPage = React.lazy(() => import("./routes/reports"));
const SalesPage = React.lazy(() => import("./routes/sales"));
const SuppliersPage = React.lazy(() => import("./routes/suppliers"));
const GoldRatesPage = React.lazy(() => import("./routes/gold-rates"));
const OrdersPage = React.lazy(() => import("./routes/orders"));
const LedgerPage = React.lazy(() => import("./routes/ledger"));
const DuesPage = React.lazy(() => import("./routes/dues"));
const ForwardedShopsPage = React.lazy(() => import("./routes/forwarded-shops"));
const KarigarTasksPage = React.lazy(() => import("./routes/karigar-tasks"));
const NotificationsPage = React.lazy(() => import("./routes/notifications"));
const LoginPage = React.lazy(() => import("./routes/login"));
const SuperAdminLoginPage = React.lazy(() => import("./routes/super-admin-login"));
const CalculatorPage = React.lazy(() => import("./routes/calculator"));
const EmployeesPage = React.lazy(() => import("./routes/employees"));
const GstReportPage = React.lazy(() => import("./routes/gst-report"));
const CatalogPage = React.lazy(() => import("./routes/catalog"));
const SuperAdminPage = React.lazy(() => import("./routes/super-admin"));
const SettingsPage = React.lazy(() => import("./routes/settings"));
const SignupPage = React.lazy(() => import("./routes/signup"));

export default function App() {
  // Stores the login state securely in the local storage so it persists on refresh
  const [authUser, setAuthUser] = useLocalState<any>("ajms.auth", null);

  const fallback = <div className="flex h-screen w-full items-center justify-center text-muted-foreground"><Loader2 className="w-8 h-8 animate-spin" /></div>;

  if (!authUser) {
    return (
      <BrowserRouter>
        <Toaster richColors position="top-right" />
        <Suspense fallback={fallback}>
          <Routes>
            <Route path="/super-admin-login" element={<SuperAdminLoginPage onLogin={(user) => setAuthUser(user)} />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="*" element={<LoginPage onLogin={(user) => setAuthUser(user)} />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    );
  }


  // STRIKED DOWN KARIGAR ROUTE
  if (authUser.role === "karigar") {
    return (
      <BrowserRouter>
        <Toaster richColors position="top-right" />
        <Suspense fallback={fallback}>
        <Routes>
          <Route path="/karigar-tasks" element={<KarigarTasksPage />} />
          <Route path="*" element={<Navigate to="/karigar-tasks" replace />} />
        </Routes>
        </Suspense>
      </BrowserRouter>
    );
  }


  // SUPER ADMIN ROUTE
  if (authUser.role === "superadmin") {
    return (
      <BrowserRouter>
        <Toaster richColors position="top-right" />
        <Suspense fallback={fallback}>
          <Routes>
            <Route path="/super-admin" element={<SuperAdminPage />} />
            <Route path="*" element={<Navigate to="/super-admin" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    );
  }

  return (
    <BrowserRouter>
      <Toaster richColors position="top-right" />
      <Suspense fallback={fallback}>

      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/billing" element={<BillingPage />} />
        <Route path="/customers" element={<CustomersPage />} />
        <Route path="/expenses" element={<ExpensesPage />} />
        <Route path="/girvi" element={<GirviPage />} />
        <Route path="/inventory" element={<InventoryPage />} />
        <Route path="/karigars" element={<KarigarsPage />} />
        <Route path="/purchases" element={<PurchasesPage />} />
        <Route path="/repairs" element={<RepairsPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/sales" element={<SalesPage />} />
        <Route path="/suppliers" element={<SuppliersPage />} />
        <Route path="/gold-rates" element={<GoldRatesPage />} />
        <Route path="/orders" element={<OrdersPage />} />
        <Route path="/ledger" element={<LedgerPage />} />
        <Route path="/dues" element={<DuesPage />} />
        <Route path="/forwarded-shops" element={<ForwardedShopsPage />} />
        <Route path="/karigar-tasks" element={<KarigarTasksPage />} />
        <Route path="/catalog" element={<CatalogPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/employees" element={<EmployeesPage />} />
        <Route path="/calculator" element={<CalculatorPage />} />
        <Route path="/gst-report" element={<GstReportPage />} />
        <Route path="/super-admin" element={<Navigate to="/" replace />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<div className="flex min-h-screen items-center justify-center text-2xl font-bold text-muted-foreground">404 - Page Not Found</div>} />
      </Routes>
      </Suspense>
    </BrowserRouter>
  );
}