// The service catalogue ServiHub operates. Bookings and provider skills are
// validated against this list, and GET /api/config serves it to the admin
// app so its filters and forms never drift from what the API accepts.
export const SERVICES = [
  "AC Repair",
  "Deep Cleaning",
  "Plumbing",
  "Electrical",
  "Maid Service",
  "Pest Control",
];

export const BOOKING_STATUSES = ["pending", "assigned", "in_progress", "completed", "cancelled"];

// Bookings that haven't started yet can still be reassigned, rescheduled,
// edited or cancelled. Once a provider is on site (in_progress) or the job
// is closed (completed/cancelled) those changes no longer make sense.
export const OPEN_BOOKING_STATUSES = ["pending", "assigned"];
