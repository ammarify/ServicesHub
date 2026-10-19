import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { AuthProvider } from "../context/AuthContext";
import { ConfirmProvider } from "../context/ConfirmContext";
import { ThemeProvider } from "../context/ThemeContext";
import { ToastProvider } from "../context/ToastContext";

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false },
    },
  });
}

// Shows where the router ended up, for asserting on redirects.
function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
}

// Renders `ui` at `route` inside the same providers main.jsx sets up (minus
// sockets/notifications). Pair with mockApi() for whatever the screen loads,
// including GET /auth/me for the signed-in user.
export function renderWithProviders(ui, { route = "/", path = "*", routeState } = {}) {
  const queryClient = createTestQueryClient();
  const initialEntry = routeState ? { pathname: route, state: routeState } : route;
  const result = render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <ToastProvider>
            <ConfirmProvider>
              <AuthProvider>
                <Routes>
                  <Route path={path} element={ui} />
                  {path !== "*" && <Route path="*" element={<LocationProbe />} />}
                </Routes>
              </AuthProvider>
            </ConfirmProvider>
          </ToastProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </MemoryRouter>
  );
  return { ...result, queryClient };
}
