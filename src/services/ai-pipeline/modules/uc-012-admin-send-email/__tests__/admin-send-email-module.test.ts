/* eslint-disable no-restricted-syntax */

// =============================================================================
// UC-012: ADMIN SEND EMAIL MODULE — UNIT TESTS
// =============================================================================

jest.mock('server-only', () => ({}));
jest.mock('@/lib/telemetry/Logger', () => ({ createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }) }));
jest.mock('@/lib/error-utils', () => ({ getErrorMessage: jest.fn((e: unknown) => e instanceof Error ? e.message : String(e)) }));
jest.mock('@/config/firestore-collections', () => ({ COLLECTIONS: { CONTACTS: 'contacts', AI_PIPELINE_AUDIT: 'ai_pipeline_audit', UNITS: 'units', BUILDINGS: 'buildings', PROJECTS: 'projects', CONSTRUCTION_PHASES: 'construction_phases' } }));
jest.mock('@/config/firestore-field-constants', () => ({ FIELDS: { COMPANY_ID: 'companyId', CREATED_AT: 'createdAt', STATUS: 'status' } }));
jest.mock('@/config/tenant', () => ({ getCompanyId: () => 'comp_pagonis' }));
jest.mock('@/config/ai-pipeline-config', () => ({ PIPELINE_PROTOCOL_CONFIG: { SCHEMA_VERSION: 1 } }));

// Contact lookup mock
const mockFindContactByName = jest.fn().mockResolvedValue([
  { contactId: 'ct_001', name: 'Kostas Nikolaou', email: 'kostas@test.com', phone: '6900000002', company: null, type: 'individual' },
]);
jest.mock('../../../shared/contact-lookup', () => ({
  findContactByName: (...args: unknown[]) => mockFindContactByName(...args),
}));

// Channel reply mock
const mockSendChannelReply = jest.fn().mockResolvedValue({ success: true, messageId: 'msg_confirm_012', channel: 'telegram' });
const mockExtractChannelIds = jest.fn(() => ({ telegramChatId: '12345' }));
jest.mock('../../../shared/channel-reply-dispatcher', () => ({
  sendChannelReply: (...args: unknown[]) => mockSendChannelReply(...args),
  extractChannelIds: (...args: unknown[]) => mockExtractChannelIds(...args),
}));

// Mailgun sender mock
const mockSendReplyViaMailgun = jest.fn().mockResolvedValue({ success: true, messageId: 'mailgun_msg_001' });
jest.mock('../../../shared/mailgun-sender', () => ({
  sendReplyViaMailgun: (...args: unknown[]) => mockSendReplyViaMailgun(...args),
}));

import { AdminSendEmailModule } from '../admin-send-email-module';

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
      channel: 'telegram',
      rawPayload: { chatId: '12345' },
      normalized: {
        sender: { id: '5618410820', displayName: 'St€ F@no', email: null },
        recipients: [],
        contentText: 'Steile email ston Kosta oti metakineitai to rantevou',
        attachments: [],
        timestampIso: new Date().toISOString(),
      },
      metadata: { providerMessageId: 'pm_001', signatureVerified: true },
      schemaVersion: 1,
    },
    understanding: {
      intent: 'admin_send_email',
      confidence: 0.95,
      entities: {
        recipientName: 'Kostas',
        emailContent: 'Metakineitai to rantevou',
      },
    },
    adminCommandMeta: {
      adminIdentity: { displayName: 'Giorgos Pagonis', userId: '5618410820' },
    },
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

