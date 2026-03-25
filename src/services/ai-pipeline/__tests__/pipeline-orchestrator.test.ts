/**
 * PIPELINE ORCHESTRATOR TESTS
 *
 * Tests the core engine that chains 7 pipeline steps,
 * manages state machine transitions, and delegates to UC modules.
 *
 * @see ADR-080 (Pipeline), ADR-169 (Modular AI), ADR-131 (Multi-Intent)
 * @module __tests__/pipeline-orchestrator
 */

import '../tools/__tests__/setup';

import { PipelineOrchestrator } from '../pipeline-orchestrator';
import type { ModuleRegistry } from '../module-registry';
import type { PipelineAuditService } from '../audit-service';
import type { IAIAnalysisProvider } from '@/services/ai-analysis/providers/IAIAnalysisProvider';
import {
  PipelineState,
  PipelineChannel,
  ThreatLevel,
  SenderType,
  Urgency,
  PipelineIntentType,
} from '@/types/ai-pipeline';
import type {
  PipelineContext,
  IUCModule,
  UnderstandingResult,
  IntakeMessage,
} from '@/types/ai-pipeline';

// ── Mock extracted modules ──
jest.mock('../intent-mapping', () => ({
  mapAIResultToUnderstanding: jest.fn(),
}));

jest.mock('../multi-intent-steps', () => ({
  stepMultiLookup: jest.fn((ctx: PipelineContext) => ctx),
  stepMultiPropose: jest.fn((ctx: PipelineContext) => ctx),
  stepApproveMulti: jest.fn(),
  stepMultiExecute: jest.fn(),
}));

jest.mock('../agentic-path-executor', () => ({
  executeAgenticPath: jest.fn(),
}));

jest.mock('@/config/ai-pipeline-config', () => ({
  PIPELINE_TIMEOUT_CONFIG: { TOTAL_PIPELINE_MS: 300_000 },
  PIPELINE_CONFIDENCE_CONFIG: {
    AUTO_APPROVE_THRESHOLD: 85,
    MANUAL_TRIAGE_THRESHOLD: 50,
    QUARANTINE_THRESHOLD: 20,
    SECONDARY_INTENT_THRESHOLD: 40,
  },
  PIPELINE_THREAT_CONFIG: {
    QUARANTINE_THREAT_LEVEL: 'high',
    QUARANTINE_SENDER_TYPES: ['spam', 'phishing'],
  },
}));

// ── Import mocked modules ──
import { mapAIResultToUnderstanding } from '../intent-mapping';
import {
  stepMultiLookup,
  stepMultiPropose,
  stepApproveMulti,
  stepMultiExecute,
} from '../multi-intent-steps';
import { executeAgenticPath } from '../agentic-path-executor';

// ============================================================================
// TEST FACTORIES
// ============================================================================

function createIntakeMessage(
  overrides?: Partial<IntakeMessage>,
): IntakeMessage {
  return {
    id: 'intake_001',
    channel: PipelineChannel.EMAIL,
    rawPayload: {},
    normalized: {
      sender: { email: 'sender@example.com', name: 'Δημήτρης' },
      recipients: ['info@company.com'],
      contentText: 'Θέλω ένα ραντεβού',
      attachments: [],
      timestampIso: new Date().toISOString(),
    },
    metadata: {
      providerMessageId: 'msg_ext_001',
      signatureVerified: true,
    },
    schemaVersion: 1,
    ...overrides,
  };
}

function createPipelineContext(
  overrides?: Partial<PipelineContext>,
): PipelineContext {
  return {
    requestId: 'req_test_001',
    companyId: 'comp_test_001',
    state: PipelineState.RECEIVED,
    intake: createIntakeMessage(),
    startedAt: new Date().toISOString(),
    stepDurations: {},
    errors: [],
    ...overrides,
  };
}

