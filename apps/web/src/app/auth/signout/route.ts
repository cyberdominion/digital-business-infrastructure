import { redirect } from 'next/navigation';

import { createRequestClient } from '@/lib/supabase/server';

export async function POST(): Promise<Response> {
  const supabase = await createRequestClient();
  await supabase.auth.signOut();
  // Revoke the session, then send the visitor back to the sign-in screen.
  redirect('/login');
}

export async function GET(): Promise<Response> {
  redirect('/login');
}