describe('UC-012: AdminSendEmailModule', () => {
  let mod: AdminSendEmailModule;

  beforeEach(() => {
    mod = new AdminSendEmailModule();
    jest.clearAllMocks();
  });

  // ── 1. Identity ──

  it('has correct moduleId and handledIntents', () => {
    expect(mod.moduleId).toBe('UC-012');
    expect(mod.handledIntents).toContain('admin_send_email');
    expect(mod.handledIntents).toHaveLength(1);
  });

  // ── 2. lookup: extracts recipient and finds contact ──

  it('lookup extracts recipient name and finds contact', async () => {
    const ctx = createMockCtx();
    const result = await mod.lookup(ctx as never);

    expect(result.recipientName).toBe('Kostas');
    expect(mockFindContactByName).toHaveBeenCalledWith('Kostas', 'comp_pagonis', 1);
    expect(result.targetContact).toEqual(expect.objectContaining({ contactId: 'ct_001', email: 'kostas@test.com' }));
  });

  // ── 3. lookup: handles explicit email pattern ──

  it('lookup detects explicit email in message text', async () => {
    const ctx = createMockCtx({
      intake: {
        id: 'intake_001',
        channel: 'telegram',
        rawPayload: { chatId: '12345' },
        normalized: {
          sender: { id: '5618410820', displayName: 'St€ F@no', email: null },
          recipients: [],
          contentText: 'Steile email sto georgios@example.com oti tha argisoume',
          attachments: [],
          timestampIso: new Date().toISOString(),
        },
        metadata: { providerMessageId: 'pm_001', signatureVerified: true },
        schemaVersion: 1,
      },
      understanding: {
        intent: 'admin_send_email',
        confidence: 0.9,
        entities: { recipientName: 'georgios', emailContent: 'tha argisoume' },
      },
    });

    const result = await mod.lookup(ctx as never);

    expect(result.overrideRecipientEmail).toBe('georgios@example.com');
  });

  // ── 4. propose: auto-approvable ──

  it('propose generates auto-approvable proposal', async () => {
    const lookupData = {
      recipientName: 'Kostas',
      emailContent: 'Metakineitai to rantevou',
      targetContact: { contactId: 'ct_001', name: 'Kostas Nikolaou', email: 'kostas@test.com', phone: null, company: null, type: 'individual' },
      companyId: 'comp_pagonis',
      overrideRecipientEmail: null,
    };

    const ctx = createMockCtx({ lookupData });
    const proposal = await mod.propose(ctx as never);

    expect(proposal.autoApprovable).toBe(true);
    expect(proposal.requiredApprovals).toEqual([]);
    expect(proposal.suggestedActions[0].type).toBe('admin_send_email_action');
    expect(proposal.suggestedActions[0].params.recipientEmail).toBe('kostas@test.com');
    expect(proposal.summary).toContain('Kostas');
    expect(proposal.summary).toContain('kostas@test.com');
  });

  // ── 5. execute: sends email via Mailgun ──

  it('execute sends email via Mailgun and confirms to admin', async () => {
    const ctx = createMockCtx({
      proposal: {
        suggestedActions: [{
          type: 'admin_send_email_action',
          params: {
            recipientName: 'Kostas Nikolaou',
            recipientEmail: 'kostas@test.com',
            recipientContactId: 'ct_001',
            emailContent: 'Metakineitai to rantevou',
            contactFound: true,
            channel: 'telegram',
            telegramChatId: '12345',
          },
        }],
      },
    });

    const result = await mod.execute(ctx as never);

    expect(result.success).toBe(true);
    expect(mockSendReplyViaMailgun).toHaveBeenCalledWith(expect.objectContaining({
      to: 'kostas@test.com',
      textBody: 'Metakineitai to rantevou',
    }));
    expect(result.sideEffects).toContain('email_sent:mailgun_msg_001');
    // Confirm sent to admin channel
    expect(mockSendChannelReply).toHaveBeenCalledTimes(1);
  });

  // ── 6. execute: handles send failure gracefully ──

  it('execute handles Mailgun send failure and notifies admin', async () => {
    mockSendReplyViaMailgun.mockResolvedValueOnce({ success: false, error: 'Mailgun 403: Forbidden' });

    const ctx = createMockCtx({
      proposal: {
        suggestedActions: [{
          type: 'admin_send_email_action',
          params: {
            recipientName: 'Kostas Nikolaou',
            recipientEmail: 'kostas@test.com',
            recipientContactId: 'ct_001',
            emailContent: 'Test content',
            contactFound: true,
            channel: 'telegram',
            telegramChatId: '12345',
          },
        }],
      },
    });

    const result = await mod.execute(ctx as never);

    // The execute still returns success=true (email failure is recorded as side effect)
    expect(result.success).toBe(true);
    expect(result.sideEffects).toEqual(
      expect.arrayContaining([expect.stringContaining('email_failed')])
    );
    // Admin still gets confirmation (failure message)
    expect(mockSendChannelReply).toHaveBeenCalledTimes(1);
    const confirmBody = mockSendChannelReply.mock.calls[0][0].textBody as string;
    expect(confirmBody).toContain('Αποτυχία');
  });
});
