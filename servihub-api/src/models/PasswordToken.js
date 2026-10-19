import mongoose from "mongoose";

const { Schema } = mongoose;

// Single-use links for "forgot password" and team invitations. Only a
// SHA-256 hash of the token is stored, so a database leak doesn't hand out
// working reset links.
const passwordTokenSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    purpose: { type: String, enum: ["reset", "invite"], required: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false }
);

passwordTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const PasswordToken = mongoose.model("PasswordToken", passwordTokenSchema);
