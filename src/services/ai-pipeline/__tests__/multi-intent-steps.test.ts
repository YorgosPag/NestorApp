/**
 * MULTI-INTENT PIPELINE STEPS TESTS
 *
 * Tests multi-module pipeline execution: lookup, propose, compose,
 * approve, and execute across multiple UC modules.
 *
 * @see ADR-131 (Multi-Intent Pipeline)
 * @module __tests__/multi-intent-steps
 */

/* eslint-disable no-restricted-syntax */

// ── Mocks ──
jest.mock('@/lib/error-utils', () => ({
  getErrorMessage: jest.fn((e: unknown) => e instanceof Error ? e.message : String(e)),
}));

jest.mock('@/config/ai-pipeline-config', () => ({
  PIPELINE_PROTOCOL_CONFIG: { SCHEMA_VERSION: '1.0' },
}));

jest.mock('@/types/ai-pipeline', () => ({
  PipelineState: {
    APPROVED: 'approved',
    MODIFIED: 'modified',
    EXECUTED: 'executed',
    FAILED: 'failed',
  },
}));

// ── Import after mocks ──
import {
  stepMultiLookup,
  stepMultiPropose,
  composeProposal,
  stepApproveMulti,
  stepMultiExecute,
} from '../multi-intent-steps';
import type { TransitionStateFn } from '../multi-intent-steps';

// ============================================================================
// TYPES & HELPERS
// ============================================================================

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

interface MockProposal {
  messageId: string;
  suggestedActions: Array<{ type: string; label: string }>;
  summary: string;
  autoApprovable: boolean;
  requiredApprovals: string[];
  schemaVersion: number | string;
}

interface MockPipelineContext {
  requestId: string;
  companyId: string;
  state: string;
  intake: { id: string; channel: string; rawPayload: Record<string, unknown>; normalized: Record<string, unknown>; metadata: Record<string, unknown>; schemaVersion: number };
  lookupData: Record<string, unknown>;
  multiLookupData?: Record<string, Record<string, unknown>>;
  proposal?: MockProposal | null;
  approval?: { decision: string; approvedBy?: string; decidedAt: string; modifiedActions?: Array<{ type: string; label: string }> | null } | null;
  executionPlan?: Record<string, unknown> | null;
  executionResult?: { success: boolean; sideEffects: string[]; error?: string } | null;
  adminCommandMeta?: { isAdminCommand: boolean; adminIdentity: { displayName: string } } | null;
  contributingModules?: string[];
  errors: Array<{ step: string; error: string; timestamp: string; retryable: boolean }>;
  startedAt: string;
  stepDurations: Record<string, number>;
}

function createMockModule(id: string, overrides?: Partial<MockModule>): MockModule {
  return {
    moduleId: id,
    lookup: jest.fn().mockResolvedValue({ found: true }),
    propose: jest.fn().mockResolvedValue({
      messageId: 'msg_001',
      suggestedActions: [{ type: 'test', label: id }],
      summary: `Summary for ${id}`,
      autoApprovable: true,
      requiredApprovals: [],
      schemaVersion: '1.0',
    }),
    execute: jest.fn().mockResolvedValue({ success: true, sideEffects: [`${id}_done`] }),
    acknowledge: jest.fn().mockResolvedValue(undefined),
    handledIntents: ['test_intent'],
    displayName: `Module ${id}`,
    requiredRoles: [],
    ...overrides,
  };
}

function createMockContext(overrides?: Partial<MockPipelineContext>): MockPipelineContext {
  return {
    requestId: 'req_test_001',
    companyId: 'comp_test',
    state: 'understood',
    intake: {
      id: 'intake_001',
      channel: 'telegram',
      rawPayload: {},
      normalized: { sender: { id: 'sender_1' }, recipients: [], contentText: 'test', attachments: [], timestampIso: new Date().toISOString() },
      metadata: { providerMessageId: 'pm_001', signatureVerified: true },
      schemaVersion: 1,
    },
    lookupData: {},
    multiLookupData: undefined,
    proposal: null,
    approval: null,
    executionPlan: null,
    executionResult: null,
    adminCommandMeta: null,
    contributingModules: [],
    errors: [],
    startedAt: new Date().toISOString(),
    stepDurations: {},
    ...overrides,
  };
}

const mockTransitionState: TransitionStateFn = jest.fn((ctx, to) => {
  return { ...ctx, state: to };
}) as unknown as TransitionStateFn;

// ============================================================================
// stepMultiLookup
// ============================================================================

