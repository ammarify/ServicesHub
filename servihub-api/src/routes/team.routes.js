import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/rbac.js";
import { validate } from "../middleware/validate.js";
import {
  createTeamMember,
  listTeam,
  resendTeamInvite,
  revokeTeamInvite,
  updateTeamMemberRole,
  updateTeamMemberStatus,
} from "../controllers/team.controller.js";
import {
  createTeamMemberBodySchema,
  teamMemberIdParamsSchema,
  updateTeamMemberRoleBodySchema,
  updateTeamMemberStatusBodySchema,
} from "../validators/team.validators.js";

const router = Router();

router.use(requireAuth);
router.use(requirePermission("team.manage"));

router.get("/", listTeam);

router.post("/", validate(createTeamMemberBodySchema, "body"), createTeamMember);

router.post("/:id/invite", validate(teamMemberIdParamsSchema, "params"), resendTeamInvite);

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

// Withdraws a pending invitation (members who have joined are disabled instead).
router.delete("/:id", validate(teamMemberIdParamsSchema, "params"), revokeTeamInvite);

export default router;
