# Security notes: authentication

## Why httpOnly cookies instead of localStorage

Tokens are set with `httpOnly: true` and are never included in any JSON
response body. `localStorage` (and any JS-readable cookie) is fully
readable by any script running on the page — including a script an
attacker managed to inject via XSS (a malicious npm dependency, an
unsanitized `dangerouslySetInnerHTML`, a compromised third-party widget,
etc.). If a token is sitting in `localStorage`, that single XSS bug is
enough to steal it and impersonate the user indefinitely. An `httpOnly`
cookie is invisible to `document.cookie` and to any JS on the page at
all — the browser attaches it to requests automatically, but a XSS
payload cannot read or exfiltrate it. XSS is still worth defending
against for other reasons (helmet, input sanitization, CSP), but it stops
being an instant session-theft vector.

## Why `sameSite: "lax"`

`sameSite: "lax"` is a CSRF *baseline*, not a complete CSRF defense on its
own. It means the cookie is sent on top-level, same-site navigations and
on GET requests originating from other sites, but **not** on
cross-site `POST`/`PATCH`/`DELETE` requests (the ones that actually change
state). That blocks the classic "attacker's page auto-submits a hidden
form to your API" CSRF attack for anything that mutates data, while still
letting normal navigation and top-level links work. `strict` would break
things like arriving at the app via an external link while already
logged in; `none` would remove the protection entirely and require a
separate CSRF token scheme. `lax` is the standard pragmatic default for
a same-organization SPA + API pair like this one.

## Why login returns the same generic error for bad email vs. bad password

