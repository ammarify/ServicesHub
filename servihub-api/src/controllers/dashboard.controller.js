import { Booking, Ticket, Provider } from "../models/index.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const RECENT_BOOKINGS_LIMIT = 6;
const OPEN_TICKETS_LIMIT = 5;
const TREND_DAYS = 14;

// Same order/shape as STATUS_ORDER in the frontend's dashboardStats.js.
const STATUS_ORDER = ["completed", "in_progress", "assigned", "pending", "cancelled"];

function percentDelta(current, previous) {
  if (previous === 0) return current === 0 ? 0 : 100;
  return Math.round(((current - previous) / previous) * 100);
}

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function dateKey(date) {
  return date.toISOString().slice(0, 10);
}

export const getDashboardSummary = asyncHandler(async (req, res) => {
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = new Date(todayStart.getTime() + DAY_MS);
  const yesterdayStart = new Date(todayStart.getTime() - DAY_MS);
  const weekAgo = new Date(now.getTime() - 7 * DAY_MS);
  const twoWeeksAgo = new Date(now.getTime() - 14 * DAY_MS);
  const trendStart = startOfDay(new Date(now.getTime() - (TREND_DAYS - 1) * DAY_MS));

  const [
    todaysBookings,
    yesterdaysBookings,
    activeTickets,
    ticketsThisWeek,
    ticketsPrevWeek,
    revenueThisWeekAgg,
    revenuePrevWeekAgg,
    availableProviders,
    totalProviders,
    trendAgg,
    statusBreakdownAgg,
    recentBookingsRaw,
    openTickets,
  ] = await Promise.all([
    Booking.countDocuments({ scheduledAt: { $gte: todayStart, $lt: todayEnd } }),
    Booking.countDocuments({ scheduledAt: { $gte: yesterdayStart, $lt: todayStart } }),
    Ticket.countDocuments({ status: { $in: ["open", "in_progress"] } }),
    Ticket.countDocuments({ createdAt: { $gte: weekAgo } }),
    Ticket.countDocuments({ createdAt: { $gte: twoWeeksAgo, $lt: weekAgo } }),
    Booking.aggregate([
      { $match: { status: "completed", scheduledAt: { $gte: weekAgo } } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
    Booking.aggregate([
      { $match: { status: "completed", scheduledAt: { $gte: twoWeeksAgo, $lt: weekAgo } } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
    Provider.countDocuments({ isAvailable: true }),
    Provider.countDocuments({}),
    Booking.aggregate([
      { $match: { scheduledAt: { $gte: trendStart } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$scheduledAt" } }, count: { $sum: 1 } } },
    ]),
    Booking.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
    Booking.find().sort({ scheduledAt: -1 }).limit(RECENT_BOOKINGS_LIMIT).populate("customer", "name"),
    Ticket.find({ status: "open" }).sort({ createdAt: -1 }).limit(OPEN_TICKETS_LIMIT),
  ]);

  const revenueThisWeek = revenueThisWeekAgg[0]?.total ?? 0;
  const revenuePrevWeek = revenuePrevWeekAgg[0]?.total ?? 0;

  const trendMap = new Map(trendAgg.map((d) => [d._id, d.count]));
  const last14Days = Array.from({ length: TREND_DAYS }, (_, i) => {
    const key = dateKey(new Date(trendStart.getTime() + i * DAY_MS));
    return { date: key, count: trendMap.get(key) ?? 0 };
  });

  const statusMap = new Map(statusBreakdownAgg.map((s) => [s._id, s.count]));
  const statusBreakdown = STATUS_ORDER.map((status) => ({ status, count: statusMap.get(status) ?? 0 }));

  const recentBookings = recentBookingsRaw.map((b) => ({
    ...b.toObject(),
    customerName: b.customer?.name ?? "Unknown",
  }));

  res.status(200).json({
    kpis: {
      todaysBookings,
      todaysBookingsDelta: percentDelta(todaysBookings, yesterdaysBookings),
      activeTickets,
      ticketsDelta: percentDelta(ticketsThisWeek, ticketsPrevWeek),
      revenueThisWeek,
      revenueDelta: percentDelta(revenueThisWeek, revenuePrevWeek),
      availableProviders,
      totalProviders,
    },
    last14Days,
    statusBreakdown,
    recentBookings,
    openTickets,
  });
});
