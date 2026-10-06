import 'server-only';

import { cache } from 'react';
import { redirect } from 'next/navigation';

import type { Permission, Role } from '@dbi/database';
import { DEFAULT_ROLE_PERMISSIONS } from '@dbi/auth';

import { createRequestClient, type RequestClient } from '@/lib/supabase/server';

/**
 * Server-side session and tenancy resolution.
 *
 * Everything privileged in the app funnels through here. Roles are read from
 * `organization_members` on every request — never from a cookie the client can
 * rewrite, never from a JWT custom claim, and never from `profiles.role`
 * (PRD 5.7).
 */

export interface WorkspaceContext {
  userId: string;
  email: string | null;
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  role: Role;
  permissions: readonly Permission[];
  modules: Record<string, boolean>;
}

export async function getSupabase(): Promise<RequestClient> {
  return createRequestClient();
}

/**
 * Return the authenticated user, or null.
 *
 * Uses `getUser()` rather than `getSession()`: only `getUser()` revalidates the
 * JWT with the auth server, so a revoked or forged session cookie cannot pass
 * this gate.
 */
export async function requireUser(): Promise<{ id: string; email: string | null }> {
  const supabase = await getSupabase();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect('/login');
  }

  return { id: user.id, email: user.email ?? null };
}

/**
 * Resolve the caller's workspace.
 *
 * `cache()` deduplicates this across a single render pass, so the layout and
 * every page underneath share one round trip.
 */
export const requireWorkspace = cache(async (): Promise<WorkspaceContext | null> => {
  const supabase = await getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: membership, error: membershipError } = await supabase
    .from('organization_members')
    .select('role, organizations (id, business_name, slug, modules, status)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (membershipError || !membership) return null;

  const organization = Array.isArray(membership.organizations)
    ? membership.organizations[0]
    : membership.organizations;

  if (!organization) return null;
  if (organization.status === 'suspended' || organization.status === 'closed') return null;

  const role = membership.role as Role;

  return {
    userId: user.id,
    email: user.email ?? null,
    organizationId: organization.id,
    organizationName: organization.business_name,
    organizationSlug: organization.slug,
    role,
    permissions: DEFAULT_ROLE_PERMISSIONS[role] ?? [],
    modules: (organization.modules ?? {}) as Record<string, boolean>,
  };
});

export async function requireWorkspaceContext(): Promise<WorkspaceContext> {
  const context = await requireWorkspace();
  if (!context) {
    redirect('/login');
  }
  return context;
}