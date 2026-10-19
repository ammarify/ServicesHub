import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/rbac.js";
import { validate } from "../middleware/validate.js";
import {
  listBookings,
  getBookingById,
  createBooking,
  updateBooking,
  updateBookingStatus,
  reassignBooking,
  cancelBooking,
} from "../controllers/booking.controller.js";
import {
  listBookingsQuerySchema,
  bookingIdParamsSchema,
  reassignBookingBodySchema,
  createBookingBodySchema,
  updateBookingBodySchema,
  updateBookingStatusBodySchema,
  cancelBookingBodySchema,
} from "../validators/booking.validators.js";

const router = Router();

router.use(requireAuth);

router.get("/", requirePermission("booking.read"), validate(listBookingsQuerySchema, "query"), listBookings);

router.post("/", requirePermission("booking.create"), validate(createBookingBodySchema, "body"), createBooking);

router.get(
  "/:id",
  requirePermission("booking.read"),
  validate(bookingIdParamsSchema, "params"),
  getBookingById
);

router.patch(
  "/:id",
  requirePermission("booking.update"),
  validate(bookingIdParamsSchema, "params"),
  validate(updateBookingBodySchema, "body"),
  updateBooking
);

router.patch(
  "/:id/status",
  requirePermission("booking.update"),
  validate(bookingIdParamsSchema, "params"),
  validate(updateBookingStatusBodySchema, "body"),
  updateBookingStatus
);

router.patch(
  "/:id/reassign",
  requirePermission("booking.reassign"),
  validate(bookingIdParamsSchema, "params"),
  validate(reassignBookingBodySchema, "body"),
  reassignBooking
);

router.patch(
  "/:id/cancel",
  requirePermission("booking.reassign"),
  validate(bookingIdParamsSchema, "params"),
  validate(cancelBookingBodySchema, "body"),
  cancelBooking
);

export default router;
