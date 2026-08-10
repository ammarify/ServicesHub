# ServiHub API Reference

Base URL: `http://localhost:5000/api` (dev). All request/response bodies are
JSON. Auth is via `accessToken`/`refreshToken` httpOnly cookies, not bearer
tokens - `credentials: "include"` (or equivalent) is required on every
authenticated request.

Every list endpoint returns `{ items, total, page, pages }` unless noted
otherwise. Every error response is `{ message, code?, errors? }` - `code`
is a machine-readable string for a handful of specific cases
(`TOKEN_EXPIRED`, `ACCOUNT_DISABLED`), `errors` is a field→message map
present only on 400s from body/query validation.

Permission names below (`ticket.read`, `team.manage`, etc.) refer to
`src/middleware/rbac.js`'s `PERMISSIONS` map - see `SECURITY.md` for the
full role matrix.

---

## Auth (`/api/auth`)

None of these require `requireAuth` except `GET /me`. `/login` and
`/demo-login` are rate-limited (`authLimiter`: 10 requests / 15 min, keyed
by IP).

### `POST /login`
Request: `{ email: string, password: string }`
Response `200`: `{ user: { id, name, email, role } }`, sets both cookies.
Errors: `401` invalid credentials, `403` account disabled.

### `POST /demo-login`
Request: `{ role: "super_admin" | "manager" | "support_agent" | "finance" }`
Response `200`: same shape as `/login`.
Errors: `404` no active demo user for that role.

### `POST /refresh`
No body - reads the `refreshToken` cookie. Re-checks the user's
`tokenVersion` and `status` against the DB (not just the JWT signature).
Response `200`: `{ message: "Token refreshed" }`, sets fresh cookies.
Errors: `401` missing/invalid/expired refresh token, revoked
(`tokenVersion` mismatch), or disabled account.

### `POST /logout`
No body. Clears both cookies. Response `200`: `{ message: "Logged out" }`.

### `GET /me`
Requires auth. Response `200`: `{ user: { id, name, email, role, status } }`.

---

## Team (`/api/team`) - `team.manage` (super_admin only)

### `GET /`
Response `200`: `{ members: User[] }` (full team roster, no pagination -
team sizes are small by construction in this app).

### `PATCH /:id/role`
Request: `{ role: "super_admin" | "manager" | "support_agent" | "finance" }`
Response `200`: `{ member: User }`. Bumps the member's `tokenVersion`
(revokes their refresh token) and invalidates `requireAuth`'s auth cache
for them immediately.
Errors: `400` if `:id` is your own account, `404` member not found.

### `PATCH /:id/status`
Request: `{ status: "active" | "disabled" }`
Response `200`: `{ member: User }`. Same tokenVersion-bump +
cache-invalidation behavior as role changes.
Errors: `400` if `:id` is your own account, `404` member not found.

---

## Dashboard (`/api/dashboard`) - `dashboard.read`

### `GET /summary`
Response `200`:
```
{
  kpis: { todaysBookings, todaysBookingsDelta, activeTickets, ticketsDelta,
          revenueThisWeek, revenueDelta, availableProviders, totalProviders },
  last14Days: [{ date, count }],
  statusBreakdown: [{ status, count }],
  recentBookings: Booking[],
  openTickets: Ticket[],
}
```

---

## Bookings (`/api/bookings`) - `booking.read` (GET), `booking.reassign` (PATCH)

### `GET /`
Query: `page?, limit? (max 50), status?, service?, search?, sortBy? ("scheduledAt"|"amount"), sortDir? ("asc"|"desc")`
Response `200`: `{ items: Booking[], total, page, pages }`.

### `GET /:id`
Response `200`: `{ booking }` (populated customer/provider).
Errors: `404`.

### `PATCH /:id/reassign`
Request: `{ providerId: ObjectId }`
Response `200`: `{ booking }`.
Errors: `404` booking or provider not found, `409` provider not available.

### `PATCH /:id/cancel`
No body.
Response `200`: `{ booking }`.
Errors: `404`, `409` booking isn't in a cancellable state (only
`pending`/`assigned`).

---

## Providers (`/api/providers`) - `provider.read`

### `GET /`
Query: `page?, limit?, service?, availableOnly? ("true"|"false"), search?`
Response `200`: `{ items: Provider[], total, page, pages }`.

