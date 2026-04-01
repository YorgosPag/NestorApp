/* eslint-disable no-restricted-syntax */

/**
 * =============================================================================
 * UC-005 GENERAL INQUIRY MODULE — UNIT TESTS
 * =============================================================================
 *
 * Tests for GeneralInquiryModule: lookup, propose, execute, acknowledge, healthCheck.
 * Validates the IUCModule contract for general_inquiry, status_inquiry, unknown intents.
 *
 * @see general-inquiry-module.ts
 * @see IUCModule interface (src/types/ai-pipeline.ts)
 */

// ── Infrastructure mocks ────────────────────────────────────────────────────

jest.mock('server-only', () => ({}));
jest.mock('@/lib/telemetry/Logger', () => ({
  createModuleLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
}));
jest.mock('@/lib/error-utils', () => ({
  getErrorMessage: jest.fn((e: unknown) => (e instanceof Error ? e.message : String(e))),
}));
jest.mock('@/config/firestore-collections', () => ({
  COLLECTIONS: {
    CONTACTS: 'contacts',
    APPOINTMENTS: 'appointments',
    PROPERTIES: 'properties',
    BUILDINGS: 'buildings',
    AI_PIPELINE_AUDIT: 'ai_pipeline_audit',
  },
}));
jest.mock('@/config/firestore-field-constants', () => ({
  FIELDS: { COMPANY_ID: 'companyId', CREATED_AT: 'createdAt', STATUS: 'status' },
}));
jest.mock('@/config/tenant', () => ({ getCompanyId: () => 'comp_pagonis' }));
jest.mock('@/config/ai-pipeline-config', () => ({
  PIPELINE_PROTOCOL_CONFIG: { SCHEMA_VERSION: 1 },
}));

// ── Firestore mock ──────────────────────────────────────────────────────────

const mockDocGet = jest.fn();
const mockDocSet = jest.fn().mockResolvedValue(undefined);
const mockDocRef = { get: mockDocGet, set: mockDocSet };
const mockDoc = jest.fn().mockReturnValue(mockDocRef);
const mockWhere = jest.fn().mockReturnThis();
const mockOrderBy = jest.fn().mockReturnThis();
const mockLimitFn = jest.fn().mockReturnThis();
const mockCollGet = jest.fn();
const mockCollection = jest.fn().mockReturnValue({
  doc: mockDoc,
  where: mockWhere,
  orderBy: mockOrderBy,
  limit: mockLimitFn,
  get: mockCollGet,
});
jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminFirestore: () => ({ collection: mockCollection }),
}));

// ── Domain mocks ────────────────────────────────────────────────────────────

jest.mock('@/services/enterprise-id.service', () => ({
  generatePipelineAuditId: jest.fn(() => 'audit_inquiry_001'),
}));

const mockFindContactByEmail = jest.fn().mockResolvedValue({
  contactId: 'ct_005',
  displayName: 'Ελένη',
  email: 'eleni@test.com',
});
jest.mock('../../../shared/contact-lookup', () => ({
  findContactByEmail: (...args: unknown[]) => Reflect.apply(mockFindContactByEmail, null, args),
}));

const mockGetSenderHistory = jest.fn().mockResolvedValue({
  recentEmails: [],
  isReturningContact: false,
  totalPreviousEmails: 0,
});
jest.mock('../../../shared/sender-history', () => ({
  getSenderHistory: (...args: unknown[]) => Reflect.apply(mockGetSenderHistory, null, args),
}));

const mockGenerateAIReply = jest.fn().mockResolvedValue({
  replyText: 'Αγαπητέ/ή Ελένη,\n\nΣας ευχαριστούμε για την επικοινωνία...\n\nΜε εκτίμηση,',
  aiGenerated: true,
  model: 'gpt-4o-mini',
  durationMs: 380,
});
jest.mock('../../../shared/ai-reply-generator', () => ({
  generateAIReply: (...args: unknown[]) => Reflect.apply(mockGenerateAIReply, null, args),
}));

const mockSendChannelReply = jest.fn().mockResolvedValue({
  success: true,
  channel: 'email',
  messageId: 'msg_reply_005',
});
const mockExtractChannelIds = jest.fn(() => ({
  telegramChatId: null,
  whatsappPhone: null,
  messengerPsid: null,
  instagramIgsid: null,
}));
jest.mock('../../../shared/channel-reply-dispatcher', () => ({
  sendChannelReply: (...args: unknown[]) => Reflect.apply(mockSendChannelReply, null, args),
  extractChannelIds: (...args: unknown[]) => Reflect.apply(mockExtractChannelIds, null, args),
}));

// ── Import module under test ────────────────────────────────────────────────

import { GeneralInquiryModule } from '../general-inquiry-module';
import type { PipelineContext } from '@/types/ai-pipeline';

// ── Helper ──────────────────────────────────────────────────────────────────

