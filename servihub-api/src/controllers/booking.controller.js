import { Booking, Provider } from "../models/index.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { escapeRegex } from "../utils/regex.js";

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
  provider: { _id: "$provider._id", name: "$provider.name", phone: "$provider.phone" },
};

export const listBookings = asyncHandler(async (req, res) => {
  const { page, limit, status, service, search, sortBy, sortDir } = req.query;

  const pipeline = [];

  const preMatch = {};
  if (status) preMatch.status = status;
  if (service) preMatch.service = service;
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
    { $sort: { [sortBy]: sortDir === "asc" ? 1 : -1 } },
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
  const booking = await Booking.findById(req.params.id)
    .populate("customer", "name phone area")
    .populate("provider", "name phone services rating isAvailable");

  if (!booking) {
    throw new ApiError(404, "Booking not found");
  }

  res.status(200).json({ booking });
});

export const reassignBooking = asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.params.id);
  if (!booking) {
    throw new ApiError(404, "Booking not found");
  }

  const provider = await Provider.findById(req.body.providerId);
  if (!provider) {
    throw new ApiError(404, "Provider not found");
  }
  if (!provider.isAvailable) {
    throw new ApiError(409, "Provider is not available");
  }

  booking.provider = provider._id;
  booking.timeline.push({ event: `Provider reassigned to ${provider.name}`, at: new Date() });
  await booking.save();
  // getBookingById returns customer/provider populated, and the frontend
  // caches this response in place of that GET's result (no refetch) - an
  // unpopulated response here would silently replace populated sub-objects
  // with raw ids and crash any component reading e.g. booking.customer.name.
  await booking.populate([
    { path: "customer", select: "name phone area" },
    { path: "provider", select: "name phone services rating isAvailable" },
  ]);

  res.status(200).json({ booking });
});

export const cancelBooking = asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.params.id);
  if (!booking) {
    throw new ApiError(404, "Booking not found");
  }

  if (!["pending", "assigned"].includes(booking.status)) {
    throw new ApiError(409, "Only pending or assigned bookings can be cancelled");
  }

  booking.status = "cancelled";
  booking.timeline.push({ event: "cancelled", at: new Date() });
  await booking.save();
  await booking.populate([
    { path: "customer", select: "name phone area" },
    { path: "provider", select: "name phone services rating isAvailable" },
  ]);

  res.status(200).json({ booking });
});
