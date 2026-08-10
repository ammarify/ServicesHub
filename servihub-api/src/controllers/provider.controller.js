import { Provider, Booking } from "../models/index.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { escapeRegex } from "../utils/regex.js";

const RECENT_BOOKINGS_LIMIT = 5;

export const listProviders = asyncHandler(async (req, res) => {
  const { page, limit, service, availableOnly, search } = req.query;

  const filter = {};
  if (service) filter.services = service;
  if (availableOnly) filter.isAvailable = true;
  if (search) filter.name = new RegExp(escapeRegex(search), "i");

  const [items, total] = await Promise.all([
    Provider.find(filter)
      .sort({ name: 1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Provider.countDocuments(filter),
  ]);

  res.status(200).json({ items, total, page, pages: Math.ceil(total / limit) });
});

export const getProviderById = asyncHandler(async (req, res) => {
  const provider = await Provider.findById(req.params.id);
  if (!provider) {
    throw new ApiError(404, "Provider not found");
  }

  const [statsResult, recentBookings] = await Promise.all([
    Booking.aggregate([
      { $match: { provider: provider._id, status: "completed" } },
      { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } },
    ]),
    Booking.find({ provider: provider._id })
      .sort({ scheduledAt: -1 })
      .limit(RECENT_BOOKINGS_LIMIT)
      .populate("customer", "name"),
  ]);

  const earnings = statsResult[0]?.total ?? 0;
  const jobs = statsResult[0]?.count ?? 0;

  res.status(200).json({ provider, earnings, jobs, recentBookings });
});
