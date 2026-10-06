import type { Metadata } from 'next';
import Link from 'next/link';

import { Badge, Button, Card, CardContent, EmptyState, Input } from '@dbi/ui';
import { UserPlus } from 'lucide-react';

import { getSupabase, requireWorkspaceContext } from '@/lib/session';

export const metadata: Metadata = { title: 'Leads' };

function gradeTone(grade: string): 'brand' | 'info' | 'neutral' | 'danger' {
  if (grade === 'A+' || grade === 'A') return 'brand';
  if (grade === 'B') return 'info';
  if (grade === 'D') return 'danger';
  return 'neutral';
}

export default async function LeadsPage() {
  const context = await requireWorkspaceContext();
  const supabase = await getSupabase();

  const { data: leads, error } = await supabase
    .from('leads')
    .select('id, name, email, phone, source, status, score, grade, created_at')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    throw new Error(`Failed to load leads: ${error.message}`);
  }

  const rows = leads ?? [];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Leads</h1>
          <p className="text-sm text-muted-foreground">
            Scored and prioritised for {context.organizationName}.
          </p>
        </div>
        <Button>
          <UserPlus aria-hidden />
          Add lead
        </Button>
      </header>

      <Card>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <div className="p-5">
              <EmptyState
                title="You don't have any leads yet."
                description="Leads arrive from your website, WhatsApp, Instagram and referrals. Add one manually to get started."
                icon={<UserPlus className="size-6" />}
                action={
                  <Button size="sm">
                    <UserPlus aria-hidden />
                    Capture your first lead
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[46rem] text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th scope="col" className="px-5 py-3 font-medium">Name</th>
                    <th scope="col" className="px-5 py-3 font-medium">Source</th>
                    <th scope="col" className="px-5 py-3 font-medium">Status</th>
                    <th scope="col" className="px-5 py-3 font-medium">Score</th>
                    <th scope="col" className="px-5 py-3 font-medium">Grade</th>
                    <th scope="col" className="px-5 py-3 font-medium">Contact</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((lead) => (
                    <tr key={lead.id} className="transition-colors hover:bg-surface-50">
                      <td className="px-5 py-3 font-medium text-surface-900">
                        <Link href={`/workspace/leads/${lead.id}`} className="hover:underline">
                          {lead.name}
                        </Link>
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">{lead.source ?? '—'}</td>
                      <td className="px-5 py-3 text-muted-foreground">
                        {lead.status?.replace(/_/g, ' ') ?? '—'}
                      </td>
                      <td className="px-5 py-3 tabular-nums">{lead.score ?? '—'}</td>
                      <td className="px-5 py-3">
                        <Badge tone={gradeTone(lead.grade ?? 'D')}>{lead.grade ?? '—'}</Badge>
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">
                        {lead.email ?? lead.phone ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 p-5">
          <Input type="search" placeholder="Search leads by name, email or company" aria-label="Search leads" />
        </CardContent>
      </Card>
    </div>
  );
}