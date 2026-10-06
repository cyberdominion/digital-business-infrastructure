import { LEAD_STATUSES, type LeadStatus } from '@dbi/database';

/**
 * The canonical lifecycle (PRD 12):
 *
 *   new → contacted → qualified → proposal → negotiation → won → customer
 *   (with `lost` reachable from any open stage)
 *
 * `customer` is terminal: it represents the moment a qualified lead is
 * promoted into a customer record. `lost` is terminal but re-openable, because
 * a dead deal frequently returns months later.
 */

const OPEN_STATUSES: readonly LeadStatus[] = [
  'new',
  'contacted',
  'warm',
  'hot',
  'qualified',
  'proposal',
  'negotiation',
];

export const TERMINAL_STATUSES: readonly LeadStatus[] = ['won', 'customer', 'lost'];

const TRANSITIONS: Readonly<Record<LeadStatus, readonly LeadStatus[]>> = {
  new: ['contacted', 'warm', 'hot', 'qualified', 'lost'],
  contacted: ['qualified', 'warm', 'hot', 'lost'],
  warm: ['hot', 'qualified', 'contacted', 'lost'],
  hot: ['qualified', 'contacted', 'warm', 'lost'],
  qualified: ['proposal', 'negotiation', 'won', 'lost'],
  proposal: ['negotiation', 'won', 'lost'],
  negotiation: ['won', 'lost'],
  won: ['customer'],
  customer: [],
  lost: ['new', 'contacted', 'qualified'],
};

export type LeadTransitionDecision =
  | { allowed: true }
  | { allowed: false; reason: 'unknown_status' | 'terminal' | 'invalid_transition' | 'no_change' };

export function allowedTransitions(from: LeadStatus): readonly LeadStatus[] {
  return TRANSITIONS[from] ?? [];
}

export function isOpenStatus(status: LeadStatus): boolean {
  return OPEN_STATUSES.includes(status);
}

export function isTerminalStatus(status: LeadStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

export function isLeadStatus(value: unknown): value is LeadStatus {
  return typeof value === 'string' && (LEAD_STATUSES as readonly string[]).includes(value);
}

/**
 * Decide whether a status change is valid.
 *
 * Enforced server-side so a hand-crafted API call cannot move a lead backwards
 * out of `won` or promote it to `customer` without passing through `won`.
 */
export function canTransition(from: LeadStatus, to: LeadStatus): LeadTransitionDecision {
  if (!isLeadStatus(from)) return { allowed: false, reason: 'unknown_status' };
  if (!isLeadStatus(to)) return { allowed: false, reason: 'unknown_status' };
  if (from === to) return { allowed: false, reason: 'no_change' };
  if (from === 'customer') return { allowed: false, reason: 'terminal' };
  if (!TRANSITIONS[from].includes(to)) return { allowed: false, reason: 'invalid_transition' };
  return { allowed: true };
}

export function assertTransition(from: LeadStatus, to: LeadStatus): void {
  const decision = canTransition(from, to);
  if (!decision.allowed) {
    throw new Error(`Invalid lead transition ${from} → ${to} (${decision.reason})`);
  }
}

/** Lead sources tracked in the CRM (PRD 13). */
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