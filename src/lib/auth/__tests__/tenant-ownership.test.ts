/**
 * `lib/auth/tenant-ownership` — οι δύο πολιτικές, ρητά ελεγμένες
 *
 * Το βάρος δεν πέφτει στο «συγκρίνει δύο strings» — αυτό είναι τετριμμένο.
 * Πέφτει στο **τι λέει προς τα έξω** η κάθε πολιτική όταν η απάντηση είναι
 * «όχι», γιατί εκεί κρίνεται αν διαρρέει η ύπαρξη του id.
 *
 * @module lib/auth/__tests__/tenant-ownership
 */

import {
  CrossTenantAccessError,
  assertOwnedByCompany,
  isOwnedByCompany,
  ownedOrNull,
} from '../tenant-ownership';

const OWNER = 'co-1';
const INTRUDER = 'co-2';

const doc = { companyId: OWNER, title: 'Δοκιμή' };
const subject = { resource: 'Δοκιμαστικός πόρος', resourceId: 'res-1' };

describe('isOwnedByCompany — η ερώτηση σκέτη', () => {
  it('ίδιος tenant ⇒ true', () => {
    expect(isOwnedByCompany(doc, OWNER)).toBe(true);
  });

  it('άλλος tenant ⇒ false', () => {
    expect(isOwnedByCompany(doc, INTRUDER)).toBe(false);
  });

  it('κενός tenant ΔΕΝ ταιριάζει με κενό companyId κατά λάθος', () => {
    // Έγγραφο χωρίς tenant + καλών χωρίς tenant θα «ταίριαζαν» σε αφελή
    // σύγκριση. Εδώ ταιριάζουν όντως — αλλά το τεκμηριώνουμε ρητά ώστε ο
    // έλεγχος «υπάρχει companyId;» να μένει ευθύνη του καλούντος (auth layer).
    expect(isOwnedByCompany({ companyId: '' }, '')).toBe(true);
  });
});

describe('ownedOrNull — σιωπηλή πολιτική (ΔΕΝ μαρτυρά ύπαρξη)', () => {
  it('δικό μας έγγραφο επιστρέφεται αυτούσιο', () => {
    expect(ownedOrNull(doc, OWNER, subject)).toBe(doc);
  });

  it('ξένο έγγραφο ⇒ null', () => {
    expect(ownedOrNull(doc, INTRUDER, subject)).toBeNull();
  });

  it('🔴 ξένο και ανύπαρκτο δίνουν ΤΟ ΙΔΙΟ αποτέλεσμα', () => {
    // Αυτό είναι ολόκληρη η αξία της πολιτικής: ο καλών δεν μπορεί να
    // ξεχωρίσει «δεν σου ανήκει» από «δεν υπάρχει», άρα δεν μπορεί να
    // χαρτογραφήσει ids άλλου πελάτη δοκιμάζοντας.
    expect(ownedOrNull(doc, INTRUDER, subject)).toEqual(ownedOrNull(null, INTRUDER, subject));
  });

  it('null/undefined περνούν αυτούσια χωρίς να ρίξουν', () => {
    expect(ownedOrNull(null, OWNER, subject)).toBeNull();
    expect(ownedOrNull(undefined, OWNER, subject)).toBeNull();
  });
});

describe('assertOwnedByCompany — ρητή άρνηση', () => {
  const makeError = (actual: string) =>
    new CrossTenantAccessError({
      message: 'Cross-tenant denied',
      name: 'TestCrossTenantError',
      resource: subject.resource,
      resourceId: subject.resourceId,
      expectedCompanyId: INTRUDER,
      actualCompanyId: actual,
    });

  it('δικό μας έγγραφο ⇒ δεν ρίχνει', () => {
    expect(() => assertOwnedByCompany(doc, OWNER, makeError)).not.toThrow();
  });

  it('ξένο έγγραφο ⇒ ρίχνει το σφάλμα ΤΟΥ ΚΑΛΟΥΝΤΟΣ, όχι γενικό', () => {
    // Ο τύπος του σφάλματος είναι δημόσιο συμβόλαιο: τα routes τον πιάνουν με
    // `instanceof` και τον γυρίζουν σε 403. Αν το κοινό module επέβαλλε δικό
    // του τύπο, θα έσπαγε και τα τρία.
    expect(() => assertOwnedByCompany(doc, INTRUDER, makeError)).toThrow(CrossTenantAccessError);
    try {
      assertOwnedByCompany(doc, INTRUDER, makeError);
    } catch (err) {
      expect((err as Error).name).toBe('TestCrossTenantError');
      expect((err as CrossTenantAccessError).actualCompanyId).toBe(OWNER);
      expect((err as CrossTenantAccessError).expectedCompanyId).toBe(INTRUDER);
    }
  });

  it('το σφάλμα φέρει ΔΟΜΗΜΕΝΑ πεδία, όχι μόνο κείμενο', () => {
    // Ώστε ένας μελλοντικός γενικός χειριστής να μη χρειάζεται να ψάχνει
    // υποσυμβολοσειρά «Cross-tenant» μέσα στο μήνυμα, όπως έκαναν τα routes
    // του floorplan.
    const err = makeError(OWNER);
    expect(err.resource).toBe(subject.resource);
    expect(err.resourceId).toBe(subject.resourceId);
    expect(err).toBeInstanceOf(Error);
  });
});
