import Groq from "groq-sdk";
import { z } from "zod";
import { env } from "../config/env.js";
import { REFUND_POLICY } from "../config/refundPolicy.js";

const groq = new Groq({ apiKey: env.GROQ_API_KEY });
const MODEL = "llama-3.3-70b-versatile";

const analysisSchema = z.object({
  summary: z.string().trim().min(1).max(500),
  sentiment: z.enum(["calm", "neutral", "frustrated", "angry"]),
  refundEligibility: z.object({
    eligible: z.boolean(),
    percent: z.number().min(0).max(100),
    reason: z.string().trim().min(1).max(500),
  }),
  suggestedReply: z.string().trim().min(1).max(1200),
  suggestedActions: z
    .array(z.enum(["request_refund", "reassign_provider", "escalate", "no_action"]))
    .min(1)
    .max(3),
});

function buildSystemPrompt() {
  return `You are the support copilot for ServiHub, a home-services marketplace (cleaning, AC repair, plumbing, electrical, pest control, maid service). You help human support agents by analyzing a support ticket and its linked booking, then recommending next steps.

You must strictly follow this refund policy - it is the only source of truth for refund decisions:

${REFUND_POLICY}

Respond with ONLY valid JSON. No markdown, no preamble, no code fences, no commentary before or after the JSON. Match this exact shape:
{
  "summary": string (max 60 words, plain-English summary of the situation),
  "sentiment": one of "calm" | "neutral" | "frustrated" | "angry",
  "refundEligibility": {
    "eligible": boolean,
    "percent": number (0-100, the refund percentage per policy),
    "reason": string (must cite the specific policy section, e.g. "Per Section 3, provider delay...")
  },
  "suggestedReply": string (professional, warm, max 120 words, must not promise anything beyond what the policy allows),
  "suggestedActions": array of 1 to 3 values from "request_refund" | "reassign_provider" | "escalate" | "no_action"
}`;
}

function buildUserPrompt({ ticket, booking, customerSummary }) {
  const messagesText = ticket.messages
    .map((m) => `[${m.from} - ${m.senderName}] ${m.text}`)
    .join("\n");

  const timelineText = (booking?.timeline ?? [])
    .map((t) => `${t.event} at ${new Date(t.at).toISOString()}`)
    .join(", ");

  return `TICKET
Subject: ${ticket.subject}
Priority: ${ticket.priority}
Status: ${ticket.status}

MESSAGES
${messagesText}

LINKED BOOKING
Service: ${booking?.service}
Status: ${booking?.status}
Scheduled: ${booking?.scheduledAt ? new Date(booking.scheduledAt).toISOString() : "unknown"}
Amount: $${booking?.amount}
Timeline: ${timelineText || "none recorded"}

CUSTOMER HISTORY
Total bookings: ${customerSummary.totalBookings}
Prior support tickets: ${customerSummary.priorTicketsCount}

Analyze this ticket and respond with the JSON object described in the system prompt.`;
}

function stripCodeFences(text) {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
}

async function callGroq(messages) {
  const completion = await groq.chat.completions.create({
    model: MODEL,
    messages,
    temperature: 0.3,
  });
  return completion.choices[0]?.message?.content ?? "";
}

function tryParse(raw) {
  const cleaned = stripCodeFences(raw);

  let json;
  try {
    json = JSON.parse(cleaned);
  } catch {
    return { success: false, error: "Response was not valid JSON" };
  }

  const result = analysisSchema.safeParse(json);
  if (!result.success) {
    const error = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ");
    return { success: false, error };
  }

  return { success: true, data: result.data };
}

// Single retry-with-correction: if the model's first response fails to
// parse or fails schema validation, we re-send the conversation with the
// bad output plus a correction instruction, and try once more. Two
// failures in a row means we give up rather than looping - the caller
// turns that into a clean 502 and never lets unvalidated AI output reach
// the client or get persisted.
export async function analyzeTicketWithAI(context) {
  const messages = [
    { role: "system", content: buildSystemPrompt() },
    { role: "user", content: buildUserPrompt(context) },
  ];

  const firstRaw = await callGroq(messages);
  const firstResult = tryParse(firstRaw);
  if (firstResult.success) {
    return { data: firstResult.data, raw: firstRaw };
  }

  messages.push({ role: "assistant", content: firstRaw });
  messages.push({
    role: "user",
    content: `Your previous response could not be used: ${firstResult.error}. Respond again with ONLY the raw JSON object matching the required shape - no markdown, no code fences, no extra text.`,
  });

  const secondRaw = await callGroq(messages);
  const secondResult = tryParse(secondRaw);
  if (secondResult.success) {
    return { data: secondResult.data, raw: secondRaw };
  }

  const error = new Error(`AI analysis failed validation twice: ${secondResult.error}`);
  error.isAnalysisFailure = true;
  error.firstRaw = firstRaw;
  error.secondRaw = secondRaw;
  throw error;
}
