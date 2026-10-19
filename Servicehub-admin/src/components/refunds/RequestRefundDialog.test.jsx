import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { mockApi, reply, TEST_CONFIG, testUser } from "../../test/mockApi";
import { renderWithProviders } from "../../test/render";
import { RequestRefundDialog } from "./RequestRefundDialog";

const BOOKING_ID = "665f1c2e9b1d4a0012345678";

function booking(summary) {
  return {
    _id: BOOKING_ID,
    code: "BK-4801",
    status: "completed",
    service: "AC Repair",
    amount: 150,
    refundSummary: { approvedTotal: 50, pendingTotal: 0, refundable: 100, ...summary },
  };
}

function setup({ summary, onRefundPost } = {}) {
  const server = mockApi({
    "GET /auth/me": { user: testUser("support_agent") },
    "GET /config": TEST_CONFIG,
    "GET /bookings/:id": { booking: booking(summary) },
    "POST /refunds": onRefundPost ?? ((req) => reply(201, { refund: { _id: "rf1", code: "RF-31", ...req.body } })),
  });
  const onClose = vi.fn();
  const onCreated = vi.fn();
  renderWithProviders(
    <RequestRefundDialog open bookingId={BOOKING_ID} defaultReason="" onClose={onClose} onCreated={onCreated} />
  );
  return { server, onClose, onCreated };
}

describe("RequestRefundDialog", () => {
  it("shows what can still be refunded for the booking", async () => {
    setup();
    expect(await screen.findByText("BK-4801")).toBeInTheDocument();
    expect(screen.getByText("Up to $100")).toBeInTheDocument();
  });

  it("refuses more than the refundable balance before calling the API", async () => {
    const { server } = setup();
    await screen.findByText("BK-4801");

    await userEvent.type(screen.getByLabelText("Amount (USD)"), "120");
    await userEvent.type(screen.getByLabelText("Reason"), "Technician never showed up");
    await userEvent.click(screen.getByRole("button", { name: "Submit request" }));

    expect(await screen.findByText("At most $100 can still be refunded")).toBeInTheDocument();
    expect(server.callsTo("POST", "/refunds")).toHaveLength(0);
  });

  it("submits a valid request", async () => {
    const { server, onClose, onCreated } = setup();
    await screen.findByText("BK-4801");

    await userEvent.type(screen.getByLabelText("Amount (USD)"), "80.5");
    await userEvent.type(screen.getByLabelText("Reason"), "  Partial service only  ");
    await userEvent.click(screen.getByRole("button", { name: "Submit request" }));

    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    expect(server.callsTo("POST", "/refunds")[0].body).toEqual({
      bookingId: BOOKING_ID,
      amount: 80.5,
      reason: "Partial service only",
    });
    expect(onClose).toHaveBeenCalled();
    expect(await screen.findByText(/RF-31 requested/)).toBeInTheDocument();
  });

  it("shows the API's field errors", async () => {
    setup({
      onRefundPost: () => reply(400, { message: "Validation failed", errors: { amount: "At most $20 can still be refunded" } }),
    });
    await screen.findByText("BK-4801");

    await userEvent.type(screen.getByLabelText("Amount (USD)"), "50");
    await userEvent.type(screen.getByLabelText("Reason"), "Late arrival");
    await userEvent.click(screen.getByRole("button", { name: "Submit request" }));

    expect(await screen.findByText("At most $20 can still be refunded")).toBeInTheDocument();
  });

  it("blocks a second request while one is waiting for a decision", async () => {
    setup({ summary: { pendingTotal: 40 } });
    expect(await screen.findByText(/already waiting for a decision/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit request" })).toBeDisabled();
  });

  it("blocks a fully refunded booking", async () => {
    setup({ summary: { approvedTotal: 150, refundable: 0 } });
    expect(await screen.findByText(/already been fully refunded/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit request" })).toBeDisabled();
  });
});
