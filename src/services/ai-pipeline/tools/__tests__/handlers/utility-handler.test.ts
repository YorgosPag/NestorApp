/**
 * UTILITY HANDLER TESTS
 *
 * Tests get_collection_schema, lookup_doy_code, search_esco_occupations,
 * search_esco_skills — schema lookup, accent-insensitive DOY search, ESCO.
 *
 * @see ADR-171 (Autonomous AI Agent)
 * @module __tests__/handlers/utility-handler
 */

import '../setup';

import { UtilityHandler } from '../../handlers/utility-handler';
import { createAdminContext } from '../test-utils/context-factory';

// ── Mock firestore-schema-map ──
jest.mock('@/config/firestore-schema-map', () => ({
  getCollectionSchemaInfo: jest.fn((collection: string) => {
    const schemas: Record<string, { name: string; fields: string[] }> = {
      contacts: { name: 'contacts', fields: ['displayName', 'email', 'phone'] },
      projects: { name: 'projects', fields: ['name', 'status', 'address'] },
    };
    return schemas[collection] ?? null;
  }),
}));

// ── Mock greek-tax-offices (dynamic import) ──
const mockOfficeNames: Record<string, string> = {
  '1101': "Α' Αθηνών",
  '1201': 'Θεσσαλονίκης',
  '1301': 'Νέας Ιωνίας',
  '1401': 'Καλλιθέας',
  '1501': 'Πειραιώς',
};
const mockRegionNames: Record<string, string> = {
  'regions.attica': 'Αττική',
  'regions.central_macedonia': 'Κεντρική Μακεδονία',
};
jest.mock('@/subapps/accounting/data/greek-tax-offices', () => ({
  GREEK_TAX_OFFICES: [
    { code: '1101', name: 'offices.1101', region: 'regions.attica' },
    { code: '1201', name: 'offices.1201', region: 'regions.central_macedonia' },
    { code: '1301', name: 'offices.1301', region: 'regions.attica' },
    { code: '1401', name: 'offices.1401', region: 'regions.attica' },
    { code: '1501', name: 'offices.1501', region: 'regions.attica' },
  ],
  getTaxOfficeDisplayName: (code: string) => mockOfficeNames[code] ?? code,
  getRegionDisplayName: (key: string) => mockRegionNames[key] ?? key,
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { searchEscoOccupations, searchEscoSkills } = require('../../esco-search-utils') as {
  searchEscoOccupations: jest.Mock;
  searchEscoSkills: jest.Mock;
};

describe('UtilityHandler', () => {
  let handler: UtilityHandler;
  const ctx = createAdminContext();

  beforeEach(() => {
    handler = new UtilityHandler();
    jest.clearAllMocks();
    searchEscoOccupations.mockResolvedValue([]);
    searchEscoSkills.mockResolvedValue([]);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // get_collection_schema
  // ──────────────────────────────────────────────────────────────────────────

  describe('get_collection_schema', () => {
    it('returns schema for valid collection', async () => {
      const result = await handler.execute('get_collection_schema', { collection: 'contacts' }, ctx);

      expect(result.success).toBe(true);
      const data = result.data as { name: string; fields: string[] };
      expect(data.name).toBe('contacts');
      expect(data.fields).toContain('displayName');
    });

    it('returns error for unknown collection', async () => {
      const result = await handler.execute('get_collection_schema', { collection: 'nonexistent' }, ctx);

      expect(result.success).toBe(false);
      expect(result.error).toContain('No schema');
      expect(result.error).toContain('Available');
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // lookup_doy_code
  // ──────────────────────────────────────────────────────────────────────────

  describe('lookup_doy_code', () => {
    it('finds DOY by name', async () => {
      const result = await handler.execute('lookup_doy_code', { query: 'Θεσσαλονίκης' }, ctx);

      expect(result.success).toBe(true);
      expect(result.count).toBeGreaterThan(0);
      const data = result.data as Array<{ code: string; name: string }>;
      expect(data[0].name).toBe('Θεσσαλονίκης');
    });

    it('finds DOY case-insensitive', async () => {
      const result = await handler.execute('lookup_doy_code', { query: 'θεσσαλονικης' }, ctx);

      expect(result.success).toBe(true);
      expect(result.count).toBeGreaterThan(0);
    });

    it('finds DOY accent-insensitive (ΔΟΥ normalization)', async () => {
      const result = await handler.execute('lookup_doy_code', { query: 'ιωνιας' }, ctx);

      expect(result.success).toBe(true);
      const data = result.data as Array<{ name: string }>;
      expect(data[0].name).toContain('Ιωνίας');
    });

    it('returns error for empty query', async () => {
      const result = await handler.execute('lookup_doy_code', { query: '' }, ctx);

      expect(result.success).toBe(false);
      expect(result.error).toContain('required');
    });

    it('returns error when no DOY matches', async () => {
      const result = await handler.execute('lookup_doy_code', { query: 'ΝοΕξιστΔοψ' }, ctx);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Δεν βρέθηκε');
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // ESCO search
  // ──────────────────────────────────────────────────────────────────────────

  describe('search_esco_occupations', () => {
    it('returns results for valid query', async () => {
      searchEscoOccupations.mockResolvedValue([{ code: '123', label: 'Μηχανικός' }]);

      const result = await handler.execute('search_esco_occupations', { query: 'μηχανικός' }, ctx);

      expect(result.success).toBe(true);
      expect(result.count).toBe(1);
    });

    it('rejects short query (< 2 chars)', async () => {
      const result = await handler.execute('search_esco_occupations', { query: 'α' }, ctx);

      expect(result.success).toBe(false);
      expect(result.error).toContain('2 characters');
    });
  });

  describe('search_esco_skills', () => {
    it('returns results for valid query', async () => {
      searchEscoSkills.mockResolvedValue([{ code: '456', label: 'Σχεδιασμός' }]);

      const result = await handler.execute('search_esco_skills', { query: 'σχεδιασμός' }, ctx);

      expect(result.success).toBe(true);
      expect(result.count).toBe(1);
    });

    it('rejects short query (< 2 chars)', async () => {
      const result = await handler.execute('search_esco_skills', { query: 'x' }, ctx);

      expect(result.success).toBe(false);
      expect(result.error).toContain('2 characters');
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Unknown tool
  // ──────────────────────────────────────────────────────────────────────────

  it('returns error for unknown tool', async () => {
    const result = await handler.execute('nonexistent_tool', {}, ctx);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Unknown');
  });
});
