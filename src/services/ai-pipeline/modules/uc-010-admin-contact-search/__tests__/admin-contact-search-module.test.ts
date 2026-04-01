/* eslint-disable no-restricted-syntax */

// =============================================================================
// UC-010: ADMIN CONTACT SEARCH MODULE — UNIT TESTS
// =============================================================================

jest.mock('server-only', () => ({}));
jest.mock('@/lib/telemetry/Logger', () => ({ createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }) }));
jest.mock('@/lib/error-utils', () => ({ getErrorMessage: jest.fn((e: unknown) => e instanceof Error ? e.message : String(e)) }));
jest.mock('@/config/firestore-collections', () => ({ COLLECTIONS: { CONTACTS: 'contacts', AI_PIPELINE_AUDIT: 'ai_pipeline_audit', PROPERTIES: 'properties', BUILDINGS: 'buildings', PROJECTS: 'projects', CONSTRUCTION_PHASES: 'construction_phases' } }));
jest.mock('@/config/firestore-field-constants', () => ({ FIELDS: { COMPANY_ID: 'companyId', CREATED_AT: 'createdAt', STATUS: 'status' } }));
jest.mock('@/config/tenant', () => ({ getCompanyId: () => 'comp_pagonis' }));
jest.mock('@/config/ai-pipeline-config', () => ({ PIPELINE_PROTOCOL_CONFIG: { SCHEMA_VERSION: 1 } }));

// Contact lookup mock
const mockFindContactByName = jest.fn().mockResolvedValue([
  { contactId: 'ct_001', name: 'Giorgos Papadopoulos', email: 'g@test.com', phone: '6900000001', company: null, type: 'individual' },
]);
const mockListContacts = jest.fn().mockResolvedValue([]);
const mockGetContactMissingFields = jest.fn().mockResolvedValue(['phone', 'email', 'vatNumber']);
jest.mock('../../../shared/contact-lookup', () => ({
  findContactByName: (...args: unknown[]) => Reflect.apply(mockFindContactByName, null, args),
  listContacts: (...args: unknown[]) => Reflect.apply(mockListContacts, null, args),
  getContactMissingFields: (...args: unknown[]) => Reflect.apply(mockGetContactMissingFields, null, args),
}));

// Channel reply mock
const mockSendChannelReply = jest.fn().mockResolvedValue({ success: true, messageId: 'msg_reply_010', channel: 'telegram' });
const mockExtractChannelIds = jest.fn(() => ({ telegramChatId: '12345' }));
jest.mock('../../../shared/channel-reply-dispatcher', () => ({
  sendChannelReply: (...args: unknown[]) => Reflect.apply(mockSendChannelReply, null, args),
  extractChannelIds: (...args: unknown[]) => Reflect.apply(mockExtractChannelIds, null, args),
}));

import { AdminContactSearchModule } from '../admin-contact-search-module';

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
        contentText: 'Test message',
        attachments: [],
        timestampIso: new Date().toISOString(),
      },
      metadata: { providerMessageId: 'pm_001', signatureVerified: true },
      schemaVersion: 1,
    },
    understanding: { intent: 'admin_contact_search', confidence: 0.95, entities: {} },
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

