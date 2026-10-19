import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { mockApi, reply } from "../../test/mockApi";
import { renderWithProviders } from "../../test/render";
import { ResetPasswordPage } from "./ResetPasswordPage";

function setup(token, verifyReply) {
  mockApi({
    "GET /auth/me": reply(401, { code: "AUTH_REQUIRED", message: "Not signed in" }),
    "POST /auth/reset-password/verify": verifyReply,
  });
  renderWithProviders(<ResetPasswordPage />, { route: `/reset-password?token=${token}`, path: "/reset-password" });
}

describe("ResetPasswordPage", () => {
  it("explains a cut-short link in plain words instead of the validation detail", async () => {
    setup(
      "abc",
      reply(400, {
        message: "token: Too small: expected string to have >=20 characters",
        errors: { token: "Too small: expected string to have >=20 characters" },
      })
    );

    expect(await screen.findByText("This link can't be used")).toBeInTheDocument();
    expect(screen.getByText("This link is invalid or has expired. Request a new one.")).toBeInTheDocument();
    expect(screen.queryByText(/Too small/)).not.toBeInTheDocument();
  });

  it("shows the API's reason for any other failure", async () => {
    setup("a".repeat(40), reply(429, { code: "RATE_LIMITED", message: "Too many attempts. Try again in a few minutes." }));

    expect(await screen.findByText("Too many attempts. Try again in a few minutes.")).toBeInTheDocument();
  });

  it("greets an invited teammate by name", async () => {
    setup("a".repeat(40), { purpose: "invite", name: "Jordan Lee", email: "jordan@servihub.test" });

    expect(await screen.findByRole("heading", { name: "Welcome, Jordan Lee" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Activate account" })).toBeInTheDocument();
  });
});
