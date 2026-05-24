// =============================================================================
// UC-017: GANTT AI MODULE — UNIT TESTS
// =============================================================================

jest.mock('server-only', () => ({}));
jest.mock('@/lib/telemetry/Logger', () => ({
  createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
}));
jest.mock('@/lib/error-utils', () => ({
  getErrorMessage: jest.fn((e: unknown) => (e instanceof Error ? e.message : String(e))),
}));
jest.mock('@/config/ai-pipeline-config', () => ({
  PIPELINE_PROTOCOL_CONFIG: { SCHEMA_VERSION: 1 },
}));

// Mock data fetcher
jest.mock('../gantt-data-fetcher', () => ({
  fetchGanttScheduleData: jest.fn().mockResolvedValue({
    phases: [
      { id: 'ph_001', buildingId: 'bld_001', companyId: 'comp_001', name: 'Θεμελίωση', code: 'PH-001', order: 1, status: 'delayed', progress: 10, plannedStartDate: '2026-04-01', plannedEndDate: '2026-08-01' },
    ],
    tasks: [
      { id: 'tsk_001', phaseId: 'ph_001', buildingId: 'bld_001', companyId: 'comp_001', name: 'Εκσκαφή', code: 'TSK-001', order: 1, status: 'delayed', progress: 5, plannedStartDate: '2026-04-01', plannedEndDate: '2026-06-01' },
    ],
    resourceAssignments: [],
  }),
}));

// Mock analyzers
jest.mock('../analyzers/risk-assessor',        () => ({ assessRisks:        jest.fn().mockResolvedValue([]) }));
jest.mock('../analyzers/auto-scheduler',       () => ({ autoSchedule:       jest.fn().mockResolvedValue([]) }));
jest.mock('../analyzers/resource-optimizer',   () => ({ optimizeResources:  jest.fn().mockResolvedValue([]) }));
jest.mock('../analyzers/photo-progress-analyzer', () => ({ analyzePhotoProgress: jest.fn().mockResolvedValue({ estimatedProgress: 45, confidence: 80, observations: [], detectedElements: [] }) }));

// Mock channel dispatcher
const mockSendChannelReply = jest.fn().mockResolvedValue({ success: true, messageId: 'msg_reply_017' });
const mockExtractChannelIds = jest.fn().mockReturnValue({ telegramChatId: '99999' });
jest.mock('../../../shared/channel-reply-dispatcher', () => ({
  sendChannelReply: (p: unknown) => mockSendChannelReply(p),
  extractChannelIds: (p: unknown) => mockExtractChannelIds(p),
}));

import { GanttAIModule } from '../gantt-ai-module';
import { PipelineIntentType, PipelineState, PipelineChannel } from '@/types/ai-pipeline';

// ── Helper ────────────────────────────────────────────────────────────────────

