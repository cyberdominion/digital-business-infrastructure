import { describe, expect, it } from 'vitest';
import {
  allowedTransitions,
  assertTransition,
  canTransition,
  isOpenStatus,
  isTerminalStatus,
} from './lifecycle.js';

describe('lead lifecycle (PRD 12)', () => {
  it('walks the canonical happy path', () => {
    const path = ['new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'customer'] as const;
    for (let i = 0; i < path.length - 1; i += 1) {
      expect(canTransition(path[i]!, path[i + 1]!), `${path[i]} → ${path[i + 1]}`).toEqual({
        allowed: true,
      });
    }
  });

  it('supports the warm/hot branch', () => {
    expect(canTransition('new', 'warm').allowed).toBe(true);
    expect(canTransition('warm', 'hot').allowed).toBe(true);
    expect(canTransition('hot', 'qualified').allowed).toBe(true);
  });

  it('allows loss from any open stage', () => {
    for (const status of ['new', 'contacted', 'qualified', 'proposal', 'negotiation'] as const) {
      expect(canTransition(status, 'lost').allowed).toBe(true);
    }
  });

  it('rejects skipping qualification', () => {
    expect(canTransition('new', 'won').allowed).toBe(false);
    expect(canTransition('new', 'negotiation').allowed).toBe(false);
  });

  it('will not move a won lead except to customer', () => {
    expect(canTransition('won', 'customer').allowed).toBe(true);
    expect(canTransition('won', 'negotiation').allowed).toBe(false);
    expect(canTransition('customer', 'new').allowed).toBe(false);
  });

  it('allows a lost deal to be re-opened', () => {
    expect(canTransition('lost', 'new').allowed).toBe(true);
    expect(canTransition('lost', 'qualified').allowed).toBe(true);
  });

  it('rejects a no-op transition', () => {
    expect(canTransition('qualified', 'qualified')).toEqual({ allowed: false, reason: 'no_change' });
  });

  it('rejects an unknown status', () => {
    expect(canTransition('nonsense' as never, 'new')).toEqual({
      allowed: false,
      reason: 'unknown_status',
    });
  });

  it('throws from assertTransition on an invalid move', () => {
    expect(() => assertTransition('new', 'won')).toThrow(/Invalid lead transition/);
    expect(() => assertTransition('new', 'contacted')).not.toThrow();
  });

  it('classifies open and terminal stages', () => {
    expect(isOpenStatus('qualified')).toBe(true);
    expect(isTerminalStatus('customer')).toBe(true);
    expect(isTerminalStatus('lost')).toBe(true);
    expect(isTerminalStatus('won')).toBe(true);
  });

  it('gives customer no outgoing transitions', () => {
    expect(allowedTransitions('customer')).toEqual([]);
  });
});