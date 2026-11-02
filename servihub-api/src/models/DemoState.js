import mongoose from "mongoose";

const { Schema } = mongoose;

// When the demo data was last replaced (services/demoReset.service.js). Kept
// out of the seeded collections so a reset doesn't erase its own record.
const demoStateSchema = new Schema(
  {
    _id: { type: String },
    lastResetAt: { type: Date, required: true },
  },
  { versionKey: false }
);

export const DemoState = mongoose.model("DemoState", demoStateSchema);
