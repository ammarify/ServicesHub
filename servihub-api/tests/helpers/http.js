import request from "supertest";
import { createApp } from "../../src/app.js";
import { DEFAULT_PASSWORD } from "./factories.js";

export const app = createApp();

export function anonymous() {
  return request(app);
}

// A cookie-keeping client signed in as `user` (email + password login).
export async function signIn(user, { password = DEFAULT_PASSWORD, remember = false } = {}) {
  const agent = request.agent(app);
  const res = await agent.post("/api/auth/login").send({ email: user.email, password, remember });
  if (res.status !== 200) {
    throw new Error(`Login failed for ${user.email}: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return agent;
}

// Parses Set-Cookie headers into { name: { value, attributes... } } (last
// header wins per name+path).
export function parseSetCookies(res) {
  const headers = res.headers["set-cookie"] ?? [];
  return headers.map((header) => {
    const [pair, ...attributes] = header.split(";").map((part) => part.trim());
    const index = pair.indexOf("=");
    const cookie = { name: pair.slice(0, index), value: pair.slice(index + 1) };
    for (const attribute of attributes) {
      const [key, ...rest] = attribute.split("=");
      cookie[key.toLowerCase()] = rest.length ? rest.join("=") : true;
    }
    return cookie;
  });
}

export function findCookie(res, name, path) {
  return parseSetCookies(res).find((cookie) => cookie.name === name && (!path || cookie.path === path));
}

// The raw "name=value" pairs for both auth cookies from a response, for
// requests that need to replay a specific (e.g. old) token.
export function cookieHeaderFrom(res) {
  return parseSetCookies(res)
    .filter((cookie) => cookie.value && !cookie.expires?.includes("1970"))
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join("; ");
}
