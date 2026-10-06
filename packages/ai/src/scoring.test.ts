import { describe, expect, it } from 'vitest';
import {
  ALL_SIGNALS,
  SIGNAL_WEIGHTS,
  type LeadScore,
  type Signal,
  type SignalSet,
} from './types.js';
import {
  computeScore,
  conversionProbabilityFor,
  gradeFor,
  intentFor,
  nextBestActionFor,
  responseTargetMinutesFor,
  scoreLead,
  urgencyFor,
} from './scoring.js';

const allActive: SignalSet = Object.fromEntries(ALL_SIGNALS.map((s) => [s, true]));

describe('deterministic scoring (PRD 15)', () => {
  it('is pure: the same signals always produce the same score', () => {
    const signals: SignalSet = { requested_quotation: true, replied_whatsapp: true };
    expect(computeScore(signals)).toBe(computeScore(signals));
  });

  it('scores 0 for an unknown lead', () => {
    expect(computeScore({})).toBe(0);
    expect(gradeFor(0)).toBe('D');
    expect(intentFor(0)).toBe('low');
  });

  it('matches the PRD worked example: Mary, fashion retailer', () => {
    const signals: SignalSet = {
      requested_quotation: true,
      asked_payment_information: true,
      asked_implementation_timeline: true,
      visited_pricing_page: true,
      replied_whatsapp: true,
    };

    const result = scoreLead({ signals });

    expect(result.score).toBe(75);
    expect(result.grade).toBe('A');
    expect(result.intent).toBe('high');
    expect(result.urgency).toBe('immediate');
    expect(result.responseTargetMinutes).toBe(15);
    expect(result.conversionProbability).toBeCloseTo(0.75);
  });

  it('applies the PRD weights exactly', () => {
    expect(SIGNAL_WEIGHTS.requested_quotation).toBe(20);
    expect(SIGNAL_WEIGHTS.asked_payment_information).toBe(25);
    expect(SIGNAL_WEIGHTS.asked_implementation_timeline).toBe(15);
    expect(SIGNAL_WEIGHTS.visited_pricing_page).toBe(5);
    expect(SIGNAL_WEIGHTS.replied_whatsapp).toBe(10);
    expect(SIGNAL_WEIGHTS.no_engagement).toBe(-10);
    expect(SIGNAL_WEIGHTS.said_not_interested).toBe(-30);
  });

  it('clamps into 0–100', () => {
    expect(computeScore(allActive)).toBe(100);
    expect(computeScore({ said_not_interested: true, no_engagement: true })).toBe(0);
  });

  it('handles a non-finite raw total without producing NaN', () => {
    expect(computeScore({})).toBe(0);
    expect(Number.isNaN(scoreLead({ signals: {} }).score)).toBe(false);
  });

  it('reports the signals that moved the score', () => {
    const result = scoreLead({ signals: { requested_quotation: true, visited_pricing_page: true } });
    const signals: Signal[] = result.breakdown.map((entry) => entry.signal);
    expect(signals).toEqual(['requested_quotation', 'visited_pricing_page']);
    expect(result.breakdown.reduce((t, e) => t + e.weight, 0)).toBe(result.score);
  });

  it('ignores signals that are present but false', () => {
    expect(computeScore({ requested_quotation: false })).toBe(0);
  });
});

describe('grading bands', () => {
  it.each([
    [100, 'A+'],
    [90, 'A+'],
    [89, 'A'],
    [75, 'A'],
    [74, 'B'],
    [60, 'B'],
    [59, 'C'],
    [40, 'C'],
    [39, 'D'],
    [0, 'D'],
  ])('grades %i as %s', (score, grade) => {
    expect(gradeFor(score)).toBe(grade);
  });
});

describe('intent bands', () => {
  it.each([
    [75, 'high'],
    [100, 'high'],
    [74, 'medium'],
    [40, 'medium'],
    [39, 'low'],
    [0, 'low'],
  ])('maps %i to %s intent', (score, intent) => {
    expect(intentFor(score)).toBe(intent);
  });
});

describe('urgency reads signals, not just the number', () => {
  it('is immediate for a high-intent buyer asking about payment', () => {
    expect(urgencyFor(80, { asked_payment_information: true })).toBe('immediate');
  });

  it('is not immediate for a high score built only from passive signals', () => {
    expect(urgencyFor(80, { visited_pricing_page: true, browsed_catalogue: true })).toBe('soon');
  });

  it('is none when the lead explicitly declined', () => {
    expect(urgencyFor(95, { said_not_interested: true, asked_payment_information: true })).toBe('none');
  });

  it('is none when there is no engagement at all', () => {
    expect(urgencyFor(0, { no_engagement: true })).toBe('none');
  });
});

describe('next best action and response targets', () => {
  it('tells a rep to act now on a payment enquiry', () => {
    expect(nextBestActionFor('immediate', { asked_payment_information: true })).toMatch(/payment/i);
  });

  it('tells a rep to act now on an abandoned checkout', () => {
    expect(nextBestActionFor('immediate', { abandoned_checkout: true })).toMatch(/checkout/i);
  });

  it('nurtures a cold lead rather than spending sales time', () => {
    expect(nextBestActionFor('none', { said_not_interested: true })).toMatch(/do not spend sales time/i);
  });

  it('shortens the response target as urgency rises', () => {
    const targets = (['none', 'later', 'soon', 'immediate'] as const).map(responseTargetMinutesFor);
    expect(targets).toEqual([...targets].sort((a, b) => b - a));
  });
});

describe('scoreLead output shape', () => {
  it('is a complete, serialisable assessment', () => {
    const result: LeadScore = scoreLead({
      signals: { requested_quotation: true },
      estimatedValue: 250_000,
    });

    expect(result).toMatchObject({
      score: 20,
      grade: 'D',
      intent: 'low',
      estimatedValue: 250_000,
    });
    expect(result.conversionProbability).toBeCloseTo(0.2);
    expect(result.nextBestAction).toBeTruthy();
    expect(() => JSON.stringify(result)).not.toThrow();
  });

  it('keeps estimatedValue out of the score itself', () => {
    const cheap = scoreLead({ signals: { requested_quotation: true }, estimatedValue: 1_000 });
    const expensive = scoreLead({ signals: { requested_quotation: true }, estimatedValue: 9_000_000 });
    expect(cheap.score).toBe(expensive.score);
  });

  it('nulls an absent estimatedValue', () => {
    expect(scoreLead({ signals: {} }).estimatedValue).toBeNull();
  });
});

describe('conversion probability', () => {
  it('tracks the score and stays within 0–1', () => {
    expect(conversionProbabilityFor(0)).toBe(0);
    expect(conversionProbabilityFor(100)).toBe(1);
    expect(conversionProbabilityFor(140)).toBe(1);
    expect(conversionProbabilityFor(-20)).toBe(0);
  });
});