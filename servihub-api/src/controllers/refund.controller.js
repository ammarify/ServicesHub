import { Refund, Booking } from "../models/index.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { generateNextCode } from "../utils/generateCode.js";

export const listRefunds = asyncHandler(async (req, res) => {
  const { page, limit, status } = req.query;

  const filter = {};
  if (status) filter.status = status;

  const [items, total, countsAgg] = await Promise.all([
    Refund.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate({
        path: "booking",
        select: "code amount service customer",
        populate: { path: "customer", select: "name" },
      })
      .populate("requestedBy", "name")
      .populate("decidedBy", "name"),
    Refund.countDocuments(filter),
    Refund.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
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
  const refund = await Refund.findById(req.params.id)
    .populate({
      path: "booking",
      select: "code amount service status",
      populate: { path: "customer", select: "name" },
    })
    .populate("requestedBy", "name")
    .populate("decidedBy", "name");

  if (!refund) {
    throw new ApiError(404, "Refund not found");
  }

  res.status(200).json({ refund });
});

export const createRefund = asyncHandler(async (req, res) => {
  const { bookingId, amount, reason } = req.body;

  const booking = await Booking.findById(bookingId);
  if (!booking) {
    throw new ApiError(404, "Booking not found");
  }

  if (amount > booking.amount) {
    throw new ApiError(400, "Refund amount cannot exceed the booking amount");
  }

  const existingPending = await Refund.findOne({ booking: bookingId, status: "pending" });
  if (existingPending) {
    throw new ApiError(409, "A pending refund request already exists for this booking");
  }

  const code = await generateNextCode(Refund, "RF");

  const refund = await Refund.create({
    code,
    booking: booking._id,
    amount,
    reason,
    status: "pending",
    requestedBy: req.user.userId,
  });

  res.status(201).json({ refund });
});

export const decideRefund = asyncHandler(async (req, res) => {
  const refund = await Refund.findById(req.params.id);
  if (!refund) {
    throw new ApiError(404, "Refund not found");
  }

  if (refund.status !== "pending") {
    throw new ApiError(409, "Only pending refunds can be decided");
  }

  refund.status = req.body.decision;
  refund.decidedBy = req.user.userId;
  refund.decidedAt = new Date();
  await refund.save();
  // getRefundById returns booking/requestedBy/decidedBy populated, and the
  // frontend caches this response in place of that GET's result (no
  // refetch) - an unpopulated response here would silently replace
  // populated sub-objects with raw ids in the drawer.
  await refund.populate([
    { path: "booking", select: "code amount service status", populate: { path: "customer", select: "name" } },
    { path: "requestedBy", select: "name" },
    { path: "decidedBy", select: "name" },
  ]);

  res.status(200).json({ refund });
});
