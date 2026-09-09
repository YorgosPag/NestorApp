/**
 * ADR-846 **Φάση 5** — **Η ΑΓΚΥΡΑ ΤΗΣ ΣΥΜΦΩΝΙΑΣ ΔΗΛΩΣΗΣ ↔ ΠΡΟΣΦΟΡΑΣ.**
 *
 * 🔴 **Η ΚΕΝΤΡΙΚΗ ΑΓΚΥΡΑ ΕΙΝΑΙ Η Γ**: το **ίδιο σημείο**, με **δύο διαφορετικές
 * ακρίβειες**, δίνει **διαφορετική** ετυμηγορία. Αυτό είναι το σημείο όπου ξεπερνάμε το
 * Zillow: εκείνο συγκρίνει ταχυδρομικό κώδικα με ταχυδρομικό κώδικα, οπότε μια αγγελία
 * γεωκωδικοποιημένη σε **κέντρο πόλης** μετράει *σαν να ξέραμε τη διεύθυνσή της*. Εδώ,
 * όταν δεν ξέρουμε, **λέμε ότι δεν ξέρουμε** — και **ποτέ** δεν κατηγορούμε τον άνθρωπο
 * ότι δήλωσε λάθος με βάση δικό μας κενό.
 *
 * ⚠️ **Το fixture είναι το ΥΠΑΡΧΟΝ `demand-fixtures.listing`** *(N.18)*: ένα δεύτερο
 * εργοστάσιο αγγελιών εδώ θα ήταν ακριβώς το «κεντρικοποιείς το Α, γράφεις Β ως δίδυμο».
 */

import {
  agreementOf,
  coverageEvidenceOf,
  listingsOutsideCoverage,
  nextRadiusCovering,
  verdictForListing,
} from '../coverage-agreement';
import { coverageMatches, coverageOverCircle, type CoverageResolvers } from '../coverage-match';
import { listing } from '@/lib/demand/__tests__/demand-fixtures';
import { NO_FOOTPRINTS } from '@/types/geo/admin-footprint';
import { COVERAGE_RADIUS_STEPS, type DeclaredCoverage } from '@/types/agency-coverage';
import type { ListingPosition, PublicListing } from '@/types/public-listing';

const AT = '2026-09-08T00:00:00.000Z';

/** Θεσσαλονίκη — το κέντρο κάθε δήλωσης παρακάτω. */
const HOME = { lat: 40.64, lng: 22.94 };
/** ~9 χλμ ανατολικά: **μέσα** σε δήλωση 20 χλμ, **έξω** από δήλωση 5 χλμ. */
const NEAR = { lat: 40.64, lng: 23.046 };
/** Κασσάνδρα Χαλκιδικής — ~75 χλμ. **Έξω** από κάθε δήλωση αυτού του αρχείου. */
const FAR = { lat: 40.06, lng: 23.36 };

/**
 * ⚠️ **Καμία γεωμετρία διοικητικών οντοτήτων εδώ** — `NO_FOOTPRINTS` και γενεαλογία που
 * δεν καλείται. Οι άγκυρες αυτού του αρχείου κρίνουν **κύκλους και πολύγωνα**, όπου η
 * απάντηση είναι **εξαντλητική**· το διοικητικό σκέλος έχει δικό του αρχείο και δική του
 * ζώνη «δεν ξέρω» *(ADR-846 §8.8.4)*.
 */
const RESOLVERS: CoverageResolvers = {
  lineageOf: () => [],
  footprintOf: NO_FOOTPRINTS,
};

const RADIUS_20KM: DeclaredCoverage = { circle: { center: HOME, radiusKm: 20 } };

/** Θέση με **δηλωμένη ακρίβεια γεωκωδικοποιητή** — ο μοχλός της άγκυρας Γ. */
function geocoded(accuracy: 'exact' | 'center', point: { lat: number; lng: number }): ListingPosition {
  return { kind: 'known', provenance: 'geocoded', point, locatedAt: AT, accuracy };
}

function at(point: { lat: number; lng: number }, id = 'prop_1'): PublicListing {
  return listing({ id, position: { kind: 'known', provenance: 'manual', point, locatedAt: AT } });
}

