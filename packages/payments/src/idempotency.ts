import 'server-only';

import { z } from 'zod';

export interface IdempotentStore {
  /** True when the key was newly claimed, false when it was already seen. */
  claim(key: string): Promise<boolean>;
  release(key: string): Promise<void>;
  complete(key: string): Promise<void>;
}

const paystackSchema = z.object({
  PAYSTACK_SECRET_KEY: z.string().startsWith('sk_'),
});

export function readPaystackEnv(): { secretKey: string } {
  const parsed = paystackSchema.safeParse({ PAYSTACK_SECRET_KEY: process.env.PAYSTACK_SECRET_KEY });
  if (!parsed.success) {
    throw new Error('Missing or malformed PAYSTACK_SECRET_KEY');
  }
  return { secretKey: parsed.data.PAYSTACK_SECRET_KEY };
}

/**
 * Run `handler` at most once per idempotency key.
 *
 * `store.claim` must be an atomic insert-if-absent (a unique primary key on
 * `webhook_events.idempotency_key` gives this for free). A failed handler
 * releases the claim so Paystack's retry can make progress; a successful one
 * marks it complete, so later retries become no-ops.
 */
export async function withIdempotency<T>(
  store: IdempotentStore,
  key: string,
  handler: () => Promise<T>,
): Promise<{ processed: boolean; result?: T }> {
  const claimed = await store.claim(key);
  if (!claimed) {
    return { processed: false };
  }

  try {
    const result = await handler();
    await store.complete(key);
    return { processed: true, result };
  } catch (error) {
    await store.release(key);
    throw error;
  }
}