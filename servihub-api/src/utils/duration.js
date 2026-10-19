const UNIT_MS = {
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
};

// "15m" -> 900000. Accepts the same shapes env.js validates ("30s", "12h", "30d").
export function parseDuration(value) {
  const match = /^(\d+)(s|m|h|d)$/.exec(String(value));
  if (!match) {
    throw new Error(`Invalid duration: ${value}`);
  }
  return Number(match[1]) * UNIT_MS[match[2]];
}
