import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { verifyPaystackWebhook } from './webhook.js';
import {
  buildIdempotencyKey,
  classifyPaystackEvent,
  paystackEventSchema,
} from './events.js';

const SECRET = 'whsec_test_secret';
const BODY = JSON.stringify({ event: 'charge.success', data: { id: 1, reference: 'abc' } });

function sign(body: string, secret = SECRET) {
  return createHmac('sha512', secret).update(body).digest('hex');
}

describe('verifyPaystackWebhook', () => {
  it('accepts a correctly signed raw body', () => {
    expect(verifyPaystackWebhook({ signature: sign(BODY), rawBody: BODY, secret: SECRET })).toEqual({
      valid: true,
    });
  });

  it('rejects a tampered body', () => {
    const signature = sign(BODY);
    const tampered = BODY.replace('charge.success', 'charge.failed');
    expect(verifyPaystackWebhook({ signature, rawBody: tampered, secret: SECRET })).toEqual({
      valid: false,
      reason: 'mismatch',
    });
  });

  it('rejects a signature made with a different secret', () => {
    expect(
      verifyPaystackWebhook({ signature: sign(BODY, 'other'), rawBody: BODY, secret: SECRET }),
    ).toEqual({ valid: false, reason: 'mismatch' });
  });

  it('rejects a signature from a different body', () => {
    const other = JSON.stringify({ event: 'charge.success', data: { id: 2, reference: 'xyz' } });
    expect(verifyPaystackWebhook({ signature: sign(other), rawBody: BODY, secret: SECRET })).toEqual({
      valid: false,
      reason: 'mismatch',
    });
  });

  it('reports a missing signature and a missing secret distinctly', () => {
    expect(verifyPaystackWebhook({ signature: null, rawBody: BODY, secret: SECRET })).toEqual({
      valid: false,
      reason: 'missing_signature',
    });
    expect(verifyPaystackWebhook({ signature: sign(BODY), rawBody: BODY, secret: undefined })).toEqual({
      valid: false,
      reason: 'missing_secret',
    });
  });

  it('does not throw on malformed or truncated signatures', () => {
    for (const signature of ['', 'zz', 'a'.repeat(1024)]) {
      expect(() =>
        verifyPaystackWebhook({ signature, rawBody: BODY, secret: SECRET }),
      ).not.toThrow();
    }
  });
});

const sample = {
  event: 'charge.success',
  data: { id: 90210, reference: 'DBI-ORDER-1001', amount: 182_500, currency: 'NGN' },
};

describe('paystack event handling', () => {
  it('validates the payload shape', () => {
    expect(paystackEventSchema.safeParse(sample).success).toBe(true);
    expect(paystackEventSchema.safeParse({ event: 'charge.success' }).success).toBe(false);
    expect(
      paystackEventSchema.safeParse({ event: 'charge.success', data: { id: 'x', reference: 'y' } })
        .success,
    ).toBe(false);
  });

  it('classifies success, failure, and ignorable events', () => {
    expect(classifyPaystackEvent(paystackEventSchema.parse(sample))).toBe('succeeded');
    expect(
      classifyPaystackEvent(paystackEventSchema.parse({ ...sample, event: 'charge.failed' })),
    ).toBe('failed');
    expect(
      classifyPaystackEvent(
        paystackEventSchema.parse({ ...sample, event: 'customer.created' }),
      ),
    ).toBe('ignored');
  });

  it('produces a stable idempotency key across retries of the same event', () => {
    const first = paystackEventSchema.parse(sample);
    const retried = paystackEventSchema.parse(JSON.parse(JSON.stringify(sample)));
    expect(buildIdempotencyKey(first)).toBe(buildIdempotencyKey(retried));
  });

  it('produces different keys for different transactions', () => {
    const a = paystackEventSchema.parse(sample);
    const b = paystackEventSchema.parse({ ...sample, data: { ...sample.data, id: 90211 } });
    expect(buildIdempotencyKey(a)).not.toBe(buildIdempotencyKey(b));
  });

  it('produces different keys when the same transaction reports two outcomes', () => {
    const a = paystackEventSchema.parse(sample);
    const b = paystackEventSchema.parse({ ...sample, event: 'charge.failed' });
    expect(buildIdempotencyKey(a)).not.toBe(buildIdempotencyKey(b));
  });
});