-- ===========================================================================
-- 0002 — Identity, organizations, RBAC
-- PRD 5, 6, 7, 9, 10
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- profiles — mirrors auth.users. Never carries authorization state (PRD 5.7).
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  phone text,
  avatar_url text,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'Display data only. Authority lives in organization_members + role_permissions.';

create trigger profiles_touch_updated_at
before update on public.profiles
for each row execute function app.touch_updated_at();

-- ---------------------------------------------------------------------------
-- roles / permissions / role_permissions
-- The table is the runtime source of truth; packages/auth ships the same matrix
-- as the bootstrapping default and a test asserts the two stay in step.
-- ---------------------------------------------------------------------------
create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  key public.role_name not null unique,
  label text not null,
  scope public.role_scope not null,
  rank smallint not null default 0,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.permissions (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  description text,
  category text not null default 'resource'
);

create table if not exists public.role_permissions (
  role_id uuid not null references public.roles (id) on delete cascade,
  permission_id uuid not null references public.permissions (id) on delete cascade,
  primary key (role_id, permission_id)
);

-- A platform grant must never end up on an organization role (PRD 5.7).
create or replace function public.enforce_role_permission_scope()
returns trigger
language plpgsql
as $$
declare
  role_scope_value public.role_scope;
  permission_key text;
begin
  select r.scope into role_scope_value from public.roles r where r.id = new.role_id;
  select p.key into permission_key from public.permissions p where p.id = new.permission_id;

  if role_scope_value = 'platform' and permission_key not like 'platform.%' then
    raise exception 'Platform role cannot hold organization permission %', permission_key;
  end if;

  if role_scope_value = 'organization' and permission_key like 'platform.%' then
    raise exception 'Organization role cannot hold platform permission %', permission_key;
  end if;

  return new;
end;
$$;

create trigger role_permissions_scope_guard
before insert or update on public.role_permissions
for each row execute function public.enforce_role_permission_scope();

-- ---------------------------------------------------------------------------
-- organizations — the tenant record (PRD 9)
-- ---------------------------------------------------------------------------
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  business_name text not null,
  legal_name text,
  slug text not null unique,
  business_type public.business_type not null default 'other',
  industry text,
  description text,

  logo_url text,
  primary_color text,
  secondary_color text,

  email text,
  phone text,
  address text,
  state text,
  country text not null default 'NG',

  website text,

  status public.organization_status not null default 'active',
  plan public.plan_code not null default 'starter',
  subscription_status public.subscription_status not null default 'trialing',

  -- Module switches (PRD 64). Defaults mirror DEFAULT_MODULES in
  -- packages/database/src/types.ts.
  modules jsonb not null default '{
    "crm": true, "website": false, "domains": false, "hosting": false,
    "payments": false, "orders": false, "inventory": false,
    "ai_sales": false, "automation": false, "whatsapp": false,
    "analytics": true, "referrals": true
  }'::jsonb,

  referred_by uuid references public.organizations (id) on delete set null,
  referral_code text unique,

  trial_ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint organizations_slug_format check (slug ~ '^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$')
);

create index organizations_status_idx on public.organizations (status);
create index organizations_plan_idx on public.organizations (plan);
create index organizations_referred_by_idx on public.organizations (referred_by);
create index organizations_modules_gin on public.organizations using gin (modules);

create trigger organizations_touch_updated_at
before update on public.organizations
for each row execute function app.touch_updated_at();

-- ---------------------------------------------------------------------------
-- organization_members — the tenancy edge and the only authority source
-- ---------------------------------------------------------------------------
create table if not exists public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role_id uuid not null references public.roles (id) on delete restrict,
  status text not null default 'active' check (status in ('invited', 'active', 'suspended')),
  invited_by uuid references public.profiles (id) on delete set null,
  invited_at timestamptz,
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint organization_members_unique unique (organization_id, user_id)
);

create index organization_members_user_idx on public.organization_members (user_id, status);
create index organization_members_org_idx on public.organization_members (organization_id, status);

create trigger organization_members_touch_updated_at
before update on public.organization_members
for each row execute function app.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Convenience view used by the workspace resolver in apps/web/src/lib/session.ts
-- ---------------------------------------------------------------------------
create or replace view public.my_memberships
with (security_invoker = true) as
select
  m.organization_id,
  m.role_id,
  r.key as role_key,
  m.status as membership_status,
  o.business_name,
  o.slug,
  o.status as organization_status,
  o.modules,
  o.plan,
  o.subscription_status
from public.organization_members m
join public.roles r on r.id = m.role_id
join public.organizations o on o.id = m.organization_id
where m.user_id = auth.uid()
  and m.status = 'active';

comment on view public.my_memberships is
  'Server-resolved tenancy context. Roles are read from the database, never from the client.';

-- ---------------------------------------------------------------------------
-- Create a business (PRD 62: Create Account → Create Business)
--
-- Runs as SECURITY DEFINER so signup can provision a tenant without exposing a
-- privileged service-role path to the browser. The owner role is resolved
-- server-side; the caller cannot choose their own role.
-- ---------------------------------------------------------------------------
create or replace function public.create_organization(
  business_name text,
  slug text,
  business_type public.business_type default 'other',
  country text default 'NG'
)
returns public.organizations
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  owner_role_id uuid;
  created public.organizations;
begin
  if caller is null then
    raise exception 'Authentication required';
  end if;

  if coalesce(length(trim(business_name)), 0) = 0 then
    raise exception 'Business name is required';
  end if;

  select id into owner_role_id from public.roles where key = 'organization_owner';
  if owner_role_id is null then
    raise exception 'organization_owner role is missing from the roles table';
  end if;

  insert into public.organizations (business_name, slug, business_type, country, status)
  values (trim(business_name), lower(trim(slug)), business_type, upper(country), 'active')
  returning * into created;

  insert into public.organization_members (organization_id, user_id, role_id, status, joined_at)
  values (created.id, caller, owner_role_id, 'active', now());

  return created;
end;
$$;

revoke all on function public.create_organization(text, text, public.business_type, text) from public;
grant execute on function public.create_organization(text, text, public.business_type, text)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Create the profile row alongside every auth user
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();