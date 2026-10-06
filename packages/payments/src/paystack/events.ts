import { z } from 'zod';

const paystackDataSchema = z.object({
  id: z.number().int(),
  reference: z.string().min(1),
  amount: z.number().int().nonnegative(),
  currency: z.string().default('NGN'),
  status: z.string().default('success'),
  paid_at: z.union([z.string(), z.null()]).optional(),
  channel: z.string().nullish(),
  customer: z
    .object({
      id: z.number().int().optional(),
      email: z.string().nullish(),
      phone_number: z.string().nullish(),
    })
    .nullish(),
  metadata: z.record(z.string(), z.unknown()).nullish(),
});

export const paystackEventSchema = z.object({
  event: z.string().min(1),
  data: paystackDataSchema,
});

export type PaystackEvent = z.infer<typeof paystackEventSchema>;
export type PaystackEventName = PaystackEvent['event'];

/** Events that should move a payment to a paid state. */
export const PAYMENT_SUCCESS_EVENTS: ReadonlySet<string> = new Set([
  'charge.success',
  'payment_channel.success',
]);

export const PAYMENT_FAILURE_EVENTS: ReadonlySet<string> = new Set(['charge.failed']);

/**
 * Stable dedupe key for a webhook delivery.
 *
 * Paystack retries deliveries and exposes resend tooling, so the same logical
 * event can arrive several times. Keying on event name + transaction id +
 * reference collapses those retries into one processed row, making webhook
 * handling idempotent (PRD Sprint 8).
 */
export function buildIdempotencyKey(event: PaystackEvent): string {
  return `${event.event}:${event.data.id}:${event.data.reference}`;
}

export function classifyPaystackEvent(event: PaystackEvent): 'succeeded' | 'failed' | 'ignored' {
  if (PAYMENT_SUCCESS_EVENTS.has(event.event)) return 'succeeded';
  if (PAYMENT_FAILURE_EVENTS.has(event.event)) return 'failed';
  return 'ignored';
}