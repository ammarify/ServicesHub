import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { mockApi, reply, TEST_CONFIG, testUser } from "../../test/mockApi";
import { renderWithProviders } from "../../test/render";
import { LoginPage } from "./LoginPage";

function setup({ config = TEST_CONFIG, routes = {}, routeState } = {}) {
  const server = mockApi({
    "GET /auth/me": reply(401, { code: "AUTH_REQUIRED", message: "Not signed in" }),
    "GET /config": config,
    ...routes,
  });
  renderWithProviders(<LoginPage />, { route: "/login", path: "/login", routeState });
  return server;
}

describe("LoginPage", () => {
  it("signs in and remembers the device when asked", async () => {
    const server = setup({ routes: { "POST /auth/login": { user: testUser("manager") } } });

    await userEvent.type(screen.getByLabelText("Email"), "manager@servihub.test");
    await userEvent.type(screen.getByLabelText("Password"), "Password123");
    await userEvent.click(screen.getByLabelText("Keep me logged in"));
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("/dashboard"));
    expect(server.callsTo("POST", "/auth/login")[0].body).toEqual({
      email: "manager@servihub.test",
      password: "Password123",
      remember: true,
    });
  });

  it("returns to the page the visitor was headed to", async () => {
    setup({ routes: { "POST /auth/login": { user: testUser("support_agent") } }, routeState: { from: "/support?ticket=tk1" } });

    await userEvent.type(screen.getByLabelText("Email"), "agent@servihub.test");
    await userEvent.type(screen.getByLabelText("Password"), "Password123");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("/support?ticket=tk1"));
  });

  it("shows the API's error for wrong credentials", async () => {
    setup({
      routes: { "POST /auth/login": reply(401, { code: "INVALID_CREDENTIALS", message: "Invalid email or password" }) },
    });

    await userEvent.type(screen.getByLabelText("Email"), "someone@servihub.test");
    await userEvent.type(screen.getByLabelText("Password"), "wrong-pass1");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid email or password");
  });

  it("validates empty fields without calling the API", async () => {
    const server = setup();
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(screen.getByText("Enter your email")).toBeInTheDocument();
    expect(screen.getByText("Enter your password")).toBeInTheDocument();
    expect(server.callsTo("POST", "/auth/login")).toHaveLength(0);
  });

  it("hides demo access unless the server runs in demo mode", async () => {
    const server = setup();
    await waitFor(() => expect(server.callsTo("GET", "/config")).toHaveLength(1));
    expect(screen.queryByRole("button", { name: /demo account/i })).not.toBeInTheDocument();
  });

  it("offers one-click demo roles in demo mode", async () => {
    const server = setup({
      config: { ...TEST_CONFIG, demoMode: true },
      routes: { "POST /auth/demo-login": { user: testUser("finance") } },
    });

    await userEvent.click(await screen.findByRole("button", { name: /Try a demo account/ }));
    await userEvent.click(screen.getByRole("button", { name: /^Finance/ }));

    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("/dashboard"));
    expect(server.callsTo("POST", "/auth/demo-login")[0].body).toEqual({ role: "finance" });
  });
});
