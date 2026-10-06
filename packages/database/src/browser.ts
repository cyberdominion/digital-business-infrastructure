import { createBrowserClient } from '@supabase/ssr';
import { z } from 'zod';

const browserEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url().min(1),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

export type BrowserEnv = z.infer<typeof browserEnvSchema>;

export function readBrowserEnv(): BrowserEnv {
  const parsed = browserEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });

  if (!parsed.success) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }

  return parsed.data;
}

/**
 * Browser Supabase client. Always anon-key: the browser has no authority of
 * its own, it only carries the user's session (PRD 92).
 */
export function createClient() {
  const env = readBrowserEnv();
  return createBrowserClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export type BrowserClient = ReturnType<typeof createClient>;