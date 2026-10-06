import { describe, expect, it } from 'vitest';
import {
  METRIC_KEYS,
  METRICS_BY_CATEGORY,
  METRICS_BY_KEY,
  METRICS_DICTIONARY,
  PRIORITY_P0_COUNT,
  isMetricKey,
  type MetricKey,
} from './metrics.js';

const EXPECTED_KEYS = [
  'new_leads',
  'lead_response_time',
  'qualification_rate',
  'lead_to_customer_conversion',
  'deal_win_rate',
  'pipeline_value',
  'sales_cycle_length',
  'revenue_collected',
  'orders',
  'average_order_value',
  'outstanding_balances',
  'payment_success_rate',
  'lead_source_performance',
  'mrr_platform',
  'activation_rate',
  'total_organizations',
  'support_tickets_open',
] as const;

describe('metrics dictionary (PRD 19)', () => {
  it('contains every metric defined in PRD 19.1', () => {
    expect(METRIC_KEYS).toHaveLength(EXPECTED_KEYS.length);
    for (const key of EXPECTED_KEYS) {
      expect(METRIC_KEYS, `missing metric ${key}`).toContain(key);
    }
  });

  it('exposes each metric with the fields PRD 19.1 requires', () => {
    for (const metric of METRICS_DICTIONARY) {
      expect(metric.key, `metric ${metric.key} missing key`).toBeTruthy();
      expect(metric.label).toBeTruthy();
      expect(metric.definition).toBeTruthy();
      expect(metric.formula).toBeTruthy();
      expect(metric.sourceTables).toEqual(
        expect.arrayContaining([expect.any(String)]),
      );
      expect(['tenant', 'platform', 'global']).toContain(metric.tenantScope);
      expect(['P0', 'P1', 'P2']).toContain(metric.priority);
      expect(metric.owner).toBeTruthy();
    }
  });

  it('has no duplicate keys (would split the same metric into two definitions)', () => {
    const seen = new Set<string>();
    for (const key of METRIC_KEYS) {
      expect(seen.has(key), `duplicate metric key ${key}`).toBe(false);
      seen.add(key);
    }
  });

  it('marks every production-surface metric as P0 or P1 (PRD 19: shown in production)', () => {
    for (const metric of METRICS_DICTIONARY) {
      expect(metric.priority, `${metric.key} must be P0/P1 for production display`).not.toBe('P2');
    }
  });

  it('counts the expected number of P0 metrics', () => {
    expect(PRIORITY_P0_COUNT).toBe(13);
  });

  it('indexes metrics by key and by category', () => {
    expect(METRICS_BY_KEY['new_leads'].label).toBe('New leads');
    expect(METRICS_BY_CATEGORY['sales']).toEqual(
      expect.arrayContaining([expect.objectContaining({ key: 'deal_win_rate' })]),
    );
    expect(METRICS_BY_CATEGORY['sales'].length).toBeGreaterThan(0);
  });

  it('isMetricKey validates against the dictionary only', () => {
    expect(isMetricKey('new_leads')).toBe(true);
    expect(isMetricKey('does_not_exist')).toBe(false);
    expect(isMetricKey(undefined)).toBe(false);
  });

  it('exports a stable MetricKey type', () => {
    const key: MetricKey = 'mrr_platform';
    expect(METRIC_KEYS).toContain(key);
  });
});
