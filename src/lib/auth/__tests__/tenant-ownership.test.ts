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
  concealCrossTenant,
  isOwnedByCompany,
  isPayloadOwnedByCompany,
  ownedOrNull,
} from '../tenant-ownership';

const OWNER = 'co-1';
const INTRUDER = 'co-2';

/** Ο μόνος ρόλος με `isBypass: true` στο `PREDEFINED_ROLES`. */
const BYPASS_ROLE = 'super_admin';
const NORMAL_ROLE = 'company_admin';

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

describe('isPayloadOwnedByCompany — η ερώτηση για ωμό payload βάσης', () => {
  it('ίδιος tenant ⇒ true', () => {
    expect(isPayloadOwnedByCompany({ companyId: OWNER }, OWNER)).toBe(true);
  });

  it('άλλος tenant ⇒ false', () => {
    expect(isPayloadOwnedByCompany({ companyId: OWNER }, INTRUDER)).toBe(false);
  });

  it('🔴 έγγραφο ΧΩΡΙΣ companyId δεν ανήκει σε κανέναν (ADR-232)', () => {
    // Έγγραφα του υπεργραφείου έχουν companyId null/undefined. Κανονικός
    // χρήστης ΔΕΝ πρέπει να τα αγγίζει· ο bypass ρόλος κρίνεται αλλού.
    expect(isPayloadOwnedByCompany({}, OWNER)).toBe(false);
    expect(isPayloadOwnedByCompany({ companyId: null }, OWNER)).toBe(false);
    expect(isPayloadOwnedByCompany({ companyId: undefined }, OWNER)).toBe(false);
  });

  it('🔴 ΤΟ ΠΡΑΓΜΑΤΙΚΟ ΣΦΑΛΜΑ: δύο κενά ΔΕΝ ταιριάζουν', () => {
    // Αυτό ακριβώς απαντούσε `true` στις τέσσερις χειρόγραφες υλοποιήσεις που
    // έγραφαν σκέτο `a.companyId === b.companyId`: καλών με χαλασμένο token
    // (companyId: '') έβλεπε κάθε έγγραφο που είχε επίσης κενό companyId.
    // Το κενό είναι ΑΠΟΥΣΙΑ tenant, όχι tenant που τυχαίνει να ταιριάζει.
    expect(isPayloadOwnedByCompany({ companyId: '' }, '')).toBe(false);
    expect(isPayloadOwnedByCompany({ companyId: OWNER }, '')).toBe(false);
    expect(isPayloadOwnedByCompany({ companyId: '' }, OWNER)).toBe(false);
  });

  it('ανύπαρκτο έγγραφο ⇒ false, χωρίς ρίψη', () => {
    expect(isPayloadOwnedByCompany(null, OWNER)).toBe(false);
    expect(isPayloadOwnedByCompany(undefined, OWNER)).toBe(false);
  });

  it('συμφωνεί με την isOwnedByCompany όποτε το companyId όντως υπάρχει', () => {
    // Οι δύο μορφές πρέπει να λένε ΤΟ ΙΔΙΟ στο κοινό τους πεδίο ορισμού —
    // αλλιώς η «μία ερώτηση» θα ήταν δύο.
    for (const [docCo, caller] of [
      [OWNER, OWNER],
      [OWNER, INTRUDER],
      [INTRUDER, OWNER],
    ] as const) {
      expect(isPayloadOwnedByCompany({ companyId: docCo }, caller)).toBe(
        isOwnedByCompany({ companyId: docCo }, caller),
      );
    }
  });
});

