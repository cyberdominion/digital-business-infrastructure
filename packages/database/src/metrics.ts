export type MetricCategory =
  | 'growth'
  | 'operations'
  | 'sales'
  | 'commerce'
  | 'revenue'
  | 'payments'
  | 'platform'
  | 'ai'
  | 'marketing'
  | 'support';

export type TenantScope = 'tenant' | 'platform' | 'global';

export type MetricPriority = 'P0' | 'P1' | 'P2';

export interface Metric {
  readonly key: string;
  readonly category: MetricCategory;
  readonly label: string;
  readonly definition: string;
  readonly formula: string;
  readonly sourceTables: readonly string[];
  readonly filters: string | null;
  readonly tenantScope: TenantScope;
  readonly timeWindow: string;
  readonly refreshFrequency: string;
  readonly currencyTreatment: string;
  readonly priority: MetricPriority;
  readonly owner: string;
}

export const METRICS_DICTIONARY = [
  {
    key: 'new_leads',
    category: 'growth',
    label: 'New leads',
    definition: 'Count of new leads created in a period.',
    formula: 'count(leads created in period)',
    sourceTables: ['leads'],
    filters: 'Excludes soft-deleted and merged-away duplicates',
    tenantScope: 'tenant',
    timeWindow: 'Selectable, tenant tz',
    refreshFrequency: 'Materialized view, refreshed 5-15 min',
    currencyTreatment: 'Count (no currency)',
    priority: 'P0',
    owner: 'CRM',
  },
  {
    key: 'lead_response_time',
    category: 'operations',
    label: 'Lead response time',
    definition: 'Median time from lead creation to the first outbound activity.',
    formula: 'median(first_outbound_activity_at - lead.created_at)',
    sourceTables: ['leads', 'activities'],
    filters: null,
    tenantScope: 'tenant',
    timeWindow: 'Selected period',
    refreshFrequency: 'Materialized view, refreshed 5-15 min',
    currencyTreatment: 'Duration',
    priority: 'P0',
    owner: 'CRM',
  },
  {
    key: 'qualification_rate',
    category: 'growth',
    label: 'Qualification rate',
    definition: 'Share of created leads that reached qualified status, cohort-based.',
    formula: 'qualified leads converted / total qualified leads (cohort month)',
    sourceTables: ['lead_status_history'],
    filters: 'Cohort-based, not point-in-time',
    tenantScope: 'tenant',
    timeWindow: 'Cohort month',
    refreshFrequency: 'Materialized view, refreshed 5-15 min',
    currencyTreatment: 'Ratio',
    priority: 'P0',
    owner: 'CRM',
  },
  {
    key: 'lead_to_customer_conversion',
    category: 'growth',
    label: 'Lead-to-customer conversion',
    definition: 'Share of created leads that became customers within N days (default 90).',
    formula: 'customers within N days / leads created in cohort',
    sourceTables: ['leads', 'customers'],
    filters: 'Cohort, default N=90 days',
    tenantScope: 'tenant',
    timeWindow: 'Cohort month, N=90 default',
    refreshFrequency: 'Materialized view, refreshed 5-15 min',
    currencyTreatment: 'Ratio',
    priority: 'P0',
    owner: 'CRM',
  },
  {
    key: 'deal_win_rate',
    category: 'sales',
    label: 'Deal win rate',
    definition: 'Closed-won deals divided by all closed deals in the period.',
    formula: 'deals won / (won + lost) closed in period',
    sourceTables: ['deals'],
    filters: 'Closed date; excludes open deals',
    tenantScope: 'tenant',
    timeWindow: 'Closed date',
    refreshFrequency: 'Materialized view, refreshed 5-15 min',
    currencyTreatment: 'Ratio',
    priority: 'P0',
    owner: 'CRM',
  },
  {
    key: 'pipeline_value',
    category: 'sales',
    label: 'Pipeline value',
    definition: 'Total weighted pipeline value (sum of stage probability x value).',
    formula: 'sum(value x probability) for open deals',
    sourceTables: ['deals'],
    filters: 'Open deals',
    tenantScope: 'tenant',
    timeWindow: 'Current snapshot',
    refreshFrequency: 'Real-time query',
    currencyTreatment: 'Currency',
    priority: 'P0',
    owner: 'CRM',
  },
  {
    key: 'sales_cycle_length',
    category: 'sales',
    label: 'Sales cycle length',
    definition: 'Median elapsed time between deal creation and close for won deals.',
    formula: 'median(closed_at - created_at) of won deals',
    sourceTables: ['deals'],
    filters: 'Won deals only',
    tenantScope: 'tenant',
    timeWindow: 'Closed date',
    refreshFrequency: 'Materialized view, refreshed 5-15 min',
    currencyTreatment: 'Duration',
    priority: 'P0',
    owner: 'CRM',
  },
  {
    key: 'revenue_collected',
    category: 'revenue',
    label: 'Revenue (collected)',
    definition: 'Sum of successful payments minus refunds.',
    formula: 'sum(succeeded payments - refunds)',
    sourceTables: ['payments', 'refunds'],
    filters: 'payment date',
    tenantScope: 'tenant',
    timeWindow: 'Payment date',
    refreshFrequency: 'Materialized view, refreshed 5-15 min',
    currencyTreatment: 'Native currency; FX-converted total shown separately',
    priority: 'P0',
    owner: 'Finance',
  },
  {
    key: 'orders',
    category: 'commerce',
    label: 'Orders',
    definition: 'Count of orders in paid+ states in the period.',
    formula: 'count(orders in paid + states)',
    sourceTables: ['orders'],
    filters: 'Order status in paid+',
    tenantScope: 'tenant',
    timeWindow: 'Order date',
    refreshFrequency: 'Materialized view, refreshed 5-15 min',
    currencyTreatment: 'Count (no currency)',
    priority: 'P0',
    owner: 'Commerce',
  },
  {
    key: 'average_order_value',
    category: 'commerce',
    label: 'Average order value',
    definition: 'Collected revenue divided by paid orders.',
    formula: 'revenue / paid orders',
    sourceTables: ['orders', 'payments'],
    filters: 'Paid orders',
    tenantScope: 'tenant',
    timeWindow: 'Period',
    refreshFrequency: 'Materialized view, refreshed 5-15 min',
    currencyTreatment: 'Currency',
    priority: 'P0',
    owner: 'Commerce',
  },
  {
    key: 'outstanding_balances',
    category: 'commerce',
    label: 'Outstanding balances',
    definition: 'Sum of order total minus paid for open orders.',
    formula: 'sum(order total - paid) for open orders',
    sourceTables: ['orders', 'payments'],
    filters: 'Open orders',
    tenantScope: 'tenant',
    timeWindow: 'Current snapshot',
    refreshFrequency: 'Real-time query',
    currencyTreatment: 'Currency',
    priority: 'P1',
    owner: 'Commerce',
  },
  {
    key: 'payment_success_rate',
    category: 'payments',
    label: 'Payment success rate',
    definition: 'Successful payment attempts divided by all attempts in the period.',
    formula: 'succeeded / attempts',
    sourceTables: ['payment_attempts'],
    filters: 'Period',
    tenantScope: 'tenant',
    timeWindow: 'Period',
    refreshFrequency: 'Materialized view, refreshed 5-15 min',
    currencyTreatment: 'Ratio',
    priority: 'P0',
    owner: 'Payments',
  },
  {
    key: 'lead_source_performance',
    category: 'growth',
    label: 'Lead source performance',
    definition: 'Leads, conversion, and revenue broken down by lead source.',
    formula: 'leads, conversion, revenue by source',
    sourceTables: ['leads', 'orders'],
    filters: 'Period',
    tenantScope: 'tenant',
    timeWindow: 'Period',
    refreshFrequency: 'Materialized view, refreshed 5-15 min',
    currencyTreatment: 'Multi-metric',
    priority: 'P1',
    owner: 'Marketing',
  },
  {
    key: 'mrr_platform',
    category: 'platform',
    label: 'MRR (platform)',
    definition: 'Sum of the normalized monthly price of active subscriptions.',
    formula: 'sum(normalized monthly price of active subscriptions)',
    sourceTables: ['subscriptions'],
    filters: 'subscription status = active',
    tenantScope: 'platform',
    timeWindow: 'Current snapshot',
    refreshFrequency: 'Real-time query',
    currencyTreatment: 'Currency',
    priority: 'P0',
    owner: 'Billing',
  },
  {
    key: 'activation_rate',
    category: 'growth',
    label: 'Activation rate',
    definition: 'Share of onboarded tenants that reached the activation definition.',
    formula: 'activated tenants / tenants onboarded in cohort',
    sourceTables: ['organizations'],
    filters: 'Cohort, see Section 28',
    tenantScope: 'platform',
    timeWindow: 'Cohort',
    refreshFrequency: 'Materialized view, refreshed 5-15 min',
    currencyTreatment: 'Ratio',
    priority: 'P1',
    owner: 'Product',
  },
  {
    key: 'total_organizations',
    category: 'platform',
    label: 'Total organizations',
    definition: 'Count of all organizations ever created.',
    formula: 'count(organizations)',
    sourceTables: ['organizations'],
    filters: 'None',
    tenantScope: 'platform',
    timeWindow: 'Current snapshot',
    refreshFrequency: 'Real-time query',
    currencyTreatment: 'Count (no currency)',
    priority: 'P0',
    owner: 'Growth',
  },
  {
    key: 'support_tickets_open',
    category: 'operations',
    label: 'Open support tickets',
    definition: 'Count of open support tickets.',
    formula: 'count(open tickets)',
    sourceTables: ['support_tickets'],
    filters: 'status = open',
    tenantScope: 'platform',
    timeWindow: 'Current snapshot',
    refreshFrequency: 'Real-time query',
    currencyTreatment: 'Count (no currency)',
    priority: 'P1',
    owner: 'Support',
  },
] as const;

export type MetricKey = (typeof METRICS_DICTIONARY)[number]['key'];

export const METRIC_KEYS: readonly MetricKey[] = METRICS_DICTIONARY.map((m) => m.key);

export const METRICS_BY_KEY: Readonly<Record<string, Metric>> = Object.fromEntries(
  METRICS_DICTIONARY.map((m) => [m.key, m as Metric]),
);

export const METRICS_BY_CATEGORY: Readonly<Record<MetricCategory, readonly Metric[]>> = (() => {
  const byCat: Partial<Record<MetricCategory, Metric[]>> = {};
  for (const metric of METRICS_DICTIONARY) {
    const bucket = byCat[metric.category] ?? [];
    bucket.push(metric as Metric);
    byCat[metric.category] = bucket;
  }
  return byCat as Record<MetricCategory, readonly Metric[]>;
})();

export function isMetricKey(value: unknown): value is MetricKey {
  return typeof value === 'string' && value in METRICS_BY_KEY;
}

export const PRIORITY_P0_COUNT: number = METRICS_DICTIONARY.filter(
  (m) => m.priority === 'P0',
).length;
