import mongoose from "mongoose";

const { Schema } = mongoose;

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
      enum: ["super_admin", "manager", "support_agent", "finance"],
      required: true,
    },
    status: {
      type: String,
      enum: ["active", "disabled"],
      default: "active",
    },
    tokenVersion: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: {
      transform(doc, ret) {
        delete ret.passwordHash;
        delete ret.tokenVersion;
        return ret;
      },
    },
  }
);

export const User = mongoose.model("User", userSchema);
