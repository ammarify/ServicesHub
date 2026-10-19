import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { browserTimeZone } from "../lib/formatters";

// range: "today" | "week" | "month". The viewer's own time zone is sent so
// "today" and "this week" match the dates shown everywhere else in the app.
export function useDashboardSummary(range) {
  const tz = browserTimeZone();
  return useQuery({
    queryKey: ["dashboard", "summary", range, tz],
    queryFn: async () => {
      const { data } = await api.get("/dashboard/summary", { params: { range, tz } });
      return data;
    },
    placeholderData: keepPreviousData,
  });
}