const UNLOCATED: PublicListing = listing({
  id: 'prop_unlocated',
  position: { kind: 'unknown', reason: 'never-asked' },
});

// =============================================================================
// Α — Η ΚΡΙΣΗ ΑΝΑ ΑΓΓΕΛΙΑ
// =============================================================================

describe('Α — πού πέφτει η αγγελία σε σχέση με τη δήλωση', () => {
  it('Α1 — ακίνητο μέσα στον δηλωμένο κύκλο ⇒ inside', () => {
    expect(verdictForListing(RADIUS_20KM, at(NEAR), RESOLVERS)).toBe('inside');
  });

  it('Α2 🔑 — ακίνητο έξω ⇒ outside (ΤΟ ερώτημα της Φάσης 5)', () => {
    expect(verdictForListing(RADIUS_20KM, at(FAR), RESOLVERS)).toBe('outside');
  });

  it('Α3 — αγγελία ΧΩΡΙΣ θέση δεν κρίνεται ποτέ ⇒ indeterminate', () => {
    expect(verdictForListing(RADIUS_20KM, UNLOCATED, RESOLVERS)).toBe('indeterminate');
  });

  it('Α4 — «όλη η Ελλάδα» καλύπτει και το πιο μακρινό ⇒ inside', () => {
    expect(verdictForListing({ nationwide: true }, at(FAR), RESOLVERS)).toBe('inside');
  });

  it('Α5 ⚠️ — ΚΑΜΙΑ δήλωση + ακίνητα ⇒ outside, όχι σιωπή', () => {
    // «Δεν δήλωσα τίποτα και έχω δέκα ακίνητα» ΕΙΝΑΙ υποδήλωση — και το λέμε.
    expect(verdictForListing(null, at(NEAR), RESOLVERS)).toBe('outside');
  });

  it('Α6 — δηλωμένο ΠΟΛΥΓΩΝΟ: μέσα ⇒ inside, έξω ⇒ outside', () => {
    const box: DeclaredCoverage = {
      outline: [
        { lat: 40.6, lng: 22.9 },
        { lat: 40.7, lng: 22.9 },
        { lat: 40.7, lng: 23.0 },
        { lat: 40.6, lng: 23.0 },
      ],
    };
    expect(verdictForListing(box, at({ lat: 40.65, lng: 22.95 }), RESOLVERS)).toBe('inside');
    expect(verdictForListing(box, at(FAR), RESOLVERS)).toBe('outside');
  });
});

// =============================================================================
// Γ — 🏆 Η ΑΒΕΒΑΙΟΤΗΤΑ ΜΠΑΙΝΕΙ ΣΤΗΝ ΚΡΙΣΗ (εδώ ξεπερνάμε το Zillow)
// =============================================================================

describe('Γ 🏆 — ΙΔΙΟ σημείο, ΔΥΟ ακρίβειες, ΔΙΑΦΟΡΕΤΙΚΗ ετυμηγορία', () => {
  /** ~24 χλμ: έξω από τα 20 χλμ **ως σημείο**, αλλά εντός των 10 χλμ αβεβαιότητας πόλης. */
  const JUST_OUTSIDE = { lat: 40.64, lng: 23.223 };

  it('Γ1 — ακριβής διεύθυνση έξω από τη δήλωση ⇒ outside (ξέρουμε, άρα κρίνουμε)', () => {
    const exact = listing({ id: 'p_exact', position: geocoded('exact', JUST_OUTSIDE) });
    expect(verdictForListing(RADIUS_20KM, exact, RESOLVERS)).toBe('outside');
  });

  it('Γ2 🔴 — ΤΟ ΙΔΙΟ σημείο γνωστό μόνο σε επίπεδο ΠΟΛΗΣ ⇒ indeterminate', () => {
    // Ο κύκλος αβεβαιότητας των 10 χλμ αγγίζει τη δήλωση: το ακίνητο ΜΠΟΡΕΙ να είναι
    // μέσα. Ένας ισχυρισμός «είσαι εκτός» εδώ θα ήταν ψέμα χτισμένο σε ΔΙΚΟ ΜΑΣ κενό.
    const city = listing({ id: 'p_city', position: geocoded('center', JUST_OUTSIDE) });
    expect(verdictForListing(RADIUS_20KM, city, RESOLVERS)).toBe('indeterminate');
  });

  it('Γ3 — και ΔΕΝ γίνεται μπαλαντέρ: πόλη ΠΟΛΥ μακριά μένει outside', () => {
    // Η αβεβαιότητα συγχωρεί το οριακό, όχι το προφανές — αλλιώς το «δεν ξέρω» θα
    // κατάπινε κάθε πραγματικό εύρημα και η άγκυρα Α2 θα ήταν διακοσμητική.
    const city = listing({ id: 'p_far_city', position: geocoded('center', FAR) });
    expect(verdictForListing(RADIUS_20KM, city, RESOLVERS)).toBe('outside');
  });
});

