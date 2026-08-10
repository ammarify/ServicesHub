import { z } from "zod";
import { objectIdSchema } from "./common.js";

export const teamMemberIdParamsSchema = z.object({
  id: objectIdSchema,
});

export const updateTeamMemberRoleBodySchema = z.object({
  role: z.enum(["super_admin", "manager", "support_agent", "finance"]),
});

export const updateTeamMemberStatusBodySchema = z.object({
  status: z.enum(["active", "disabled"]),
});
