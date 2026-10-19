import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { CommandPaletteProvider } from "../context/CommandPaletteContext";
import { mockApi, testUser } from "../test/mockApi";
import { renderWithProviders } from "../test/render";
import { SidebarSearch } from "./SidebarSearch";

const EMPTY_RESULTS = { bookings: [], customers: [], tickets: [] };

function setup(role = "manager", searchResults = EMPTY_RESULTS) {
  const server = mockApi({
    "GET /auth/me": { user: testUser(role) },
    "GET /search": searchResults,
  });
  renderWithProviders(
    <CommandPaletteProvider>
      <SidebarSearch />
    </CommandPaletteProvider>,
    { route: "/dashboard", path: "/dashboard" }
  );
  return server;
}

describe("CommandPalette", () => {
  it("opens from the search box with the pages and actions the role can use", async () => {
    setup("manager");
    await userEvent.click(screen.getByRole("button", { name: "Search bookings, customers and tickets" }));

    const dialog = await screen.findByRole("dialog", { name: "Search and commands" });
    expect(await within(dialog).findByRole("option", { name: /Bookings/ })).toBeInTheDocument();
    expect(within(dialog).getByRole("option", { name: /New booking/ })).toBeInTheDocument();
    // Settings needs team.manage, which a manager doesn't have.
    expect(within(dialog).queryByRole("option", { name: /Settings/ })).not.toBeInTheDocument();
  });

  it("finds a record and opens it with the keyboard", async () => {
    setup("manager", {
      ...EMPTY_RESULTS,
      customers: [{ _id: "c1", name: "Emily Johnson", phone: "+1 512-555-0102", area: "Hyde Park" }],
    });
    await userEvent.keyboard("{Control>}k{/Control}");

    const input = await screen.findByRole("combobox", { name: "Search bookings, customers, tickets and pages" });
    await userEvent.type(input, "emily");
    expect(await screen.findByRole("option", { name: /Emily Johnson/ })).toHaveAttribute("aria-selected", "true");

    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("/customers?customer=c1"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("says when nothing matches", async () => {
    setup("finance");
    await userEvent.keyboard("{Control>}k{/Control}");
    await userEvent.type(await screen.findByRole("combobox"), "zzzz");
    const message = await screen.findByText(/No results for/);
    expect(message).toHaveTextContent("No results for “zzzz”");
  });

  it("closes with Escape", async () => {
    setup();
    await userEvent.keyboard("{Control>}k{/Control}");
    await screen.findByRole("dialog");
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