describe('stepMultiLookup', () => {
  beforeEach(() => jest.clearAllMocks());

  it('runs lookup on all modules and aggregates results', async () => {
    const mod1 = createMockModule('UC-001');
    const mod2 = createMockModule('UC-002');
    mod1.lookup.mockResolvedValue({ contacts: 5 });
    mod2.lookup.mockResolvedValue({ projects: 3 });

    const ctx = createMockContext();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await stepMultiLookup(ctx as any, [mod1 as any, mod2 as any]);

    expect(result.multiLookupData).toEqual({ 'UC-001': { contacts: 5 }, 'UC-002': { projects: 3 } });
    expect(result.lookupData).toEqual({ contacts: 5 }); // backward compat: primary module
  });

  it('throws when primary module lookup fails', async () => {
    const mod1 = createMockModule('UC-001');
    mod1.lookup.mockRejectedValue(new Error('Primary failed'));

    const ctx = createMockContext();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect(stepMultiLookup(ctx as any, [mod1 as any])).rejects.toThrow('Primary failed');
    expect(ctx.errors).toHaveLength(1);
    expect(ctx.errors[0].step).toBe('lookup_UC-001');
  });

  it('continues when secondary module lookup fails', async () => {
    const mod1 = createMockModule('UC-001');
    const mod2 = createMockModule('UC-002');
    mod2.lookup.mockRejectedValue(new Error('Secondary failed'));

    const ctx = createMockContext();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await stepMultiLookup(ctx as any, [mod1 as any, mod2 as any]);

    expect(result.multiLookupData?.['UC-001']).toEqual({ found: true });
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].step).toBe('lookup_UC-002');
    expect(result.errors[0].retryable).toBe(false);
  });
});

// ============================================================================
// stepMultiPropose
// ============================================================================

describe('stepMultiPropose', () => {
  beforeEach(() => jest.clearAllMocks());

  it('runs propose on all modules and sets contributingModules', async () => {
    const mod1 = createMockModule('UC-001');
    const mod2 = createMockModule('UC-002');

    const ctx = createMockContext({ multiLookupData: { 'UC-001': {}, 'UC-002': {} } });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await stepMultiPropose(ctx as any, [mod1 as any, mod2 as any]);

    expect(result.contributingModules).toEqual(['UC-001', 'UC-002']);
    expect(result.proposal).toBeDefined();
  });

  it('throws when primary module propose fails', async () => {
    const mod1 = createMockModule('UC-001');
    mod1.propose.mockRejectedValue(new Error('Propose failed'));

    const ctx = createMockContext();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect(stepMultiPropose(ctx as any, [mod1 as any])).rejects.toThrow('Propose failed');
  });

  it('skips secondary module on propose failure', async () => {
    const mod1 = createMockModule('UC-001');
    const mod2 = createMockModule('UC-002');
    mod2.propose.mockRejectedValue(new Error('Secondary propose error'));

    const ctx = createMockContext({ multiLookupData: { 'UC-001': {}, 'UC-002': {} } });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await stepMultiPropose(ctx as any, [mod1 as any, mod2 as any]);

    expect(result.contributingModules).toEqual(['UC-001']);
    expect(result.errors).toHaveLength(1);
  });
});

// ============================================================================
// composeProposal
// ============================================================================

describe('composeProposal', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns single proposal as-is (no composition)', () => {
    const proposal: MockProposal = {
      messageId: 'msg_001',
      suggestedActions: [{ type: 'reply', label: 'test' }],
      summary: 'Single summary',
      autoApprovable: true,
      requiredApprovals: [],
      schemaVersion: '1.0',
    };

    const ctx = createMockContext();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = composeProposal([proposal as any], ctx as any);
    expect(result).toBe(proposal);
  });

  it('merges multiple proposals correctly', () => {
    const p1: MockProposal = {
      messageId: 'msg_001',
      suggestedActions: [{ type: 'reply', label: 'A' }],
      summary: 'Summary A',
      autoApprovable: true,
      requiredApprovals: ['admin'],
      schemaVersion: '1.0',
    };
    const p2: MockProposal = {
      messageId: 'msg_001',
      suggestedActions: [{ type: 'send', label: 'B' }],
      summary: 'Summary B',
      autoApprovable: false,
      requiredApprovals: ['admin', 'manager'],
      schemaVersion: '1.0',
    };

    const ctx = createMockContext();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = composeProposal([p1 as any, p2 as any], ctx as any);

    expect(result.suggestedActions).toHaveLength(2);
    expect(result.summary).toBe('Summary A | Summary B');
    expect(result.autoApprovable).toBe(false); // AND logic
    expect(result.requiredApprovals).toEqual(['admin', 'manager']); // union, deduplicated
  });
});

// ============================================================================
// stepApproveMulti
// ============================================================================

