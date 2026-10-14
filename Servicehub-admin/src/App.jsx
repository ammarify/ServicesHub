import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { RedirectIfAuthed, RequireAuth, useAuth } from "./context/AuthContext";
import { FullPageLoader } from "./components/FullPageLoader";
import { AppLayout } from "./layouts/AppLayout";
import { LoginPage } from "./pages/login/LoginPage";
import { ForgotPasswordPage } from "./pages/forgotPassword/ForgotPasswordPage";
import { DashboardPage } from "./pages/dashboard/DashboardPage";
import { BookingsPage } from "./pages/bookings/BookingsPage";
import { BookingDetailPage } from "./pages/bookings/BookingDetailPage";
import { ProvidersPage } from "./pages/providers/ProvidersPage";
import { CustomersPage } from "./pages/customers/CustomersPage";
import { SupportPage } from "./pages/support/SupportPage";
import { RefundsPage } from "./pages/refunds/RefundsPage";
import { SettingsPage } from "./pages/settings/SettingsPage";
import { SimulatorPage } from "./pages/simulator/SimulatorPage";

export function App() {
  const { isLoading } = useAuth();
  const location = useLocation();

  // /simulator is a fully separate, unauthenticated page (a stand-in for
  // an external customer widget) - it shouldn't wait on the staff session
  // boot check at all, let alone be wrapped by the auth-gated layout below.
  if (location.pathname === "/simulator") {
    return <SimulatorPage />;
  }

  if (isLoading) {
    return <FullPageLoader />;
  }

  return (
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

      <Route
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/bookings" element={<BookingsPage />} />
        <Route path="/bookings/:id" element={<BookingDetailPage />} />
        <Route path="/providers" element={<ProvidersPage />} />
        <Route path="/customers" element={<CustomersPage />} />
        <Route path="/support" element={<SupportPage />} />
        <Route path="/refunds" element={<RefundsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}
