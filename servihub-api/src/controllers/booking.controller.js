import mongoose from "mongoose";
import { Booking, Customer, Provider, Refund } from "../models/index.js";
import { OPEN_BOOKING_STATUSES } from "../config/services.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { escapeRegex } from "../utils/regex.js";
import { createWithCode } from "../utils/generateCode.js";
import { getRefundSummary } from "../services/refund.service.js";

const LIST_PROJECTION = {
  code: 1,
  service: 1,
  status: 1,
  scheduledAt: 1,
  amount: 1,
  address: 1,
  createdAt: 1,
  updatedAt: 1,
  customer: { _id: "$customer._id", name: "$customer.name", phone: "$customer.phone" },
  // null for an unassigned booking (a plain sub-document would come back as {}).
  provider: {
    $cond: [
      { $ifNull: ["$provider._id", false] },
      { _id: "$provider._id", name: "$provider.name", phone: "$provider.phone" },
      null,
    ],
  },
};

const DETAIL_POPULATE = [
  { path: "customer", select: "name phone area" },
  { path: "provider", select: "name phone services rating isAvailable verified" },
];

// Detail payload shared by GET /:id and every mutation, because the admin
// app writes mutation responses straight into its cache in place of the GET
// result - an unpopulated response would replace populated sub-objects with
// raw ids.
async function bookingDetail(booking) {
  await booking.populate(DETAIL_POPULATE);
  const [refundSummary, refunds] = await Promise.all([
    getRefundSummary(booking),
    Refund.find({ booking: booking._id })
      .sort({ createdAt: -1 })
      .select("code amount status reason createdAt decidedAt")
      .lean(),
  ]);
  return { ...booking.toObject(), refundSummary, refunds };
}

function timelineEntry(event, req, note) {
  return { event, at: new Date(), actor: req.user?.name ?? undefined, note };
}

async function loadBooking(id) {
  const booking = await Booking.findById(id);
  if (!booking) {
    throw new ApiError(404, "Booking not found");
  }
  return booking;
}

async function loadAssignableProvider(providerId, service) {
  const provider = await Provider.findById(providerId);
  if (!provider) {
    throw new ApiError(404, "Provider not found");
  }
  if (!provider.services.includes(service)) {
    throw new ApiError(409, `${provider.name} doesn't offer ${service}`);
  }
  if (!provider.isAvailable) {
    throw new ApiError(409, `${provider.name} is not available right now`);
  }
  return provider;
}

function assertOpen(booking, action) {
  if (!OPEN_BOOKING_STATUSES.includes(booking.status)) {
    throw new ApiError(
      409,
      `This booking is ${booking.status.replace("_", " ")} and can't be ${action}. Only pending or assigned bookings can.`
    );
  }
}

export const listBookings = asyncHandler(async (req, res) => {
  const { page, limit, status, service, search, customerId, providerId, sortBy, sortDir } = req.query;

  const pipeline = [];

  const preMatch = {};
  if (status) preMatch.status = status;
  if (service) preMatch.service = service;
  if (customerId) preMatch.customer = new mongoose.Types.ObjectId(customerId);
  if (providerId) preMatch.provider = new mongoose.Types.ObjectId(providerId);
  if (Object.keys(preMatch).length > 0) pipeline.push({ $match: preMatch });

  pipeline.push(
    { $lookup: { from: "customers", localField: "customer", foreignField: "_id", as: "customer" } },
    { $unwind: { path: "$customer", preserveNullAndEmptyArrays: true } },
    { $lookup: { from: "providers", localField: "provider", foreignField: "_id", as: "provider" } },
    { $unwind: { path: "$provider", preserveNullAndEmptyArrays: true } }
  );

  if (search) {
    const regex = new RegExp(escapeRegex(search), "i");
    pipeline.push({ $match: { $or: [{ code: regex }, { "customer.name": regex }] } });
  }

  pipeline.push(
    // _id as a tie-breaker keeps pagination stable when values repeat.
    { $sort: { [sortBy]: sortDir === "asc" ? 1 : -1, _id: sortDir === "asc" ? 1 : -1 } },
    {
      $facet: {
        items: [{ $skip: (page - 1) * limit }, { $limit: limit }, { $project: LIST_PROJECTION }],
        totalCount: [{ $count: "count" }],
      },
    }
  );

  const [result] = await Booking.aggregate(pipeline);
  const items = result.items;
  const total = result.totalCount[0]?.count ?? 0;

  res.status(200).json({ items, total, page, pages: Math.ceil(total / limit) });
});

