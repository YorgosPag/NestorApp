/* eslint-disable no-restricted-syntax */

// =============================================================================
// UC-011: ADMIN PROJECT STATUS MODULE — UNIT TESTS
// =============================================================================

jest.mock('server-only', () => ({}));
jest.mock('@/lib/telemetry/Logger', () => ({ createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }) }));
jest.mock('@/lib/error-utils', () => ({ getErrorMessage: jest.fn((e: unknown) => e instanceof Error ? e.message : String(e)) }));
jest.mock('@/config/firestore-collections', () => ({ COLLECTIONS: { CONTACTS: 'contacts', AI_PIPELINE_AUDIT: 'ai_pipeline_audit', UNITS: 'units', BUILDINGS: 'buildings', PROJECTS: 'projects', CONSTRUCTION_PHASES: 'construction_phases' } }));
jest.mock('@/config/firestore-field-constants', () => ({ FIELDS: { COMPANY_ID: 'companyId', CREATED_AT: 'createdAt', STATUS: 'status', BUILDING_ID: 'buildingId', PROJECT_ID: 'projectId' } }));
jest.mock('@/config/tenant', () => ({ getCompanyId: () => 'comp_pagonis' }));
jest.mock('@/config/ai-pipeline-config', () => ({ PIPELINE_PROTOCOL_CONFIG: { SCHEMA_VERSION: 1 } }));

// Firestore mock — bottom-up discovery: buildings -> projects -> phases -> units
const mockBuildingsDocs = [
  { id: 'bld_001', data: () => ({ projectId: 'prj_001', name: 'Building Alpha', companyId: 'comp_pagonis' }) },
  { id: 'bld_002', data: () => ({ projectId: 'prj_001', name: 'Building Beta', companyId: 'comp_pagonis' }) },
];
const mockProjectsDocs = [
  { id: 'prj_001', exists: true, data: () => ({ name: 'Panorama', status: 'in_progress', address: 'Thessaloniki', progress: 45, companyId: 'comp_pagonis' }) },
];
const mockPhasesDocs = [
  { id: 'ph_001', data: () => ({ buildingId: 'bld_001', name: 'Foundation' }) },
  { id: 'ph_002', data: () => ({ buildingId: 'bld_001', name: 'Structure' }) },
];
const mockUnitsDocs = [
  { id: 'unit_001', data: () => ({ buildingId: 'bld_001', status: 'sold' }) },
  { id: 'unit_002', data: () => ({ buildingId: 'bld_001', status: 'available' }) },
  { id: 'unit_003', data: () => ({ buildingId: 'bld_002', status: 'reserved' }) },
];

const mockGetAll = jest.fn().mockResolvedValue([]);

const mockCollection = jest.fn((collectionName: string) => {
  const chain = {
    where: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    doc: jest.fn((docId: string) => ({
      set: jest.fn().mockResolvedValue(undefined),
      get: jest.fn().mockResolvedValue(mockProjectsDocs.find(d => d.id === docId) ?? { exists: false }),
    })),
    get: jest.fn().mockResolvedValue({ empty: true, docs: [], size: 0 }),
  };

  // Return appropriate docs based on collection
  if (collectionName === 'buildings') {
    chain.get.mockResolvedValue({ empty: false, docs: mockBuildingsDocs, size: mockBuildingsDocs.length });
  } else if (collectionName === 'projects') {
    chain.get.mockResolvedValue({ empty: false, docs: mockProjectsDocs, size: mockProjectsDocs.length });
  } else if (collectionName === 'construction_phases') {
    chain.get.mockResolvedValue({ empty: false, docs: mockPhasesDocs, size: mockPhasesDocs.length });
  } else if (collectionName === 'units') {
    chain.get.mockResolvedValue({ empty: false, docs: mockUnitsDocs, size: mockUnitsDocs.length });
  }

  return chain;
});

jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminFirestore: () => ({ collection: mockCollection, getAll: mockGetAll }),
}));

// Channel reply mock
const mockSendChannelReply = jest.fn().mockResolvedValue({ success: true, messageId: 'msg_reply_011', channel: 'telegram' });
const mockExtractChannelIds = jest.fn((_intake: unknown) => ({ telegramChatId: '12345' }));
jest.mock('../../../shared/channel-reply-dispatcher', () => ({
  sendChannelReply: (payload: unknown) => mockSendChannelReply(payload),
  extractChannelIds: (intake: unknown) => mockExtractChannelIds(intake),
}));

