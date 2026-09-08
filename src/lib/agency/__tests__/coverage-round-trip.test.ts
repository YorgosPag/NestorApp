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

describe('ADR-846 · η εμβέλεια επιβιώνει της διαδρομής προς τον δίσκο', () => {
  it.each([
    ['καμία δήλωση', null],
    ['όλη η Ελλάδα', { nationwide: true }],
    ['διοικητικές περιοχές', { adminIds: ['municipality:0706', 'regional_unit:13'] }],
    // 🔴 Αυτή η γραμμή ήταν ΚΟΚΚΙΝΗ πριν τη διόρθωση — επέστρεφε `null`.
    ['ακτίνα', { circle: { center: CENTRE, radiusKm: 30 } }],
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

  it('ΠΑΡΟΝΟΜΑΣΤΗΣ — η ίδια διαδρομή με έγκυρο κύκλο ΠΕΡΝΑ', () => {
    // 🔑 Χωρίς αυτό, ένα «απόρριπτε πάντα τον κύκλο» θα περνούσε όλα τα παραπάνω.
    expect(readBack(storedWithCoverage({ circle: { center: CENTRE, radiusKm: 20 } }))).toEqual({
      circle: { center: CENTRE, radiusKm: 20 },
    });
  });
});