function createMockCtx(overrides?: Record<string, unknown>): PipelineContext {
  return {
    requestId: 'req_test_005',
    companyId: 'comp_pagonis',
    state: 'understood',
    intake: {
      id: 'intake_005',
      channel: 'email',
      rawPayload: { subject: 'General Question', body: 'Some question' },
      normalized: {
        sender: { name: 'Ελένη Τεστ', email: 'eleni@test.com' },
        recipients: [],
        subject: 'Γενική Ερώτηση',
        contentText: 'Θα ήθελα πληροφορίες για τα νέα σας έργα στη Θεσσαλονίκη.',
        attachments: [],
        timestampIso: new Date().toISOString(),
      },
      metadata: { providerMessageId: 'pm_005', signatureVerified: true },
      schemaVersion: 1,
    },
    understanding: { intent: 'general_inquiry', confidence: 0.78, entities: {} },
    lookupData: {},
    errors: [],
    startedAt: new Date().toISOString(),
    stepDurations: {},
    ...overrides,
  } as unknown as PipelineContext;
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('UC-005 GeneralInquiryModule', () => {
  let mod: GeneralInquiryModule;

  beforeEach(() => {
    mod = new GeneralInquiryModule();
    jest.clearAllMocks();
  });

  // ── Identity ──────────────────────────────────────────────────────────────

  it('has correct moduleId and handledIntents (3 intents)', () => {
    expect(mod.moduleId).toBe('UC-005');
    expect(mod.handledIntents).toContain('general_inquiry');
    expect(mod.handledIntents).toContain('status_inquiry');
    expect(mod.handledIntents).toContain('unknown');
    expect(mod.handledIntents).toHaveLength(3);
  });

  // ── LOOKUP ────────────────────────────────────────────────────────────────

  it('lookup finds contact and extracts inquiry summary', async () => {
    const ctx = createMockCtx();
    const result = await mod.lookup(ctx);

    expect(mockFindContactByEmail).toHaveBeenCalledWith('eleni@test.com', 'comp_pagonis');
    expect(mockGetSenderHistory).toHaveBeenCalled();
    expect(result).toMatchObject({
      senderEmail: 'eleni@test.com',
      isKnownContact: true,
      inquirySummary: expect.stringContaining('πληροφορίες'),
    });
  });

  // ── PROPOSE ───────────────────────────────────────────────────────────────

  it('propose sets requiresManualFollowUp and autoApprovable=false', async () => {
    const ctx = createMockCtx({
      lookupData: {
        senderEmail: 'eleni@test.com',
        senderName: 'Ελένη Τεστ',
        senderContact: { contactId: 'ct_005', displayName: 'Ελένη', email: 'eleni@test.com' },
        isKnownContact: true,
        originalSubject: 'Γενική Ερώτηση',
        inquirySummary: 'Πληροφορίες για νέα έργα',
        companyId: 'comp_pagonis',
        senderHistory: null,
      },
    });

    const proposal = await mod.propose(ctx);

    expect(proposal.autoApprovable).toBe(false);
    expect(proposal.suggestedActions).toHaveLength(1);
    expect(proposal.suggestedActions[0].type).toBe('acknowledge_inquiry');
    expect(proposal.suggestedActions[0].params.requiresManualFollowUp).toBe(true);
    expect(mockGenerateAIReply).toHaveBeenCalledWith(
      expect.objectContaining({ useCase: 'general_inquiry' }),
      expect.anything(),
      'req_test_005'
    );
  });

  // ── EXECUTE ───────────────────────────────────────────────────────────────

  it('execute records inquiry as pending_follow_up and sends reply', async () => {
    const ctx = createMockCtx({
      proposal: {
        messageId: 'intake_005',
        suggestedActions: [
          {
            type: 'acknowledge_inquiry',
            params: {
              senderEmail: 'eleni@test.com',
              senderName: 'Ελένη Τεστ',
              contactId: 'ct_005',
              isKnownContact: true,
              inquirySummary: 'Πληροφορίες για νέα έργα',
              companyId: 'comp_pagonis',
              draftReply: 'Αγαπητέ/ή Ελένη...',
              aiGenerated: true,
              requiresManualFollowUp: true,
              channel: 'email',
              telegramChatId: null,
            },
          },
        ],
        requiredApprovals: ['salesManager'],
        autoApprovable: false,
        summary: 'Inquiry',
        schemaVersion: 1,
      },
    });

    const result = await mod.execute(ctx);

    expect(result.success).toBe(true);
    expect(mockDocSet).toHaveBeenCalled();

    // Verify the audit record includes pending_follow_up status
    const setCallArgs = mockDocSet.mock.calls[0][0] as Record<string, unknown>;
    expect(setCallArgs.status).toBe('pending_follow_up');
    expect(setCallArgs.requiresManualFollowUp).toBe(true);

    expect(mockSendChannelReply).toHaveBeenCalled();
    expect(result.sideEffects).toEqual(
      expect.arrayContaining([
        expect.stringContaining('inquiry_recorded:'),
        expect.stringContaining('reply_sent:'),
      ])
    );
  });

  it('execute handles errors gracefully', async () => {
    mockDocSet.mockRejectedValueOnce(new Error('Firestore write failed'));

    const ctx = createMockCtx({
      proposal: {
        messageId: 'intake_005',
        suggestedActions: [
          {
            type: 'acknowledge_inquiry',
            params: {
              senderEmail: 'eleni@test.com',
              senderName: 'Ελένη',
              contactId: null,
              isKnownContact: false,
              inquirySummary: 'Question',
              companyId: 'comp_pagonis',
              draftReply: 'Reply',
              aiGenerated: false,
              requiresManualFollowUp: true,
              channel: 'email',
              telegramChatId: null,
            },
          },
        ],
        requiredApprovals: ['salesManager'],
        autoApprovable: false,
        summary: 'Test',
        schemaVersion: 1,
      },
    });

    const result = await mod.execute(ctx);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Failed to process general inquiry');
  });

  // ── HEALTH CHECK ──────────────────────────────────────────────────────────

  it('healthCheck returns true when Firestore is reachable', async () => {
    mockCollGet.mockResolvedValueOnce({ docs: [] });
    const healthy = await mod.healthCheck();
    expect(healthy).toBe(true);
  });

  it('healthCheck returns false when Firestore throws', async () => {
    mockCollGet.mockRejectedValueOnce(new Error('Connection refused'));
    const healthy = await mod.healthCheck();
    expect(healthy).toBe(false);
  });
});
