import { Customer, Booking, Ticket } from "../models/index.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { escapeRegex } from "../utils/regex.js";

// Caps the embedded bookings/tickets on the detail endpoint. This isn't a
// "list endpoint" in the paginated sense (it's a profile drawer payload),
// but a customer's history still shouldn't be able to grow unbounded in
// a single response, so recent history is capped rather than left open.
const DETAIL_SUBLIST_LIMIT = 50;

// totalBookings/totalSpent/lastBookingAt aren't stored on the Customer
// model (they're derived, not source data) - computed here per request,
// same principle as Provider earnings/jobs. For the list endpoint the
// $lookup only runs against the current page's rows (post-skip/limit),
// not the whole collection, so this stays cheap regardless of how many
// customers exist.
export const listCustomers = asyncHandler(async (req, res) => {
  const { page, limit, search } = req.query;

  const match = {};
  if (search) {
    const regex = new RegExp(escapeRegex(search), "i");
    match.$or = [{ name: regex }, { phone: regex }];
  }

  const pipeline = [];
  if (Object.keys(match).length > 0) pipeline.push({ $match: match });

  pipeline.push(
    { $sort: { name: 1 } },
    {
      $facet: {
        items: [
          { $skip: (page - 1) * limit },
          { $limit: limit },
          { $lookup: { from: "bookings", localField: "_id", foreignField: "customer", as: "bookings" } },
          {
            $addFields: {
              totalBookings: { $size: "$bookings" },
              totalSpent: {
                $sum: {
                  $map: {
                    input: { $filter: { input: "$bookings", cond: { $eq: ["$$this.status", "completed"] } } },
                    as: "b",
                    in: "$$b.amount",
                  },
                },
              },
              lastBookingAt: { $max: "$bookings.scheduledAt" },
            },
          },
          { $project: { bookings: 0 } },
        ],
        totalCount: [{ $count: "count" }],
      },
    }
  );

  const [result] = await Customer.aggregate(pipeline);
  const items = result.items;
  const total = result.totalCount[0]?.count ?? 0;

  res.status(200).json({ items, total, page, pages: Math.ceil(total / limit) });
});

export const getCustomerById = asyncHandler(async (req, res) => {
  const customer = await Customer.findById(req.params.id);
  if (!customer) {
    throw new ApiError(404, "Customer not found");
  }

  const [bookings, tickets] = await Promise.all([
    Booking.find({ customer: customer._id })
      .sort({ scheduledAt: -1 })
      .limit(DETAIL_SUBLIST_LIMIT)
      .populate("provider", "name"),
    Ticket.find({ customer: customer._id }).sort({ createdAt: -1 }).limit(DETAIL_SUBLIST_LIMIT),
  ]);

  const totalBookings = bookings.length;
  const totalSpent = bookings.filter((b) => b.status === "completed").reduce((sum, b) => sum + b.amount, 0);
  const lastBookingAt = bookings.reduce(
    (latest, b) => (!latest || b.scheduledAt > latest ? b.scheduledAt : latest),
    null
  );

  res.status(200).json({
    customer: { ...customer.toObject(), totalBookings, totalSpent, lastBookingAt },
    bookings,
    tickets,
  });
});
