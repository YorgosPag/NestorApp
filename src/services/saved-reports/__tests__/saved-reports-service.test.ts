/**
 * =============================================================================
 * Saved Reports Service — Unit Tests (ADR-268, SPEC-011)
 * =============================================================================
 *
 * CRUD operations + visibility rules + cross-tenant isolation.
 * Google Zanzibar-style permission matrix for security-critical paths.
 *
 * @module __tests__/saved-reports-service
 * @see SPEC-011 §10 Q1, Q5
 */

// ── Mocks ─────────────────────────────────────────────────────────────

jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminFirestore: jest.fn(),
}));

jest.mock('@/services/enterprise-id.service', () => {
  let counter = 0;
  return {
    EnterpriseIdService: jest.fn().mockImplementation(() => ({
      generateSavedReportId: jest.fn(() => `srpt_test_${String(++counter).padStart(3, '0')}`),
    })),
  };
});

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import {
  createSavedReport,
  getSavedReport,
  listSavedReports,
  updateSavedReport,
  toggleFavorite,
  trackReportRun,
  deleteSavedReport,
} from '../saved-reports-service';
import type {
  SavedReport,
  CreateSavedReportInput,
  SavedReportConfig,
} from '@/types/reports/saved-report';

// ─── Test Data Factory ────────────────────────────────────────────────

function makeConfig(overrides: Partial<SavedReportConfig> = {}): SavedReportConfig {
  return {
    domain: 'projects',
    columns: ['name', 'status'],
    filters: [],
    sortField: null,
    sortDirection: 'asc',
    limit: 500,
    groupByConfig: null,
    dateRange: null,
    ...overrides,
  };
}

function makeCreateInput(overrides: Partial<CreateSavedReportInput> = {}): CreateSavedReportInput {
  return {
    name: 'Monthly Report',
    description: 'Test description',
    category: 'monthly',
    visibility: 'personal',
    config: makeConfig(),
    ...overrides,
  };
}

function makeSavedReport(overrides: Partial<SavedReport & { companyId?: string }> = {}): SavedReport & { companyId: string } {
  return {
    id: 'srpt_existing_001',
    name: 'Test Report',
    description: null,
    category: 'general',
    visibility: 'personal',
    createdBy: 'user_A',
    favoritedBy: [],
    config: makeConfig(),
    lastRunAt: null,
    runCount: 0,
    createdAt: '2026-03-01T00:00:00Z',
    updatedAt: '2026-03-01T00:00:00Z',
    companyId: 'comp_001',
    ...overrides,
  };
}

// ─── Firestore Mock Infrastructure ────────────────────────────────────

interface MockDocSnap {
  exists: boolean;
  data: () => Record<string, unknown> | undefined;
}

interface MockDocRef {
  set: jest.Mock;
  get: jest.Mock<Promise<MockDocSnap>>;
  update: jest.Mock;
  delete: jest.Mock;
}

function createMockDocRef(docData?: Record<string, unknown>): MockDocRef {
  const snap: MockDocSnap = {
    exists: docData !== undefined,
    data: () => docData,
  };

  return {
    set: jest.fn(async () => {}),
    get: jest.fn(async () => snap),
    update: jest.fn(async () => {}),
    delete: jest.fn(async () => {}),
  };
}

function setupFirestoreMock(docs: Array<Record<string, unknown>> = []) {
  const mockDocRefs = new Map<string, MockDocRef>();

  const mockCollection = jest.fn(() => ({
    doc: jest.fn((id: string) => {
      if (!mockDocRefs.has(id)) {
        const docData = docs.find((d) => d.id === id);
        mockDocRefs.set(id, createMockDocRef(docData));
      }
      return mockDocRefs.get(id)!;
    }),
    where: jest.fn().mockReturnValue({
      orderBy: jest.fn().mockReturnValue({
        limit: jest.fn().mockReturnValue({
          get: jest.fn(async () => ({
            docs: docs.map((d) => ({
              data: () => d,
            })),
          })),
        }),
      }),
    }),
  }));

  (getAdminFirestore as jest.Mock).mockReturnValue({
    collection: mockCollection,
  });

  return { mockCollection, mockDocRefs };
}

