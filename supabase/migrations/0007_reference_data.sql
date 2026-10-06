-- ===========================================================================
-- 0007 — Reference data: permissions, roles, role matrix, plans
--
-- This matrix is the runtime source of truth. packages/auth/src/permissions.ts
-- ships the same grants as a bootstrapping default and its test asserts the
-- invariants (no platform grant on an organization role, and so on), so the two
-- cannot drift silently.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Permissions
-- ---------------------------------------------------------------------------
insert into public.permissions (key, category, description) values
  ('platform.organizations.read', 'platform', 'View any organization'),
  ('platform.organizations.update', 'platform', 'Edit any organization'),
  ('platform.organizations.suspend', 'platform', 'Suspend or close an organization'),
  ('platform.users.read', 'platform', 'View users across organizations'),
  ('platform.subscriptions.manage', 'platform', 'Change plans and subscription state'),
  ('platform.payments.read', 'platform', 'View payments across organizations'),
  ('platform.domains.manage', 'platform', 'Manage domains across organizations'),
  ('platform.websites.manage', 'platform', 'Manage websites across organizations'),
  ('platform.ai_usage.read', 'platform', 'View platform AI usage'),
  ('platform.audit_logs.read', 'platform', 'Read audit logs across organizations'),
  ('platform.system_health.read', 'platform', 'Read infrastructure health'),

  ('lead.view', 'resource', 'View leads'),
  ('lead.create', 'resource', 'Create leads'),
  ('lead.update', 'resource', 'Update leads'),
  ('lead.delete', 'resource', 'Delete leads'),
  ('lead.assign', 'resource', 'Assign leads to team members'),

  ('contact.view', 'resource', 'View contacts'),
  ('contact.create', 'resource', 'Create contacts'),
  ('contact.update', 'resource', 'Update contacts'),
  ('contact.delete', 'resource', 'Delete contacts'),

  ('customer.view', 'resource', 'View customers'),
  ('customer.create', 'resource', 'Create customers'),
  ('customer.update', 'resource', 'Update customers'),
  ('customer.delete', 'resource', 'Delete customers'),

  ('deal.view', 'resource', 'View deals and pipeline'),
  ('deal.create', 'resource', 'Create deals'),
  ('deal.update', 'resource', 'Update deals'),
  ('deal.delete', 'resource', 'Delete deals'),

  ('task.view', 'resource', 'View tasks'),
  ('task.create', 'resource', 'Create tasks'),
  ('task.update', 'resource', 'Update tasks'),
  ('task.delete', 'resource', 'Delete tasks'),

  ('order.view', 'resource', 'View orders'),
  ('order.create', 'resource', 'Create orders'),
  ('order.update', 'resource', 'Update orders'),
  ('order.refund', 'resource', 'Refund orders'),

  ('product.view', 'resource', 'View catalogue'),
  ('product.create', 'resource', 'Create products'),
  ('product.update', 'resource', 'Update products'),
  ('product.delete', 'resource', 'Delete products'),

  ('payment.view', 'resource', 'View payments'),
  ('payment.create', 'resource', 'Record payments'),
  ('payment.refund', 'resource', 'Refund payments'),

  ('analytics.view', 'resource', 'View analytics and reports'),
  ('referral.view', 'resource', 'View referral dashboard'),
  ('referral.manage', 'resource', 'Manage referrals and rewards'),

  ('notification.view', 'resource', 'View notifications'),
  ('notification.update', 'resource', 'Mark notifications read'),
  ('notification.send', 'resource', 'Send notifications'),

  ('support_ticket.view', 'resource', 'View support tickets'),
  ('support_ticket.create', 'resource', 'Raise support tickets'),
  ('support_ticket.update', 'resource', 'Update support tickets'),

  ('ai.knowledge.manage', 'resource', 'Manage the tenant knowledge base'),
  ('ai.agent.configure', 'resource', 'Configure AI agents'),
  ('ai.usage.view', 'resource', 'View AI usage'),

  ('automation.view', 'resource', 'View automations'),
  ('automation.create', 'resource', 'Create automations'),
  ('automation.update', 'resource', 'Update automations'),
  ('automation.delete', 'resource', 'Delete automations'),

  ('website.view', 'resource', 'View websites'),
  ('website.manage', 'resource', 'Manage websites'),
  ('domain.manage', 'resource', 'Manage domains'),

  ('member.view', 'resource', 'View team members'),
  ('member.invite', 'resource', 'Invite team members'),
  ('member.role.assign', 'resource', 'Assign member roles'),

  ('settings.view', 'resource', 'View organization settings'),
  ('settings.update', 'resource', 'Change organization settings'),

  ('audit_logs.view', 'resource', 'View the organization audit log')
