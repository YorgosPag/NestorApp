/**
 * ADR-249 · ADR-898 Φ3β-3 — **η ΜΙΑ λίστα κλειδωμάτων**, κοινή για server (403) και πελάτη (πύλη μεταλλάξεων).
 * Ως τώρα ήταν δύο αντίγραφα «keep both in sync»· εδώ κλειδώνεται η συμπεριφορά που είχαν και τα δύο.
 */

import {
  isFieldLocked,
  judgeLockedFields,
  lockedFieldsAttempted,
  REVERT_ALLOWED_FIELDS,
  SOLD_LOCKED_FIELDS,
} from '../property-locked-fields';

describe('lockedFieldsAttempted', () => {
  it('πουλημένο ή μισθωμένο ⇒ όλη η λίστα πώλησης· επιστρέφει μόνο ό,τι επιχειρήθηκε', () => {
    for (const status of ['sold', 'rented']) {
      expect(lockedFieldsAttempted(status, ['areas', 'description', 'levelData'])).toEqual(['areas', 'levelData']);
    }
  });

  it('κρατημένο ⇒ μόνο η ταυτότητα (code · type · name)', () => {
    expect(lockedFieldsAttempted('reserved', ['name', 'areas', 'type'])).toEqual(['type', 'name']);
  });

  it('ελεύθερο / χωρίς κατάσταση ⇒ τίποτα', () => {
    expect(lockedFieldsAttempted('for-sale', [...SOLD_LOCKED_FIELDS])).toEqual([]);
    expect(lockedFieldsAttempted(null, ['name'])).toEqual([]);
    expect(lockedFieldsAttempted(undefined, ['name'])).toEqual([]);
  });

  it('οι δηλώσεις της αντικειμενικής κλειδώνουν σε πώληση/μίσθωση (φυσικά στοιχεία), όχι σε κράτηση', () => {
    expect(isFieldLocked('sold', 'objectiveValueDeclarations')).toBe(true);
    expect(isFieldLocked('rented', 'objectiveValueDeclarations')).toBe(true);
    expect(isFieldLocked('reserved', 'objectiveValueDeclarations')).toBe(false);
    expect(isFieldLocked('for-sale', 'objectiveValueDeclarations')).toBe(false);
  });

  it('η ακύρωση συναλλαγής αλλάζει μόνο κατάσταση + εμπορικά', () => {
    expect([...REVERT_ALLOWED_FIELDS].sort()).toEqual(['commercial', 'commercialStatus']);
  });
});

/** ⚓ ADR-249 §7 — κλείδωμα κατά ΑΛΛΑΓΗ ΤΙΜΗΣ, όχι κατά παρουσία κλειδιού (AIP-203 IMMUTABLE). */
describe('judgeLockedFields', () => {
  const stored = { name: 'ΔΟΚΙΜΗ Ε', code: 'T-E-1.01', areas: { gross: 80, terrace: 0 }, commercialStatus: 'sold' };
  const asDocument = { kind: 'document', values: stored } as const;

  it('🔴 Κ1 — κλειδωμένο πεδίο με την ΙΔΙΑ τιμή ⇒ αμετάβλητο (αγνοείται), όχι άρνηση', () => {
    expect(judgeLockedFields('sold', { name: 'ΔΟΚΙΜΗ Ε', code: 'T-E-1.01' }, asDocument)).toEqual({
      changed: [],
      unchanged: ['code', 'name'],
    });
  });

  it('Κ2 — κλειδωμένο πεδίο με ΑΛΛΗ τιμή ⇒ αλλαγή (⇒ 403 / άρνηση στον πελάτη)', () => {
    expect(judgeLockedFields('sold', { name: 'Άλλο' }, asDocument)).toEqual({ changed: ['name'], unchanged: [] });
  });

  it('Κ3 — η ισότητα είναι του ΕΝΟΣ κριτή: `terrace: 0` ≡ απουσία ⇒ ίδια εμβαδά', () => {
    expect(judgeLockedFields('sold', { areas: { gross: 80 } }, asDocument).unchanged).toEqual(['areas']);
  });

  it('Κ4 — `document`: πεδίο που λείπει από το έγγραφο ΕΙΝΑΙ «δεν δηλώθηκε» ⇒ `null` πάνω του = αμετάβλητο', () => {
    expect(judgeLockedFields('sold', { condition: null }, asDocument)).toEqual({ changed: [], unchanged: ['condition'] });
  });

  it('🔴 Κ5 — `partial`: πεδίο που ΔΕΝ δόθηκε είναι ΑΓΝΩΣΤΟ ⇒ κρίνεται αλλαγή (fail-closed), ακόμη και με `null`', () => {
    const partial = { kind: 'partial', values: { commercialStatus: 'sold' } } as const;
    expect(judgeLockedFields('sold', { name: 'ΔΟΚΙΜΗ Ε', condition: null }, partial)).toEqual({
      changed: ['name', 'condition'],
      unchanged: [],
    });
    const known = { kind: 'partial', values: { name: 'ΔΟΚΙΜΗ Ε' } } as const;
    expect(judgeLockedFields('sold', { name: 'ΔΟΚΙΜΗ Ε' }, known)).toEqual({ changed: [], unchanged: ['name'] });
  });

  it('Κ6 — μη κλειδωμένα πεδία και μη κλειδωμένες καταστάσεις ⇒ ούτε στη μία λίστα ούτε στην άλλη', () => {
    expect(judgeLockedFields('sold', { description: 'νέα' }, asDocument)).toEqual({ changed: [], unchanged: [] });
    expect(judgeLockedFields('for-sale', { name: 'Άλλο' }, asDocument)).toEqual({ changed: [], unchanged: [] });
    expect(judgeLockedFields(null, { name: 'Άλλο' }, asDocument)).toEqual({ changed: [], unchanged: [] });
  });

  it('Κ7 — κρατημένο: κρίνεται μόνο η ταυτότητα· τα εμβαδά περνούν ελεύθερα', () => {
    expect(judgeLockedFields('reserved', { name: 'Άλλο', areas: { gross: 99 } }, asDocument)).toEqual({
      changed: ['name'],
      unchanged: [],
    });
  });
});