// =============================================================================
// Δ — Η ΕΤΥΜΗΓΟΡΙΑ: σειρά ελέγχων ΩΣ ΣΥΜΒΟΛΑΙΟ
// =============================================================================

describe('Δ — οι τέσσερις καταστάσεις, και η σειρά που τις χωρίζει', () => {
  it('Δ1 — καμία αγγελία ⇒ unproven, ΠΟΤΕ unknown', () => {
    expect(agreementOf({ total: 0, outside: 0, indeterminate: 0 })).toBe('unproven');
    expect(coverageEvidenceOf(RADIUS_20KM, [], RESOLVERS).agreement).toBe('unproven');
  });

  it('Δ2 🔑 — έστω ΜΙΑ αποδεδειγμένα έξω ⇒ understated, ακόμη κι αν οι άλλες είναι άγνωστες', () => {
    // Το γεγονός δεν ακυρώνεται από τη σιωπή δίπλα του.
    expect(agreementOf({ total: 10, outside: 1, indeterminate: 9 })).toBe('understated');
  });

  it('Δ3 — υπάρχουν αγγελίες, καμία εντοπίσιμη ⇒ unknown', () => {
    expect(coverageEvidenceOf(RADIUS_20KM, [UNLOCATED], RESOLVERS).agreement).toBe('unknown');
  });

  it('Δ4 — όλες μέσα ⇒ agreed', () => {
    expect(coverageEvidenceOf(RADIUS_20KM, [at(NEAR)], RESOLVERS).agreement).toBe('agreed');
  });

  it('Δ5 🔴 — ΤΟ ΣΕΝΑΡΙΟ ΤΗΣ ΦΑΣΗΣ 5, από άκρη σε άκρη', () => {
    // Αγγελίες στη Χαλκιδική, δήλωση 20 χλμ γύρω από τη Θεσσαλονίκη.
    const listings = [at(FAR, 'p1'), at(FAR, 'p2'), at(NEAR, 'p3')];
    const evidence = coverageEvidenceOf(RADIUS_20KM, listings, RESOLVERS);

    expect(evidence).toEqual({
      total: 3,
      inside: 1,
      outside: 2,
      indeterminate: 0,
      agreement: 'understated',
    });
  });
});

// =============================================================================
// Ε — ΤΑ ΣΥΜΒΟΛΑΙΑ ΠΟΥ ΔΕΝ ΕΠΙΤΡΕΠΕΤΑΙ ΝΑ ΣΠΑΣΟΥΝ ΣΙΩΠΗΛΑ
// =============================================================================

