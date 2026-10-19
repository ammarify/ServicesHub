import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BookingProgress } from "./BookingProgress";

const AT = (hour) => `2026-10-15T${String(hour).padStart(2, "0")}:00:00.000Z`;

function booking(status, events) {
  return {
    status,
    createdAt: AT(8),
    timeline: events.map(([event, hour]) => ({ event, at: AT(hour) })),
  };
}

function steps() {
  return screen.getAllByRole("listitem").map((item) => item.textContent);
}

describe("BookingProgress", () => {
  it("marks the work under way as the current step", () => {
    render(<BookingProgress booking={booking("in_progress", [["created", 8], ["assigned", 9], ["started", 10]])} />);
    const current = screen.getAllByRole("listitem").find((item) => item.getAttribute("aria-current") === "step");
    expect(current).toHaveTextContent("In progress, happening now");
    expect(steps().at(-1)).toContain("Completed, not yet");
  });

  it("ends a cancelled booking where it stopped", () => {
    render(<BookingProgress booking={booking("cancelled", [["created", 8], ["assigned", 9], ["cancelled", 11]])} />);
    expect(steps().map((text) => text.split(",")[0])).toEqual(["Booked", "Assigned", "Cancelled"]);
  });

  it("shows every step done once completed", () => {
    render(
      <BookingProgress
        booking={booking("completed", [["created", 8], ["assigned", 9], ["started", 10], ["completed", 12]])}
      />
    );
    expect(steps().every((text) => text.includes(", done"))).toBe(true);
  });
});
