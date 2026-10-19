import mongoose from "mongoose";
import { SERVICES } from "../config/services.js";

const { Schema } = mongoose;

const providerSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, index: true },
    phone: { type: String, required: true, trim: true },
    services: {
      type: [{ type: String, enum: SERVICES }],
      required: true,
      validate: {
        validator: (value) => Array.isArray(value) && value.length > 0,
        message: "A provider must offer at least one service",
      },
    },
    rating: { type: Number, default: 0, min: 0, max: 5 },
    jobsCompleted: { type: Number, default: 0, min: 0 },
    isAvailable: { type: Boolean, default: true },
    verified: { type: Boolean, default: false },
    area: { type: String, required: true, trim: true },
    joinedAt: { type: Date, required: true },
  },
  { timestamps: true, versionKey: false }
);

providerSchema.index({ services: 1, isAvailable: 1 });

export const Provider = mongoose.model("Provider", providerSchema);
