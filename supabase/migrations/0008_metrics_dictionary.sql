-- ===========================================================================
-- 0008 — Metrics dictionary
-- PRD 3 §0.1 #6 ("metrics dictionary ... referenced but absent -> included").
-- PRD 19 defines the contract: every metric displayed in production MUST exist
-- in this dictionary, otherwise two screens may report different values for
-- the same metric. The table is the single, version-controlled source of truth
-- for metric definitions; dashboards consume it rather than hard-coding
-- formulas. Class = G (global/system reference data) in the tenancy matrix.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Reference table. Global/system-owned: not tenant-scoped. Visible to any
-- authenticated user so dashboards can render definitions alongside values.
-- ---------------------------------------------------------------------------
create table if not exists public.metrics_dictionary (
  key text primary key,
  category text not null check (category in ('revenue','growth','operations','engagement','platform','ai','sales','commerce','payments','marketing','support')),
  label text not null,
  definition text not null,
  formula text not null,
  source_tables text[] not null,
  filters text,
  tenant_scope text not null check (tenant_scope in ('tenant','platform','global')),
  time_window text not null,
  refresh_frequency text not null,
  currency_treatment text not null,
  priority text not null check (priority in ('P0','P1','P2')),
  owner text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.metrics_dictionary is
  'Single source of truth for production metric definitions (PRD 19).
   Tenancy matrix class: G (global/system reference data). Visible to any
   authenticated principal; not tenant-scoped, so dashboards render the
   canonical definition alongside each computed value.';

create trigger metrics_dictionary_touch_updated_at
before update on public.metrics_dictionary
for each row execute function app.touch_updated_at();

-- One canonical, immutable version per key. Re-seeding a changed definition
-- updates the row; dashboards are expected to re-read on each render, so the
-- definition a user sees always matches the query that produced the value.
create index if not exists metrics_dictionary_category_idx
  on public.metrics_dictionary (category);
create index if not exists metrics_dictionary_tenant_scope_idx
  on public.metrics_dictionary (tenant_scope);

-- Seed is idempotent: the canonical source of truth is the migration, so a
-- re-run updates the definition rather than violating the primary key. Supabase
-- tracks applied migrations, so this only matters for local re-seeds.

-- ---------------------------------------------------------------------------
-- Security: reference data, visible to authenticated roles only.
-- ---------------------------------------------------------------------------
grant select on public.metrics_dictionary to authenticated;
alter table public.metrics_dictionary enable row level security;
alter table public.metrics_dictionary force row level security;

create policy "authenticated can read metrics_dictionary"
  on public.metrics_dictionary for select
  using (true);

-- ---------------------------------------------------------------------------
-- Seed: the metrics defined in PRD 19.1. Each row is one production metric.
-- ---------------------------------------------------------------------------
insert into public.metrics_dictionary (
  key, category, label, definition, formula, source_tables, filters,
  tenant_scope, time_window, refresh_frequency, currency_treatment, priority, owner
) values
  ('new_leads', 'growth', 'New leads', 'Count of new leads created in a period.',
   'count(leads created in period)', ARRAY['leads'],
   'Excludes soft-deleted and merged-away duplicates', 'tenant', 'Selectable, tenant tz',
   'Materialized view, refreshed 5-15 min', 'Count (no currency)', 'P0', 'CRM'),

  ('lead_response_time', 'operations', 'Lead response time',
   'Median time from lead creation to the first outbound activity.',
   'median(first_outbound_activity_at - lead.created_at)', ARRAY['leads','activities'],
   NULL, 'tenant', 'Selected period', 'Materialized view, refreshed 5-15 min',
   'Duration', 'P0', 'CRM'),

  ('qualification_rate', 'growth', 'Qualification rate',
   'Share of created leads that reached qualified status, cohort-based.',
   'qualified leads converted / total qualified leads (cohort month)',
   ARRAY['lead_status_history'], 'Cohort-based, not point-in-time', 'tenant',
   'Cohort month', 'Materialized view, refreshed 5-15 min', 'Ratio', 'P0', 'CRM'),

  ('lead_to_customer_conversion', 'growth', 'Lead-to-customer conversion',
   'Share of created leads that became customers within N days (default 90).',
   'customers within N days / leads created in cohort', ARRAY['leads','customers'],
   'Cohort, default N=90 days', 'tenant', 'Cohort month, N=90 default',
   'Materialized view, refreshed 5-15 min', 'Ratio', 'P0', 'CRM'),

  ('deal_win_rate', 'sales', 'Deal win rate',
   'Closed-won deals divided by all closed deals in the period.',
   'deals won / (won + lost) closed in period', ARRAY['deals'],
   'Closed date; excludes open deals', 'tenant', 'Closed date',
   'Materialized view, refreshed 5-15 min', 'Ratio', 'P0', 'CRM'),

  ('pipeline_value', 'sales', 'Pipeline value',
   'Total weighted pipeline value (sum of stage probability x value).',
   'sum(value x probability) for open deals', ARRAY['deals'], 'Open deals', 'tenant',
   'Current snapshot', 'Real-time query', 'Currency', 'P0', 'CRM'),

  ('sales_cycle_length', 'sales', 'Sales cycle length',
   'Median elapsed time between deal creation and close for won deals.',
   'median(closed_at - created_at) of won deals', ARRAY['deals'], 'Won deals only',
   'tenant', 'Closed date', 'Materialized view, refreshed 5-15 min', 'Duration', 'P0', 'CRM'),

  ('revenue_collected', 'revenue', 'Revenue (collected)',
   'Sum of successful payments minus refunds.',
   'sum(succeeded payments - refunds)', ARRAY['payments','refunds'], 'payment date',
   'tenant', 'Payment date', 'Materialized view, refreshed 5-15 min',
   'Native currency; FX-converted total shown separately', 'P0', 'Finance'),

  ('orders', 'commerce', 'Orders',
   'Count of orders in paid+ states in the period.',
   'count(orders in paid + states)', ARRAY['orders'], 'Order status in paid+', 'tenant',
   'Order date', 'Materialized view, refreshed 5-15 min', 'Count (no currency)', 'P0', 'Commerce'),

  ('average_order_value', 'commerce', 'Average order value',
   'Collected revenue divided by paid orders.',
   'revenue / paid orders', ARRAY['orders','payments'], 'Paid orders', 'tenant',
   'Period', 'Materialized view, refreshed 5-15 min', 'Currency', 'P0', 'Commerce'),

  ('outstanding_balances', 'commerce', 'Outstanding balances',
   'Sum of order total minus paid for open orders.',
   'sum(order total - paid) for open orders', ARRAY['orders','payments'], 'Open orders',
   'tenant', 'Current snapshot', 'Real-time query', 'Currency', 'P1', 'Commerce'),

  ('payment_success_rate', 'payments', 'Payment success rate',
   'Successful payment attempts divided by all attempts in the period.',
   'succeeded / attempts', ARRAY['payment_attempts'], 'Period', 'tenant', 'Period',
   'Materialized view, refreshed 5-15 min', 'Ratio', 'P0', 'Payments'),

  ('lead_source_performance', 'growth', 'Lead source performance',
   'Leads, conversion, and revenue broken down by lead source.',
   'leads, conversion, revenue by source', ARRAY['leads','orders'], 'Period', 'tenant',
   'Period', 'Materialized view, refreshed 5-15 min', 'Multi-metric', 'P1', 'Marketing'),

  ('mrr_platform', 'platform', 'MRR (platform)',
   'Sum of the normalized monthly price of active subscriptions.',
   'sum(normalized monthly price of active subscriptions)', ARRAY['subscriptions'],
   'subscription status = active', 'platform', 'Current snapshot', 'Real-time query',
   'Currency', 'P0', 'Billing'),

  ('activation_rate', 'growth', 'Activation rate',
   'Share of onboarded tenants that reached the activation definition.',
   'activated tenants / tenants onboarded in cohort', ARRAY['organizations'],
   'Cohort, see Section 28', 'platform', 'Cohort', 'Materialized view, refreshed 5-15 min',
   'Ratio', 'P1', 'Product'),

  ('total_organizations', 'platform', 'Total organizations',
   'Count of all organizations ever created.',
   'count(organizations)', ARRAY['organizations'], 'None', 'platform', 'Current snapshot',
   'Real-time query', 'Count (no currency)', 'P0', 'Growth'),

   ('support_tickets_open', 'operations', 'Open support tickets',
    'Count of open support tickets.',
    'count(open tickets)', ARRAY['support_tickets'], 'status = open', 'platform',
    'Current snapshot', 'Real-time query', 'Count (no currency)', 'P1', 'Support')
on conflict (key) do update
  set category = excluded.category,
      label = excluded.label,
      definition = excluded.definition,
      formula = excluded.formula,
      source_tables = excluded.source_tables,
      filters = excluded.filters,
      tenant_scope = excluded.tenant_scope,
      time_window = excluded.time_window,
      refresh_frequency = excluded.refresh_frequency,
      currency_treatment = excluded.currency_treatment,
      priority = excluded.priority,
      owner = excluded.owner;
