import mongoose from "mongoose";
import { isProduction } from "../config/env.js";
import { ApiError } from "../utils/ApiError.js";

// express.json() rejects malformed request bodies with a SyntaxError
// (type "entity.parse.failed") before any route or validate() schema ever
// runs - that's a client mistake, not a server fault.
function isBodyParseError(err) {
  return err.type === "entity.parse.failed" || (err instanceof SyntaxError && "body" in err);
}

// Maps well-known library errors onto client errors so they never surface
// as a generic 500.
function normalize(err) {
  if (err instanceof ApiError) return err;

  if (isBodyParseError(err)) {
    return new ApiError(400, "Malformed request body");
  }
  if (err.type === "entity.too.large") {
    return new ApiError(413, "Request body is too large");
  }
  if (err instanceof mongoose.Error.CastError) {
    return new ApiError(400, `Invalid value for ${err.path}`);
  }
  if (err instanceof mongoose.Error.ValidationError) {
    const fieldErrors = Object.fromEntries(
      Object.entries(err.errors).map(([path, detail]) => [path, detail.message])
    );
    return new ApiError(400, "Validation failed", undefined, fieldErrors);
  }
  if (err?.code === 11000) {
    return new ApiError(409, "A record with the same unique value already exists", "DUPLICATE");
  }
  return null;
}

export function errorHandler(err, req, res, next) {
  const known = normalize(err);
  const statusCode = known?.statusCode ?? 500;

  if (statusCode >= 500) {
    console.error(err);
  }

  const body = { message: known?.message ?? "Internal server error" };
  if (known?.code) body.code = known.code;
  if (known?.fieldErrors) body.errors = known.fieldErrors;
  if (!isProduction && !known) body.stack = err.stack;

  if (res.headersSent) {
    return next(err);
  }

  res.status(statusCode).json(body);
}
