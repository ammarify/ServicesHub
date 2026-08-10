export class ApiError extends Error {
  constructor(statusCode, message, code, fieldErrors) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.code = code;
    this.fieldErrors = fieldErrors;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}
