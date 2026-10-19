import { lazy, Suspense } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { RedirectIfAuthed, RequireAuth, useAuth } from "./context/AuthContext";
import { FullPageLoader } from "./components/FullPageLoader";
import { PageLoader } from "./components/PageLoader";
import { AppLayout } from "./layouts/AppLayout";

// Every screen is its own chunk, so signing in doesn't download the
// dashboard's chart library or the support center up front.
const LoginPage = lazy(() => import("./pages/login/LoginPage").then((m) => ({ default: m.LoginPage })));
const ForgotPasswordPage = lazy(() =>
  import("./pages/forgotPassword/ForgotPasswordPage").then((m) => ({ default: m.ForgotPasswordPage }))
);
const ResetPasswordPage = lazy(() =>
  import("./pages/resetPassword/ResetPasswordPage").then((m) => ({ default: m.ResetPasswordPage }))
);
const DashboardPage = lazy(() => import("./pages/dashboard/DashboardPage").then((m) => ({ default: m.DashboardPage })));
const BookingsPage = lazy(() => import("./pages/bookings/BookingsPage").then((m) => ({ default: m.BookingsPage })));
const BookingDetailPage = lazy(() =>
  import("./pages/bookings/BookingDetailPage").then((m) => ({ default: m.BookingDetailPage }))
);
const ProvidersPage = lazy(() => import("./pages/providers/ProvidersPage").then((m) => ({ default: m.ProvidersPage })));
const CustomersPage = lazy(() => import("./pages/customers/CustomersPage").then((m) => ({ default: m.CustomersPage })));
const SupportPage = lazy(() => import("./pages/support/SupportPage").then((m) => ({ default: m.SupportPage })));
const RefundsPage = lazy(() => import("./pages/refunds/RefundsPage").then((m) => ({ default: m.RefundsPage })));
const SettingsPage = lazy(() => import("./pages/settings/SettingsPage").then((m) => ({ default: m.SettingsPage })));
const AccountPage = lazy(() => import("./pages/account/AccountPage").then((m) => ({ default: m.AccountPage })));
const NotFoundPage = lazy(() => import("./pages/errors/NotFoundPage").then((m) => ({ default: m.NotFoundPage })));
const SimulatorPage = lazy(() => import("./pages/simulator/SimulatorPage").then((m) => ({ default: m.SimulatorPage })));

export function App() {
  const { isLoading } = useAuth();
  const location = useLocation();

  // /simulator is a fully separate, unauthenticated page (a stand-in for
  // an external customer widget) - it shouldn't wait on the staff session
  // boot check at all, let alone be wrapped by the auth-gated layout below.
  if (location.pathname === "/simulator") {
    return (
      <Suspense fallback={null}>
        <SimulatorPage />
      </Suspense>
    );
  }

  if (isLoading) {
    return <FullPageLoader />;
  }

  return (
    <Suspense fallback={<FullPageLoader />}>
      <Routes>
        <Route
          path="/login"
          element={
            <RedirectIfAuthed>
              <LoginPage />
            </RedirectIfAuthed>
          }
        />
        <Route
          path="/forgot-password"
          element={
            <RedirectIfAuthed>
              <ForgotPasswordPage />
            </RedirectIfAuthed>
          }
        />
        {/* Reachable signed in or out: invite links can be opened anywhere. */}
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        <Route
          element={
            <RequireAuth>
              <AppLayout />
            </RequireAuth>
          }
        >
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Lazy page={DashboardPage} />} />
          <Route path="/bookings" element={<Lazy page={BookingsPage} />} />
          <Route path="/bookings/:id" element={<Lazy page={BookingDetailPage} />} />
          <Route path="/providers" element={<Lazy page={ProvidersPage} />} />
          <Route path="/customers" element={<Lazy page={CustomersPage} />} />
          <Route path="/support" element={<Lazy page={SupportPage} />} />
          <Route path="/refunds" element={<Lazy page={RefundsPage} />} />
          <Route path="/settings" element={<Lazy page={SettingsPage} />} />
          <Route path="/account" element={<Lazy page={AccountPage} />} />
          <Route path="*" element={<Lazy page={NotFoundPage} />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

// Pages inside the app shell load behind a content-area placeholder instead
// of blanking the whole screen.
function Lazy({ page: Page }) {
  return (
    <Suspense fallback={<PageLoader />}>
      <Page />
    </Suspense>
  );
}
