/**
 * SYSTEM PROMPT CRITICAL RULES — Regression Tests (Google-level)
 *
 * These tests verify that critical guardrail rules exist in the system prompt.
 * If someone accidentally deletes a rule, these tests catch it BEFORE production.
 *
 * Philosophy: The system prompt is a SAFETY-CRITICAL component — every rule
 * that prevents data corruption or hallucination MUST have a regression test.
 *
 * @see QA_AGENT_FINDINGS.md (FIND-A through FIND-F)
 * @see ADR-263 Section 8
 */

// All mocks from shared setup (includes AI_ROLE_ACCESS_MATRIX, firestore-schema-map, etc.)
import '../setup';

// Additional mocks for system prompt dependencies not in shared setup
jest.mock('@/config/firestore-schema-map', () => ({
  getCompressedSchema: jest.fn(() => 'MOCK_SCHEMA'),
}));

jest.mock('@/config/ai-tab-mapping', () => ({
  generateTabMappingPrompt: jest.fn(() => 'MOCK_TAB_MAPPING'),
}));

import { buildAgenticSystemPrompt } from '../../../agentic-system-prompt';
import { createAdminContext, createCustomerContext } from '../test-utils/context-factory';

describe('System Prompt Critical Rules', () => {
  let adminPrompt: string;
  let customerPrompt: string;

  beforeAll(() => {
    const adminCtx = createAdminContext();
    const customerCtx = createCustomerContext();
    adminPrompt = buildAgenticSystemPrompt(adminCtx, [], '');
    customerPrompt = buildAgenticSystemPrompt(customerCtx, [], '');
  });

  // ========================================================================
  // FIND-F: Anti-fabrication rule
  // ========================================================================

  describe('FIND-F: Anti-fabrication rule', () => {
    test('prompt contains ANTI-FABRICATION terminal rule', () => {
      expect(adminPrompt).toContain('ANTI-FABRICATION');
    });

    test('prompt instructs to NEVER invent values', () => {
      expect(adminPrompt).toMatch(/ΠΟΤΕ.*εφευρίσκεις|ΠΟΤΕ.*κατασκευάζεις/);
    });

    test('prompt instructs to ASK when value missing', () => {
      expect(adminPrompt).toMatch(/ΡΩΤΑ|ΧΩΡΙΣ τιμή/);
    });
  });

  // ========================================================================
  // FIND-E: ESCO disambiguation number recognition
  // ========================================================================

  describe('FIND-E: ESCO disambiguation rule', () => {
    test('prompt contains ESCO disambiguation number recognition rule', () => {
      expect(adminPrompt).toMatch(/ΑΝΑΓΝΩΡΙΣΗ ΑΡΙΘΜΟΥ ΕΠΙΛΟΓΗΣ|FIND-E/);
    });

    test('prompt instructs NOT to re-search after user selects number', () => {
      expect(adminPrompt).toMatch(/ΜΗΝ ξανακαλείς search_esco/);
    });

    test('prompt mentions disambiguated=true', () => {
      expect(adminPrompt).toContain('disambiguated=true');
    });
  });

  // ========================================================================
  // FIND-D: Multi-part commands + ESCO
  // ========================================================================

  describe('FIND-D: Multi-part commands rule', () => {
    test('prompt contains multi-part command rule', () => {
      expect(adminPrompt).toMatch(/ΠΟΛΥΜΕΡΕΙΣ ΕΝΤΟΛΕΣ|FIND-D/);
    });

    test('prompt instructs to complete ALL parts after disambiguation', () => {
      expect(adminPrompt).toMatch(/ΟΛΟΚΛΗΡΩΣΕ.*εκκρεμή|employer/i);
    });
  });

  // ========================================================================
  // FIND-B: Final state only
  // ========================================================================

  describe('FIND-B: Final state only rule', () => {
    test('prompt contains final state rule', () => {
      expect(adminPrompt).toMatch(/ΤΕΛΙΚΗ ΚΑΤΑΣΤΑΣΗ ΜΟΝΟ|FIND-B/);
    });

    test('prompt instructs not to mention resolved errors', () => {
      expect(adminPrompt).toMatch(/ΜΗΝ αναφέρεις σφάλματα.*ΕΠΙΛΥΘΗΚΑΝ/);
    });
  });

  // ========================================================================
  // FIND-A: Fresh search per message
  // ========================================================================

  describe('FIND-A: No stale document IDs', () => {
    test('prompt contains fresh search rule', () => {
      expect(adminPrompt).toMatch(/ΦΡΕΣΚΟ.*ID|FIND-A/);
    });

    test('prompt forbids reusing IDs from previous messages', () => {
      expect(adminPrompt).toMatch(/ΠΟΤΕ.*ID.*ΠΡΟΗΓΟΥΜΕΝΟ/);
    });

    test('prompt allows exception for disambiguation replies', () => {
      expect(adminPrompt).toMatch(/ΕΚΤΟΣ.*disambiguation/);
    });
  });

  // ========================================================================
  // FIND-C: Gender vs occupation
  // ========================================================================

  describe('FIND-C: Gender vs occupation rule', () => {
    test('prompt contains gender vs occupation rule', () => {
      expect(adminPrompt).toMatch(/ΦΥΛΟ vs ΕΠΑΓΓΕΛΜΑ|FIND-C/);
    });

    test('prompt lists gender words explicitly', () => {
      expect(adminPrompt).toContain('άνδρας');
      expect(adminPrompt).toContain('γυναίκα');
    });

    test('prompt forbids ESCO search for gender words', () => {
      expect(adminPrompt).toMatch(/ΜΗΝ καλείς search_esco.*ΠΟΤΕ/);
    });
  });

  // ========================================================================
  // Original anti-hallucination rule (pre-existing)
  // ========================================================================

  describe('Anti-hallucination base rule (pre-existing)', () => {
    test('prompt contains ANTI-HALLUCINATION terminal rule', () => {
      expect(adminPrompt).toContain('ANTI-HALLUCINATION');
    });

    test('prompt requires tool call before claiming success', () => {
      expect(adminPrompt).toMatch(/ΠΟΤΕ.*ολοκληρώθηκε.*ΔΕΝ ΕΧΕΙΣ ΚΑΛΕΣΕΙ tool/);
    });
  });

  // ========================================================================
  // RBAC — different prompts for admin vs customer
  // ========================================================================

  describe('RBAC differentiation', () => {
    test('admin prompt mentions admin/owner role', () => {
      expect(adminPrompt).toMatch(/admin|διαχειριστή|owner|SUPER ADMIN/i);
    });

    test('customer prompt does NOT mention admin capabilities', () => {
      // Customer should not see admin-specific instructions
      expect(customerPrompt).not.toContain('SUPER ADMIN');
    });
  });

  // ========================================================================
  // Document ID fabrication rule
  // ========================================================================

  describe('Document ID fabrication prevention', () => {
    test('prompt forbids fabricating document IDs', () => {
      expect(adminPrompt).toMatch(/ΜΗΝ κατασκευάζεις IDs/);
    });

    test('prompt requires search before update', () => {
      expect(adminPrompt).toMatch(/search_text|firestore_query.*ΦΡΕΣΚΟ ID/);
    });
  });
});