function createUnderstanding(
  overrides?: Partial<UnderstandingResult>,
): UnderstandingResult {
  return {
    messageId: 'intake_001',
    intent: PipelineIntentType.APPOINTMENT_REQUEST,
    entities: {},
    confidence: 90,
    rationale: 'Detected appointment request',
    language: 'el',
    urgency: Urgency.NORMAL,
    policyFlags: [],
    companyDetection: {
      companyId: 'comp_test_001',
      signal: 'recipient_email',
      confidence: 95,
    },
    senderType: SenderType.KNOWN_CONTACT,
    threatLevel: ThreatLevel.CLEAN,
    detectedIntents: [
      {
        intent: PipelineIntentType.APPOINTMENT_REQUEST,
        confidence: 90,
        rationale: 'Detected appointment request',
      },
    ],
    schemaVersion: 1,
    ...overrides,
  };
}

function createMockModule(
  moduleId = 'UC-001',
  intent = PipelineIntentType.APPOINTMENT_REQUEST,
): IUCModule {
  return {
    moduleId,
    displayName: `Module ${moduleId}`,
    handledIntents: [intent],
    requiredRoles: [],
    lookup: jest.fn(async () => ({})),
    propose: jest.fn(async () => ({
      messageId: 'intake_001',
      suggestedActions: [{ type: 'create_appointment', params: {} }],
      requiredApprovals: [],
      autoApprovable: true,
      summary: 'Create appointment',
      schemaVersion: 1,
    })),
    execute: jest.fn(async () => ({
      success: true,
      sideEffects: ['appointment_created'],
    })),
    acknowledge: jest.fn(async () => ({
      sent: true,
      channel: PipelineChannel.EMAIL,
      messageId: 'ack_001',
    })),
    healthCheck: jest.fn(async () => true),
  };
}

function createMockRegistry(module?: IUCModule): ModuleRegistry {
  const mod = module ?? createMockModule();
  return {
    register: jest.fn(),
    getModule: jest.fn((id: string) => (id === mod.moduleId ? mod : undefined)),
    getModuleForIntent: jest.fn(() => mod),
    getModulesForIntents: jest.fn(() => [mod]),
    getAllModules: jest.fn(() => [mod]),
  } as unknown as ModuleRegistry;
}

function createMockAuditService(): PipelineAuditService {
  return {
    record: jest.fn(async () => 'audit_test_001'),
  } as unknown as PipelineAuditService;
}

function createMockAIProvider(): IAIAnalysisProvider {
  return {
    name: 'mock-openai',
    analyze: jest.fn(async () => ({
      intent: PipelineIntentType.APPOINTMENT_REQUEST,
      confidence: 90,
      entities: {},
      rationale: 'Detected appointment request',
      language: 'el',
      urgency: Urgency.NORMAL,
    })),
    isAvailable: jest.fn(async () => true),
  } as unknown as IAIAnalysisProvider;
}

// ============================================================================
// TESTS
// ============================================================================

