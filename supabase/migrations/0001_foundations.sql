-- ===========================================================================
-- 0001 — Foundations
-- Digital Business Infrastructure Platform
--
-- Extensions, enums, and the helper functions every row level security policy
-- depends on. Tenant isolation (PRD 7) is enforced from here outward.
-- ===========================================================================

create extension if not exists "pgcrypto";
create extension if not exists "pgvector";

-- ---------------------------------------------------------------------------
-- Helper functions live in a dedicated schema so they are not part of the
-- public API surface exposed through PostgREST.
-- ---------------------------------------------------------------------------
create schema if not exists app;

-- ---------------------------------------------------------------------------
-- Enums mirroring packages/database/src/types.ts
-- ---------------------------------------------------------------------------

do $$ begin
  create type public.business_type as enum (
    'fashion', 'restaurant', 'real_estate', 'professional_services',
    'retail', 'beauty', 'electronics', 'agriculture', 'manufacturing', 'other'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.organization_status as enum ('pending', 'active', 'suspended', 'closed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.subscription_status as enum (
    'trialing', 'active', 'past_due', 'paused', 'cancelled', 'expired'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.role_name as enum (
    'platform_admin',
    'platform_support',
    'organization_owner',
    'organization_admin',
    'sales_manager',
    'sales_representative',
    'support_agent',
    'read_only'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.role_scope as enum ('platform', 'organization');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.lead_status as enum (
    'new', 'contacted', 'warm', 'hot', 'qualified',
    'proposal', 'negotiation', 'won', 'customer', 'lost'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.lead_source as enum (
    'website', 'whatsapp', 'instagram', 'facebook', 'tiktok',
    'referral', 'google', 'advertisement', 'manual', 'api'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.lead_grade as enum ('A+', 'A', 'B', 'C', 'D');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.order_status as enum (
    'pending', 'paid', 'confirmed', 'processing', 'fulfilled',
    'ready', 'delivered', 'completed', 'cancelled', 'refunded'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_status as enum (
    'pending', 'processing', 'success', 'failed', 'reversed', 'refunded', 'partially_refunded'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_provider as enum ('paystack', 'flutterwave', 'stripe', 'bank_transfer');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.plan_code as enum ('starter', 'growth', 'professional', 'enterprise');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.task_status as enum ('pending', 'in_progress', 'completed', 'overdue', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.conversation_channel as enum ('whatsapp', 'web', 'email', 'sms', 'phone');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.referral_status as enum (
    'pending', 'applied', 'qualified', 'converted', 'rejected'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.notification_channel as enum ('in_app', 'email', 'whatsapp', 'sms');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Current-tenant resolution
--
-- Every tenant-scoped policy funnels through app.current_organization_ids().
-- Deriving membership from organization_members — rather than from a claim or a
-- client-supplied value — is what makes a forged request useless.
-- ---------------------------------------------------------------------------

create or replace function app.current_user_id()
returns uuid
language sql
stable
as $$
  select auth.uid();
$$;

create or replace function app.is_platform_staff()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.organization_members m
    join public.roles r on r.id = m.role_id
    where m.user_id = auth.uid()
      and r.scope = 'platform'
      and m.status = 'active'
  );
$$;

create or replace function app.current_organization_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public, auth
as $$
  select m.organization_id
  from public.organization_members m
  where m.user_id = auth.uid()
    and m.status = 'active';
$$;

create or replace function app.in_current_organization(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.organization_members m
    where m.organization_id = target
      and m.user_id = auth.uid()
      and m.status = 'active'
  );
$$;

create or replace function app.has_permission(permission_key text, target uuid default null)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.organization_members m
    join public.roles r on r.id = m.role_id
    join public.role_permissions rp on rp.role_id = r.id
    join public.permissions p on p.id = rp.permission_id
    where m.user_id = auth.uid()
      and m.status = 'active'
      and p.key = permission_key
      and (target is null or m.organization_id = target)
  );
$$;

-- Grants one tenant lead access, so it can never see another tenant's pipeline.
-- Returns true when the lead belongs to the caller.
create or replace function app.owns_lead(target_lead uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.leads l
    where l.id = target_lead
      and app.in_current_organization(l.organization_id)
  );
$$;

create or replace function app.is_assigned_lead(target_lead uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.leads l
    where l.id = target_lead
      and app.in_current_organization(l.organization_id)
      and l.assigned_to = auth.uid()
  );
$$;

-- Trigger helper: stamp updated_at on every tenant-owned table so the column
-- stays honest even when a write bypasses the application layer.
create or replace function app.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

grant usage on schema app to anon, authenticated, service_role;
grant execute on all functions in schema app to anon, authenticated, service_role;