import mongoose from "mongoose";

const { Schema } = mongoose;

// Atomic sequence per human-readable code prefix ("BK", "TK", "RF"). See
// utils/generateCode.js.
const counterSchema = new Schema(
  {
    _id: { type: String, required: true },
    seq: { type: Number, required: true, default: 0 },
  },
  { versionKey: false }
);

export const Counter = mongoose.model("Counter", counterSchema);
