import { env, isProduction } from "../config/env.js";

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const SEND_TIMEOUT_MS = 10_000;

// In tests nothing leaves the process; messages are collected here instead
// so suites can read the reset/invite links they contain.
export const testOutbox = [];

export function isEmailConfigured() {
  return Boolean(env.RESEND_API_KEY);
}

// Sends through Resend (https://resend.com) when RESEND_API_KEY is set.
// Without it, development logs the message (including its link) to the
// console so password reset and invites stay usable locally; production
// just reports that nothing was delivered.
export async function sendEmail({ to, subject, text, html }) {
  if (env.NODE_ENV === "test") {
    testOutbox.push({ to, subject, text, html });
    return { delivered: true };
  }

  if (!env.RESEND_API_KEY) {
    if (!isProduction) {
      console.info(`\n[email] RESEND_API_KEY is not set - not sent. Contents:\nTo: ${to}\nSubject: ${subject}\n\n${text}\n`);
    }
    return { delivered: false };
  }

  const response = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: env.EMAIL_FROM, to: [to], subject, text, html }),
    signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Email provider responded ${response.status}: ${detail.slice(0, 300)}`);
  }

  return { delivered: true };
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function layout({ heading, intro, buttonLabel, link, footnote }) {
  const safeLink = escapeHtml(link);
  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f7f7f8;font-family:Inter,Segoe UI,Arial,sans-serif;color:#18181b;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:480px;margin:0 auto;background:#ffffff;border:1px solid #e4e4e7;border-radius:8px;">
      <tr><td style="padding:28px;">
        <div style="font-size:15px;font-weight:600;">ServiHub</div>
        <h1 style="margin:20px 0 8px;font-size:20px;font-weight:600;">${escapeHtml(heading)}</h1>
        <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#3f3f46;">${escapeHtml(intro)}</p>
        <a href="${safeLink}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-size:14px;font-weight:500;padding:9px 16px;border-radius:6px;">${escapeHtml(buttonLabel)}</a>
        <p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:#71717a;">${escapeHtml(footnote)}</p>
        <p style="margin:12px 0 0;font-size:12px;line-height:1.6;color:#71717a;word-break:break-all;">${safeLink}</p>
      </td></tr>
    </table>
  </body>
</html>`;
  const text = `${heading}\n\n${intro}\n\n${buttonLabel}: ${link}\n\n${footnote}`;
  return { html, text };
}

export function passwordResetEmail({ name, link }) {
  return {
    subject: "Reset your ServiHub password",
    ...layout({
      heading: "Reset your password",
      intro: `Hi ${name}, we received a request to reset the password for your ServiHub account.`,
      buttonLabel: "Choose a new password",
      link,
      footnote: "This link expires in 1 hour and can be used once. If you didn't ask for a reset, you can ignore this email.",
    }),
  };
}

export function inviteEmail({ name, inviterName, link }) {
  return {
    subject: "You've been invited to ServiHub",
    ...layout({
      heading: "Welcome to ServiHub",
      intro: `Hi ${name}, ${inviterName} added you to the ServiHub operations team. Choose a password to activate your account.`,
      buttonLabel: "Set up your account",
      link,
      footnote: "This invitation link expires in 7 days and can be used once.",
    }),
  };
}
