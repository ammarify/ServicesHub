import { Customer, Booking, Ticket } from "../models/index.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { escapeRegex } from "../utils/regex.js";

// Caps the embedded bookings/tickets lists on the detail endpoint (it's a
// profile drawer payload, not a paginated list). The headline totals are
// computed over the customer's whole history, not just these rows.
const DETAIL_SUBLIST_LIMIT = 50;

// totalBookings/totalSpent/lastBookingAt aren't stored on the Customer
// model (they're derived, not source data) - computed per request, same
// principle as provider earnings. For the list endpoint the $lookup only
// runs for the current page's rows (post-skip/limit).
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
    { $sort: { name: 1, _id: 1 } },
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

async function customerTotals(customerId) {
  const [stats] = await Booking.aggregate([
    { $match: { customer: customerId } },
    {
      $group: {
        _id: null,
        totalBookings: { $sum: 1 },
        totalSpent: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, "$amount", 0] } },
        lastBookingAt: { $max: "$scheduledAt" },
      },
    },
  ]);

  return {
    totalBookings: stats?.totalBookings ?? 0,
    totalSpent: stats?.totalSpent ?? 0,
    lastBookingAt: stats?.lastBookingAt ?? null,
  };
}

async function customerDetail(customer) {
  const [totals, bookings, tickets, ticketCount] = await Promise.all([
    customerTotals(customer._id),
    Booking.find({ customer: customer._id })
      .sort({ scheduledAt: -1 })
      .limit(DETAIL_SUBLIST_LIMIT)
      .populate("provider", "name"),
    Ticket.find({ customer: customer._id })
      .sort({ createdAt: -1 })
      .limit(DETAIL_SUBLIST_LIMIT)
      .select("code subject status priority createdAt booking"),
    Ticket.countDocuments({ customer: customer._id }),
  ]);

  return {
    customer: { ...customer.toObject(), ...totals, totalTickets: ticketCount },
    bookings,
    tickets,
  };
}

async function assertPhoneAvailable(phone, exceptId) {
  const existing = await Customer.findOne({ phone, ...(exceptId ? { _id: { $ne: exceptId } } : {}) })
    .select("name")
    .lean();
  if (existing) {
    throw new ApiError(409, `This phone number already belongs to ${existing.name}`, "DUPLICATE", {
      phone: "Another customer already uses this phone number",
    });
  }
}

export const getCustomerById = asyncHandler(async (req, res) => {
  const customer = await Customer.findById(req.params.id);
  if (!customer) {
    throw new ApiError(404, "Customer not found");
  }

  res.status(200).json(await customerDetail(customer));
});

export const createCustomer = asyncHandler(async (req, res) => {
  await assertPhoneAvailable(req.body.phone);
  const customer = await Customer.create({ ...req.body, joinedAt: new Date() });
  res.status(201).json(await customerDetail(customer));
});

export const updateCustomer = asyncHandler(async (req, res) => {
  const customer = await Customer.findById(req.params.id);
  if (!customer) {
    throw new ApiError(404, "Customer not found");
  }

  if (req.body.phone && req.body.phone !== customer.phone) {
    await assertPhoneAvailable(req.body.phone, customer._id);
  }

  for (const [key, value] of Object.entries(req.body)) {
    if (value !== undefined) customer[key] = value;
  }
  await customer.save();

  res.status(200).json(await customerDetail(customer));
});

// Only a customer with no bookings or tickets can be deleted, so no booking,
// refund or conversation is ever left pointing at a missing person.
export const deleteCustomer = asyncHandler(async (req, res) => {
  const customer = await Customer.findById(req.params.id);
  if (!customer) {
    throw new ApiError(404, "Customer not found");
  }

  const [bookings, tickets] = await Promise.all([
    Booking.countDocuments({ customer: customer._id }),
    Ticket.countDocuments({ customer: customer._id }),
  ]);
  if (bookings + tickets > 0) {
    const history = [
      bookings > 0 && `${bookings} booking${bookings === 1 ? "" : "s"}`,
      tickets > 0 && `${tickets} support ticket${tickets === 1 ? "" : "s"}`,
    ]
      .filter(Boolean)
      .join(" and ");
    throw new ApiError(409, `${customer.name} has ${history} on record, so the profile can't be deleted.`, "HAS_HISTORY");
  }

  await customer.deleteOne();
  res.status(204).end();
});
