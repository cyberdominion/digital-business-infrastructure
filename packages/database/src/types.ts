/**
 * Shared domain types for the Digital Business Infrastructure Platform.
 *
 * The database schema in `supabase/migrations/` is the source of truth. Types
 * generated from it are produced by `pnpm db:types` and live in
 * `src/generated/database.types.ts`.
 */

/** Identifies a tenant. Every tenant-owned row carries this value. */
export type OrganizationId = string;

/** Identifies an authenticated principal (matches auth.users.id). */
export type UserId = string;

/**
 * Platform-wide role catalogue (PRD 5, 10).
 *
 * These are *names*, not permissions. Authority comes from the
 * role_permissions table and is evaluated server-side — never from a
 * client-supplied or client-editable role field (PRD 5.7).
 */
export const ROLES = [
  'platform_admin',
  'platform_support',
  'organization_owner',
  'organization_admin',
  'sales_manager',
  'sales_representative',
  'support_agent',
  'read_only',
] as const;

export type Role = (typeof ROLES)[number];

/** Coarse platform scope used to separate tenant RBAC from platform RBAC. */
export type RoleScope = 'platform' | 'organization';

export const ROLE_SCOPE: Readonly<Record<Role, RoleScope>> = {
  platform_admin: 'platform',
  platform_support: 'platform',
  organization_owner: 'organization',
  organization_admin: 'organization',
  sales_manager: 'organization',
  sales_representative: 'organization',
  support_agent: 'organization',
  read_only: 'organization',
};

/** Grants that cross the tenant boundary. Never assignable to org members. */
export const PLATFORM_PERMISSIONS = [
  'platform.organizations.read',
  'platform.organizations.update',
  'platform.organizations.suspend',
  'platform.users.read',
  'platform.subscriptions.manage',
  'platform.payments.read',
  'platform.domains.manage',
  'platform.websites.manage',
  'platform.ai_usage.read',
  'platform.audit_logs.read',
  'platform.system_health.read',
] as const;

export type PlatformPermission = (typeof PLATFORM_PERMISSIONS)[number];

/** Granular, resource-scoped permissions (PRD 10). */
export const RESOURCE_PERMISSIONS = [
  'lead.view',
  'lead.create',
  'lead.update',
  'lead.delete',
  'lead.assign',

  'contact.view',
  'contact.create',
  'contact.update',
  'contact.delete',

  'customer.view',
  'customer.create',
  'customer.update',
  'customer.delete',

  'deal.view',
  'deal.create',
  'deal.update',
  'deal.delete',

  'task.view',
  'task.create',
  'task.update',
  'task.delete',

  'order.view',
  'order.create',
  'order.update',
  'order.refund',

  'product.view',
  'product.create',
  'product.update',
  'product.delete',

  'payment.view',
  'payment.create',
  'payment.refund',

  'analytics.view',
  'referral.view',
  'referral.manage',
  'notification.view',
  'notification.send',
  'notification.update',

  'support_ticket.view',
  'support_ticket.create',
  'support_ticket.update',

  'ai.knowledge.manage',
  'ai.agent.configure',
  'ai.usage.view',

  'automation.view',
  'automation.create',
  'automation.update',
  'automation.delete',

  'website.view',
  'website.manage',
  'domain.manage',
  'member.view',
  'member.invite',
  'member.role.assign',
  'settings.view',
  'settings.update',

  'audit_logs.view',
] as const;

export type ResourcePermission = (typeof RESOURCE_PERMISSIONS)[number];

export type Permission = PlatformPermission | ResourcePermission;

export type SubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'paused'
  | 'cancelled'
  | 'expired';

export type OrganizationStatus = 'pending' | 'active' | 'suspended' | 'closed';

/** ISO 4217 code. Naira is the default for the Nigerian market (PRD 10). */
export type CurrencyCode = 'NGN' | 'USD' | 'GBP' | 'EUR' | 'ZAR' | 'KES' | 'GHS';

/** Industry presets that switch on module behaviour (PRD 63). */
export const BUSINESS_TYPES = [
  'fashion',
  'restaurant',
  'real_estate',
  'professional_services',
  'retail',
  'beauty',
  'electronics',
  'agriculture',
  'manufacturing',
  'other',
] as const;

export type BusinessType = (typeof BUSINESS_TYPES)[number];

/** Which product modules a tenant has switched on (PRD 64). */
export interface ModuleFlags {
  crm: boolean;
  website: boolean;
  domains: boolean;
  hosting: boolean;
  payments: boolean;
  orders: boolean;
  inventory: boolean;
  ai_sales: boolean;
  automation: boolean;
  whatsapp: boolean;
  analytics: boolean;
  referrals: boolean;
}

export const DEFAULT_MODULES: ModuleFlags = {
  crm: true,
  website: false,
  domains: false,
  hosting: false,
  payments: false,
  orders: false,
  inventory: false,
  ai_sales: false,
  automation: false,
  whatsapp: false,
  analytics: true,
  referrals: true,
};

/**
 * Lead lifecycle statuses (PRD 12).
 *
 * `customer` is the terminal promotion of a qualified lead into a customer
 * record; `lost` is terminal but re-openable.
 */
export const LEAD_STATUSES = [
  'new',
  'contacted',
  'warm',
  'hot',
  'qualified',
  'proposal',
  'negotiation',
  'won',
  'customer',
  'lost',
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];

/** Where a lead came from (PRD 13). */
export const LEAD_SOURCES = [
  'website',
  'whatsapp',
  'instagram',
  'facebook',
  'tiktok',
  'referral',
  'google',
  'advertisement',
  'manual',
  'api',
] as const;

export type LeadSource = (typeof LEAD_SOURCES)[number];

/** Coarse sales pipeline stages backing the Kanban board (PRD 17). */
export const PIPELINE_STAGES = ['new', 'qualified', 'proposal', 'negotiation', 'won', 'lost'] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];

/** Order lifecycle (PRD 21). */
export const ORDER_STATUSES = [
  'pending',
  'paid',
  'confirmed',
  'processing',
  'fulfilled',
  'ready',
  'delivered',
  'completed',
  'cancelled',
  'refunded',
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PAYMENT_STATUSES = [
  'pending',
  'processing',
  'success',
  'failed',
  'reversed',
  'refunded',
  'partially_refunded',
] as const;

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PLAN_CODES = ['starter', 'growth', 'professional', 'enterprise'] as const;

export type PlanCode = (typeof PLAN_CODES)[number];

/**
 * A tenant-enabled module feature flag.
 *
 * Kept as a plain record so the database can add flags without a migration in
 * the application layer.
 */
export type ModuleFlagsRecord = Record<string, boolean>;