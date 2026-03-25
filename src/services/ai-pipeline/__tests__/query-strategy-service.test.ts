/**
 * QUERY STRATEGY SERVICE TESTS
 *
 * Tests AI query strategy memory: recording failed/successful strategies
 * and generating prompt hints from stored strategies.
 *
 * @module __tests__/query-strategy-service
 */

// ── Mocks (all self-contained, no shared setup) ──
jest.mock('server-only', () => ({}));

jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminFirestore: jest.fn(),
}));

jest.mock('@/lib/telemetry/Logger', () => ({
  createModuleLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
}));

jest.mock('@/lib/error-utils', () => ({
  getErrorMessage: jest.fn((e: unknown) => e instanceof Error ? e.message : String(e)),
}));

jest.mock('@/config/firestore-collections', () => ({
  COLLECTIONS: { AI_QUERY_STRATEGIES: 'ai_query_strategies' },
}));

jest.mock('@/services/enterprise-id.service', () => ({
  generateQueryStrategyDocId: jest.fn(() => 'qs_test_001'),
}));

// ── Import after mocks ──
import { recordQueryStrategy, getQueryStrategyHints } from '../query-strategy-service';
import { getAdminFirestore } from '@/lib/firebaseAdmin';

// ============================================================================
// HELPERS
// ============================================================================

interface MockDocSnapshot {
  exists: boolean;
  data: () => Record<string, unknown> | undefined;
}

interface MockDocRef {
  get: jest.Mock;
  set: jest.Mock;
  update: jest.Mock;
}

interface MockCollectionRef {
  doc: jest.Mock;
  orderBy: jest.Mock;
  limit: jest.Mock;
  get: jest.Mock;
}

function createMockFirestore(docSnapshot: MockDocSnapshot): { db: { collection: jest.Mock }; docRef: MockDocRef; collectionRef: MockCollectionRef } {
  const docRef: MockDocRef = {
    get: jest.fn().mockResolvedValue(docSnapshot),
    set: jest.fn().mockResolvedValue(undefined),
    update: jest.fn().mockResolvedValue(undefined),
  };

  const queryRef = {
    get: jest.fn().mockResolvedValue({ empty: true, docs: [] }),
  };

  const collectionRef: MockCollectionRef = {
    doc: jest.fn().mockReturnValue(docRef),
    orderBy: jest.fn().mockReturnValue({
      limit: jest.fn().mockReturnValue(queryRef),
    }),
    limit: jest.fn().mockReturnValue(queryRef),
    get: queryRef.get,
  };

  const db = { collection: jest.fn().mockReturnValue(collectionRef) };

  (getAdminFirestore as jest.Mock).mockReturnValue(db);

  return { db, docRef, collectionRef };
}

// ============================================================================
// recordQueryStrategy
// ============================================================================

describe('recordQueryStrategy', () => {
  beforeEach(() => jest.clearAllMocks());

  const baseParams = {
    collection: 'contacts',
    failedFilters: ['address.city'],
    failedReason: 'FAILED_PRECONDITION: index required',
    successfulFilters: ['companyId'],
  };

  it('creates a new strategy document when none exists', async () => {
    const { docRef } = createMockFirestore({ exists: false, data: () => undefined });

    await recordQueryStrategy(baseParams);

    expect(docRef.set).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'contacts',
        failedFilters: ['address.city'],
        useCount: 1,
      })
    );
    expect(docRef.update).not.toHaveBeenCalled();
  });

  it('updates existing strategy document incrementing useCount', async () => {
    const existingData = { useCount: 3, lastUsedAt: '2026-01-01T00:00:00.000Z' };
    const { docRef } = createMockFirestore({ exists: true, data: () => existingData });

    await recordQueryStrategy(baseParams);

    expect(docRef.update).toHaveBeenCalledWith(
      expect.objectContaining({
        useCount: 4,
        successfulFilters: ['companyId'],
      })
    );
    expect(docRef.set).not.toHaveBeenCalled();
  });

  it('does not throw on Firestore errors (non-fatal)', async () => {
    (getAdminFirestore as jest.Mock).mockImplementation(() => {
      throw new Error('Firestore unavailable');
    });

    await expect(recordQueryStrategy(baseParams)).resolves.toBeUndefined();
  });
});

// ============================================================================
// getQueryStrategyHints
// ============================================================================

describe('getQueryStrategyHints', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns empty string when no strategies exist', async () => {
    createMockFirestore({ exists: false, data: () => undefined });

    const result = await getQueryStrategyHints();
    expect(result).toBe('');
  });

  it('returns formatted hints for existing strategies', async () => {
    const mockDocs = [
      {
        data: () => ({
          collection: 'contacts',
          failedFilters: ['address.city', 'address.street'],
          successfulStrategy: 'Query contacts without nested filters',
        }),
      },
      {
        data: () => ({
          collection: 'projects',
          failedFilters: ['metadata.status'],
          successfulStrategy: 'Query projects by top-level fields',
        }),
      },
    ];

    const queryRef = { get: jest.fn().mockResolvedValue({ empty: false, docs: mockDocs }) };
    const limitRef = { limit: jest.fn().mockReturnValue(queryRef) };
    const collectionRef = {
      doc: jest.fn(),
      orderBy: jest.fn().mockReturnValue(limitRef),
    };
    const db = { collection: jest.fn().mockReturnValue(collectionRef) };
    (getAdminFirestore as jest.Mock).mockReturnValue(db);

    const result = await getQueryStrategyHints();

    expect(result).toContain('ΑΠΟΤΥΧΗΜΕΝΑ QUERY PATTERNS');
    expect(result).toContain('contacts');
    expect(result).toContain('address.city, address.street');
    expect(result).toContain('projects');
  });

  it('queries strategies ordered by useCount desc with limit 10', async () => {
    const queryRef = { get: jest.fn().mockResolvedValue({ empty: true, docs: [] }) };
    const limitRef = { limit: jest.fn().mockReturnValue(queryRef) };
    const collectionRef = {
      doc: jest.fn(),
      orderBy: jest.fn().mockReturnValue(limitRef),
    };
    const db = { collection: jest.fn().mockReturnValue(collectionRef) };
    (getAdminFirestore as jest.Mock).mockReturnValue(db);

    await getQueryStrategyHints();

    expect(collectionRef.orderBy).toHaveBeenCalledWith('useCount', 'desc');
    expect(limitRef.limit).toHaveBeenCalledWith(10);
  });

  it('returns empty string on Firestore errors', async () => {
    (getAdminFirestore as jest.Mock).mockImplementation(() => {
      throw new Error('Connection refused');
    });

    const result = await getQueryStrategyHints();
    expect(result).toBe('');
  });
});
