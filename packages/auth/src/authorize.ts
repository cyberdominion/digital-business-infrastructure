import 'server-only';

import { z } from 'zod';
import {
  DEFAULT_MODULES,
  type ModuleFlagsRecord,
  type OrganizationId,
  type Permission,
  type Role,
  type UserId,
} from '@dbi/database';
import { forbidden, notAMember, organizationSuspended } from './errors.js';
import { hasEveryPermission } from './permissions.js';

/**
 * The authorization ladder from PRD 92. Each step is a separate, named gate so
 * a rejected request always fails for one identifiable reason:
 *
 *   Authentication
 *     → Organization membership
 *       → Permission
 *         → Input validation
 *           → Business rules
 *             → Database
 *
 * Note what is *absent*: no step trusts a role supplied by the client. The role
 * is always resolved from `organization_members` on the server.
 */

export const organizationIdSchema = z.string().uuid();

/** A principal plus the tenancy context a request runs under. */
export interface AuthorizationContext {
  readonly userId: UserId;
  readonly organizationId: OrganizationId;
  readonly role: Role;
  readonly permissions: readonly Permission[];
  readonly modules: ModuleFlagsRecord;
  /** True only for `platform_admin` / `platform_support`. */
  readonly isPlatformOperator: boolean;
}

/**
 * Build an authorization context from server-resolved facts only.
 *
 * Every argument must come from the database or the verified session. Never
 * spread a request body, form field, or JWT custom claim straight in here.
 */
export function createAuthorizationContext(input: {
  userId: UserId;
  organizationId: OrganizationId;
  role: Role;
  permissions: readonly Permission[];
  modules?: ModuleFlagsRecord;
  organizationStatus?: 'pending' | 'active' | 'suspended' | 'closed';
}): AuthorizationContext {
  if (input.organizationStatus === 'suspended' || input.organizationStatus === 'closed') {
    throw organizationSuspended();
  }

  const modules = { ...DEFAULT_MODULES, ...(input.modules ?? {}) };

  return {
    userId: input.userId,
    organizationId: input.organizationId,
    role: input.role,
    permissions: input.permissions,
    modules,
    isPlatformOperator: input.role === 'platform_admin' || input.role === 'platform_support',
  };
}

export function assertPermission(
  context: AuthorizationContext,
  ...required: readonly Permission[]
): void {
  if (!hasEveryPermission(context.permissions, required)) {
    throw forbidden(`Missing permission: ${required.join(', ')}`);
  }
}

export function assertAnyPermission(
  context: AuthorizationContext,
  ...required: readonly Permission[]
): void {
  const satisfied = required.some((permission) => context.permissions.includes(permission));
  if (!satisfied) {
    throw forbidden(`Requires one of: ${required.join(', ')}`);
  }
}

/**
 * Confirm a resource belongs to the caller's tenant.
 *
 * This is the application-side counterpart to RLS. It matters because some code
 * paths legitimately use the service-role client (webhooks, cron) and therefore
 * lose the database's help entirely.
 */
export function assertTenant(context: AuthorizationContext, resourceOrganizationId: unknown): void {
  const parsed = organizationIdSchema.safeParse(resourceOrganizationId);
  if (!parsed.success || parsed.data !== context.organizationId) {
    throw notAMember();
  }
}

/**
 * Gate a feature behind its module flag (PRD 64).
 *
 * Prevents a tenant on a plan without Payments from reaching `/api/v1/payments`
 * even though the row would technically be permitted.
 */
export function assertModuleEnabled(context: AuthorizationContext, module: keyof typeof DEFAULT_MODULES): void {
  if (!context.modules[module]) {
    throw forbidden(`Module "${module}" is not enabled for this organization`);
  }
}

/** Platform-scope gate (PRD 37, 38). Organization roles always fail here. */
export function assertPlatformOperator(context: AuthorizationContext): void {
  if (!context.isPlatformOperator) {
    throw forbidden('Platform scope required');
  }
}

export { assertAssignable } from './permissions.js';