import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { useAuth } from "../../context/AuthContext";
import { mockApi, TEST_CONFIG, testUser } from "../../test/mockApi";
import { renderWithProviders } from "../../test/render";
import { AccountPage } from "./AccountPage";

// The page lives behind sign-in, so it only renders once the session is known.
function SignedIn({ children }) {
  const { user } = useAuth();
  return user ? children : null;
}

function setup({ demoAccount = false, config = TEST_CONFIG } = {}) {
  mockApi({
    "GET /auth/me": { user: testUser("finance", { name: "Jessica Nguyen", demoAccount }) },
    "GET /config": config,
  });
  renderWithProviders(
    <SignedIn>
      <AccountPage />
    </SignedIn>,
    { route: "/account" }
  );
}

describe("AccountPage", () => {
  it("shows who is signed in and their role", async () => {
    setup();
    expect(await screen.findByRole("heading", { name: "Jessica Nguyen" })).toBeInTheDocument();
    expect(screen.getAllByText("Finance").length).toBeGreaterThan(0);
  });

  it("switches between light, dark and the device's theme", async () => {
    setup();
    const dark = await screen.findByRole("radio", { name: /Dark/ });
    await userEvent.click(dark);
    expect(dark).toHaveAttribute("aria-checked", "true");
    expect(document.documentElement).toHaveClass("dark");
    expect(localStorage.getItem("servihub-theme")).toBe("dark");

    await userEvent.click(screen.getByRole("radio", { name: /System/ }));
    expect(localStorage.getItem("servihub-theme")).toBeNull();
    // The test browser reports a light system theme.
    expect(document.documentElement).not.toHaveClass("dark");
  });

  it("rates a new password while it's typed", async () => {
    setup();
    await userEvent.type(await screen.findByLabelText("New password"), "Correct-Horse-42");
    expect(screen.getByText("Strong")).toBeInTheDocument();
  });

  it("keeps a shared demo account's name, password and sessions as they are", async () => {
    setup({ demoAccount: true, config: { ...TEST_CONFIG, demoMode: true } });

    expect(await screen.findByText(/Shared demo accounts keep their password/)).toBeInTheDocument();
    expect(screen.getByLabelText("Display name")).toBeDisabled();
    expect(screen.getByLabelText("Current password")).toBeDisabled();
    expect(screen.getByLabelText("New password")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Update password" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Sign out everywhere" })).toBeDisabled();
  });

  it("leaves the same account editable when demo mode is off", async () => {
    setup({ demoAccount: true });

    await screen.findByRole("heading", { name: "Jessica Nguyen" });
    expect(screen.getByLabelText("Display name")).toBeEnabled();
    expect(screen.getByLabelText("Current password")).toBeEnabled();
    expect(screen.getByRole("button", { name: "Sign out everywhere" })).toBeEnabled();
  });
});
