import { env } from "../config/env.js";
import { BOOKING_STATUSES } from "../config/services.js";
import { Booking, Ticket, Provider, Refund } from "../models/index.js";
import { hasPermission } from "../middleware/rbac.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  addDaysInZone,
  addMonthsInZone,
  dateKeyInZone,
  isValidTimeZone,
  startOfDayInZone,
  startOfMonthInZone,
  startOfWeekInZone,
} from "../utils/timezone.js";

const RECENT_BOOKINGS_LIMIT = 6;
const OPEN_TICKETS_LIMIT = 5;
const PENDING_REFUNDS_LIMIT = 5;

// Days shown in the bookings chart for each range.
const TREND_DAYS = { today: 7, week: 14, month: 30 };

// Same order the "Bookings by status" card lists them in.
const STATUS_ORDER = ["completed", "in_progress", "assigned", "pending", "cancelled"];

function percentDelta(current, previous) {
  if (previous === 0) return current === 0 ? 0 : 100;
  return Math.round(((current - previous) / previous) * 100);
}

// Current and previous period for a range, as calendar periods in the
// caller's time zone (weeks start on Monday).
function periodsFor(range, now, tz) {
  if (range === "today") {
    const start = startOfDayInZone(now, tz);
    return { start, end: addDaysInZone(start, 1, tz), prevStart: addDaysInZone(start, -1, tz) };
  }
  if (range === "month") {
    const start = startOfMonthInZone(now, tz);
    return { start, end: addMonthsInZone(start, 1, tz), prevStart: addMonthsInZone(start, -1, tz) };
  }
  const start = startOfWeekInZone(now, tz);
  return { start, end: addDaysInZone(start, 7, tz), prevStart: addDaysInZone(start, -7, tz) };
}

async function sumCompletedRevenue(from, to) {
  const [row] = await Booking.aggregate([
    { $match: { status: "completed", scheduledAt: { $gte: from, $lt: to } } },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);
  return row?.total ?? 0;
}

export const getDashboardSummary = asyncHandler(async (req, res) => {
  const range = req.query.range ?? "week";
  const tz = isValidTimeZone(req.query.tz) ? req.query.tz : env.APP_TIMEZONE;
  const role = req.user.role;
  const canSeeTickets = hasPermission(role, "ticket.read");
  const canSeeRefunds = hasPermission(role, "refund.read");

  const now = new Date();
  const { start, end, prevStart } = periodsFor(range, now, tz);
  // "So far" windows compare like with like: this week up to now against the
  // same stretch of last week, rather than a partial week against a full one.
  const elapsedMs = Math.max(now.getTime() - start.getTime(), 0);
  const prevToDate = new Date(prevStart.getTime() + elapsedMs);

  const trendDays = TREND_DAYS[range];
  const today = startOfDayInZone(now, tz);
  const trendStart = addDaysInZone(today, -(trendDays - 1), tz);
  const trendEnd = addDaysInZone(today, 1, tz);

  const [
    bookingsInPeriod,
    bookingsInPrevPeriod,
    revenueToDate,
    revenuePrevToDate,
    availableProviders,
    totalProviders,
    trendAgg,
    statusBreakdownAgg,
    recentBookingsRaw,
  ] = await Promise.all([
    Booking.countDocuments({ scheduledAt: { $gte: start, $lt: end } }),
    Booking.countDocuments({ scheduledAt: { $gte: prevStart, $lt: start } }),
    sumCompletedRevenue(start, now < end ? now : end),
    sumCompletedRevenue(prevStart, prevToDate),
    Provider.countDocuments({ isAvailable: true }),
    Provider.countDocuments({}),
    Booking.aggregate([
      { $match: { scheduledAt: { $gte: trendStart, $lt: trendEnd } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$scheduledAt", timezone: tz } },
          count: { $sum: 1 },
          // Same definition as the revenue KPI: completed jobs only.
          revenue: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, "$amount", 0] } },
        },
      },
    ]),
    Booking.aggregate([
      { $match: { scheduledAt: { $gte: start, $lt: end } } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    Booking.find()
      .sort({ createdAt: -1, _id: -1 })
      .limit(RECENT_BOOKINGS_LIMIT)
      .select("code service status scheduledAt amount customer createdAt")
      .populate("customer", "name"),
  ]);

  const trendMap = new Map(trendAgg.map((d) => [d._id, d]));
  const trend = [];
  for (let day = trendStart; day < trendEnd; day = addDaysInZone(day, 1, tz)) {
    const key = dateKeyInZone(day, tz);
    const entry = trendMap.get(key);
    trend.push({ date: key, count: entry?.count ?? 0, revenue: entry?.revenue ?? 0 });
  }

  const statusMap = new Map(statusBreakdownAgg.map((s) => [s._id, s.count]));
  const statusBreakdown = STATUS_ORDER.filter((status) => BOOKING_STATUSES.includes(status)).map((status) => ({
    status,
    count: statusMap.get(status) ?? 0,
  }));

  const recentBookings = recentBookingsRaw.map((b) => ({
    ...b.toObject(),
    customerName: b.customer?.name ?? "Unknown",
  }));

  const response = {
    range,
    timezone: tz,
    period: { start, end },
    kpis: {
      bookings: bookingsInPeriod,
      bookingsDelta: percentDelta(bookingsInPeriod, bookingsInPrevPeriod),
      revenue: revenueToDate,
      revenueDelta: percentDelta(revenueToDate, revenuePrevToDate),
      availableProviders,
      totalProviders,
    },
    trend,
    statusBreakdown,
    recentBookings,
  };

  // Ticket and refund figures only go to roles that can open those pages.
  if (canSeeTickets) {
    const [activeTickets, newTickets, newTicketsPrev, openTickets] = await Promise.all([
      Ticket.countDocuments({ status: { $in: ["open", "in_progress"] } }),
      Ticket.countDocuments({ createdAt: { $gte: start, $lt: now } }),
      Ticket.countDocuments({ createdAt: { $gte: prevStart, $lt: prevToDate } }),
      Ticket.find({ status: "open" })
        .sort({ createdAt: -1 })
        .limit(OPEN_TICKETS_LIMIT)
        .select("code subject priority status createdAt customer")
        .populate("customer", "name"),
    ]);
    response.kpis.activeTickets = activeTickets;
    response.kpis.newTickets = newTickets;
    response.kpis.newTicketsDelta = percentDelta(newTickets, newTicketsPrev);
    response.openTickets = openTickets;
  }

  if (canSeeRefunds) {
    const [pendingCount, pendingTotalAgg, pendingItems] = await Promise.all([
      Refund.countDocuments({ status: "pending" }),
      Refund.aggregate([{ $match: { status: "pending" } }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
      Refund.find({ status: "pending" })
        .sort({ createdAt: -1 })
        .limit(PENDING_REFUNDS_LIMIT)
        .select("code amount reason createdAt booking")
        .populate({ path: "booking", select: "code customer", populate: { path: "customer", select: "name" } }),
    ]);
    response.pendingRefunds = {
      count: pendingCount,
      total: pendingTotalAgg[0]?.total ?? 0,
      items: pendingItems,
    };
  }

  res.status(200).json(response);
});
