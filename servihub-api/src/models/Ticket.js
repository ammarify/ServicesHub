import mongoose from "mongoose";

const { Schema } = mongoose;

const messageSchema = new Schema(
  {
    from: { type: String, enum: ["customer", "agent"], required: true },
    senderName: { type: String, required: true },
    text: { type: String, required: true },
    at: { type: Date, required: true },
  },
  { _id: false }
);

const refundEligibilitySchema = new Schema(
  {
    eligible: Boolean,
    percent: Number,
    reason: String,
  },
  { _id: false }
);

const aiAnalysisSchema = new Schema(
  {
    summary: String,
    sentiment: String,
    refundEligibility: refundEligibilitySchema,
    suggestedReply: String,
    suggestedActions: [String],
    // Server-side policy checks that changed the model's answer, e.g.
    // "Refund capped at 50% (Section 3 maximum)". Empty when nothing changed.
    guardrails: { type: [String], default: undefined },
    analyzedAt: Date,
  },
  { _id: false }
);

const ticketSchema = new Schema(
  {
    code: { type: String, required: true, unique: true },
    booking: { type: Schema.Types.ObjectId, ref: "Booking", required: true, index: true },
    customer: { type: Schema.Types.ObjectId, ref: "Customer", required: true, index: true },
    subject: { type: String, required: true },
    priority: { type: String, enum: ["low", "medium", "high"], required: true },
    status: {
      type: String,
      enum: ["open", "in_progress", "resolved"],
      required: true,
      index: true,
    },
    messages: { type: [messageSchema], default: [] },
    aiAnalysis: { type: aiAnalysisSchema, default: undefined },
  },
  { timestamps: true, versionKey: false }
);

ticketSchema.index({ updatedAt: -1 });

export const Ticket = mongoose.model("Ticket", ticketSchema);
