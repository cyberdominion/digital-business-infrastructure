import {
  ALL_SIGNALS,
  SIGNAL_WEIGHTS,
  type LeadGrade,
  type LeadIntent,
  type LeadScore,
  type LeadUrgency,
  type Signal,
  type SignalSet,
} from './types.js';

export const SCORE_MIN = 0;
export const SCORE_MAX = 100;

const GRADE_THRESHOLDS: ReadonlyArray<{ min: number; grade: LeadGrade }> = [
  { min: 90, grade: 'A+' },
  { min: 75, grade: 'A' },
  { min: 60, grade: 'B' },
  { min: 40, grade: 'C' },
  { min: 0, grade: 'D' },
];

export function gradeFor(score: number): LeadGrade {
  const clamped = clampScore(score);
  return GRADE_THRESHOLDS.find(({ min }) => clamped >= min)?.grade ?? 'D';
}

export function clampScore(score: number): number {
  if (!Number.isFinite(score)) return SCORE_MIN;
  return Math.min(SCORE_MAX, Math.max(SCORE_MIN, Math.round(score)));
}

/**
 * Sum the active signal weights, then clamp into 0–100.
 *
 * Kept pure and synchronous: identical input always yields identical output, so
 * the result is safe to cache on `lead_scores` and to assert on in tests.
 */
export function computeRawScore(signals: SignalSet): { raw: number; breakdown: LeadScore['breakdown'] } {
  const breakdown = ALL_SIGNALS.filter((signal) => signals[signal] === true).map((signal) => ({
    signal,
    weight: SIGNAL_WEIGHTS[signal],
  }));

  const raw = breakdown.reduce((total, entry) => total + entry.weight, 0);
  return { raw, breakdown };
}

export function computeScore(signals: SignalSet): number {
  return clampScore(computeRawScore(signals).raw);
}

export function intentFor(score: number): LeadIntent {
  if (score >= 75) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

const IMMEDIATE_SIGNALS: readonly Signal[] = [
  'asked_payment_information',
  'booked_consultation',
  'abandoned_checkout',
  'requested_quotation',
];

const SOON_SIGNALS: readonly Signal[] = [
  'asked_implementation_timeline',
  'replied_whatsapp',
  'multi_contact_enquiry',
  'submitted_lead_form',
];

/**
 * Urgency combines score with specific signals.
 *
 * A high score driven purely by passive signals is still not urgent, which is
 * why this reads the signal set rather than only the number.
 */
export function urgencyFor(score: number, signals: SignalSet): LeadUrgency {
  const has = (signal: Signal) => signals[signal] === true;

  if (has('said_not_interested')) return 'none';
  if (IMMEDIATE_SIGNALS.some(has) && score >= 60) return 'immediate';
  if (SOON_SIGNALS.some(has) || score >= 75) return 'soon';
  if (has('no_engagement') || score < 20) return 'none';
  return 'later';
}

export function conversionProbabilityFor(score: number): number {
  return Number((clampScore(score) / 100).toFixed(4));
}

const RESPONSE_TARGETS: Record<LeadUrgency, number> = {
  immediate: 15,
  soon: 60,
  later: 1440,
  none: 10080,
};

export function responseTargetMinutesFor(urgency: LeadUrgency): number {
  return RESPONSE_TARGETS[urgency];
}

const NEXT_BEST_ACTIONS: Record<LeadUrgency, string> = {
  immediate: 'Contact now and send the quotation they asked for.',
  soon: 'Contact today and confirm requirements and timeline.',
  later: 'Add to the nurture sequence and schedule a check-in.',
  none: 'Hold for re-engagement; do not spend sales time now.',
};

export function nextBestActionFor(urgency: LeadUrgency, signals: SignalSet): string {
  if (urgency === 'immediate' && signals.asked_payment_information === true) {
    return 'Contact now — they asked for payment information. Send payment options and a next step.';
  }
  if (urgency === 'immediate' && signals.abandoned_checkout === true) {
    return 'Contact now — they abandoned checkout. Offer to complete the order for them.';
  }
  return NEXT_BEST_ACTIONS[urgency];
}

export interface ScoreLeadInput {
  signals: SignalSet;
  estimatedValue?: number | null;
}

/**
 * Full deterministic lead score.
 *
 * `estimatedValue` is carried through untouched rather than folded into the
 * score: a large deal is not automatically a good deal, and mixing the two
 * makes the number unexplainable to the rep reading it.
 */
export function scoreLead({ signals, estimatedValue = null }: ScoreLeadInput): LeadScore {
  const { breakdown } = computeRawScore(signals);
  const score = clampScore(breakdown.reduce((total, entry) => total + entry.weight, 0));
  const urgency = urgencyFor(score, signals);

  return {
    score,
    grade: gradeFor(score),
    intent: intentFor(score),
    urgency,
    estimatedValue: typeof estimatedValue === 'number' ? estimatedValue : null,
    conversionProbability: conversionProbabilityFor(score),
    breakdown,
    nextBestAction: nextBestActionFor(urgency, signals),
    responseTargetMinutes: responseTargetMinutesFor(urgency),
  };
}
