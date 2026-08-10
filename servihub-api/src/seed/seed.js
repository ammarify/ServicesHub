import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { connectDB } from "../config/db.js";
import { User, Provider, Customer, Booking, Ticket, Refund } from "../models/index.js";
import { team, providers, customers, bookings, tickets, refunds } from "./mockData.js";

const SEED_PASSWORD = "Demo@1234";
const SUPPORT_AGENT_IDS = ["TM-004", "TM-005"];

async function wipe() {
  await Promise.all([
    User.deleteMany({}),
    Provider.deleteMany({}),
    Customer.deleteMany({}),
    Booking.deleteMany({}),
    Ticket.deleteMany({}),
    Refund.deleteMany({}),
  ]);
}

async function seedUsers() {
  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 12);
  const idMap = new Map();

  for (const member of team) {
    const user = await User.create({
      name: member.name,
      email: member.email,
      passwordHash,
      role: member.role,
      status: "active",
      createdAt: new Date(member.joinedAt),
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
      joinedAt: new Date(c.joinedAt),
    });
    idMap.set(c.id, customer._id);
  }

  return idMap;
}

async function seedBookings(customerIdMap, providerIdMap) {
  const idMap = new Map();

  for (const b of bookings) {
    const booking = await Booking.create({
      code: b.id,
      customer: customerIdMap.get(b.customerId),
      provider: providerIdMap.get(b.providerId),
      service: b.service,
      status: b.status,
      scheduledAt: new Date(b.scheduledAt),
      amount: b.amount,
      address: b.address,
      timeline: b.timeline.map((t) => ({ event: t.event, at: new Date(t.at) })),
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
      at: new Date(m.at),
    }));

    await Ticket.create({
      code: t.id,
      booking: bookingIdMap.get(t.bookingId),
      customer: customerIdMap.get(t.customerId),
      subject: t.subject,
      priority: t.priority,
      status: t.status,
      messages,
      createdAt: new Date(t.createdAt),
    });
  }
}

async function seedRefunds(bookingIdMap, userIdMap) {
  let requesterIndex = 0;

  for (const r of refunds) {
    const requestedBy = userIdMap.get(SUPPORT_AGENT_IDS[requesterIndex % SUPPORT_AGENT_IDS.length]);
    requesterIndex += 1;

    const decidedBy = r.decidedBy ? userIdMap.get(r.decidedBy) : null;
    const requestedAt = new Date(r.requestedAt);
    const decidedAt = decidedBy ? new Date(requestedAt.getTime() + 24 * 60 * 60 * 1000) : null;

    await Refund.create({
      code: r.id,
      booking: bookingIdMap.get(r.bookingId),
      amount: r.amount,
      reason: r.reason,
      status: r.status,
      requestedBy,
      decidedBy,
      decidedAt,
      createdAt: requestedAt,
    });
  }
}

async function seed() {
  await connectDB();
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

  console.log("Seed complete:");
  console.table(counts);

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch(async (err) => {
  console.error("Seed failed:", err);
  await mongoose.disconnect();
  process.exit(1);
});
