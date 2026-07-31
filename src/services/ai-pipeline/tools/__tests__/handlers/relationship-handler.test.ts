/**
 * RELATIONSHIP HANDLER — Unit Tests (Google-level)
 *
 * Tests manage_relationship tool: add, list, remove operations.
 * Verifies RBAC, duplicate detection, Greek label resolution, self-ref prevention.
 *
 * @see ADR-171, FINDING-006
 */

import '../setup';

jest.mock('firebase-admin/firestore', () => ({
  FieldValue: { serverTimestamp: jest.fn(() => 'MOCK_TIMESTAMP') },
}));

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { RelationshipHandler } from '../../handlers/relationship-handler';
import { createAdminContext, createCustomerContext } from '../test-utils/context-factory';

// Helper: mock Firestore for add operation (supports bidirectional inverse creation)
function mockFirestoreForAdd(opts: {
  sourceExists?: boolean;
  targetExists?: boolean;
  duplicateExists?: boolean;
  /** Tenant της ΠΗΓΗΣ — για τον έλεγχο ιδιοκτησίας (ADR-742 Φάση Δ). */
  sourceCompanyId?: string | null;
  /** Tenant του ΣΤΟΧΟΥ — ξεχωριστός, γιατί η σχέση αγγίζει δύο έγγραφα. */
  targetCompanyId?: string | null;
} = {}) {
  const {
    sourceExists = true,
    targetExists = true,
    duplicateExists = false,
    sourceCompanyId = 'test-company-001',
    targetCompanyId = 'test-company-001',
  } = opts;

  const mockSet = jest.fn().mockResolvedValue(undefined);
  const mockUpdate = jest.fn().mockResolvedValue(undefined);
  const mockDoc = jest.fn().mockImplementation((id: string) => {
    const isSource = id.startsWith('cont_source');
    return {
      get: jest.fn().mockResolvedValue({
        exists: isSource ? sourceExists : targetExists,
        data: () => ({ companyId: isSource ? sourceCompanyId : targetCompanyId }),
      }),
      set: mockSet,
      update: mockUpdate,
    };
  });

  const mockWhere = jest.fn().mockReturnThis();
  const mockLimit = jest.fn().mockReturnValue({
    get: jest.fn().mockResolvedValue({
      empty: !duplicateExists,
      docs: duplicateExists ? [{ id: 'rel_existing' }] : [],
    }),
  });

  const mockCollection = jest.fn().mockReturnValue({
    doc: mockDoc,
    where: mockWhere,
    limit: mockLimit,
  });

  (getAdminFirestore as jest.Mock).mockReturnValue({ collection: mockCollection });
  return { mockSet, mockUpdate };
}

// Helper: mock Firestore for list operation (bidirectional — 2 parallel queries)
function mockFirestoreForList(relationships: Array<Record<string, unknown>>) {
  const docs = relationships.map((data, i) => ({
    id: `rel_${i + 1}`,
    data: () => data,
  }));

  // Both queries (asSource + asTarget) return same mock to keep tests simple.
  // The second query returns empty to avoid double-counting.
  let callCount = 0;
  const mockGet = jest.fn().mockImplementation(() => {
    callCount++;
    return Promise.resolve({ docs: callCount === 1 ? docs : [] });
  });
  const mockWhere = jest.fn().mockReturnThis();

  const mockCollection = jest.fn().mockReturnValue({
    where: mockWhere,
    get: mockGet,
  });

  (getAdminFirestore as jest.Mock).mockReturnValue({ collection: mockCollection });
}

