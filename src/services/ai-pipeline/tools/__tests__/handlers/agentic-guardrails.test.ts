/**
 * AGENTIC GUARDRAILS — Unit Tests (Google-level)
 *
 * Covers:
 * - isFabricatedContactValue: FIND-F anti-fabrication guardrail
 *   Ensures AI cannot write phone/email values that the user never provided.
 *
 * Test strategy: Exhaustive boundary testing — every edge case that could
 * let a hallucinated value through gets its own test.
 *
 * @see QA_AGENT_FINDINGS.md (FIND-F)
 * @see ADR-263 Section 8
 */

jest.mock('server-only', () => ({}));

import { isFabricatedContactValue, isHallucinatedContactName } from '../../../agentic-guardrails';

describe('isFabricatedContactValue (FIND-F)', () => {
  // ========================================================================
  // PHONE — Fabrication detection
  // ========================================================================

  describe('phone fabrication detection', () => {
    test('should BLOCK phone not mentioned in user message', () => {
      const result = isFabricatedContactValue(
        { fieldType: 'phone', value: '6974050025' },
        'Πρόσθεσε email στον Γιάννη'
      );
      expect(result).toBe(true); // fabricated
    });

    test('should ALLOW phone explicitly mentioned in user message', () => {
      const result = isFabricatedContactValue(
        { fieldType: 'phone', value: '6974050025' },
        'Πρόσθεσε κινητό 6974050025 στον Γιάννη'
      );
      expect(result).toBe(false); // legitimate
    });

    test('should ALLOW phone with spaces in user message', () => {
      const result = isFabricatedContactValue(
        { fieldType: 'phone', value: '6974050025' },
        'Πρόσθεσε κινητό 697 405 0025 στον Γιάννη'
      );
      expect(result).toBe(false);
    });

    test('should ALLOW phone with dashes in user message', () => {
      const result = isFabricatedContactValue(
        { fieldType: 'phone', value: '6974050025' },
        'Τηλέφωνο: 697-405-0025'
      );
      expect(result).toBe(false);
    });

    test('should ALLOW phone with +30 prefix in tool args', () => {
      const result = isFabricatedContactValue(
        { fieldType: 'phone', value: '+306974050025' },
        'Πρόσθεσε κινητό 6974050025'
      );
      expect(result).toBe(false);
    });

    test('should ALLOW phone with +30 prefix in user message', () => {
      const result = isFabricatedContactValue(
        { fieldType: 'phone', value: '6974050025' },
        'Πρόσθεσε κινητό +306974050025'
      );
      expect(result).toBe(false);
    });

    test('should BLOCK similar but different phone number', () => {
      const result = isFabricatedContactValue(
        { fieldType: 'phone', value: '6974050026' },
        'Πρόσθεσε κινητό 6974050025 στον Γιάννη'
      );
      expect(result).toBe(true); // off by one digit
    });

    test('should ALLOW landline number', () => {
      const result = isFabricatedContactValue(
        { fieldType: 'phone', value: '2310123456' },
        'Σταθερό 2310123456'
      );
      expect(result).toBe(false);
    });

    test('should BLOCK when user says "πρόσθεσε τηλέφωνο" without number', () => {
      const result = isFabricatedContactValue(
        { fieldType: 'phone', value: '6912345678' },
        'Πρόσθεσε τηλέφωνο στον Δημήτρη'
      );
      expect(result).toBe(true);
    });
  });

  // ========================================================================
  // EMAIL — Fabrication detection
  // ========================================================================

  describe('email fabrication detection', () => {
    test('should BLOCK email not mentioned in user message', () => {
      const result = isFabricatedContactValue(
        { fieldType: 'email', value: 'info@deddehe.gr' },
        'Πρόσθεσε email στον Γιάννη'
      );
      expect(result).toBe(true); // fabricated — FIND-F exact scenario
    });

    test('should ALLOW email explicitly mentioned in user message', () => {
      const result = isFabricatedContactValue(
        { fieldType: 'email', value: 'nikos@example.com' },
        'Πρόσθεσε email nikos@example.com στον Νίκο'
      );
      expect(result).toBe(false);
    });

    test('should ALLOW email case-insensitive match', () => {
      const result = isFabricatedContactValue(
        { fieldType: 'email', value: 'Nikos@Example.com' },
        'email nikos@example.com'
      );
      expect(result).toBe(false);
    });

    test('should BLOCK email that looks similar but is different', () => {
      const result = isFabricatedContactValue(
        { fieldType: 'email', value: 'nikos@exampl.com' },
        'Πρόσθεσε email nikos@example.com'
      );
      expect(result).toBe(true); // typo in domain — different email
    });

    test('should BLOCK when user says "βάλε email" without address', () => {
      const result = isFabricatedContactValue(
        { fieldType: 'email', value: 'contact@company.gr' },
        'Βάλε email στον Δημήτρη'
      );
      expect(result).toBe(true);
    });

    test('should ALLOW email with surrounding text', () => {
      const result = isFabricatedContactValue(
        { fieldType: 'email', value: 'test@test.gr' },
        'Κινητό 6988111222 και email test@test.gr'
      );
      expect(result).toBe(false);
    });
  });

  // ========================================================================
  // NON-PHONE/EMAIL — Should pass through (no check)
  // ========================================================================

  describe('non-phone/email fields (passthrough)', () => {
    test('should NOT check social media (fieldType=social)', () => {
      const result = isFabricatedContactValue(
        { fieldType: 'social', value: '@nikos_instagram' },
        'Πρόσθεσε κάτι'
      );
      expect(result).toBe(false); // not checked
    });

    test('should NOT check when fieldType is missing', () => {
      const result = isFabricatedContactValue(
        { value: '6974050025' },
        'Πρόσθεσε κινητό'
      );
      expect(result).toBe(false); // no fieldType → passthrough
    });

    test('should NOT check when value is empty', () => {
      const result = isFabricatedContactValue(
        { fieldType: 'phone', value: '' },
        'Πρόσθεσε τηλέφωνο'
      );
      expect(result).toBe(false); // empty value → passthrough (handler validates)
    });
  });

  // ========================================================================
  // EDGE CASES
  // ========================================================================

  describe('edge cases', () => {
    test('should handle phone with parentheses in user message', () => {
      const result = isFabricatedContactValue(
        { fieldType: 'phone', value: '2310123456' },
        'Τηλ: (2310) 123456'
      );
      expect(result).toBe(false);
    });

    test('should handle phone in message with mixed content', () => {
      const result = isFabricatedContactValue(
        { fieldType: 'phone', value: '6977888999' },
        'Ο Νίκος, τηλ 6977888999, δουλεύει στη ΔΕΔΔΗΕ'
      );
      expect(result).toBe(false);
    });

    test('should handle message with multiple numbers — correct one', () => {
      const result = isFabricatedContactValue(
        { fieldType: 'phone', value: '6971111111' },
        'Κινητό 6971111111, σταθερό 2310222222'
      );
      expect(result).toBe(false);
    });

    test('should handle message with multiple numbers — fabricated', () => {
      const result = isFabricatedContactValue(
        { fieldType: 'phone', value: '6973333333' },
        'Κινητό 6971111111, σταθερό 2310222222'
      );
      expect(result).toBe(true); // not in message
    });

    test('should handle Greek accented text in message', () => {
      const result = isFabricatedContactValue(
        { fieldType: 'email', value: 'dimitris@test.gr' },
        'Πρόσθεσε email dimitris@test.gr στον Δημήτρη'
      );
      expect(result).toBe(false);
    });
  });
});

