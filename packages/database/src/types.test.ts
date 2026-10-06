import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  BUSINESS_TYPES,
  DEFAULT_MODULES,
  LEAD_SOURCES,
  LEAD_STATUSES,
  ORDER_STATUSES,
  PAYMENT_STATUSES,
  PLATFORM_PERMISSIONS,
  PLAN_CODES,
  RESOURCE_PERMISSIONS,
  ROLES,
  ROLE_SCOPE,
  type ModuleFlags,
} from './types.js';

const MIGRATIONS = join(import.meta.dirname, '..', '..', '..', 'supabase', 'migrations');

function readMigration(file: string): string {
  return readFileSync(join(MIGRATIONS, file), 'utf8');
}

describe('catalogue integrity', () => {
  it('assigns a scope to every role', () => {
    for (const role of ROLES) {
      expect(ROLE_SCOPE[role], `role ${role} has no scope`).toBeDefined();
      expect(['platform', 'organization']).toContain(ROLE_SCOPE[role]);
    }
  });

  it('keeps permission keys unique', () => {
    const all = [...PLATFORM_PERMISSIONS, ...RESOURCE_PERMISSIONS];
    expect(new Set(all).size).toBe(all.length);
  });

  it('keeps lead statuses unique and non-empty', () => {
    expect(new Set(LEAD_STATUSES).size).toBe(LEAD_STATUSES.length);
    expect(LEAD_STATUSES.length).toBeGreaterThan(0);
    expect(LEAD_SOURCES).toContain('whatsapp');
    expect(LEAD_SOURCES).toContain('referral');
  });

  it('has no duplicate order or payment statuses', () => {
    expect(new Set(ORDER_STATUSES).size).toBe(ORDER_STATUSES.length);
    expect(new Set(PAYMENT_STATUSES).size).toBe(PAYMENT_STATUSES.length);
  });

  it('defines the four PRD plans', () => {
    expect(PLAN_CODES).toEqual(['starter', 'growth', 'professional', 'enterprise']);
    expect(BUSINESS_TYPES).toContain('fashion');
    expect(BUSINESS_TYPES).toContain('restaurant');
  });
});

describe('module flags agree with the organizations default (PRD 64)', () => {
  const sql = readMigration('0002_identity.sql');

  it('declares exactly the same module keys in the SQL default', () => {
    const match = sql.match(/modules jsonb not null default '(\{[\s\S]*?\})'::jsonb/);
    expect(match, 'organizations.modules default not found in migration').toBeTruthy();

    const declared = [...(match?.[1] ?? '').matchAll(/"([a-z_]+)":\s*(true|false)/g)].map(
      (entry) => entry[1] as keyof ModuleFlags,
    );
    const expected = Object.keys(DEFAULT_MODULES).sort();

    expect(declared.sort()).toEqual(expected);
  });

  it('defaults CRM, analytics and referrals on, and the paid modules off', () => {
    expect(DEFAULT_MODULES.crm).toBe(true);
    expect(DEFAULT_MODULES.analytics).toBe(true);
    expect(DEFAULT_MODULES.referrals).toBe(true);
    expect(DEFAULT_MODULES.payments).toBe(false);
    expect(DEFAULT_MODULES.ai_sales).toBe(false);
    expect(DEFAULT_MODULES.automation).toBe(false);
  });
});

describe('permission catalogue agrees with the database seed (PRD 10)', () => {
  const sql = readMigration('0007_reference_data.sql');

  it('seeds every platform permission', () => {
    for (const permission of PLATFORM_PERMISSIONS) {
      expect(sql, `permission ${permission} missing from seed`).toContain(`'${permission}'`);
    }
  });

  it('seeds every resource permission', () => {
    for (const permission of RESOURCE_PERMISSIONS) {
      expect(sql, `permission ${permission} missing from seed`).toContain(`'${permission}'`);
    }
  });

  it('seeds every role', () => {
    for (const role of ROLES) {
      expect(sql, `role ${role} missing from seed`).toContain(`'${role}'`);
    }
  });
});