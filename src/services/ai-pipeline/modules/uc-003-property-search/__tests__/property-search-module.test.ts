/* eslint-disable no-restricted-syntax */

/**
 * =============================================================================
 * UC-003 PROPERTY SEARCH MODULE — UNIT TESTS
 * =============================================================================
 *
 * Tests for PropertySearchModule: lookup, propose, execute, acknowledge, healthCheck.
 * Validates the IUCModule contract for property_search intent handling.
 *
 * @see property-search-module.ts
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
  generatePipelineAuditId: jest.fn(() => 'audit_test_001'),
}));

const mockExtractSearchCriteria = jest.fn().mockReturnValue({
  minArea: 50,
  maxArea: 100,
  type: 'apartment',
  rooms: null,
  minPrice: null,
  maxPrice: null,
  floor: null,
});
jest.mock('@/services/property-search.service', () => ({
  extractSearchCriteria: (...args: unknown[]) => Reflect.apply(mockExtractSearchCriteria, null, args),
}));

const mockFindContactByEmail = jest.fn().mockResolvedValue({
  contactId: 'ct_002',
  displayName: 'Μαρία',
  email: 'maria@test.com',
});
jest.mock('../../../shared/contact-lookup', () => ({
  findContactByEmail: (...args: unknown[]) => Reflect.apply(mockFindContactByEmail, null, args),
}));

const mockSendChannelReply = jest.fn().mockResolvedValue({
  success: true,
  channel: 'email',
  messageId: 'msg_reply_003',
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

import { PropertySearchModule } from '../property-search-module';
import type { PipelineContext } from '@/types/ai-pipeline';

// ── Helper ──────────────────────────────────────────────────────────────────

function createMockCtx(overrides?: Record<string, unknown>): PipelineContext {
  return {
    requestId: 'req_test_003',
    companyId: 'comp_pagonis',
    state: 'understood',
    intake: {
      id: 'intake_003',
      channel: 'email',
      rawPayload: { subject: 'Property Inquiry', body: 'Looking for apartment' },
      normalized: {
        sender: { name: 'Μαρία Τεστ', email: 'maria@test.com' },
        recipients: [],
        subject: 'Αναζήτηση Ακινήτου',
        contentText: 'Ψάχνω ένα διαμέρισμα 50-100 τ.μ.',
        attachments: [],
        timestampIso: new Date().toISOString(),
      },
      metadata: { providerMessageId: 'pm_003', signatureVerified: true },
      schemaVersion: 1,
    },
    understanding: { intent: 'property_search', confidence: 0.92, entities: {} },
    lookupData: {},
    errors: [],
    startedAt: new Date().toISOString(),
    stepDurations: {},
    ...overrides,
  } as unknown as PipelineContext;
}

/** Creates a Firestore doc snapshot stub */
function createUnitDoc(id: string, data: Record<string, unknown>) {
  return { id, data: () => data };
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('UC-003 PropertySearchModule', () => {
  let mod: PropertySearchModule;

  beforeEach(() => {
    mod = new PropertySearchModule();
    jest.clearAllMocks();
  });

  // ── Identity ──────────────────────────────────────────────────────────────

  it('has correct moduleId and handledIntents', () => {
    expect(mod.moduleId).toBe('UC-003');
    expect(mod.handledIntents).toContain('property_search');
    expect(mod.handledIntents).toHaveLength(1);
  });

  // ── LOOKUP ────────────────────────────────────────────────────────────────

  it('lookup extracts search criteria and queries units', async () => {
    mockCollGet.mockResolvedValueOnce({
      docs: [
        createUnitDoc('unit_01', {
          name: 'Α1',
          type: 'apartment',
          area: 75,
          floor: 2,
          building: 'Κτήριο Α',
          buildingId: 'bld_01',
          price: 120000,
          status: 'available',
        }),
      ],
    });

    const ctx = createMockCtx();
    const result = await mod.lookup(ctx);

    expect(mockExtractSearchCriteria).toHaveBeenCalled();
    expect(result).toMatchObject({
      senderEmail: 'maria@test.com',
      isKnownContact: true,
      criteria: expect.objectContaining({ minArea: 50, maxArea: 100, type: 'apartment' }),
    });
    expect((result as Record<string, unknown>).matchingUnits).toBeDefined();
  });

  it('lookup filters units by status (excludes sold/reserved)', async () => {
    mockCollGet.mockResolvedValueOnce({
      docs: [
        createUnitDoc('unit_01', {
          name: 'Available',
          type: 'apartment',
          area: 75,
          floor: 1,
          building: 'A',
          buildingId: 'b1',
          price: 100000,
          status: 'available',
        }),
        createUnitDoc('unit_02', {
          name: 'Sold',
          type: 'apartment',
          area: 80,
          floor: 2,
          building: 'A',
          buildingId: 'b1',
          price: 110000,
          status: 'sold',
        }),
        createUnitDoc('unit_03', {
          name: 'Reserved',
          type: 'apartment',
          area: 60,
          floor: 3,
          building: 'B',
          buildingId: 'b2',
          price: 90000,
          status: 'reserved',
        }),
      ],
    });

    const ctx = createMockCtx();
    const result = await mod.lookup(ctx);

    const units = (result as Record<string, unknown>).matchingUnits as { id: string }[];
    const propertyIds = units.map(u => u.id);

    // sold and reserved should be excluded
    expect(propertyIds).toContain('unit_01');
    expect(propertyIds).not.toContain('unit_02');
    expect(propertyIds).not.toContain('unit_03');
  });

  // ── PROPOSE ───────────────────────────────────────────────────────────────

  it('propose builds unit list and generates reply', async () => {
    const ctx = createMockCtx({
      lookupData: {
        senderEmail: 'maria@test.com',
        senderName: 'Μαρία Τεστ',
        senderContact: { contactId: 'ct_002', displayName: 'Μαρία', email: 'maria@test.com' },
        isKnownContact: true,
        criteria: { minArea: 50, maxArea: 100, type: 'apartment' },
        matchingUnits: [
          { id: 'u1', name: 'Α1', type: 'apartment', area: 75, floor: 2, building: 'Κτήριο Α', buildingId: 'b1', price: 120000, status: 'available', rooms: null },
        ],
        totalAvailable: 5,
        originalSubject: 'Αναζήτηση Ακινήτου',
        companyId: 'comp_pagonis',
      },
    });

    const proposal = await mod.propose(ctx);

    expect(proposal.autoApprovable).toBe(false);
    expect(proposal.suggestedActions).toHaveLength(1);
    expect(proposal.suggestedActions[0].type).toBe('reply_property_list');
    expect(proposal.suggestedActions[0].params.matchingUnitsCount).toBe(1);
  });

  // ── EXECUTE ───────────────────────────────────────────────────────────────

  it('execute sends reply and records audit', async () => {
    const ctx = createMockCtx({
      proposal: {
        messageId: 'intake_003',
        suggestedActions: [
          {
            type: 'reply_property_list',
            params: {
              senderEmail: 'maria@test.com',
              senderName: 'Μαρία Τεστ',
              contactId: 'ct_002',
              isKnownContact: true,
              criteriaSummary: 'apartment, ~50 τ.μ.',
              matchingUnitsCount: 1,
              matchingUnits: [{ id: 'u1', name: 'Α1', type: 'apartment', area: 75, floor: 2, building: 'Κτήριο Α', price: 120000, rooms: null }],
              totalAvailable: 5,
              draftReply: 'Αγαπητέ/ή Μαρία...',
              companyId: 'comp_pagonis',
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

    expect(result.success).toBe(true);
    expect(mockDocSet).toHaveBeenCalled();
    expect(mockSendChannelReply).toHaveBeenCalled();
    expect(result.sideEffects).toEqual(
      expect.arrayContaining([
        expect.stringContaining('lead_inquiry_recorded:'),
        expect.stringContaining('reply_sent:'),
      ])
    );
  });

  it('execute handles empty results (no matching units)', async () => {
    const ctx = createMockCtx({
      proposal: {
        messageId: 'intake_003',
        suggestedActions: [
          {
            type: 'reply_property_list',
            params: {
              senderEmail: 'maria@test.com',
              senderName: 'Μαρία Τεστ',
              contactId: null,
              isKnownContact: false,
              criteriaSummary: 'villa, ~500 τ.μ.',
              matchingUnitsCount: 0,
              matchingUnits: [],
              totalAvailable: 5,
              draftReply: 'Δυστυχώς δεν βρέθηκαν...',
              companyId: 'comp_pagonis',
            },
          },
        ],
        requiredApprovals: ['salesManager'],
        autoApprovable: false,
        summary: 'No results',
        schemaVersion: 1,
      },
    });

    const result = await mod.execute(ctx);

    // Even with 0 results, reply is sent — success
    expect(result.success).toBe(true);
    expect(mockSendChannelReply).toHaveBeenCalled();
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
