/* eslint-disable no-restricted-syntax */

// =============================================================================
// UC-015: ADMIN CREATE CONTACT MODULE — UNIT TESTS
// =============================================================================

jest.mock('server-only', () => ({}));
jest.mock('@/lib/telemetry/Logger', () => ({ createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }) }));
jest.mock('@/lib/error-utils', () => ({ getErrorMessage: jest.fn((e: unknown) => e instanceof Error ? e.message : String(e)) }));
jest.mock('@/config/firestore-collections', () => ({ COLLECTIONS: { CONTACTS: 'contacts', PROPERTIES: 'properties', BUILDINGS: 'buildings', PROJECTS: 'projects', AI_PIPELINE_AUDIT: 'ai_pipeline_audit' } }));
jest.mock('@/config/firestore-field-constants', () => ({ FIELDS: { COMPANY_ID: 'companyId', CREATED_AT: 'createdAt', STATUS: 'status' } }));
jest.mock('@/config/tenant', () => ({ getCompanyId: () => 'comp_pagonis' }));
jest.mock('@/config/ai-pipeline-config', () => ({ PIPELINE_PROTOCOL_CONFIG: { SCHEMA_VERSION: 1 } }));

// Contact lookup mock
const mockFindContactByEmail = jest.fn().mockResolvedValue(null);
const mockCreateContactServerSide = jest.fn().mockResolvedValue({ contactId: 'ct_new_001', displayName: '\u039d\u03ad\u03c3\u03c4\u03bf\u03c1\u03b1\u03c2 \u03a0\u03b1\u03b3\u03ce\u03bd\u03b7\u03c2' });
const mockGetContactMissingFields = jest.fn().mockResolvedValue(['\u03a4\u03b7\u03bb\u03ad\u03c6\u03c9\u03bd\u03bf', '\u0391\u03a6\u0394']);
jest.mock('../../../shared/contact-lookup', () => ({
  findContactByEmail: (...args: unknown[]) => Reflect.apply(mockFindContactByEmail, null, args),
  createContactServerSide: (...args: unknown[]) => Reflect.apply(mockCreateContactServerSide, null, args),
  getContactMissingFields: (...args: unknown[]) => Reflect.apply(mockGetContactMissingFields, null, args),
}));

// Channel reply mock
const mockSendChannelReply = jest.fn().mockResolvedValue({ success: true, messageId: 'msg_reply_001' });
const mockExtractChannelIds = jest.fn(() => ({ telegramChatId: '12345' }));
jest.mock('../../../shared/channel-reply-dispatcher', () => ({
  sendChannelReply: (...args: unknown[]) => Reflect.apply(mockSendChannelReply, null, args),
  extractChannelIds: (...args: unknown[]) => Reflect.apply(mockExtractChannelIds, null, args),
}));

// Admin session mock
const mockSetAdminSession = jest.fn().mockResolvedValue(undefined);
const mockBuildAdminIdentifier = jest.fn(() => 'admin_12345');
jest.mock('../../../shared/admin-session', () => ({
  setAdminSession: (...args: unknown[]) => Reflect.apply(mockSetAdminSession, null, args),
  buildAdminIdentifier: (...args: unknown[]) => Reflect.apply(mockBuildAdminIdentifier, null, args),
}));

// Phone validation mock
jest.mock('@/lib/validation/phone-validation', () => ({
  extractPhoneFromText: jest.fn(() => null),
  extractEmailFromText: jest.fn(() => null),
}));

import { AdminCreateContactModule } from '../admin-create-contact-module';
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
        contentText: '\u0394\u03b7\u03bc\u03b9\u03bf\u03cd\u03c1\u03b3\u03b7\u03c3\u03b5 \u03b5\u03c0\u03b1\u03c6\u03ae \u039d\u03ad\u03c3\u03c4\u03bf\u03c1\u03b1\u03c2 \u03a0\u03b1\u03b3\u03ce\u03bd\u03b7\u03c2',
        attachments: [],
        timestampIso: new Date().toISOString(),
      },
      metadata: { providerMessageId: 'pm_001', signatureVerified: true },
      schemaVersion: 1,
    },
    understanding: { intent: 'admin_create_contact', confidence: 0.95, entities: {} },
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

