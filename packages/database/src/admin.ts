import 'server-only';

import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

/**
 * Service-role client.
 *
 * SECURITY: the service role key carries the `service_role` Postgres role,
 * which has BYPASSRLS. Every row in every organization is visible to it. Use it
 * only for trusted, unauthenticated server paths, and always re-apply tenant
 * scoping yourself:
 *
 *   - Paystack webhook handling (PRD 22, Sprint 8)
 *   - cron / scheduled jobs
 *   - platform-admin cross-tenant reporting (PRD 37)
 *
 * Every query made with this client must filter or assert an organization_id
 * explicitly. Never return one of these clients to a route handler that a
 * tenant can reach with their own session.
 */
const adminEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});

export type AdminEnv = z.infer<typeof adminEnvSchema>;

export function readAdminEnv(): AdminEnv {
  const parsed = adminEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  });

  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid Supabase admin configuration — ${detail}`);
  }

  return parsed.data;
}

export function createAdminClient(): SupabaseClient {
  const env = readAdminEnv();
  return createSupabaseClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

let cached: SupabaseClient | undefined;

export function getAdminClient(): SupabaseClient {
  cached ??= createAdminClient();
  return cached;
}