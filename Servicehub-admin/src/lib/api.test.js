import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockApi, reply } from "../test/mockApi";
import { api, errorMessage, fieldErrors, setSessionExpiredHandler } from "./api";

const expired = reply(401, { code: "TOKEN_EXPIRED", message: "Access token expired" });

describe("silent refresh", () => {
  let onExpired;

  beforeEach(() => {
    onExpired = vi.fn();
    setSessionExpiredHandler(onExpired);
  });

  it("refreshes once and replays the request after an expired access token", async () => {
    let refreshed = false;
    const server = mockApi({
      "GET /bookings": () => (refreshed ? { bookings: [], total: 0 } : expired),
      "POST /auth/refresh": () => {
        refreshed = true;
        return { user: { id: "u1" } };
      },
    });

    const res = await api.get("/bookings");

    expect(res.data).toEqual({ bookings: [], total: 0 });
    expect(server.callsTo("POST", "/auth/refresh")).toHaveLength(1);
    expect(server.callsTo("GET", "/bookings")).toHaveLength(2);
    expect(onExpired).not.toHaveBeenCalled();
  });

  it("shares one refresh between requests that fail together", async () => {
    let refreshed = false;
    let releaseRefresh;
    const refreshGate = new Promise((resolve) => {
      releaseRefresh = resolve;
    });
    const server = mockApi({
      "GET /bookings": () => (refreshed ? { bookings: [] } : expired),
      "GET /refunds": () => (refreshed ? { refunds: [] } : expired),
      "GET /dashboard": () => (refreshed ? { kpis: {} } : expired),
      "POST /auth/refresh": async () => {
        await refreshGate;
        refreshed = true;
        return { user: { id: "u1" } };
      },
    });

    const pending = Promise.all([api.get("/bookings"), api.get("/refunds"), api.get("/dashboard")]);
    // Let all three fail before the refresh answers.
    await vi.waitFor(() => expect(server.callsTo("POST", "/auth/refresh")).toHaveLength(1));
    releaseRefresh();
    const results = await pending;

    expect(results.map((res) => Object.keys(res.data)[0])).toEqual(["bookings", "refunds", "kpis"]);
    expect(server.callsTo("POST", "/auth/refresh")).toHaveLength(1);
  });

  it("ends the session when the refresh itself is refused", async () => {
    const server = mockApi({
      "GET /bookings": expired,
      "POST /auth/refresh": reply(401, { code: "SESSION_REVOKED", message: "Session revoked" }),
    });

    await expect(api.get("/bookings")).rejects.toMatchObject({ response: { status: 401 } });
    expect(onExpired).toHaveBeenCalledWith("SESSION_REVOKED");
    expect(server.callsTo("GET", "/bookings")).toHaveLength(1);
  });

  it("does not loop when the replayed request is still unauthorized", async () => {
    const server = mockApi({
      "GET /bookings": expired,
      "POST /auth/refresh": { user: { id: "u1" } },
    });

    await expect(api.get("/bookings")).rejects.toMatchObject({ response: { status: 401 } });
    expect(server.callsTo("POST", "/auth/refresh")).toHaveLength(1);
    expect(server.callsTo("GET", "/bookings")).toHaveLength(2);
  });

  it("signs out straight away when the session was revoked or the account disabled", async () => {
    const server = mockApi({
      "GET /bookings": reply(401, { code: "SESSION_REVOKED", message: "Session revoked" }),
      "GET /refunds": reply(401, { code: "ACCOUNT_DISABLED", message: "Account disabled" }),
    });

    await expect(api.get("/bookings")).rejects.toBeTruthy();
    await expect(api.get("/refunds")).rejects.toBeTruthy();

    expect(server.callsTo("POST", "/auth/refresh")).toHaveLength(0);
    expect(onExpired.mock.calls).toEqual([["SESSION_REVOKED"], ["ACCOUNT_DISABLED"]]);
  });

  it("never refreshes for a failed sign-in", async () => {
    const server = mockApi({
      "POST /auth/login": reply(401, { code: "AUTH_REQUIRED", message: "Invalid email or password" }),
    });

    await expect(api.post("/auth/login", { email: "a@b.co", password: "x" })).rejects.toBeTruthy();
    expect(server.callsTo("POST", "/auth/refresh")).toHaveLength(0);
    expect(onExpired).not.toHaveBeenCalled();
  });

  it("leaves 403s alone", async () => {
    const server = mockApi({ "GET /team": reply(403, { code: "FORBIDDEN", message: "Forbidden" }) });

    await expect(api.get("/team")).rejects.toMatchObject({ response: { status: 403 } });
    expect(server.callsTo("POST", "/auth/refresh")).toHaveLength(0);
    expect(onExpired).not.toHaveBeenCalled();
  });
});

describe("error helpers", () => {
  it("prefers the API's message", () => {
    const error = { response: { data: { message: "Booking is already cancelled" } } };
    expect(errorMessage(error, "fallback")).toBe("Booking is already cancelled");
  });

  it("explains network failures", () => {
    expect(errorMessage({ code: "ERR_NETWORK" })).toMatch(/can't reach the server/i);
  });

  it("falls back otherwise", () => {
    expect(errorMessage(new Error("boom"), "Couldn't save")).toBe("Couldn't save");
  });

  it("extracts field errors", () => {
    expect(fieldErrors({ response: { data: { errors: { amount: "Too much" } } } })).toEqual({ amount: "Too much" });
    expect(fieldErrors(new Error("x"))).toEqual({});
  });
});
