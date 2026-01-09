/**
 * 🏢 ENTERPRISE SEARCH TESTS
 *
 * Κλειδώνουμε τα κρίσιμα edge cases για Greek-friendly search
 * Based on local_4.log requirements (lines 156-169)
 */

import { normalizeSearchText, matchesSearchTerm } from './search';

describe('Enterprise Search - normalizeSearchText', () => {
  // Test 1: Τόνοι - "Αλέξης" matches "Αλεξης"
  test('removes Greek diacritics (τόνους)', () => {
    expect(normalizeSearchText('Αλέξης')).toBe('αλεξησ');
    expect(normalizeSearchText('Γιώργος')).toBe('γιωργοσ');
    expect(normalizeSearchText('Μαρία')).toBe('μαρια');
    expect(normalizeSearchText('ΆΝΝΑ')).toBe('αννα');
  });

  // Test 2: ς/σ - "κόσμος" matches "κοσμοσ"
  test('normalizes final sigma (ς → σ)', () => {
    expect(normalizeSearchText('κόσμος')).toBe('κοσμοσ');
    expect(normalizeSearchText('Αλέξης')).toBe('αλεξησ');
    expect(normalizeSearchText('πατέρας')).toBe('πατερασ');
    expect(normalizeSearchText('ΚΟΣΜΟΣ')).toBe('κοσμος'); // Capital Σ doesn't have final form
  });

  // Test 3: null/undefined - δεν πετάει και απλά αγνοεί
  test('handles null/undefined safely', () => {
    expect(normalizeSearchText(null)).toBe('');
    expect(normalizeSearchText(undefined)).toBe('');
    expect(() => normalizeSearchText(null)).not.toThrow();
    expect(() => normalizeSearchText(undefined)).not.toThrow();
  });

  // Test 4: number - 3 matches "3"
  test('converts numbers to strings', () => {
    expect(normalizeSearchText(3)).toBe('3');
    expect(normalizeSearchText(42)).toBe('42');
    expect(normalizeSearchText(3.14)).toBe('3.14');
    expect(normalizeSearchText(0)).toBe('0');
    expect(normalizeSearchText(-5)).toBe('-5');
  });

  // Test 5: Boolean values
  test('converts booleans to strings', () => {
    expect(normalizeSearchText(true)).toBe('true');
    expect(normalizeSearchText(false)).toBe('false');
  });

  // Test 6: Date values
  test('converts dates to ISO strings', () => {
    const date = new Date('2025-01-09T10:30:00Z');
    expect(normalizeSearchText(date)).toContain('2025-01-09');
  });

  // Test 7: Whitespace normalization
  test('normalizes whitespace', () => {
    expect(normalizeSearchText('  hello   world  ')).toBe('hello world');
    expect(normalizeSearchText('\t\ntest\r\n')).toBe('test');
    expect(normalizeSearchText('multiple   spaces')).toBe('multiple spaces');
  });

  // Test 8: Latin diacritics
  test('removes Latin diacritics', () => {
    expect(normalizeSearchText('café')).toBe('cafe');
    expect(normalizeSearchText('naïve')).toBe('naive');
    expect(normalizeSearchText('résumé')).toBe('resume');
  });
});

