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

export function useUpdateTeamMemberRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, role }) => {
      const { data } = await api.patch(`/team/${id}/role`, { role });
      return data.member;
    },
    onSuccess: (member) => {
      queryClient.setQueryData(["team"], (old) =>
        old ? old.map((m) => (m._id === member._id ? member : m)) : old
      );
    },
  });
}

export function useUpdateTeamMemberStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }) => {
      const { data } = await api.patch(`/team/${id}/status`, { status });
      return data.member;
    },
    onSuccess: (member) => {
      queryClient.setQueryData(["team"], (old) =>
        old ? old.map((m) => (m._id === member._id ? member : m)) : old
      );
    },
  });
}
