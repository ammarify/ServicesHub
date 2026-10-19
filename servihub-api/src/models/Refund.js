import mongoose from "mongoose";

const { Schema } = mongoose;

const refundSchema = new Schema(
  {
    code: { type: String, required: true, unique: true },
    booking: { type: Schema.Types.ObjectId, ref: "Booking", required: true, index: true },
    amount: { type: Number, required: true, min: 0 },
    reason: { type: String, required: true },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },
    requestedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    decidedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    decidedAt: { type: Date, default: null },
    // Optional note recorded with an approval or rejection.
    decisionNote: { type: String, default: null },
  },
  { timestamps: true, versionKey: false }
);

// At most one pending request per booking, enforced by the database itself
// so two simultaneous requests can't both slip past the controller's check.
refundSchema.index(
  { booking: 1 },
  { unique: true, partialFilterExpression: { status: "pending" }, name: "one_pending_refund_per_booking" }
);

export const Refund = mongoose.model("Refund", refundSchema);