`POST /api/auth/login` returns the identical `401 Invalid email or
password` whether the email doesn't exist or the password is wrong. If
the API instead said "no account with that email" vs. "wrong password",
an attacker could enumerate every registered email address on the
platform for free, one guess at a time, which is a real information leak
(useful for phishing, credential-stuffing target lists, or just
confirming a specific person's account exists). Same-message,
same-status-code, same general response time shape means a failed login
attempt reveals nothing about *why* it failed.

(Note: once credentials are correct but the account is disabled, the API
*does* return a distinct `403` message. That's intentional and not an
enumeration risk — the caller has already proven they know the correct
password, so there's nothing left to leak by being specific at that
point.)

## Google sign-in verifies identity, never creates accounts

`POST /api/auth/google` exists purely as an alternate *login* path, not a
registration path. The flow: Google Identity Services (frontend) produces
a signed ID token after the user picks a Google account; our backend
verifies that token's signature and audience via `google-auth-library`'s
`OAuth2Client.verifyIdToken`, which proves *who Google thinks this person
is* (a verified email address) - nothing more. That's a statement about
identity, not about authorization to use this tool.

So the handler looks the verified email up against the existing `User`
collection and does exactly one of three things: email matches an active
user → issue the same session cookies `POST /login` would; email matches
a disabled user → the same `403` disabled-account message `/login`
already returns; **email matches no user at all → `404`, and a new
account is never created.** There is deliberately no branch that calls
`User.create(...)` anywhere in this handler.

This matters because ServiHub has no self-registration anywhere in the
product - every staff account is provisioned exclusively through
Settings → Team by a `super_admin` (`POST/PATCH /api/team/*`). If Google
sign-in silently created an account for any Google user who happened to
authenticate, that would be a second, ungated account-creation path
bypassing the one deliberate admin-controlled gate the rest of the app
relies on - anyone with a Google account could hand themselves ServiHub
access, entirely outside the team roster and the RBAC model built around
it. Verifying identity and checking authorization are two different
questions; this handler only ever answers the first one and defers
entirely to the existing user table for the second.

## Why `tokenVersion` on the User model

A JWT can't be "deleted" server-side — it's valid until it expires,
period. That's fine for a 15-minute access token, but a 7-day refresh
token is a long time for a stolen or leaked token to keep working, and
there's no way to force one specific token to die early. `tokenVersion`
is the escape hatch: every refresh token embeds the user's
`tokenVersion` at the time it was issued, and `POST /api/auth/refresh`
checks that the number in the token still matches the number in the
database. Bump `tokenVersion` (on password change, on "log out
everywhere", or when an admin disables the account) and every refresh
token issued before that moment is instantly worthless — the compromised
session dies within, at most, one access-token lifetime (15 minutes),
without needing a token blocklist or any extra state beyond one integer
already on the user document.

## Refresh rotation flow

```
┌────────┐                              ┌────────┐                    ┌──────────┐
│ Client │                              │  API   │                    │ MongoDB  │
└───┬────┘                              └───┬────┘                    └────┬─────┘
    │  API call, accessToken cookie expired  │                              │
    │────────────────────────────────────────▶                             │
    │  401 { code: "TOKEN_EXPIRED" }          │                              │
    │◀────────────────────────────────────────                             │
    │                                         │                              │
    │  POST /api/auth/refresh                 │                              │
    │  (refreshToken cookie, scoped to this   │                              │
    │   path only)                            │                              │
    │────────────────────────────────────────▶│                              │
    │                                         │  verify signature + expiry   │
    │                                         │  findById(payload.userId)    │
    │                                         │─────────────────────────────▶│
    │                                         │◀─────────────────────────────│
    │                                         │  check tokenVersion matches  │
    │                                         │  check status === "active"   │
    │                                         │                              │
    │                                         │  sign NEW access token       │
    │                                         │  sign NEW refresh token      │
    │                                         │  (same tokenVersion)         │
    │  Set-Cookie: accessToken (new, 15m)     │                              │
    │  Set-Cookie: refreshToken (new, 7d)     │                              │
    │◀────────────────────────────────────────│                              │
    │                                         │                              │
    │  retry original API call                │                              │
    │────────────────────────────────────────▶│                              │
```

Every successful refresh **rotates both cookies** — the client never
reuses an old refresh token. Because rotation happens on every use (not
just on expiry), a leaked-and-later-stolen refresh token has a narrow
usable window: whichever party — attacker or legitimate user — refreshes
first invalidates the token the other one is holding, since the database
only tracks the current `tokenVersion`, not a per-token single-use flag.
If both the JWT signature check *and* the `tokenVersion`/`status` checks
pass, refresh succeeds; anything else (expired signature, wrong
`tokenVersion` because it was bumped, `status !== "active"`) is a flat
`401` and the client is sent back through `/login`.

If a refresh comes back `401`, the frontend should clear local auth state
and redirect to `/login` rather than retry — there is nothing left to
recover from that request.

---

# Full audit: threat model, RBAC matrix, and findings (2026-07-18)

Everything above this line predates and still holds; this section is the
result of a full security/quality pass across the whole API, not just
auth. See `README-API.md` for the complete endpoint reference this matrix
is checked against.

## Threat model summary

**In scope / defended against:**
- NoSQL operator injection via request body/query (`$gt`, `$where`, dotted
  keys) - blocked by `sanitizeInput` middleware + zod's type checking on
  every field that reaches a Mongo query.
- ReDoS / "match everything" via the free-text search endpoints - all
  user-supplied search strings are regex-escaped and anchored before use.
- Privilege escalation via a stale JWT (role changed or account disabled
  after a token was issued) - bounded to a 60s worst case (or instant, for
  the admin-driven path) by `requireAuth`'s auth cache; refresh tokens are
  revoked outright via `tokenVersion` (see above).
- Cross-origin credential theft - CORS is an explicit origin allow-list
  (not a wildcard), cookies are `httpOnly` + `sameSite=lax` +
  `secure` in production.
- Data over-exposure - `passwordHash`/`tokenVersion`/`__v` are stripped
  from every API response at the schema level, not per-controller.
- Brute-force login / AI-cost abuse - `authLimiter` and a per-user
  `aiAnalysisLimiter` on the Groq-backed endpoint.
- Stack traces / internal error detail reaching clients in production.

**Explicitly out of scope / accepted risk (documented, not hidden):**
- `requireAuth`'s auth cache is in-process memory. In a horizontally
  scaled deployment (multiple API instances), a disable/role-change is
  instant only on the instance that handled the admin action; other
  instances catch up within 60s. This app runs as a single instance
  today; a multi-instance deployment should replace the cache with a
  shared store (Redis) using the same interface
  (`getFreshAuthState`/`invalidateAuthCache` in `middleware/auth.js`).
- No account lockout beyond rate limiting - `authLimiter` throttles login
  attempts (10 / 15 min per IP) but doesn't lock the target account itself.
- No CSRF token, relying on `sameSite=lax` + strict CORS instead (see
  above) - would need revisiting if this app ever needed to support
  cross-site embedding.
- Rate limiting is in-memory (`express-rate-limit`'s default store), so it
  resets on restart and doesn't share state across instances - same
  single-instance caveat as the auth cache above.

## `requireAuth`'s auth cache

New in this audit. Previously `requireAuth` only verified the JWT's
signature/expiry - a still-valid (up to 15-minute) access token kept
working even after an admin disabled the user or changed their role,
since the token itself doesn't know either happened (only `/refresh`
re-checked the DB, and only once the access token had already expired).

Fix: a 60-second TTL in-process `Map<userId, {status, role, expiresAt}>`
in `middleware/auth.js`. A cache hit costs nothing extra; a miss does one
`User.findById(...).select("status role")`. This bounds "disabled user
with a live token" and "stale role on a live token" to at most 60s
instead of the full access-token lifetime, and `req.user.role` is now
sourced from this cache/DB read rather than trusted from the JWT payload.
`team.controller.js` calls `invalidateAuthCache(userId)` immediately after
any role/status change, making the common admin-driven case instant
rather than waiting out the TTL.

Verified live (one-off scripts run against a live server during this
audit, not checked into the repo - `scripts/rbac-audit.mjs` is the one
permanent, re-runnable check):
- Expired access token + valid refresh token → `/refresh` succeeds silently.
- Expired refresh token → `/refresh` returns 401.
- Disabled user's still-live (unexpired) access token → rejected
  immediately after the disable (not after a 60s wait), both for
  `requireAuth`-gated routes and for `/refresh`.
- Role change → old refresh token immediately rejected by `/refresh`.

## Team management endpoints (new)

`GET/PATCH /api/team/*` (`team.manage`, super_admin only) didn't exist
before this audit - the permission was defined in `rbac.js` but never
wired to a route, meaning "tokenVersion bump on role change or disable"
had no real endpoint to happen on. Added `routes/team.routes.js`,
`controllers/team.controller.js`, `validators/team.validators.js`: list
the team, change a member's role, change a member's status. Both mutating
routes bump `tokenVersion` and call `invalidateAuthCache`, and both block
acting on your own account (`400`, not a silent no-op) to prevent
accidental self-lockout of the only reachable super_admin.

## RBAC matrix

Source of truth: `src/middleware/rbac.js`'s `PERMISSIONS` map. Verified to
match every route's actual enforcement via `npm run audit:rbac`
(`scripts/rbac-audit.mjs`), which logs in as all 4 roles + makes an
unauthenticated call, hits all 24 protected endpoints (using a
syntactically-valid but nonexistent id for every `:id` param, so mutating
routes never touch real seeded data), and diffs the result against this
table. Last run: 24 endpoints x 5 identities = 120 checks, 0 mismatches.

| Permission | super_admin | manager | support_agent | finance |
|---|---|---|---|---|
| `dashboard.read` | ✅ | ✅ | ✅ | ✅ |
| `booking.read` | ✅ | ✅ | ✅ | ✅ |
| `booking.reassign` (incl. cancel) | ✅ | ✅ | ❌ | ❌ |
| `provider.read` | ✅ | ✅ | ✅ | ❌ |
| `customer.read` | ✅ | ✅ | ❌ | ❌ |
| `refund.read` | ✅ | ✅ | ✅ | ✅ |
| `refund.request` | ✅ | ✅ | ✅ | ✅ |
| `refund.approve` | ✅ | ✅ | ❌ | ✅ |
| `ticket.read` (incl. AI analyze) | ✅ | ✅ | ✅ | ❌ |
| `ticket.reply` | ✅ | ✅ | ✅ | ❌ |
| `ticket.resolve` | ✅ | ✅ | ✅ | ❌ |
| `team.manage` | ✅ | ❌ | ❌ | ❌ |
| search, `/auth/me` (any authenticated role) | ✅ | ✅ | ✅ | ✅ |

Unauthenticated callers: `401` on every row above. Public-by-design
routes (customer simulator: `POST /tickets`, `GET /tickets/simulator/*`,
`POST /tickets/:id/customer-message`; `POST /auth/login`,
`/demo-login`, `/refresh`, `/logout`; `GET /health`) are intentionally
not gated by `requireAuth` at all - see `README-API.md` for why each one
is public.

## Injection defenses

- Every field that reaches a Mongoose query is zod-validated with a
  concrete type (`z.string()`, `z.coerce.number()`, `z.enum()`,
  `objectIdSchema`'s `mongoose.isValidObjectId` refine) - an operator
  object (`{"$gt": ""}`) fails the type check before it ever reaches
  Mongo, regardless of the sanitizer below.
- `sanitizeInput` (`src/middleware/sanitizeInput.js`, global, applied to
  `body`+`query`) strips any key starting with `$` or containing `.` at
  any nesting depth, as defense in depth on top of the zod checks above.
  Built as a thin wrapper around `express-mongo-sanitize`'s `sanitize()`
  function rather than its default middleware, because that middleware
  reassigns `req.query` directly - Express 5 defines `req.query` as a
  getter-only accessor that re-parses the raw query string on every
  access (see `middleware/validate.js`'s comment for the same issue hit
  earlier in this project), so the default middleware would crash on
  every request with query params, and a naive in-place mutation would be
  silently discarded before the next read. The wrapper pins the cleaned
  snapshot via `Object.defineProperty` instead, same pattern
  `validate.js` already uses. Verified directly (unit-style, bypassing
  HTTP): a payload like `{ nested: { "$where": "...", safe: "ok" } }`
  comes out as `{ nested: { safe: "ok" } }` - the dangerous key is gone,
  sibling keys are untouched.
- Free-text search (`search.controller.js`, `booking`/`customer`
  controllers' `search` query param) is regex-escaped
  (`utils/regex.js#escapeRegex`) and anchored to the start of the field
  (`^...`) before being used as a `RegExp`. Verified live: `q=".*"`
  returns zero results (treated as a literal two-character string, not a
  wildcard) rather than the full dataset; a classic ReDoS payload
  (`(a+)+`) returns in ~135ms, not a hang.

## Data exposure

- `User`'s `toJSON` transform strips `passwordHash` and `tokenVersion` on
  every serialization - there is no code path that returns a raw user
  document without it going through this transform (all responses go
  through `res.json()`, which calls `toJSON()`).
- Every model now sets `versionKey: false` and never writes or returns
  `__v`. **Real gap found during this audit**: only `User` had a
  leak-prevention transform before; `Provider`, `Customer`, `Booking`,
  `Ticket`, `Refund` were all returning `__v` in list/detail responses via
  their default `.find()`/`.findById()` calls (no `$project` stage
  excluded it). Fixed by adding `versionKey: false` to all five, plus a
  re-seed (a schema option change doesn't retroactively strip a field
  already stored on existing documents - verified `__v` was still present
  post-fix until re-seeding, then confirmed gone).
- Error responses never include a stack trace when `NODE_ENV=production`,
  verified live for both a normal 404 and a genuine 500 (a body-parser
  `SyntaxError` from malformed JSON). While testing this, found and fixed
  a related bug: malformed JSON bodies were falling through to the
  generic `500 Internal server error` path instead of a `400` - a client
  mistake being reported as a server fault. `errorHandler.js` now detects
  `entity.parse.failed`/body `SyntaxError` and maps it to `400 Malformed
  request body`.
- Groq/AI failures: the controller catches any error from
  `analyzeTicketWithAI` and returns a fixed generic message
  (`"AI analysis is temporarily unavailable..."`) with `502`; the real
  error (which could include provider response detail, though never the
  API key - that's sent as an `Authorization` header, never echoed back
  by the SDK) is logged server-side only via `console.error`, never
  serialized into the response body.

## Rate limits

| Limiter | Scope | Limit | Applied to |
|---|---|---|---|
| `apiLimiter` | per IP | 300 / 15 min | every route (global) |
| `authLimiter` | per IP | 10 / 15 min | `/login`, `/demo-login` |
| `ticketSimulatorLimiter` | per IP | 20 / 15 min | public simulator ticket endpoints |
| `aiAnalysisLimiter` | **per user** (`req.user.userId`, not IP) | 10 / min | `POST /tickets/:id/analyze` |

All four return `429` with a `Retry-After` header when exceeded (verified
live for `authLimiter` and `ticketSimulatorLimiter` against an isolated
ephemeral instance, so as not to burn the shared dev server's own rate
budget). `aiAnalysisLimiter` is deliberately per-user rather than per-IP:
multiple agents can share an office network/NAT, and IP-based limiting
would throttle them as one caller.

## Validation policy

Every `POST`/`PATCH` route has a zod schema applied via
`validate(schema, source)` before its controller runs (the one exception,
`POST /tickets/:id/analyze`, takes no body at all - there's nothing to
validate). Unknown keys are **silently stripped**, not rejected with a
400 (zod object schemas default to "strip" unless `.strict()` is called,
and nothing in this codebase opts into `.strict()`) - a deliberate,
uniformly-applied choice: extra fields a client sends never reach
persistence or influence logic either way, and rejecting them outright
would make the API needlessly brittle against harmless extra fields.
Verified live: `GET /search?q=a&$where=1&role=super_admin` returns `200`
with the extra keys having no effect (no privilege escalation via a
smuggled `role` query param, no error).

## Sockets

- `io.use()` rejects any connection that is neither `{ auth: { role:
  "simulator" } }` nor carrying a valid `accessToken` cookie - verified
  live (a bare connection with no auth gets a `connect_error`).
- Simulator sockets never join the `agents` room (`if
  (!socket.data.isSimulator) socket.join("agents")` at connection time);
  a simulator calling `ticket:join("agents")` lands in `ticket:agents`
  (a different, harmless room - the handler always prefixes with
  `ticket:`), not the real `agents` room. Verified live via server-side
  room introspection.
- The `typing` event's `from` field is derived server-side from
  `socket.data.isSimulator` rather than trusted from the client payload -
  **fixed during this audit**; previously a simulator connection could
  set `from: "agent"` in its payload and the server would relay it
  verbatim, letting a customer-side connection spoof a staff typing
  indicator (and vice versa). Verified live: a simulator claiming
  `from: "agent"` is now relayed as `from: "customer"` regardless.
- `customer:message` (the only socket-based message-send path) is
  explicitly gated to simulator connections only; a staff socket calling
  it gets `{ ok: false, message: "Only the simulator can send customer
  messages" }` rather than being able to impersonate a customer. Staff
  send their own replies via the REST `POST /tickets/:id/messages`
  endpoint, which is permission-gated (`ticket.reply`) - there is no
  socket-based path for sending an agent message at all.
- Socket.IO's own CORS config had the same static-string-origin
  imprecision as the REST API's (see below) - fixed with the same
  allow-list-function pattern.

## CORS

Fixed during this audit: the `cors` package, when configured with
`origin: env.CLIENT_URL` (a static string), always echoes that exact
value back on every response regardless of the request's actual `Origin`
header. This was **not actually exploitable** - browsers enforce CORS by
checking the response's `Access-Control-Allow-Origin` against their own
page's origin, so a mismatched echoed value still gets blocked
client-side for a real attacker page - but it meant a `curl`-level test
couldn't cleanly show rejection (every response, including ones with a
disallowed `Origin`, carried an ACAO header). Replaced with an explicit
allow-list function (`app.js`, and the equivalent in `sockets/index.js`)
that only reflects the header back for a matching origin or no origin at
all (non-browser callers), and returns `403 Not allowed by CORS`
otherwise. Verified live: disallowed origin → `403`, no ACAO header;
matching origin → `200` + correct ACAO header; no origin (curl-style) →
`200`.

## Dependencies

`npm audit` (servihub-api): **0 vulnerabilities** as of this audit.

## Code quality

- `notFound.js` now goes through `next(new ApiError(404, ...))` like
  every other error path in the app, instead of calling
  `res.status(404).json(...)` directly - the one place that wasn't
  already consistent with the rest of the codebase's error handling.
  Everything else was already consistently `ApiError` + `asyncHandler`.
- Full dead-code sweep (every export in `src/` cross-referenced against
  its usages elsewhere): nothing found. `team.manage` was the one
  permission with zero routes behind it before this audit (fixed above,
  see "Team management endpoints").
- No stray `console.log`/`console.error` calls beyond the boot banner,
  the seed script's own summary output, and deliberate server-side-only
  error logging (`errorHandler.js`, `config/db.js`'s connection
  lifecycle, and the newly-added Groq-failure log in
  `ticket.controller.js`).

## Known limitations (not fixed, by choice)

- In-process auth cache and rate-limit store: fine for this app's single
  server instance; would need a shared store (Redis) to stay correct
  under horizontal scaling.
- No CSRF token (mitigated by `sameSite=lax` + strict CORS, not eliminated).
- No account lockout on repeated failed logins beyond IP-based rate
  limiting.