describe('concealCrossTenant — η απόφαση αποκάλυψης', () => {
  const spec = { reveal: () => 'ΑΛΗΘΕΙΑ' as const, conceal: () => 'ΣΙΩΠΗ' as const };

  it('κανονικός χρήστης ⇒ σιωπή', () => {
    expect(concealCrossTenant(NORMAL_ROLE, spec)).toBe('ΣΙΩΠΗ');
  });

  it('bypass ρόλος ⇒ αλήθεια (κερδίζει τη διάγνωση, δεν χάνει τίποτα)', () => {
    expect(concealCrossTenant(BYPASS_ROLE, spec)).toBe('ΑΛΗΘΕΙΑ');
  });

  it('άγνωστος/κενός ρόλος ⇒ σιωπή (fail closed)', () => {
    // Ένας ρόλος που δεν υπάρχει στο μητρώο δεν είναι bypass. Η ασφαλής
    // προεπιλογή είναι να ΜΗΝ αποκαλύψεις.
    expect(concealCrossTenant('', spec)).toBe('ΣΙΩΠΗ');
    expect(concealCrossTenant('ρόλος-που-δεν-υπάρχει', spec)).toBe('ΣΙΩΠΗ');
  });

  it('🔴 καλείται ΜΟΝΟ ο ένας κλάδος — ο άλλος δεν εκτελείται καν', () => {
    // Κρίσιμο: ο κλάδος `reveal` μπορεί να χτίζει μήνυμα με ξένα δεδομένα.
    // Αν εκτελούνταν και για κανονικό χρήστη, η διαρροή θα γινόταν πριν καν
    // αποφασίσουμε να σιωπήσουμε (π.χ. μέσω logging μέσα στον constructor).
    const reveal = jest.fn(() => 'ΑΛΗΘΕΙΑ');
    const conceal = jest.fn(() => 'ΣΙΩΠΗ');

    concealCrossTenant(NORMAL_ROLE, { reveal, conceal });
    expect(reveal).not.toHaveBeenCalled();
    expect(conceal).toHaveBeenCalledTimes(1);

    concealCrossTenant(BYPASS_ROLE, { reveal, conceal });
    expect(reveal).toHaveBeenCalledTimes(1);
    expect(conceal).toHaveBeenCalledTimes(1);
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

  // ─── Η παγίδα του κενού, στο μονοπάτι της ρητής άρνησης (ADR-742 §4) ───────
  //
  // 🔴 Η Φάση Α έκλεισε αυτή την τρύπα **μόνο** στο σιωπηλό μονοπάτι
  // (`isPayloadOwnedByCompany` → οι έξι `require*InTenant`). Η `assertOwnedByCompany`
  // συνέχιζε να ρωτά με σκέτο `===`, ενώ **και οι τέσσερις** καλούντες της της
  // δίνουν `snap.data() as XDoc`: ο τύπος υπόσχεται `companyId: string`, η βάση
  // δεν το εγγυάται. Το βρήκε ο έλεγχος του υποβάθρου στη Φάση Β.
  describe('🔴 κενό companyId — «απουσία tenant», ποτέ «tenant που ταιριάζει»', () => {
    it('καλών με χαλασμένο token (companyId: "") ΔΕΝ περνά σε έγγραφο με κενό companyId', () => {
      expect(() => assertOwnedByCompany({ companyId: '' }, '', makeError)).toThrow(
        CrossTenantAccessError,
      );
    });

    it('έγγραφο υπεργραφείου (companyId: null, ADR-232) ΔΕΝ ανήκει σε κανονικό χρήστη', () => {
      expect(() => assertOwnedByCompany({ companyId: null }, OWNER, makeError)).toThrow(
        CrossTenantAccessError,
      );
    });

    it('έγγραφο χωρίς καθόλου companyId ΔΕΝ ανήκει σε κανέναν', () => {
      expect(() => assertOwnedByCompany({}, OWNER, makeError)).toThrow(CrossTenantAccessError);
    });

    it('καλών με κενό companyId ΔΕΝ περνά ούτε σε κανονικό έγγραφο', () => {
      expect(() => assertOwnedByCompany({ companyId: OWNER }, '', makeError)).toThrow(
        CrossTenantAccessError,
      );
    });

    it('το σφάλμα αναφέρει κενό ιδιοκτήτη αντί για `undefined`', () => {
      try {
        assertOwnedByCompany({}, OWNER, makeError);
      } catch (err) {
        expect((err as CrossTenantAccessError).actualCompanyId).toBe('');
      }
      expect.assertions(1);
    });
  });
});
