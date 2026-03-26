/* eslint-disable no-restricted-syntax */

// =============================================================================
// UC-006: DOCUMENT REQUEST MODULE — UNIT TESTS
// =============================================================================

jest.mock('server-only', () => ({}));
jest.mock('@/lib/telemetry/Logger', () => ({ createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }) }));
jest.mock('@/lib/error-utils', () => ({ getErrorMessage: jest.fn((e: unknown) => e instanceof Error ? e.message : String(e)) }));
jest.mock('@/config/firestore-collections', () => ({ COLLECTIONS: { CONTACTS: 'contacts', AI_PIPELINE_AUDIT: 'ai_pipeline_audit', UNITS: 'units', BUILDINGS: 'buildings', PROJECTS: 'projects', CONSTRUCTION_PHASES: 'construction_phases' } }));
jest.mock('@/config/firestore-field-constants', () => ({ FIELDS: { COMPANY_ID: 'companyId', CREATED_AT: 'createdAt', STATUS: 'status' } }));
jest.mock('@/config/tenant', () => ({ getCompanyId: () => 'comp_pagonis' }));
jest.mock('@/config/ai-pipeline-config', () => ({ PIPELINE_PROTOCOL_CONFIG: { SCHEMA_VERSION: 1 } }));

// Firestore mock
const mockSet = jest.fn().mockResolvedValue(undefined);
const mockDoc = jest.fn(() => ({ set: mockSet }));
const mockCollection = jest.fn(() => ({
  doc: mockDoc,
  limit: jest.fn().mockReturnThis(),
  get: jest.fn().mockResolvedValue({ empty: false, docs: [] }),
}));
jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminFirestore: () => ({ collection: mockCollection }),
}));

// Shared service mocks
const mockFindContactByEmail = jest.fn().mockResolvedValue({ contactId: 'ct_001', displayName: 'Giorgos' });
jest.mock('../../../shared/contact-lookup', () => ({
  findContactByEmail: (...args: unknown[]) => Reflect.apply(mockFindContactByEmail, null, args),
}));

const mockSendChannelReply = jest.fn().mockResolvedValue({ success: true, messageId: 'msg_reply_001', channel: 'email' });
const mockExtractChannelIds = jest.fn(() => ({ telegramChatId: null }));
jest.mock('../../../shared/channel-reply-dispatcher', () => ({
  sendChannelReply: (...args: unknown[]) => Reflect.apply(mockSendChannelReply, null, args),
  extractChannelIds: (...args: unknown[]) => Reflect.apply(mockExtractChannelIds, null, args),
}));

const mockGenerateAIReply = jest.fn().mockResolvedValue({ replyText: 'Test reply\n\nMe ektimisi,', aiGenerated: true, model: 'gpt-4o-mini', durationMs: 500 });
jest.mock('../../../shared/ai-reply-generator', () => ({
  generateAIReply: (...args: unknown[]) => Reflect.apply(mockGenerateAIReply, null, args),
}));

const mockGetSenderHistory = jest.fn().mockResolvedValue({ recentEmails: [], isReturningContact: false, totalPreviousEmails: 0 });
jest.mock('../../../shared/sender-history', () => ({
  getSenderHistory: (...args: unknown[]) => Reflect.apply(mockGetSenderHistory, null, args),
}));

jest.mock('@/services/enterprise-id.service', () => ({
  generatePipelineAuditId: jest.fn(() => 'aud_test_001'),
}));

import { DocumentRequestModule } from '../document-request-module';

// ---------------------------------------------------------------------------
// HELPER: Mock PipelineContext
// ---------------------------------------------------------------------------

