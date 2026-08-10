import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/rbac.js";
import { validate } from "../middleware/validate.js";
import { listTeam, updateTeamMemberRole, updateTeamMemberStatus } from "../controllers/team.controller.js";
import {
  teamMemberIdParamsSchema,
  updateTeamMemberRoleBodySchema,
  updateTeamMemberStatusBodySchema,
} from "../validators/team.validators.js";

const router = Router();

router.use(requireAuth);
router.use(requirePermission("team.manage"));

router.get("/", listTeam);

router.patch(
  "/:id/role",
  validate(teamMemberIdParamsSchema, "params"),
  validate(updateTeamMemberRoleBodySchema, "body"),
  updateTeamMemberRole
);

router.patch(
  "/:id/status",
  validate(teamMemberIdParamsSchema, "params"),
  validate(updateTeamMemberStatusBodySchema, "body"),
  updateTeamMemberStatus
);

export default router;