describe('UC-010: AdminContactSearchModule', () => {
  let mod: AdminContactSearchModule;

  beforeEach(() => {
    mod = new AdminContactSearchModule();
    jest.clearAllMocks();
  });

  // ── 1. Identity ──

  it('has correct moduleId and handledIntents', () => {
    expect(mod.moduleId).toBe('UC-010');
    expect(mod.handledIntents).toContain('admin_contact_search');
    expect(mod.handledIntents).toHaveLength(1);
  });

  // ── 2. lookup: search mode by name ──

  it('lookup uses search mode when contactName entity is provided', async () => {
    const ctx = createMockCtx({
      understanding: {
        intent: 'admin_contact_search',
        confidence: 0.95,
        entities: { contactName: 'Giorgos' },
      },
    });

    const result = await mod.lookup(ctx as never);

    expect(result.mode).toBe('search');
    expect(result.searchTerm).toBe('Giorgos');
    expect(mockFindContactByName).toHaveBeenCalledWith('Giorgos', 'comp_pagonis');
    expect(result.results).toHaveLength(1);
  });

  // ── 3. lookup: list mode ──

  it('lookup uses list mode when no contactName is provided', async () => {
    mockListContacts.mockResolvedValueOnce([
      { contactId: 'ct_002', name: 'Maria Kontou', email: 'm@test.com', phone: null, company: null, type: 'individual' },
    ]);

    const ctx = createMockCtx({
      intake: {
        id: 'intake_001',
        channel: 'telegram',
        rawPayload: { chatId: '12345' },
        normalized: {
          sender: { id: '5618410820', displayName: 'St€ F@no', email: null },
          recipients: [],
          contentText: 'δείξε μου τις επαφές',
          attachments: [],
          timestampIso: new Date().toISOString(),
        },
        metadata: { providerMessageId: 'pm_001', signatureVerified: true },
        schemaVersion: 1,
      },
      understanding: {
        intent: 'admin_contact_search',
        confidence: 0.9,
        entities: { contactName: '' },
      },
    });

    const result = await mod.lookup(ctx as never);

    expect(result.mode).toBe('list');
    expect(mockListContacts).toHaveBeenCalled();
  });

  // ── 4. propose: auto-approvable ──

  it('propose generates auto-approvable proposal', async () => {
    const lookupData = {
      mode: 'search',
      missingFieldsMode: false,
      searchTerm: 'Giorgos',
      typeFilter: 'all',
      results: [{ contactId: 'ct_001', name: 'Giorgos Papadopoulos', email: 'g@test.com', phone: null, company: null, type: 'individual' }],
      missingFieldsData: [],
      companyId: 'comp_pagonis',
    };

    const ctx = createMockCtx({ lookupData });
    const proposal = await mod.propose(ctx as never);

    expect(proposal.autoApprovable).toBe(true);
    expect(proposal.requiredApprovals).toEqual([]);
    expect(proposal.suggestedActions[0].type).toBe('admin_contact_search_reply');
    expect(proposal.summary).toContain('Giorgos');
  });

  // ── 5. execute: formats contact cards for search results ──

  it('execute formats contact results and sends reply', async () => {
    const results = [
      { contactId: 'ct_001', name: 'Giorgos Papadopoulos', email: 'g@test.com', phone: '6900000001', company: null, type: 'individual' },
    ];

    const ctx = createMockCtx({
      proposal: {
        suggestedActions: [{
          type: 'admin_contact_search_reply',
          params: {
            mode: 'search',
            missingFieldsMode: false,
            searchTerm: 'Giorgos',
            typeFilter: 'all',
            results,
            missingFieldsData: [],
            resultCount: 1,
            channel: 'telegram',
            telegramChatId: '12345',
          },
        }],
      },
    });

    const result = await mod.execute(ctx as never);

    expect(result.success).toBe(true);
    expect(mockSendChannelReply).toHaveBeenCalledTimes(1);
    const sentBody = mockSendChannelReply.mock.calls[0][0].textBody as string;
    expect(sentBody).toContain('Giorgos Papadopoulos');
    expect(sentBody).toContain('g@test.com');
  });

  // ── 6. execute: handles empty results ──

  it('execute handles empty search results gracefully', async () => {
    const ctx = createMockCtx({
      proposal: {
        suggestedActions: [{
          type: 'admin_contact_search_reply',
          params: {
            mode: 'search',
            missingFieldsMode: false,
            searchTerm: 'Nonexistent',
            typeFilter: 'all',
            results: [],
            missingFieldsData: [],
            resultCount: 0,
            channel: 'telegram',
            telegramChatId: '12345',
          },
        }],
      },
    });

    const result = await mod.execute(ctx as never);

    expect(result.success).toBe(true);
    expect(mockSendChannelReply).toHaveBeenCalledTimes(1);
    const sentBody = mockSendChannelReply.mock.calls[0][0].textBody as string;
    expect(sentBody).toContain('Nonexistent');
  });

  // ── 7. healthCheck ──

  it('healthCheck returns true', async () => {
    const result = await mod.healthCheck();
    expect(result).toBe(true);
  });
});
