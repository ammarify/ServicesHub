import { isProduction } from "../config/env.js";

const ACCESS_TOKEN_MAX_AGE_MS = 15 * 60 * 1000;
const REFRESH_TOKEN_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const REFRESH_COOKIE_PATH = "/api/auth/refresh";

const baseCookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: isProduction,
};

export function setAccessCookie(res, token) {
  res.cookie("accessToken", token, {
    ...baseCookieOptions,
    path: "/",
    maxAge: ACCESS_TOKEN_MAX_AGE_MS,
  });
}

export function setRefreshCookie(res, token) {
  res.cookie("refreshToken", token, {
    ...baseCookieOptions,
    path: REFRESH_COOKIE_PATH,
    maxAge: REFRESH_TOKEN_MAX_AGE_MS,
  });
}

export function clearAuthCookies(res) {
  res.clearCookie("accessToken", { ...baseCookieOptions, path: "/" });
  res.clearCookie("refreshToken", { ...baseCookieOptions, path: REFRESH_COOKIE_PATH });
}
