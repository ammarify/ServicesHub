import { sanitize } from "express-mongo-sanitize";

// express-mongo-sanitize's own middleware() reassigns req.query directly,
// which Express 5 rejects (req.query is a getter-only accessor - see the
// same issue documented in middleware/validate.js). Its sanitize()
// function mutates in place and returns the same reference, but that
// isn't enough on its own: Express 5's req.query getter re-parses the raw
// query string from scratch on every access (see express/lib/request.js),
// so a mutation applied to one snapshot is silently discarded the next
// time anything reads req.query. Object.defineProperty pins the cleaned
// snapshot as a plain data property, overriding the getter so every
// later read (including validate()'s schema.safeParse(req.query)) sees
// the sanitized object instead of a fresh unsanitized re-parse.
function sanitizeAndPin(req, key) {
  const cleaned = sanitize(req[key]);
  Object.defineProperty(req, key, {
    value: cleaned,
    writable: true,
    configurable: true,
    enumerable: true,
  });
}

// Strips any key starting with "$" or containing "." from body and query
// before they reach zod/mongoose - defense in depth against operator
// injection (e.g. a JSON body field like {"$gt": ""} or a bracket-style
// query key), on top of (not instead of) zod's own type checks, which
// already reject non-string/non-number values for every field that flows
// into a query. req.params is deliberately not touched here: at this
// point in the middleware chain (mounted globally, before routing),
// Express hasn't matched a route yet, so req.params is always {} - there
// is nothing to sanitize until a route-level handler runs, by which point
// every :id param has already gone through validate(objectIdSchema),
// which itself only accepts a 24-hex-char ObjectId string that can never
// contain "$" or ".".
export function sanitizeInput(req, res, next) {
  sanitizeAndPin(req, "body");
  sanitizeAndPin(req, "query");
  next();
}
