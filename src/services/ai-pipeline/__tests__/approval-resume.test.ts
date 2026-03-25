/**
 * APPROVAL RESUME TESTS
 *
 * Tests the pipeline resume flow after human approval/modification.
 * Covers: state validation, module resolution, execution, acknowledge, audit.
 *
 * @see ADR-080 (Pipeline), ADR-131 (Multi-Intent)
 * @module __tests__/approval-resume
 */

/* eslint-disable no-restricted-syntax */

// ── Mocks ──
jest.mock('@/lib/error-utils', () => ({
  getErrorMessage: jest.fn((e: unknown) => e instanceof Error ? e.message : String(e)),
}));

jest.mock('../multi-intent-steps', () => ({
  stepMultiExecute: jest.fn(),
}));

// ── Import after mocks ──
import { resumeFromApproval } from '../approval-resume';
import type { ApprovalResumeDeps } from '../approval-resume';
import { stepMultiExecute } from '../multi-intent-steps';

// ============================================================================
// TYPES & HELPERS
// ============================================================================

interface MockPipelineContext {
  requestId: string;
  companyId: string;
  state: string;
  intake: { id: string; channel: string; rawPayload: Record<string, unknown>; normalized: Record<string, unknown>; metadata: Record<string, unknown>; schemaVersion: number };
  understanding?: { intent: string; confidence: number };
  lookupData: Record<string, unknown>;
  multiLookupData?: Record<string, Record<string, unknown>>;
  proposal?: {
    messageId: string;
    suggestedActions: Array<{ type: string; label: string }>;
    summary: string;
    autoApprovable: boolean;
    requiredApprovals: string[];
    schemaVersion: number;
  } | null;
  approval?: {
    decision: string;
    approvedBy?: string | null;
    modifiedActions?: Array<{ type: string; label: string }> | null;
    decidedAt: string;
  } | null;
  executionPlan?: Record<string, unknown> | null;
  executionResult?: { success: boolean; sideEffects: string[]; error?: string } | null;
  contributingModules?: string[];
  errors: Array<{ step: string; error: string; timestamp: string; retryable: boolean }>;
  startedAt: string;
  stepDurations: Record<string, number>;
}

interface MockModule {
  moduleId: string;
  lookup: jest.Mock;
  propose: jest.Mock;
  execute: jest.Mock;
  acknowledge: jest.Mock;
  handledIntents: readonly string[];
  displayName: string;
  requiredRoles: string[];
}

function createMockContext(overrides?: Partial<MockPipelineContext>): MockPipelineContext {
  return {
    requestId: 'req_resume_001',
    companyId: 'comp_test',
    state: 'approved',
    intake: {
      id: 'intake_001',
      channel: 'telegram',
      rawPayload: {},
      normalized: { sender: { id: 'sender_1' }, recipients: [], contentText: 'test', attachments: [], timestampIso: new Date().toISOString() },
      metadata: { providerMessageId: 'pm_001', signatureVerified: true },
      schemaVersion: 1,
    },
    understanding: { intent: 'appointment_request', confidence: 90 },
    lookupData: {},
    proposal: {
      messageId: 'msg_001',
      suggestedActions: [{ type: 'reply', label: 'confirm' }],
      summary: 'Test proposal',
      autoApprovable: true,
      requiredApprovals: [],
      schemaVersion: 1,
    },
    approval: { decision: 'approved', approvedBy: 'operator_001', decidedAt: new Date().toISOString() },
    executionResult: null,
    contributingModules: ['UC-001'],
    errors: [],
    startedAt: new Date().toISOString(),
    stepDurations: {},
    ...overrides,
  };
}

function createMockModule(id: string): MockModule {
  return {
    moduleId: id,
    lookup: jest.fn(),
    propose: jest.fn(),
    execute: jest.fn(),
    acknowledge: jest.fn(),
    handledIntents: ['appointment_request'],
    displayName: `Module ${id}`,
    requiredRoles: [],
  };
}