describe('stepApproveMulti', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns ctx unchanged if no proposal', () => {
    const ctx = createMockContext({ proposal: undefined as unknown as null });
    // delete proposal to simulate missing
    delete (ctx as Record<string, unknown>).proposal;

    const multiRoute = { primaryRoute: {}, secondaryRoutes: [], allModules: [], needsManualReview: false, allAutoApprovable: true };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = stepApproveMulti(ctx as any, multiRoute as any, mockTransitionState);
    expect(mockTransitionState).not.toHaveBeenCalled();
  });

  it('auto-approves admin commands', () => {
    const ctx = createMockContext({
      proposal: { messageId: 'msg_001', suggestedActions: [], summary: 'test', autoApprovable: false, requiredApprovals: [], schemaVersion: '1.0' },
      adminCommandMeta: { isAdminCommand: true, adminIdentity: { displayName: 'Γιώργος' } },
    });

    const multiRoute = { primaryRoute: {}, secondaryRoutes: [], allModules: [], needsManualReview: true, allAutoApprovable: false };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    stepApproveMulti(ctx as any, multiRoute as any, mockTransitionState);

    expect(ctx.approval?.approvedBy).toContain('super_admin:Γιώργος');
    expect(mockTransitionState).toHaveBeenCalledWith(expect.anything(), 'approved');
  });

  it('auto-approves when all conditions are met', () => {
    const ctx = createMockContext({
      proposal: { messageId: 'msg_001', suggestedActions: [], summary: 'test', autoApprovable: true, requiredApprovals: [], schemaVersion: '1.0' },
    });

    const multiRoute = { primaryRoute: {}, secondaryRoutes: [], allModules: [], needsManualReview: false, allAutoApprovable: true };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    stepApproveMulti(ctx as any, multiRoute as any, mockTransitionState);

    expect(ctx.approval?.approvedBy).toBe('AI-auto');
  });

  it('does NOT auto-approve when needsManualReview is true', () => {
    const ctx = createMockContext({
      proposal: { messageId: 'msg_001', suggestedActions: [], summary: 'test', autoApprovable: true, requiredApprovals: [], schemaVersion: '1.0' },
    });

    const multiRoute = { primaryRoute: {}, secondaryRoutes: [], allModules: [], needsManualReview: true, allAutoApprovable: true };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    stepApproveMulti(ctx as any, multiRoute as any, mockTransitionState);

    expect(ctx.approval).toBeNull();
  });
});

// ============================================================================
// stepMultiExecute
// ============================================================================

describe('stepMultiExecute', () => {
  beforeEach(() => jest.clearAllMocks());

  it('executes all modules and transitions to EXECUTED on success', async () => {
    const mod1 = createMockModule('UC-001');
    const mod2 = createMockModule('UC-002');

    const ctx = createMockContext({
      state: 'approved',
      proposal: { messageId: 'msg_001', suggestedActions: [{ type: 'reply', label: 'A' }], summary: 'test', autoApprovable: true, requiredApprovals: [], schemaVersion: '1.0' },
      approval: { decision: 'approved', decidedAt: new Date().toISOString() },
      multiLookupData: { 'UC-001': { d: 1 }, 'UC-002': { d: 2 } },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await stepMultiExecute(ctx as any, [mod1 as any, mod2 as any], mockTransitionState);

    expect(result.executionResult?.success).toBe(true);
    expect(result.executionResult?.sideEffects).toEqual(['UC-001_done', 'UC-002_done']);
    expect(mockTransitionState).toHaveBeenCalledWith(expect.anything(), 'executed');
  });

  it('stops on first module execution failure', async () => {
    const mod1 = createMockModule('UC-001');
    mod1.execute.mockResolvedValue({ success: false, sideEffects: [], error: 'DB down' });
    const mod2 = createMockModule('UC-002');

    const ctx = createMockContext({
      state: 'approved',
      proposal: { messageId: 'msg_001', suggestedActions: [], summary: 'test', autoApprovable: true, requiredApprovals: [], schemaVersion: '1.0' },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await stepMultiExecute(ctx as any, [mod1 as any, mod2 as any], mockTransitionState);

    expect(result.executionResult?.success).toBe(false);
    expect(result.executionResult?.error).toBe('DB down');
    expect(mod2.execute).not.toHaveBeenCalled();
  });

  it('handles thrown exception during execution', async () => {
    const mod1 = createMockModule('UC-001');
    mod1.execute.mockRejectedValue(new Error('Network timeout'));

    const ctx = createMockContext({
      state: 'approved',
      proposal: { messageId: 'msg_001', suggestedActions: [], summary: 'test', autoApprovable: true, requiredApprovals: [], schemaVersion: '1.0' },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await stepMultiExecute(ctx as any, [mod1 as any], mockTransitionState);

    expect(result.executionResult?.success).toBe(false);
    expect(result.executionResult?.error).toBe('Network timeout');
    expect(result.errors).toHaveLength(1);
  });

  it('builds execution plan from proposal actions', async () => {
    const mod1 = createMockModule('UC-001');
    const actions = [{ type: 'reply', label: 'A' }, { type: 'send', label: 'B' }];

    const ctx = createMockContext({
      state: 'approved',
      proposal: { messageId: 'msg_001', suggestedActions: actions, summary: 'test', autoApprovable: true, requiredApprovals: [], schemaVersion: '1.0' },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await stepMultiExecute(ctx as any, [mod1 as any], mockTransitionState);

    expect(ctx.executionPlan).toBeDefined();
    expect((ctx.executionPlan as Record<string, unknown>)?.actions).toEqual(actions);
  });
});
