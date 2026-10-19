import mongoose from "mongoose";

const { Schema } = mongoose;

export const ROLES = ["super_admin", "manager", "support_agent", "finance"];

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: { type: String, required: true },
    role: {
      type: String,
      enum: ROLES,
      required: true,
    },
    status: {
      type: String,
      enum: ["active", "disabled"],
      default: "active",
    },
    // Bumped on password change/reset, "log out everywhere", role change and
    // disable. Every access and refresh token carries the value it was issued
    // with, so a bump invalidates all of them at once.
    tokenVersion: { type: Number, default: 0 },
    // null for invited members who haven't chosen a password yet (their
    // passwordHash is a random unusable value until then).
    passwordSetAt: { type: Date, default: null },
    lastLoginAt: { type: Date, default: null },
    invitedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  {
    timestamps: true,
    versionKey: false,
    id: false,
    toJSON: {
      virtuals: true,
      transform(doc, ret) {
        delete ret.passwordHash;
        delete ret.tokenVersion;
        return ret;
      },
    },
  }
);

// An invited member who has neither set a password nor signed in (e.g. with
// Google) yet. Surfaced in Settings -> Team so admins can resend the invite.
userSchema.virtual("invitePending").get(function invitePending() {
  return !this.passwordSetAt && !this.lastLoginAt;
});

export const User = mongoose.model("User", userSchema);
