import { OAuth2Client } from "google-auth-library";
import { env } from "../config/env.js";

let client = null;

export function isGoogleSignInEnabled() {
  return Boolean(env.GOOGLE_CLIENT_ID);
}

// Verifies a Google ID token (the `credential` string handed to us by
// Google Identity Services' frontend button flow) and returns its
// payload. Throws if the token is malformed, expired, or wasn't issued
// for our own client id (the `audience` check) - callers still need to
// check payload.email_verified themselves, since that's a business rule
// about the account, not a token-validity concern.
export async function verifyGoogleCredential(credential) {
  if (!isGoogleSignInEnabled()) {
    throw new Error("Google sign-in is not configured");
  }
  client ??= new OAuth2Client(env.GOOGLE_CLIENT_ID);

  const ticket = await client.verifyIdToken({
    idToken: credential,
    audience: env.GOOGLE_CLIENT_ID,
  });
  return ticket.getPayload();
}