// ==========================================================================
// isHallucinatedContactName — Anti-hallucination with Greek stem matching
// ==========================================================================

describe('isHallucinatedContactName', () => {
  const contextWithGreekInvoice = [
    '[Ανάλυση Εγγράφου: invoice.pdf] Τύπος: receipt',
    'Περίληψη: Απόδειξη παροχής υπηρεσιών από τον Γραβάνη Αχιλλέα Γεώργιο.',
    'Πρόσωπα/Εταιρείες: Γραβάνη Αχιλλέα Γεώργιο, Παπαδόπουλος Αβραάμ',
  ];

  // ========================================================================
  // Greek declension matching (stem-based)
  // ========================================================================

  describe('Greek declension stem matching', () => {
    test('should ALLOW nominative when context has genitive (Γραβάνης↔Γραβάνη)', () => {
      const result = isHallucinatedContactName(
        { contactType: 'individual', firstName: 'Αχιλλέας', lastName: 'Γραβάνης' },
        contextWithGreekInvoice
      );
      expect(result).toBe(false); // stems αχιλλε + γραβαν match
    });

    test('should ALLOW ancient Greek form (Αχίλλευς↔Αχιλλέα)', () => {
      const result = isHallucinatedContactName(
        { contactType: 'individual', firstName: 'Αχίλλευς', lastName: 'Γραβάνης' },
        contextWithGreekInvoice
      );
      expect(result).toBe(false); // stem αχιλλε matches αχιλλεα
    });

    test('should ALLOW exact name from context (Παπαδόπουλος Αβραάμ)', () => {
      const result = isHallucinatedContactName(
        { contactType: 'individual', firstName: 'Αβραάμ', lastName: 'Παπαδόπουλος' },
        contextWithGreekInvoice
      );
      expect(result).toBe(false);
    });

    test('should ALLOW genitive lastName (Παπαδοπούλου)', () => {
      const result = isHallucinatedContactName(
        { contactType: 'individual', firstName: 'Αβραάμ', lastName: 'Παπαδοπούλου' },
        contextWithGreekInvoice
      );
      expect(result).toBe(false); // stem παπαδοπουλ matches
    });
  });

  // ========================================================================
  // Hallucination blocking
  // ========================================================================

  describe('hallucination blocking', () => {
    test('should BLOCK completely fabricated name', () => {
      const result = isHallucinatedContactName(
        { contactType: 'individual', firstName: 'Μελχισεδέκ', lastName: 'Παυάρος' },
        contextWithGreekInvoice
      );
      expect(result).toBe(true);
    });

    test('should BLOCK "Συναλλασσόμενος" as surname (not a real name)', () => {
      const result = isHallucinatedContactName(
        { contactType: 'individual', firstName: 'Γεώργιος', lastName: 'Συναλλασσόμενος' },
        contextWithGreekInvoice
      );
      expect(result).toBe(true); // Συναλλασσομεν not in context
    });

    test('should BLOCK when firstName matches but lastName is fabricated', () => {
      const result = isHallucinatedContactName(
        { contactType: 'individual', firstName: 'Αχιλλέας', lastName: 'Ξενοφώντος' },
        contextWithGreekInvoice
      );
      expect(result).toBe(true); // lastName ξενοφωντ not in context
    });
  });

  // ========================================================================
  // Company contacts
  // ========================================================================

  describe('company contacts', () => {
    test('should ALLOW company name in context', () => {
      const result = isHallucinatedContactName(
        { contactType: 'company', companyName: 'Γραβάνης' },
        contextWithGreekInvoice
      );
      expect(result).toBe(false);
    });

    test('should BLOCK fabricated company name', () => {
      const result = isHallucinatedContactName(
        { contactType: 'company', companyName: 'Κοσμοτέλεια ΑΕ' },
        contextWithGreekInvoice
      );
      expect(result).toBe(true);
    });
  });

  // ========================================================================
  // Edge cases
  // ========================================================================

  describe('edge cases', () => {
    test('should ALLOW when both names are very short (≤2 chars)', () => {
      const result = isHallucinatedContactName(
        { contactType: 'individual', firstName: 'Αβ', lastName: 'Γδ' },
        contextWithGreekInvoice
      );
      expect(result).toBe(false); // too short to check
    });

    test('should ALLOW when no name parts provided', () => {
      const result = isHallucinatedContactName(
        { contactType: 'individual' },
        contextWithGreekInvoice
      );
      expect(result).toBe(false); // nothing to check
    });

    test('should handle empty conversation context', () => {
      const result = isHallucinatedContactName(
        { contactType: 'individual', firstName: 'Νίκος', lastName: 'Παπαδόπουλος' },
        []
      );
      expect(result).toBe(true); // no context = hallucination
    });
  });
});
