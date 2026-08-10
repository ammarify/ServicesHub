// Source of truth for refund decisions - both the human support team and
// the AI Copilot (services/aiAnalysis.service.js) cite section numbers
// from this exact text, so it lives here rather than being duplicated
// into a prompt string somewhere.
export const REFUND_POLICY = `ServiHub Refund Policy (Support Reference)

Section 1 - Cancellations
Refund eligibility for a cancelled booking depends on who initiated the cancellation and when:
  - If ServiHub or the assigned provider cancels the booking (including a no-show - see Section 2) before service was rendered, the customer is entitled to a full refund.
  - If the customer cancels before a provider has been assigned, no refund is owed since no service commitment was made yet.
  - If the customer cancels after a provider has been assigned or dispatched, see Section 5.

Section 2 - Provider No-Show
If a provider fails to arrive within the scheduled window with no communication, and no re-service is arranged within 24 hours, the customer is entitled to a 100% refund of the booking amount.

Section 3 - Provider Delay Beyond 90 Minutes
If a provider arrives more than 90 minutes after the scheduled start time, the customer is entitled to a 50% refund of the booking amount, regardless of whether the service was ultimately completed. Delays under 90 minutes do not qualify for an automatic refund but should be logged against the provider's record.

Section 4 - Incomplete or Unsatisfactory Work
If the customer reports that work was not completed to the agreed scope (e.g. a cleaning job that skipped rooms, a repair that did not resolve the reported issue), the customer is eligible for a refund of up to 70% of the booking amount after review. The exact percentage should reflect how much of the agreed scope was left undone or ineffective: minor cosmetic gaps warrant a lower percentage (10-30%), a substantially incomplete job warrants the higher end (50-70%). A free re-service visit is an acceptable alternative to a refund when the customer is open to it, and should be preferred when the fix is straightforward.

Section 5 - Customer-Fault Cancellations
If the customer cancels after a provider has already been dispatched or has arrived on site, or the customer is unreachable/unavailable at the scheduled time causing the provider to leave, the customer is not entitled to a refund (0%).

Section 6 - Refund Window
Refund requests must be submitted within 7 days of the scheduled service date. Requests made after this window are not eligible for a refund regardless of the underlying issue, except at management's discretion for extenuating circumstances.

General notes for the support copilot:
  - Complaints about a provider's conduct (rudeness, disrespect) are not refund-eligible on their own under this policy - they should be escalated for provider review, not resolved with a refund, unless a separate section also independently applies (e.g. the job was also left incomplete).
  - Pure scheduling requests (e.g. moving an appointment) are not refund matters. refundEligibility.eligible should be false, percent 0, with a reason noting this is a scheduling request rather than a policy citation.
  - Always cite the specific section number your recommendation is based on.`;
