import mongoose from "mongoose";
import { Refund } from "../models/index.js";

function roundMoney(value) {
  return Math.round(value * 100) / 100;
}

// Approved and still-pending refund totals for a booking. Pending requests
// count against the refundable balance too, so two open requests can't
// together exceed what the customer paid.
export async function getRefundTotals(bookingId) {
  const rows = await Refund.aggregate([
    { $match: { booking: new mongoose.Types.ObjectId(bookingId.toString()), status: { $in: ["approved", "pending"] } } },
    { $group: { _id: "$status", total: { $sum: "$amount" } } },
  ]);

  const totals = { approved: 0, pending: 0 };
  for (const row of rows) totals[row._id] = roundMoney(row.total);
  return totals;
}

export function refundableAmount(bookingAmount, totals) {
  return Math.max(roundMoney(bookingAmount - totals.approved - totals.pending), 0);
}

export async function getRefundSummary(booking) {
  const totals = await getRefundTotals(booking._id);
  return {
    approvedTotal: totals.approved,
    pendingTotal: totals.pending,
    refundable: refundableAmount(booking.amount, totals),
  };
}
