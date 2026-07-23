import { createHmac, timingSafeEqual } from "crypto";

/**
 * Lets a guest (no account, no login) manage a single appointment from a
 * link in their confirmation email/SMS, without a real auth system for
 * them. The token is an HMAC of the appointment id — nothing to store, and
 * it can't be forged without SUPABASE_SERVICE_ROLE_KEY-level access to this
 * server's env, but it's still scoped to exactly one appointment.
 */
function getSecret(): string {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("Missing secret for manage tokens");
  return secret;
}

export function generateManageToken(appointmentId: string): string {
  return createHmac("sha256", getSecret()).update(appointmentId).digest("hex").slice(0, 32);
}

export function verifyManageToken(appointmentId: string, token: string): boolean {
  const expected = generateManageToken(appointmentId);
  const expectedBuf = Buffer.from(expected);
  const tokenBuf = Buffer.from(token);
  if (expectedBuf.length !== tokenBuf.length) return false;
  return timingSafeEqual(expectedBuf, tokenBuf);
}

export function buildManageUrl(appointmentId: string): string {
  const token = generateManageToken(appointmentId);
  return `https://book.bighitbarbershop.com/manage/${appointmentId}?token=${token}`;
}
