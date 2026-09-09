/**
 * Άγκυρα — **ΚΑΘΕ ΣΚΕΛΟΣ ΤΗΣ ΕΜΒΕΛΕΙΑΣ ΕΠΙΒΙΩΝΕΙ ΤΗΣ ΔΙΑΔΡΟΜΗΣ ΠΡΟΣ ΤΟΝ ΔΙΣΚΟ**
 *
 * ## Το περιστατικό που τη γέννησε
 *
 * 🔴 **2026-09-08, ζωντανό περπάτημα της Φάσης 2.** Δήλωσα «30 χλμ γύρω από αυτό το
 * σημείο», πάτησα **Ενημέρωση βιτρίνας**, και η δημόσια βιτρίνα εμφάνισε
 * **«Περιοχή δραστηριότητας: Δεν δηλώθηκε»**.
 *
 * Κανένα σφάλμα, πουθενά: ο τύπος δεχόταν το σκέλος, το `zod` του γραφέα το δεχόταν, ο
 * `resolveCoverage` το επαλήθευε, το `toStoredShowcase` το έγραφε. **Ο αναγνώστης
 * (`readCoverage`) δεν το ήξερε** και επέστρεφε `null` — δηλαδή η δήλωση του ανθρώπου
 * έσβηνε στο **τελευταίο** βήμα.
 *
 * ⚠️ **Το αρχείο το είχε ΠΡΟΒΛΕΨΕΙ ΚΑΤΑ ΛΕΞΗ**, λίγες γραμμές πιο κάτω από τη βλάβη:
 * *«μια αλλαγή στον έναν και όχι στον άλλο θα έγραφε σχήμα που ο αναγνώστης απορρίπτει
 * — δηλαδή **βιτρίνα που εξαφανίζεται τη στιγμή που δημοσιεύεται**, με πράσινο τον
 * γραφέα»*. Η πρόβλεψη ήταν σωστή· **δεν υπήρχε πύλη να τη φυλάξει**.
 *
 * ## Τι φυλάει
 *
 * ✅ **Πλήρη διαδρομή** `PublicShowcase → toStoredShowcase → readShowcase`, για **κάθε**
 *    σκέλος της κλειστής ένωσης. Νέο σκέλος χωρίς αναγνώστη ⇒ **κόκκινο εδώ**.
 * ✅ Ότι ο αναγνώστης **επιβάλλει το κλειστό σύνολο ακτίνων** — ένα χειρόγραφο
 *    `radiusKm: 500` στη βάση θα ανάσταινε την απαγόρευση #6 από την πίσω πόρτα.
 *
 * ⛔ **ΔΕΝ** ελέγχει τον κριτή *(δύο άλλα αρχεία)* ούτε τον γραφέα — μόνο ότι ό,τι
 *    γράφεται **ξαναδιαβάζεται ίδιο**.
 *
 * @module lib/agency/__tests__/coverage-round-trip
 * @see ADR-846 §Φ2 · `lib/agency/showcase-read.ts`
 */

import { readShowcase, toStoredShowcase } from '../showcase-read';
import { showcaseFixture } from '../__fixtures__/showcase-fixture';
import type { DeclaredCoverage } from '@/types/agency-coverage';
import { MAX_PRESENCE_AREAS } from '@/types/agency-profile';

const COMPANY = 'comp_round_trip';

/**
 * Ό,τι διαβάζει ο κόσμος από ό,τι γράφτηκε.
 *
 * ⚠️ Πετά όταν το έγγραφο κριθεί **αδιάβαστο** — μια σιωπηλή `null` επιστροφή εδώ θα
 * έκανε κάθε αρνητικό έλεγχο παρακάτω να περνά **για λάθος λόγο**.
 */
function readBack(stored: Record<string, unknown>): DeclaredCoverage | null {
  const read = readShowcase(stored, COMPANY);
  if (read.outcome !== 'showcase') {
    throw new Error(`Περίμενα showcase, πήρα ${read.outcome}`);
  }
  return read.showcase.coverage;
}

/** Ό,τι δηλώνει ο άνθρωπος → ό,τι διαβάζει ο κόσμος. Η **ολόκληρη** διαδρομή. */
function roundTrip(coverage: DeclaredCoverage | null): DeclaredCoverage | null {
  return readBack(toStoredShowcase(showcaseFixture({ companyId: COMPANY, coverage })));
}

/** Έγγραφο με **χειρόγραφο** `coverage` — ό,τι θα μπορούσε να ζει ήδη στη βάση. */
function storedWithCoverage(coverage: unknown): Record<string, unknown> {
  return {
    ...toStoredShowcase(showcaseFixture({ companyId: COMPANY, coverage: null })),
    coverage,
  };
}

const CENTRE = { lat: 40.6403, lng: 22.9439 };

/**
 * **Ένα μικρό, νόμιμο χαραγμένο σχήμα** *(≈ 2×2 χλμ γύρω από το {@link CENTRE})*.
 *
 * ⚠️ Μικρό **επίτηδες**: εδώ δεν κρίνεται η γεωμετρία *(αυτό το κάνει το
 * `coverage-outline-match.test.ts`)* — κρίνεται ότι **ό,τι γράφτηκε ξαναδιαβάζεται ίδιο**.
 */