describe('Ε — λογιστική και συνέπεια', () => {
  const MIXED = [at(NEAR, 'p1'), at(FAR, 'p2'), UNLOCATED];

  it('Ε1 🔴 — η λογιστική ΚΛΕΙΝΕΙ: total === inside + outside + indeterminate', () => {
    const e = coverageEvidenceOf(RADIUS_20KM, MIXED, RESOLVERS);
    expect(e.inside + e.outside + e.indeterminate).toBe(e.total);
    expect(e.total).toBe(MIXED.length);
  });

  it('Ε2 🔑 — η λίστα των «έξω» ΣΥΜΦΩΝΕΙ με τον μετρητή, εξ ορισμού', () => {
    const e = coverageEvidenceOf(RADIUS_20KM, MIXED, RESOLVERS);
    const outside = listingsOutsideCoverage(RADIUS_20KM, MIXED, RESOLVERS);
    expect(outside).toHaveLength(e.outside);
    expect(outside.map((l) => l.id)).toEqual(['p2']);
  });

  it('Ε3 — το `agreement` ΠΑΡΑΓΕΤΑΙ, δεν τίθεται: agreementOf(e) === e.agreement', () => {
    for (const listings of [[], MIXED, [UNLOCATED], [at(NEAR)]]) {
      const e = coverageEvidenceOf(RADIUS_20KM, listings, RESOLVERS);
      expect(agreementOf(e)).toBe(e.agreement);
    }
  });

  it('Ε4 — ιδεμποτής: ίδια είσοδος ⇒ ίδια έξοδος, καμία κρυφή κατάσταση', () => {
    const a = coverageEvidenceOf(RADIUS_20KM, MIXED, RESOLVERS);
    const b = coverageEvidenceOf(RADIUS_20KM, MIXED, RESOLVERS);
    expect(a).toEqual(b);
  });
});

// =============================================================================
// Ζ — Ο ΚΡΙΤΗΣ ΔΕΝ ΑΝΤΙΓΡΑΦΗΚΕ: το `coverageOverCircle` ΕΙΝΑΙ ο υπάρχων
// =============================================================================

describe('Ζ — μηδέν δεύτερος κριτής (ADR-749)', () => {
  it('Ζ1 — το σημείο (ακτίνα 0) ΔΕΝ παράγει ποτέ `intersects`', () => {
    // Και οι δύο κλάδοι που το παράγουν απαιτούν `asked.innerKm > 0`. Ένα σημείο είναι
    // μέσα, έξω, ή άγνωστο — και το ότι ο τύπος δεν χρειάστηκε πέμπτη τιμή είναι
    // απόδειξη ότι η τετράδα της Φάσης 2 ήταν σωστή.
    for (const point of [HOME, NEAR, FAR]) {
      const relation = coverageOverCircle(RADIUS_20KM, { center: point, radiusKm: 0 }, RESOLVERS);
      expect(relation).not.toBe('intersects');
      expect(['within', 'disjoint', 'unknown']).toContain(relation);
    }
  });

  it('Ζ3 🔴 — Η ΙΔΙΑ ΣΧΕΣΗ, ΔΥΟ ΜΕΤΑΦΡΑΣΕΙΣ: ο κατάλογος δέχεται, η αγγελία ΔΕΝ κρίνεται', () => {
    // Ακίνητο γνωστό μόνο σε επίπεδο ΠΟΛΗΣ (±10 χλμ), 24 χλμ από δήλωση 20 χλμ.
    // Οι δύο εγγεγραμμένοι τέμνονται ⇒ `intersects`.
    const JUST_OUTSIDE = { lat: 40.64, lng: 23.223 };
    const relation = coverageOverCircle(RADIUS_20KM, { center: JUST_OUTSIDE, radiusKm: 10 }, RESOLVERS);
    expect(relation).toBe('intersects');

    // Ο ΚΑΤΑΛΟΓΟΣ: «υπάρχει επικάλυψη;» ⇒ ΝΑΙ, ο επαγγελματίας εμφανίζεται.
    expect(coverageMatches(RADIUS_20KM, { circle: { center: JUST_OUTSIDE, radiusKm: 10 } }, RESOLVERS))
      .toBe(true);

    // Η ΑΓΓΕΛΙΑ: «είναι ΑΥΤΟ ΤΟ ΑΚΙΝΗΤΟ μέσα;» ⇒ ΔΕΝ ΞΕΡΟΥΜΕ.
    const city = listing({ id: 'p_city2', position: geocoded('center', JUST_OUTSIDE) });
    expect(verdictForListing(RADIUS_20KM, city, RESOLVERS)).toBe('indeterminate');
  });

  it('Ζ2 — δηλωμένος κύκλος + σημείο ⇒ ΕΞΑΝΤΛΗΤΙΚΟ: ποτέ «δεν ξέρω»', () => {
    for (const point of [HOME, NEAR, FAR]) {
      expect(coverageOverCircle(RADIUS_20KM, { center: point, radiusKm: 0 }, RESOLVERS))
        .not.toBe('unknown');
    }
  });
});