function createMockCtx(overrides?: Record<string, unknown>) {
  return {
    requestId: 'req_test_001',
    companyId: 'comp_pagonis',
    state: 'understood',
    intake: {
      id: 'intake_001',
      channel: 'email',
      rawPayload: { subject: 'Test Subject', body: 'Test body' },
      normalized: {
        sender: { id: 'sender@test.com', displayName: 'Giorgos Test', name: 'Giorgos Test', email: 'sender@test.com' },
        recipients: [],
        subject: 'Test Subject',
        contentText: 'Test message about invoice',
        attachments: [],
        timestampIso: new Date().toISOString(),
      },
      metadata: { providerMessageId: 'pm_001', signatureVerified: true },
      schemaVersion: 1,
    },
    understanding: { intent: 'invoice', confidence: 0.95, entities: {} },
    lookupData: {},
    errors: [],
    startedAt: new Date().toISOString(),
    stepDurations: {},
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// TESTS
// ---------------------------------------------------------------------------

describe('UC-006: DocumentRequestModule', () => {
  let mod: DocumentRequestModule;

  beforeEach(() => {
    mod = new DocumentRequestModule();
    jest.clearAllMocks();
  });

  // ── 1. Identity ──

  it('has correct moduleId and handledIntents', () => {
    expect(mod.moduleId).toBe('UC-006');
    expect(mod.handledIntents).toContain('invoice');
    expect(mod.handledIntents).toContain('document_request');
    expect(mod.handledIntents).toContain('report_request');
    expect(mod.handledIntents).toHaveLength(3);
  });

  // ── 2. lookup: detects request type ──

  it('lookup detects request type from intent (invoice vs document vs report)', async () => {
    const ctxInvoice = createMockCtx({ understanding: { intent: 'invoice', confidence: 0.9, entities: {} } });
    const resultInvoice = await mod.lookup(ctxInvoice as never);
    expect(resultInvoice.requestType).toBe('invoice');

    const ctxDoc = createMockCtx({ understanding: { intent: 'document_request', confidence: 0.9, entities: {} } });
    const resultDoc = await mod.lookup(ctxDoc as never);
    expect(resultDoc.requestType).toBe('document');

    const ctxReport = createMockCtx({ understanding: { intent: 'report_request', confidence: 0.9, entities: {} } });
    const resultReport = await mod.lookup(ctxReport as never);
    expect(resultReport.requestType).toBe('report');
  });

  // ── 3. propose: generates acknowledgment ──

  it('propose generates acknowledgment with requiresManualFollowUp=true and autoApprovable=false', async () => {
    const ctx = createMockCtx();
    const lookupResult = await mod.lookup(ctx as never);

    const ctxWithLookup = createMockCtx({ lookupData: lookupResult });
    const proposal = await mod.propose(ctxWithLookup as never);

    expect(proposal.autoApprovable).toBe(false);
    expect(proposal.summary.toLowerCase()).toContain('τιμολόγι');
    expect(proposal.suggestedActions).toHaveLength(1);
    expect(proposal.suggestedActions[0].type).toBe('acknowledge_document_request');
    expect(proposal.suggestedActions[0].params.requiresManualFollowUp).toBe(true);
  });

  // ── 4. execute: records request and sends reply ──

  it('execute records request in audit trail and sends reply', async () => {
    const lookupData = {
      senderEmail: 'sender@test.com',
      senderName: 'Giorgos Test',
      senderContact: { contactId: 'ct_001', displayName: 'Giorgos' },
      isKnownContact: true,
      originalSubject: 'Test Subject',
      requestDescription: 'Need an invoice',
      requestType: 'invoice',
      companyId: 'comp_pagonis',
      senderHistory: null,
    };

    const ctx = createMockCtx({
      lookupData,
      proposal: {
        suggestedActions: [{
          type: 'acknowledge_document_request',
          params: {
            senderEmail: 'sender@test.com',
            senderName: 'Giorgos Test',
            contactId: 'ct_001',
            isKnownContact: true,
            requestType: 'invoice',
            requestTypeLabel: 'Timologio',
            requestDescription: 'Need an invoice',
            companyId: 'comp_pagonis',
            draftReply: 'Test reply',
            aiGenerated: true,
            requiresManualFollowUp: true,
            channel: 'email',
            telegramChatId: null,
          },
        }],
      },
    });

    const result = await mod.execute(ctx as never);

    expect(result.success).toBe(true);
    expect(mockSet).toHaveBeenCalledTimes(1);
    expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({
      type: 'document_request',
      status: 'pending_preparation',
      requiresManualFollowUp: true,
    }));
    expect(mockSendChannelReply).toHaveBeenCalledTimes(1);
    expect(result.sideEffects).toContain('document_request_recorded:aud_test_001');
  });

  // ── 5. execute: handles missing contact ──

  it('execute handles missing contact gracefully (no action found returns error)', async () => {
    const ctx = createMockCtx({
      proposal: { suggestedActions: [] },
    });

    const result = await mod.execute(ctx as never);

    expect(result.success).toBe(false);
    expect(result.error).toContain('No acknowledge_document_request action found');
  });

  // ── 6. healthCheck ──

  it('healthCheck returns true when Firestore is reachable', async () => {
    const result = await mod.healthCheck();
    expect(result).toBe(true);
  });
});
