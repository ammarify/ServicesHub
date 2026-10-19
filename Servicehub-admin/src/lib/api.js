import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true,
});

// Codes on a 401 that a refresh can fix: the access token expired, or the
// access cookie is missing/unreadable while the refresh cookie may still
// hold a valid session (e.g. after the browser restored a tab).
const REFRESHABLE_CODES = new Set(["TOKEN_EXPIRED", "AUTH_REQUIRED", "INVALID_TOKEN"]);

// Auth endpoints answer 401 for wrong credentials or a dead session; a
// refresh can't help there and would only loop.
const NO_REFRESH_PATHS = [
  "/auth/login",
  "/auth/google",
  "/auth/demo-login",
  "/auth/refresh",
  "/auth/logout",
  "/auth/forgot-password",
  "/auth/reset-password",
];

let refreshInFlight = null;
let onSessionExpired = () => {};

// AuthContext registers what to do when the session can't be recovered
// (clear the user, which sends the app back to /login).
export function setSessionExpiredHandler(handler) {
  onSessionExpired = handler;
}

// One refresh call no matter how many requests failed at once; every caller
// awaits the same promise.
export function refreshSession() {
  if (!refreshInFlight) {
    refreshInFlight = api.post("/auth/refresh").finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

function shouldTryRefresh(error) {
  const { response, config } = error;
  if (!config || config._retried || response?.status !== 401) return false;
  if (!REFRESHABLE_CODES.has(response.data?.code)) return false;
  return !NO_REFRESH_PATHS.some((path) => config.url?.startsWith(path));
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (!shouldTryRefresh(error)) {
      // A revoked or disabled session can't be recovered by refreshing.
      const code = error.response?.data?.code;
      if (error.response?.status === 401 && (code === "SESSION_REVOKED" || code === "ACCOUNT_DISABLED")) {
        onSessionExpired(code);
      }
      return Promise.reject(error);
    }

    const { config } = error;
    config._retried = true;

    try {
      await refreshSession();
    } catch (refreshError) {
      onSessionExpired(refreshError.response?.data?.code ?? "SESSION_EXPIRED");
      return Promise.reject(error);
    }

    return api(config);
  }
);

// The message to show for a failed request: the API's own message when it
// sent one, otherwise a generic fallback.
export function errorMessage(error, fallback = "Something went wrong. Please try again.") {
  if (error?.response?.data?.message) return error.response.data.message;
  if (error?.code === "ERR_NETWORK") return "Can't reach the server. Check your connection and try again.";
  return fallback;
}

// Field-level validation messages ({ email: "...", ... }) from a 400.
export function fieldErrors(error) {
  return error?.response?.data?.errors ?? {};
}