describe('PipelineOrchestrator', () => {
  let registry: ModuleRegistry;
  let auditService: PipelineAuditService;
  let aiProvider: IAIAnalysisProvider;
  let orchestrator: PipelineOrchestrator;
  let mockModule: IUCModule;

  beforeEach(() => {
    jest.clearAllMocks();

    mockModule = createMockModule();
    registry = createMockRegistry(mockModule);
    auditService = createMockAuditService();
    aiProvider = createMockAIProvider();
    orchestrator = new PipelineOrchestrator(registry, auditService, aiProvider);
  });

  // ==========================================================================
  // ADMIN COMMAND ROUTING (ADR-145, ADR-171)
  // ==========================================================================

  describe('Admin command routing', () => {
    it('should route admin commands to agentic path', async () => {
      const ctx = createPipelineContext({
        adminCommandMeta: {
          isAdminCommand: true,
          adminIdentity: { displayName: 'Γιώργος', firebaseUid: null },
          resolvedVia: 'telegram_user_id',
        },
      });

      const agenticResult = {
        success: true,
        requestId: ctx.requestId,
        finalState: PipelineState.AUDITED,
        context: ctx,
        auditId: 'audit_admin_001',
      };
      (executeAgenticPath as jest.Mock).mockResolvedValue(agenticResult);

      const result = await orchestrator.execute(ctx);

      expect(executeAgenticPath).toHaveBeenCalledTimes(1);
      expect(result.success).toBe(true);
      // AI provider should NOT be called for admin commands
      expect(aiProvider.analyze).not.toHaveBeenCalled();
    });

    it('should NOT route non-admin to agentic path via admin check', async () => {
      const ctx = createPipelineContext({
        adminCommandMeta: { isAdminCommand: false } as PipelineContext['adminCommandMeta'],
      });

      const understanding = createUnderstanding();
      (mapAIResultToUnderstanding as jest.Mock).mockReturnValue(understanding);

      (stepApproveMulti as jest.Mock).mockImplementation((c: PipelineContext) => {
        c.state = PipelineState.APPROVED;
        return c;
      });
      (stepMultiExecute as jest.Mock).mockImplementation((c: PipelineContext) => {
        c.state = PipelineState.EXECUTED;
        c.executionResult = { success: true, sideEffects: [] };
        return c;
      });

      await orchestrator.execute(ctx);

      expect(executeAgenticPath).not.toHaveBeenCalled();
      expect(aiProvider.analyze).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // CHANNEL-BASED AGENTIC ROUTING (ADR-174)
  // ==========================================================================

  describe('Channel-based agentic routing (ADR-174)', () => {
    const agenticChannels = [
      PipelineChannel.TELEGRAM,
      PipelineChannel.WHATSAPP,
      PipelineChannel.MESSENGER,
      PipelineChannel.INSTAGRAM,
    ];

    it.each(agenticChannels)(
      'should route %s channel to agentic path',
      async (channel) => {
        const ctx = createPipelineContext({
          intake: createIntakeMessage({ channel }),
        });

        const agenticResult = {
          success: true,
          requestId: ctx.requestId,
          finalState: PipelineState.AUDITED,
          context: ctx,
          auditId: 'audit_channel_001',
        };
        (executeAgenticPath as jest.Mock).mockResolvedValue(agenticResult);

        const result = await orchestrator.execute(ctx);

        expect(executeAgenticPath).toHaveBeenCalledTimes(1);
        expect(result.success).toBe(true);
        expect(aiProvider.analyze).not.toHaveBeenCalled();
      },
    );

    it('should NOT route email channel to agentic path', async () => {
      const ctx = createPipelineContext({
        intake: createIntakeMessage({ channel: PipelineChannel.EMAIL }),
      });

      const understanding = createUnderstanding();
      (mapAIResultToUnderstanding as jest.Mock).mockReturnValue(understanding);
      (stepApproveMulti as jest.Mock).mockImplementation((ctx: PipelineContext) => {
        ctx.state = PipelineState.APPROVED;
        return ctx;
      });
      (stepMultiExecute as jest.Mock).mockImplementation((c: PipelineContext) => {
        c.state = PipelineState.EXECUTED;
        c.executionResult = { success: true, sideEffects: [] };
        return c;
      });

      await orchestrator.execute(ctx);

      expect(executeAgenticPath).not.toHaveBeenCalled();
      expect(aiProvider.analyze).toHaveBeenCalled();
    });

    it('should NOT route in_app channel to agentic path', async () => {
      const ctx = createPipelineContext({
        intake: createIntakeMessage({ channel: PipelineChannel.IN_APP }),
      });

      const understanding = createUnderstanding();
      (mapAIResultToUnderstanding as jest.Mock).mockReturnValue(understanding);
      (stepApproveMulti as jest.Mock).mockImplementation((ctx: PipelineContext) => {
        ctx.state = PipelineState.APPROVED;
        return ctx;
      });
      (stepMultiExecute as jest.Mock).mockImplementation((c: PipelineContext) => {
        c.state = PipelineState.EXECUTED;
        c.executionResult = { success: true, sideEffects: [] };
        return c;
      });

      await orchestrator.execute(ctx);

      expect(executeAgenticPath).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // STEP 2: UNDERSTAND
  // ==========================================================================

  describe('Step 2: UNDERSTAND', () => {
    it('should call AI provider and map result to understanding', async () => {
      const ctx = createPipelineContext();
      const understanding = createUnderstanding();
      (mapAIResultToUnderstanding as jest.Mock).mockReturnValue(understanding);
      (stepApproveMulti as jest.Mock).mockImplementation((ctx: PipelineContext) => {
        ctx.state = PipelineState.APPROVED;
        return ctx;
      });
      (stepMultiExecute as jest.Mock).mockImplementation((c: PipelineContext) => {
        c.state = PipelineState.EXECUTED;
        c.executionResult = { success: true, sideEffects: [] };
        return c;
      });

      const result = await orchestrator.execute(ctx);

      expect(aiProvider.analyze).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'message_intent',
          messageText: 'Θέλω ένα ραντεβού',
        }),
      );
      expect(mapAIResultToUnderstanding).toHaveBeenCalled();
      expect(result.context.understanding).toBe(understanding);
    });

    it('should quarantine (DLQ) on HIGH threat level', async () => {
      const ctx = createPipelineContext();
      const understanding = createUnderstanding({
        threatLevel: ThreatLevel.HIGH,
      });
      (mapAIResultToUnderstanding as jest.Mock).mockReturnValue(understanding);

      const result = await orchestrator.execute(ctx);

      expect(result.success).toBe(false);
      expect(result.finalState).toBe(PipelineState.DLQ);
      expect(auditService.record).toHaveBeenCalledWith(
        expect.anything(),
        'quarantined',
      );
    });

    it('should record step duration for understand', async () => {
      const ctx = createPipelineContext();
      const understanding = createUnderstanding();
      (mapAIResultToUnderstanding as jest.Mock).mockReturnValue(understanding);
      (stepApproveMulti as jest.Mock).mockImplementation((ctx: PipelineContext) => {
        ctx.state = PipelineState.APPROVED;
        return ctx;
      });
      (stepMultiExecute as jest.Mock).mockImplementation((c: PipelineContext) => {
        c.state = PipelineState.EXECUTED;
        c.executionResult = { success: true, sideEffects: [] };
        return c;
      });

      const result = await orchestrator.execute(ctx);

      expect(result.context.stepDurations['understand']).toBeDefined();
      expect(typeof result.context.stepDurations['understand']).toBe('number');
    });

    it('should propagate AI provider errors as pipeline failure', async () => {
      const ctx = createPipelineContext();
      (aiProvider.analyze as jest.Mock).mockRejectedValue(
        new Error('OpenAI API rate limited'),
      );

      const result = await orchestrator.execute(ctx);

      expect(result.success).toBe(false);
      expect(result.finalState).toBe(PipelineState.FAILED);
      expect(result.error).toBe('OpenAI API rate limited');
      expect(auditService.record).toHaveBeenCalledWith(
        expect.anything(),
        'failed',
      );
    });
  });

  // ==========================================================================
  // ROUTING — MANUAL TRIAGE
  // ==========================================================================

  describe('Routing — manual triage', () => {
    it('should return manual_triage when primary intent not routed', async () => {
      const ctx = createPipelineContext();
      const understanding = createUnderstanding({
        intent: PipelineIntentType.UNKNOWN,
      });
      (mapAIResultToUnderstanding as jest.Mock).mockReturnValue(understanding);

      // Override the router to return unrouted
      const unroutedRegistry = {
        ...registry,
        getModuleForIntent: jest.fn(() => undefined),
        getModulesForIntents: jest.fn(() => []),
      } as unknown as ModuleRegistry;
      const orch = new PipelineOrchestrator(unroutedRegistry, auditService, aiProvider);

      const result = await orch.execute(ctx);

      expect(result.success).toBe(true);
      expect(result.finalState).toBe(PipelineState.PROPOSED);
      expect(auditService.record).toHaveBeenCalledWith(
        expect.anything(),
        'manual_triage',
      );
    });
  });

  // ==========================================================================
  // FULL HAPPY PATH (7 steps)
  // ==========================================================================

  describe('Full happy path (7 steps)', () => {
    it('should execute all 7 steps and return AUDITED', async () => {
      const ctx = createPipelineContext();
      const understanding = createUnderstanding();
      (mapAIResultToUnderstanding as jest.Mock).mockReturnValue(understanding);

      (stepApproveMulti as jest.Mock).mockImplementation(
        (ctx: PipelineContext) => {
          ctx.state = PipelineState.APPROVED;
          return ctx;
        },
      );

      (stepMultiExecute as jest.Mock).mockImplementation(
        (ctx: PipelineContext) => {
          ctx.executionResult = {
            success: true,
            sideEffects: ['appointment_created'],
          };
          return ctx;
        },
      );

      const result = await orchestrator.execute(ctx);

      expect(result.success).toBe(true);
      expect(result.finalState).toBe(PipelineState.AUDITED);
      expect(result.auditId).toBe('audit_test_001');

      // Verify step order
      expect(aiProvider.analyze).toHaveBeenCalled(); // Step 2
      expect(stepMultiLookup).toHaveBeenCalled(); // Step 3
      expect(stepMultiPropose).toHaveBeenCalled(); // Step 4
      expect(stepApproveMulti).toHaveBeenCalled(); // Step 5
      expect(stepMultiExecute).toHaveBeenCalled(); // Step 6
      expect(mockModule.acknowledge).toHaveBeenCalled(); // Step 7

      // Audit recorded
      expect(auditService.record).toHaveBeenCalledWith(
        expect.anything(),
        'auto_processed',
        expect.any(String),
      );
    });

    it('should record step durations for all steps', async () => {
      const ctx = createPipelineContext();
      const understanding = createUnderstanding();
      (mapAIResultToUnderstanding as jest.Mock).mockReturnValue(understanding);
      (stepApproveMulti as jest.Mock).mockImplementation((ctx: PipelineContext) => {
        ctx.state = PipelineState.APPROVED;
        return ctx;
      });
      (stepMultiExecute as jest.Mock).mockImplementation((c: PipelineContext) => {
        c.state = PipelineState.EXECUTED;
        c.executionResult = { success: true, sideEffects: [] };
        return c;
      });

      const result = await orchestrator.execute(ctx);

      expect(result.context.stepDurations['intake']).toBe(0);
      expect(result.context.stepDurations['understand']).toBeDefined();
      expect(result.context.stepDurations['lookup']).toBeDefined();
      expect(result.context.stepDurations['propose']).toBeDefined();
      expect(result.context.stepDurations['execute']).toBeDefined();
      expect(result.context.stepDurations['acknowledge']).toBeDefined();
    });
  });

  // ==========================================================================
  // EXECUTION FAILURE
  // ==========================================================================

  describe('Execution failure', () => {
    it('should return FAILED when execution fails', async () => {
      const ctx = createPipelineContext();
      const understanding = createUnderstanding();
      (mapAIResultToUnderstanding as jest.Mock).mockReturnValue(understanding);

      (stepApproveMulti as jest.Mock).mockImplementation((ctx: PipelineContext) => {
        ctx.state = PipelineState.APPROVED;
        return ctx;
      });

      (stepMultiExecute as jest.Mock).mockImplementation((ctx: PipelineContext) => {
        ctx.executionResult = {
          success: false,
          sideEffects: [],
          error: 'Firestore write failed',
        };
        return ctx;
      });

      const result = await orchestrator.execute(ctx);

      expect(result.success).toBe(false);
      expect(result.finalState).toBe(PipelineState.FAILED);
      expect(result.error).toBe('Firestore write failed');
      expect(auditService.record).toHaveBeenCalledWith(
        expect.anything(),
        'failed',
        expect.any(String),
      );
    });
  });

  // ==========================================================================
  // APPROVAL — PENDING REVIEW
  // ==========================================================================

  describe('Approval — pending review', () => {
    it('should stop pipeline when not approved', async () => {
      const ctx = createPipelineContext();
      const understanding = createUnderstanding();
      (mapAIResultToUnderstanding as jest.Mock).mockReturnValue(understanding);

      (stepApproveMulti as jest.Mock).mockImplementation((ctx: PipelineContext) => {
        ctx.state = PipelineState.PROPOSED; // NOT approved
        return ctx;
      });

      const result = await orchestrator.execute(ctx);

      expect(result.success).toBe(true);
      expect(result.finalState).toBe(PipelineState.PROPOSED);
      expect(stepMultiExecute).not.toHaveBeenCalled();
      expect(mockModule.acknowledge).not.toHaveBeenCalled();
      expect(auditService.record).toHaveBeenCalledWith(
        expect.anything(),
        'pending_review',
        expect.any(String),
      );
    });
  });

  // ==========================================================================
  // STEP 7: ACKNOWLEDGE
  // ==========================================================================

  describe('Step 7: ACKNOWLEDGE', () => {
    it('should handle acknowledge failure gracefully', async () => {
      const ctx = createPipelineContext();
      const understanding = createUnderstanding();
      (mapAIResultToUnderstanding as jest.Mock).mockReturnValue(understanding);
      (stepApproveMulti as jest.Mock).mockImplementation((ctx: PipelineContext) => {
        ctx.state = PipelineState.APPROVED;
        return ctx;
      });
      (stepMultiExecute as jest.Mock).mockImplementation((c: PipelineContext) => {
        c.state = PipelineState.EXECUTED;
        c.executionResult = { success: true, sideEffects: [] };
        return c;
      });

      // Module acknowledge throws
      (mockModule.acknowledge as jest.Mock).mockRejectedValue(
        new Error('Telegram API timeout'),
      );

      const result = await orchestrator.execute(ctx);

      // Pipeline should still succeed — acknowledge failure is non-fatal
      expect(result.success).toBe(true);
      expect(result.finalState).toBe(PipelineState.AUDITED);
      expect(result.context.acknowledgment).toEqual({
        sent: false,
        channel: PipelineChannel.EMAIL,
      });
      expect(result.context.errors).toContainEqual(
        expect.objectContaining({
          step: 'acknowledge',
          error: 'Telegram API timeout',
        }),
      );
    });
  });

  // ==========================================================================
  // TIMEOUT
  // ==========================================================================

  describe('Timeout', () => {
    it('should fail with timeout error when pipeline exceeds limit', async () => {
      const ctx = createPipelineContext();

      // AI provider hangs indefinitely
      (aiProvider.analyze as jest.Mock).mockImplementation(
        () => new Promise(() => {/* never resolves */}),
      );

      // Override timeout to 50ms for fast test
      const originalCreateTimeout = (orchestrator as unknown as Record<string, unknown>)['createTimeout'];
      (orchestrator as unknown as Record<string, unknown>)['createTimeout'] = (ms: number) => {
        void ms;
        return new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Pipeline execution timeout after 50ms')), 50);
        });
      };

      const result = await orchestrator.execute(ctx);

      expect(result.success).toBe(false);
      expect(result.finalState).toBe(PipelineState.FAILED);
      expect(result.error).toContain('timeout');

      // Restore
      (orchestrator as unknown as Record<string, unknown>)['createTimeout'] = originalCreateTimeout;
    });
  });

  // ==========================================================================
  // RESUME FROM APPROVAL (UC-009 Operator Inbox)
  // ==========================================================================

  describe('resumeFromApproval', () => {
    it('should reject resume from non-approved state', async () => {
      const ctx = createPipelineContext({
        state: PipelineState.PROPOSED,
      });

      const result = await orchestrator.resumeFromApproval(ctx);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Cannot resume from state 'proposed'");
    });

    it('should execute and acknowledge after approval', async () => {
      const ctx = createPipelineContext({
        state: PipelineState.APPROVED,
        understanding: createUnderstanding(),
        contributingModules: ['UC-001'],
      });

      (stepMultiExecute as jest.Mock).mockImplementation((ctx: PipelineContext) => {
        ctx.executionResult = { success: true, sideEffects: ['done'] };
        return ctx;
      });

      const result = await orchestrator.resumeFromApproval(ctx);

      expect(result.success).toBe(true);
      expect(result.finalState).toBe(PipelineState.AUDITED);
      expect(stepMultiExecute).toHaveBeenCalled();
      expect(mockModule.acknowledge).toHaveBeenCalled();
      expect(auditService.record).toHaveBeenCalledWith(
        expect.anything(),
        'approved',
        'UC-001',
      );
    });

    it('should transition to MODIFIED when approval has modifications', async () => {
      const ctx = createPipelineContext({
        state: PipelineState.APPROVED,
        understanding: createUnderstanding(),
        contributingModules: ['UC-001'],
        approval: {
          decision: 'modified',
          modifiedActions: [{ type: 'modified_action', params: {} }],
          decidedAt: new Date().toISOString(),
        },
      });

      (stepMultiExecute as jest.Mock).mockImplementation((c: PipelineContext) => {
        c.state = PipelineState.EXECUTED;
        c.executionResult = { success: true, sideEffects: [] };
        return c;
      });

      const result = await orchestrator.resumeFromApproval(ctx);

      expect(result.success).toBe(true);
      expect(auditService.record).toHaveBeenCalledWith(
        expect.anything(),
        'modified',
        'UC-001',
      );
    });

    it('should handle resume execution failure', async () => {
      const ctx = createPipelineContext({
        state: PipelineState.APPROVED,
        understanding: createUnderstanding(),
        contributingModules: ['UC-001'],
      });

      (stepMultiExecute as jest.Mock).mockImplementation((ctx: PipelineContext) => {
        ctx.executionResult = {
          success: false,
          sideEffects: [],
          error: 'Database unavailable',
        };
        return ctx;
      });

      const result = await orchestrator.resumeFromApproval(ctx);

      expect(result.success).toBe(false);
      expect(result.finalState).toBe(PipelineState.FAILED);
      expect(result.error).toBe('Database unavailable');
    });

    it('should handle resume with no resolvable modules', async () => {
      const emptyRegistry = {
        ...registry,
        getModule: jest.fn(() => undefined),
        getModuleForIntent: jest.fn(() => undefined),
      } as unknown as ModuleRegistry;
      const orch = new PipelineOrchestrator(emptyRegistry, auditService, aiProvider);

      const ctx = createPipelineContext({
        state: PipelineState.APPROVED,
        understanding: createUnderstanding(),
      });

      const result = await orch.resumeFromApproval(ctx);

      expect(result.success).toBe(true);
      expect(stepMultiExecute).not.toHaveBeenCalled();
    });

    it('should catch unexpected errors during resume', async () => {
      const ctx = createPipelineContext({
        state: PipelineState.APPROVED,
        understanding: createUnderstanding(),
        contributingModules: ['UC-001'],
      });

      (stepMultiExecute as jest.Mock).mockRejectedValue(
        new Error('Unexpected crash'),
      );

      const result = await orchestrator.resumeFromApproval(ctx);

      expect(result.success).toBe(false);
      expect(result.finalState).toBe(PipelineState.FAILED);
      expect(result.error).toBe('Unexpected crash');
      expect(result.context.errors).toContainEqual(
        expect.objectContaining({
          step: 'resume_from_approval',
          retryable: false,
        }),
      );
    });
  });

  // ==========================================================================
  // STATE MACHINE TRANSITIONS
  // ==========================================================================

  describe('State machine transitions', () => {
    it('should log error on invalid state transition', async () => {
      // DLQ → AUDITED is invalid
      const ctx = createPipelineContext({
        state: PipelineState.DLQ,
      });

      // Access private method via prototype
      const transitioned = (orchestrator as unknown as {
        transitionState: (c: PipelineContext, t: string) => PipelineContext;
      }).transitionState(ctx, PipelineState.AUDITED);

      expect(transitioned.errors).toContainEqual(
        expect.objectContaining({
          step: 'state_transition',
          error: expect.stringContaining('Invalid transition'),
        }),
      );
      // State should NOT change
      expect(transitioned.state).toBe(PipelineState.DLQ);
    });

    it('should allow valid RECEIVED → ACKED transition', async () => {
      const ctx = createPipelineContext({
        state: PipelineState.RECEIVED,
      });

      const transitioned = (orchestrator as unknown as {
        transitionState: (c: PipelineContext, t: string) => PipelineContext;
      }).transitionState(ctx, PipelineState.ACKED);

      expect(transitioned.state).toBe(PipelineState.ACKED);
      expect(transitioned.errors).toHaveLength(0);
    });
  });

  // ==========================================================================
  // ERROR HANDLING — TOP LEVEL
  // ==========================================================================

  describe('Top-level error handling', () => {
    it('should catch unexpected errors and return FAILED', async () => {
      const ctx = createPipelineContext();

      // Make something inside executeSteps throw
      (aiProvider.analyze as jest.Mock).mockRejectedValue(
        new Error('Network failure'),
      );

      const result = await orchestrator.execute(ctx);

      expect(result.success).toBe(false);
      expect(result.finalState).toBe(PipelineState.FAILED);
      expect(result.error).toBe('Network failure');
      expect(result.context.errors.length).toBeGreaterThan(0);
      expect(auditService.record).toHaveBeenCalledWith(
        expect.anything(),
        'failed',
      );
    });
  });
});
