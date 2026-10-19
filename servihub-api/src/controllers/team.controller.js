import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { PasswordToken, Session, User } from "../models/index.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { endAllSessions } from "../services/session.service.js";
import { buildPasswordLink, createPasswordToken } from "../services/passwordToken.service.js";
import { inviteEmail, isEmailConfigured, sendEmail } from "../services/email.service.js";
import { BCRYPT_ROUNDS } from "./auth.controller.js";

export const listTeam = asyncHandler(async (req, res) => {
  const members = await User.find().sort({ createdAt: 1 });
  res.status(200).json({ members });
});

async function loadOtherMember(req, action) {
  if (req.params.id === req.user.userId) {
    throw new ApiError(400, `You cannot change your own ${action}.`);
  }

  const member = await User.findById(req.params.id);
  if (!member) {
    throw new ApiError(404, "Team member not found");
  }
  return member;
}

// Never leave the workspace without an active super_admin to manage it.
async function assertNotLastSuperAdmin(member) {
  if (member.role !== "super_admin" || member.status !== "active") return;
  const others = await User.countDocuments({ _id: { $ne: member._id }, role: "super_admin", status: "active" });
  if (others === 0) {
    throw new ApiError(409, "At least one active super admin is required.");
  }
}

// Issues an invitation link and tries to email it. The link is also returned
// to the inviting super_admin so it can be shared another way when email
// delivery isn't configured.
async function issueInvite(member, inviterName) {
  const { token, expiresAt } = await createPasswordToken(member._id, "invite");
  const inviteUrl = buildPasswordLink(token);

  let emailSent = false;
  try {
    const message = inviteEmail({ name: member.name, inviterName, link: inviteUrl });
    const result = await sendEmail({ to: member.email, ...message });
    emailSent = result.delivered;
  } catch (err) {
    console.error("Invite email failed:", err.message);
  }

  return { inviteUrl, inviteExpiresAt: expiresAt, emailSent: emailSent && isEmailConfigured() };
}

export const createTeamMember = asyncHandler(async (req, res) => {
  const { name, email, role } = req.body;

  if (await User.exists({ email })) {
    throw new ApiError(409, "A team member with this email already exists.", "DUPLICATE", {
      email: "A team member with this email already exists",
    });
  }

  // Unusable random password until the invitee picks their own via the link.
  const placeholderPassword = crypto.randomBytes(32).toString("hex");
  const member = await User.create({
    name,
    email,
    role,
    status: "active",
    passwordHash: await bcrypt.hash(placeholderPassword, BCRYPT_ROUNDS),
    passwordSetAt: null,
    invitedBy: req.user.userId,
  });

  const invite = await issueInvite(member, req.user.name ?? "An administrator");
  res.status(201).json({ member, ...invite });
});

export const resendTeamInvite = asyncHandler(async (req, res) => {
  const member = await User.findById(req.params.id);
  if (!member) {
    throw new ApiError(404, "Team member not found");
  }
  if (member.status !== "active") {
    throw new ApiError(409, "Enable this member before sending an invitation.");
  }

  const invite = await issueInvite(member, req.user.name ?? "An administrator");
  res.status(200).json({ member, ...invite });
});

export const updateTeamMemberRole = asyncHandler(async (req, res) => {
  const member = await loadOtherMember(req, "role");

  if (member.role === req.body.role) {
    return res.status(200).json({ member });
  }
  if (req.body.role !== "super_admin") {
    await assertNotLastSuperAdmin(member);
  }

  member.role = req.body.role;
  await member.save();
  // Signs the member out everywhere so their next session (and their admin
  // app's navigation) is built for the new role.
  await endAllSessions(member._id, "role_changed");

  res.status(200).json({ member: await User.findById(member._id) });
});

export const updateTeamMemberStatus = asyncHandler(async (req, res) => {
  const member = await loadOtherMember(req, "status");

  if (member.status === req.body.status) {
    return res.status(200).json({ member });
  }
  if (req.body.status === "disabled") {
    await assertNotLastSuperAdmin(member);
  }

  member.status = req.body.status;
  await member.save();
  // Disabling ends every session and live socket immediately; enabling just
  // lets them sign in again.
  await endAllSessions(member._id, req.body.status === "disabled" ? "disabled" : "enabled");

  res.status(200).json({ member: await User.findById(member._id) });
});

// Withdraws an invitation nobody has accepted yet by deleting the account.
// Anyone who has signed in can appear on refunds, timelines and invitations
// they sent, so their account is disabled instead, never deleted.
export const revokeTeamInvite = asyncHandler(async (req, res) => {
  const member = await loadOtherMember(req, "account");

  if (!member.invitePending) {
    throw new ApiError(
      409,
      `${member.name} has already joined, so the account can't be deleted. Disable it instead.`,
      "HAS_HISTORY"
    );
  }

  await Promise.all([PasswordToken.deleteMany({ user: member._id }), Session.deleteMany({ user: member._id })]);
  await member.deleteOne();
  res.status(204).end();
});
