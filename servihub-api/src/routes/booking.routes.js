import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/rbac.js";
import { validate } from "../middleware/validate.js";
import {
  listBookings,
  getBookingById,
  reassignBooking,
  cancelBooking,
} from "../controllers/booking.controller.js";
import {
  listBookingsQuerySchema,
  bookingIdParamsSchema,
  reassignBookingBodySchema,
} from "../validators/booking.validators.js";

const router = Router();

router.use(requireAuth);

router.get("/", requirePermission("booking.read"), validate(listBookingsQuerySchema, "query"), listBookings);

router.get(
  "/:id",
  requirePermission("booking.read"),
  validate(bookingIdParamsSchema, "params"),
  getBookingById
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
  cancelBooking
);

export default router;
