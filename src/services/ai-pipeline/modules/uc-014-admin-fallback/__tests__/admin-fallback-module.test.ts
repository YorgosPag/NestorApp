/* eslint-disable no-restricted-syntax */

// =============================================================================
// UC-014: ADMIN FALLBACK MODULE — UNIT TESTS
// =============================================================================

jest.mock('server-only', () => ({}));
jest.mock('@/lib/telemetry/Logger', () => ({ createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }) }));
jest.mock('@/lib/error-utils', () => ({ getErrorMessage: jest.fn((e: unknown) => e instanceof Error ? e.message : String(e)) }));
jest.mock('@/config/firestore-collections', () => ({ COLLECTIONS: { CONTACTS: 'contacts', UNITS: 'units', BUILDINGS: 'buildings', PROJECTS: 'projects', AI_PIPELINE_AUDIT: 'ai_pipeline_audit' } }));
jest.mock('@/config/firestore-field-constants', () => ({ FIELDS: { COMPANY_ID: 'companyId', CREATED_AT: 'createdAt', STATUS: 'status' } }));
jest.mock('@/config/tenant', () => ({ getCompanyId: () => 'comp_pagonis' }));
jest.mock('@/config/ai-pipeline-config', () => ({ PIPELINE_PROTOCOL_CONFIG: { SCHEMA_VERSION: 1 } }));

// Channel reply mock
const mockSendChannelReply = jest.fn().mockResolvedValue({ success: true, messageId: 'msg_reply_001' });
const mockExtractChannelIds = jest.fn(() => ({ telegramChatId: '12345' }));
jest.mock('../../../shared/channel-reply-dispatcher', () => ({
  sendChannelReply: (...args: unknown[]) => Reflect.apply(mockSendChannelReply, null, args),
  extractChannelIds: (...args: unknown[]) => Reflect.apply(mockExtractChannelIds, null, args),
}));

// AI reply generator mock
const mockGenerateAdminConversationalReply = jest.fn().mockResolvedValue({
  replyText: '\u0393\u03b5\u03b9\u03b1 \u03c3\u03bf\u03c5!',
  aiGenerated: true,
  durationMs: 200,
});
jest.mock('../../../shared/ai-reply-generator', () => ({
  generateAdminConversationalReply: (...args: unknown[]) => Reflect.apply(mockGenerateAdminConversationalReply, null, args),
}));

import { AdminFallbackModule } from '../admin-fallback-module';
import type { PipelineContext } from '@/types/ai-pipeline';

// ============================================================================
// HELPERS
// ============================================================================

function createMockCtx(overrides?: Record<string, unknown>): PipelineContext {
  return {
    requestId: 'req_test_001',
    companyId: 'comp_pagonis',
    state: 'understood',
    intake: {
      id: 'intake_001',
      channel: 'telegram',
      rawPayload: {},
      normalized: {
        sender: { id: 'telegram_12345', displayName: '\u0393\u03b9\u03ce\u03c1\u03b3\u03bf\u03c2' },
        recipients: [],
        contentText: 'Test message',
        attachments: [],
        timestampIso: new Date().toISOString(),
      },
      metadata: { providerMessageId: 'pm_001', signatureVerified: true },
      schemaVersion: 1,
    },
    understanding: { intent: 'unknown', confidence: 0.3, entities: {} },
    lookupData: {},
    adminCommandMeta: { isAdminCommand: true, adminIdentity: { displayName: '\u0393\u03b9\u03ce\u03c1\u03b3\u03bf\u03c2', userId: '5618410820' } },
    errors: [],
    startedAt: new Date().toISOString(),
    stepDurations: {},
    ...overrides,
  } as unknown as PipelineContext;
}

// ============================================================================
// TESTS
// ============================================================================

