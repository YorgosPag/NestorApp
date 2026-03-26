/**
 * KNOWLEDGE BASE HANDLER TESTS
 *
 * Tests search_knowledge_base: procedure matching, document availability,
 * empty query, Firestore error fallback.
 *
 * @see ADR-171 (Autonomous AI Agent)
 * @module __tests__/handlers/knowledge-base-handler
 */

import '../setup';

import { KnowledgeBaseHandler } from '../../handlers/knowledge-base-handler';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { createAdminContext, createCustomerContext } from '../test-utils/context-factory';

// ── Mock legal-procedures-kb (dynamic import) ──
jest.mock('@/config/legal-procedures-kb', () => ({
  searchProcedures: jest.fn(() => []),
  DOCUMENT_SOURCE_LABELS: {
    system: 'Αρχείο στο σύστημα',
    client: 'Από τον πελάτη',
    authority: 'Από δημόσια αρχή',
  },
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { searchProcedures } = require('@/config/legal-procedures-kb') as {
  searchProcedures: jest.Mock;
};

describe('KnowledgeBaseHandler', () => {
  let handler: KnowledgeBaseHandler;

  beforeEach(() => {
    handler = new KnowledgeBaseHandler();
    jest.clearAllMocks();

    // Default: no files in system
    (getAdminFirestore as jest.Mock).mockReturnValue({
      collection: jest.fn(() => ({
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        get: jest.fn(async () => ({ docs: [] })),
      })),
    });
  });

  it('returns error for empty query', async () => {
    const ctx = createAdminContext();
    const result = await handler.execute('search_knowledge_base', { query: '' }, ctx);

    expect(result.success).toBe(false);
    expect(result.error).toContain('required');
  });

  it('returns error for unknown tool name', async () => {
    const ctx = createAdminContext();
    const result = await handler.execute('unknown_tool', { query: 'test' }, ctx);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Unknown');
  });

  it('returns suggestion when no procedures match', async () => {
    searchProcedures.mockReturnValue([]);
    const ctx = createAdminContext();

    const result = await handler.execute('search_knowledge_base', { query: 'xyz' }, ctx);

    expect(result.success).toBe(true);
    expect(result.count).toBe(0);
    const data = result.data as Record<string, unknown>;
    expect(data.message).toContain('Δεν βρέθηκε');
    expect(data.suggestion).toBeDefined();
  });

  it('returns matched procedures with enriched documents', async () => {
    searchProcedures.mockReturnValue([
      {
        matchScore: 0.9,
        procedure: {
          id: 'proc_001',
          title: 'Μεταβίβαση Ακινήτου',
          category: 'transfer',
          description: 'Διαδικασία μεταβίβασης',
          requiredDocuments: [
            { name: 'Τίτλος Ιδιοκτησίας', source: 'client', searchTerms: [] },
            { name: 'Κτηματολόγιο', source: 'system', searchTerms: ['ktim'] },
          ],
        },
      },
    ]);

    const ctx = createCustomerContext();
    const result = await handler.execute('search_knowledge_base', { query: 'μεταβίβαση' }, ctx);

    expect(result.success).toBe(true);
    expect(result.count).toBe(1);
    const data = result.data as { procedures: Array<{ title: string; requiredDocuments: Array<{ name: string }> }> };
    expect(data.procedures[0].title).toBe('Μεταβίβαση Ακινήτου');
    expect(data.procedures[0].requiredDocuments).toHaveLength(2);
  });

  it('limits results to top 2 procedures', async () => {
    searchProcedures.mockReturnValue([
      { matchScore: 0.9, procedure: { id: 'p1', title: 'A', category: 'a', description: 'a', requiredDocuments: [] } },
      { matchScore: 0.8, procedure: { id: 'p2', title: 'B', category: 'b', description: 'b', requiredDocuments: [] } },
      { matchScore: 0.7, procedure: { id: 'p3', title: 'C', category: 'c', description: 'c', requiredDocuments: [] } },
    ]);

    const ctx = createAdminContext();
    const result = await handler.execute('search_knowledge_base', { query: 'test' }, ctx);

    expect(result.count).toBe(2);
  });

  it('marks document as available when file found in system', async () => {
    searchProcedures.mockReturnValue([
      {
        matchScore: 0.9,
        procedure: {
          id: 'proc_001',
          title: 'Test',
          category: 'test',
          description: 'test',
          requiredDocuments: [
            { name: 'Πιστοποιητικό', source: 'system', searchTerms: ['certificate'] },
          ],
        },
      },
    ]);

    // Mock files collection with matching file
    (getAdminFirestore as jest.Mock).mockReturnValue({
      collection: jest.fn(() => ({
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        get: jest.fn(async () => ({
          docs: [{
            data: () => ({
              purpose: 'certificate',
              category: 'legal',
              displayName: 'Certificate.pdf',
              entityId: 'unit_001',
              projectId: 'proj_001',
              status: 'ready',
              companyId: 'test-company-001',
            }),
          }],
        })),
      })),
    });

    const ctx = createCustomerContext({
      contactMeta: {
        contactId: 'cont_001',
        displayName: 'Test User',
        firstName: 'Test',
        primaryPersona: 'tenant',
        linkedUnitIds: ['unit_001'],
        projectRoles: [{ projectId: 'proj_001', role: 'tenant', entityType: 'unit', entityId: 'unit_001' }],
      },
    });

    const result = await handler.execute('search_knowledge_base', { query: 'πιστοποιητικό' }, ctx);

    expect(result.success).toBe(true);
    const data = result.data as { procedures: Array<{ requiredDocuments: Array<{ availableInSystem: boolean }> }> };
    expect(data.procedures[0].requiredDocuments[0].availableInSystem).toBe(true);
  });

  it('handles Firestore error gracefully in file availability check', async () => {
    searchProcedures.mockReturnValue([
      {
        matchScore: 0.9,
        procedure: {
          id: 'proc_001',
          title: 'Test',
          category: 'test',
          description: 'test',
          requiredDocuments: [
            { name: 'Doc', source: 'system', searchTerms: ['doc'] },
          ],
        },
      },
    ]);

    (getAdminFirestore as jest.Mock).mockReturnValue({
      collection: jest.fn(() => ({
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        get: jest.fn(async () => { throw new Error('Firestore down'); }),
      })),
    });

    const ctx = createCustomerContext({
      contactMeta: {
        contactId: 'cont_001',
        displayName: 'Test User',
        firstName: 'Test',
        primaryPersona: 'tenant',
        linkedUnitIds: ['unit_001'],
        projectRoles: [],
      },
    });

    const result = await handler.execute('search_knowledge_base', { query: 'test' }, ctx);

    // Should still succeed, just without availability info
    expect(result.success).toBe(true);
    const data = result.data as { procedures: Array<{ requiredDocuments: Array<{ availableInSystem: boolean }> }> };
    expect(data.procedures[0].requiredDocuments[0].availableInSystem).toBe(false);
  });
});
