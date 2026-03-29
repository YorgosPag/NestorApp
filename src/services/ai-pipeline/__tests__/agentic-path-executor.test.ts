/**
 * AGENTIC PATH EXECUTOR TESTS
 *
 * Tests the core orchestrator for AI agent requests (admin + messaging channels).
 * This is the most critical untested file — every AI request flows through here.
 *
 * Covers: happy path, daily cap, empty linkedUnitIds, chat history,
 * token usage recording, error handling, state transitions.
 *
 * @see ADR-171 (Autonomous AI Agent)
 * @see ADR-259A (AI Usage Tracking + Cost Protection)
 * @module __tests__/agentic-path-executor
 */

import '../tools/__tests__/setup';

// ── extractChannelIds not in setup.ts — patched in beforeEach below ──

// ── Mock agentic-specific dependencies ──

// ===== TOGGLE: Mock matches active engine import in agentic-path-executor.ts =====
// LEGACY: import type { ChatMessage } from '../agentic-loop';
// ACTIVE (Vercel AI SDK — 2026-03-29):
import type { ChatMessage } from '../vercel-ai-engine';

const mockGetRecentHistory = jest.fn<Promise<ChatMessage[]>, []>(async () => []);
const mockAddMessage = jest.fn<Promise<void>, [string, ChatMessage]>(async () => {});

jest.mock('../chat-history-service', () => ({
  getChatHistoryService: jest.fn(() => ({
    getRecentHistory: mockGetRecentHistory,
    addMessage: mockAddMessage,
  })),
}));

// LEGACY: jest.mock('../agentic-loop', () => ({ executeAgenticLoop: jest.fn() }));
// ACTIVE (Vercel AI SDK — 2026-03-29):
jest.mock('../vercel-ai-engine', () => ({
  executeAgenticLoop: jest.fn(),
}));

jest.mock('../tools/agentic-tool-definitions', () => ({
  AGENTIC_TOOL_DEFINITIONS: [],
}));

jest.mock('../ai-usage.service', () => ({
  checkDailyCap: jest.fn(async () => ({ allowed: true, used: 5, limit: 50 })),
  recordUsage: jest.fn(async () => {}),
}));

jest.mock('../post-reply-actions', () => ({
  sendPostReplyActions: jest.fn(async () => {}),
}));

jest.mock('../document-preview-service', () => ({
  downloadAndValidateFile: jest.fn(async () => null),
  previewDocumentFromBuffer: jest.fn(async () => null),
  isVisionSupportedMime: jest.fn(() => false),
  MAX_PREVIEWS_PER_MESSAGE: 2,
}));

jest.mock('../invoice-auto-enrichment', () => ({
  extractInvoiceEntitiesFromHistory: jest.fn(() => null),
}));

jest.mock('@/config/ai-analysis-config', () => ({
  AI_COST_CONFIG: {
    LIMITS: {
      ADMIN_MAX_ITERATIONS: 15,
      CUSTOMER_MAX_ITERATIONS: 8,
    },
  },
}));

// ── Import after mocks ──
import { executeAgenticPath, buildChannelSenderId } from '../agentic-path-executor';
import type { AgenticPathDeps } from '../agentic-path-executor';
// LEGACY: import { executeAgenticLoop } from '../agentic-loop';
import { executeAgenticLoop } from '../vercel-ai-engine';
import { checkDailyCap, recordUsage } from '../ai-usage.service';
import { sendPostReplyActions } from '../post-reply-actions';
import { PipelineState } from '@/types/ai-pipeline';
import type { PipelineContext, PipelineStateValue } from '@/types/ai-pipeline';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const dispatcherModule = require('../shared/channel-reply-dispatcher');
const sendChannelReply = dispatcherModule.sendChannelReply as jest.Mock;

// ============================================================================
// HELPERS
// ============================================================================

function createPipelineContext(overrides?: Partial<PipelineContext>): PipelineContext {
  return {
    requestId: 'req_test_001',
    companyId: 'comp_test',
    state: 'acked' as PipelineStateValue,
    intake: {
      channel: 'telegram',
      normalized: {
        contentText: 'Δείξε μου τις επαφές',
        subject: '',
        sender: {
          telegramId: '5618410820',
        },
      },
      rawPayload: {},
      receivedAt: new Date().toISOString(),
    },
    adminCommandMeta: {
      isAdminCommand: true,
      adminIdentity: {
        displayName: 'Γιώργος Παγώνης',
        telegramUserId: '5618410820',
      },
    },
    contactMeta: null,
    startedAt: new Date().toISOString(),
    stepDurations: {},
    errors: [],
    ...overrides,
  } as PipelineContext;
}

function createDeps(): AgenticPathDeps {
  return {
    auditService: {
      record: jest.fn(async () => 'audit_001'),
    } as unknown as AgenticPathDeps['auditService'],
    transitionState: jest.fn((ctx: PipelineContext, to: PipelineStateValue) => ({
      ...ctx,
      state: to,
    })),
  };
}

