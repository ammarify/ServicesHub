import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { env } from "../config/env.js";
import { connectDB } from "../config/db.js";
import {
  User,
  Provider,
  Customer,
  Booking,
  Ticket,
  Refund,
  Session,
  PasswordToken,
  Counter,
} from "../models/index.js";
import { team, providers, customers, bookings, tickets, refunds } from "./mockData.js";
import { SEED_ANCHOR_DATE, makeDateShifter } from "./relativeDates.js";

const SEED_PASSWORD = "Demo@1234";
const SUPPORT_AGENT_IDS = ["TM-004", "TM-005"];

// The mock data was written around a fixed "now" (SEED_ANCHOR_DATE). Every
// activity date is moved forward by whole days so that, whenever the seed
// runs, today's bookings/tickets/refunds line up with the real today and the
// dashboard shows a live-looking picture instead of months-old data.
const shift = makeDateShifter(new Date());

// Saves with the createdAt/updatedAt given in `doc` instead of "now", so the
// seeded history keeps its original ordering (the support queue sorts by
// updatedAt, the dashboard's recent bookings by createdAt).
function saveWithTimestamps(Model, doc) {
  return new Model(doc).save({ timestamps: false });
}

async function wipe() {
  await Promise.all(
    [User, Provider, Customer, Booking, Ticket, Refund, Session, PasswordToken, Counter].map((Model) =>
      Model.deleteMany({})
    )
  );
}

async function seedUsers() {
  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 12);
  const idMap = new Map();

  for (const member of team) {
    const joinedAt = new Date(member.joinedAt);
    const user = await saveWithTimestamps(User, {
      name: member.name,
      email: member.email,
      passwordHash,
      role: member.role,
      status: "active",
      passwordSetAt: joinedAt,
      createdAt: joinedAt,
      updatedAt: joinedAt,
    });
    idMap.set(member.id, user._id);
  }

  return idMap;
}

async function seedProviders() {
  const idMap = new Map();

  for (const p of providers) {
    const provider = await Provider.create({
      name: p.name,
      phone: p.phone,
      services: [p.service],
      rating: p.rating,
      jobsCompleted: p.jobsCompleted,
      isAvailable: p.isAvailable,
      verified: p.verified,
      area: p.area,
      joinedAt: new Date(p.joinedAt),
    });
    idMap.set(p.id, provider._id);
  }

  return idMap;
}

async function seedCustomers() {
  const idMap = new Map();

  for (const c of customers) {
    const customer = await Customer.create({
      name: c.name,
      phone: c.phone,
      area: c.area,
      joinedAt: shift(c.joinedAt),
    });
    idMap.set(c.id, customer._id);
  }

  return idMap;
}

async function seedBookings(customerIdMap, providerIdMap) {
  const idMap = new Map();

  for (const b of bookings) {
    const timeline = b.timeline.map((t) => ({ event: t.event, at: shift(t.at) }));
    const createdAt = timeline.find((t) => t.event === "created")?.at ?? shift(b.scheduledAt);

    const booking = await saveWithTimestamps(Booking, {
      code: b.id,
      customer: customerIdMap.get(b.customerId),
      // Pending bookings have no provider yet.
      provider: b.status === "pending" ? undefined : providerIdMap.get(b.providerId),
      service: b.service,
      status: b.status,
      scheduledAt: shift(b.scheduledAt),
      amount: b.amount,
      address: b.address,
      timeline,
      createdAt,
      updatedAt: timeline[timeline.length - 1]?.at ?? createdAt,
    });
    idMap.set(b.id, booking._id);
  }

  return idMap;
}

async function seedTickets(bookingIdMap, customerIdMap, customerNameMap) {
  let agentIndex = 0;

  for (const t of tickets) {
    const agentName = team.find((m) => m.id === SUPPORT_AGENT_IDS[agentIndex % SUPPORT_AGENT_IDS.length]).name;
    agentIndex += 1;

    const messages = t.messages.map((m) => ({
      from: m.from,
      senderName: m.from === "customer" ? customerNameMap.get(t.customerId) : agentName,
      text: m.text,
      at: shift(m.at),
    }));

    await saveWithTimestamps(Ticket, {
      code: t.id,
      booking: bookingIdMap.get(t.bookingId),
      customer: customerIdMap.get(t.customerId),
      subject: t.subject,
      priority: t.priority,
      status: t.status,
      messages,
      createdAt: shift(t.createdAt),
      updatedAt: messages[messages.length - 1]?.at ?? shift(t.createdAt),
    });
  }
}

async function seedRefunds(bookingIdMap, userIdMap) {
  let requesterIndex = 0;

  for (const r of refunds) {
    const requestedBy = userIdMap.get(SUPPORT_AGENT_IDS[requesterIndex % SUPPORT_AGENT_IDS.length]);
    requesterIndex += 1;

    const decidedBy = r.decidedBy ? userIdMap.get(r.decidedBy) : null;
    const requestedAt = shift(r.requestedAt);
    const decidedAt = decidedBy ? new Date(requestedAt.getTime() + 24 * 60 * 60 * 1000) : null;

    await saveWithTimestamps(Refund, {
      code: r.id,
      booking: bookingIdMap.get(r.bookingId),
      amount: r.amount,
      reason: r.reason,
      status: r.status,
      requestedBy,
      decidedBy,
      decidedAt,
      createdAt: requestedAt,
      updatedAt: decidedAt ?? requestedAt,
    });
  }
}

async function seed() {
  if (env.NODE_ENV === "production" && !process.argv.includes("--force")) {
    console.error("Refusing to wipe and reseed a production database. Re-run with --force if you really mean it.");
    process.exit(1);
  }

  await connectDB();
  // Make sure unique/partial indexes exist before inserting.
  await Promise.all([User, Provider, Customer, Booking, Ticket, Refund, Session, PasswordToken].map((M) => M.init()));
  await wipe();

  const userIdMap = await seedUsers();
  const providerIdMap = await seedProviders();
  const customerIdMap = await seedCustomers();
  const customerNameMap = new Map(customers.map((c) => [c.id, c.name]));
  const bookingIdMap = await seedBookings(customerIdMap, providerIdMap);
  await seedTickets(bookingIdMap, customerIdMap, customerNameMap);
  await seedRefunds(bookingIdMap, userIdMap);

  const counts = {
    users: await User.countDocuments(),
    providers: await Provider.countDocuments(),
    customers: await Customer.countDocuments(),
    bookings: await Booking.countDocuments(),
    tickets: await Ticket.countDocuments(),
    refunds: await Refund.countDocuments(),
  };

  console.log(`Seed complete (dates shifted from ${SEED_ANCHOR_DATE} to today):`);
  console.table(counts);
  console.log(`All seeded staff accounts use the password ${SEED_PASSWORD}`);

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch(async (err) => {
  console.error("Seed failed:", err);
  await mongoose.disconnect();
  process.exit(1);
});
