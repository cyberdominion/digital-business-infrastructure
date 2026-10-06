/**
 * Typed authorization failures.
 *
 * These are deliberately distinct from generic `Error` so route handlers can
 * map them onto status codes without string matching (PRD 92).
 */

export type AuthorizationErrorCode =
  | 'unauthenticated'
  | 'forbidden'
  | 'not_a_member'
  | 'tenant_mismatch'
  | 'organization_suspended';

export class AuthorizationError extends Error {
  readonly code: AuthorizationErrorCode;

  constructor(code: AuthorizationErrorCode, message: string) {
    super(message);
    this.name = 'AuthorizationError';
    this.code = code;
  }

  /** Map onto an HTTP status without leaking which tenant or resource existed. */
  toStatus(): 401 | 403 | 404 {
    switch (this.code) {
      case 'unauthenticated':
        return 401;
      case 'organization_suspended':
        return 403;
      case 'not_a_member':
      case 'tenant_mismatch':
        // 404 rather than 403 so callers cannot probe for the existence of
        // another tenant's records (PRD 84).
        return 404;
      case 'forbidden':
        return 403;
    }
  }
}

export const unauthenticated = (message = 'Authentication required') =>
  new AuthorizationError('unauthenticated', message);

export const forbidden = (message = 'Insufficient permission') =>
  new AuthorizationError('forbidden', message);

export const notAMember = (message = 'Not a member of this organization') =>
  new AuthorizationError('not_a_member', message);

export const tenantMismatch = (message = 'Resource does not belong to this organization') =>
  new AuthorizationError('tenant_mismatch', message);

export const organizationSuspended = (message = 'Organization is suspended') =>
  new AuthorizationError('organization_suspended', message);