-- ===========================================================================
-- 0003 — CRM: leads, contacts, customers, deals, tasks, notes
-- PRD 12, 13, 14, 16, 17, 36
-- ===========================================================================

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,

  name text not null,
  email text,
  phone text,
  company text,
  website text,

  source public.lead_source not null default 'manual',
  campaign text,
  status public.lead_status not null default 'new',

  -- Deterministic score, never model-generated (PRD 14, 15).
  score smallint not null default 0 check (score between 0 and 100),
  grade public.lead_grade not null default 'D',
  intent text not null default 'low' check (intent in ('high', 'medium', 'low')),
  urgency text not null default 'later' check (urgency in ('immediate', 'soon', 'later', 'none')),
  next_best_action text,
  response_target_minutes integer,

  industry text,
  estimated_value numeric(14, 2),
  conversion_probability numeric(5, 4),

  assigned_to uuid references public.profiles (id) on delete set null,

  last_contacted_at timestamptz,
  next_followup_at timestamptz,
  lost_reason text,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint leads_contact_present check (email is not null or phone is not null)
);

create index leads_org_status_idx on public.leads (organization_id, status);
create index leads_org_score_idx on public.leads (organization_id, score desc);
create index leads_org_created_idx on public.leads (organization_id, created_at desc);
create index leads_assigned_idx on public.leads (assigned_to) where assigned_to is not null;
create index leads_followup_idx on public.leads (organization_id, next_followup_at)
  where next_followup_at is not null;
create index leads_search_idx on public.leads
  using gin (to_tsvector('simple', coalesce(name, '') || ' ' || coalesce(email, '') || ' ' || coalesce(company, '')));

create trigger leads_touch_updated_at
before update on public.leads
for each row execute function app.touch_updated_at();

-- Every lead-status change is recorded so conversion analytics stay explainable.
create table if not exists public.lead_status_history (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  lead_id uuid not null references public.leads (id) on delete cascade,
  from_status public.lead_status,
  to_status public.lead_status not null,
  changed_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index lead_status_history_lead_idx on public.lead_status_history (lead_id, created_at desc);

-- ---------------------------------------------------------------------------
-- contacts and customers (PRD 16)
-- ---------------------------------------------------------------------------
create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  first_name text not null,
  last_name text,
  email text,
  phone text,
  company text,
  position text,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index contacts_org_idx on public.contacts (organization_id, last_name, first_name);
create unique index contacts_org_email_unique
  on public.contacts (organization_id, lower(email))
  where email is not null;

create trigger contacts_touch_updated_at
before update on public.contacts
for each row execute function app.touch_updated_at();

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,

  contact_id uuid references public.contacts (id) on delete set null,
  lead_id uuid references public.leads (id) on delete set null,

  display_name text not null,
  email text,
  phone text,
  company text,

  customer_type text not null default 'retail' check (customer_type in ('retail', 'wholesale', 'corporate')),
  status text not null default 'active' check (status in ('active', 'inactive', 'blocked')),

  lifetime_value numeric(14, 2) not null default 0,
  order_count integer not null default 0,
  last_order_at timestamptz,
  first_seen_at timestamptz not null default now(),
  birthday date,

  notes text,
  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index customers_org_idx on public.customers (organization_id, display_name);
create index customers_org_value_idx on public.customers (organization_id, lifetime_value desc);
create index customers_inactive_idx on public.customers (organization_id, last_order_at);

create trigger customers_touch_updated_at
before update on public.customers
for each row execute function app.touch_updated_at();

-- ---------------------------------------------------------------------------
-- pipelines and deals (PRD 17)
-- ---------------------------------------------------------------------------
create table if not exists public.pipelines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null default 'Sales pipeline',
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index pipelines_one_default_per_org
  on public.pipelines (organization_id) where is_default;

create table if not exists public.pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  pipeline_id uuid not null references public.pipelines (id) on delete cascade,
  key text not null,
  label text not null,
  position integer not null,
  is_won boolean not null default false,
  is_lost boolean not null default false,
  unique (pipeline_id, key),
  unique (pipeline_id, position)
);

create table if not exists public.deals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  pipeline_id uuid not null references public.pipelines (id) on delete cascade,
  stage_id uuid not null references public.pipeline_stages (id) on delete restrict,

  lead_id uuid references public.leads (id) on delete set null,
  customer_id uuid references public.customers (id) on delete set null,

  title text not null,
  value numeric(14, 2) not null default 0,
  currency text not null default 'NGN',
  probability smallint not null default 0 check (probability between 0 and 100),

  owner_id uuid references public.profiles (id) on delete set null,
  expected_close_at timestamptz,
  closed_at timestamptz,
  lost_reason text,

  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index deals_org_stage_idx on public.deals (organization_id, stage_id);
create index deals_org_owner_idx on public.deals (organization_id, owner_id);

create trigger deals_touch_updated_at
before update on public.deals
for each row execute function app.touch_updated_at();

-- ---------------------------------------------------------------------------
-- tasks and notes (PRD 36)
-- ---------------------------------------------------------------------------
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,

  title text not null,
  description text,
  status public.task_status not null default 'pending',
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),

  assignee_id uuid references public.profiles (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,

  lead_id uuid references public.leads (id) on delete cascade,
  customer_id uuid references public.customers (id) on delete cascade,
  deal_id uuid references public.deals (id) on delete cascade,

  due_at timestamptz,
  completed_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tasks_org_status_idx on public.tasks (organization_id, status, due_at);
create index tasks_assignee_idx on public.tasks (assignee_id, status) where assignee_id is not null;

create trigger tasks_touch_updated_at
before update on public.tasks
for each row execute function app.touch_updated_at();

-- Flags overdue tasks without needing a scheduled job to rewrite status.
create or replace view public.overdue_tasks
with (security_invoker = true) as
select *
from public.tasks
where status in ('pending', 'in_progress')
  and due_at is not null
  and due_at < now();

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  body text not null,
  author_id uuid references public.profiles (id) on delete set null,

  lead_id uuid references public.leads (id) on delete cascade,
  customer_id uuid references public.customers (id) on delete cascade,
  deal_id uuid references public.deals (id) on delete cascade,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index notes_org_idx on public.notes (organization_id, created_at desc);

create trigger notes_touch_updated_at
before update on public.notes
for each row execute function app.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Lead score history (PRD 14)
-- Append-only so a score can be explained after the fact.
-- ---------------------------------------------------------------------------
create table if not exists public.lead_scores (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  lead_id uuid not null references public.leads (id) on delete cascade,

  score smallint not null check (score between 0 and 100),
  grade public.lead_grade not null,
  signals jsonb not null default '[]'::jsonb,
  breakdown jsonb not null default '[]'::jsonb,
  model_interpretation text,

  computed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index lead_scores_lead_idx on public.lead_scores (lead_id, computed_at desc);
create index lead_scores_org_score_idx on public.lead_scores (organization_id, score desc);