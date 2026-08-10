import mongoose from "mongoose";

const { Schema } = mongoose;

const providerSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true },
    services: { type: [String], required: true },
    rating: { type: Number, default: 0 },
    jobsCompleted: { type: Number, default: 0 },
    isAvailable: { type: Boolean, default: true },
    verified: { type: Boolean, default: false },
    area: { type: String, required: true },
    joinedAt: { type: Date, required: true },
  },
  { timestamps: true, versionKey: false }
);

export const Provider = mongoose.model("Provider", providerSchema);