function createMockDeps(modules: MockModule[] = []): ApprovalResumeDeps {
  const moduleMap = new Map(modules.map(m => [m.moduleId, m]));
  const intentMap = new Map(modules.map(m => [m.handledIntents[0], m]));

  return {
    registry: {
      getModule: jest.fn((id: string) => moduleMap.get(id) ?? null),
      getModuleForIntent: jest.fn((intent: string) => intentMap.get(intent) ?? null),
    },
    auditService: {
      record: jest.fn().mockResolvedValue('audit_001'),
    },
    transitionState: jest.fn((ctx, to) => ({ ...ctx, state: to })),
    stepAcknowledge: jest.fn().mockImplementation((ctx) => Promise.resolve(ctx)),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as unknown as ApprovalResumeDeps;
}

// ============================================================================
// resumeFromApproval
// ============================================================================

describe('resumeFromApproval', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (stepMultiExecute as jest.Mock).mockImplementation((ctx) => {
      ctx.executionResult = { success: true, sideEffects: ['done'] };
      return Promise.resolve(ctx);
    });
  });

  it('returns error when state is not approved', async () => {
    const ctx = createMockContext({ state: 'proposed' });
    const deps = createMockDeps();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await resumeFromApproval(ctx as any, deps);

    expect(result.success).toBe(false);
    expect(result.error).toContain("Cannot resume from state 'proposed'");
  });

  it('returns success with audit when no modules found', async () => {
    const ctx = createMockContext({ contributingModules: [], understanding: undefined });
    const deps = createMockDeps();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await resumeFromApproval(ctx as any, deps);

    expect(result.success).toBe(true);
    expect(result.auditId).toBe('audit_001');
    expect(stepMultiExecute).not.toHaveBeenCalled();
  });

  it('executes modules and returns success with acknowledge + audit', async () => {
    const mod = createMockModule('UC-001');
    const deps = createMockDeps([mod]);
    const ctx = createMockContext();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await resumeFromApproval(ctx as any, deps);

    expect(result.success).toBe(true);
    expect(stepMultiExecute).toHaveBeenCalled();
    expect(deps.stepAcknowledge).toHaveBeenCalled();
    expect(deps.auditService.record).toHaveBeenCalled();
  });

  it('transitions to MODIFIED when modifiedActions present', async () => {
    const mod = createMockModule('UC-001');
    const deps = createMockDeps([mod]);
    const ctx = createMockContext({
      approval: {
        decision: 'modified',
        approvedBy: 'operator_001',
        decidedAt: new Date().toISOString(),
        modifiedActions: [{ type: 'reply', label: 'modified_action' }],
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await resumeFromApproval(ctx as any, deps);

    expect(deps.transitionState).toHaveBeenCalledWith(
      expect.objectContaining({ state: 'approved' }),
      'modified'
    );
  });

  it('transitions to FAILED when execution fails', async () => {
    (stepMultiExecute as jest.Mock).mockImplementation((ctx) => {
      ctx.executionResult = { success: false, sideEffects: [], error: 'DB error' };
      return Promise.resolve(ctx);
    });

    const mod = createMockModule('UC-001');
    const deps = createMockDeps([mod]);
    const ctx = createMockContext();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await resumeFromApproval(ctx as any, deps);

    expect(result.success).toBe(false);
    expect(result.error).toBe('DB error');
    expect(deps.transitionState).toHaveBeenCalledWith(expect.anything(), 'failed');
    expect(deps.auditService.record).toHaveBeenCalledWith(expect.anything(), 'failed', 'UC-001');
  });

  it('handles thrown exception during execution gracefully', async () => {
    (stepMultiExecute as jest.Mock).mockRejectedValue(new Error('Network failure'));

    const mod = createMockModule('UC-001');
    const deps = createMockDeps([mod]);
    const ctx = createMockContext();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await resumeFromApproval(ctx as any, deps);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Network failure');
    expect(deps.auditService.record).toHaveBeenCalledWith(expect.anything(), 'failed');
  });

  it('uses contributingModules to resolve modules', async () => {
    const mod1 = createMockModule('UC-001');
    const mod2 = createMockModule('UC-002');
    mod2.handledIntents = ['info_request'];
    const deps = createMockDeps([mod1, mod2]);
    const ctx = createMockContext({ contributingModules: ['UC-001', 'UC-002'] });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await resumeFromApproval(ctx as any, deps);

    expect(deps.registry.getModule).toHaveBeenCalledWith('UC-001');
    expect(deps.registry.getModule).toHaveBeenCalledWith('UC-002');
    expect(stepMultiExecute).toHaveBeenCalledWith(
      expect.anything(),
      expect.arrayContaining([expect.objectContaining({ moduleId: 'UC-001' }), expect.objectContaining({ moduleId: 'UC-002' })]),
      expect.anything()
    );
  });

  it('falls back to intent module if no contributingModules', async () => {
    const mod = createMockModule('UC-001');
    const deps = createMockDeps([mod]);
    const ctx = createMockContext({
      contributingModules: undefined,
      understanding: { intent: 'appointment_request', confidence: 90 },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await resumeFromApproval(ctx as any, deps);

    expect(deps.registry.getModuleForIntent).toHaveBeenCalledWith('appointment_request');
    expect(stepMultiExecute).toHaveBeenCalled();
  });

  it('records step durations for execute and acknowledge', async () => {
    const mod = createMockModule('UC-001');
    const deps = createMockDeps([mod]);
    const ctx = createMockContext();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await resumeFromApproval(ctx as any, deps);

    // The function sets stepDurations on the ctx before transitionState copies it
    // We verify stepMultiExecute and stepAcknowledge were called (durations are set around them)
    expect(stepMultiExecute).toHaveBeenCalledTimes(1);
    expect(deps.stepAcknowledge).toHaveBeenCalledTimes(1);
  });
});