describe('AdminCreateContactModule (UC-015)', () => {
  let mod: AdminCreateContactModule;

  beforeEach(() => {
    mod = new AdminCreateContactModule();
    jest.clearAllMocks();
  });

  // ── 1. Identity ──
  it('has moduleId UC-015 and handles admin_create_contact intent', () => {
    expect(mod.moduleId).toBe('UC-015');
    expect(mod.handledIntents).toContain('admin_create_contact');
  });

  // ── 2. Lookup: extracts name from message ──
  it('lookup extracts firstName and lastName from raw message', async () => {
    const ctx = createMockCtx();
    const result = await mod.lookup(ctx);

    expect(result.firstName).toBeDefined();
    expect(result.contactType).toBe('individual');
    expect(result.companyId).toBe('comp_pagonis');
  });

  // ── 3. Lookup: detects company type from keywords ──
  it('lookup detects company contact type from "\u03b5\u03c4\u03b1\u03b9\u03c1\u03b5\u03af\u03b1" keyword', async () => {
    const ctx = createMockCtx({
      intake: {
        id: 'intake_001',
        channel: 'telegram',
        rawPayload: {},
        normalized: {
          sender: { id: 'telegram_12345', displayName: '\u0393\u03b9\u03ce\u03c1\u03b3\u03bf\u03c2' },
          recipients: [],
          contentText: '\u0394\u03b7\u03bc\u03b9\u03bf\u03cd\u03c1\u03b3\u03b7\u03c3\u03b5 \u03b5\u03c0\u03b1\u03c6\u03ae \u03b5\u03c4\u03b1\u03b9\u03c1\u03b5\u03af\u03b1 TechCorp',
          attachments: [],
          timestampIso: new Date().toISOString(),
        },
        metadata: { providerMessageId: 'pm_001', signatureVerified: true },
        schemaVersion: 1,
      },
    });

    const result = await mod.lookup(ctx);
    expect(result.contactType).toBe('company');
  });

  // ── 4. Lookup: detects duplicate contact by email ──
  it('lookup detects duplicate contact when email already exists', async () => {
    // Mock extractEmailFromText to return an email
    const phoneValidation = jest.requireMock('@/lib/validation/phone-validation') as Record<string, jest.Mock>;
    phoneValidation.extractEmailFromText.mockReturnValue('nestoras@gmail.com');

    mockFindContactByEmail.mockResolvedValueOnce({
      contactId: 'ct_existing_001',
      name: '\u039d\u03ad\u03c3\u03c4\u03bf\u03c1\u03b1\u03c2 \u03a0\u03b1\u03b3\u03ce\u03bd\u03b7\u03c2',
    });

    const ctx = createMockCtx({
      intake: {
        id: 'intake_001',
        channel: 'telegram',
        rawPayload: {},
        normalized: {
          sender: { id: 'telegram_12345', displayName: '\u0393\u03b9\u03ce\u03c1\u03b3\u03bf\u03c2' },
          recipients: [],
          contentText: '\u0394\u03b7\u03bc\u03b9\u03bf\u03cd\u03c1\u03b3\u03b7\u03c3\u03b5 \u03b5\u03c0\u03b1\u03c6\u03ae \u039d\u03ad\u03c3\u03c4\u03bf\u03c1\u03b1\u03c2, nestoras@gmail.com',
          attachments: [],
          timestampIso: new Date().toISOString(),
        },
        metadata: { providerMessageId: 'pm_001', signatureVerified: true },
        schemaVersion: 1,
      },
    });

    const result = await mod.lookup(ctx);
    expect(result.duplicateContact).toBeDefined();
    expect((result.duplicateContact as Record<string, unknown>).contactId).toBe('ct_existing_001');
  });

  // ── 5. Propose: auto-approvable ──
  it('propose is auto-approvable with contact creation summary', async () => {
    const ctx = createMockCtx({
      lookupData: {
        firstName: '\u039d\u03ad\u03c3\u03c4\u03bf\u03c1\u03b1\u03c2',
        lastName: '\u03a0\u03b1\u03b3\u03ce\u03bd\u03b7\u03c2',
        email: 'nestoras@gmail.com',
        phone: null,
        contactType: 'individual',
        companyId: 'comp_pagonis',
        duplicateContact: null,
      },
    });

    const proposal = await mod.propose(ctx);
    expect(proposal.autoApprovable).toBe(true);
    expect(proposal.requiredApprovals).toHaveLength(0);
    expect(proposal.summary).toContain('\u039d\u03ad\u03c3\u03c4\u03bf\u03c1\u03b1\u03c2');
    expect(proposal.summary).toContain('\u0394\u03b7\u03bc\u03b9\u03bf\u03c5\u03c1\u03b3\u03af\u03b1');
    expect(proposal.suggestedActions[0].type).toBe('admin_create_contact_action');
  });

  // ── 6. Execute: creates contact and sets admin session ──
  it('execute creates contact, sends confirmation, and sets admin session', async () => {
    const ctx = createMockCtx({
      proposal: {
        suggestedActions: [
          {
            type: 'admin_create_contact_action',
            params: {
              firstName: '\u039d\u03ad\u03c3\u03c4\u03bf\u03c1\u03b1\u03c2',
              lastName: '\u03a0\u03b1\u03b3\u03ce\u03bd\u03b7\u03c2',
              email: 'nestoras@gmail.com',
              phone: null,
              contactType: 'individual',
              companyId: 'comp_pagonis',
              duplicateContactId: null,
              duplicateContactName: null,
              channel: 'telegram',
              telegramChatId: '12345',
            },
          },
        ],
      },
    });

    const result = await mod.execute(ctx);

    expect(result.success).toBe(true);
    expect(mockCreateContactServerSide).toHaveBeenCalledTimes(1);

    // Verify contact creation params
    const createArgs = mockCreateContactServerSide.mock.calls[0][0] as Record<string, unknown>;
    expect(createArgs.firstName).toBe('\u039d\u03ad\u03c3\u03c4\u03bf\u03c1\u03b1\u03c2');
    expect(createArgs.lastName).toBe('\u03a0\u03b1\u03b3\u03ce\u03bd\u03b7\u03c2');
    expect(createArgs.email).toBe('nestoras@gmail.com');
    expect(createArgs.type).toBe('individual');

    // Verify confirmation reply was sent
    expect(mockSendChannelReply).toHaveBeenCalledTimes(1);

    // Verify admin session was set
    expect(mockSetAdminSession).toHaveBeenCalledTimes(1);

    // Verify side effects
    const hasCreated = result.sideEffects.some((se: string) => se.startsWith('contact_created:'));
    expect(hasCreated).toBe(true);
  });

  // ── 7. Execute: handles creation failure gracefully ──
  it('execute handles contact creation failure and returns error', async () => {
    mockCreateContactServerSide.mockRejectedValueOnce(new Error('Firestore write failed'));

    const ctx = createMockCtx({
      proposal: {
        suggestedActions: [
          {
            type: 'admin_create_contact_action',
            params: {
              firstName: 'Test',
              lastName: 'User',
              email: null,
              phone: null,
              contactType: 'individual',
              companyId: 'comp_pagonis',
              duplicateContactId: null,
              duplicateContactName: null,
              channel: 'telegram',
              telegramChatId: '12345',
            },
          },
        ],
      },
    });

    const result = await mod.execute(ctx);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Firestore write failed');
  });
});
