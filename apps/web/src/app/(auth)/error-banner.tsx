import { use } from 'react';
import { Alert } from '@dbi/ui';

const messages: Record<string, string> = {
  invalid: 'Please check your email and password and try again.',
  credentials: 'Those credentials were not recognised.',
  signup_failed: 'We could not create that account.',
  registered: 'Check your email to confirm your account, then sign in.',
};

export function ErrorBanner({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; registered?: string }>;
}) {
  const params = use(searchParams);
  const key = params.error ?? (params.registered ? 'registered' : '');
  const message = key ? messages[key] : null;
  if (!message) return null;

  return (
    <Alert tone={key === 'credentials' ? 'danger' : 'info'} title={message}>
      {message}
    </Alert>
  );
}