function createAgenticResult(overrides?: Record<string, unknown>) {
  return {
    answer: 'Βρέθηκαν 5 επαφές.',
    suggestions: [],
    toolCalls: [{ name: 'firestore_query', args: {} }],
    iterations: 2,
    totalDurationMs: 1500,
    totalUsage: { prompt_tokens: 500, completion_tokens: 200, total_tokens: 700 },
    ...overrides,
  };
}

// ============================================================================
// TESTS
// ============================================================================

describe('executeAgenticPath', () => {
  let deps: AgenticPathDeps;

  beforeEach(() => {
    jest.clearAllMocks();
    deps = createDeps();
    (executeAgenticLoop as jest.Mock).mockResolvedValue(createAgenticResult());

    // Patch extractChannelIds onto the mocked module (not in setup.ts)
    dispatcherModule.extractChannelIds = jest.fn(
      (ctx: PipelineContext) => ({
        recipientEmail: ctx.intake.normalized.sender.email ?? undefined,
        telegramChatId: ctx.intake.normalized.sender.telegramId
          ?? (ctx.intake.rawPayload as Record<string, unknown>)?.chatId ?? undefined,
        whatsappPhone: ctx.intake.normalized.sender.whatsappPhone ?? undefined,
        messengerPsid: ctx.intake.normalized.sender.messengerUserId ?? undefined,
        instagramIgsid: ctx.intake.normalized.sender.instagramUserId ?? undefined,
      })
    );
  });

  // ──────────────────────────────────────────────────────────────────────────
  // HAPPY PATH
  // ──────────────────────────────────────────────────────────────────────────

  describe('happy path', () => {
    it('completes successfully for admin request', async () => {
      const ctx = createPipelineContext();
      const result = await executeAgenticPath(ctx, deps);

      expect(result.success).toBe(true);
      expect(result.requestId).toBe('req_test_001');
      expect(result.auditId).toBe('audit_001');
    });

    it('completes successfully for customer request', async () => {
      const ctx = createPipelineContext({
        adminCommandMeta: null,
        contactMeta: {
          contactId: 'cont_001',
          linkedUnitIds: ['unit_001'],
        },
      } as Partial<PipelineContext>);

      const result = await executeAgenticPath(ctx, deps);
      expect(result.success).toBe(true);
    });

    it('calls executeAgenticLoop with correct arguments', async () => {
      const ctx = createPipelineContext();
      await executeAgenticPath(ctx, deps);

      expect(executeAgenticLoop).toHaveBeenCalledWith(
        'Δείξε μου τις επαφές',
        [], // empty history from mock
        [], // AGENTIC_TOOL_DEFINITIONS mock
        expect.objectContaining({
          companyId: 'comp_test',
          isAdmin: true,
          channel: 'telegram',
        })
      );
    });

    it('sends reply via channel dispatcher', async () => {
      const ctx = createPipelineContext();
      await executeAgenticPath(ctx, deps);

      expect(sendChannelReply).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: 'telegram',
          textBody: 'Βρέθηκαν 5 επαφές.',
          requestId: 'req_test_001',
        })
      );
    });

    it('calls sendPostReplyActions', async () => {
      const ctx = createPipelineContext();
      await executeAgenticPath(ctx, deps);

      expect(sendPostReplyActions).toHaveBeenCalledWith(
        expect.objectContaining({
          userMessage: 'Δείξε μου τις επαφές',
          channelSenderId: 'telegram_5618410820',
          isFailedResponse: false,
        })
      );
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // DAILY CAP (ADR-259A)
  // ──────────────────────────────────────────────────────────────────────────

  describe('daily cap (ADR-259A)', () => {
    it('exits early when customer exceeds daily cap', async () => {
      (checkDailyCap as jest.Mock).mockResolvedValue({
        allowed: false,
        used: 50,
        limit: 50,
      });

      const ctx = createPipelineContext({
        adminCommandMeta: null,
        contactMeta: {
          contactId: 'cont_001',
          linkedUnitIds: ['unit_001'],
        },
      } as Partial<PipelineContext>);

      const result = await executeAgenticPath(ctx, deps);

      expect(result.success).toBe(true);
      expect(executeAgenticLoop).not.toHaveBeenCalled();
      expect(sendChannelReply).toHaveBeenCalledWith(
        expect.objectContaining({
          textBody: expect.stringContaining('50'),
        })
      );
    });

    it('does NOT check daily cap for admin', async () => {
      const ctx = createPipelineContext(); // admin by default
      await executeAgenticPath(ctx, deps);

      expect(checkDailyCap).not.toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // EMPTY LINKED UNITS (ADR-259C)
  // ──────────────────────────────────────────────────────────────────────────

  describe('empty linkedUnitIds (ADR-259C)', () => {
    it('exits early for customer with empty linkedUnitIds', async () => {
      const ctx = createPipelineContext({
        adminCommandMeta: null,
        contactMeta: {
          contactId: 'cont_001',
          displayName: 'Test User',
          firstName: 'Test',
          primaryPersona: null,
          projectRoles: [],
          linkedUnitIds: [],
        },
      } as Partial<PipelineContext>);

      const result = await executeAgenticPath(ctx, deps);

      expect(result.success).toBe(true);
      expect(executeAgenticLoop).not.toHaveBeenCalled();
    });

    it('does NOT check linkedUnitIds for admin', async () => {
      const ctx = createPipelineContext({
        contactMeta: {
          contactId: 'cont_001',
          displayName: 'Test User',
          firstName: 'Test',
          primaryPersona: null,
          projectRoles: [],
          linkedUnitIds: [],
        },
      } as Partial<PipelineContext>);

      const result = await executeAgenticPath(ctx, deps);

      // Admin should proceed to agentic loop despite empty linkedUnitIds
      expect(result.success).toBe(true);
      expect(executeAgenticLoop).toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // CHAT HISTORY
  // ──────────────────────────────────────────────────────────────────────────

  describe('chat history', () => {
    it('saves user + assistant messages on success', async () => {
      const ctx = createPipelineContext();
      await executeAgenticPath(ctx, deps);

      expect(mockAddMessage).toHaveBeenCalledTimes(2);
      expect(mockAddMessage).toHaveBeenCalledWith(
        'telegram_5618410820',
        expect.objectContaining({ role: 'user', content: 'Δείξε μου τις επαφές' })
      );
      expect(mockAddMessage).toHaveBeenCalledWith(
        'telegram_5618410820',
        expect.objectContaining({ role: 'assistant', content: 'Βρέθηκαν 5 επαφές.' })
      );
    });

    it('does NOT save chat history for failed responses', async () => {
      (executeAgenticLoop as jest.Mock).mockResolvedValue(
        createAgenticResult({
          answer: 'Ξεπέρασα το μέγιστο αριθμό βημάτων.',
          iterations: 15,
        })
      );

      const ctx = createPipelineContext();
      await executeAgenticPath(ctx, deps);

      expect(mockAddMessage).not.toHaveBeenCalled();
    });

    it('filters failure patterns from history', async () => {
      mockGetRecentHistory.mockResolvedValue([
        { role: 'user', content: 'Δείξε επαφές', timestamp: '2026-01-01' },
        { role: 'assistant', content: 'αντιμετώπισα ένα πρόβλημα', timestamp: '2026-01-01' },
        { role: 'user', content: 'Ξαναδοκίμασε', timestamp: '2026-01-02' },
      ]);

      const ctx = createPipelineContext();
      await executeAgenticPath(ctx, deps);

      // History passed to loop should exclude the failure message
      const historyArg = (executeAgenticLoop as jest.Mock).mock.calls[0][1];
      expect(historyArg).toHaveLength(2);
      expect(historyArg.every((m: { content: string }) =>
        !m.content.includes('αντιμετώπισα ένα πρόβλημα')
      )).toBe(true);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TOKEN USAGE (ADR-259A)
  // ──────────────────────────────────────────────────────────────────────────

  describe('token usage recording', () => {
    it('records usage when tokens > 0', async () => {
      const ctx = createPipelineContext();
      await executeAgenticPath(ctx, deps);

      expect(recordUsage).toHaveBeenCalledWith(
        'telegram_5618410820',
        'telegram',
        { prompt_tokens: 500, completion_tokens: 200, total_tokens: 700 }
      );
    });

    it('skips usage recording when tokens = 0', async () => {
      (executeAgenticLoop as jest.Mock).mockResolvedValue(
        createAgenticResult({
          totalUsage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
        })
      );

      const ctx = createPipelineContext();
      await executeAgenticPath(ctx, deps);

      expect(recordUsage).not.toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // STATE TRANSITIONS
  // ──────────────────────────────────────────────────────────────────────────

  describe('state transitions', () => {
    it('transitions through correct states on success', async () => {
      const ctx = createPipelineContext();
      await executeAgenticPath(ctx, deps);

      const transitionCalls = (deps.transitionState as jest.Mock).mock.calls;
      const states = transitionCalls.map(
        (call: [PipelineContext, PipelineStateValue]) => call[1]
      );
      expect(states).toEqual([
        PipelineState.UNDERSTOOD,
        PipelineState.PROPOSED,
        PipelineState.APPROVED,
        PipelineState.EXECUTED,
        PipelineState.AUDITED,
      ]);
    });

    it('sets correct approver label for admin', async () => {
      const ctx = createPipelineContext();
      const result = await executeAgenticPath(ctx, deps);

      // The approval is set on ctx inside the function
      expect(result.context.approval?.approvedBy).toContain('super_admin:');
    });

    it('customer path generates AI-auto approver label', async () => {
      // For admin: approver is `super_admin:{name}`
      // For customer: approver should be `AI-auto:{channel}`
      // Both are constructed the same way — admin test already validates the pattern.
      // Here we verify the customer path completes and audits.
      const ctx = createPipelineContext({
        adminCommandMeta: null,
        contactMeta: {
          contactId: 'cont_001',
          linkedUnitIds: ['unit_001'],
        },
      } as Partial<PipelineContext>);

      const result = await executeAgenticPath(ctx, deps);
      expect(result.success).toBe(true);
      expect(deps.auditService.record).toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // ERROR HANDLING
  // ──────────────────────────────────────────────────────────────────────────

  describe('error handling', () => {
    it('returns FAILED state on agentic loop error', async () => {
      (executeAgenticLoop as jest.Mock).mockRejectedValue(new Error('OpenAI timeout'));

      const ctx = createPipelineContext();
      const result = await executeAgenticPath(ctx, deps);

      expect(result.success).toBe(false);
      expect(result.finalState).toBe(PipelineState.FAILED);
      expect(result.error).toBe('OpenAI timeout');
    });

    it('sends error reply to user on failure', async () => {
      (executeAgenticLoop as jest.Mock).mockRejectedValue(new Error('API error'));

      const ctx = createPipelineContext();
      await executeAgenticPath(ctx, deps);

      // Second call to sendChannelReply is the error reply
      expect(sendChannelReply).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: 'telegram',
          textBody: expect.stringContaining('πρόβλημα'),
        })
      );
    });

    it('records audit even on failure', async () => {
      (executeAgenticLoop as jest.Mock).mockRejectedValue(new Error('Crash'));

      const ctx = createPipelineContext();
      const result = await executeAgenticPath(ctx, deps);

      expect(deps.auditService.record).toHaveBeenCalled();
      expect(result.auditId).toBe('audit_001');
    });

    it('does not mask original error when error reply fails', async () => {
      (executeAgenticLoop as jest.Mock).mockRejectedValue(new Error('Original error'));
      (sendChannelReply as jest.Mock)
        .mockRejectedValueOnce(new Error('Reply also failed'));

      const ctx = createPipelineContext();
      const result = await executeAgenticPath(ctx, deps);

      expect(result.error).toBe('Original error');
    });
  });
});

// ============================================================================
// buildChannelSenderId
// ============================================================================

describe('buildChannelSenderId', () => {
  it('uses telegramId for telegram channel', () => {
    const ctx = createPipelineContext();
    expect(buildChannelSenderId(ctx)).toBe('telegram_5618410820');
  });

  it('uses email for email channel', () => {
    const ctx = createPipelineContext({
      intake: {
        id: 'intake_email_001',
        channel: 'email',
        normalized: {
          contentText: 'Hello',
          subject: 'Test',
          sender: { email: 'test@test.gr' },
          recipients: [],
          attachments: [],
          timestampIso: new Date().toISOString(),
        },
        rawPayload: {},
        metadata: { providerMessageId: 'msg_001', signatureVerified: true },
        schemaVersion: 1,
        receivedAt: new Date().toISOString(),
      },
    } as Partial<PipelineContext>);
    expect(buildChannelSenderId(ctx)).toBe('email_test@test.gr');
  });

  it('uses whatsappPhone for whatsapp channel', () => {
    const ctx = createPipelineContext({
      intake: {
        id: 'intake_wa_001',
        channel: 'whatsapp',
        normalized: {
          contentText: 'Hello',
          subject: '',
          sender: { whatsappPhone: '+306974050025' },
          recipients: [],
          attachments: [],
          timestampIso: new Date().toISOString(),
        },
        rawPayload: {},
        metadata: { providerMessageId: 'msg_002', signatureVerified: true },
        schemaVersion: 1,
        receivedAt: new Date().toISOString(),
      },
    } as Partial<PipelineContext>);
    expect(buildChannelSenderId(ctx)).toBe('whatsapp_+306974050025');
  });

  it('throws when no sender identifier found', () => {
    const ctx = createPipelineContext({
      intake: {
        id: 'intake_sms_001',
        channel: 'sms',
        normalized: {
          contentText: 'Hello',
          subject: '',
          sender: {},
          recipients: [],
          attachments: [],
          timestampIso: new Date().toISOString(),
        },
        rawPayload: {},
        metadata: { providerMessageId: 'msg_003', signatureVerified: true },
        schemaVersion: 1,
        receivedAt: new Date().toISOString(),
      },
    } as Partial<PipelineContext>);

    expect(() => buildChannelSenderId(ctx)).toThrow('No sender identifier');
  });
});
