import { redirect } from 'next/navigation';
import Link from 'next/link';
import {
  BarChart3,
  CreditCard,
  LayoutDashboard,
  LifeBuoy,
  Package,
  Settings,
  ShoppingCart,
  Sparkles,
  Users,
  Wallet,
} from 'lucide-react';
import type { ReactNode } from 'react';

import { Badge, Button } from '@dbi/ui';

import { requireWorkspace } from '@/lib/session';

const NAV = [
  { href: '/workspace', label: 'Dashboard', icon: LayoutDashboard, module: null },
  { href: '/workspace/leads', label: 'Leads', icon: Users, module: 'crm' },
  { href: '/workspace/customers', label: 'Customers', icon: Users, module: 'crm' },
  { href: '/workspace/products', label: 'Products', icon: Package, module: 'inventory' },
  { href: '/workspace/orders', label: 'Orders', icon: ShoppingCart, module: 'orders' },
  { href: '/workspace/payments', label: 'Payments', icon: Wallet, module: 'payments' },
  { href: '/workspace/analytics', label: 'Analytics', icon: BarChart3, module: 'analytics' },
  { href: '/workspace/ai', label: 'AI', icon: Sparkles, module: 'ai_sales' },
  { href: '/workspace/referrals', label: 'Referrals', icon: CreditCard, module: 'referrals' },
  { href: '/workspace/support', label: 'Support', icon: LifeBuoy, module: null },
  { href: '/workspace/settings', label: 'Settings', icon: Settings, module: null },
] as const;

export default async function WorkspaceLayout({ children }: { children: ReactNode }) {
  const context = await requireWorkspace();

  if (!context) {
    redirect('/login');
  }

  const visibleNav = NAV.filter((item) => item.module === null || context.modules[item.module]);

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <aside className="flex flex-col gap-6 border-b border-border bg-surface-50 p-4 lg:h-dvh lg:w-64 lg:shrink-0 lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between gap-2 px-2 pt-1">
          <Link href="/workspace" className="min-w-0">
            <p className="truncate text-sm font-semibold tracking-tight">
              {context.organizationName}
            </p>
            <p className="truncate text-2xs text-muted-foreground">
              {context.organizationSlug}
            </p>
          </Link>
          <Badge tone="brand">{context.role.replace(/_/g, ' ')}</Badge>
        </div>

        <nav className="flex-1 overflow-y-auto">
          <ul className="space-y-0.5">
            {visibleNav.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-surface-700 transition-colors hover:bg-surface-100 hover:text-surface-900"
                >
                  <item.icon className="size-4 shrink-0 text-surface-400" aria-hidden />
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="space-y-3 border-t border-border pt-4">
          <p className="truncate px-2 text-xs text-muted-foreground">{context.email}</p>
          <form action="/auth/signout" method="post">
            <Button type="submit" variant="secondary" size="sm" block>
              Sign out
            </Button>
          </form>
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-5 py-6 sm:px-8 sm:py-8">{children}</main>
    </div>
  );
}