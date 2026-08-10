import { User } from "../models/index.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { invalidateAuthCache } from "../middleware/auth.js";

export const listTeam = asyncHandler(async (req, res) => {
  const members = await User.find().sort({ createdAt: 1 });
  res.status(200).json({ members });
});

export const updateTeamMemberRole = asyncHandler(async (req, res) => {
  if (req.params.id === req.user.userId) {
    throw new ApiError(400, "You cannot change your own role.");
  }

  const member = await User.findById(req.params.id);
  if (!member) {
    throw new ApiError(404, "Team member not found");
  }

  member.role = req.body.role;
  // A live access token has the OLD role baked into its JWT payload for up
  // to its own 15-minute lifetime; bumping tokenVersion revokes their
  // refresh token so a full re-login (and a token with the new role) is
  // required once that access token expires. requireAuth's short-TTL
  // cache (see middleware/auth.js) is what closes the gap in the
  // meantime - invalidateAuthCache makes that take effect immediately
  // instead of waiting out the cache TTL.
  member.tokenVersion += 1;
  await member.save();
  invalidateAuthCache(member._id.toString());

  res.status(200).json({ member });
});

export const updateTeamMemberStatus = asyncHandler(async (req, res) => {
  if (req.params.id === req.user.userId) {
    throw new ApiError(400, "You cannot change your own status.");
  }

  const member = await User.findById(req.params.id);
  if (!member) {
    throw new ApiError(404, "Team member not found");
  }

  member.status = req.body.status;
  // Same reasoning as role changes: revokes the refresh token immediately,
  // and invalidateAuthCache makes requireAuth stop accepting their current
  // access token right away instead of within the cache's TTL window.
  member.tokenVersion += 1;
  await member.save();
  invalidateAuthCache(member._id.toString());

  res.status(200).json({ member });
});
