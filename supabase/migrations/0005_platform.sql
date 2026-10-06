-- ===========================================================================
-- 0005 — Platform services: audit, notifications, referrals, support,
--         websites, domains, usage
-- PRD 18, 33, 35, 36, 38, 39, 87
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- audit_logs (PRD 39)
-- Append-only. No UPDATE or DELETE policy is granted, so the trail is
-- tamper-evident for ordinary application roles.
-- ---------------------------------------------------------------------------
create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  organization_id uuid references public.organizations (id) on delete set null,
  actor_user_id uuid references public.profiles (id) on delete set null,
  actor_role public.role_name,

  action text not null,
  resource_type text not null,
  resource_id text,

  changes jsonb,
  ip_address inet,
  user_agent text,
  result text not null default 'success' check (result in ('success', 'failure', 'denied')),

  created_at timestamptz not null default now()
);

create index audit_logs_org_created_idx on public.audit_logs (organization_id, created_at desc);
create index audit_logs_actor_idx on public.audit_logs (actor_user_id, created_at desc);
create index audit_logs_action_idx on public.audit_logs (action, created_at desc);

-- ---------------------------------------------------------------------------
-- notifications (PRD 35)
-- ---------------------------------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  recipient_id uuid references public.profiles (id) on delete cascade,

  type text not null,
  title text not null,
  body text,
  severity text not null default 'info' check (severity in ('info', 'success', 'warning', 'error')),

  data jsonb not null default '{}'::jsonb,
  action_url text,

  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_recipient_idx on public.notifications (recipient_id, read_at, created_at desc);
create index notifications_org_idx on public.notifications (organization_id, created_at desc);

create table if not exists public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  notification_id uuid not null references public.notifications (id) on delete cascade,
  channel public.notification_channel not null,
  status text not null default 'queued' check (status in ('queued', 'sent', 'delivered', 'failed')),
  provider_message_id text,
  error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),

  unique (notification_id, channel)
);

create index notification_deliveries_queue_idx
  on public.notification_deliveries (channel, status, created_at)
  where status = 'queued';

-- ---------------------------------------------------------------------------
-- referrals (PRD 33, 34) — the Digital Business 100 growth loop
-- ---------------------------------------------------------------------------
create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_organization_id uuid not null references public.organizations (id) on delete cascade,
  referred_organization_id uuid unique references public.organizations (id) on delete set null,

  code text not null,
  referred_email text,
  referred_business_name text,
  status public.referral_status not null default 'pending',

  applied_at timestamptz not null default now(),
  qualified_at timestamptz,
  converted_at timestamptz,

  reward_amount numeric(14, 2) not null default 0,
  currency text not null default 'NGN',
  reward_type text check (reward_type in ('credit', 'discount', 'commission', 'service_upgrade')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (referrer_organization_id, code, referred_email)
);

create index referrals_referrer_idx on public.referrals (referrer_organization_id, status);
create index referrals_code_idx on public.referrals (code);

create trigger referrals_touch_updated_at
before update on public.referrals
for each row execute function app.touch_updated_at();

create table if not exists public.referral_rewards (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  referral_id uuid not null references public.referrals (id) on delete cascade,

  amount numeric(14, 2) not null,
  currency text not null default 'NGN',
  kind text not null check (kind in ('credit', 'discount', 'commission', 'service_upgrade')),
  description text,
  granted_at timestamptz not null default now(),
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index referral_rewards_org_idx on public.referral_rewards (organization_id, granted_at desc);

-- Referral rollup behind the dashboard in PRD 34.
create or replace view public.referral_stats
with (security_invoker = true) as
select
  r.referrer_organization_id as organization_id,
  count(*)::int as total_referrals,
  count(*) filter (where r.status = 'qualified')::int as qualified,
  count(*) filter (where r.status = 'converted')::int as converted,
  coalesce(sum(r.reward_amount) filter (where r.status = 'converted'), 0) as reward_total
from public.referrals r
group by r.referrer_organization_id;

-- ---------------------------------------------------------------------------
-- support tickets (PRD 5.6)
-- ---------------------------------------------------------------------------
create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  raised_by uuid references public.profiles (id) on delete set null,
  assigned_to uuid references public.profiles (id) on delete set null,

  subject text not null,
  body text,
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  status text not null default 'open' check (status in ('open', 'in_progress', 'waiting', 'resolved', 'closed')),
  category text,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index support_tickets_org_status_idx on public.support_tickets (organization_id, status, created_at desc);

create trigger support_tickets_touch_updated_at
before update on public.support_tickets
for each row execute function app.touch_updated_at();

-- ---------------------------------------------------------------------------
-- websites and domains (PRD 18, 19) — V2 surface, created now so the
-- organization → website relationship is not retrofitted later.
-- ---------------------------------------------------------------------------
create table if not exists public.websites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,

  name text not null,
  slug text not null,
  status text not null default 'draft' check (status in ('draft', 'building', 'live', 'paused', 'failed')),
  framework text not null default 'nextjs',
  repository text,
  deployment_url text,
  template text,
  configuration jsonb not null default '{}'::jsonb,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (organization_id, slug)
);

create trigger websites_touch_updated_at
before update on public.websites
for each row execute function app.touch_updated_at();

create table if not exists public.domains (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  website_id uuid references public.websites (id) on delete set null,

  hostname text not null unique,
  is_primary boolean not null default false,
  status text not null default 'pending'
    check (status in ('pending', 'verifying', 'active', 'failed', 'expired')),
  verification_token text,
  verification_records jsonb not null default '[]'::jsonb,
  ssl_status text not null default 'pending'
    check (ssl_status in ('pending', 'issuing', 'active', 'failed')),
  ssl_expires_at timestamptz,
  registered_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index domains_one_primary_per_org
  on public.domains (organization_id) where is_primary;

create index domains_org_idx on public.domains (organization_id, status);

create trigger domains_touch_updated_at
before update on public.domains
for each row execute function app.touch_updated_at();

-- ---------------------------------------------------------------------------
-- usage_records (PRD 37) — meters AI tokens and other metered resources
-- ---------------------------------------------------------------------------
create table if not exists public.usage_records (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  resource text not null,
  quantity bigint not null default 0,
  unit text not null default 'count',
  period_start date not null,
  period_end date not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),

  unique (organization_id, resource, period_start)
);

create index usage_records_org_period_idx on public.usage_records (organization_id, period_start desc);