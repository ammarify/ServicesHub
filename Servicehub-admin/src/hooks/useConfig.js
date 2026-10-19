import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";

// Used until GET /config answers (and if it ever fails). Matches the API's
// own catalogue in servihub-api/src/config/services.js.
const FALLBACK_CONFIG = {
  demoMode: false,
  googleClientId: null,
  aiEnabled: true,
  emailEnabled: false,
  services: ["AC Repair", "Deep Cleaning", "Plumbing", "Electrical", "Maid Service", "Pest Control"],
  timezone: "America/Chicago",
};

// Public runtime settings from the API: demo access, Google sign-in, the
// service catalogue. Fetched once per session.
export function useAppConfig() {
  const query = useQuery({
    queryKey: ["config"],
    queryFn: async () => {
      const { data } = await api.get("/config");
      return data;
    },
    staleTime: Infinity,
    gcTime: Infinity,
    retry: 2,
  });

  return { ...FALLBACK_CONFIG, ...query.data, isLoaded: query.isSuccess };
}
