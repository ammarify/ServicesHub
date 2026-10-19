import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";

export function useTeam() {
  return useQuery({
    queryKey: ["team"],
    queryFn: async () => {
      const { data } = await api.get("/team");
      return data.members;
    },
  });
}

function replaceMember(queryClient, member) {
  queryClient.setQueryData(["team"], (old) => (old ? old.map((m) => (m._id === member._id ? member : m)) : old));
}

export function useCreateTeamMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body) => {
      const { data } = await api.post("/team", body);
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["team"] }),
  });
}

export function useResendInvite() {
  return useMutation({
    mutationFn: async (id) => {
      const { data } = await api.post(`/team/${id}/invite`);
      return data;
    },
  });
}

export function useUpdateTeamMemberRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, role }) => {
      const { data } = await api.patch(`/team/${id}/role`, { role });
      return data.member;
    },
    onSuccess: (member) => replaceMember(queryClient, member),
  });
}

export function useUpdateTeamMemberStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }) => {
      const { data } = await api.patch(`/team/${id}/status`, { status });
      return data.member;
    },
    onSuccess: (member) => replaceMember(queryClient, member),
  });
}

// Withdraws a pending invitation (deletes the account that was never used).
export function useRevokeInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      await api.delete(`/team/${id}`);
      return id;
    },
    onSuccess: (id) => {
      queryClient.setQueryData(["team"], (old) => (old ? old.filter((m) => m._id !== id) : old));
      queryClient.invalidateQueries({ queryKey: ["team"] });
    },
  });
}