function createMockCtx(contentText: string, entities: Record<string, string | undefined> = {}) {
  return {
    requestId: 'req_uc017_test',
    companyId: 'comp_001',
    state: PipelineState.UNDERSTOOD,
    intake: {
      id: 'intake_001',
      channel: PipelineChannel.TELEGRAM,
      rawPayload: { chatId: '99999' },
      normalized: {
        sender: { telegramId: '5618410820' },
        recipients: [],
        contentText,
        attachments: [],
        timestampIso: new Date().toISOString(),
      },
      metadata: { providerMessageId: 'tg_001', signatureVerified: true },
      schemaVersion: 1,
    },
    understanding: {
      messageId: 'intake_001',
      intent: PipelineIntentType.ADMIN_GANTT_AI,
      entities,
      confidence: 95,
      rationale: 'Admin gantt AI request',
      language: 'el',
      urgency: 'normal' as const,
      policyFlags: [],
      companyDetection: { companyId: 'comp_001', signal: 'recipient_email' as const, confidence: 100 },
      senderType: 'known_contact' as const,
      threatLevel: 'clean' as const,
      detectedIntents: [],
      schemaVersion: 1,
    },
    startedAt: new Date().toISOString(),
    stepDurations: {},
    errors: [],
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('GanttAIModule — identity', () => {
  const module = new GanttAIModule();

  it('has correct moduleId', () => expect(module.moduleId).toBe('UC-017'));
  it('handles ADMIN_GANTT_AI intent', () => {
    expect(module.handledIntents).toContain(PipelineIntentType.ADMIN_GANTT_AI);
  });
  it('healthCheck returns true', async () => expect(await module.healthCheck()).toBe(true));
});

describe('GanttAIModule — lookup', () => {
  const module = new GanttAIModule();

  it('detects delay_prediction from content', async () => {
    const ctx = createMockCtx('Θα υπάρξει πρόβλεψη καθυστέρησης στο έργο;');
    const data = await module.lookup(ctx as never);
    expect((data as { feature: string }).feature).toBe('delay_prediction');
  });

  it('detects risk_assessment from content', async () => {
    const ctx = createMockCtx('Ποιοι είναι οι κίνδυνοι του χρονοδιαγράμματος;');
    const data = await module.lookup(ctx as never);
    expect((data as { feature: string }).feature).toBe('risk_assessment');
  });

  it('detects natural_language as default fallback', async () => {
    const ctx = createMockCtx('Τι γίνεται με τα έργα;');
    const data = await module.lookup(ctx as never);
    expect((data as { feature: string }).feature).toBe('natural_language');
  });

  it('uses entities.ganttFeature when provided', async () => {
    const ctx = createMockCtx('anything', { ganttFeature: 'resource_optimization' });
    const data = await module.lookup(ctx as never);
    expect((data as { feature: string }).feature).toBe('resource_optimization');
  });

  it('returns analyzerError on fetcher failure', async () => {
    const { fetchGanttScheduleData } = jest.requireMock('../gantt-data-fetcher') as {
      fetchGanttScheduleData: jest.Mock;
    };
    fetchGanttScheduleData.mockRejectedValueOnce(new Error('Firestore unavailable'));

    const ctx = createMockCtx('πρόβλεψη καθυστέρησης');
    const data = await module.lookup(ctx as never) as { analyzerError: string | null };
    expect(data.analyzerError).toContain('Firestore unavailable');
  });
});

describe('GanttAIModule — propose', () => {
  const module = new GanttAIModule();

  it('returns autoApprovable proposal', async () => {
    const ctx = createMockCtx('κατάσταση');
    const lookupData = await module.lookup(ctx as never);
    const ctxWithLookup = { ...ctx, lookupData };
    const proposal = await module.propose(ctxWithLookup as never);
    expect(proposal.autoApprovable).toBe(true);
    expect(proposal.suggestedActions[0].type).toBe('gantt_ai_reply');
  });
});

describe('GanttAIModule — execute', () => {
  const module = new GanttAIModule();

  it('sends reply and returns success', async () => {
    const ctx = createMockCtx('κατάσταση');
    const lookupData = await module.lookup(ctx as never);
    const ctxWithActions = {
      ...ctx,
      lookupData,
      proposal: {
        messageId: 'intake_001',
        suggestedActions: [{ type: 'gantt_ai_reply', params: { lookupData, channel: 'telegram', telegramChatId: '99999' } }],
        requiredApprovals: [],
        autoApprovable: true,
        summary: 'test',
        schemaVersion: 1,
      },
    };
    const result = await module.execute(ctxWithActions as never);
    expect(result.success).toBe(true);
    expect(mockSendChannelReply).toHaveBeenCalled();
  });

  it('returns error when no action found', async () => {
    const ctx = createMockCtx('κατάσταση');
    const result = await module.execute({ ...ctx, proposal: { suggestedActions: [] } } as never);
    expect(result.success).toBe(false);
    expect(result.error).toContain('No gantt_ai_reply');
  });
});

describe('GanttAIModule — acknowledge', () => {
  const module = new GanttAIModule();

  it('returns sent=true when sideEffect has reply_sent', async () => {
    const ctx = createMockCtx('test');
    const ctxWithResult = { ...ctx, executionResult: { success: true, sideEffects: ['reply_sent:msg_123'] } };
    const ack = await module.acknowledge(ctxWithResult as never);
    expect(ack.sent).toBe(true);
  });

  it('returns sent=false when no reply_sent sideEffect', async () => {
    const ctx = createMockCtx('test');
    const ack = await module.acknowledge(ctx as never);
    expect(ack.sent).toBe(false);
  });
});
