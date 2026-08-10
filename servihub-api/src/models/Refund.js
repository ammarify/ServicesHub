import mongoose from "mongoose";

const { Schema } = mongoose;

const refundSchema = new Schema(
  {
    code: { type: String, required: true, unique: true },
    booking: { type: Schema.Types.ObjectId, ref: "Booking", required: true },
    amount: { type: Number, required: true },
    reason: { type: String, required: true },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    requestedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    decidedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    decidedAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false }
);

export const Refund = mongoose.model("Refund", refundSchema);
