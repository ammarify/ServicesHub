import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true,
});

// Silent refresh: a 401 with code "TOKEN_EXPIRED" means the access token
// cookie expired but the refresh cookie may still be good. Concurrent
// requests that all fail at once must trigger exactly one /auth/refresh
// call, not one per request - refreshInFlight is the shared promise every
// caller awaits, reset to null once the refresh settles either way.
let refreshInFlight = null;

function redirectToLogin() {
  if (window.location.pathname !== "/login") {
    window.location.href = "/login";
  }
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { response, config } = error;

    const isExpiredAccessToken = response?.status === 401 && response.data?.code === "TOKEN_EXPIRED";

    // config._retried marks a request that already went through one
    // refresh-and-retry cycle, so a second 401 on the same request fails
    // straight away instead of looping.
    if (!config || !isExpiredAccessToken || config._retried) {
      return Promise.reject(error);
    }

    config._retried = true;

    if (!refreshInFlight) {
      refreshInFlight = api
        .post("/auth/refresh")
        .catch((refreshError) => {
          redirectToLogin();
          throw refreshError;
        })
        .finally(() => {
          refreshInFlight = null;
        });
    }

    await refreshInFlight;
    return api(config);
  }
);