describe('AdminFallbackModule (UC-014)', () => {
  let mod: AdminFallbackModule;

  beforeEach(() => {
    mod = new AdminFallbackModule();
    jest.clearAllMocks();
  });

  // ── 1. Identity ──
  it('has moduleId UC-014 and no handled intents', () => {
    expect(mod.moduleId).toBe('UC-014');
    expect(mod.handledIntents).toHaveLength(0);
  });

  // ── 2. Lookup: returns empty object ──
  it('lookup returns empty object (no-op)', async () => {
    const ctx = createMockCtx();
    const result = await mod.lookup(ctx);
    expect(result).toEqual({});
  });

  // ── 3. Propose: builds help text listing commands ──
  it('propose builds help text listing available admin commands', async () => {
    const ctx = createMockCtx();
    const proposal = await mod.propose(ctx);

    expect(proposal.suggestedActions).toHaveLength(1);
    expect(proposal.suggestedActions[0].type).toBe('admin_fallback_reply');

    const helpText = proposal.suggestedActions[0].params.helpText as string;
    expect(helpText).toContain('\u0394\u03bf\u03ba\u03b9\u03bc\u03ac\u03c3\u03c4\u03b5');
    expect(helpText).toContain('\u0392\u03c1\u03b5\u03c2');
    expect(helpText).toContain('\u0394\u03b7\u03bc\u03b9\u03bf\u03cd\u03c1\u03b3\u03b7\u03c3\u03b5 \u03b5\u03c0\u03b1\u03c6\u03ae');
  });

  // ── 4. Propose: auto-approvable ──
  it('propose is auto-approvable with no required approvals', async () => {
    const ctx = createMockCtx();
    const proposal = await mod.propose(ctx);

    expect(proposal.autoApprovable).toBe(true);
    expect(proposal.requiredApprovals).toHaveLength(0);
    expect(proposal.summary).toContain('\u03b1\u03bd\u03b1\u03b3\u03bd\u03c9\u03c1\u03af\u03c3\u03c4\u03b7\u03ba\u03b5');
  });

  // ── 5. Execute: uses pregenerated reply when available ──
  it('execute uses pregenerated conversational reply from entities', async () => {
    const ctx = createMockCtx({
      understanding: {
        intent: 'unknown',
        confidence: 0.3,
        entities: { conversationalReply: '\u039a\u03b1\u03bb\u03b7\u03c3\u03c0\u03ad\u03c1\u03b1! \u03a0\u03ce\u03c2 \u03bc\u03c0\u03bf\u03c1\u03ce \u03bd\u03b1 \u03b2\u03bf\u03b7\u03b8\u03ae\u03c3\u03c9;' },
      },
      proposal: {
        suggestedActions: [
          {
            type: 'admin_fallback_reply',
            params: { helpText: 'Help text', channel: 'telegram', telegramChatId: '12345' },
          },
        ],
      },
    });

    const result = await mod.execute(ctx);

    expect(result.success).toBe(true);
    expect(result.sideEffects).toContain('ai_conversational_pregenerated');
    // Should NOT call OpenAI since pregenerated reply exists
    expect(mockGenerateAdminConversationalReply).not.toHaveBeenCalled();
    // Verify the pregenerated reply was sent
    expect(mockSendChannelReply).toHaveBeenCalledTimes(1);
    const callArgs = mockSendChannelReply.mock.calls[0][0] as Record<string, unknown>;
    expect(callArgs.textBody).toBe('\u039a\u03b1\u03bb\u03b7\u03c3\u03c0\u03ad\u03c1\u03b1! \u03a0\u03ce\u03c2 \u03bc\u03c0\u03bf\u03c1\u03ce \u03bd\u03b1 \u03b2\u03bf\u03b7\u03b8\u03ae\u03c3\u03c9;');
  });

  // ── 6. Execute: falls back to OpenAI call when no pregenerated reply ──
  it('execute calls OpenAI when no pregenerated reply is available', async () => {
    const ctx = createMockCtx({
      understanding: { intent: 'unknown', confidence: 0.3, entities: {} },
      proposal: {
        suggestedActions: [
          {
            type: 'admin_fallback_reply',
            params: { helpText: 'Help text', channel: 'telegram', telegramChatId: '12345' },
          },
        ],
      },
    });

    const result = await mod.execute(ctx);

    expect(result.success).toBe(true);
    expect(mockGenerateAdminConversationalReply).toHaveBeenCalledTimes(1);
    expect(mockGenerateAdminConversationalReply).toHaveBeenCalledWith('Test message', 'req_test_001');

    // Should contain AI conversational duration side effect
    const aiEffect = result.sideEffects.find((se: string) => se.startsWith('ai_conversational:'));
    expect(aiEffect).toBeDefined();

    // Verify AI reply was sent
    const callArgs = mockSendChannelReply.mock.calls[0][0] as Record<string, unknown>;
    expect(callArgs.textBody).toBe('\u0393\u03b5\u03b9\u03b1 \u03c3\u03bf\u03c5!');
  });

  // ── 7. healthCheck returns true ──
  it('healthCheck returns true', async () => {
    const result = await mod.healthCheck();
    expect(result).toBe(true);
  });
});
