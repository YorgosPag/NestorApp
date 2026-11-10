/**
 * ISO 11649 (RF) — απέναντι στο ΔΗΜΟΣΙΕΥΜΕΝΟ παράδειγμα (RF18 5390 0754 7034), όχι απέναντι στον εαυτό του.
 * @see ADR-ACC-018 §15
 */

import {
  buildCreditorReference,
  creditorReferenceBody,
  findCreditorReferences,
  formatCreditorReference,
  isValidCreditorReference,
} from '../creditor-reference';

describe('buildCreditorReference', () => {
  it('δίνει το δημοσιευμένο RF18 για το σώμα 539007547034', () => {
    expect(buildCreditorReference('539007547034')).toBe('RF18539007547034');
  });

  it('κεφαλαία + χωρίς κενά πριν από τον υπολογισμό', () => {
    expect(buildCreditorReference('5390 0754 7034')).toBe('RF18539007547034');
  });

  it('αρνείται (null) σώμα εκτός 1–21 λατινικών αλφαριθμητικών — ποτέ κόψιμο', () => {
    expect(buildCreditorReference('')).toBeNull();
    expect(buildCreditorReference('A'.repeat(22))).toBeNull();
    expect(buildCreditorReference('ΑΒΓ123')).toBeNull();
    expect(buildCreditorReference('A-123')).toBeNull();
  });

  it('κάθε παραγόμενο RF περνά τον έλεγχο, και το σώμα επιστρέφει αυτούσιο', () => {
    for (const body of ['A000000001', 'CREDIT000000042', 'Z9', '000000000000000000001']) {
      const rf = buildCreditorReference(body);
      expect(rf).not.toBeNull();
      expect(isValidCreditorReference(rf ?? '')).toBe(true);
      expect(creditorReferenceBody(rf ?? '')).toBe(body);
    }
  });
});

describe('isValidCreditorReference', () => {
  it('δέχεται τη μορφή εκτύπωσης με κενά', () => {
    expect(isValidCreditorReference('RF18 5390 0754 7034')).toBe(true);
  });

  it('απορρίπτει λάθος ψηφία ελέγχου, ένα πειραγμένο ψηφίο και λάθος πρόθεμα', () => {
    expect(isValidCreditorReference('RF19539007547034')).toBe(false);
    expect(isValidCreditorReference('RF18539007547035')).toBe(false);
    expect(isValidCreditorReference('RX18539007547034')).toBe(false);
  });
});

describe('formatCreditorReference', () => {
  it('ομάδες των 4', () => {
    expect(formatCreditorReference('RF18539007547034')).toBe('RF18 5390 0754 7034');
  });
});

describe('findCreditorReferences', () => {
  it('βρίσκει RF με κενά μέσα σε αιτιολογία τράπεζας', () => {
    expect(findCreditorReferences('ΠΛΗΡΩΜΗ ΤΙΜΟΛΟΓΙΟΥ RF18 5390 0754 7034 ΕΥΧΑΡΙΣΤΩ')).toEqual(['RF18539007547034']);
  });

  it('κρατά το μακρύτερο έγκυρο πρόθεμα όταν η τράπεζα κολλά κείμενο αμέσως μετά', () => {
    expect(findCreditorReferences('rf18539007547034 INV')).toEqual(['RF18539007547034']);
  });

  it('αγνοεί RF που δεν περνά τον έλεγχο ψηφίων — κανένα ψευδώς θετικό', () => {
    expect(findCreditorReferences('RF19539007547034')).toEqual([]);
  });

  it('δεν πιάνει «RF» μέσα σε λέξη', () => {
    expect(findCreditorReferences('XRF18539007547034')).toEqual([]);
  });
});
