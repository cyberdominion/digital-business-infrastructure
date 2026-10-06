import { z } from 'zod';

/**
 * Environment validation shared by every Supabase client variant.
 *
 * Kept free of any framework imports so the database package itself stays
 * framework-agnostic. The Next.js-specific request client lives in
 * apps/web/src/lib/supabase/server.ts because that is where `next/headers`
 * exists.
 */

export const serverEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url().min(1),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function readServerEnv(): ServerEnv {
  const parsed = serverEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  });

  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid Supabase configuration — ${detail}`);
  }

  return parsed.data;
}