describe('Enterprise Search - matchesSearchTerm', () => {
  // Test 1: Greek matching with τόνους
  test('matches Greek text ignoring diacritics', () => {
    const fields = ['Αλέξης Παπαδόπουλος', 'Διαμέρισμα 3Α', 'Οδός Αθηνάς'];

    expect(matchesSearchTerm(fields, 'Αλεξης')).toBe(true);  // Without tonos
    expect(matchesSearchTerm(fields, 'αλεξησ')).toBe(true);  // Lowercase with final sigma
    expect(matchesSearchTerm(fields, 'αλέξης')).toBe(true);  // With tonos
    expect(matchesSearchTerm(fields, 'παπαδοπουλοσ')).toBe(true); // Final sigma normalized
    expect(matchesSearchTerm(fields, 'Αθηνασ')).toBe(true);  // ς vs σ
  });

  // Test 2: Numeric field matching
  test('matches numeric fields with string search', () => {
    const fields = ['Apartment', 3, 'Building A', 25.5];

    expect(matchesSearchTerm(fields, '3')).toBe(true);
    expect(matchesSearchTerm(fields, '25.5')).toBe(true);
    expect(matchesSearchTerm(fields, '25')).toBe(true); // Partial match
  });

  // Test 3: Empty/whitespace term returns true (match-all)
  test('empty search term matches everything', () => {
    const fields = ['test', 'data'];

    expect(matchesSearchTerm(fields, '')).toBe(true);
    expect(matchesSearchTerm(fields, '  ')).toBe(true);
    expect(matchesSearchTerm(fields, '\t\n')).toBe(true);
  });

  // Test 4: Null/undefined field handling
  test('handles null/undefined fields safely', () => {
    const fields = ['valid', null, undefined, 'text'];

    expect(() => matchesSearchTerm(fields, 'test')).not.toThrow();
    expect(matchesSearchTerm(fields, 'valid')).toBe(true);
    expect(matchesSearchTerm(fields, 'text')).toBe(true);
  });

  // Test 5: Mixed field types
  test('handles mixed field types correctly', () => {
    const fields = [
      'Γιώργος',
      42,
      true,
      null,
      undefined,
      new Date('2025-01-09T10:00:00Z'),
      'Διαμέρισμα'
    ];

    expect(matchesSearchTerm(fields, 'Γιωργος')).toBe(true);  // Greek without tonos
    expect(matchesSearchTerm(fields, '42')).toBe(true);       // Number
    expect(matchesSearchTerm(fields, 'true')).toBe(true);     // Boolean
    expect(matchesSearchTerm(fields, '2025')).toBe(true);     // Date partial
    expect(matchesSearchTerm(fields, 'διαμερισμα')).toBe(true); // Case insensitive
  });

  // Test 6: No match cases
  test('returns false when no fields match', () => {
    const fields = ['apple', 'banana', 'orange'];

    expect(matchesSearchTerm(fields, 'grape')).toBe(false);
    expect(matchesSearchTerm(fields, 'xyz')).toBe(false);
  });

  // Test 7: Partial matching
  test('supports partial matching within fields', () => {
    const fields = ['Αλέξανδρος Μεγαλόπουλος', 'Θεσσαλονίκη'];

    expect(matchesSearchTerm(fields, 'Αλεξ')).toBe(true);    // Partial first name
    expect(matchesSearchTerm(fields, 'Μεγαλο')).toBe(true);  // Partial last name
    expect(matchesSearchTerm(fields, 'σαλον')).toBe(true);   // Middle of word
  });

  // Test 8: Array flattening (emails/phones)
  test('handles flattened arrays correctly', () => {
    const fields = [
      'John Doe',
      'john@example.com',
      'jane@example.com',
      '+30 210 1234567',
      '+30 697 9876543'
    ];

    expect(matchesSearchTerm(fields, 'john')).toBe(true);    // Name or email
    expect(matchesSearchTerm(fields, 'example')).toBe(true); // Email domain
    expect(matchesSearchTerm(fields, '210')).toBe(true);     // Phone area code
    expect(matchesSearchTerm(fields, '697')).toBe(true);     // Mobile prefix
  });
});

describe('Enterprise Search - Edge Cases', () => {
  test('very long strings are handled efficiently', () => {
    const longText = 'Lorem ipsum '.repeat(1000);
    const fields = [longText];

    expect(() => matchesSearchTerm(fields, 'ipsum')).not.toThrow();
    expect(matchesSearchTerm(fields, 'ipsum')).toBe(true);
  });

  test('special characters in search term', () => {
    const fields = ['user@example.com', 'Price: €50', 'Floor #3'];

    expect(matchesSearchTerm(fields, '@')).toBe(true);
    expect(matchesSearchTerm(fields, '€')).toBe(true);
    expect(matchesSearchTerm(fields, '#3')).toBe(true);
  });

  test('unicode emoji handling', () => {
    const fields = ['Hello 👋', 'Office 🏢'];

    expect(() => matchesSearchTerm(fields, '👋')).not.toThrow();
    expect(matchesSearchTerm(fields, 'Hello')).toBe(true);
  });
});