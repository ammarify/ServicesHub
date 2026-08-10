import { isProduction } from "../config/env.js";
import { ApiError } from "../utils/ApiError.js";

// express.json() rejects malformed request bodies with a SyntaxError
// (type "entity.parse.failed") before any route or validate() schema ever
// runs - that's a client mistake, not a server fault, so it's mapped to
// 400 here rather than falling through to the generic 500 every other
// unknown error gets.
function isBodyParseError(err) {
  return err.type === "entity.parse.failed" || (err instanceof SyntaxError && "body" in err);
}

export function errorHandler(err, req, res, next) {
  const isKnownError = err instanceof ApiError;
  const isParseError = !isKnownError && isBodyParseError(err);
  const statusCode = isKnownError ? err.statusCode : isParseError ? 400 : 500;
  const message = isKnownError ? err.message : isParseError ? "Malformed request body" : "Internal server error";

  console.error(err);

  const body = { message };

  if (isKnownError && err.code) {
    body.code = err.code;
  }

  if (isKnownError && err.fieldErrors) {
    body.errors = err.fieldErrors;
  }

  if (!isProduction && !isKnownError) {
    body.stack = err.stack;
  }

  res.status(statusCode).json(body);
}
