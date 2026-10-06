import type { Metadata } from 'next';

import { Alert, Card, CardContent, CardHeader, CardTitle, EmptyState, StatCard } from '@dbi/ui';
import { Inbox, Sparkles, TrendingUp } from 'lucide-react';

import { getSupabase, requireWorkspaceContext } from '@/lib/session';

export const metadata: Metadata = { title: 'Dashboard' };

function startOfMonth(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
}

export default async function DashboardPage() {
  const context = await requireWorkspaceContext();
  const supabase = await getSupabase();

  const since = startOfMonth();

  const [leads, qualified, customers, orders, payments, highIntent] = await Promise.all([
    supabase
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', since),
    supabase
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .in('status', ['qualified', 'proposal', 'negotiation', 'won']),
    supabase.from('customers').select('id', { count: 'exact', head: true }),
    supabase.from('orders').select('id', { count: 'exact', head: true }).gte('created_at', since),
    supabase
      .from('payments')
      .select('amount')
      .eq('status', 'success')
      .gte('created_at', since),
    supabase
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .gte('score', 80),
  ]);

  const revenue = (payments.data ?? []).reduce((total, row) => total + (row.amount ?? 0), 0);
  const leadCount = leads.count ?? 0;
  const qualifiedCount = qualified.count ?? 0;

  const naira = new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0,
  });
  const compact = new Intl.NumberFormat('en-NG', { notation: 'compact', maximumFractionDigits: 1 });

  const conversionRate =
    leadCount > 0 ? Number(((qualifiedCount / leadCount) * 100).toFixed(1)) : 0;

  const firstName = context.email?.split('@')[0] ?? 'there';

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Good day, {firstName}.</h1>
        <p className="text-sm text-muted-foreground">
          Here is what is happening with {context.organizationName} this month.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Revenue" value={naira.format(revenue)} hint={`Since ${since.slice(0, 10)}`} />
        <StatCard label="New leads" value={compact.format(leadCount)} />
        <StatCard label="Qualified leads" value={compact.format(qualifiedCount)} />
        <StatCard label="Conversion rate" value={`${conversionRate}%`} />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="size-4 text-brand-600" aria-hidden />
              AI business insight
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm leading-relaxed text-surface-700">
              {(highIntent.count ?? 0) > 0
                ? `You have ${highIntent.count} high-intent lead${highIntent.count === 1 ? '' : 's'} scoring above 80. These convert fastest when contacted quickly.`
                : 'No high-intent leads yet. Leads scoring above 80 will appear here automatically.'}
            </p>
            <p className="text-xs text-muted-foreground">
              Insights are generated from deterministic lead scores first; language models interpret
              them, they do not assign them.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="size-4 text-brand-600" aria-hidden />
              Today&apos;s priorities
            </CardTitle>
          </CardHeader>
          <CardContent>
            {leadCount === 0 ? (
              <EmptyState
                title="Nothing needs you right now"
                description="Capture your first lead to start building your pipeline."
                icon={<Inbox className="size-6" />}
              />
            ) : (
              <ul className="space-y-2.5 text-sm text-surface-700">
                <li className="flex gap-2">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand-600" />
                  Follow up with {highIntent.count ?? 0} high-intent lead
                  {(highIntent.count ?? 0) === 1 ? '' : 's'}
                </li>
                <li className="flex gap-2">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-surface-400" />
                  Review {qualifiedCount} qualified lead{qualifiedCount === 1 ? '' : 's'}
                </li>
                <li className="flex gap-2">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-surface-400" />
                  Confirm {orders.count ?? 0} order{(orders.count ?? 0) === 1 ? '' : 's'}
                </li>
              </ul>
            )}
          </CardContent>
        </Card>
      </section>

      <Alert tone="info" title="Sprint 0">
        Multi-tenancy, RLS and RBAC are wired. CRM records, payments and AI scoring land in Sprints
        3, 5 and 8.
      </Alert>
    </div>
  );
}