describe('RelationshipHandler', () => {
  const handler = new RelationshipHandler();
  const adminCtx = createAdminContext();
  const baseArgs = {
    targetContactId: null, relationshipType: null,
    relationshipId: null, note: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── RBAC ──

  it('should BLOCK non-admin users', async () => {
    const result = await handler.execute('manage_relationship', {
      operation: 'list', sourceContactId: 'cont_001', ...baseArgs,
    }, createCustomerContext());
    expect(result.success).toBe(false);
    expect(result.error).toContain('admin-only');
  });

  it('should reject invalid operation', async () => {
    const result = await handler.execute('manage_relationship', {
      operation: 'hack', sourceContactId: 'cont_001', ...baseArgs,
    }, adminCtx);
    expect(result.success).toBe(false);
    expect(result.error).toContain('operation must be');
  });

  it('should reject missing sourceContactId', async () => {
    const result = await handler.execute('manage_relationship', {
      operation: 'list', sourceContactId: '', ...baseArgs,
    }, adminCtx);
    expect(result.success).toBe(false);
    expect(result.error).toContain('sourceContactId is required');
  });

  // ── ADD ──

  describe('add', () => {
    it('should create relationship between two contacts', async () => {
      const { mockSet } = mockFirestoreForAdd();
      const result = await handler.execute('manage_relationship', {
        operation: 'add', sourceContactId: 'cont_source_001',
        targetContactId: 'cont_target_002', relationshipType: 'family',
        relationshipId: null, note: 'σύζυγος',
      }, adminCtx);

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({ relationshipType: 'family' });
      expect(mockSet).toHaveBeenCalled();
    });

    it('should resolve Greek relationship types', async () => {
      mockFirestoreForAdd();
      const result = await handler.execute('manage_relationship', {
        operation: 'add', sourceContactId: 'cont_source_001',
        targetContactId: 'cont_target_002', relationshipType: 'σύζυγος',
        relationshipId: null, note: null,
      }, adminCtx);

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({ relationshipType: 'family' });
    });

    it('should reject self-relationship', async () => {
      const result = await handler.execute('manage_relationship', {
        operation: 'add', sourceContactId: 'cont_001',
        targetContactId: 'cont_001', relationshipType: 'friend',
        relationshipId: null, note: null,
      }, adminCtx);

      expect(result.success).toBe(false);
      expect(result.error).toContain('self');
    });

    it('should reject missing targetContactId', async () => {
      const result = await handler.execute('manage_relationship', {
        operation: 'add', sourceContactId: 'cont_001',
        targetContactId: null, relationshipType: 'family',
        relationshipId: null, note: null,
      }, adminCtx);

      expect(result.success).toBe(false);
      expect(result.error).toContain('targetContactId is required');
    });

    it('should reject invalid relationship type', async () => {
      const result = await handler.execute('manage_relationship', {
        operation: 'add', sourceContactId: 'cont_001',
        targetContactId: 'cont_002', relationshipType: 'alien',
        relationshipId: null, note: null,
      }, adminCtx);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid relationshipType');
    });

    it('should return idempotent for duplicate', async () => {
      mockFirestoreForAdd({ duplicateExists: true });
      const result = await handler.execute('manage_relationship', {
        operation: 'add', sourceContactId: 'cont_source_001',
        targetContactId: 'cont_target_002', relationshipType: 'colleague',
        relationshipId: null, note: null,
      }, adminCtx);

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({ message: 'Relationship already exists' });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // 🔴 ΙΔΙΟΚΤΗΣΙΑ TENANT — ADR-742 Φάση Δ
    //
    // Η σχέση αγγίζει **δύο** έγγραφα, άρα ρωτάει δύο φορές. Πριν τη Φάση Δ
    // ελεγχόταν **μόνο η πηγή**: ο πράκτορας μπορούσε να συνδέσει δική του
    // επαφή με **ξένη**, και η επιτυχία της κλήσης επιβεβαίωνε ότι το ξένο id
    // υπάρχει. Ο έλεγχος της μιας άκρης δεν προστατεύει τη σχέση.
    //
    // Η αφαίρεση του φύλακα του ΣΤΟΧΟΥ άφηνε 12/12 tests πράσινα — γι' αυτό
    // υπάρχουν αυτά. Βλ. [[feedback_quality_evidence_hub]]: η ραφή που δεν
    // δοκιμάζεται ποτέ.
    // ─────────────────────────────────────────────────────────────────────────
    describe('🔴 ιδιοκτησία tenant — και οι δύο άκρες', () => {
      it('ξένη ΠΗΓΗ ⇒ δυσδιάκριτη από ανύπαρκτη', async () => {
        mockFirestoreForAdd({ sourceCompanyId: 'other-company' });
        const foreign = await handler.execute('manage_relationship', {
          operation: 'add', sourceContactId: 'cont_source_001',
          targetContactId: 'cont_target_002', relationshipType: 'family',
          relationshipId: null, note: null,
        }, adminCtx);

        mockFirestoreForAdd({ sourceExists: false });
        const absent = await handler.execute('manage_relationship', {
          operation: 'add', sourceContactId: 'cont_source_001',
          targetContactId: 'cont_target_002', relationshipType: 'family',
          relationshipId: null, note: null,
        }, adminCtx);

        expect(foreign.success).toBe(false);
        expect(foreign).toEqual(absent);
      });

      it('🔴 ξένος ΣΤΟΧΟΣ ⇒ δυσδιάκριτος από ανύπαρκτο (ήταν εντελώς ανέλεγκτος)', async () => {
        const { mockSet } = mockFirestoreForAdd({ targetCompanyId: 'other-company' });
        const foreign = await handler.execute('manage_relationship', {
          operation: 'add', sourceContactId: 'cont_source_001',
          targetContactId: 'cont_target_002', relationshipType: 'family',
          relationshipId: null, note: null,
        }, adminCtx);

        mockFirestoreForAdd({ targetExists: false });
        const absent = await handler.execute('manage_relationship', {
          operation: 'add', sourceContactId: 'cont_source_001',
          targetContactId: 'cont_target_002', relationshipType: 'family',
          relationshipId: null, note: null,
        }, adminCtx);

        expect(foreign.success).toBe(false);
        expect(foreign).toEqual(absent);
        // Καμία εγγραφή: η σχέση δεν γράφτηκε ούτε μισή.
        expect(mockSet).not.toHaveBeenCalled();
      });

      it('επαφή ΧΩΡΙΣ companyId δεν ανήκει σε κανέναν (ADR-742 §4)', async () => {
        // Το παλιό `sourceData?.companyId &&` την άφηνε να περάσει.
        mockFirestoreForAdd({ sourceCompanyId: null });
        const result = await handler.execute('manage_relationship', {
          operation: 'add', sourceContactId: 'cont_source_001',
          targetContactId: 'cont_target_002', relationshipType: 'family',
          relationshipId: null, note: null,
        }, adminCtx);

        expect(result.success).toBe(false);
      });

      it('καμία λέξη για ξένη εταιρεία δεν διαρρέει στο μοντέλο', async () => {
        mockFirestoreForAdd({ targetCompanyId: 'other-company' });
        const result = await handler.execute('manage_relationship', {
          operation: 'add', sourceContactId: 'cont_source_001',
          targetContactId: 'cont_target_002', relationshipType: 'family',
          relationshipId: null, note: null,
        }, adminCtx);

        const wire = JSON.stringify(result).toLowerCase();
        expect(wire).not.toContain('access denied');
        expect(wire).not.toContain('other-company');
      });
    });
  });

  // ── LIST ──

  describe('list', () => {
    it('should return relationships for contact', async () => {
      mockFirestoreForList([
        { targetContactId: 'cont_002', relationshipType: 'family', notes: 'σύζυγος' },
        { targetContactId: 'cont_003', relationshipType: 'colleague', notes: null },
      ]);

      const result = await handler.execute('manage_relationship', {
        operation: 'list', sourceContactId: 'cont_001', ...baseArgs,
      }, adminCtx);

      expect(result.success).toBe(true);
      expect(result.count).toBe(2);
    });

    it('should return empty for no relationships', async () => {
      mockFirestoreForList([]);

      const result = await handler.execute('manage_relationship', {
        operation: 'list', sourceContactId: 'cont_001', ...baseArgs,
      }, adminCtx);

      expect(result.success).toBe(true);
      expect(result.count).toBe(0);
    });
  });

  // ── REMOVE ──

  describe('remove', () => {
    it('should require relationshipId', async () => {
      const result = await handler.execute('manage_relationship', {
        operation: 'remove', sourceContactId: 'cont_001',
        targetContactId: null, relationshipType: null,
        relationshipId: '', note: null,
      }, adminCtx);

      expect(result.success).toBe(false);
      expect(result.error).toContain('relationshipId is required');
    });
  });
});
