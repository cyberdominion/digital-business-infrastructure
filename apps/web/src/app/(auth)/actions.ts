'use server';

import { redirect } from 'next/navigation';

import { createRequestClient } from '@/lib/supabase/server';
import { z } from 'zod';

const credentialsSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
});

export type SignInError = 'invalid' | 'credentials' | 'signup_failed';

export async function signIn(formData: FormData): Promise<void> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });

  if (!parsed.success) {
    redirect('/login?error=invalid');
  }

  const supabase = await createRequestClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    redirect('/login?error=credentials');
  }

  redirect('/workspace');
}

export async function signUp(formData: FormData): Promise<void> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });

  if (!parsed.success) {
    redirect('/signup?error=invalid');
  }

  const supabase = await createRequestClient();
  const { error, data } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    redirect('/signup?error=signup_failed');
  }

  if (data.user && !data.user.email_confirmed_at) {
    redirect('/login?registered=1');
  }

  redirect('/workspace');
}
