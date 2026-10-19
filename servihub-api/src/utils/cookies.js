import { env, isProduction } from "../config/env.js";

export const ACCESS_COOKIE = "accessToken";
// Renamed from "refreshToken" when the cookie moved to a wider path: a
// leftover cookie of the same name at the old, more specific path would be
// sent first and shadow the current one. A new name avoids that entirely.
export const REFRESH_COOKIE = "sh_refresh";

// The refresh cookie is only sent to the auth routes (/refresh and /logout
// need it); every other API call only ever carries the access cookie.
const REFRESH_COOKIE_PATH = "/api/auth";
const LEGACY_REFRESH_COOKIE = { name: "refreshToken", path: "/api/auth/refresh" };

function baseOptions() {
  return {
    httpOnly: true,
    sameSite: env.COOKIE_SAMESITE,
    secure: isProduction || env.COOKIE_SAMESITE === "none",
    ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
  };
}

// `maxAgeMs` is null for "Keep me logged in" unticked: both cookies then
// become browser-session cookies that disappear when the browser closes.
//
// The access cookie deliberately outlives the access token inside it. When
// the JWT expires the browser still sends it, the API answers 401
// TOKEN_EXPIRED, and the admin app silently refreshes. (If the cookie
// expired together with the token, the API would only see "no token" and
// the user would be signed out after 15 minutes.)
export function setAuthCookies(res, { accessToken, refreshToken, maxAgeMs }) {
  const lifetime = maxAgeMs ? { maxAge: maxAgeMs } : {};

  res.cookie(ACCESS_COOKIE, accessToken, { ...baseOptions(), path: "/", ...lifetime });
  res.cookie(REFRESH_COOKIE, refreshToken, { ...baseOptions(), path: REFRESH_COOKIE_PATH, ...lifetime });
  res.clearCookie(LEGACY_REFRESH_COOKIE.name, { ...baseOptions(), path: LEGACY_REFRESH_COOKIE.path });
}

export function clearAuthCookies(res) {
  res.clearCookie(ACCESS_COOKIE, { ...baseOptions(), path: "/" });
  res.clearCookie(REFRESH_COOKIE, { ...baseOptions(), path: REFRESH_COOKIE_PATH });
  res.clearCookie(LEGACY_REFRESH_COOKIE.name, { ...baseOptions(), path: LEGACY_REFRESH_COOKIE.path });
}