on conflict (key) do update
  set description = excluded.description, category = excluded.category;

-- ---------------------------------------------------------------------------
-- Roles
-- ---------------------------------------------------------------------------
insert into public.roles (key, label, scope, rank, description) values
  ('platform_admin', 'Platform Administrator', 'platform', 100,
   'Full infrastructure-level access across every tenant'),
  ('platform_support', 'Platform Support', 'platform', 50,
   'Read-mostly access for internal support and diagnostics'),

  ('organization_owner', 'Organization Owner', 'organization', 100,
   'The business owner; holds every organization grant'),
  ('organization_admin', 'Business Administrator', 'organization', 80,
   'Operates the CRM, team, orders and website without platform authority'),
  ('sales_manager', 'Sales Manager', 'organization', 60,
   'Owns the pipeline, assignments and sales reporting'),
  ('sales_representative', 'Sales Representative', 'organization', 40,
   'Works assigned leads, customers and deals'),
  ('support_agent', 'Support Agent', 'organization', 30,
   'Handles conversations, tickets and customer requests'),
  ('read_only', 'Read Only', 'organization', 10,
   'Can view the workspace but change nothing')
on conflict (key) do update
  set label = excluded.label,
      scope = excluded.scope,
      rank = excluded.rank,
      description = excluded.description;