export const getBookingById = asyncHandler(async (req, res) => {
  const booking = await loadBooking(req.params.id);
  res.status(200).json({ booking: await bookingDetail(booking) });
});

export const createBooking = asyncHandler(async (req, res) => {
  const { customerId, service, scheduledAt, amount, address, providerId } = req.body;

  const customer = await Customer.findById(customerId).select("_id").lean();
  if (!customer) {
    throw new ApiError(404, "Customer not found");
  }

  const provider = providerId ? await loadAssignableProvider(providerId, service) : null;

  const timeline = [timelineEntry("created", req)];
  if (provider) {
    timeline.push(timelineEntry("assigned", req, `Assigned to ${provider.name}`));
  }

  const booking = await createWithCode(Booking, "BK", (code) => ({
    code,
    customer: customer._id,
    provider: provider?._id,
    service,
    status: provider ? "assigned" : "pending",
    scheduledAt,
    amount,
    address,
    timeline,
  }));

  res.status(201).json({ booking: await bookingDetail(booking) });
});

// Reschedule or correct details before the job starts.
export const updateBooking = asyncHandler(async (req, res) => {
  const booking = await loadBooking(req.params.id);
  assertOpen(booking, "edited");

  const { scheduledAt, amount, address } = req.body;
  const changes = [];

  if (scheduledAt && scheduledAt.getTime() !== booking.scheduledAt.getTime()) {
    booking.timeline.push(
      timelineEntry("rescheduled", req, `Moved from ${booking.scheduledAt.toISOString()} to ${scheduledAt.toISOString()}`)
    );
    booking.scheduledAt = scheduledAt;
  }

  if (amount !== undefined && amount !== booking.amount) {
    const { approvedTotal, pendingTotal } = await getRefundSummary(booking);
    if (amount < approvedTotal + pendingTotal) {
      throw new ApiError(409, "The amount can't be lower than the refunds already approved or pending for this booking");
    }
    changes.push(`amount $${booking.amount} → $${amount}`);
    booking.amount = amount;
  }

  if (address && address !== booking.address) {
    changes.push("address");
    booking.address = address;
  }

  if (changes.length > 0) {
    booking.timeline.push(timelineEntry("updated", req, `Updated ${changes.join(", ")}`));
  }

  await booking.save();
  res.status(200).json({ booking: await bookingDetail(booking) });
});

const STATUS_TRANSITIONS = {
  in_progress: { from: "assigned", event: "started" },
  completed: { from: "in_progress", event: "completed" },
};

export const updateBookingStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const transition = STATUS_TRANSITIONS[status];
  const booking = await loadBooking(req.params.id);

  if (booking.status !== transition.from) {
    throw new ApiError(
      409,
      `Only ${transition.from.replace("_", " ")} bookings can be marked ${status.replace("_", " ")}`
    );
  }

  booking.status = status;
  booking.timeline.push(timelineEntry(transition.event, req));
  await booking.save();

  if (status === "completed" && booking.provider) {
    await Provider.updateOne({ _id: booking.provider }, { $inc: { jobsCompleted: 1 } });
  }

  res.status(200).json({ booking: await bookingDetail(booking) });
});

export const reassignBooking = asyncHandler(async (req, res) => {
  const booking = await loadBooking(req.params.id);
  assertOpen(booking, "reassigned");

  if (booking.provider?.toString() === req.body.providerId) {
    throw new ApiError(409, "That provider is already assigned to this booking");
  }

  const provider = await loadAssignableProvider(req.body.providerId, booking.service);

  const wasUnassigned = !booking.provider;
  booking.provider = provider._id;
  if (booking.status === "pending") booking.status = "assigned";
  booking.timeline.push(
    timelineEntry(
      wasUnassigned ? "assigned" : "reassigned",
      req,
      wasUnassigned ? `Assigned to ${provider.name}` : `Provider reassigned to ${provider.name}`
    )
  );
  await booking.save();

  res.status(200).json({ booking: await bookingDetail(booking) });
});

export const cancelBooking = asyncHandler(async (req, res) => {
  const booking = await loadBooking(req.params.id);
  assertOpen(booking, "cancelled");

  booking.status = "cancelled";
  booking.timeline.push(timelineEntry("cancelled", req, req.body?.reason || undefined));
  await booking.save();

  res.status(200).json({ booking: await bookingDetail(booking) });
});
