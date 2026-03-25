/* eslint-disable no-restricted-syntax */

// =============================================================================
// UC-016: ADMIN UPDATE CONTACT MODULE — UNIT TESTS
// =============================================================================

jest.mock('server-only', () => ({}));
jest.mock('@/lib/telemetry/Logger', () => ({ createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }) }));
jest.mock('@/lib/error-utils', () => ({ getErrorMessage: jest.fn((e: unknown) => e instanceof Error ? e.message : String(e)) }));
jest.mock('@/config/firestore-collections', () => ({ COLLECTIONS: { CONTACTS: 'contacts', UNITS: 'units', BUILDINGS: 'buildings', PROJECTS: 'projects', AI_PIPELINE_AUDIT: 'ai_pipeline_audit' } }));
jest.mock('@/config/firestore-field-constants', () => ({ FIELDS: { COMPANY_ID: 'companyId', CREATED_AT: 'createdAt', STATUS: 'status' } }));
jest.mock('@/config/tenant', () => ({ getCompanyId: () => 'comp_pagonis' }));
jest.mock('@/config/ai-pipeline-config', () => ({ PIPELINE_PROTOCOL_CONFIG: { SCHEMA_VERSION: 1 } }));

// Contact lookup mock
const mockFindContactByName = jest.fn().mockResolvedValue([
  { contactId: 'ct_001', name: '\u0393\u03b9\u03ce\u03c1\u03b3\u03bf\u03c2 \u03a0\u03b1\u03c0\u03b1\u03b4\u03cc\u03c0\u03bf\u03c5\u03bb\u03bf\u03c2' },
]);
const mockUpdateContactField = jest.fn().mockResolvedValue(true);
const mockRemoveContactField = jest.fn().mockResolvedValue(true);
const mockGetContactById = jest.fn().mockResolvedValue({
  contactId: 'ct_001',
  firstName: '\u0393\u03b9\u03ce\u03c1\u03b3\u03bf\u03c2',
  lastName: '\u03a0\u03b1\u03c0\u03b1\u03b4\u03cc\u03c0\u03bf\u03c5\u03bb\u03bf\u03c2',
  type: 'individual',
});
const mockGetContactMissingFields = jest.fn().mockResolvedValue(['\u0391\u03a6\u039c', '\u0395\u03c0\u03ac\u03b3\u03b3\u03b5\u03bb\u03bc\u03b1']);
const mockEmitEntitySyncSignal = jest.fn().mockResolvedValue(undefined);
jest.mock('../../../shared/contact-lookup', () => ({
  findContactByName: (...args: unknown[]) => mockFindContactByName(...args),
  updateContactField: (...args: unknown[]) => mockUpdateContactField(...args),
  removeContactField: (...args: unknown[]) => mockRemoveContactField(...args),
  getContactById: (...args: unknown[]) => mockGetContactById(...args),
  getContactMissingFields: (...args: unknown[]) => mockGetContactMissingFields(...args),
  emitEntitySyncSignal: (...args: unknown[]) => mockEmitEntitySyncSignal(...args),
}));

// Channel reply mock
const mockSendChannelReply = jest.fn().mockResolvedValue({ success: true, messageId: 'msg_reply_001' });
const mockExtractChannelIds = jest.fn(() => ({ telegramChatId: '12345' }));
jest.mock('../../../shared/channel-reply-dispatcher', () => ({
  sendChannelReply: (...args: unknown[]) => mockSendChannelReply(...args),
  extractChannelIds: (...args: unknown[]) => mockExtractChannelIds(...args),
}));

// Admin session mock
const mockGetAdminSession = jest.fn().mockResolvedValue(null);
const mockSetAdminSession = jest.fn().mockResolvedValue(undefined);
const mockBuildAdminIdentifier = jest.fn(() => 'admin_12345');
jest.mock('../../../shared/admin-session', () => ({
  getAdminSession: (...args: unknown[]) => mockGetAdminSession(...args),
  setAdminSession: (...args: unknown[]) => mockSetAdminSession(...args),
  buildAdminIdentifier: (...args: unknown[]) => mockBuildAdminIdentifier(...args),
}));

// Phone validation mock
jest.mock('@/lib/validation/phone-validation', () => ({
  extractPhoneFromText: jest.fn(() => null),
  extractEmailFromText: jest.fn(() => null),
  extractVatFromText: jest.fn(() => null),
}));