-- ---------------------------------------------------------------------------
-- Role → permission matrix
--
-- Declared as a VALUES list so it can be read and reviewed as one table.
-- The enforce_role_permission_scope trigger rejects any platform grant attached
-- to an organization role, so a mistake here fails loudly rather than silently.
-- ---------------------------------------------------------------------------
with matrix (role_key, permission_key) as (
  values
    -- Platform roles: platform surface only.
    ('platform_admin', 'platform.organizations.read'),
    ('platform_admin', 'platform.organizations.update'),
    ('platform_admin', 'platform.organizations.suspend'),
    ('platform_admin', 'platform.users.read'),
    ('platform_admin', 'platform.subscriptions.manage'),
    ('platform_admin', 'platform.payments.read'),
    ('platform_admin', 'platform.domains.manage'),
    ('platform_admin', 'platform.websites.manage'),
    ('platform_admin', 'platform.ai_usage.read'),
    ('platform_admin', 'platform.audit_logs.read'),
    ('platform_admin', 'platform.system_health.read'),

    ('platform_support', 'platform.organizations.read'),
    ('platform_support', 'platform.users.read'),
    ('platform_support', 'platform.payments.read'),
    ('platform_support', 'platform.domains.manage'),
    ('platform_support', 'platform.system_health.read'),

    -- Owner: the whole organization surface.
    ('organization_owner', 'lead.view'), ('organization_owner', 'lead.create'),
    ('organization_owner', 'lead.update'), ('organization_owner', 'lead.delete'),
    ('organization_owner', 'lead.assign'),
    ('organization_owner', 'contact.view'), ('organization_owner', 'contact.create'),
    ('organization_owner', 'contact.update'), ('organization_owner', 'contact.delete'),
    ('organization_owner', 'customer.view'), ('organization_owner', 'customer.create'),
    ('organization_owner', 'customer.update'), ('organization_owner', 'customer.delete'),
    ('organization_owner', 'deal.view'), ('organization_owner', 'deal.create'),
    ('organization_owner', 'deal.update'), ('organization_owner', 'deal.delete'),
    ('organization_owner', 'task.view'), ('organization_owner', 'task.create'),
    ('organization_owner', 'task.update'), ('organization_owner', 'task.delete'),
    ('organization_owner', 'order.view'), ('organization_owner', 'order.create'),
    ('organization_owner', 'order.update'), ('organization_owner', 'order.refund'),
    ('organization_owner', 'product.view'), ('organization_owner', 'product.create'),
    ('organization_owner', 'product.update'), ('organization_owner', 'product.delete'),
    ('organization_owner', 'payment.view'), ('organization_owner', 'payment.create'),
    ('organization_owner', 'payment.refund'),
    ('organization_owner', 'analytics.view'),
    ('organization_owner', 'referral.view'), ('organization_owner', 'referral.manage'),
    ('organization_owner', 'notification.view'), ('organization_owner', 'notification.update'),
    ('organization_owner', 'notification.send'),
    ('organization_owner', 'support_ticket.view'), ('organization_owner', 'support_ticket.create'),
    ('organization_owner', 'support_ticket.update'),
    ('organization_owner', 'ai.knowledge.manage'), ('organization_owner', 'ai.agent.configure'),
    ('organization_owner', 'ai.usage.view'),
    ('organization_owner', 'automation.view'), ('organization_owner', 'automation.create'),
    ('organization_owner', 'automation.update'), ('organization_owner', 'automation.delete'),
    ('organization_owner', 'website.view'), ('organization_owner', 'website.manage'),
    ('organization_owner', 'domain.manage'),
    ('organization_owner', 'member.view'), ('organization_owner', 'member.invite'),
    ('organization_owner', 'member.role.assign'),
    ('organization_owner', 'settings.view'), ('organization_owner', 'settings.update'),
    ('organization_owner', 'audit_logs.view'),

    -- Administrator: same as owner minus AI agent configuration.
    ('organization_admin', 'lead.view'), ('organization_admin', 'lead.create'),
    ('organization_admin', 'lead.update'), ('organization_admin', 'lead.delete'),
    ('organization_admin', 'lead.assign'),
    ('organization_admin', 'contact.view'), ('organization_admin', 'contact.create'),
    ('organization_admin', 'contact.update'), ('organization_admin', 'contact.delete'),
    ('organization_admin', 'customer.view'), ('organization_admin', 'customer.create'),
    ('organization_admin', 'customer.update'), ('organization_admin', 'customer.delete'),
    ('organization_admin', 'deal.view'), ('organization_admin', 'deal.create'),
    ('organization_admin', 'deal.update'), ('organization_admin', 'deal.delete'),
    ('organization_admin', 'task.view'), ('organization_admin', 'task.create'),
    ('organization_admin', 'task.update'), ('organization_admin', 'task.delete'),
    ('organization_admin', 'order.view'), ('organization_admin', 'order.create'),
    ('organization_admin', 'order.update'), ('organization_admin', 'order.refund'),
    ('organization_admin', 'product.view'), ('organization_admin', 'product.create'),
    ('organization_admin', 'product.update'), ('organization_admin', 'product.delete'),
    ('organization_admin', 'payment.view'), ('organization_admin', 'payment.create'),
    ('organization_admin', 'payment.refund'),
    ('organization_admin', 'analytics.view'),
    ('organization_admin', 'referral.view'), ('organization_admin', 'referral.manage'),
    ('organization_admin', 'notification.view'), ('organization_admin', 'notification.update'),
    ('organization_admin', 'notification.send'),
    ('organization_admin', 'support_ticket.view'), ('organization_admin', 'support_ticket.create'),
    ('organization_admin', 'support_ticket.update'),
    ('organization_admin', 'ai.knowledge.manage'), ('organization_admin', 'ai.usage.view'),
    ('organization_admin', 'automation.view'), ('organization_admin', 'automation.create'),
    ('organization_admin', 'automation.update'), ('organization_admin', 'automation.delete'),
    ('organization_admin', 'website.view'), ('organization_admin', 'website.manage'),
    ('organization_admin', 'domain.manage'),
    ('organization_admin', 'member.view'), ('organization_admin', 'member.invite'),
    ('organization_admin', 'member.role.assign'),
    ('organization_admin', 'settings.view'), ('organization_admin', 'settings.update'),
    ('organization_admin', 'audit_logs.view'),

    -- Sales manager: pipeline ownership, no refunds, no member management.
    ('sales_manager', 'support_ticket.view'), ('sales_manager', 'support_ticket.create'),
    ('sales_manager', 'support_ticket.update'), ('sales_manager', 'notification.update'),
    ('sales_manager', 'lead.view'), ('sales_manager', 'lead.create'),
    ('sales_manager', 'lead.update'), ('sales_manager', 'lead.delete'),
    ('sales_manager', 'lead.assign'),
    ('sales_manager', 'contact.view'), ('sales_manager', 'contact.create'),
    ('sales_manager', 'contact.update'), ('sales_manager', 'contact.delete'),
    ('sales_manager', 'customer.view'), ('sales_manager', 'customer.create'),
    ('sales_manager', 'customer.update'), ('sales_manager', 'customer.delete'),
    ('sales_manager', 'deal.view'), ('sales_manager', 'deal.create'),
    ('sales_manager', 'deal.update'), ('sales_manager', 'deal.delete'),
    ('sales_manager', 'task.view'), ('sales_manager', 'task.create'),
    ('sales_manager', 'task.update'), ('sales_manager', 'task.delete'),
    ('sales_manager', 'order.view'), ('sales_manager', 'order.create'),
    ('sales_manager', 'order.update'),
    ('sales_manager', 'product.view'), ('sales_manager', 'payment.view'),
    ('sales_manager', 'analytics.view'),
    ('sales_manager', 'notification.view'), ('sales_manager', 'notification.send'),
    ('sales_manager', 'referral.view'),
    ('sales_manager', 'website.view'), ('sales_manager', 'member.view'),

    -- Sales representative: assigned work only, nothing destructive.
    ('sales_representative', 'notification.update'),
    ('sales_representative', 'lead.view'), ('sales_representative', 'lead.create'),
    ('sales_representative', 'lead.update'),
    ('sales_representative', 'contact.view'), ('sales_representative', 'contact.create'),
    ('sales_representative', 'contact.update'),
    ('sales_representative', 'customer.view'), ('sales_representative', 'customer.create'),
    ('sales_representative', 'customer.update'),
    ('sales_representative', 'deal.view'), ('sales_representative', 'deal.create'),
    ('sales_representative', 'deal.update'),
    ('sales_representative', 'task.view'), ('sales_representative', 'task.create'),
    ('sales_representative', 'task.update'),
    ('sales_representative', 'order.view'), ('sales_representative', 'order.create'),
    ('sales_representative', 'product.view'), ('sales_representative', 'analytics.view'),
    ('sales_representative', 'notification.view'),
    ('sales_representative', 'website.view'),

    -- Support agent: conversations and tickets.
    ('support_agent', 'support_ticket.view'), ('support_agent', 'support_ticket.create'),
    ('support_agent', 'support_ticket.update'), ('support_agent', 'notification.update'),
    ('support_agent', 'lead.view'), ('support_agent', 'lead.update'),
    ('support_agent', 'contact.view'), ('support_agent', 'contact.update'),
    ('support_agent', 'customer.view'), ('support_agent', 'customer.update'),
    ('support_agent', 'deal.view'),
    ('support_agent', 'task.view'), ('support_agent', 'task.create'),
    ('support_agent', 'task.update'),
    ('support_agent', 'order.view'),
    ('support_agent', 'notification.view'),
    ('support_agent', 'website.view'),

    -- Read only: view grants exclusively.
    ('read_only', 'lead.view'),
    ('read_only', 'contact.view'),
    ('read_only', 'customer.view'),
    ('read_only', 'deal.view'),
    ('read_only', 'task.view'),
    ('read_only', 'order.view'),
    ('read_only', 'product.view'),
    ('read_only', 'payment.view'),
    ('read_only', 'analytics.view'),
    ('read_only', 'notification.view'),
    ('read_only', 'notification.update'),
    ('read_only', 'referral.view'),
    ('read_only', 'support_ticket.view'),
    ('read_only', 'website.view'),
    ('read_only', 'member.view'),
    ('read_only', 'settings.view')
)
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from matrix m
join public.roles r on r.key = m.role_key::public.role_name
join public.permissions p on p.key = m.permission_key
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Plans (PRD 65)
-- ---------------------------------------------------------------------------
insert into public.plans (code, label, monthly_price, currency, modules, seat_limit, ai_token_limit) values
  ('starter', 'Starter', 50000, 'NGN',
   '{"crm": true, "website": true, "domains": true, "hosting": true, "analytics": true}'::jsonb,
   2, 10000),
  ('growth', 'Growth', 150000, 'NGN',
   '{"crm": true, "website": true, "domains": true, "hosting": true, "analytics": true,
     "automation": true, "payments": true, "orders": true, "whatsapp": true,
     "ai_sales": true, "referrals": true}'::jsonb,
   5, 100000),
  ('professional', 'Professional', 400000, 'NGN',
   '{"crm": true, "website": true, "domains": true, "hosting": true, "analytics": true,
     "automation": true, "payments": true, "orders": true, "inventory": true,
     "whatsapp": true, "ai_sales": true, "referrals": true}'::jsonb,
   20, 1000000),
  ('enterprise', 'Enterprise', 0, 'NGN',
   '{"crm": true, "website": true, "domains": true, "hosting": true, "analytics": true,
     "automation": true, "payments": true, "orders": true, "inventory": true,
     "whatsapp": true, "ai_sales": true, "referrals": true}'::jsonb,
   null, null)
