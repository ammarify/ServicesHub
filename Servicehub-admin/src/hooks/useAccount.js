import { useMutation } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";

export function useUpdateProfile() {
  const { updateUser } = useAuth();
  return useMutation({
    mutationFn: async (body) => {
      const { data } = await api.patch("/auth/me", body);
      return data.user;
    },
    onSuccess: (user) => updateUser(user),
  });
}

export function useChangePassword() {
  const { updateUser } = useAuth();
  return useMutation({
    mutationFn: async (body) => {
      const { data } = await api.post("/auth/change-password", body);
      return data.user;
    },
    onSuccess: (user) => updateUser(user),
  });
}

export function useForgotPassword() {
  return useMutation({
    mutationFn: async (email) => {
      const { data } = await api.post("/auth/forgot-password", { email });
      return data;
    },
  });
}

export function useVerifyPasswordToken(token) {
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post("/auth/reset-password/verify", { token });
      return data;
    },
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: async ({ token, password }) => {
      const { data } = await api.post("/auth/reset-password", { token, password });
      return data;
    },
  });
}
