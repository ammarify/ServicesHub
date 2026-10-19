import bcrypt from "bcryptjs";
import { Booking, Customer, Provider, Refund, Ticket, User } from "../../src/models/index.js";

let sequence = 0;
const next = () => {
  sequence += 1;
  return sequence;
};

export const DEFAULT_PASSWORD = "Password123";

// Low bcrypt cost keeps tests fast; login compares against any cost.
const passwordHashPromise = bcrypt.hash(DEFAULT_PASSWORD, 4);

export async function createUser(overrides = {}) {
  const n = next();
  const { password, ...rest } = overrides;
  return User.create({
    name: `Staff Member ${n}`,
    email: `staff${n}@servihub.test`,
    role: "support_agent",
    status: "active",
    passwordHash: password ? await bcrypt.hash(password, 4) : await passwordHashPromise,
    passwordSetAt: new Date(),
    ...rest,
  });
}

// One active user per role, created in role order (so demo-login, which
// picks the oldest active user of a role, finds these).
export async function createTeam() {
  return {
    super_admin: await createUser({ role: "super_admin", name: "Ada Admin" }),
    manager: await createUser({ role: "manager", name: "Max Manager" }),
    support_agent: await createUser({ role: "support_agent", name: "Sam Support" }),
    finance: await createUser({ role: "finance", name: "Fay Finance" }),
  };
}

export async function createCustomer(overrides = {}) {
  const n = next();
  return Customer.create({
    name: `Customer ${n}`,
    phone: `+1 512-555-${String(1000 + n).slice(-4)}`,
    area: "Downtown",
    joinedAt: new Date(),
    ...overrides,
  });
}

export async function createProvider(overrides = {}) {
  const n = next();
  return Provider.create({
    name: `Provider ${n}`,
    phone: `+1 512-555-${String(5000 + n).slice(-4)}`,
    services: ["Plumbing"],
    rating: 4.5,
    jobsCompleted: 10,
    isAvailable: true,
    verified: true,
    area: "Mueller",
    joinedAt: new Date(),
    ...overrides,
  });
}

export async function createBooking(overrides = {}) {
  const n = next();
  const customer = overrides.customer ?? (await createCustomer())._id;
  return Booking.create({
    code: `BK-${9000 + n}`,
    customer,
    service: "Plumbing",
    status: "pending",
    scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    amount: 200,
    address: "1 Test Street, Austin, TX",
    timeline: [{ event: "created", at: new Date() }],
    ...overrides,
  });
}

// `booking` (optional) must be a booking document.
export async function createTicket(overrides = {}) {
  const n = next();
  const { booking: bookingOverride, ...rest } = overrides;
  const booking = bookingOverride ?? (await createBooking());
  return Ticket.create({
    code: `TK-${900 + n}`,
    booking: booking._id,
    customer: booking.customer,
    subject: `Issue ${n}`,
    priority: "medium",
    status: "open",
    messages: [{ from: "customer", senderName: "Customer", text: "Something went wrong", at: new Date() }],
    ...rest,
  });
}

export async function createRefund(overrides = {}) {
  const n = next();
  return Refund.create({
    code: `RF-${500 + n}`,
    amount: 50,
    reason: "Test refund",
    status: "pending",
    ...overrides,
  });
}
