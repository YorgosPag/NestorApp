/**
 * ESCO WRITE HANDLER — Unit Tests (Google-level)
 *
 * Covers:
 * - FINDING-002: disambiguation leak (multiple matches without user confirmation)
 * - FINDING-003: zero skill matches behavior
 * - Positive paths: single match, disambiguated, skills merge
 * - Security: admin-only, contact validation
 *
 * @see QA_AGENT_FINDINGS.md
 */

import '../setup';

import { executeSetContactEsco } from '../../handlers/esco-write-handler';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { createMockFirestore, type MockFirestoreKit } from '../test-utils/mock-firestore';
import { createAdminContext, createCustomerContext } from '../test-utils/context-factory';

// ── Mocked ESCO enforcement ──
const mockEnforceEscoOccupation = jest.requireMock('@/services/ai-pipeline/tools/esco-search-utils').enforceEscoOccupation as jest.Mock;
const mockEnforceEscoSkill = jest.requireMock('@/services/ai-pipeline/tools/esco-search-utils').enforceEscoSkill as jest.Mock;

// ============================================================================
// SETUP
// ============================================================================

describe('EscoWriteHandler (set_contact_esco)', () => {
  let mockDb: MockFirestoreKit;

  beforeEach(() => {
    mockDb = createMockFirestore();
    (getAdminFirestore as jest.Mock).mockReturnValue(mockDb.instance);
    jest.clearAllMocks();

    // Seed a default contact
    mockDb.seedCollection('contacts', {
      'cont_001': {
        companyId: 'test-company-001',
        firstName: 'Δημήτριος',
        lastName: 'Οικονόμου',
        escoSkills: [],
      },
    });
  });

  // ==========================================================================
  // FINDING-002: Disambiguation enforcement
  // ==========================================================================

  /**
   * FINDING-002 REGRESSION: When multiple ESCO matches exist and the user
   * has NOT confirmed (disambiguated=false), the handler MUST block the write
   * and return the matches for user selection.
   */
  test('should block when multiple matches and not disambiguated — FINDING-002', async () => {
    const ctx = createAdminContext();
    mockEnforceEscoOccupation.mockResolvedValue({
      allowed: false,
      matches: [
        { uri: 'http://esco/1', label: 'μηχανικός δομικών έργων', iscoCode: '2142' },
        { uri: 'http://esco/2', label: 'μηχανικός ηλεκτρολόγος', iscoCode: '2151' },
        { uri: 'http://esco/3', label: 'μηχανικός μηχανολόγος', iscoCode: '2144' },
      ],
    });

    const result = await executeSetContactEsco({
      contactId: 'cont_001',
      profession: 'μηχανικός',
      disambiguated: false,
    }, ctx);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Βρέθηκαν');
    expect(result.error).toContain('3');
    const data = result.data as Record<string, unknown>;
    expect(data.escoMatchesFound).toBe(true);
    expect(data.matches).toHaveLength(3);
  });

  test('should return matches for user selection — FINDING-002', async () => {
    const ctx = createAdminContext();
    mockEnforceEscoOccupation.mockResolvedValue({
      allowed: false,
      matches: [
        { uri: 'http://esco/1', label: 'αρχιτέκτονας τοπίου' },
        { uri: 'http://esco/2', label: 'αρχιτέκτονας εσωτερικών χώρων' },
      ],
    });

    const result = await executeSetContactEsco({
      contactId: 'cont_001',
      profession: 'αρχιτέκτονας',
    }, ctx);

    expect(result.success).toBe(false);
    const data = result.data as Record<string, unknown>;
    expect(data.requestedProfession).toBe('αρχιτέκτονας');
    expect(Array.isArray(data.matches)).toBe(true);
  });

  // ==========================================================================
  // Positive paths
  // ==========================================================================

  test('should write profession when single ESCO match (allowed)', async () => {
    const ctx = createAdminContext();
    mockEnforceEscoOccupation.mockResolvedValue({
      allowed: true,
      matches: [{ uri: 'http://esco/landscape', label: 'αρχιτέκτονας τοπίου', iscoCode: '2161' }],
    });

    const result = await executeSetContactEsco({
      contactId: 'cont_001',
      profession: 'αρχιτέκτονας τοπίου',
      escoUri: 'http://esco/landscape',
      escoLabel: 'αρχιτέκτονας τοπίου',
      iscoCode: '2161',
    }, ctx);

    expect(result.success).toBe(true);
    const doc = mockDb.getData('contacts', 'cont_001');
    expect(doc?.profession).toBe('αρχιτέκτονας τοπίου');
    expect(doc?.escoUri).toBe('http://esco/landscape');
  });

  test('should write when disambiguated with valid URI', async () => {
    const ctx = createAdminContext();
    mockEnforceEscoOccupation.mockResolvedValue({
      allowed: false,
      matches: [
        { uri: 'http://esco/1', label: 'μηχανικός δομικών' },
        { uri: 'http://esco/2', label: 'μηχανικός ηλεκτρολόγος' },
      ],
    });

    const result = await executeSetContactEsco({
      contactId: 'cont_001',
      profession: 'μηχανικός',
      escoUri: 'http://esco/1',
      escoLabel: 'μηχανικός δομικών',
      disambiguated: true,
    }, ctx);

    expect(result.success).toBe(true);
    const doc = mockDb.getData('contacts', 'cont_001');
    expect(doc?.profession).toBe('μηχανικός');
  });

  test('should reject invalid URI after disambiguation', async () => {
    const ctx = createAdminContext();
    mockEnforceEscoOccupation.mockResolvedValue({
      allowed: false,
      matches: [
        { uri: 'http://esco/1', label: 'μηχανικός δομικών' },
      ],
    });

    const result = await executeSetContactEsco({
      contactId: 'cont_001',
      profession: 'μηχανικός',
      escoUri: 'http://esco/WRONG',
      disambiguated: true,
    }, ctx);

    expect(result.success).toBe(false);
    expect(result.error).toContain('δεν αντιστοιχεί');
  });

  // ==========================================================================
  // Skills
  // ==========================================================================

  test('should merge skills with existing skills', async () => {
    const ctx = createAdminContext();
    mockDb.seedCollection('contacts', {
      'cont_001': {
        companyId: 'test-company-001',
        escoSkills: [{ uri: 'http://skill/1', label: 'σχεδιασμός' }],
      },
    });
    mockEnforceEscoSkill.mockResolvedValue({ allowed: true, matches: [] });

    const result = await executeSetContactEsco({
      contactId: 'cont_001',
      skills: [
        { uri: 'http://skill/2', label: 'διαχείριση έργου' },
      ],
    }, ctx);

    expect(result.success).toBe(true);
    const doc = mockDb.getData('contacts', 'cont_001');
    const skills = doc?.escoSkills as Array<{ uri: string; label: string }>;
    expect(skills).toHaveLength(2);
    expect(skills.map(s => s.label)).toContain('σχεδιασμός');
    expect(skills.map(s => s.label)).toContain('διαχείριση έργου');
  });

  /**
   * FINDING-003: When ESCO skill search returns 0 matches,
   * enforceEscoSkill returns allowed=true → skill is written as free-text.
   */
  test('should write skill when enforceEscoSkill allows (zero matches) — FINDING-003', async () => {
    const ctx = createAdminContext();
    mockEnforceEscoSkill.mockResolvedValue({ allowed: true, matches: [] });

    const result = await executeSetContactEsco({
      contactId: 'cont_001',
      skills: [{ uri: '', label: 'σχεδιασμός κτιρίων' }],
    }, ctx);

    expect(result.success).toBe(true);
    const doc = mockDb.getData('contacts', 'cont_001');
    const skills = doc?.escoSkills as Array<{ uri: string; label: string }>;
    expect(skills.some(s => s.label === 'σχεδιασμός κτιρίων')).toBe(true);
  });

  // ==========================================================================
  // Security & Validation
  // ==========================================================================

  test('should reject when not admin', async () => {
    const ctx = createCustomerContext();

    const result = await executeSetContactEsco({
      contactId: 'cont_001',
      profession: 'test',
    }, ctx);

    expect(result.success).toBe(false);
    expect(result.error).toContain('admin');
  });

  test('should reject when contact not found', async () => {
    const ctx = createAdminContext();

    const result = await executeSetContactEsco({
      contactId: 'cont_nonexistent',
      profession: 'test',
    }, ctx);

    expect(result.success).toBe(false);
    expect(result.error).toContain('δεν βρέθηκε');
  });

  test('should reject when no profession or skills provided', async () => {
    const ctx = createAdminContext();

    const result = await executeSetContactEsco({
      contactId: 'cont_001',
    }, ctx);

    expect(result.success).toBe(false);
    expect(result.error).toContain('profession');
  });
});
