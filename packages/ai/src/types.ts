export type LeadGrade = 'A+' | 'A' | 'B' | 'C' | 'D';

export type LeadIntent = 'high' | 'medium' | 'low';

export type LeadUrgency = 'immediate' | 'soon' | 'later' | 'none';

export type BusinessFit = 'excellent' | 'good' | 'fair' | 'poor';

/**
 * Named, auditable scoring signals (PRD 15).
 *
 * Every input to the score must be a named signal with a fixed weight. This is
 * what keeps lead scoring deterministic and explainable: a sales rep can be
 * told exactly which signals moved a lead, and the same conversation always
 * produces the same number.
 *
 * Language-model output is a separate, later stage that *interprets* the
 * computed score — it never assigns one.
 */
export const SIGNAL_WEIGHTS = {
  requested_quotation: 20,
  asked_payment_information: 25,
  asked_implementation_timeline: 15,
  visited_pricing_page: 5,
  replied_whatsapp: 10,
  booked_consultation: 30,
  submitted_lead_form: 15,
  multi_contact_enquiry: 12,
  existing_customer_expansion: 18,
  replied_email: 8,
  browsed_catalogue: 6,
  abandoned_checkout: 20,
  no_engagement: -10,
  long_silence_after_quote: -12,
  said_not_interested: -30,
  competitor_mention: -5,
} as const satisfies Record<string, number>;

export type Signal = keyof typeof SIGNAL_WEIGHTS;

export const ALL_SIGNALS: readonly Signal[] = Object.keys(SIGNAL_WEIGHTS) as Signal[];

export type SignalSet = Partial<Record<Signal, boolean>>;

export interface ScoreBreakdownEntry {
  signal: Signal;
  weight: number;
}

export interface LeadScore {
  score: number;
  grade: LeadGrade;
  intent: LeadIntent;
  urgency: LeadUrgency;
  estimatedValue: number | null;
  conversionProbability: number;
  breakdown: ScoreBreakdownEntry[];
  nextBestAction: string;
  responseTargetMinutes: number;
}