const OUTLINE = [
  { lat: 40.63, lng: 22.93 },
  { lat: 40.63, lng: 22.96 },
  { lat: 40.65, lng: 22.96 },
  { lat: 40.65, lng: 22.93 },
];

/** Ένα σχήμα **πολύ πλατύ** για δήλωση εμβέλειας — ~4° πλάτους ≈ 445 χλμ. */
const TOO_WIDE = [
  { lat: 38.0, lng: 21.0 },
  { lat: 38.0, lng: 25.0 },
  { lat: 42.0, lng: 25.0 },
  { lat: 42.0, lng: 21.0 },
];

describe('ADR-846 · η εμβέλεια επιβιώνει της διαδρομής προς τον δίσκο', () => {
  it.each([
    ['καμία δήλωση', null],
    ['όλη η Ελλάδα', { nationwide: true }],
    ['διοικητικές περιοχές', { adminIds: ['municipality:0706', 'regional_unit:13'] }],
    // 🔴 Αυτή η γραμμή ήταν ΚΟΚΚΙΝΗ πριν τη διόρθωση — επέστρεφε `null`.
    ['ακτίνα', { circle: { center: CENTRE, radiusKm: 30 } }],
    // 🔑 **ΓΡΑΦΤΗΚΕ ΜΑΖΙ ΜΕ ΤΟΝ ΓΡΑΦΕΑ, ΟΧΙ ΜΕΤΑ ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ** (ADR-846 Φ3).
    ['χαραγμένο πολύγωνο', { outline: OUTLINE }],
  ] as readonly [string, DeclaredCoverage | null][])(
    '%s: ό,τι γράφτηκε ξαναδιαβάζεται ΙΔΙΟ',
    (_name, coverage) => {
      expect(roundTrip(coverage)).toEqual(coverage);
    },
  );

  it.each([10, 20, 30, 50] as const)('κάθε βήμα ακτίνας (%s χλμ) επιβιώνει', (radiusKm) => {
    expect(roundTrip({ circle: { center: CENTRE, radiusKm } })).toEqual({
      circle: { center: CENTRE, radiusKm },
    });
  });

  // ===========================================================================
  // 🔒 Ο ΔΙΣΚΟΣ ΔΕΝ ΕΙΝΑΙ ΑΞΙΟΠΙΣΤΟΣ — ΤΟ ΤΑΒΑΝΙ ΕΠΙΒΑΛΛΕΤΑΙ ΚΑΙ ΣΤΗΝ ΑΝΑΓΝΩΣΗ
  // ===========================================================================

  it.each([500, 0, -10, 15, Number.NaN])(
    'χειρόγραφη ακτίνα %s στη βάση ΔΕΝ γίνεται δεκτή — «δεν δήλωσε», ποτέ «500 χλμ»',
    (radiusKm) => {
      expect(readBack(storedWithCoverage({ circle: { center: CENTRE, radiusKm } }))).toBeNull();
    },
  );

  it('κύκλος ΧΩΡΙΣ κέντρο δεν γίνεται δεκτός — μισή δήλωση δεν είναι δήλωση', () => {
    expect(readBack(storedWithCoverage({ circle: { radiusKm: 30 } }))).toBeNull();
  });

  // ===========================================================================
  // 🔒 ΤΟ ΙΔΙΟ ΓΙΑ ΤΟ ΠΟΛΥΓΩΝΟ — ΤΑ ΔΥΟ ΤΑΒΑΝΙΑ ΕΠΙΒΑΛΛΟΝΤΑΙ ΚΑΙ ΣΤΗΝ ΑΝΑΓΝΩΣΗ
  //
  // ⚠️ Ένα χειρόγραφο πολύγωνο 445 χλμ στη βάση θα ανάσταινε την απαγόρευση #6 από την
  //    πίσω πόρτα, παρακάμπτοντας **και** τον τύπο **και** τον γραφέα — ακριβώς όπως το
  //    `radiusKm: 500` παραπάνω.
  // ===========================================================================

  it('χειρόγραφο πολύγωνο ΠΑΝΩ από το ταβάνι έκτασης ΔΕΝ γίνεται δεκτό', () => {
    expect(readBack(storedWithCoverage({ outline: TOO_WIDE }))).toBeNull();
  });

  it('χειρόγραφο πολύγωνο με ΠΑΡΑ ΠΟΛΛΕΣ κορυφές ΔΕΝ γίνεται δεκτό', () => {
    const many = Array.from({ length: 400 }, (_unused, index) => ({
      lat: 40.63 + index * 0.00001,
      lng: 22.93 + index * 0.00001,
    }));
    expect(readBack(storedWithCoverage({ outline: many }))).toBeNull();
  });

  it.each([
    ['δύο κορυφές', [{ lat: 40.63, lng: 22.93 }, { lat: 40.64, lng: 22.94 }]],
    ['όχι πίνακας', 'πολύγωνο'],
    ['σκουπίδια μέσα', [{ lat: 40.63, lng: 22.93 }, { lat: '40.64', lng: 22.94 }, null]],
  ])('χειρόγραφο πολύγωνο που δεν είναι σχήμα (%s) ⇒ «δεν δήλωσε»', (_name, outline) => {
    expect(readBack(storedWithCoverage({ outline }))).toBeNull();
  });

  it('ΠΑΡΟΝΟΜΑΣΤΗΣ — η ίδια διαδρομή με έγκυρο ΠΟΛΥΓΩΝΟ ΠΕΡΝΑ', () => {
    // 🔑 Χωρίς αυτό, ένα «απόρριπτε πάντα το πολύγωνο» θα περνούσε όλα τα παραπάνω.
    expect(readBack(storedWithCoverage({ outline: OUTLINE }))).toEqual({ outline: OUTLINE });
  });

  it('ΠΑΡΟΝΟΜΑΣΤΗΣ — η ίδια διαδρομή με έγκυρο κύκλο ΠΕΡΝΑ', () => {
    // 🔑 Χωρίς αυτό, ένα «απόρριπτε πάντα τον κύκλο» θα περνούσε όλα τα παραπάνω.
    expect(readBack(storedWithCoverage({ circle: { center: CENTRE, radiusKm: 20 } }))).toEqual({
      circle: { center: CENTRE, radiusKm: 20 },
    });
  });
});