### `GET /:id`
Response `200`: `{ provider, earnings, jobs, recentBookings: Booking[] }`.
Errors: `404`.

---

## Customers (`/api/customers`) - `customer.read`

### `GET /`
Query: `page?, limit?, search?`
Response `200`: `{ items: Customer[], total, page, pages }` - each item
includes computed `totalBookings`, `totalSpent`, `lastBookingAt`.

### `GET /:id`
Response `200`: `{ customer, bookings: Booking[], tickets: Ticket[] }`.
Errors: `404`.

---

## Refunds (`/api/refunds`)

### `GET /` - `refund.read`
Query: `page?, limit?, status?`
Response `200`: `{ items: Refund[], total, page, pages, counts: { pending, approved, rejected } }`.

### `GET /:id` - `refund.read`
Response `200`: `{ refund }`. Errors: `404`.

### `POST /` - `refund.request`
Request: `{ bookingId: ObjectId, amount: number (>0), reason: string (1-500 chars) }`
Response `201`: `{ refund }`.
Errors: `404` booking not found, `400` amount exceeds booking amount, `409`
a pending refund already exists for this booking.

### `PATCH /:id/decision` - `refund.approve`
Request: `{ decision: "approved" | "rejected" }`
Response `200`: `{ refund }`.
Errors: `404`, `409` refund isn't pending.

---

## Tickets (`/api/tickets`)

The first four routes below are **public** (rate-limited via
`ticketSimulatorLimiter`, 20 req / 15 min) - they back the unauthenticated
`/simulator` demo customer widget, which has no login of its own.

### `POST /` (public)
Request: `{ customerId, bookingId, subject, text, priority }`
Response `201`: `{ ticket }`. Broadcasts `ticket:new` to the `agents`
socket room.

### `GET /simulator/options` (public)
Response `200`: `{ customers: [{ id, name, bookings, openTickets }] }`.

### `GET /simulator/:id` (public)
Response `200`: `{ ticket }` (limited field set). Errors: `404`.

### `POST /:id/customer-message` (public)
Request: `{ text: string (1-2000 chars) }`
Response `201`: `{ message }`. Broadcasts `ticket:message` to
`ticket:{id}`.

Everything below requires auth.

### `GET /` - `ticket.read`
Query: `page?, limit?, status?, priority?`
Response `200`: `{ items: Ticket[], total, page, pages }` - each item
includes computed `unanswered` and `hasAnalysis` booleans.

### `GET /:id` - `ticket.read`
Response `200`: `{ ticket }` (populated booking/provider/customer,
includes stored `aiAnalysis` if the ticket has been analyzed before).
Errors: `404`.

### `POST /:id/messages` - `ticket.reply`
Request: `{ text: string (1-2000 chars) }`
Response `201`: `{ message }`. Broadcasts over the ticket's socket room.

### `PATCH /:id/status` - `ticket.resolve`
Request: `{ status: "open" | "in_progress" | "resolved" }`
Response `200`: `{ ticket }`.

### `PATCH /:id/priority` - `ticket.resolve`
Request: `{ priority: "low" | "medium" | "high" }`
Response `200`: `{ ticket }`.

### `POST /:id/analyze` - `ticket.read`, rate-limited (`aiAnalysisLimiter`:
10 req / min, **per user**, not per IP)
No body. Calls Groq to analyze the ticket against
`src/config/refundPolicy.js`, validates the model's output with zod
(retrying once on a bad response), and persists it.
Response `200`: `{ aiAnalysis: { summary, sentiment, refundEligibility: { eligible, percent, reason }, suggestedReply, suggestedActions, analyzedAt } }`.
Errors: `404` ticket not found, `429` rate limited, `502` AI analysis
failed twice in a row (never returns unvalidated model output).

---

## Search (`/api/search`) - any authenticated role

### `GET /`
Query: `q? (max 100 chars)`
Response `200`: `{ bookings: [], customers: [], tickets: [] }` - prefix
match (anchored, regex-escaped) against `code`/`name`, capped at 5 results
per resource. Each resource is only searched if the caller's role has that
resource's own `*.read` permission (e.g. `finance` never gets ticket
results back, matching that it has no `ticket.read`).

---

## Health (`/api/health`) - fully public

### `GET /`
Response `200`: `{ status: "ok", uptime: number }`.
