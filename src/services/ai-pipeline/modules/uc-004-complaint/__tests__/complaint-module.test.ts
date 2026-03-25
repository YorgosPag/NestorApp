/* eslint-disable no-restricted-syntax */

/**
 * =============================================================================
 * UC-004 COMPLAINT MODULE — UNIT TESTS
 * =============================================================================
 *
 * Tests for ComplaintModule: lookup, propose, execute, acknowledge, healthCheck.
 * Validates the IUCModule contract for complaint and defect_report intent handling.
 *
 * @see complaint-module.ts
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
    UNITS: 'units',
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
  generatePipelineAuditId: jest.fn(() => 'audit_complaint_001'),
}));

const mockFindContactByEmail = jest.fn().mockResolvedValue({
  contactId: 'ct_004',
  displayName: 'Νίκος',
  email: 'nikos@test.com',
});
jest.mock('../../../shared/contact-lookup', () => ({
  findContactByEmail: (...args: unknown[]) => mockFindContactByEmail(...args),
}));

const mockGetSenderHistory = jest.fn().mockResolvedValue({
  recentEmails: [],
  isReturningContact: true,
  totalPreviousEmails: 3,
});
jest.mock('../../../shared/sender-history', () => ({
  getSenderHistory: (...args: unknown[]) => mockGetSenderHistory(...args),
}));

const mockGenerateAIReply = jest.fn().mockResolvedValue({
  replyText: 'Αγαπητέ Νίκο,\n\nΚατανοούμε τη δυσαρέσκειά σας...\n\nΜε εκτίμηση,',
  aiGenerated: true,
  model: 'gpt-4o-mini',
  durationMs: 450,
});
jest.mock('../../../shared/ai-reply-generator', () => ({
  generateAIReply: (...args: unknown[]) => mockGenerateAIReply(...args),
}));

const mockSendChannelReply = jest.fn().mockResolvedValue({
  success: true,
  channel: 'email',
  messageId: 'msg_reply_004',
});
const mockExtractChannelIds = jest.fn(() => ({
  telegramChatId: null,
  whatsappPhone: null,
  messengerPsid: null,
  instagramIgsid: null,
}));
jest.mock('../../../shared/channel-reply-dispatcher', () => ({
  sendChannelReply: (...args: unknown[]) => mockSendChannelReply(...args),
  extractChannelIds: (...args: unknown[]) => mockExtractChannelIds(...args),
}));

// ── Import module under test ────────────────────────────────────────────────

import { ComplaintModule } from '../complaint-module';
import type { PipelineContext } from '@/types/ai-pipeline';

// ── Helper ──────────────────────────────────────────────────────────────────

function createMockCtx(overrides?: Record<string, unknown>): PipelineContext {
  return {
    requestId: 'req_test_004',
    companyId: 'comp_pagonis',
    state: 'understood',
    intake: {
      id: 'intake_004',
      channel: 'email',
      rawPayload: { subject: 'Complaint', body: 'Problem with unit' },
      normalized: {
        sender: { name: 'Νίκος Τεστ', email: 'nikos@test.com' },
        recipients: [],
        subject: 'Πρόβλημα με διαμέρισμα',
        contentText: 'Υπάρχει υγρασία στο ταβάνι του σαλονιού, χρειάζεται άμεση επισκευή.',
        attachments: [],
        timestampIso: new Date().toISOString(),
      },
      metadata: { providerMessageId: 'pm_004', signatureVerified: true },
      schemaVersion: 1,
    },
    understanding: { intent: 'complaint', confidence: 0.91, entities: {} },
    lookupData: {},
    errors: [],
    startedAt: new Date().toISOString(),
    stepDurations: {},
    ...overrides,
  } as unknown as PipelineContext;
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('UC-004 ComplaintModule', () => {
  let mod: ComplaintModule;

  beforeEach(() => {
    mod = new ComplaintModule();
    jest.clearAllMocks();
  });

  // ── Identity ──────────────────────────────────────────────────────────────

  it('has correct moduleId and handledIntents (complaint + defect_report)', () => {
    expect(mod.moduleId).toBe('UC-004');
    expect(mod.handledIntents).toContain('complaint');
    expect(mod.handledIntents).toContain('defect_report');
    expect(mod.handledIntents).toHaveLength(2);
  });

  // ── LOOKUP ────────────────────────────────────────────────────────────────

  it('lookup finds contact and extracts complaint description', async () => {
    const ctx = createMockCtx();
    const result = await mod.lookup(ctx);

    expect(mockFindContactByEmail).toHaveBeenCalledWith('nikos@test.com', 'comp_pagonis');
    expect(mockGetSenderHistory).toHaveBeenCalled();
    expect(result).toMatchObject({
      senderEmail: 'nikos@test.com',
      isKnownContact: true,
      complaintDescription: expect.stringContaining('υγρασία'),
    });
  });

  // ── PROPOSE ───────────────────────────────────────────────────────────────

  it('propose generates empathetic reply with autoApprovable=false', async () => {
    const ctx = createMockCtx({
      lookupData: {
        senderEmail: 'nikos@test.com',
        senderName: 'Νίκος Τεστ',
        senderContact: { contactId: 'ct_004', displayName: 'Νίκος', email: 'nikos@test.com' },
        isKnownContact: true,
        originalSubject: 'Πρόβλημα με διαμέρισμα',
        complaintDescription: 'Υγρασία στο ταβάνι του σαλονιού',
        companyId: 'comp_pagonis',
        senderHistory: { recentEmails: [], isReturningContact: true, totalPreviousEmails: 3 },
      },
    });

    const proposal = await mod.propose(ctx);

    expect(proposal.autoApprovable).toBe(false);
    expect(proposal.suggestedActions).toHaveLength(1);
    expect(proposal.suggestedActions[0].type).toBe('acknowledge_complaint');
    expect(mockGenerateAIReply).toHaveBeenCalledWith(
      expect.objectContaining({ useCase: 'complaint' }),
      expect.anything(),
      'req_test_004'
    );
  });

  // ── EXECUTE ───────────────────────────────────────────────────────────────

  it('execute records complaint and sends reply', async () => {
    const ctx = createMockCtx({
      proposal: {
        messageId: 'intake_004',
        suggestedActions: [
          {
            type: 'acknowledge_complaint',
            params: {
              senderEmail: 'nikos@test.com',
              senderName: 'Νίκος Τεστ',
              contactId: 'ct_004',
              isKnownContact: true,
              complaintDescription: 'Υγρασία στο ταβάνι',
              companyId: 'comp_pagonis',
              draftReply: 'Αγαπητέ Νίκο, κατανοούμε...',
              aiGenerated: true,
              channel: 'email',
              telegramChatId: null,
            },
          },
        ],
        requiredApprovals: ['salesManager'],
        autoApprovable: false,
        summary: 'Complaint',
        schemaVersion: 1,
      },
    });

    const result = await mod.execute(ctx);

    expect(result.success).toBe(true);
    expect(mockDocSet).toHaveBeenCalled();
    expect(mockSendChannelReply).toHaveBeenCalled();
    expect(result.sideEffects).toEqual(
      expect.arrayContaining([
        expect.stringContaining('complaint_recorded:'),
        expect.stringContaining('reply_sent:'),
      ])
    );
  });

  it('execute is non-fatal on reply failure', async () => {
    mockSendChannelReply.mockResolvedValueOnce({
      success: false,
      channel: 'email',
      error: 'SMTP timeout',
    });

    const ctx = createMockCtx({
      proposal: {
        messageId: 'intake_004',
        suggestedActions: [
          {
            type: 'acknowledge_complaint',
            params: {
              senderEmail: 'nikos@test.com',
              senderName: 'Νίκος',
              contactId: null,
              isKnownContact: false,
              complaintDescription: 'Βλάβη στην πόρτα',
              companyId: 'comp_pagonis',
              draftReply: 'Reply text',
              aiGenerated: false,
              channel: 'email',
              telegramChatId: null,
            },
          },
        ],
        requiredApprovals: ['salesManager'],
        autoApprovable: false,
        summary: 'Complaint',
        schemaVersion: 1,
      },
    });

    const result = await mod.execute(ctx);

    // Complaint recording is primary — reply failure is non-fatal
    expect(result.success).toBe(true);
    expect(result.sideEffects).toEqual(
      expect.arrayContaining([
        expect.stringContaining('complaint_recorded:'),
        expect.stringContaining('reply_failed:'),
      ])
    );
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
