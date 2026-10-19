# ServiHub API Reference

Base URL: `http://localhost:5000/api` in development. Request and response
bodies are JSON.

**Authentication** uses httpOnly cookies, never bearer tokens: `accessToken`
(path `/`) and `sh_refresh` (path `/api/auth`). Browsers must send
credentials (`withCredentials: true` / `credentials: "include"`). The admin
app's origin must be listed in `CLIENT_URL`.

**Lists** return `{ items, total, page, pages }` and accept `page` (default 1)
and `limit` (default 20, max 50).

**Errors** return `{ message, code?, errors? }`:

- `errors` is a field → message map on validation failures (400).
- `stack` is added outside production for unexpected (500) errors only.
- `code` is a machine-readable reason. The admin app reacts to these:

| Code | Status | Meaning |
|---|---|---|
| `AUTH_REQUIRED` | 401 | No access token. The client may try `/auth/refresh`. |
| `TOKEN_EXPIRED` | 401 | Access token expired. The client should call `/auth/refresh` and retry. |
| `INVALID_TOKEN` | 401 | Malformed or forged token, or the user no longer exists. |
| `SESSION_REVOKED` | 401 | The session was ended: sign-out, "log out everywhere", password reset/change, role change, or a detected refresh-token replay. Sign in again. |
| `SESSION_EXPIRED` | 401 | `/auth/refresh` could not renew the session. Sign in again. |
| `ACCOUNT_DISABLED` | 401/403 | An administrator disabled the account. |
| `INVALID_CREDENTIALS` | 401 | Wrong email or password (same answer for both). |
| `FORBIDDEN` | 403 | Signed in, but the role lacks the permission. |
| `FEATURE_DISABLED` | 503 | An optional integration (Groq, Google) isn't configured. |
| `AI_MISCONFIGURED` | 503 | Groq rejected the Copilot's API key or model (for example a retired model). An administrator has to fix `GROQ_API_KEY` / `GROQ_MODEL`; retrying won't help. |
| `AI_RATE_LIMITED` | 503 | The Groq account's rate limit was reached. Comes with `Retry-After` (seconds). |
| `DUPLICATE` | 409 | A unique value (email, phone) is already taken. |
| `HAS_HISTORY` | 409 | A delete was refused because the record has history (bookings, tickets, or a member who has already joined). The message says what to do instead. |
| `INVALID_PASSWORD_TOKEN` | 400 | Reset/invite link is invalid, used or expired. |

Permission names (`booking.read`, `team.manage`, ...) refer to
`src/middleware/rbac.js`, the single source of truth. Every sign-in response
and `GET /auth/me` include the caller's own `permissions` list, which the
admin app uses for navigation and buttons. See `SECURITY.md` for the full
role matrix.

---

## Health and config (public)

### `GET /health`
`200 { status: "ok", db: "connected", uptime }`, or `503 { status: "degraded", db: "disconnected" }`
while the database is unreachable.

### `GET /config`
Runtime settings the sign-in page needs before anyone is signed in:
`{ demoMode, googleClientId, aiEnabled, emailEnabled, services, timezone }`.
`services` is the service catalogue every form and filter uses.

---

## Auth (`/auth`)

| Method | Path | Guard | Notes |
|---|---|---|---|
| POST | `/login` | `authLimiter` | `{ email, password, remember? }` → `{ user }` + cookies. `remember` = "Keep me logged in": persistent cookies (`REFRESH_TOKEN_TTL`, default 30 days) instead of browser-session cookies (`SESSION_TOKEN_TTL`, 12 h). 401 `INVALID_CREDENTIALS`, 403 `ACCOUNT_DISABLED`. |
| POST | `/google` | `authLimiter` | `{ credential, remember? }` (Google ID token). Signs in **existing** staff only; 404 if no account has that email; 503 if `GOOGLE_CLIENT_ID` isn't set. |
| POST | `/demo-login` | `authLimiter`, DEMO_MODE | `{ role }` → signs in as the oldest active user with that role, no password. 404 when DEMO_MODE is off. |
| POST | `/refresh` | `refreshLimiter` | Uses the `sh_refresh` cookie. Rotates the refresh token (single use) and sets new cookies → `{ user }`. 401 `SESSION_EXPIRED` / `SESSION_REVOKED`. |
| POST | `/logout` | — | Revokes this device's session (its refresh **and** access token stop working) and clears the cookies. |
| POST | `/logout-all` | signed in | Ends every session of the user on every device. |
| GET | `/me` | signed in | `{ user: { id, name, email, role, status, permissions } }` |
| PATCH | `/me` | signed in | `{ name }` → `{ user }` |
| POST | `/change-password` | signed in, `authLimiter` | `{ currentPassword, newPassword }`. Signs out every other device; this one gets fresh cookies. Passwords: 8–128 chars with a letter and a number. |
| POST | `/forgot-password` | `passwordResetLimiter` | `{ email }`. Always the same 200 answer; emails a 1-hour single-use link when the account exists and is active. |
| POST | `/reset-password/verify` | `passwordResetLimiter` | `{ token }` → `{ purpose: "reset" \| "invite", name, email }` |
| POST | `/reset-password` | `passwordResetLimiter` | `{ token, password }`. Sets the password, consumes the link and ends every session. Also activates invited members. |

