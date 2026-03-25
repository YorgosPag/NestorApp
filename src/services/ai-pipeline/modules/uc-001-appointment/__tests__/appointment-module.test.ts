/* eslint-disable no-restricted-syntax */

/**
 * =============================================================================
 * UC-001 APPOINTMENT MODULE — UNIT TESTS
 * =============================================================================
 *
 * Tests for AppointmentModule: lookup, propose, execute, acknowledge, healthCheck.
 * Validates the IUCModule contract for appointment_request intent handling.
 *
 * @see appointment-module.ts
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
  generateAppointmentId: jest.fn(() => 'apt_test_001'),
}));

const mockFindContactByEmail = jest.fn().mockResolvedValue({
  contactId: 'ct_001',
  displayName: 'Γιώργος',
  email: 'test@example.com',
});
jest.mock('../../../shared/contact-lookup', () => ({
  findContactByEmail: (...args: unknown[]) => mockFindContactByEmail(...args),
}));

const mockSendChannelReply = jest.fn().mockResolvedValue({ success: true, channel: 'email', messageId: 'msg_reply_001' });
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

const mockCheckAvailability = jest.fn().mockResolvedValue({
  isDateFree: true,
  hasTimeConflict: false,
  existingAppointments: [],
  operatorBriefing: null,
});
jest.mock('../../../shared/availability-check', () => ({
  checkAvailability: (...args: unknown[]) => mockCheckAvailability(...args),
}));

const mockGenerateAIReply = jest.fn().mockResolvedValue({
  replyText: 'Αγαπητέ Γιώργο,\n\nΣας ευχαριστούμε...\n\nΜε εκτίμηση,',
  aiGenerated: true,
  model: 'gpt-4o-mini',
  durationMs: 500,
});
jest.mock('../../../shared/ai-reply-generator', () => ({
  generateAIReply: (...args: unknown[]) => mockGenerateAIReply(...args),
}));

const mockGetSenderHistory = jest.fn().mockResolvedValue({
  recentEmails: [],
  isReturningContact: false,
  totalPreviousEmails: 0,
});
jest.mock('../../../shared/sender-history', () => ({
  getSenderHistory: (...args: unknown[]) => mockGetSenderHistory(...args),
}));

// ── Import module under test ────────────────────────────────────────────────

import { AppointmentModule } from '../appointment-module';
import type { PipelineContext } from '@/types/ai-pipeline';

// ── Helper ──────────────────────────────────────────────────────────────────

function createMockCtx(overrides?: Record<string, unknown>): PipelineContext {
  return {
    requestId: 'req_test_001',
    companyId: 'comp_pagonis',
    state: 'understood',
    intake: {
      id: 'intake_001',
      channel: 'email',
      rawPayload: { subject: 'Test Subject', body: 'Test body' },
      normalized: {
        sender: { name: 'Γιώργος Τεστ', email: 'sender@test.com' },
        recipients: [],
        subject: 'Αίτημα Ραντεβού',
        contentText: 'Θα ήθελα ένα ραντεβού αύριο στις 10:00',
        attachments: [],
        timestampIso: new Date().toISOString(),
      },
      metadata: { providerMessageId: 'pm_001', signatureVerified: true },
      schemaVersion: 1,
    },
    understanding: {
      intent: 'appointment_request',
      confidence: 0.95,
      entities: { requestedDate: '2026-04-01', requestedTime: '10:00' },
    },
    lookupData: {},
    errors: [],
    startedAt: new Date().toISOString(),
    stepDurations: {},
    ...overrides,
  } as unknown as PipelineContext;
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('UC-001 AppointmentModule', () => {
  let mod: AppointmentModule;

  beforeEach(() => {
    mod = new AppointmentModule();
    jest.clearAllMocks();
  });

  // ── Identity ──────────────────────────────────────────────────────────────

  it('has correct moduleId and handledIntents', () => {
    expect(mod.moduleId).toBe('UC-001');
    expect(mod.handledIntents).toContain('appointment_request');
    expect(mod.handledIntents).toHaveLength(1);
  });

  // ── LOOKUP ────────────────────────────────────────────────────────────────

  it('lookup returns contact info and extracted date/time', async () => {
    const ctx = createMockCtx();
    const result = await mod.lookup(ctx);

    expect(mockFindContactByEmail).toHaveBeenCalledWith('sender@test.com', 'comp_pagonis');
    expect(result).toMatchObject({
      senderEmail: 'sender@test.com',
      isKnownContact: true,
      requestedDate: '2026-04-01',
      requestedTime: '10:00',
    });
  });

  it('lookup handles missing contact gracefully', async () => {
    mockFindContactByEmail.mockResolvedValueOnce(null);

    const ctx = createMockCtx();
    const result = await mod.lookup(ctx);

    expect(result).toMatchObject({
      senderContact: null,
      isKnownContact: false,
    });
  });

  // ── PROPOSE ───────────────────────────────────────────────────────────────

  it('propose generates reply and sets autoApprovable=false', async () => {
    const ctx = createMockCtx({
      lookupData: {
        senderEmail: 'sender@test.com',
        senderName: 'Γιώργος Τεστ',
        senderContact: { contactId: 'ct_001', displayName: 'Γιώργος', email: 'sender@test.com' },
        isKnownContact: true,
        requestedDate: '2026-04-01',
        requestedTime: '10:00',
        originalSubject: 'Αίτημα Ραντεβού',
        companyId: 'comp_pagonis',
        availability: null,
        senderHistory: null,
      },
    });

    const proposal = await mod.propose(ctx);

    expect(proposal.autoApprovable).toBe(false);
    expect(proposal.suggestedActions).toHaveLength(1);
    expect(proposal.suggestedActions[0].type).toBe('create_appointment');
    expect(mockGenerateAIReply).toHaveBeenCalled();
  });

  // ── EXECUTE ───────────────────────────────────────────────────────────────

  it('execute creates appointment and sends reply', async () => {
    const ctx = createMockCtx({
      proposal: {
        messageId: 'intake_001',
        suggestedActions: [
          {
            type: 'create_appointment',
            params: {
              senderEmail: 'sender@test.com',
              senderName: 'Γιώργος Τεστ',
              contactId: 'ct_001',
              isKnownContact: true,
              requestedDate: '2026-04-01',
              requestedTime: '10:00',
              description: 'Αίτημα ραντεβού',
              companyId: 'comp_pagonis',
              draftReply: 'Αγαπητέ Γιώργο...',
              aiGenerated: true,
              operatorBriefing: null,
              hasTimeConflict: false,
            },
          },
        ],
        requiredApprovals: ['salesManager'],
        autoApprovable: false,
        summary: 'Αίτημα ραντεβού',
        schemaVersion: 1,
      },
    });

    const result = await mod.execute(ctx);

    expect(result.success).toBe(true);
    expect(mockDocSet).toHaveBeenCalled();
    expect(mockSendChannelReply).toHaveBeenCalled();
    expect(result.sideEffects).toEqual(
      expect.arrayContaining([
        expect.stringContaining('appointment_created:'),
        expect.stringContaining('reply_sent:'),
      ])
    );
  });

  it('execute handles channel dispatch failure gracefully', async () => {
    mockSendChannelReply.mockResolvedValueOnce({
      success: false,
      channel: 'email',
      error: 'Mailgun timeout',
    });

    const ctx = createMockCtx({
      proposal: {
        messageId: 'intake_001',
        suggestedActions: [
          {
            type: 'create_appointment',
            params: {
              senderEmail: 'sender@test.com',
              senderName: 'Γιώργος',
              contactId: null,
              isKnownContact: false,
              requestedDate: null,
              requestedTime: null,
              description: 'Ραντεβού',
              companyId: 'comp_pagonis',
              draftReply: 'Reply text',
              aiGenerated: false,
              operatorBriefing: null,
              hasTimeConflict: false,
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

    // Appointment creation is primary — reply failure is non-fatal
    expect(result.success).toBe(true);
    expect(result.sideEffects).toEqual(
      expect.arrayContaining([expect.stringContaining('reply_failed:')])
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
