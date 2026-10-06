import { createHmac, timingSafeEqual } from 'node:crypto';

export interface VerifyWebhookOptions {
  /** The `x-paystack-signature` request header. */
  signature: string | null | undefined;
  /** The exact raw request body, unparsed. Re-serialising breaks the HMAC. */
  rawBody: string;
  /** `PAYSTACK_WEBHOOK_SECRET`. */
  secret: string | undefined;
}

export type VerifyWebhookResult =
  | { valid: true }
  | { valid: false; reason: 'missing_signature' | 'missing_secret' | 'mismatch' };

/**
 * Verify a Paystack webhook signature.
 *
 * Paystack signs the raw body with HMAC SHA512 using the webhook secret and
 * sends the hex digest in `x-paystack-signature`. Verification is mandatory:
 * without it, anyone who learns the endpoint URL can post fabricated
 * "payment succeeded" events and mark unpaid orders as paid (PRD 22).
 *
 * Comparison is constant-time, and the body must be the exact bytes received —
 * `JSON.parse` then `JSON.stringify` will not round-trip and will fail.
 */
export function verifyPaystackWebhook({
  signature,
  rawBody,
  secret,
}: VerifyWebhookOptions): VerifyWebhookResult {
  if (!secret) return { valid: false, reason: 'missing_secret' };
  if (!signature) return { valid: false, reason: 'missing_signature' };

  const expected = createHmac('sha512', secret).update(rawBody).digest('hex');

  const provided = Buffer.from(signature, 'utf8');
  const computed = Buffer.from(expected, 'utf8');

  if (provided.length !== computed.length) {
    return { valid: false, reason: 'mismatch' };
  }
  if (!timingSafeEqual(provided, computed)) {
    return { valid: false, reason: 'mismatch' };
  }

  return { valid: true };
}