---

## Team (`/team`) — `team.manage` (super_admin)

| Method | Path | Body | Notes |
|---|---|---|---|
| GET | `/` | — | `{ members }` (whole roster). Each member includes `lastLoginAt` and `invitePending`. |
| POST | `/` | `{ name, email, role }` | Creates the member and an invitation link (7 days, single use) → `201 { member, inviteUrl, inviteExpiresAt, emailSent }`. The link is also emailed when Resend is configured. 409 `DUPLICATE` for an existing email. |
| POST | `/:id/invite` | — | Issues a new invitation link (the previous one stops working). |
| PATCH | `/:id/role` | `{ role }` | Signs the member out everywhere so their next session matches the new role. |
| PATCH | `/:id/status` | `{ status: "active" \| "disabled" }` | Disabling ends every session and live socket at once. |
| DELETE | `/:id` | — | Withdraws a **pending** invitation: deletes the account and its invitation link → `204`. A member who has already joined is never deleted (409 `HAS_HISTORY`; disable them instead). |

You can't change your own role or status or delete your own account (400),
and the last active super_admin can't be demoted or disabled (409).

---

## Dashboard (`/dashboard`) — `dashboard.read`

### `GET /summary?range=today|week|month&tz=<IANA zone>`
Periods are calendar periods in `tz` (falls back to `APP_TIMEZONE`); weeks
start on Monday. Deltas compare "so far" against the same stretch of the
previous period.

```
{
  range, timezone, period: { start, end },
  kpis: { bookings, bookingsDelta, revenue, revenueDelta,
          availableProviders, totalProviders,
          activeTickets?, newTickets?, newTicketsDelta? },   // ticket.read only
  trend: [{ date: "YYYY-MM-DD", count, revenue }],          // 7 / 14 / 30 days; revenue = completed jobs
  statusBreakdown: [{ status, count }],                      // bookings scheduled in the period
  recentBookings: Booking[],
  openTickets?: Ticket[],                                    // ticket.read only, with customer { name }
  pendingRefunds?: { count, total, items },                  // refund.read only
}
```

---

## Bookings (`/bookings`)

| Method | Path | Guard | Notes |
|---|---|---|---|
| GET | `/` | `booking.read` | Query: `status`, `service`, `search` (code or customer name), `customerId`, `providerId`, `sortBy` (`scheduledAt`\|`amount`\|`createdAt`), `sortDir`. Items carry `customer` and `provider` as `{ _id, name, phone }`; `provider` is `null` while the booking is unassigned. |
| GET | `/:id` | `booking.read` | Customer and provider populated, plus `refundSummary { approvedTotal, pendingTotal, refundable }` and `refunds`. Every mutation below returns this same shape. |
| POST | `/` | `booking.create` | `{ customerId, service, scheduledAt, amount, address, providerId? }` → `201`. `pending`, or `assigned` when a provider is given. |
| PATCH | `/:id` | `booking.update` | `{ scheduledAt?, amount?, address? }`. Pending/assigned only. The amount can't go below refunds already approved or pending. |
| PATCH | `/:id/status` | `booking.update` | `{ status: "in_progress" }` (from assigned) or `{ status: "completed" }` (from in_progress). |
| PATCH | `/:id/reassign` | `booking.reassign` | `{ providerId }`. Pending/assigned only; the provider must offer the booking's service and be available. Moves a pending booking to assigned. |
| PATCH | `/:id/cancel` | `booking.reassign` | `{ reason? }`. Pending/assigned only. |

