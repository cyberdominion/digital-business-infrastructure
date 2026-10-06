import { describe, expect, it } from 'vitest';
import {
  AUTOMATION_ACTIONS,
  AUTOMATION_TRIGGERS,
  EXTERNAL_ACTIONS,
  actionSchema,
  conditionSchema,
  isExternalStep,
  stepSchema,
  triggerSchema,
  validateWorkflowSteps,
  workflowSchema,
  type Step,
} from './vocabulary.js';

const action = (order: number, name: (typeof AUTOMATION_ACTIONS)[number]): Step =>
  ({ order, kind: 'action', action: name, params: {} });

const condition = (order: number): Step => ({
  order,
  kind: 'condition',
  condition: { condition: 'field_greater_than', field: 'score', value: 80 },
  params: {},
});

describe('automation vocabulary (PRD 28–30)', () => {
  it('parses the PRD trigger list', () => {
    for (const trigger of AUTOMATION_TRIGGERS) {
      expect(triggerSchema.parse(trigger)).toBe(trigger);
    }
    expect(AUTOMATION_TRIGGERS).toContain('lead.created');
    expect(AUTOMATION_TRIGGERS).toContain('payment.succeeded');
    expect(AUTOMATION_TRIGGERS).toContain('referral.converted');
  });

  it('parses the PRD action list', () => {
    for (const name of AUTOMATION_ACTIONS) {
      expect(actionSchema.parse(name)).toBe(name);
    }
    expect(AUTOMATION_ACTIONS).toContain('send_whatsapp');
    expect(AUTOMATION_ACTIONS).toContain('run_ai');
  });

  it('parses conditions', () => {
    expect(conditionSchema.parse('field_greater_than')).toBe('field_greater_than');
    expect(conditionSchema.safeParse('field_vibes').success).toBe(false);
  });

  it('rejects an unknown action in a step', () => {
    expect(
      stepSchema.safeParse({ order: 0, kind: 'action', action: 'launch_rocket', params: {} }).success,
    ).toBe(false);
  });

  it('requires a uuid organization id on a whole workflow', () => {
    const base = { name: 'Hot lead routing', trigger: 'lead.created', steps: [action(0, 'assign_lead')] };
    expect(workflowSchema.safeParse({ ...base, organizationId: 'nope' }).success).toBe(false);
    expect(
      workflowSchema.safeParse({
        ...base,
        organizationId: '3f6b1a2c-9d4e-4f8a-b1c2-5e7d9a0b3c4d',
      }).success,
    ).toBe(true);
  });
});

describe('workflow validation', () => {
  it('accepts the PRD example: trigger, condition, then actions', () => {
    const steps = [condition(0), action(1, 'assign_lead'), action(2, 'send_whatsapp')];
    expect(validateWorkflowSteps(steps)).toEqual([]);
  });

  it('rejects a workflow with no action step', () => {
    expect(validateWorkflowSteps([condition(0)])).toContain('A workflow needs at least one action step.');
  });

  it('rejects a condition placed after an action', () => {
    const steps = [action(0, 'send_whatsapp'), condition(1)];
    expect(validateWorkflowSteps(steps)).toContain('Condition steps must come before action steps.');
  });

  it('rejects duplicate step order values', () => {
    const steps = [action(0, 'send_email'), action(0, 'send_sms')];
    expect(validateWorkflowSteps(steps)).toContain('Step order values must be unique.');
  });

  it('reports a condition step with no definition', () => {
    const broken: Step = { order: 0, kind: 'condition', params: {} };
    expect(validateWorkflowSteps([broken, action(1, 'send_email')])).toContain(
      'Step 0 is a condition but has no condition definition.',
    );
  });

  it('reports an action step with no action type', () => {
    const broken: Step = { order: 0, kind: 'action', params: {} };
    expect(validateWorkflowSteps([broken])).toEqual([
      'Step 0 is an action but has no action type.',
    ]);
  });

  it('reports both faults when a workflow has no usable action', () => {
    const broken: Step[] = [{ order: 0, kind: 'condition', params: {} }];
    expect(validateWorkflowSteps(broken)).toEqual([
      'A workflow needs at least one action step.',
      'Step 0 is a condition but has no condition definition.',
    ]);
  });
});

describe('external steps', () => {
  it('flags the channels that leave the platform and need retries', () => {
    expect(isExternalStep(action(0, 'send_whatsapp'))).toBe(true);
    expect(isExternalStep(action(1, 'send_email'))).toBe(true);
    expect(isExternalStep(action(2, 'call_webhook'))).toBe(true);
  });

  it('does not flag in-database actions', () => {
    expect(isExternalStep(action(0, 'create_task'))).toBe(false);
    expect(isExternalStep(action(1, 'update_customer'))).toBe(false);
    expect(isExternalStep(condition(0))).toBe(false);
  });

  it('keeps the external set in step with the action list', () => {
    for (const name of EXTERNAL_ACTIONS) {
      expect(AUTOMATION_ACTIONS).toContain(name);
    }
  });
});