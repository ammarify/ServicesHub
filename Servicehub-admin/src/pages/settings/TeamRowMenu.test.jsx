import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TeamRowMenu } from "./TeamRowMenu";

const member = { _id: "m1", name: "Madison Carter", status: "active", invitePending: false };

function setup(props = {}) {
  const handlers = { onChangeRole: vi.fn(), onToggleStatus: vi.fn(), onResendInvite: vi.fn(), onRevokeInvite: vi.fn() };
  render(<TeamRowMenu member={member} {...handlers} {...props} />);
  return handlers;
}

describe("TeamRowMenu", () => {
  it("offers role and status changes for a member", async () => {
    const handlers = setup();
    await userEvent.click(screen.getByRole("button", { name: "Actions for Madison Carter" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Change role" }));
    expect(handlers.onChangeRole).toHaveBeenCalledOnce();
  });

  it("explains why a shared demo account's actions are off", async () => {
    const handlers = setup({ locked: true });
    await userEvent.click(screen.getByRole("button", { name: "Actions for Madison Carter" }));

    expect(screen.getByText(/Shared demo account: its role and status stay as they are/)).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Change role" })).toBeDisabled();
    expect(screen.getByRole("menuitem", { name: "Disable account" })).toBeDisabled();
    expect(handlers.onToggleStatus).not.toHaveBeenCalled();
  });
});
