import { z } from 'zod';

/**
 * Automation vocabulary (PRD 28–30).
 *
 * A workflow is `[Trigger] → [Condition]* → [Action]*`. Types are declared once
 * here and shared by the visual builder, the runner, and the database
 * `automations` / `automation_steps` tables, so a workflow saved by the builder
 * cannot drift from what the executor understands.
 */

export const AUTOMATION_TRIGGERS = [
  'lead.created',
  'lead.status_changed',
  'lead.score_changed',
  'form.submitted',
  'payment.succeeded',
  'payment.failed',
  'order.created',
  'order.completed',
  'customer.inactive',
  'referral.converted',
  'appointment.booked',
  'contact.customer_birthday',
  'subscription.expiring',
] as const;

export type AutomationTrigger = (typeof AUTOMATION_TRIGGERS)[number];

export const AUTOMATION_ACTIONS = [
  'send_email',
  'send_whatsapp',
  'send_sms',
  'create_lead',
  'update_lead',
  'assign_lead',
  'create_task',
  'update_customer',
  'create_order',
  'notify_admin',
  'notify_user',
  'call_webhook',
  'run_ai',
  'start_workflow',
] as const;

export type AutomationAction = (typeof AUTOMATION_ACTIONS)[number];

export const AUTOMATION_CONDITIONS = [
  'field_equals',
  'field_not_equals',
  'field_greater_than',
  'field_less_than',
  'field_in',
  'field_contains',
  'field_exists',
] as const;

export type AutomationCondition = (typeof AUTOMATION_CONDITIONS)[number];

/** Actions that leave the platform and therefore need a delivery guarantee. */
export const EXTERNAL_ACTIONS: ReadonlySet<AutomationAction> = new Set([
  'send_email',
  'send_whatsapp',
  'send_sms',
  'call_webhook',
]);

export const triggerSchema = z.enum(AUTOMATION_TRIGGERS);
export const actionSchema = z.enum(AUTOMATION_ACTIONS);
export const conditionSchema = z.enum(AUTOMATION_CONDITIONS);

export const conditionSchemaDetailed = z.object({
  condition: conditionSchema,
  field: z.string().min(1),
  value: z.unknown().optional(),
});

export const stepSchema = z.object({
  order: z.number().int().nonnegative(),
  kind: z.enum(['condition', 'action']),
  condition: conditionSchemaDetailed.optional(),
  action: actionSchema.optional(),
  params: z.record(z.string(), z.unknown()).default({}),
});

export type Step = z.infer<typeof stepSchema>;

export const workflowSchema = z.object({
  organizationId: z.string().uuid(),
  name: z.string().min(1).max(120),
  trigger: triggerSchema,
  steps: z.array(stepSchema).min(1),
  active: z.boolean().default(false),
});

export type Workflow = z.infer<typeof workflowSchema>;

/**
 * A workflow must have at least one action, and an external action must come
 * after its conditions — otherwise the rule would fire a WhatsApp message before
 * the lead passed the score threshold.
 */
export function validateWorkflowSteps(steps: readonly Step[]): string[] {
  const errors: string[] = [];

  if (!steps.some((step) => step.kind === 'action')) {
    errors.push('A workflow needs at least one action step.');
  }

  const firstActionIndex = steps.findIndex((step) => step.kind === 'action');
  const lastConditionIndex = steps.map((step) => step.kind).lastIndexOf('condition');

  if (firstActionIndex !== -1 && lastConditionIndex > firstActionIndex) {
    errors.push('Condition steps must come before action steps.');
  }

  const orders = steps.map((step) => step.order);
  if (new Set(orders).size !== orders.length) {
    errors.push('Step order values must be unique.');
  }

  for (const step of steps) {
    if (step.kind === 'condition' && !step.condition) {
      errors.push(`Step ${step.order} is a condition but has no condition definition.`);
    }
    if (step.kind === 'action' && !step.action) {
      errors.push(`Step ${step.order} is an action but has no action type.`);
    }
  }

  return errors;
}

/** True when a step needs a delivery record / retry policy (PRD Sprint 7). */
export function isExternalStep(step: Step): boolean {
  return step.kind === 'action' && step.action !== undefined && EXTERNAL_ACTIONS.has(step.action);
}