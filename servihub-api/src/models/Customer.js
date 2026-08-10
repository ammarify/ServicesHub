import mongoose from "mongoose";

const { Schema } = mongoose;

const customerSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, index: true },
    phone: { type: String, required: true, index: true },
    area: { type: String, required: true },
    joinedAt: { type: Date, required: true },
  },
  { timestamps: true, versionKey: false }
);

export const Customer = mongoose.model("Customer", customerSchema);
