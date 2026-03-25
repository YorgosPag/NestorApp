/**
 * AGENTIC TOOL EXECUTOR — Integration Tests (Google-level)
 *
 * Tests the dispatcher layer: routing, unknown tools, error handling.
 *
 * @see ADR-171
 */

import '../setup';

import { AgenticToolExecutor } from '../../agentic-tool-executor';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { createMockFirestore, type MockFirestoreKit } from '../test-utils/mock-firestore';
import { createAdminContext } from '../test-utils/context-factory';

describe('AgenticToolExecutor', () => {
  let executor: AgenticToolExecutor;
  let mockDb: MockFirestoreKit;

  beforeEach(() => {
    executor = new AgenticToolExecutor();
    mockDb = createMockFirestore();
    (getAdminFirestore as jest.Mock).mockReturnValue(mockDb.instance);
    jest.clearAllMocks();
  });

  test('should route firestore_query to FirestoreHandler', async () => {
    const ctx = createAdminContext();
    mockDb.seedCollection('contacts', {
      'c1': { companyId: 'test-company-001', name: 'Test' },
    });

    const result = await executor.executeTool('firestore_query', {
      collection: 'contacts',
      filters: [],
    }, ctx);

    expect(result.success).toBe(true);
  });

  test('should route create_contact to ContactHandler', async () => {
    const ctx = createAdminContext();

    const { createContactServerSide } = jest.requireMock(
      '@/services/ai-pipeline/shared/contact-lookup'
    );
    (createContactServerSide as jest.Mock).mockResolvedValue({
      contactId: 'cont_new',
      displayName: 'Test User',
    });

    const result = await executor.executeTool('create_contact', {
      contactType: 'individual',
      firstName: 'Test',
      lastName: 'User',
    }, ctx);

    expect(result.success).toBe(true);
  });

  test('should return error for unknown tool', async () => {
    const ctx = createAdminContext();

    const result = await executor.executeTool('nonexistent_tool', {}, ctx);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Unknown tool');
  });

  test('should catch and wrap handler errors', async () => {
    const ctx = createAdminContext();
    // Force an error by passing invalid data to a real handler
    (getAdminFirestore as jest.Mock).mockReturnValue({
      collection: () => {
        throw new Error('Firestore connection failed');
      },
    });

    const result = await executor.executeTool('firestore_query', {
      collection: 'contacts',
      filters: [],
    }, ctx);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Firestore connection failed');
  });

  test('should handle FAILED_PRECONDITION with broad fallback', async () => {
    const ctx = createAdminContext();

    // Create a chainable mock that throws FAILED_PRECONDITION on first .get()
    // but succeeds on the broad fallback (only companyId filter)
    let callCount = 0;
    const mockCollection = {
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      get: jest.fn(async () => {
        callCount++;
        if (callCount === 1) {
          throw new Error('9 FAILED_PRECONDITION: The query requires an index');
        }
        // Broad fallback succeeds
        return {
          docs: [{
            id: 'c1',
            data: () => ({ companyId: 'test-company-001', name: 'Fallback' }),
            exists: true,
          }],
          empty: false,
          size: 1,
        };
      }),
    };

    (getAdminFirestore as jest.Mock).mockReturnValue({
      collection: () => mockCollection,
    });

    const result = await executor.executeTool('firestore_query', {
      collection: 'contacts',
      filters: [
        { field: 'status', operator: '==', value: 'active' },
      ],
    }, ctx);

    // The executor catches FAILED_PRECONDITION for firestore_query
    // and invokes handleFailedPreconditionFallback → still returns success
    expect(result.success).toBe(true);
  });
});
