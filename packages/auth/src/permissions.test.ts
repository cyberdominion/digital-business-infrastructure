import { describe, expect, it } from 'vitest';
import { ROLES, ROLE_SCOPE, PLATFORM_PERMISSIONS } from '@dbi/database';
import {
  DEFAULT_ROLE_PERMISSIONS,
  assertAssignable,
  assertNoPlatformPrivilegeEscalation,
  hasAnyPermission,
  hasEveryPermission,
  permissionsForRole,
  roleHasPermission,
} from './permissions.js';
import { AuthorizationError } from './errors.js';

describe('role → permission matrix', () => {
  it('covers every declared role', () => {
    for (const role of ROLES) {
      expect(DEFAULT_ROLE_PERMISSIONS[role], `role ${role} missing from matrix`).toBeDefined();
    }
  });

  it('never grants a platform grant to an organization role (PRD 5.7)', () => {
    for (const role of ROLES) {
      if (ROLE_SCOPE[role] !== 'organization') continue;
      const platformGrants = permissionsForRole(role).filter((permission) =>
        PLATFORM_PERMISSIONS.includes(permission as (typeof PLATFORM_PERMISSIONS)[number]),
      );
      expect(platformGrants, `role ${role} must hold no platform grants`).toEqual([]);
    }
  });

  it('never grants an organization resource to a platform role', () => {
    for (const role of ROLES) {
      if (ROLE_SCOPE[role] !== 'platform') continue;
      expect(
        permissionsForRole(role).filter((p) => !PLATFORM_PERMISSIONS.includes(p as never)),
        `role ${role} must hold no organization grants`,
      ).toEqual([]);
    }
  });

  it('grants sales_representative no delete, refund, or membership powers (PRD 5.5)', () => {
    const granted = permissionsForRole('sales_representative');
    for (const forbidden of [
      'lead.delete',
      'contact.delete',
      'customer.delete',
      'order.refund',
      'payment.refund',
      'member.invite',
      'member.role.assign',
      'settings.update',
    ] as const) {
      expect(granted, `sales_representative must not hold ${forbidden}`).not.toContain(forbidden);
    }
  });

  it('gives platform_admin the full platform surface', () => {
    expect(permissionsForRole('platform_admin')).toEqual([...PLATFORM_PERMISSIONS]);
  });

  it('keeps platform_support read-mostly', () => {
    const granted = permissionsForRole('platform_support');
    expect(granted).toContain('platform.organizations.read');
    expect(granted).not.toContain('platform.organizations.suspend');
    expect(granted).not.toContain('platform.subscriptions.manage');
  });

  it('gives read_only only view grants', () => {
    for (const permission of permissionsForRole('read_only')) {
      expect(permission.endsWith('.view'), `${permission} is not a view grant`).toBe(true);
    }
  });

  it('resolves roleHasPermission consistently with the matrix', () => {
    for (const role of ROLES) {
      for (const permission of permissionsForRole(role)) {
        expect(roleHasPermission(role, permission)).toBe(true);
      }
    }
  });
});

describe('privilege escalation guards', () => {
  it('rejects assigning a platform grant to an organization role', () => {
    expect(() =>
      assertNoPlatformPrivilegeEscalation('sales_manager', ['lead.view', 'platform.organizations.suspend']),
    ).toThrow(/may not hold platform grants/);
  });

  it('rejects granting a permission outside the target role', () => {
    expect(() => assertAssignable('sales_representative', 'order.refund')).toThrow(AuthorizationError);
    expect(() => assertAssignable('organization_owner', 'order.refund')).not.toThrow();
  });
});

describe('set helpers', () => {
  const held = ['lead.view', 'lead.update'] as const;

  it('requires every permission', () => {
    expect(hasEveryPermission(held, ['lead.view'])).toBe(true);
    expect(hasEveryPermission(held, ['lead.view', 'lead.delete'])).toBe(false);
  });

  it('requires at least one permission', () => {
    expect(hasAnyPermission(held, ['lead.delete', 'lead.view'])).toBe(true);
    expect(hasAnyPermission(held, ['lead.delete'])).toBe(false);
    expect(hasAnyPermission(held, [])).toBe(false);
  });
});

describe('error mapping (PRD 84 — must not leak other tenants)', () => {
  it('maps membership and tenant failures to 404, not 403', () => {
    expect(new AuthorizationError('not_a_member', 'x').toStatus()).toBe(404);
    expect(new AuthorizationError('tenant_mismatch', 'x').toStatus()).toBe(404);
    expect(new AuthorizationError('forbidden', 'x').toStatus()).toBe(403);
    expect(new AuthorizationError('unauthenticated', 'x').toStatus()).toBe(401);
  });
});