import { AdminUpdateContactModule } from '../admin-update-contact-module';
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
        contentText: '\u0392\u03ac\u03bb\u03b5 \u03c4\u03b7\u03bb\u03ad\u03c6\u03c9\u03bd\u03bf 6912345678 \u03c3\u03c4\u03bf\u03bd \u039d\u03ad\u03c3\u03c4\u03bf\u03c1\u03b1',
        attachments: [],
        timestampIso: new Date().toISOString(),
      },
      metadata: { providerMessageId: 'pm_001', signatureVerified: true },
      schemaVersion: 1,
    },
    understanding: { intent: 'admin_update_contact', confidence: 0.95, entities: {} },
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

describe('AdminUpdateContactModule (UC-016)', () => {
  let mod: AdminUpdateContactModule;

  beforeEach(() => {
    mod = new AdminUpdateContactModule();
    jest.clearAllMocks();
  });

  // ── 1. Identity ──
  it('has moduleId UC-016 and handles admin_update_contact intent', () => {
    expect(mod.moduleId).toBe('UC-016');
    expect(mod.handledIntents).toContain('admin_update_contact');
  });

  // ── 2. Lookup: detects SET action and phone field ──
  it('lookup detects SET action and phone field from AI entities', async () => {
    const phoneValidation = jest.requireMock('@/lib/validation/phone-validation') as Record<string, jest.Mock>;
    phoneValidation.extractPhoneFromText.mockReturnValue('6912345678');

    const ctx = createMockCtx({
      understanding: {
        intent: 'admin_update_contact',
        confidence: 0.95,
        entities: {
          action: 'set',
          fieldName: 'phone',
          fieldValue: '6912345678',
          contactName: '\u039d\u03ad\u03c3\u03c4\u03bf\u03c1\u03b1',
        },
      },
    });

    const result = await mod.lookup(ctx);

    expect(result.action).toBe('set');
    expect((result.detectedField as Record<string, unknown>)?.field).toBe('phone');
    expect(result.detectedValue).toBe('6912345678');
    expect(result.resolvedContact).toBeDefined();
  });

  // ── 3. Lookup: detects REMOVE action ──
  it('lookup detects REMOVE action from AI entity', async () => {
    const ctx = createMockCtx({
      understanding: {
        intent: 'admin_update_contact',
        confidence: 0.95,
        entities: {
          action: 'remove',
          fieldName: 'phone',
          contactName: '\u039d\u03ad\u03c3\u03c4\u03bf\u03c1\u03b1',
        },
      },
      intake: {
        id: 'intake_001',
        channel: 'telegram',
        rawPayload: {},
        normalized: {
          sender: { id: 'telegram_12345', displayName: '\u0393\u03b9\u03ce\u03c1\u03b3\u03bf\u03c2' },
          recipients: [],
          contentText: '\u0391\u03c6\u03b1\u03af\u03c1\u03b5\u03c3\u03b5 \u03c4\u03b7\u03bb\u03ad\u03c6\u03c9\u03bd\u03bf \u03b1\u03c0\u03cc \u03c4\u03bf\u03bd \u039d\u03ad\u03c3\u03c4\u03bf\u03c1\u03b1',
          attachments: [],
          timestampIso: new Date().toISOString(),
        },
        metadata: { providerMessageId: 'pm_001', signatureVerified: true },
        schemaVersion: 1,
      },
    });

    const result = await mod.lookup(ctx);

    expect(result.action).toBe('remove');
    expect((result.detectedField as Record<string, unknown>)?.field).toBe('phone');
    // Value should be null for remove action
    expect(result.detectedValue).toBeNull();
  });

  // ── 4. Lookup: resolves contact by name ──
  it('lookup resolves contact by name via findContactByName', async () => {
    const ctx = createMockCtx({
      understanding: {
        intent: 'admin_update_contact',
        confidence: 0.95,
        entities: {
          action: 'set',
          fieldName: 'email',
          fieldValue: 'test@example.com',
          contactName: '\u0393\u03b9\u03ce\u03c1\u03b3\u03bf\u03c2',
        },
      },
    });

    const result = await mod.lookup(ctx);

    expect(mockFindContactByName).toHaveBeenCalledWith('\u0393\u03b9\u03ce\u03c1\u03b3\u03bf\u03c2', 'comp_pagonis', 5);
    expect(result.resolvedContact).toBeDefined();
    expect((result.resolvedContact as Record<string, unknown>).contactId).toBe('ct_001');
  });

  // ── 5. Propose: auto-approvable with update summary ──
  it('propose is auto-approvable with update summary', async () => {
    const ctx = createMockCtx({
      lookupData: {
        detectedField: { field: 'phone', firestoreField: 'phone', greekLabel: '\u03a4\u03b7\u03bb\u03ad\u03c6\u03c9\u03bd\u03bf', keywords: ['phone'] },
        detectedValue: '6912345678',
        action: 'set',
        contactName: '\u039d\u03ad\u03c3\u03c4\u03bf\u03c1\u03b1',
        resolvedContact: { contactId: 'ct_001', name: '\u039d\u03ad\u03c3\u03c4\u03bf\u03c1\u03b1\u03c2 \u03a0\u03b1\u03b3\u03ce\u03bd\u03b7\u03c2' },
        multipleMatches: [],
        resolvedViaSession: false,
        error: null,
      },
    });

    const proposal = await mod.propose(ctx);

    expect(proposal.autoApprovable).toBe(true);
    expect(proposal.requiredApprovals).toHaveLength(0);
    expect(proposal.summary).toContain('\u03a4\u03b7\u03bb\u03ad\u03c6\u03c9\u03bd\u03bf');
    expect(proposal.summary).toContain('6912345678');
    expect(proposal.suggestedActions[0].type).toBe('admin_update_contact_action');
  });

  // ── 6. Execute: updates field and emits sync signal ──
  it('execute updates contact field, emits sync signal, and sets admin session', async () => {
    const ctx = createMockCtx({
      proposal: {
        suggestedActions: [
          {
            type: 'admin_update_contact_action',
            params: {
              contactId: 'ct_001',
              contactName: '\u039d\u03ad\u03c3\u03c4\u03bf\u03c1\u03b1\u03c2 \u03a0\u03b1\u03b3\u03ce\u03bd\u03b7\u03c2',
              field: 'phone',
              fieldLabel: '\u03a4\u03b7\u03bb\u03ad\u03c6\u03c9\u03bd\u03bf',
              value: '6912345678',
              action: 'set',
              resolvedViaSession: false,
              error: null,
              multipleMatches: null,
              channel: 'telegram',
              telegramChatId: '12345',
            },
          },
        ],
      },
    });

    const result = await mod.execute(ctx);

    expect(result.success).toBe(true);

    // Verify field was updated
    expect(mockUpdateContactField).toHaveBeenCalledWith('ct_001', 'phone', '6912345678', '\u0393\u03b9\u03ce\u03c1\u03b3\u03bf\u03c2');

    // Verify sync signal emitted
    expect(mockEmitEntitySyncSignal).toHaveBeenCalledWith('contacts', 'UPDATED', 'ct_001', 'comp_pagonis');

    // Verify admin session updated
    expect(mockSetAdminSession).toHaveBeenCalledTimes(1);

    // Verify confirmation reply sent
    expect(mockSendChannelReply).toHaveBeenCalledTimes(1);

    // Verify side effects
    const hasUpdated = result.sideEffects.some((se: string) => se.startsWith('contact_updated:'));
    expect(hasUpdated).toBe(true);
  });

  // ── 7. Execute: handles remove action ──
  it('execute removes contact field and emits sync signal', async () => {
    const ctx = createMockCtx({
      proposal: {
        suggestedActions: [
          {
            type: 'admin_update_contact_action',
            params: {
              contactId: 'ct_001',
              contactName: '\u039d\u03ad\u03c3\u03c4\u03bf\u03c1\u03b1\u03c2 \u03a0\u03b1\u03b3\u03ce\u03bd\u03b7\u03c2',
              field: 'phone',
              fieldLabel: '\u03a4\u03b7\u03bb\u03ad\u03c6\u03c9\u03bd\u03bf',
              value: null,
              action: 'remove',
              resolvedViaSession: false,
              error: null,
              multipleMatches: null,
              channel: 'telegram',
              telegramChatId: '12345',
            },
          },
        ],
      },
    });

    const result = await mod.execute(ctx);

    expect(result.success).toBe(true);

    // Verify field was removed (not updated)
    expect(mockRemoveContactField).toHaveBeenCalledWith('ct_001', 'phone', '\u0393\u03b9\u03ce\u03c1\u03b3\u03bf\u03c2');
    expect(mockUpdateContactField).not.toHaveBeenCalled();

    // Verify sync signal emitted
    expect(mockEmitEntitySyncSignal).toHaveBeenCalledWith('contacts', 'UPDATED', 'ct_001', 'comp_pagonis');

    // Verify side effects
    const hasRemoved = result.sideEffects.some((se: string) => se.startsWith('contact_field_removed:'));
    expect(hasRemoved).toBe(true);
  });
});
