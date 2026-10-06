import 'server-only';

import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

import { readServerEnv } from '@dbi/database';

/**
 * Request-scoped Supabase client bound to the caller's session.
 *
 * Lives in the web app because it depends on `next/headers`. Runs as the
 * signed-in user, so row level security is what actually confines queries to
 * one organization (PRD 7). Never swap in the service-role key here — use
 * @dbi/database/admin for the trusted server paths that need it.
 */
export async function createRequestClient() {
  const env = readServerEnv();
  const cookieStore = await cookies();

  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components cannot write cookies; middleware refreshes instead.
        }
      },
    },
  });
}

export type RequestClient = Awaited<ReturnType<typeof createRequestClient>>;