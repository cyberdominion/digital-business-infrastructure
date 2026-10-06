-- ===========================================================================
-- 0004 — Commerce: catalogue, orders, payments, subscriptions
-- PRD 20, 21, 22, 23, 65
-- ===========================================================================

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  parent_id uuid references public.categories (id) on delete set null,
  name text not null,
  slug text not null,
  description text,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, slug)
);

create index categories_org_idx on public.categories (organization_id, position);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  category_id uuid references public.categories (id) on delete set null,

  name text not null,
  slug text not null,
  description text,
  sku text,

  price numeric(14, 2) not null default 0 check (price >= 0),
  compare_at_price numeric(14, 2) check (compare_at_price is null or compare_at_price >= 0),
  cost_price numeric(14, 2) check (cost_price is null or cost_price >= 0),
  currency text not null default 'NGN',

  -- Industry-specific shape (PRD 63): sizes/colours for fashion, no effect for
  -- a restaurant menu item.
  attributes jsonb not null default '{}'::jsonb,
  images text[] not null default '{}',

  is_active boolean not null default true,
  track_inventory boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (organization_id, slug),
  unique (organization_id, sku)
);

create index products_org_active_idx on public.products (organization_id, is_active);
create index products_search_idx on public.products
  using gin (to_tsvector('simple', coalesce(name, '') || ' ' || coalesce(description, '')));

create trigger products_touch_updated_at
before update on public.products
for each row execute function app.touch_updated_at();

create table if not exists public.inventory (
  product_id uuid primary key references public.products (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  quantity integer not null default 0 check (quantity >= 0),
  reserved_quantity integer not null default 0 check (reserved_quantity >= 0),
  reorder_level integer not null default 0 check (reorder_level >= 0),
  updated_at timestamptz not null default now(),

  constraint inventory_reserved_within_quantity check (reserved_quantity <= quantity)
);

create trigger inventory_touch_updated_at
before update on public.inventory
for each row execute function app.touch_updated_at();

-- ---------------------------------------------------------------------------
-- orders (PRD 21)
-- ---------------------------------------------------------------------------
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,

  reference text not null,
  customer_id uuid references public.customers (id) on delete set null,
  lead_id uuid references public.leads (id) on delete set null,

  status public.order_status not null default 'pending',
  currency text not null default 'NGN',
  subtotal numeric(14, 2) not null default 0 check (subtotal >= 0),
  discount numeric(14, 2) not null default 0 check (discount >= 0),
  delivery_fee numeric(14, 2) not null default 0 check (delivery_fee >= 0),
  total numeric(14, 2) not null default 0 check (total >= 0),
  amount_paid numeric(14, 2) not null default 0 check (amount_paid >= 0),

  -- Business-type specific payload: delivery address, reservation table,
  -- viewing appointment, project brief (PRD 63).
  fulfilment jsonb not null default '{}'::jsonb,

  placed_at timestamptz,
  confirmed_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,

  notes text,
  created_by uuid references public.profiles (id) on delete set null,

  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (organization_id, reference),
  constraint orders_amount_paid_within_total check (amount_paid <= total)
);

create index orders_org_status_idx on public.orders (organization_id, status, created_at desc);
create index orders_org_customer_idx on public.orders (organization_id, customer_id);
create index orders_placed_idx on public.orders (organization_id, placed_at desc);

create trigger orders_touch_updated_at
before update on public.orders
for each row execute function app.touch_updated_at();

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,

  name text not null,
  sku text,
  quantity integer not null check (quantity > 0),
  unit_price numeric(14, 2) not null check (unit_price >= 0),
  discount numeric(14, 2) not null default 0 check (discount >= 0),
  total numeric(14, 2) not null check (total >= 0),
  variant jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index order_items_order_idx on public.order_items (order_id);
create index order_items_org_product_idx on public.order_items (organization_id, product_id);

-- ---------------------------------------------------------------------------
-- payments (PRD 23)
-- ---------------------------------------------------------------------------
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,

  customer_id uuid references public.customers (id) on delete set null,
  order_id uuid references public.orders (id) on delete set null,

  reference text not null,
  provider public.payment_provider not null default 'paystack',
  provider_transaction_id text,
  provider_charge_id text,

  amount numeric(14, 2) not null check (amount >= 0),
  fee numeric(14, 2) check (fee is null or fee >= 0),
  currency text not null default 'NGN',
  status public.payment_status not null default 'pending',

  channel text,
  paid_at timestamptz,
  refunded_at timestamptz,
  failure_reason text,

  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (provider, reference)
);

create index payments_org_status_idx on public.payments (organization_id, status, created_at desc);
create index payments_org_paid_idx on public.payments (organization_id, paid_at desc)
  where status = 'success';
create index payments_order_idx on public.payments (order_id);

create trigger payments_touch_updated_at
before update on public.payments
for each row execute function app.touch_updated_at();

-- ---------------------------------------------------------------------------
-- webhook_events — idempotency ledger (PRD 22, Sprint 8)
--
-- Paystack retries deliveries and exposes a resend tool, so the same event
-- arrives repeatedly. The unique key makes INSERT the dedupe mechanism.
-- ---------------------------------------------------------------------------
create table if not exists public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider public.payment_provider not null,
  idempotency_key text not null,
  event_name text not null,
  payload jsonb not null,
  status text not null default 'processing'
    check (status in ('processing', 'processed', 'failed')),
  error text,
  attempts integer not null default 1,
  processed_at timestamptz,
  created_at timestamptz not null default now(),

  unique (provider, idempotency_key)
);

create index webhook_events_status_idx on public.webhook_events (provider, status, created_at desc);

-- ---------------------------------------------------------------------------
-- subscriptions and invoices (PRD 2, 65)
-- ---------------------------------------------------------------------------
create table if not exists public.plans (
  code public.plan_code primary key,
  label text not null,
  monthly_price numeric(14, 2) not null default 0,
  currency text not null default 'NGN',
  modules jsonb not null default '{}'::jsonb,
  seat_limit integer,
  ai_token_limit bigint,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  plan_code public.plan_code not null default 'starter',

  status public.subscription_status not null default 'trialing',
  provider public.payment_provider not null default 'paystack',
  provider_subscription_code text,
  provider_customer_code text,

  seats integer not null default 1 check (seats > 0),
  amount numeric(14, 2) not null default 0,
  currency text not null default 'NGN',

  current_period_start timestamptz,
  current_period_end timestamptz,
  trial_ends_at timestamptz,
  cancelled_at timestamptz,
  cancel_at_period_end boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index subscriptions_active_per_org
  on public.subscriptions (organization_id)
  where status in ('trialing', 'active', 'past_due', 'paused');

create index subscriptions_expiring_idx on public.subscriptions (current_period_end)
  where status in ('trialing', 'active');

create trigger subscriptions_touch_updated_at
before update on public.subscriptions
for each row execute function app.touch_updated_at();

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  subscription_id uuid references public.subscriptions (id) on delete set null,

  number text not null,
  status public.payment_status not null default 'pending',
  amount numeric(14, 2) not null check (amount >= 0),
  tax numeric(14, 2) not null default 0,
  total numeric(14, 2) not null check (total >= 0),
  currency text not null default 'NGN',

  due_at timestamptz,
  paid_at timestamptz,
  pdf_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (number)
);

create index invoices_org_idx on public.invoices (organization_id, created_at desc);

create trigger invoices_touch_updated_at
before update on public.invoices
for each row execute function app.touch_updated_at();