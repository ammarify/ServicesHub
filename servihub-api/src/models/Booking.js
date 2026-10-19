import mongoose from "mongoose";
import { BOOKING_STATUSES, SERVICES } from "../config/services.js";

const { Schema } = mongoose;

const timelineEventSchema = new Schema(
  {
    // Short machine-friendly key: created, assigned, reassigned, started,
    // completed, cancelled, rescheduled, updated. Older documents may hold a
    // free-text event; the admin app falls back to showing it verbatim.
    event: { type: String, required: true },
    at: { type: Date, required: true },
    // Human-readable detail, e.g. "Provider reassigned to Marcus Bennett".
    note: { type: String, default: undefined },
    // Name of the staff member who caused the event, when there was one.
    actor: { type: String, default: undefined },
  },
  { _id: false }
);

const bookingSchema = new Schema(
  {
    code: { type: String, required: true, unique: true },
    customer: { type: Schema.Types.ObjectId, ref: "Customer", required: true, index: true },
    provider: { type: Schema.Types.ObjectId, ref: "Provider", index: true },
    service: { type: String, required: true, enum: SERVICES },
    status: {
      type: String,
      enum: BOOKING_STATUSES,
      required: true,
      index: true,
    },
    scheduledAt: { type: Date, required: true, index: true },
    amount: { type: Number, required: true, min: 0 },
    address: { type: String, required: true },
    timeline: { type: [timelineEventSchema], default: [] },
  },
  { timestamps: true, versionKey: false }
);

export const Booking = mongoose.model("Booking", bookingSchema);
