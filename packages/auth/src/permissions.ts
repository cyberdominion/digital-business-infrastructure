import {
  PLATFORM_PERMISSIONS,
  RESOURCE_PERMISSIONS,
  ROLE_SCOPE,
  type Permission,
  type PlatformPermission,
  type ResourcePermission,
  type Role,
} from '@dbi/database';
import { forbidden } from './errors.js';

/**
 * Static role → permission map.
 *
 * This is the *bootstrapping* default shipped in the repository. The
 * authoritative source is the `role_permissions` table, so a platform admin
 * can retune a role without a deploy. Both are checked in tests
 * (`permissions.test.ts`) to stop them drifting apart.
 *
 * Rules encoded here:
 *   - platform roles get platform-scope grants only (PRD 5.7)
 *   - organization roles never receive a `platform.*` grant
 *   - `sales_representative` has no `lead.delete`, `order.refund`, or
 *     `member.*` (PRD 5.5)
 */

const RESOURCE_PERMISSION_SET: ReadonlySet<string> = new Set(RESOURCE_PERMISSIONS);

function isResource(permission: Permission): permission is ResourcePermission {
  return RESOURCE_PERMISSION_SET.has(permission);
}

function isPlatform(permission: Permission): permission is PlatformPermission {
  return !isResource(permission);
}

/** All permissions a role holds, ignoring tenant scope. */
function platformRolePermissions(role: Role): Permission[] {
  switch (role) {
    case 'platform_admin':
      return [...PLATFORM_PERMISSIONS];
    case 'platform_support':
      return [
        'platform.organizations.read',
        'platform.users.read',
        'platform.payments.read',
        'platform.domains.manage',
        'platform.system_health.read',
      ];
    default:
      return [];
  }
}

const VIEW_ONLY: Permission[] = [
  'lead.view',
  'contact.view',
  'customer.view',
  'deal.view',
  'task.view',
  'order.view',
  'product.view',
  'payment.view',
  'analytics.view',
  'notification.view',
  'referral.view',
  'support_ticket.view',
  'website.view',
  'member.view',
  'settings.view',
];

const FULL_CRM: Permission[] = [
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
  'payment.view',
  'product.view',
  'product.create',
  'product.update',
  'analytics.view',
  'notification.view',
  'notification.update',
  'referral.view',
  'support_ticket.view',
  'website.view',
  'member.view',
  'settings.view',
];

const SUPPORT_DESK: Permission[] = [
  'support_ticket.view',
  'support_ticket.create',
  'support_ticket.update',
  'notification.update',
];

export const DEFAULT_ROLE_PERMISSIONS: Readonly<Record<Role, readonly Permission[]>> = {
  platform_admin: platformRolePermissions('platform_admin'),
  platform_support: platformRolePermissions('platform_support'),

  organization_owner: [
    ...FULL_CRM,
    ...SUPPORT_DESK,
    'order.refund',
    'payment.create',
    'payment.refund',
    'product.delete',
    'referral.manage',
    'notification.send',
    'ai.knowledge.manage',
    'ai.agent.configure',
    'ai.usage.view',
    'automation.view',
    'automation.create',
    'automation.update',
    'automation.delete',
    'website.manage',
    'domain.manage',
    'member.invite',
    'member.role.assign',
    'settings.update',
    'audit_logs.view',
  ],

  organization_admin: [
    ...FULL_CRM,
    ...SUPPORT_DESK,
    'order.refund',
    'payment.create',
    'payment.refund',
    'product.delete',
    'referral.manage',
    'notification.send',
    'ai.knowledge.manage',
    'ai.usage.view',
    'automation.view',
    'automation.create',
    'automation.update',
    'automation.delete',
    'website.manage',
    'domain.manage',
    'member.invite',
    'member.role.assign',
    'settings.update',
    'audit_logs.view',
  ],

  sales_manager: [
    ...SUPPORT_DESK,
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
    'product.view',
    'payment.view',
    'analytics.view',
    'notification.view',
    'notification.send',
    'referral.view',
    'website.view',
    'member.view',
  ],

  sales_representative: [
    'lead.view',
    'lead.create',
    'lead.update',
    'contact.view',
    'contact.create',
    'contact.update',
    'customer.view',
    'customer.create',
    'customer.update',
    'deal.view',
    'deal.create',
    'deal.update',
    'task.view',
    'task.create',
    'task.update',
    'order.view',
    'order.create',
    'product.view',
    'analytics.view',
    'notification.view',
    'notification.update',
    'website.view',
  ],

  support_agent: [
    ...SUPPORT_DESK,
    'lead.view',
    'lead.update',
    'contact.view',
    'contact.update',
    'customer.view',
    'customer.update',
    'deal.view',
    'task.view',
    'task.create',
    'task.update',
    'order.view',
    'notification.view',
    'website.view',
  ],

  read_only: VIEW_ONLY,
};

/** Permissions a role holds, restricted to its scope. */
export function permissionsForRole(role: Role): Permission[] {
  const scope = ROLE_SCOPE[role];
  const grants = DEFAULT_ROLE_PERMISSIONS[role];
  return scope === 'platform' ? grants.filter(isPlatform) : grants.filter(isResource);
}

export function roleHasPermission(role: Role, permission: Permission): boolean {
  const scope = ROLE_SCOPE[role];
  if (scope === 'platform' !== isPlatform(permission)) {
    // Scope mismatch: platform roles do not implicitly get organization grants
    // and organization roles can never hold a `platform.*` grant.
    return false;
  }
  return permissionsForRole(role).includes(permission);
}

export function hasEveryPermission(
  held: readonly Permission[],
  required: readonly Permission[],
): boolean {
  return required.every((permission) => held.includes(permission));
}

export function hasAnyPermission(
  held: readonly Permission[],
  required: readonly Permission[],
): boolean {
  return required.some((permission) => held.includes(permission));
}

/** Convenience guard: rejects any organization role holding a platform grant. */
export function assertNoPlatformPrivilegeEscalation(role: Role, permissions: readonly Permission[]) {
  if (ROLE_SCOPE[role] === 'platform') return;
  const escalated = permissions.filter(isPlatform);
  if (escalated.length > 0) {
    throw new Error(`Role "${role}" may not hold platform grants: ${escalated.join(', ')}`);
  }
}

export function assertAssignable(role: Role, permission: Permission): void {
  if (!roleHasPermission(role, permission)) {
    throw forbidden(`Role "${role}" cannot hold "${permission}"`);
  }
}