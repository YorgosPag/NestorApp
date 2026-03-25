/**
 * FIRESTORE HANDLER — Unit Tests (Google-level)
 *
 * Covers:
 * - firestore_query: company scope, RBAC, whitelist
 * - firestore_get_document: fetch, not found, company isolation
 * - firestore_count: basic count
 * - firestore_write: admin-only, whitelist, ESCO protection
 * - FINDING-006: contact_links write (canary — currently allowed)
 * - FINDING-007: IBAN flat field (canary — no validation)
 * - search_text: basic text search
 *
 * @see QA_AGENT_FINDINGS.md
 */

import '../setup';

import { FirestoreHandler } from '../../handlers/firestore-handler';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { createMockFirestore, type MockFirestoreKit } from '../test-utils/mock-firestore';
import { createAdminContext, createCustomerContext } from '../test-utils/context-factory';

// ============================================================================
// SETUP
// ============================================================================

describe('FirestoreHandler', () => {
  let handler: FirestoreHandler;
  let mockDb: MockFirestoreKit;

  beforeEach(() => {
    handler = new FirestoreHandler();
    mockDb = createMockFirestore();
    (getAdminFirestore as jest.Mock).mockReturnValue(mockDb.instance);
    jest.clearAllMocks();
  });

  // ==========================================================================
  // firestore_query
  // ==========================================================================

  describe('firestore_query', () => {
    test('should query with company scope auto-injected', async () => {
      const ctx = createAdminContext();
      mockDb.seedCollection('contacts', {
        'cont_001': { companyId: 'test-company-001', firstName: 'Δημήτριος' },
        'cont_002': { companyId: 'other-company', firstName: 'Other' },
      });

      const result = await handler.execute('firestore_query', {
        collection: 'contacts',
        filters: [],
      }, ctx);

      expect(result.success).toBe(true);
      // Only the document with matching companyId should be returned
      expect(result.count).toBe(1);
      const data = result.data as Array<Record<string, unknown>>;
      expect(data[0].firstName).toBe('Δημήτριος');
    });

    test('should reject read on non-whitelisted collection', async () => {
      const ctx = createAdminContext();

      const result = await handler.execute('firestore_query', {
        collection: 'secret_internal_data',
        filters: [],
      }, ctx);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not accessible');
    });

    test('should handle empty query results', async () => {
      const ctx = createAdminContext();
      // Empty collection
      mockDb.seedCollection('contacts', {});

      const result = await handler.execute('firestore_query', {
        collection: 'contacts',
        filters: [],
      }, ctx);

      expect(result.success).toBe(true);
      expect(result.count).toBe(0);
    });
  });

  // ==========================================================================
  // firestore_get_document
  // ==========================================================================

  describe('firestore_get_document', () => {
    test('should return document by ID', async () => {
      const ctx = createAdminContext();
      mockDb.seedCollection('contacts', {
        'cont_001': { companyId: 'test-company-001', firstName: 'Δημήτριος', lastName: 'Οικονόμου' },
      });

      const result = await handler.execute('firestore_get_document', {
        collection: 'contacts',
        documentId: 'cont_001',
      }, ctx);

      expect(result.success).toBe(true);
      expect(result.count).toBe(1);
      const data = result.data as Record<string, unknown>;
      expect(data.firstName).toBe('Δημήτριος');
    });

    test('should return null when document not found', async () => {
      const ctx = createAdminContext();

      const result = await handler.execute('firestore_get_document', {
        collection: 'contacts',
        documentId: 'nonexistent',
      }, ctx);

      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
      expect(result.count).toBe(0);
    });

    test('should block cross-company document access', async () => {
      const ctx = createAdminContext();
      mockDb.seedCollection('contacts', {
        'cont_other': { companyId: 'other-company', firstName: 'Hacker' },
      });

      const result = await handler.execute('firestore_get_document', {
        collection: 'contacts',
        documentId: 'cont_other',
      }, ctx);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  // ==========================================================================
  // firestore_count
  // ==========================================================================

  describe('firestore_count', () => {
    test('should count documents with company scope', async () => {
      const ctx = createAdminContext();
      mockDb.seedCollection('contacts', {
        'c1': { companyId: 'test-company-001', name: 'A' },
        'c2': { companyId: 'test-company-001', name: 'B' },
        'c3': { companyId: 'other-company', name: 'C' },
      });

      const result = await handler.execute('firestore_count', {
        collection: 'contacts',
        filters: [],
      }, ctx);

      expect(result.success).toBe(true);
      const data = result.data as { count: number };
      expect(data.count).toBe(2);
    });
  });

  // ==========================================================================
  // firestore_write — Security + FINDING-006, FINDING-007
  // ==========================================================================

  describe('firestore_write', () => {
    test('should create document with enterprise ID when mode=create', async () => {
      const ctx = createAdminContext();

      const result = await handler.execute('firestore_write', {
        collection: 'contacts',
        mode: 'create',
        data: { firstName: 'Test', lastName: 'User' },
      }, ctx);

      expect(result.success).toBe(true);
      const data = result.data as { id: string };
      expect(data.id).toBe('ent_test_001'); // From mock enterprise-id.service
    });

    test('should update existing document when mode=update', async () => {
      const ctx = createAdminContext();
      mockDb.seedCollection('tasks', {
        'task_001': { companyId: 'test-company-001', title: 'Old' },
      });

      const result = await handler.execute('firestore_write', {
        collection: 'tasks',
        documentId: 'task_001',
        mode: 'update',
        data: { title: 'Updated' },
      }, ctx);

      expect(result.success).toBe(true);
      const updatedDoc = mockDb.getData('tasks', 'task_001');
      expect(updatedDoc?.title).toBe('Updated');
    });

    test('should reject write when not admin', async () => {
      const ctx = createCustomerContext();

      const result = await handler.execute('firestore_write', {
        collection: 'contacts',
        mode: 'create',
        data: { firstName: 'Hack' },
      }, ctx);

      expect(result.success).toBe(false);
      expect(result.error).toContain('admin');
    });

    test('should reject write on non-whitelisted collection', async () => {
      const ctx = createAdminContext();

      const result = await handler.execute('firestore_write', {
        collection: 'system_settings',
        mode: 'create',
        data: { evil: true },
      }, ctx);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not allowed');
    });

    test('should block ESCO fields via firestore_write to contacts', async () => {
      const ctx = createAdminContext();

      const result = await handler.execute('firestore_write', {
        collection: 'contacts',
        documentId: 'cont_001',
        mode: 'update',
        data: { profession: 'μηχανικός', escoUri: 'http://fake' },
      }, ctx);

      expect(result.success).toBe(false);
      expect(result.error).toContain('set_contact_esco');
    });

    /**
     * FINDING-006 REGRESSION: firestore_write must BLOCK writes to contact_links.
     * contact_links was removed from ALLOWED_WRITE_COLLECTIONS.
     * Relationships require a dedicated tool with validation.
     */
    test('should block write to contact_links — FINDING-006 fixed', async () => {
      const ctx = createAdminContext();

      const result = await handler.execute('firestore_write', {
        collection: 'contact_links',
        mode: 'create',
        data: {
          sourceContactId: 'cont_001',
          targetEntityId: 'cont_002',
          role: 'spouse',
        },
      }, ctx);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not allowed');
    });

    /**
     * FINDING-007 REGRESSION: firestore_write must BLOCK updates to contacts.
     * Contacts have dedicated tools: update_contact_field, append_contact_info, set_contact_esco.
     * This prevents arbitrary fields (iban, etc.) from being written without validation.
     */
    test('should block update to contacts via firestore_write — FINDING-007 fixed', async () => {
      const ctx = createAdminContext();
      mockDb.seedCollection('contacts', {
        'cont_001': { companyId: 'test-company-001', firstName: 'Test' },
      });

      const result = await handler.execute('firestore_write', {
        collection: 'contacts',
        documentId: 'cont_001',
        mode: 'update',
        data: { iban: 'INVALID_IBAN_12345' },
      }, ctx);

      expect(result.success).toBe(false);
      expect(result.error).toContain('update_contact_field');
    });
  });

  // ==========================================================================
  // search_text
  // ==========================================================================

  describe('search_text', () => {
    test('should search text with company scope', async () => {
      const ctx = createAdminContext();
      mockDb.seedCollection('contacts', {
        'c1': { companyId: 'test-company-001', displayName: 'Δημήτριος Οικονόμου' },
        'c2': { companyId: 'test-company-001', displayName: 'Μαρία Παπαδοπούλου' },
        'c3': { companyId: 'other-company', displayName: 'Δημήτριος Other' },
      });

      const result = await handler.execute('search_text', {
        searchTerm: 'Δημήτριος',
        collections: ['contacts'],
      }, ctx);

      expect(result.success).toBe(true);
      // Should only find contacts from test-company-001
      const data = result.data as Record<string, Array<Record<string, unknown>>>;
      const contacts = data.contacts ?? [];
      // The search finds within same company
      expect(contacts.length).toBeGreaterThanOrEqual(1);
      expect(contacts.every(c => c.companyId === 'test-company-001')).toBe(true);
    });

    test('should handle empty search results', async () => {
      const ctx = createAdminContext();
      mockDb.seedCollection('contacts', {
        'c1': { companyId: 'test-company-001', displayName: 'Nobody Matches' },
      });

      const result = await handler.execute('search_text', {
        searchTerm: 'ΞΞΞ',
        collections: ['contacts'],
      }, ctx);

      expect(result.success).toBe(true);
    });

    test('should reject empty searchTerm', async () => {
      const ctx = createAdminContext();

      const result = await handler.execute('search_text', {
        searchTerm: '',
        collections: ['contacts'],
      }, ctx);

      expect(result.success).toBe(false);
    });
  });
});
