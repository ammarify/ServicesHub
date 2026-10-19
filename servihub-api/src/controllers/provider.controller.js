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
      .sort({ name: 1, _id: 1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Provider.countDocuments(filter),
  ]);

  res.status(200).json({ items, total, page, pages: Math.ceil(total / limit) });
});

async function providerDetail(provider) {
  const [statsResult, recentBookings, activeBookings, totalBookings] = await Promise.all([
    Booking.aggregate([
      { $match: { provider: provider._id, status: "completed" } },
      { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } },
    ]),
    Booking.find({ provider: provider._id })
      .sort({ scheduledAt: -1 })
      .limit(RECENT_BOOKINGS_LIMIT)
      .populate("customer", "name"),
    Booking.countDocuments({ provider: provider._id, status: { $in: ["assigned", "in_progress"] } }),
    Booking.countDocuments({ provider: provider._id }),
  ]);

  return {
    provider,
    earnings: statsResult[0]?.total ?? 0,
    jobs: statsResult[0]?.count ?? 0,
    activeBookings,
    totalBookings,
    recentBookings,
  };
}

export const getProviderById = asyncHandler(async (req, res) => {
  const provider = await Provider.findById(req.params.id);
  if (!provider) {
    throw new ApiError(404, "Provider not found");
  }

  res.status(200).json(await providerDetail(provider));
});

export const createProvider = asyncHandler(async (req, res) => {
  const provider = await Provider.create({
    ...req.body,
    rating: 0,
    jobsCompleted: 0,
    joinedAt: new Date(),
  });

  res.status(201).json(await providerDetail(provider));
});

export const updateProvider = asyncHandler(async (req, res) => {
  const provider = await Provider.findById(req.params.id);
  if (!provider) {
    throw new ApiError(404, "Provider not found");
  }

  for (const [key, value] of Object.entries(req.body)) {
    if (value !== undefined) provider[key] = value;
  }
  await provider.save();

  res.status(200).json(await providerDetail(provider));
});

// Only a provider with no bookings on record can be deleted: bookings,
// earnings and refunds point at the profile. Taking someone out of rotation
// is "Mark off duty" (isAvailable: false).
export const deleteProvider = asyncHandler(async (req, res) => {
  const provider = await Provider.findById(req.params.id);
  if (!provider) {
    throw new ApiError(404, "Provider not found");
  }

  const bookings = await Booking.countDocuments({ provider: provider._id });
  if (bookings > 0) {
    throw new ApiError(
      409,
      `${provider.name} has ${bookings} booking${bookings === 1 ? "" : "s"} on record, so the profile can't be deleted. Mark them off duty instead.`,
      "HAS_HISTORY"
    );
  }

  await provider.deleteOne();
  res.status(204).end();
});
