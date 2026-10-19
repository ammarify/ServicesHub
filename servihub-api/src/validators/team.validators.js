import { z } from "zod";
import { ROLES } from "../models/User.js";
import { emailSchema, objectIdSchema, personNameSchema } from "./common.js";

export const teamMemberIdParamsSchema = z.object({
  id: objectIdSchema,
});

export const createTeamMemberBodySchema = z.object({
  name: personNameSchema,
  email: emailSchema,
  role: z.enum(ROLES),
});

export const updateTeamMemberRoleBodySchema = z.object({
  role: z.enum(ROLES),
});

export const updateTeamMemberStatusBodySchema = z.object({
  status: z.enum(["active", "disabled"]),
});