on conflict (code) do update
  set label = excluded.label,
      monthly_price = excluded.monthly_price,
      modules = excluded.modules,
      seat_limit = excluded.seat_limit,
      ai_token_limit = excluded.ai_token_limit;

-- ---------------------------------------------------------------------------
-- Default sales pipeline for every new tenant (PRD 17)
-- ---------------------------------------------------------------------------
create or replace function public.seed_default_pipeline()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_pipeline_id uuid;
begin
  insert into public.pipelines (organization_id, name, is_default)
  values (new.id, 'Sales pipeline', true)
  returning id into new_pipeline_id;

  insert into public.pipeline_stages (pipeline_id, key, label, position, is_won, is_lost)
  values
    (new_pipeline_id, 'new', 'New', 1, false, false),
    (new_pipeline_id, 'qualified', 'Qualified', 2, false, false),
    (new_pipeline_id, 'proposal', 'Proposal', 3, false, false),
    (new_pipeline_id, 'negotiation', 'Negotiation', 4, false, false),
    (new_pipeline_id, 'won', 'Won', 5, true, false),
    (new_pipeline_id, 'lost', 'Lost', 6, false, true);

  return new;
end;
$$;

drop trigger if exists organizations_seed_pipeline on public.organizations;
create trigger organizations_seed_pipeline
after insert on public.organizations
for each row execute function public.seed_default_pipeline();

-- ---------------------------------------------------------------------------
-- Referral code assigned on tenant creation (PRD 33)
-- ---------------------------------------------------------------------------
create or replace function public.seed_referral_code()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.referral_code := coalesce(new.referral_code, new.slug);
  return new;
end;
$$;

drop trigger if exists organizations_referral_code on public.organizations;
create trigger organizations_referral_code
before insert on public.organizations
for each row execute function public.seed_referral_code();