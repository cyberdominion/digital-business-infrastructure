import type { ReactNode } from 'react';
import Link from 'next/link';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="flex items-center justify-center px-6 py-12 sm:px-10">
        <div className="w-full max-w-sm space-y-8">{children}</div>
      </div>

      <aside className="hidden flex-col justify-between border-l border-border bg-surface-50 p-12 lg:flex">
        <Link href="/" className="text-sm font-semibold tracking-tight">
          Atlas Digital Business
        </Link>

        <div className="max-w-md space-y-6">
          <h2 className="text-3xl font-semibold leading-tight tracking-tight text-surface-900">
            One operating environment for your whole business.
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Website, CRM, AI sales intelligence, payments, orders and analytics — connected, and
            isolated per business.
          </p>
        </div>

        <p className="text-xs text-muted-foreground">
          Digital Business Infrastructure · Built for Nigerian businesses
        </p>
      </aside>
    </div>
  );
}