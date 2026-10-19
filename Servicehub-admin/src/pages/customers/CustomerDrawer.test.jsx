import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { mockApi, reply, testUser } from "../../test/mockApi";
import { renderWithProviders } from "../../test/render";
import { CustomerDrawer } from "./CustomerDrawer";

function customerDetail(overrides = {}) {
  return {
    customer: {
      _id: "c1",
      name: "Nora New",
      phone: "+1 512-555-0199",
      area: "Mueller",
      joinedAt: "2026-10-01T10:00:00.000Z",
      totalBookings: 0,
      totalSpent: 0,
      totalTickets: 0,
      ...overrides,
    },
    bookings: [],
    tickets: [],
  };
}

function setup(detail) {
  const onClose = vi.fn();
  const server = mockApi({
    "GET /auth/me": { user: testUser("manager") },
    "GET /customers/c1": detail,
    "DELETE /customers/c1": reply(204, ""),
  });
  renderWithProviders(<CustomerDrawer customerId="c1" open onClose={onClose} canManage canOpenTickets canCreateBooking />);
  return { server, onClose };
}

describe("CustomerDrawer delete", () => {
  it("deletes a customer without history after confirmation", async () => {
    const { server, onClose } = setup(customerDetail());

    const deleteButton = await screen.findByRole("button", { name: "Delete customer" });
    expect(deleteButton).toBeEnabled();
    await userEvent.click(deleteButton);

    const dialog = await screen.findByRole("dialog", { name: "Delete Nora New?" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Delete customer" }));

    expect(await screen.findByText("Nora New deleted.")).toBeInTheDocument();
    expect(server.callsTo("DELETE", "/customers/c1")).toHaveLength(1);
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("explains why a customer with bookings can't be deleted", async () => {
    const { server } = setup(customerDetail({ totalBookings: 3, totalTickets: 1 }));

    expect(await screen.findByRole("button", { name: "Delete customer" })).toBeDisabled();
    expect(screen.getByText("Nora New has 3 bookings and 1 ticket on record, so the profile stays for your records.")).toBeInTheDocument();
    expect(server.callsTo("DELETE", "/customers/c1")).toHaveLength(0);
  });
});