// =============================================================================
// Η — Η ΠΡΟΤΑΣΗ: κλειστό λεξιλόγιο, ΟΛΑ ή ΤΙΠΟΤΑ
// =============================================================================

describe('Η — η μόνη αυτόματη επιδιόρθωση, και τα όριά της', () => {
  /** ~24 χλμ ανατολικά του `HOME`: έξω από τα 20, μέσα στα 30. */
  const AT_24KM = { lat: 40.64, lng: 23.223 };

  it('Η1 🔑 — προτείνει το ΕΠΟΜΕΝΟ ΒΗΜΑ που καλύπτει, ποτέ ακριβή αριθμό', () => {
    const suggestion = nextRadiusCovering(RADIUS_20KM, [at(AT_24KM, 'p1')]);
    // 24 χλμ ⇒ όχι 24, όχι 25: το επόμενο ΝΟΜΙΜΟ βήμα.
    expect(suggestion).toBe(30);
    expect(COVERAGE_RADIUS_STEPS).toContain(suggestion);
  });

  it('Η2 — καλύπτει το ΠΙΟ ΜΑΚΡΙΝΟ, όχι το πρώτο που βρήκε', () => {
    const suggestion = nextRadiusCovering(RADIUS_20KM, [
      at(AT_24KM, 'p1'),
      at({ lat: 40.64, lng: 23.46 }, 'p2'), // ~44 χλμ
    ]);
    expect(suggestion).toBe(50);
  });

  it('Η3 🔴 — ΟΛΑ Ή ΤΙΠΟΤΑ: ένα ακίνητο εκτός εμβέλειας ⇒ null, ΟΧΙ μερική πρόταση', () => {
    // Μετρημένο ζωντανά (2026-09-09): 6 ακίνητα σε 5 πόλεις ⇒ κανένα βήμα δεν φτάνει.
    // Μια «μερική» πρόταση θα έδινε ψευδή αίσθηση λύσης — και θα έσπρωχνε σε ΛΑΘΟΣ
    // εργαλείο: η ακτίνα δεν μοντελοποιεί διάσπαρτο χαρτοφυλάκιο.
    const suggestion = nextRadiusCovering(RADIUS_20KM, [at(AT_24KM, 'p1'), at(FAR, 'p2')]);
    expect(suggestion).toBeNull();
  });

  it('Η4 — δήλωση που ΔΕΝ είναι ακτίνα ⇒ null (καμία μαντεψιά περιοχής)', () => {
    expect(nextRadiusCovering({ nationwide: true }, [at(FAR)])).toBeNull();
    expect(nextRadiusCovering(null, [at(FAR)])).toBeNull();
    expect(nextRadiusCovering({ adminIds: ['x'] }, [at(FAR)])).toBeNull();
  });

  it('Η5 — αγγελία ΧΩΡΙΣ θέση δεν επηρεάζει την πρόταση', () => {
    expect(nextRadiusCovering(RADIUS_20KM, [at(AT_24KM, 'p1'), UNLOCATED])).toBe(30);
  });

  it('Η6 ⚠️ — κενή λίστα ⇒ το ΜΙΚΡΟΤΕΡΟ βήμα, και ο καλών δεν τη στέλνει ποτέ', () => {
    // Δομικά: `neededKm = 0` ⇒ πρώτο βήμα. Ο καλών ρωτά ΜΟΝΟ όταν `outside > 0`,
    // αλλά η συνάρτηση δεν σιωπά — απαντά ό,τι σημαίνει η είσοδός της.
    expect(nextRadiusCovering(RADIUS_20KM, [])).toBe(COVERAGE_RADIUS_STEPS[0]);
  });
});
