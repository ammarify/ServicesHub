import { useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { api, setSessionExpiredHandler } from "../lib/api";

const AuthContext = createContext(null);

const SESSION_MESSAGES = {
  SESSION_EXPIRED: "Your session expired. Please sign in again.",
  SESSION_REVOKED:
    "You were signed out because your session was ended (a password or role change, or “Sign out everywhere”). Please sign in again.",
  ACCOUNT_DISABLED: "Your account has been disabled. Contact an administrator.",
};

export function AuthProvider({ children }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  // Shown once on the sign-in page after an involuntary sign-out.
  const [sessionNotice, setSessionNotice] = useState("");
  const hasUserRef = useRef(false);

  useEffect(() => {
    const wasSignedIn = hasUserRef.current;
    hasUserRef.current = Boolean(user);
    // On sign-out (once the signed-in screens have unmounted in that same
    // commit), drop every cached response so the next person to sign in on
    // this browser never sees the previous user's data. Only on the way out:
    // removing a query that a mounted screen is still fetching would leave
    // that screen loading forever. The public server config isn't anyone's
    // data, and the sign-in page is already using it.
    if (wasSignedIn && !user) {
      queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== "config" });
      queryClient.getMutationCache().clear();
    }
  }, [user, queryClient]);

  // Ends the session on this device only (the server has already ended it,
  // or is being told to).
  const expireSession = useCallback((reason) => {
    const hadUser = hasUserRef.current;
    setUser(null);
    if (hadUser && reason) {
      setSessionNotice(SESSION_MESSAGES[reason] ?? SESSION_MESSAGES.SESSION_EXPIRED);
    }
  }, []);

  useEffect(() => {
    setSessionExpiredHandler(expireSession);
    return () => setSessionExpiredHandler(() => {});
  }, [expireSession]);

  useEffect(() => {
    let cancelled = false;

    api
      .get("/auth/me")
      .then((res) => {
        if (!cancelled) setUser(res.data.user);
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const startSession = useCallback((nextUser) => {
    setSessionNotice("");
    setUser(nextUser);
    return nextUser;
  }, []);

  const login = useCallback(
    async (email, password, remember = false) => {
      const res = await api.post("/auth/login", { email, password, remember });
      return startSession(res.data.user);
    },
    [startSession]
  );

  const googleLogin = useCallback(
    async (credential, remember = false) => {
      const res = await api.post("/auth/google", { credential, remember });
      return startSession(res.data.user);
    },
    [startSession]
  );

  const demoLogin = useCallback(
    async (role) => {
      const res = await api.post("/auth/demo-login", { role });
      return startSession(res.data.user);
    },
    [startSession]
  );

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } finally {
      expireSession(null);
    }
  }, [expireSession]);

  const logoutEverywhere = useCallback(async () => {
    await api.post("/auth/logout-all");
    expireSession(null);
  }, [expireSession]);

  const value = useMemo(
    () => ({
      user,
      isLoading,
      sessionNotice,
      clearSessionNotice: () => setSessionNotice(""),
      login,
      googleLogin,
      demoLogin,
      logout,
      logoutEverywhere,
      expireSession,
      // For account changes made on this device (name, password).
      updateUser: setUser,
    }),
    [user, isLoading, sessionNotice, login, googleLogin, demoLogin, logout, logoutEverywhere, expireSession]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}

// Sends signed-out visitors to /login, remembering where they were headed so
// a deep link (e.g. /support?ticket=...) still works after signing in.
export function RequireAuth({ children }) {
  const { user } = useAuth();
  const location = useLocation();
  if (user) return children;
  return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
}

export function RedirectIfAuthed({ children }) {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) return children;
  const from = location.state?.from;
  return <Navigate to={typeof from === "string" && from.startsWith("/") ? from : "/dashboard"} replace />;
}
