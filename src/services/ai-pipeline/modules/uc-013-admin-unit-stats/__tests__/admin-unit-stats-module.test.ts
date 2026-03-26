/* eslint-disable no-restricted-syntax */

// =============================================================================
// UC-013: ADMIN BUSINESS STATS MODULE — UNIT TESTS
// =============================================================================

jest.mock('server-only', () => ({}));
jest.mock('@/lib/telemetry/Logger', () => ({ createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }) }));
jest.mock('@/lib/error-utils', () => ({ getErrorMessage: jest.fn((e: unknown) => e instanceof Error ? e.message : String(e)) }));
jest.mock('@/config/firestore-collections', () => ({ COLLECTIONS: { CONTACTS: 'contacts', UNITS: 'units', BUILDINGS: 'buildings', PROJECTS: 'projects', AI_PIPELINE_AUDIT: 'ai_pipeline_audit' } }));
jest.mock('@/config/firestore-field-constants', () => ({ FIELDS: { COMPANY_ID: 'companyId', CREATED_AT: 'createdAt', STATUS: 'status' } }));
jest.mock('@/config/tenant', () => ({ getCompanyId: () => 'comp_pagonis' }));
jest.mock('@/config/ai-pipeline-config', () => ({ PIPELINE_PROTOCOL_CONFIG: { SCHEMA_VERSION: 1 } }));

// Firestore mock
const mockCollGet = jest.fn();
const mockWhere = jest.fn().mockReturnThis();
const mockCollection = jest.fn(() => ({
  where: mockWhere,
  get: mockCollGet,
}));
jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminFirestore: () => ({ collection: mockCollection }),
}));

// Channel reply mock
const mockSendChannelReply = jest.fn().mockResolvedValue({ success: true, messageId: 'msg_reply_001' });
const mockExtractChannelIds = jest.fn(() => ({ telegramChatId: '12345' }));
jest.mock('../../../shared/channel-reply-dispatcher', () => ({
  sendChannelReply: (...args: unknown[]) => Reflect.apply(mockSendChannelReply, null, args),
  extractChannelIds: (...args: unknown[]) => Reflect.apply(mockExtractChannelIds, null, args),
}));

import { AdminUnitStatsModule } from '../admin-unit-stats-module';
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
    understanding: { intent: 'admin_unit_stats', confidence: 0.95, entities: {} },
    lookupData: {},
    adminCommandMeta: { isAdminCommand: true, adminIdentity: { displayName: '\u0393\u03b9\u03ce\u03c1\u03b3\u03bf\u03c2', userId: '5618410820' } },
    errors: [],
    startedAt: new Date().toISOString(),
    stepDurations: {},
    ...overrides,
  } as unknown as PipelineContext;
}

function createUnitDocs() {
  return {
    empty: false,
    size: 5,
    docs: [
      { id: 'u1', data: () => ({ type: 'apartment', status: 'available', projectId: 'proj_001' }) },
      { id: 'u2', data: () => ({ type: 'studio', status: 'sold', projectId: 'proj_001' }) },
      { id: 'u3', data: () => ({ type: 'apartment', status: 'sold', projectId: 'proj_002' }) },
      { id: 'u4', data: () => ({ type: 'parking', status: 'available', projectId: 'proj_002' }) },
      { id: 'u5', data: () => ({ type: 'storage', status: 'reserved', projectId: 'proj_001' }) },
    ],
  };
}

function createProjectDocs() {
  return {
    empty: false,
    size: 2,
    docs: [
      { id: 'proj_001', data: () => ({ name: 'Nestor Residence' }) },
      { id: 'proj_002', data: () => ({ name: 'Apollo Tower' }) },
    ],
  };
}

function createContactDocs() {
  return {
    empty: false,
    size: 3,
    docs: [
      { id: 'ct_001', data: () => ({ type: 'individual' }) },
      { id: 'ct_002', data: () => ({ type: 'company' }) },
      { id: 'ct_003', data: () => ({ contactType: 'individual' }) },
    ],
  };
}

// ============================================================================
// TESTS
// ============================================================================

