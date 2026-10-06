import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';

import { Alert, Button, Field, Input } from '@dbi/ui';

import { signIn } from '../actions';
import { ErrorBanner } from '../error-banner';

export const metadata: Metadata = { title: 'Sign in' };

type SearchParams = Promise<{ error?: string; registered?: string }>;

export default function LoginPage(props: { searchParams: SearchParams }) {
  return (
    <>
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
        <p className="text-sm text-muted-foreground">Access your business workspace.</p>
      </div>

      <Suspense fallback={<p className="text-xs text-muted-foreground">Loading…</p>}>
        <ErrorBanner searchParams={props.searchParams} />
      </Suspense>

      <form action={signIn} className="space-y-5">
        <Field label="Work email" htmlFor="email" required>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@business.ng"
            required
            minLength={3}
          />
        </Field>

        <Field label="Password" htmlFor="password" required>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            minLength={8}
          />
        </Field>

        <Button type="submit" block size="lg">
          Sign in
        </Button>
      </form>

      <div className="space-y-3 text-center">
        <Link
          href="/signup"
          className="text-sm font-medium text-brand-700 underline-offset-4 hover:underline"
        >
          No account yet? Create your business
        </Link>
      </div>

      <Alert tone="info">
        Sprint 0 build: connect Supabase and run <code className="font-mono">pnpm db:reset</code>{' '}
        before signing in.
      </Alert>
    </>
  );
}