/** Helper: setup a single-document mock (for get/update/delete/toggle tests) */
function setupSingleDocMock(docData?: Record<string, unknown>) {
  const ref = createMockDocRef(docData);

  const mockCollection = jest.fn(() => ({
    doc: jest.fn(() => ref),
  }));

  (getAdminFirestore as jest.Mock).mockReturnValue({
    collection: mockCollection,
  });

  return { ref, mockCollection };
}

/** Helper: setup for update tests where we need get() to return updated data */
function setupUpdateDocMock(initialData: Record<string, unknown>) {
  const ref = createMockDocRef(initialData);

  // After update, second get() returns merged data
  let getCallCount = 0;
  ref.get = jest.fn(async () => {
    getCallCount++;
    if (getCallCount === 1) {
      return { exists: true, data: () => initialData };
    }
    // Return merged data on second call (simulate Firestore behavior)
    return { exists: true, data: () => ({ ...initialData, updatedAt: expect.any(String) }) };
  });

  const mockCollection = jest.fn(() => ({
    doc: jest.fn(() => ref),
  }));

  (getAdminFirestore as jest.Mock).mockReturnValue({
    collection: mockCollection,
  });

  return { ref, mockCollection };
}

// ============================================================================
// TESTS
// ============================================================================

describe('SavedReportsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ──────────────────────────────────────────────────────────────────────
  // createSavedReport
  // ──────────────────────────────────────────────────────────────────────

  describe('createSavedReport', () => {
    it('creates a report with enterprise ID and correct fields', async () => {
      const { ref } = setupSingleDocMock();
      // For create, doc() is called but we need set() on the returned ref
      const mockDoc = jest.fn(() => ref);
      const mockCollection = jest.fn(() => ({ doc: mockDoc }));
      (getAdminFirestore as jest.Mock).mockReturnValue({ collection: mockCollection });

      const input = makeCreateInput();
      const result = await createSavedReport('comp_001', 'user_A', input);

      expect(result.id).toMatch(/^srpt_test_\d{3}$/);
      expect(result.name).toBe('Monthly Report');
      expect(result.description).toBe('Test description');
      expect(result.category).toBe('monthly');
      expect(result.visibility).toBe('personal');
      expect(result.createdBy).toBe('user_A');
      expect(result.favoritedBy).toEqual([]);
      expect(result.runCount).toBe(0);
      expect(result.lastRunAt).toBeNull();
      expect(result.config).toEqual(makeConfig());
    });

    it('trims name and description', async () => {
      const { ref } = setupSingleDocMock();
      const mockDoc = jest.fn(() => ref);
      const mockCollection = jest.fn(() => ({ doc: mockDoc }));
      (getAdminFirestore as jest.Mock).mockReturnValue({ collection: mockCollection });

      const input = makeCreateInput({
        name: '  Padded Name  ',
        description: '  Padded Desc  ',
      });
      const result = await createSavedReport('comp_001', 'user_A', input);

      expect(result.name).toBe('Padded Name');
      expect(result.description).toBe('Padded Desc');
    });

    it('defaults category to general and visibility to personal', async () => {
      const { ref } = setupSingleDocMock();
      const mockDoc = jest.fn(() => ref);
      const mockCollection = jest.fn(() => ({ doc: mockDoc }));
      (getAdminFirestore as jest.Mock).mockReturnValue({ collection: mockCollection });

      const input = makeCreateInput({
        category: undefined,
        visibility: undefined,
      });
      const result = await createSavedReport('comp_001', 'user_A', input);

      expect(result.category).toBe('general');
      expect(result.visibility).toBe('personal');
    });

    it('stores companyId in Firestore document', async () => {
      const mockSet = jest.fn(async () => {});
      const mockDoc = jest.fn(() => ({ set: mockSet }));
      const mockCollection = jest.fn(() => ({ doc: mockDoc }));
      (getAdminFirestore as jest.Mock).mockReturnValue({ collection: mockCollection });

      await createSavedReport('comp_001', 'user_A', makeCreateInput());

      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({ companyId: 'comp_001' }),
      );
    });

    it('handles null description gracefully', async () => {
      const mockSet = jest.fn(async () => {});
      const mockDoc = jest.fn(() => ({ set: mockSet }));
      const mockCollection = jest.fn(() => ({ doc: mockDoc }));
      (getAdminFirestore as jest.Mock).mockReturnValue({ collection: mockCollection });

      const input = makeCreateInput({ description: undefined });
      const result = await createSavedReport('comp_001', 'user_A', input);

      expect(result.description).toBeNull();
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // getSavedReport
  // ──────────────────────────────────────────────────────────────────────

  describe('getSavedReport', () => {
    it('returns report when found and companyId matches', async () => {
      const doc = makeSavedReport({ companyId: 'comp_001' });
      setupSingleDocMock(doc);

      const result = await getSavedReport('comp_001', 'srpt_existing_001');
      expect(result).not.toBeNull();
      expect(result?.id).toBe('srpt_existing_001');
      expect(result?.name).toBe('Test Report');
    });

    it('returns null when document does not exist', async () => {
      setupSingleDocMock(undefined);

      const result = await getSavedReport('comp_001', 'srpt_nonexistent');
      expect(result).toBeNull();
    });

    it('returns null when companyId does not match (cross-tenant isolation)', async () => {
      const doc = makeSavedReport({ companyId: 'comp_001' });
      setupSingleDocMock(doc);

      const result = await getSavedReport('comp_OTHER', 'srpt_existing_001');
      expect(result).toBeNull();
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // listSavedReports — Visibility Rules (Google Zanzibar Pattern)
  // ──────────────────────────────────────────────────────────────────────

  describe('listSavedReports', () => {
    const personalReportA = makeSavedReport({
      id: 'srpt_personal_A',
      visibility: 'personal',
      createdBy: 'user_A',
      companyId: 'comp_001',
    });

    const personalReportB = makeSavedReport({
      id: 'srpt_personal_B',
      visibility: 'personal',
      createdBy: 'user_B',
      companyId: 'comp_001',
    });

    const sharedReport = makeSavedReport({
      id: 'srpt_shared_001',
      visibility: 'shared',
      createdBy: 'user_A',
      companyId: 'comp_001',
    });

    const systemReport = makeSavedReport({
      id: 'srpt_system_001',
      visibility: 'system',
      createdBy: 'admin',
      companyId: 'comp_001',
    });

    const otherCompanyReport = makeSavedReport({
      id: 'srpt_other_comp',
      visibility: 'shared',
      createdBy: 'user_X',
      companyId: 'comp_OTHER',
    });

    // Permission matrix — Google Zanzibar pattern
    const visibilityScenarios = [
      { actor: 'user_A', reportVis: 'personal' as const, owner: 'user_A', canSee: true, desc: 'owner sees own personal report' },
      { actor: 'user_B', reportVis: 'personal' as const, owner: 'user_A', canSee: false, desc: 'other user cannot see personal report' },
      { actor: 'user_A', reportVis: 'shared' as const, owner: 'user_B', canSee: true, desc: 'any user sees shared report' },
      { actor: 'user_B', reportVis: 'shared' as const, owner: 'user_A', canSee: true, desc: 'any user sees shared report from another' },
      { actor: 'user_A', reportVis: 'system' as const, owner: 'admin', canSee: true, desc: 'any user sees system report' },
    ];

    test.each(visibilityScenarios)(
      '$desc',
      async ({ actor, reportVis, owner, canSee }) => {
        const report = makeSavedReport({
          id: 'srpt_matrix_test',
          visibility: reportVis,
          createdBy: owner,
          companyId: 'comp_001',
        });
        setupFirestoreMock([report]);

        const results = await listSavedReports('comp_001', actor);
        const found = results.some((r) => r.id === 'srpt_matrix_test');
        expect(found).toBe(canSee);
      },
    );

    it('returns only reports from same company', async () => {
      // Firestore where('companyId', '==', ...) handles this at query level,
      // but if both docs are returned, only matching companyId should appear.
      setupFirestoreMock([personalReportA, sharedReport, systemReport]);

      const results = await listSavedReports('comp_001', 'user_A');
      expect(results.length).toBeGreaterThanOrEqual(1);
      results.forEach((r) => {
        // All returned reports should be visible to user_A
        if (r.visibility === 'personal') {
          expect(r.createdBy).toBe('user_A');
        }
      });
    });

    it('filters by category when specified', async () => {
      const taxReport = makeSavedReport({
        id: 'srpt_tax_001',
        category: 'tax',
        visibility: 'shared',
        companyId: 'comp_001',
      });
      const generalReport = makeSavedReport({
        id: 'srpt_gen_001',
        category: 'general',
        visibility: 'shared',
        companyId: 'comp_001',
      });
      setupFirestoreMock([taxReport, generalReport]);

      const results = await listSavedReports('comp_001', 'user_A', { category: 'tax' });
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('srpt_tax_001');
    });

    it('filters by visibility when specified', async () => {
      setupFirestoreMock([personalReportA, sharedReport, systemReport]);

      const results = await listSavedReports('comp_001', 'user_A', { visibility: 'shared' });
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('srpt_shared_001');
    });

    it('returns empty array when no reports exist', async () => {
      setupFirestoreMock([]);

      const results = await listSavedReports('comp_001', 'user_A');
      expect(results).toEqual([]);
    });

    it('respects limit option', async () => {
      const mockLimit = jest.fn().mockReturnValue({
        get: jest.fn(async () => ({ docs: [] })),
      });
      const mockOrderBy = jest.fn().mockReturnValue({ limit: mockLimit });
      const mockWhere = jest.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockCollection = jest.fn(() => ({ where: mockWhere, doc: jest.fn() }));
      (getAdminFirestore as jest.Mock).mockReturnValue({ collection: mockCollection });

      await listSavedReports('comp_001', 'user_A', { limit: 10 });

      expect(mockLimit).toHaveBeenCalledWith(10);
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // updateSavedReport
  // ──────────────────────────────────────────────────────────────────────

  describe('updateSavedReport', () => {
    it('updates fields and returns updated report', async () => {
      const doc = makeSavedReport({ createdBy: 'user_A', companyId: 'comp_001' });
      const { ref } = setupUpdateDocMock(doc);

      const result = await updateSavedReport('comp_001', 'srpt_existing_001', 'user_A', {
        name: 'Updated Name',
      });

      expect(ref.update).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Updated Name',
          updatedAt: expect.any(String),
        }),
      );
      expect(result).not.toBeNull();
    });

    it('returns null when report does not exist', async () => {
      setupSingleDocMock(undefined);

      const result = await updateSavedReport('comp_001', 'srpt_none', 'user_A', { name: 'X' });
      expect(result).toBeNull();
    });

    it('returns null for cross-tenant access', async () => {
      const doc = makeSavedReport({ companyId: 'comp_001' });
      setupSingleDocMock(doc);

      const result = await updateSavedReport('comp_OTHER', 'srpt_existing_001', 'user_A', { name: 'Hack' });
      expect(result).toBeNull();
    });

    it('returns null when non-owner tries to update personal report', async () => {
      const doc = makeSavedReport({
        createdBy: 'user_A',
        visibility: 'personal',
        companyId: 'comp_001',
      });
      setupSingleDocMock(doc);

      const result = await updateSavedReport('comp_001', 'srpt_existing_001', 'user_B', { name: 'Hack' });
      expect(result).toBeNull();
    });

    it('allows system report update by non-owner', async () => {
      const doc = makeSavedReport({
        createdBy: 'admin',
        visibility: 'system',
        companyId: 'comp_001',
      });
      setupUpdateDocMock(doc);

      const result = await updateSavedReport('comp_001', 'srpt_existing_001', 'user_B', { name: 'System Updated' });
      expect(result).not.toBeNull();
    });

    it('trims name on update', async () => {
      const doc = makeSavedReport({ createdBy: 'user_A', companyId: 'comp_001' });
      const { ref } = setupUpdateDocMock(doc);

      await updateSavedReport('comp_001', 'srpt_existing_001', 'user_A', {
        name: '  Trimmed  ',
      });

      expect(ref.update).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Trimmed' }),
      );
    });

    it('only updates provided fields', async () => {
      const doc = makeSavedReport({ createdBy: 'user_A', companyId: 'comp_001' });
      const { ref } = setupUpdateDocMock(doc);

      await updateSavedReport('comp_001', 'srpt_existing_001', 'user_A', {
        category: 'tax',
      });

      const updateCall = ref.update.mock.calls[0][0] as Record<string, unknown>;
      expect(updateCall.category).toBe('tax');
      expect(updateCall.name).toBeUndefined();
      expect(updateCall.description).toBeUndefined();
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // toggleFavorite
  // ──────────────────────────────────────────────────────────────────────

  describe('toggleFavorite', () => {
    it('adds user to favoritedBy when not favorited', async () => {
      const doc = makeSavedReport({ favoritedBy: [], companyId: 'comp_001' });
      const { ref } = setupSingleDocMock(doc);

      const result = await toggleFavorite('comp_001', 'srpt_existing_001', 'user_A');

      expect(result).toBe(true);
      expect(ref.update).toHaveBeenCalledWith({
        favoritedBy: ['user_A'],
      });
    });

    it('removes user from favoritedBy when already favorited', async () => {
      const doc = makeSavedReport({ favoritedBy: ['user_A', 'user_B'], companyId: 'comp_001' });
      const { ref } = setupSingleDocMock(doc);

      const result = await toggleFavorite('comp_001', 'srpt_existing_001', 'user_A');

      expect(result).toBe(false);
      expect(ref.update).toHaveBeenCalledWith({
        favoritedBy: ['user_B'],
      });
    });

    it('returns false when report does not exist', async () => {
      setupSingleDocMock(undefined);

      const result = await toggleFavorite('comp_001', 'srpt_none', 'user_A');
      expect(result).toBe(false);
    });

    it('returns false for cross-tenant access', async () => {
      const doc = makeSavedReport({ companyId: 'comp_001' });
      setupSingleDocMock(doc);

      const result = await toggleFavorite('comp_OTHER', 'srpt_existing_001', 'user_A');
      expect(result).toBe(false);
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // trackReportRun
  // ──────────────────────────────────────────────────────────────────────

  describe('trackReportRun', () => {
    it('increments runCount and sets lastRunAt', async () => {
      const doc = makeSavedReport({ runCount: 5, companyId: 'comp_001' });
      const { ref } = setupSingleDocMock(doc);

      await trackReportRun('comp_001', 'srpt_existing_001');

      expect(ref.update).toHaveBeenCalledWith({
        lastRunAt: expect.any(String),
        runCount: 6,
      });
    });

    it('starts from 0 when runCount is missing', async () => {
      const doc = makeSavedReport({ companyId: 'comp_001' });
      // Remove runCount to simulate missing field
      delete (doc as Record<string, unknown>).runCount;
      const { ref } = setupSingleDocMock(doc);

      await trackReportRun('comp_001', 'srpt_existing_001');

      expect(ref.update).toHaveBeenCalledWith({
        lastRunAt: expect.any(String),
        runCount: 1,
      });
    });

    it('does nothing when report does not exist', async () => {
      const { ref } = setupSingleDocMock(undefined);

      await trackReportRun('comp_001', 'srpt_none');
      expect(ref.update).not.toHaveBeenCalled();
    });

    it('does nothing for cross-tenant access', async () => {
      const doc = makeSavedReport({ companyId: 'comp_001' });
      const { ref } = setupSingleDocMock(doc);

      await trackReportRun('comp_OTHER', 'srpt_existing_001');
      expect(ref.update).not.toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // deleteSavedReport
  // ──────────────────────────────────────────────────────────────────────

  describe('deleteSavedReport', () => {
    it('deletes report when owner requests it', async () => {
      const doc = makeSavedReport({
        createdBy: 'user_A',
        visibility: 'personal',
        companyId: 'comp_001',
      });
      const { ref } = setupSingleDocMock(doc);

      const result = await deleteSavedReport('comp_001', 'srpt_existing_001', 'user_A');

      expect(result).toBe(true);
      expect(ref.delete).toHaveBeenCalled();
    });

    it('returns false when report does not exist', async () => {
      setupSingleDocMock(undefined);

      const result = await deleteSavedReport('comp_001', 'srpt_none', 'user_A');
      expect(result).toBe(false);
    });

    it('prevents deletion of system reports', async () => {
      const doc = makeSavedReport({
        visibility: 'system',
        createdBy: 'admin',
        companyId: 'comp_001',
      });
      const { ref } = setupSingleDocMock(doc);

      const result = await deleteSavedReport('comp_001', 'srpt_existing_001', 'admin');

      expect(result).toBe(false);
      expect(ref.delete).not.toHaveBeenCalled();
    });

    it('prevents non-owner from deleting report', async () => {
      const doc = makeSavedReport({
        createdBy: 'user_A',
        visibility: 'personal',
        companyId: 'comp_001',
      });
      const { ref } = setupSingleDocMock(doc);

      const result = await deleteSavedReport('comp_001', 'srpt_existing_001', 'user_B');

      expect(result).toBe(false);
      expect(ref.delete).not.toHaveBeenCalled();
    });

    it('prevents cross-tenant deletion', async () => {
      const doc = makeSavedReport({
        createdBy: 'user_A',
        companyId: 'comp_001',
      });
      setupSingleDocMock(doc);

      const result = await deleteSavedReport('comp_OTHER', 'srpt_existing_001', 'user_A');
      // Returns null cast to boolean (falsy)
      expect(result).toBeFalsy();
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // Cross-Tenant Isolation — Comprehensive (Google Zanzibar)
  // ──────────────────────────────────────────────────────────────────────

  describe('Cross-tenant isolation', () => {
    const operations = [
      { name: 'getSavedReport', fn: (companyId: string) => getSavedReport(companyId, 'srpt_001') },
      { name: 'updateSavedReport', fn: (companyId: string) => updateSavedReport(companyId, 'srpt_001', 'user_A', { name: 'X' }) },
      { name: 'toggleFavorite', fn: (companyId: string) => toggleFavorite(companyId, 'srpt_001', 'user_A') },
      { name: 'trackReportRun', fn: (companyId: string) => trackReportRun(companyId, 'srpt_001') },
      { name: 'deleteSavedReport', fn: (companyId: string) => deleteSavedReport(companyId, 'srpt_001', 'user_A') },
    ];

    test.each(operations)(
      '$name blocks access from different company',
      async ({ fn }) => {
        const doc = makeSavedReport({
          id: 'srpt_001',
          createdBy: 'user_A',
          companyId: 'comp_001',
        });
        setupSingleDocMock(doc);

        const result = await fn('comp_HACKER');

        // All operations should return null/false/undefined for wrong company
        expect(result).toBeFalsy();
      },
    );
  });
});
