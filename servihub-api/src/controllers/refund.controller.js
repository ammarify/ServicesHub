import mongoose from "mongoose";
import { Refund, Booking } from "../models/index.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { createWithCode } from "../utils/generateCode.js";
import { formatMoney } from "../utils/money.js";
import { getRefundTotals, refundableAmount } from "../services/refund.service.js";
import { emitRefundDecided, emitRefundRequested } from "../sockets/emitter.js";

const DETAIL_POPULATE = [
  {
    path: "booking",
    select: "code amount service status scheduledAt customer",
    populate: { path: "customer", select: "name" },
  },
  { path: "requestedBy", select: "name" },
  { path: "decidedBy", select: "name" },
];

const LIST_POPULATE = [
  {
    path: "booking",
    select: "code amount service customer",
    populate: { path: "customer", select: "name" },
  },
  { path: "requestedBy", select: "name" },
  { path: "decidedBy", select: "name" },
];

export const listRefunds = asyncHandler(async (req, res) => {
  const { page, limit, status, bookingId } = req.query;

  const filter = {};
  if (status) filter.status = status;
  if (bookingId) filter.booking = bookingId;

  // aggregate() doesn't cast like find() does, so the id is converted here.
  const countsMatch = bookingId ? [{ $match: { booking: new mongoose.Types.ObjectId(bookingId) } }] : [];

  const [items, total, countsAgg] = await Promise.all([
    Refund.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate(LIST_POPULATE),
    Refund.countDocuments(filter),
    Refund.aggregate([...countsMatch, { $group: { _id: "$status", count: { $sum: 1 } } }]),
  ]);

  const countsMap = new Map(countsAgg.map((c) => [c._id, c.count]));
  const counts = {
    pending: countsMap.get("pending") ?? 0,
    approved: countsMap.get("approved") ?? 0,
    rejected: countsMap.get("rejected") ?? 0,
  };

  res.status(200).json({ items, total, page, pages: Math.ceil(total / limit), counts });
});

export const getRefundById = asyncHandler(async (req, res) => {
  const refund = await Refund.findById(req.params.id).populate(DETAIL_POPULATE);

  if (!refund) {
    throw new ApiError(404, "Refund not found");
  }

  res.status(200).json({ refund });
});

export const createRefund = asyncHandler(async (req, res) => {
  const { bookingId, amount, reason } = req.body;

  const booking = await Booking.findById(bookingId).select("code amount");
  if (!booking) {
    throw new ApiError(404, "Booking not found");
  }

  const existingPending = await Refund.exists({ booking: booking._id, status: "pending" });
  if (existingPending) {
    throw new ApiError(409, "A pending refund request already exists for this booking");
  }

  // Everything already approved counts against what the customer paid.
  const totals = await getRefundTotals(booking._id);
  const refundable = refundableAmount(booking.amount, totals);
  if (refundable <= 0) {
    throw new ApiError(409, "This booking has already been fully refunded");
  }
  if (amount > refundable) {
    throw new ApiError(400, `The refund can't exceed the remaining refundable amount of ${formatMoney(refundable)}`, undefined, {
      amount: `At most ${formatMoney(refundable)} can still be refunded`,
    });
  }

  let refund;
  try {
    refund = await createWithCode(Refund, "RF", (code) => ({
      code,
      booking: booking._id,
      amount,
      reason,
      status: "pending",
      requestedBy: req.user.userId,
    }));
  } catch (err) {
    // The partial unique index caught a concurrent request for the same booking.
    if (err?.code === 11000 && err.keyPattern?.booking) {
      throw new ApiError(409, "A pending refund request already exists for this booking");
    }
    throw err;
  }

  emitRefundRequested(refund, { bookingCode: booking.code, requestedByName: req.user.name });
  await refund.populate(DETAIL_POPULATE);

  res.status(201).json({ refund });
});

export const decideRefund = asyncHandler(async (req, res) => {
  const { decision, note } = req.body;

  const current = await Refund.findById(req.params.id).select("booking amount status");
  if (!current) {
    throw new ApiError(404, "Refund not found");
  }
  if (current.status !== "pending") {
    throw new ApiError(409, "Only pending refunds can be decided");
  }

  if (decision === "approved") {
    // Re-checked at approval time: the booking amount may have changed since
    // the request was filed.
    const booking = await Booking.findById(current.booking).select("amount").lean();
    const totals = await getRefundTotals(current.booking);
    if (!booking || totals.approved + current.amount > booking.amount + 0.001) {
      throw new ApiError(409, "Approving this would refund more than the booking amount");
    }
  }

  // Conditional update: if two people decide at the same moment, only the
  // first one changes anything.
  const refund = await Refund.findOneAndUpdate(
    { _id: current._id, status: "pending" },
    {
      $set: {
        status: decision,
        decidedBy: req.user.userId,
        decidedAt: new Date(),
        decisionNote: note || null,
      },
    },
    { returnDocument: "after" }
  );
  if (!refund) {
    throw new ApiError(409, "Only pending refunds can be decided");
  }

  await refund.populate(DETAIL_POPULATE);
  emitRefundDecided(refund, { bookingCode: refund.booking?.code, decidedByName: req.user.name });

  res.status(200).json({ refund });
});