import { AdminProjectStatusModule } from '../admin-project-status-module';

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
        contentText: 'Dexe mou ta erga',
        attachments: [],
        timestampIso: new Date().toISOString(),
      },
      metadata: { providerMessageId: 'pm_001', signatureVerified: true },
      schemaVersion: 1,
    },
    understanding: { intent: 'admin_project_status', confidence: 0.95, entities: {} },
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

describe('UC-011: AdminProjectStatusModule', () => {
  let mod: AdminProjectStatusModule;

  beforeEach(() => {
    mod = new AdminProjectStatusModule();
    jest.clearAllMocks();
  });

  // ── 1. Identity ──

  it('has correct moduleId and handledIntents', () => {
    expect(mod.moduleId).toBe('UC-011');
    expect(mod.handledIntents).toContain('admin_project_status');
    expect(mod.handledIntents).toHaveLength(1);
  });

  // ── 2. lookup: queries buildings and resolves projects ──

  it('lookup queries buildings and resolves projects in list mode', async () => {
    const ctx = createMockCtx();
    const result = await mod.lookup(ctx as never);

    expect(result.mode).toBe('list');
    expect(mockCollection).toHaveBeenCalledWith('buildings');
    expect(mockCollection).toHaveBeenCalledWith('projects');
    expect(Array.isArray(result.projects)).toBe(true);
  });

  // ── 3. lookup: handles empty projects ──

  it('lookup handles empty project list gracefully', async () => {
    // Override to return empty collections
    mockCollection.mockImplementation((_collectionName: string) => ({
      where: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      doc: jest.fn((_docId: string) => ({ set: jest.fn().mockResolvedValue(undefined), get: jest.fn().mockResolvedValue({ exists: false }) })),
      get: jest.fn().mockResolvedValue({ empty: true, docs: [], size: 0 }),
    }));

    const ctx = createMockCtx();
    const result = await mod.lookup(ctx as never);

    expect(result.mode).toBe('list');
    expect(result.projects).toEqual([]);
  });

  // ── 4. propose: builds summary and is auto-approvable ──

  it('propose builds summary and is auto-approvable', async () => {
    const lookupData = {
      mode: 'list',
      searchTerm: '',
      searchCriteria: null,
      companyId: 'comp_pagonis',
      singleProject: null,
      projects: [
        {
          project: { projectId: 'prj_001', name: 'Panorama', status: 'in_progress', statusLabel: 'Se exelixi', address: 'Thessaloniki', description: null, progress: 45, updatedAt: null },
          propertyStats: { total: 3, sold: 1, available: 1, reserved: 1, other: 0 },
          hasGantt: true,
          buildingCount: 2,
          ganttDetails: [{ buildingName: 'Building Alpha', phaseCount: 2 }],
        },
      ],
    };

    const ctx = createMockCtx({ lookupData });
    const proposal = await mod.propose(ctx as never);

    expect(proposal.autoApprovable).toBe(true);
    expect(proposal.requiredApprovals).toEqual([]);
    expect(proposal.summary).toContain('1');
    expect(proposal.suggestedActions[0].type).toBe('admin_project_status_reply');
  });

  // ── 5. execute: formats project report ──

  it('execute formats project report and sends reply', async () => {
    const projectDetails = {
      project: { projectId: 'prj_001', name: 'Panorama', status: 'in_progress', statusLabel: 'Se exelixi', address: 'Thessaloniki', description: null, progress: 45, updatedAt: null },
      propertyStats: { total: 3, sold: 1, available: 1, reserved: 1, other: 0 },
      hasGantt: true,
      buildingCount: 2,
      ganttDetails: [{ buildingName: 'Building Alpha', phaseCount: 2 }],
    };

    const ctx = createMockCtx({
      proposal: {
        suggestedActions: [{
          type: 'admin_project_status_reply',
          params: {
            mode: 'list',
            searchTerm: null,
            searchCriteria: null,
            singleProject: null,
            projects: [projectDetails],
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
    expect(sentBody).toContain('Panorama');
  });

  // ── 6. healthCheck ──

  it('healthCheck returns true', async () => {
    const result = await mod.healthCheck();
    expect(result).toBe(true);
  });
});
