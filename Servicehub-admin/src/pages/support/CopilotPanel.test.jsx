import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { mockApi, reply, TEST_CONFIG, testUser } from "../../test/mockApi";
import { renderWithProviders } from "../../test/render";
import { CopilotPanel } from "./CopilotPanel";

function makeTicket({ bookingStatus = "assigned", priority = "medium", aiAnalysis } = {}) {
  return {
    _id: "tk1",
    code: "TK-107",
    status: "open",
    priority,
    booking: {
      _id: "bk1",
      code: "BK-4801",
      status: bookingStatus,
      service: "AC Repair",
      amount: 200,
      provider: { _id: "pv1", name: "Ali Khan" },
    },
    aiAnalysis:
      aiAnalysis === undefined
        ? {
            summary: "Technician arrived two hours late.",
            sentiment: "frustrated",
            refundEligibility: { eligible: true, percent: 50, reason: "Per Section 3, provider delay beyond 90 minutes" },
            suggestedReply: "Sorry about the delay - we're processing a partial refund.",
            suggestedActions: ["request_refund", "reassign_provider", "escalate"],
            guardrails: ["Capped at 50% by Section 3"],
            analyzedAt: new Date().toISOString(),
          }
        : aiAnalysis,
  };
}

function setup({ role = "support_agent", ticket = makeTicket(), config = TEST_CONFIG, routes = {} } = {}) {
  const server = mockApi({
    "GET /auth/me": { user: testUser(role) },
    "GET /config": config,
    ...routes,
  });
  const onInsertReply = vi.fn();
  renderWithProviders(<CopilotPanel ticket={ticket} onInsertReply={onInsertReply} />);
  return { server, onInsertReply };
}

describe("CopilotPanel", () => {
  it("shows the stored analysis with its policy adjustments", async () => {
    setup();
    expect(await screen.findByText("Technician arrived two hours late.")).toBeInTheDocument();
    expect(screen.getByText("50%")).toBeInTheDocument();
    expect(screen.getByText("($100)")).toBeInTheDocument();
    expect(screen.getByText("Capped at 50% by Section 3")).toBeInTheDocument();
  });

  it("only offers actions the signed-in role can take", async () => {
    setup({ role: "support_agent" });
    expect(await screen.findByRole("button", { name: "Request refund" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Escalate to high priority" })).toBeInTheDocument();
    // Agents can't reassign providers (booking.reassign).
    expect(screen.queryByRole("button", { name: "Reassign provider" })).not.toBeInTheDocument();
  });

  it("offers reassignment to managers while the booking is still open", async () => {
    setup({ role: "manager" });
    expect(await screen.findByRole("button", { name: "Reassign provider" })).toBeInTheDocument();
  });

  it("hides reassignment once the booking is underway or finished", async () => {
    setup({ role: "manager", ticket: makeTicket({ bookingStatus: "completed" }) });
    await screen.findByRole("button", { name: "Request refund" });
    expect(screen.queryByRole("button", { name: "Reassign provider" })).not.toBeInTheDocument();
  });

  it("does not offer escalation twice", async () => {
    setup({ ticket: makeTicket({ priority: "high" }) });
    expect(await screen.findByRole("button", { name: "Already high priority" })).toBeDisabled();
  });

  it("opens the refund dialog prefilled from the analysis", async () => {
    setup({
      routes: {
        "GET /bookings/:id": {
          booking: {
            _id: "bk1",
            code: "BK-4801",
            status: "assigned",
            amount: 200,
            refundSummary: { approvedTotal: 0, pendingTotal: 0, refundable: 200 },
          },
        },
      },
    });

    await userEvent.click(await screen.findByRole("button", { name: "Request refund" }));
    const dialog = await screen.findByRole("dialog", { name: "Request refund" });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByLabelText("Amount (USD)")).toHaveValue(100);
    expect(screen.getByLabelText("Reason")).toHaveValue("Per Section 3, provider delay beyond 90 minutes");
  });

  it("inserts the suggested reply into the composer", async () => {
    const { onInsertReply } = setup();
    await userEvent.click(await screen.findByRole("button", { name: "Insert into composer" }));
    expect(onInsertReply).toHaveBeenCalledWith("Sorry about the delay - we're processing a partial refund.");
  });

  it("runs an analysis on request", async () => {
    const analysis = {
      summary: "Customer wants to reschedule.",
      sentiment: "calm",
      refundEligibility: { eligible: false, percent: 0, reason: "Scheduling request, not a policy case" },
      suggestedReply: "Happy to help you reschedule.",
      suggestedActions: ["no_action"],
      guardrails: [],
      analyzedAt: new Date().toISOString(),
    };
    const { server } = setup({
      ticket: makeTicket({ aiAnalysis: null }),
      routes: { "POST /tickets/:id/analyze": { aiAnalysis: analysis } },
    });

    await userEvent.click(await screen.findByRole("button", { name: "Analyze" }));
    await waitFor(() => expect(server.callsTo("POST", "/tickets/tk1/analyze")).toHaveLength(1));
  });

  it("explains when the AI isn't configured", async () => {
    setup({ config: { ...TEST_CONFIG, aiEnabled: false }, ticket: makeTicket({ aiAnalysis: null }) });
    expect(await screen.findByText(/isn't configured on this server/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Analyze" })).not.toBeInTheDocument();
  });

  it("offers no retry when Groq rejects the server's key or model", async () => {
    const message =
      "Groq rejected the AI Copilot's API key or model. Ask an administrator to check GROQ_API_KEY and GROQ_MODEL on the server.";
    setup({
      ticket: makeTicket({ aiAnalysis: null }),
      routes: { "POST /tickets/:id/analyze": () => reply(503, { code: "AI_MISCONFIGURED", message }) },
    });

    await userEvent.click(await screen.findByRole("button", { name: "Analyze" }));
    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
  });

  it("offers a retry when the Copilot is only busy", async () => {
    const message = "The AI Copilot is busy right now (Groq's rate limit was reached). Try again in a minute.";
    const { server } = setup({
      ticket: makeTicket({ aiAnalysis: null }),
      routes: { "POST /tickets/:id/analyze": () => reply(503, { code: "AI_RATE_LIMITED", message }) },
    });

    await userEvent.click(await screen.findByRole("button", { name: "Analyze" }));
    expect(await screen.findByText(message)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(server.callsTo("POST", "/tickets/tk1/analyze")).toHaveLength(2));
  });
});
