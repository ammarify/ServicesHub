import mongoose from "mongoose";

const { Schema } = mongoose;

const timelineEventSchema = new Schema(
  {
    event: { type: String, required: true },
    at: { type: Date, required: true },
  },
  { _id: false }
);

const bookingSchema = new Schema(
  {
    code: { type: String, required: true, unique: true },
    customer: { type: Schema.Types.ObjectId, ref: "Customer", required: true },
    provider: { type: Schema.Types.ObjectId, ref: "Provider" },
    service: { type: String, required: true },
    status: {
      type: String,
      enum: ["pending", "assigned", "in_progress", "completed", "cancelled"],
      required: true,
      index: true,
    },
    scheduledAt: { type: Date, required: true, index: true },
    amount: { type: Number, required: true },
    address: { type: String, required: true },
    timeline: { type: [timelineEventSchema], default: [] },
  },
  { timestamps: true, versionKey: false }
);

export const Booking = mongoose.model("Booking", bookingSchema);