describe('AdminUnitStatsModule (UC-013)', () => {
  let mod: AdminUnitStatsModule;

  beforeEach(() => {
    mod = new AdminUnitStatsModule();
    jest.clearAllMocks();
  });

  // ── 1. Identity ──
  it('has moduleId UC-013 and handles admin_unit_stats intent', () => {
    expect(mod.moduleId).toBe('UC-013');
    expect(mod.handledIntents).toContain('admin_unit_stats');
  });

  // ── 2. Lookup: detects "units" stats type from Greek keyword ──
  it('lookup detects units stats type from keyword "\u03b1\u03ba\u03af\u03bd\u03b7\u03c4\u03b1"', async () => {
    mockCollGet
      .mockResolvedValueOnce(createProjectDocs())   // projects query
      .mockResolvedValueOnce(createUnitDocs());      // units query

    const ctx = createMockCtx({
      intake: {
        id: 'intake_001',
        channel: 'telegram',
        rawPayload: {},
        normalized: {
          sender: { id: 'telegram_12345', displayName: '\u0393\u03b9\u03ce\u03c1\u03b3\u03bf\u03c2' },
          recipients: [],
          contentText: '\u03a0\u03cc\u03c3\u03b1 \u03b1\u03ba\u03af\u03bd\u03b7\u03c4\u03b1 \u03ad\u03c7\u03bf\u03c5\u03bc\u03b5;',
          attachments: [],
          timestampIso: new Date().toISOString(),
        },
        metadata: { providerMessageId: 'pm_001', signatureVerified: true },
        schemaVersion: 1,
      },
    });

    const result = await mod.lookup(ctx);
    expect(result.statsType).toBe('units');
    expect(result.totalStats).toBeDefined();
  });

  // ── 3. Lookup: detects "contacts" stats type ──
  it('lookup detects contacts stats type from keyword "\u03b5\u03c0\u03b1\u03c6"', async () => {
    mockCollGet
      .mockResolvedValueOnce(createContactDocs())    // contacts query
      .mockResolvedValueOnce(createProjectDocs());    // projects query

    const ctx = createMockCtx({
      intake: {
        id: 'intake_001',
        channel: 'telegram',
        rawPayload: {},
        normalized: {
          sender: { id: 'telegram_12345', displayName: '\u0393\u03b9\u03ce\u03c1\u03b3\u03bf\u03c2' },
          recipients: [],
          contentText: '\u03a0\u03cc\u03c3\u03b5\u03c2 \u03b5\u03c0\u03b1\u03c6\u03ad\u03c2 \u03ad\u03c7\u03bf\u03c5\u03bc\u03b5;',
          attachments: [],
          timestampIso: new Date().toISOString(),
        },
        metadata: { providerMessageId: 'pm_001', signatureVerified: true },
        schemaVersion: 1,
      },
    });

    const result = await mod.lookup(ctx);
    expect(result.statsType).toBe('contacts');
    expect(result.contactStats).toBeDefined();
  });

  // ── 4. Lookup: defaults to "units" for generic question ──
  it('lookup defaults to units for generic stats question without keywords', async () => {
    mockCollGet
      .mockResolvedValueOnce(createProjectDocs())    // projects query
      .mockResolvedValueOnce(createUnitDocs());       // units query

    const ctx = createMockCtx({
      intake: {
        id: 'intake_001',
        channel: 'telegram',
        rawPayload: {},
        normalized: {
          sender: { id: 'telegram_12345', displayName: '\u0393\u03b9\u03ce\u03c1\u03b3\u03bf\u03c2' },
          recipients: [],
          contentText: '\u0394\u03ce\u03c3\u03b5 \u03bc\u03bf\u03c5 \u03b1\u03c1\u03b9\u03b8\u03bc\u03bf\u03cd\u03c2',
          attachments: [],
          timestampIso: new Date().toISOString(),
        },
        metadata: { providerMessageId: 'pm_001', signatureVerified: true },
        schemaVersion: 1,
      },
    });

    const result = await mod.lookup(ctx);
    expect(result.statsType).toBe('units');
  });

  // ── 5. Propose: auto-approvable with summary ──
  it('propose is auto-approvable with summary containing totals', async () => {
    const ctx = createMockCtx({
      lookupData: {
        statsType: 'units',
        projectFilter: null,
        totalStats: { total: 5, sold: 2, available: 2, reserved: 1, other: 0, byType: {} },
        projectBreakdown: [],
        contactStats: null,
        projectStats: null,
        companyId: 'comp_pagonis',
      },
    });

    const proposal = await mod.propose(ctx);
    expect(proposal.autoApprovable).toBe(true);
    expect(proposal.requiredApprovals).toHaveLength(0);
    expect(proposal.summary).toContain('5');
    expect(proposal.summary).toContain('\u03b1\u03ba\u03af\u03bd\u03b7\u03c4\u03b1');
    expect(proposal.suggestedActions[0].type).toBe('admin_unit_stats_reply');
  });

  // ── 6. Execute: formats stats with Greek labels and sends reply ──
  it('execute formats unit stats report and sends channel reply', async () => {
    const ctx = createMockCtx({
      proposal: {
        suggestedActions: [
          {
            type: 'admin_unit_stats_reply',
            params: {
              statsType: 'units',
              projectFilter: null,
              totalStats: { total: 5, sold: 2, available: 2, reserved: 1, other: 0, byType: { apartment: 2, studio: 1 } },
              projectBreakdown: [
                { projectId: 'proj_001', projectName: 'Nestor Residence', total: 3, sold: 1, available: 1, reserved: 1, other: 0 },
                { projectId: 'proj_002', projectName: 'Apollo Tower', total: 2, sold: 1, available: 1, reserved: 0, other: 0 },
              ],
              contactStats: null,
              projectStats: null,
              channel: 'telegram',
              telegramChatId: '12345',
            },
          },
        ],
      },
    });

    const result = await mod.execute(ctx);

    expect(result.success).toBe(true);
    expect(mockSendChannelReply).toHaveBeenCalledTimes(1);

    const callArgs = mockSendChannelReply.mock.calls[0][0] as Record<string, unknown>;
    const textBody = callArgs.textBody as string;

    // Verify Greek labels in formatted output
    expect(textBody).toContain('\u03a3\u03c4\u03b1\u03c4\u03b9\u03c3\u03c4\u03b9\u03ba\u03ac \u03b1\u03ba\u03b9\u03bd\u03ae\u03c4\u03c9\u03bd');
    expect(textBody).toContain('\u03a3\u03cd\u03bd\u03bf\u03bb\u03bf: 5');
    expect(textBody).toContain('\u03a0\u03c9\u03bb\u03b7\u03bc\u03ad\u03bd\u03b1: 2');
    expect(textBody).toContain('\u0394\u03b9\u03b1\u03b8\u03ad\u03c3\u03b9\u03bc\u03b1: 2');
    expect(textBody).toContain('\u039a\u03c1\u03b1\u03c4\u03b7\u03bc\u03ad\u03bd\u03b1: 1');
    // Project breakdown present (2 projects)
    expect(textBody).toContain('\u0391\u03bd\u03ac \u03ad\u03c1\u03b3\u03bf');
    expect(textBody).toContain('Nestor Residence');
    expect(textBody).toContain('Apollo Tower');
  });

  // ── 7. healthCheck returns true ──
  it('healthCheck returns true', async () => {
    const result = await mod.healthCheck();
    expect(result).toBe(true);
  });
});
