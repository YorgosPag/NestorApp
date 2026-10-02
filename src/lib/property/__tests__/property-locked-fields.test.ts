/**
 * ADR-249 · ADR-898 Φ3β-3 — **η ΜΙΑ λίστα κλειδωμάτων**, κοινή για server (403) και πελάτη (πύλη μεταλλάξεων).
 * Ως τώρα ήταν δύο αντίγραφα «keep both in sync»· εδώ κλειδώνεται η συμπεριφορά που είχαν και τα δύο.
 */

import { isFieldLocked, lockedFieldsAttempted, REVERT_ALLOWED_FIELDS, SOLD_LOCKED_FIELDS } from '../property-locked-fields';

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
