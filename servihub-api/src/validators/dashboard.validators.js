import { z } from "zod";

export const dashboardQuerySchema = z.object({
  range: z.enum(["today", "week", "month"]).default("week"),
  // IANA zone of the viewer ("Asia/Karachi"); invalid values fall back to
  // APP_TIMEZONE in the controller.
  tz: z.string().trim().max(64).optional(),
});
