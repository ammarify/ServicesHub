import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { useAuth } from "../../context/AuthContext";
import { mockApi, testUser } from "../../test/mockApi";
import { renderWithProviders } from "../../test/render";
import { AccountPage } from "./AccountPage";

// The page lives behind sign-in, so it only renders once the session is known.
function SignedIn({ children }) {
  const { user } = useAuth();
  return user ? children : null;
}

function setup() {
  mockApi({ "GET /auth/me": { user: testUser("finance", { name: "Jessica Nguyen" }) } });
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
});
