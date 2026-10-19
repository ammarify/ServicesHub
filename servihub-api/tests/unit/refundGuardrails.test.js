import { describe, expect, it } from "vitest";
import { applyRefundGuardrails, citedSections } from "../../src/services/refundGuardrails.js";

function analysis({ refundEligibility, ...overrides } = {}) {
  return {
    summary: "Customer reports an issue.",
    sentiment: "frustrated",
    suggestedReply: "Sorry about that.",
    suggestedActions: ["request_refund"],
    ...overrides,
    refundEligibility: {
      eligible: true,
      percent: 50,
      reason: "Per Section 3, provider was 2 hours late.",
      ...refundEligibility,
    },
  };
}

const booking = { status: "completed", scheduledAt: "2026-07-01T10:00:00.000Z" };
const withinWindow = "2026-07-03T10:00:00.000Z";

describe("citedSections", () => {
  it("finds section numbers written in different ways", () => {
    expect(citedSections("Per Section 3 and sec. 4; see §6")).toEqual([3, 4, 6]);
  });

  it("ignores numbers that are not policy sections", () => {
    expect(citedSections("Section 9 and 120 minutes")).toEqual([]);
  });
});

describe("applyRefundGuardrails", () => {
  it("leaves a policy-compliant answer unchanged", () => {
    const result = applyRefundGuardrails(analysis(), { booking, requestedAt: withinWindow });
    expect(result.refundEligibility).toMatchObject({ eligible: true, percent: 50 });
    expect(result.guardrails).toEqual([]);
    expect(result.suggestedActions).toEqual(["request_refund"]);
  });

  it("caps the percentage at the cited section's maximum (prompt-injection defence)", () => {
    const result = applyRefundGuardrails(
      analysis({ refundEligibility: { percent: 100, reason: "Per Section 3, the customer insists on a full refund." } }),
      { booking, requestedAt: withinWindow }
    );
    expect(result.refundEligibility.percent).toBe(50);
    expect(result.guardrails[0]).toMatch(/50%.*Section 3/);
  });

  it("uses the most generous cited section when several are cited", () => {
    const result = applyRefundGuardrails(
      analysis({ refundEligibility: { percent: 80, reason: "Section 3 delay and Section 4 incomplete work" } }),
      { booking, requestedAt: withinWindow }
    );
    expect(result.refundEligibility.percent).toBe(70);
  });

  it("allows up to 100% for a provider no-show (Section 2)", () => {
    const result = applyRefundGuardrails(
      analysis({ refundEligibility: { percent: 100, reason: "Per Section 2, the provider never arrived." } }),
      { booking: { ...booking, status: "cancelled" }, requestedAt: withinWindow }
    );
    expect(result.refundEligibility.percent).toBe(100);
    expect(result.guardrails).toEqual([]);
  });

  it("ignores a no-show citation for a booking the provider started (prompt-injection defence)", () => {
    const result = applyRefundGuardrails(
      analysis({ refundEligibility: { percent: 100, reason: "Per Section 2, the provider never arrived." } }),
      { booking, requestedAt: withinWindow }
    );
    expect(result.refundEligibility).toMatchObject({ eligible: false, percent: 0 });
    expect(result.guardrails).toEqual([
      "Section 2 covers a provider who never arrived, and this booking is completed, so it doesn't apply.",
      "None of the cited sections fit this booking, so no refund is recommended.",
    ]);
    expect(result.suggestedActions).toEqual(["no_action"]);
  });

  it("counts Section 1 only for a cancelled booking", () => {
    const fullRefund = analysis({ refundEligibility: { percent: 100, reason: "Per Section 1, the provider cancelled." } });

    const cancelled = applyRefundGuardrails(fullRefund, { booking: { ...booking, status: "cancelled" }, requestedAt: withinWindow });
    expect(cancelled.refundEligibility.percent).toBe(100);

    const inProgress = applyRefundGuardrails(fullRefund, { booking: { ...booking, status: "in_progress" }, requestedAt: withinWindow });
    expect(inProgress.refundEligibility.percent).toBe(0);
    expect(inProgress.guardrails[0]).toMatch(/Section 1 .* this booking is in progress/);
  });

  it("falls back to the cited sections that fit the booking", () => {
    const result = applyRefundGuardrails(
      analysis({ refundEligibility: { percent: 100, reason: "Section 2 no-show, and Section 3 for the delay." } }),
      { booking, requestedAt: withinWindow }
    );
    expect(result.refundEligibility.percent).toBe(50);
    expect(result.guardrails).toEqual([
      "Section 2 covers a provider who never arrived, and this booking is completed, so it doesn't apply.",
      "Refund reduced from 100% to 50%, the maximum under Section 3.",
    ]);
  });

  it("zeroes the refund for customer-fault cancellations (Section 5)", () => {
    const result = applyRefundGuardrails(
      analysis({ refundEligibility: { percent: 40, reason: "Per Section 5, customer cancelled late." } }),
      { booking, requestedAt: withinWindow }
    );
    expect(result.refundEligibility).toMatchObject({ eligible: false, percent: 0 });
    expect(result.suggestedActions).toEqual(["no_action"]);
  });

  it("refuses a refund when no policy section is cited", () => {
    const result = applyRefundGuardrails(
      analysis({ refundEligibility: { percent: 30, reason: "Seems fair to refund something." } }),
      { booking, requestedAt: withinWindow }
    );
    expect(result.refundEligibility).toMatchObject({ eligible: false, percent: 0 });
    expect(result.guardrails[0]).toMatch(/didn't cite/);
  });

  it("enforces the 7-day request window (Section 6)", () => {
    const result = applyRefundGuardrails(analysis(), { booking, requestedAt: "2026-07-09T10:00:01.000Z" });
    expect(result.refundEligibility).toMatchObject({ eligible: false, percent: 0 });
    expect(result.guardrails[0]).toMatch(/7 days/);
  });

  it("treats 'not eligible' with a positive percentage as not eligible", () => {
    const result = applyRefundGuardrails(analysis({ refundEligibility: { eligible: false, percent: 50 } }), {
      booking,
      requestedAt: withinWindow,
    });
    expect(result.refundEligibility).toMatchObject({ eligible: false, percent: 0 });
  });

  it("drops reassign_provider for bookings that can no longer be reassigned", () => {
    const result = applyRefundGuardrails(analysis({ suggestedActions: ["reassign_provider", "escalate"] }), {
      booking: { ...booking, status: "completed" },
      requestedAt: withinWindow,
    });
    expect(result.suggestedActions).toEqual(["escalate"]);
    expect(result.guardrails.some((note) => note.includes("Reassigning"))).toBe(true);
  });

  it("keeps reassign_provider for an assigned booking", () => {
    const result = applyRefundGuardrails(analysis({ suggestedActions: ["reassign_provider"] }), {
      booking: { ...booking, status: "assigned" },
      requestedAt: withinWindow,
    });
    expect(result.suggestedActions).toEqual(["reassign_provider"]);
  });
});