// =============================================================================
// Π — Η ΑΠΟΔΕΔΕΙΓΜΕΝΗ ΠΑΡΟΥΣΙΑ ΚΑΝΕΙ ΤΗΝ ΙΔΙΑ ΔΙΑΔΡΟΜΗ (ADR-846 Φ5δ)
// =============================================================================
//
// ⚠️ **Ίδιο σχήμα βλάβης, νέο πεδίο**: το `presence` γράφεται από **άλλον** γραφέα
//    (`showcase-presence.service.ts`) και διαβάζεται από τον **ίδιο** αναγνώστη. Ένας
//    αναγνώστης που δεν το ξέρει θα το έσβηνε **σιωπηλά** σε κάθε ανάγνωση — και ο
//    κατάλογος θα εξαφάνιζε γραφεία από εκεί όπου **αποδεδειγμένα** δουλεύουν, με
//    **πράσινο** τον γραφέα. Ακριβώς το περιστατικό της επικεφαλίδας, μία φάση αργότερα.

describe('ADR-846 Φ5δ — η απόδειξη επιβιώνει της διαδρομής προς τον δίσκο', () => {
  const AREAS = [
    { center: { lat: 40.64, lng: 22.94 }, radiusKm: 0 },
    { center: { lat: 37.98, lng: 23.73 }, radiusKm: 10 },
  ];

  function presenceRoundTrip(presence: unknown): unknown {
    const stored = { ...toStoredShowcase(showcaseFixture({ companyId: COMPANY })), presence };
    const read = readShowcase(stored, COMPANY);
    if (read.outcome !== 'showcase') throw new Error(`Περίμενα showcase, πήρα ${read.outcome}`);
    return read.showcase.presence;
  }

  it('🔴 Π1 — κύκλοι γράφονται και ξαναδιαβάζονται ΤΑΥΤΟΣΗΜΟΙ', () => {
    expect(presenceRoundTrip(AREAS)).toEqual(AREAS);
  });

  it('Π2 — απουσία πεδίου ⇒ κενό σύνολο, ΚΑΜΙΑ μετανάστευση παλιών εγγράφων', () => {
    expect(presenceRoundTrip(undefined)).toEqual([]);
  });

  it('Π3 — σκουπίδια από τον δίσκο ΠΕΦΤΟΥΝ, δεν μαντεύονται', () => {
    expect(
      presenceRoundTrip([
        { center: { lat: 'ΟΧΙ', lng: 22.94 }, radiusKm: 1 },
        { center: { lat: 40.64, lng: 22.94 }, radiusKm: -5 },
        { center: { lat: 40.64, lng: 22.94 } },
        null,
        'κύκλος',
        AREAS[0],
      ]),
    ).toEqual([AREAS[0]]);
  });

  it('🔴 Π4 — ΤΟ ΤΑΒΑΝΙ ΕΠΙΒΑΛΛΕΤΑΙ ΚΑΙ ΣΤΗΝ ΑΝΑΓΝΩΣΗ, όχι μόνο στη γραφή', () => {
    // ⚠️ Ο γραφέας το τηρεί ήδη — αλλά αυτό προστατεύει το έγγραφο **τη στιγμή που
    //    γράφτηκε**, όχι εκείνο **που έφτασε στον φυλλομετρητή**. Και το
    //    `agency_profiles` το κατεβάζει **κάθε ανώνυμος επισκέπτης**.
    const bloated = Array.from({ length: 100 }, (_, i) => ({
      center: { lat: 40 + i * 0.1, lng: 22 },
      radiusKm: 1,
    }));

    expect(presenceRoundTrip(bloated)).toHaveLength(MAX_PRESENCE_AREAS);
  });
});
