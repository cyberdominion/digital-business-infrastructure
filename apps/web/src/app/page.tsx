import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Digital Business Infrastructure',
  description:
    'One operating environment for your business: website, CRM, AI, payments, analytics and automation.',
};

export default function HomePage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-border px-5 py-4 sm:px-8 sm:py-5">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          Atlas Digital Business
        </Link>
      </header>

      <main className="mx-auto grid w-full max-w-5xl gap-16 px-5 py-16 sm:px-8 sm:py-24">
        <section className="space-y-5">
          <h1 className="text-4xl font-semibold tracking-tight text-surface-900 sm:text-5xl">
            The digital operating infrastructure for your business.
          </h1>
          <p className="max-w-2xl text-lg text-muted-foreground">
            Website, CRM, AI lead intelligence, payments, orders and analytics on one platform —
            built for Nigerian businesses and the teams that serve them.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <ButtonGetStarted />
          </div>
        </section>

        <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <LandingCard
            title="Multi-tenant by design"
            description="One codebase, hundreds of businesses. Row-level security isolates every tenant."
          />
          <LandingCard
            title="Deterministic AI lead scoring"
            description="Scores you can explain. No LLM guesswork — weighted signals first, interpretation second."
          />
          <LandingCard
            title="Paystack-native payments"
            description="Webhook-verified, idempotent payments with HMAC SHA-512 signature checks."
          />
        </section>

        <section className="border-t border-border pt-10 text-xs text-muted-foreground">
          <p>
            Developed following the Digital Business Infrastructure PRD (v3.0). Sprint 0 ships
            authentication, multi-tenancy, RBAC and the premium dashboard shell.
          </p>
        </section>
      </main>
    </div>
  );
}

function LandingCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex h-full flex-col gap-3 rounded-lg border border-border bg-card p-5">
      <p className="text-sm font-semibold text-surface-900">{title}</p>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function ButtonGetStarted() {
  return (
    <Link
      href="/login"
      className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-brand-700"
    >
      Get started
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        className="size-4 stroke-current"
        fill="none"
        strokeWidth={2}
      >
        <path d="M5 12h14M13 6l6 6-6 6" />
      </svg>
    </Link>
  );
}
