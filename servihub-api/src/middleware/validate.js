import { ApiError } from "../utils/ApiError.js";

export function validate(schema, source = "body") {
  return function runValidation(req, res, next) {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      const message = result.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join(", ");

      const fieldErrors = {};
      for (const issue of result.error.issues) {
        const key = issue.path.join(".") || "_";
        if (!(key in fieldErrors)) fieldErrors[key] = issue.message;
      }

      return next(new ApiError(400, message, undefined, fieldErrors));
    }

    // Express 5 defines req.query as a getter-only accessor, so a plain
    // assignment (req[source] = ...) throws for source === "query".
    // Object.defineProperty overrides the accessor for every source
    // uniformly instead of special-casing "query" here.
    Object.defineProperty(req, source, {
      value: result.data,
      writable: true,
      configurable: true,
      enumerable: true,
    });
    next();
  };
}
