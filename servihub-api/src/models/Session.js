import mongoose from "mongoose";

const { Schema } = mongoose;

// One document per signed-in device/browser. The refresh token cookie only
// carries { sid, jti }; the server-side record decides whether that token is
// still the current one. Every refresh rotates `jti`, so a refresh token can
// be used once: presenting an older one is treated as theft and revokes the
// whole session (see controllers/auth.controller.js#refresh).
const sessionSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    jti: { type: String, required: true },
    // The token that `jti` replaced, accepted for a few seconds after the
    // rotation so two tabs refreshing at the same moment don't log each
    // other out.
    previousJti: { type: String, default: null },
    rotatedAt: { type: Date, default: null },
    remember: { type: Boolean, default: false },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    revokedReason: { type: String, default: null },
    lastUsedAt: { type: Date, default: null },
    userAgent: { type: String, default: null },
    ip: { type: String, default: null },
  },
  { timestamps: true, versionKey: false }
);

// MongoDB's TTL monitor deletes sessions once they expire.
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const Session = mongoose.model("Session", sessionSchema);
