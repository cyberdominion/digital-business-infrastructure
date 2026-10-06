-- ===========================================================================
-- 0006 — Row level security
-- PRD 7, 20, 40, 70, 71, 84
--
-- Isolation is enforced here, in the database, not in the frontend. Every
-- tenant-owned table carries organization_id and gets the same policy shape:
-- membership is checked through app.in_current_organization(), and the operation
-- is additionally gated on a named permission from the RBAC tables.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Role grants
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'organizations', 'organization_members',
    'leads', 'lead_status_history', 'lead_scores', 'contacts', 'customers',
    'pipelines', 'pipeline_stages', 'deals', 'tasks', 'notes',
    'categories', 'products', 'inventory', 'orders', 'order_items',
    'payments', 'webhook_events', 'plans', 'subscriptions', 'invoices',
    'audit_logs', 'notifications', 'notification_deliveries',
    'referrals', 'referral_rewards', 'support_tickets',
    'websites', 'domains', 'usage_records', 'roles', 'permissions', 'role_permissions'
  ]
  loop
    execute format('grant select on public.%I to authenticated', t);
  end loop;
end $$;

grant usage, select on sequence public.audit_logs_id_seq to authenticated;
grant usage, select on sequence public.usage_records_id_seq to authenticated;
grant select on public.roles, public.permissions, public.role_permissions to anon, authenticated;
grant select on public.plans to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Enforce RLS everywhere
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'organizations', 'organization_members',
    'leads', 'lead_status_history', 'lead_scores', 'contacts', 'customers',
    'pipelines', 'pipeline_stages', 'deals', 'tasks', 'notes',
    'categories', 'products', 'inventory', 'orders', 'order_items',
    'payments', 'webhook_events', 'plans', 'subscriptions', 'invoices',
    'audit_logs', 'notifications', 'notification_deliveries',
    'referrals', 'referral_rewards', 'support_tickets',
    'websites', 'domains', 'usage_records'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    -- Belt and braces: RLS applies even if a future migration forgets FORCE.
    execute format('alter table public.%I force row level security', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Tenant-owned tables
--
-- `force row level security` is set above, which means the table owner is also
-- subject to these policies. The service role still bypasses RLS by design; that
-- is exactly why packages/database/src/admin.ts is fenced off to webhook and
-- cron paths.
-- ---------------------------------------------------------------------------
create or replace function public.apply_tenant_policies(
  target_table text,
  select_permission text,
  insert_permission text default null,
  update_permission text default null,
  delete_permission text default null,
  select_extra text default null
)
returns void
language plpgsql
as $$
declare
  tenant_check text;
  select_using text;
begin
  tenant_check := format('app.in_current_organization(organization_id)');

  select_using := format(
    '(%s and app.has_permission(%L, organization_id)%s)',
    tenant_check, select_permission,
    case when select_extra is null then '' else ' and (' || select_extra || ')' end
  );

  execute format(
    'create policy %I on public.%I for select using %s',
    target_table || '_select', target_table, select_using
  );

  if insert_permission is not null then
    execute format(
      'create policy %I on public.%I for insert with check (%s and app.has_permission(%L, organization_id))',
      target_table || '_insert', target_table, tenant_check, insert_permission
    );
  end if;

  if update_permission is not null then
    execute format(
      'create policy %I on public.%I for update using (%s and app.has_permission(%L, organization_id)) with check (%s and app.has_permission(%L, organization_id))',
      target_table || '_update', target_table, tenant_check, update_permission, tenant_check, update_permission
    );
  end if;

  if delete_permission is not null then
    execute format(
      'create policy %I on public.%I for delete using (%s and app.has_permission(%L, organization_id))',
      target_table || '_delete', target_table, tenant_check, delete_permission
    );
  end if;
end;
$$;

-- CRM
select public.apply_tenant_policies('leads', 'lead.view', 'lead.create', 'lead.update', 'lead.delete',
  'app.has_permission(''lead.delete'', organization_id) or assigned_to = auth.uid()');
select public.apply_tenant_policies('lead_status_history', 'lead.view');
select public.apply_tenant_policies('lead_scores', 'lead.view', 'lead.update', 'lead.update');
select public.apply_tenant_policies('contacts', 'contact.view', 'contact.create', 'contact.update', 'contact.delete');
select public.apply_tenant_policies('customers', 'customer.view', 'customer.create', 'customer.update', 'customer.delete');
select public.apply_tenant_policies('pipelines', 'deal.view', 'deal.update', 'deal.update');
select public.apply_tenant_policies('pipeline_stages', 'deal.view', 'deal.update', 'deal.update');
select public.apply_tenant_policies('deals', 'deal.view', 'deal.create', 'deal.update', 'deal.delete');
select public.apply_tenant_policies('tasks', 'task.view', 'task.create', 'task.update', 'task.delete');
select public.apply_tenant_policies('notes', 'task.view', 'task.create', 'task.update', 'task.delete');

-- Commerce
select public.apply_tenant_policies('categories', 'product.view', 'product.create', 'product.update', 'product.delete');
select public.apply_tenant_policies('products', 'product.view', 'product.create', 'product.update', 'product.delete');
select public.apply_tenant_policies('inventory', 'product.view', 'product.update', 'product.update');
select public.apply_tenant_policies('orders', 'order.view', 'order.create', 'order.update');
select public.apply_tenant_policies('order_items', 'order.view', 'order.create', 'order.update');
select public.apply_tenant_policies('payments', 'payment.view', 'payment.create', 'payment.update');
select public.apply_tenant_policies('subscriptions', 'settings.view', null, 'settings.update');
select public.apply_tenant_policies('invoices', 'payment.view', null, null);

-- Platform services
select public.apply_tenant_policies('notifications', 'notification.view', null, 'notification.update', null,
  'recipient_id is null or recipient_id = auth.uid()');
select public.apply_tenant_policies('notification_deliveries', 'notification.view', 'notification.send');
select public.apply_tenant_policies('referrals', 'referral.view', 'referral.manage', 'referral.manage', 'referral.manage');
select public.apply_tenant_policies('referral_rewards', 'referral.view', 'referral.manage');
select public.apply_tenant_policies('support_tickets', 'support_ticket.view', 'support_ticket.create', 'support_ticket.update');
select public.apply_tenant_policies('websites', 'website.view', 'website.manage', 'website.manage', 'website.manage');
select public.apply_tenant_policies('domains', 'website.view', 'domain.manage', 'domain.manage', 'domain.manage');
select public.apply_tenant_policies('usage_records', 'settings.view');

-- ---------------------------------------------------------------------------
-- payments: refunds are a separate permission from ordinary updates
-- ---------------------------------------------------------------------------
drop policy if exists payments_update on public.payments;
create policy payments_update on public.payments
for update
using (app.in_current_organization(organization_id) and (
  app.has_permission('payment.update', organization_id)
  or app.has_permission('payment.refund', organization_id)
))
with check (app.in_current_organization(organization_id));

-- ---------------------------------------------------------------------------
-- orders: refunds likewise
-- ---------------------------------------------------------------------------
drop policy if exists orders_update on public.orders;
create policy orders_update on public.orders
for update
using (app.in_current_organization(organization_id) and (
  app.has_permission('order.update', organization_id)
  or app.has_permission('order.refund', organization_id)
))
with check (app.in_current_organization(organization_id));

-- ---------------------------------------------------------------------------
-- organizations (PRD 9)
-- SELECT: any active member, plus platform staff for support work.
-- INSERT: nobody directly. Tenants are provisioned by public.create_organization().
-- UPDATE: only with settings.update.
-- ---------------------------------------------------------------------------
drop policy if exists organizations_select on public.organizations;
create policy organizations_select on public.organizations
for select
using (app.in_current_organization(id) or app.is_platform_staff());

create policy organizations_update on public.organizations
for update
using (app.in_current_organization(id) and app.has_permission('settings.update', id))
with check (app.in_current_organization(id));

revoke insert on public.organizations from anon, authenticated;

-- ---------------------------------------------------------------------------
-- organization_members (PRD 10)
-- ---------------------------------------------------------------------------
drop policy if exists organization_members_select on public.organization_members;
create policy organization_members_select on public.organization_members
for select
using (app.in_current_organization(organization_id) or app.is_platform_staff());

create policy organization_members_insert on public.organization_members
for insert
with check (
  app.in_current_organization(organization_id)
  and app.has_permission('member.invite', organization_id)
);

create policy organization_members_update on public.organization_members
for update
using (
  app.in_current_organization(organization_id)
  and app.has_permission('member.role.assign', organization_id)
)
with check (
  app.in_current_organization(organization_id)
  and app.has_permission('member.role.assign', organization_id)
);

create policy organization_members_delete on public.organization_members
for delete
using (
  app.in_current_organization(organization_id)
  and app.has_permission('member.role.assign', organization_id)
);

-- ---------------------------------------------------------------------------
-- profiles
-- A profile is readable by co-workers in the same tenant, writable only by
-- its owner. Crucially there is no `role` column to tamper with (PRD 5.7).
-- ---------------------------------------------------------------------------
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
for select
using (
  id = auth.uid()
  or exists (
    select 1
    from public.organization_members mine
    join public.organization_members theirs on theirs.organization_id = mine.organization_id
    where mine.user_id = auth.uid()
      and mine.status = 'active'
      and theirs.user_id = profiles.id
      and theirs.status = 'active'
  )
  or app.is_platform_staff()
);

create policy profiles_update_self on public.profiles
for update
using (id = auth.uid())
with check (id = auth.uid());

-- ---------------------------------------------------------------------------
-- audit_logs (PRD 39)
-- Append-only: insert is permitted, modification is not.
-- ---------------------------------------------------------------------------
drop policy if exists audit_logs_select on public.audit_logs;
create policy audit_logs_select on public.audit_logs
for select
using (
  (organization_id is not null and app.has_permission('audit_logs.view', organization_id))
  or app.is_platform_staff()
);

create policy audit_logs_insert on public.audit_logs
for insert
with check (actor_user_id = auth.uid() or actor_user_id is null);

-- ---------------------------------------------------------------------------
-- webhook_events (PRD 22, Sprint 8)
-- Server-to-server only. The service role bypasses RLS; authenticated users get
-- no access at all, so a session cookie cannot fabricate a "paid" event.
-- ---------------------------------------------------------------------------
drop policy if exists webhook_events_select on public.webhook_events;
create policy webhook_events_select on public.webhook_events
for select
using (app.is_platform_staff());

revoke insert, update, delete on public.webhook_events from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Reference tables (plans, roles, permissions) are global and read-only.
-- ---------------------------------------------------------------------------
drop policy if exists plans_select on public.plans;
create policy plans_select on public.plans for select using (true);

drop policy if exists roles_select on public.roles;
create policy roles_select on public.roles for select using (true);

drop policy if exists permissions_select on public.permissions;
create policy permissions_select on public.permissions for select using (true);

drop policy if exists role_permissions_select on public.role_permissions;
create policy role_permissions_select on public.role_permissions for select using (true);
