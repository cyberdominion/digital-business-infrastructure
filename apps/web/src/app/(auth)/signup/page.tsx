import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';

import { Alert, Button, Field, Input } from '@dbi/ui';

import { signUp } from '../actions';
import { ErrorBanner } from '../error-banner';

export const metadata: Metadata = { title: 'Create your business' };

type SearchParams = Promise<{ error?: string }>;

export default function SignUpPage(props: { searchParams: SearchParams }) {
  return (
    <>
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Create your business</h1>
        <p className="text-sm text-muted-foreground">Start your 14-day free trial. No card needed.</p>
      </div>

      <Suspense fallback={null}>
        <ErrorBanner searchParams={props.searchParams} />
      </Suspense>

      <form action={signUp} className="space-y-5">
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
            autoComplete="new-password"
            required
            minLength={8}
          />
        </Field>

        <Button type="submit" block size="lg">
          Create account
        </Button>
      </form>

      <div className="text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link
          href="/login"
          className="font-medium text-brand-700 underline-offset-4 hover:underline"
        >
          Sign in
        </Link>
      </div>

      <Alert tone="info">
        After your first sign-up, create your organization from the workspace (or via the{' '}
        <code className="font-mono">create_organization</code> SQL function).
      </Alert>
    </>
  );
}
