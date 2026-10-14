import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { api } from "../lib/api";
import { connectSocket, disconnectSocket } from "../lib/socket";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

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

  // Connects only once there's a signed-in session (cookies the socket
  // handshake can authenticate with); disconnects on logout or whenever
  // the boot check above resolves to "not signed in".
  useEffect(() => {
    if (user) {
      connectSocket();
    } else {
      disconnectSocket();
    }
    return () => disconnectSocket();
  }, [user]);

  const login = useCallback(async (email, password) => {
    const res = await api.post("/auth/login", { email, password });
    setUser(res.data.user);
    return res.data.user;
  }, []);

  const googleLogin = useCallback(async (credential) => {
    const res = await api.post("/auth/google", { credential });
    setUser(res.data.user);
    return res.data.user;
  }, []);

  const demoLogin = useCallback(async (role) => {
    const res = await api.post("/auth/demo-login", { role });
    setUser(res.data.user);
    return res.data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } finally {
      setUser(null);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, googleLogin, demoLogin, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}

export function RequireAuth({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" replace />;
}

export function RedirectIfAuthed({ children }) {
  const { user } = useAuth();
  return user ? <Navigate to="/dashboard" replace /> : children;
}