Rule violations return 409 with a message the admin app shows as is. Every
change is recorded on the booking's `timeline` with the staff member's name.

---

## Providers (`/providers`)

| Method | Path | Guard | Notes |
|---|---|---|---|
| GET | `/` | `provider.read` | Query: `service`, `availableOnly` (`"true"`\|`"false"`), `search` (name). |
| GET | `/:id` | `provider.read` | `{ provider, earnings, jobs, activeBookings, totalBookings, recentBookings }` (earnings and jobs from completed bookings; `totalBookings` counts every booking ever assigned). |
| POST | `/` | `provider.manage` | `{ name, phone, area, services[], isAvailable?, verified? }` |
| PATCH | `/:id` | `provider.manage` | Any of the fields above. |
| DELETE | `/:id` | `provider.manage` | `204`. Only a provider with no bookings on record (409 `HAS_HISTORY` otherwise: bookings, earnings and refunds point at the profile; mark them off duty instead). |

## Customers (`/customers`)

| Method | Path | Guard | Notes |
|---|---|---|---|
| GET | `/` | `customer.read` | Query: `search` (name or phone). Items include `totalBookings`, `totalSpent`, `lastBookingAt`. |
| GET | `/:id` | `customer.read` | `{ customer, bookings, tickets }`. Totals cover the whole history; the lists are the latest 50. |
| POST | `/` | `customer.manage` | `{ name, phone, area }`. 409 `DUPLICATE` if the phone is taken. |
| PATCH | `/:id` | `customer.manage` | Any of the fields above. |
| DELETE | `/:id` | `customer.manage` | `204`. Only a customer with no bookings and no support tickets (409 `HAS_HISTORY` otherwise). |

Bookings are never deleted: they are cancelled, so revenue, refunds and
timelines stay intact.

---

## Refunds (`/refunds`)

| Method | Path | Guard | Notes |
|---|---|---|---|
| GET | `/` | `refund.read` | Query: `status`, `bookingId`. Also returns `counts: { pending, approved, rejected }`. |
| GET | `/:id` | `refund.read` | Booking (with customer), `requestedBy`, `decidedBy` populated. |
| POST | `/` | `refund.request` | `{ bookingId, amount, reason }`. One pending request per booking (409). The amount can't exceed what is still refundable (booking amount minus approved and pending refunds, 400). Notifies approvers live. |
| PATCH | `/:id/decision` | `refund.approve` | `{ decision: "approved" \| "rejected", note? }`. Pending only (409); approval re-checks the refundable balance. Notifies the requester live. |

---

## Tickets (`/tickets`)

### Customer simulator (public, DEMO_MODE only, `ticketSimulatorLimiter`)

There is no customer login; these routes stand in for a customer-facing
chat widget and return 404 when DEMO_MODE is off. Opening or resuming a
ticket returns a **token scoped to that one ticket** (12 h), required as the
`x-simulator-token` header to read or post to it.

| Method | Path | Notes |
|---|---|---|
| GET | `/simulator/options` | `{ customers: [{ id, name, bookings, openTickets }] }` |
| POST | `/` | `{ customerId, bookingId, subject, text, priority }` → `201 { ticket, token }`. Notifies agents live. |
| POST | `/simulator/session` | `{ customerId, ticketId }` → `{ ticket, token }` to resume an existing ticket. |
| GET | `/simulator/:id` | Token required. The ticket's code, subject, status, priority and messages. |
| POST | `/:id/customer-message` | Token required. `{ text }`. A message on a resolved ticket reopens it. |

### Staff

| Method | Path | Guard | Notes |
|---|---|---|---|
| GET | `/` | `ticket.read` | Query: `status`, `priority`. Items include `unanswered`, `hasAnalysis` and a `lastMessage { from, text, at }` preview (text capped at 140 characters). |
| GET | `/:id` | `ticket.read` | Booking (with provider) and customer populated, plus any stored `aiAnalysis`. |
| POST | `/:id/messages` | `ticket.reply` | `{ text }` (1–2000 chars) → `201 { message, status }`. The first reply moves an open ticket to `in_progress`. |
| PATCH | `/:id/status` | `ticket.resolve` | `{ status: "open" \| "in_progress" \| "resolved" }` |
| PATCH | `/:id/priority` | `ticket.resolve` | `{ priority: "low" \| "medium" \| "high" }` |
| POST | `/:id/analyze` | `ticket.read`, `aiAnalysisLimiter` | Asks Groq for `{ summary, sentiment, refundEligibility, suggestedReply, suggestedActions, guardrails, analyzedAt }` and stores it. 503 `FEATURE_DISABLED` without `GROQ_API_KEY`; 503 `AI_MISCONFIGURED` when Groq rejects the key or model; 503 `AI_RATE_LIMITED` (with `Retry-After`) at Groq's rate limit; 502 after two unusable model answers or when Groq can't be reached. |

The Copilot's output is validated against a schema, then checked against
the refund policy on the server: the refund percentage is capped by the
section it cites (§1 100%, §2 100%, §3 50%, §4 70%, §5 0%); §1 counts only
for a cancelled booking and §2 only when the provider never started; the
percentage is zeroed outside the 7-day window (§6) or without a fitting
citation; and impossible actions (reassigning a started booking) are
removed. Every adjustment is listed in `guardrails`.

The model is `GROQ_MODEL` (default `openai/gpt-oss-120b`, asked for strict
structured output with low reasoning effort; other models get JSON mode).
Long conversations are trimmed to the opening message and the latest ones.
`npm run check:ai` tests the key and the model with two real analyses.

---

## Search (`/search`) — any signed-in user

### `GET /?q=`
`{ bookings, customers, tickets }`, 5 hits each. Bookings by code, customers
by name prefix or phone, tickets by code or subject prefix; a bare number
such as `4801` matches `BK-4801`/`TK-4801`. Each resource is only searched
for roles that can read it.

---

## Realtime (Socket.IO, same origin as the API)

Staff sockets authenticate with the same cookies and the same checks as
REST requests (refused handshakes carry `{ data: { code } }`). They join
`user:<id>` and `session:<sid>` (so sign-outs and account changes can drop
them), `agents` with `ticket.read`, and `approvers` with `refund.approve`.
Simulator sockets connect with `auth: { role: "simulator" }` (DEMO_MODE only)
and must unlock each ticket with its token.

| Direction | Event | Payload | Who |
|---|---|---|---|
| client → server | `ticket:join` | staff: `ticketId`; simulator: `{ ticketId, token }` (ack `{ ok }`) | `ticket.read` / valid token |
| client → server | `ticket:leave` | `ticketId` | |
| client → server | `typing` | `{ ticketId }` | sockets in that ticket's room; `from` is set by the server |
| client → server | `customer:message` | `{ ticketId, text }` (ack `{ ok, message }`) | simulator, unlocked ticket |
| server → client | `ticket:new` | `{ _id, code, subject, priority, status, createdAt, customer }` | `agents` |
| server → client | `ticket:message` | `{ ticketId, message }` | `ticket:<id>` room |
| server → client | `ticket:customer-message` | `{ ticketId, code, subject, customerName, text, at }` | `agents` |
| server → client | `ticket:updated` | `{ ticketId, status, priority, updatedAt }` | `agents` + the ticket room |
| server → client | `typing` | `{ ticketId, from: "agent" \| "customer" }` | the ticket room |
| server → client | `refund:requested` | `{ refundId, code, amount, bookingCode, requestedByName, at }` | `approvers` |
| server → client | `refund:decided` | `{ refundId, code, status, amount, bookingCode, decidedByName, requestedBy, at }` | `approvers` + the requester |

---

## Rate limits

In-memory per process (they reset on restart). `DISABLE_RATE_LIMITS=true`
turns them off for automated tests.

| Limiter | Key | Limit | Applied to |
|---|---|---|---|
| `apiLimiter` | user when signed in, else IP | 1500 / 300 per 15 min | every route |
| `authLimiter` | IP, failed attempts only | 10 / 15 min | login, Google, demo login, change password |
| `refreshLimiter` | IP | 120 / 15 min | `/auth/refresh` |
| `passwordResetLimiter` | IP | 20 / 15 min | forgot / verify / reset password |
| `ticketSimulatorLimiter` | IP | 60 / 15 min | the public simulator routes |
| `aiAnalysisLimiter` | user | 10 / min | `/tickets/:id/analyze` |
