/**
 * @fileoverview **Η ΣΕΙΡΑ ΤΗΣ ΒΙΤΡΙΝΑΣ** — ίδια είσοδος, ίδια οθόνη, κάθε φορά.
 * @related ADR-841 §7 (Α6) · lib/listings/listing-showcase-order.ts
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΙ ΦΥΛΑΕΙ — ΚΑΙ ΓΙΑΤΙ ΤΟ ΠΡΟΦΑΝΕΣ ΚΛΕΙΔΙ ΘΑ ΠΕΡΝΟΥΣΕ ΚΑΘΕ ΕΛΕΓΧΟ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η φυσική «βελτίωση» αυτού του αρχείου είναι *«νεότερες πρώτα»* με το `projectedAt`.
 * Θα μεταγλωττιζόταν, θα φαινόταν σωστότερη, και θα ήταν **ψέμα**: το `projectedAt`
 * είναι η στιγμή της τελευταίας **ανακατασκευής**, όχι της καταχώρησης — μετά από μία
 * `rebuildAllPublicListings` **όλα** τα έγγραφα το έχουν ίδιο *(μετρημένο ζωντανά
 * 2026-09-01: 7 στα 7 μέσα στο ίδιο δευτερόλεπτο)*.
 *
 * ⇒ Η άγκυρα **Σ4** το φυλά ρητά: ταυτόσημο `projectedAt` και **παρ' όλα αυτά**
 * σταθερή, ανθρώπινα αναγνώσιμη σειρά.
 *
 * ⚠️ **Ο συγκριτής δοκιμάζεται και ΧΩΡΙΣ `sort`** (Σ3): ένα tie-break που ελέγχεται
 * μόνο μέσω `Array#sort` κρύβεται πίσω από τη **σταθερότητα** εκείνης — θα φαινόταν
 * σωστό **και** αν έλειπε. *(«tie-break σκέλος = εμφάνιση, ΟΧΙ απόδειξη».)*
 */

import { UNASKED_LISTING_ATTRIBUTES, type PublicListing } from '@/types/public-listing';
import {
  compareShowcaseListings,
  orderShowcaseListings,
} from '../listing-showcase-order';

const AT = '2026-09-01T09:28:43.769Z';

/** Όσο χρειάζεται η **σειρά**, με τον πραγματικό τύπο — ποτέ `as PublicListing`. */
function listingOf(id: string, title: string, projectedAt = AT): PublicListing {
  return {
    id,
    title,
    projectedAt,
    commercialStatus: 'for-sale',
    commercial: { askingPrice: 1, finalPrice: null, rentPrice: null, nightlyRate: null },
    stay: null,
    coverImage: null,
    gallery: [],
    type: 'apartment',
    areaSqm: 90,
    offerKinds: ['sell'],
    position: { kind: 'unknown', reason: 'never-asked' },
    place: null,
    floor: null,
    bedrooms: null,
    // ✅ **ADR-842 Φ3** — τα 23 χαρακτηριστικά, ως **μία** ονομασμένη απουσία.
    //    Οκτώ fixtures θα κρατούσαν ο καθένας τη δική του λίστα `null` — δηλαδή οκτώ
    //    λίστες που συμφωνούν μέχρι την πρώτη προσθήκη πεδίου.
    ...UNASKED_LISTING_ATTRIBUTES,
    legality: [],
    authorship: 'agency',
    agencyName: 'ΑΛΦΑ',
    agencyId: 'comp_alfa',
  };
}

const titlesOf = (l: readonly PublicListing[]): readonly string[] => l.map((x) => x.title);

describe('Σ. Η σειρά της βιτρίνας είναι ΟΛΙΚΗ, όχι απλώς αλφαβητική', () => {
  it('Σ1 — ταξινομεί κατά τίτλο, με ελληνικό collation', () => {
    const listed = orderShowcaseListings([
      listingOf('prop_c', 'Οικόπεδο'),
      listingOf('prop_a', 'Διαμέρισμα'),
      listingOf('prop_b', 'Μεζονέτα'),
    ]);

    expect(titlesOf(listed)).toEqual(['Διαμέρισμα', 'Μεζονέτα', 'Οικόπεδο']);
  });

  it('Σ2 🔑 — τόνος και κεφαλαία ΔΕΝ αποφασίζουν: αποφασίζει ο τερματισμός', () => {
    // Ο collator είναι `sensitivity: 'base'` ⇒ οι τρεις γραφές είναι **ισοπαλία**, και
    // η σειρά τους βγαίνει αποκλειστικά από την ταυτότητα.
    const listed = orderShowcaseListings([
      listingOf('prop_c', 'ΜΕΖΟΝΕΤΑ'),
      listingOf('prop_a', 'Μεζονέτα'),
      listingOf('prop_b', 'μεζονέτα'),
    ]);

    expect(listed.map((l) => l.id)).toEqual(['prop_a', 'prop_b', 'prop_c']);
  });

  it('Σ3 🔑 — ΙΔΙΟΣ τίτλος: ο ΣΥΓΚΡΙΤΗΣ (όχι η sort) δίνει σταθερή σειρά', () => {
    // 🔴 Χωρίς αυτό, ένας συγκριτής που επιστρέφει `0` στην ισοπαλία θα περνούσε το Σ2
    //    χάρη στη σταθερότητα του `Array#sort` — δηλαδή θα φαινόταν σωστός ενώ δεν θα
    //    ήταν ολικός.
    const a = listingOf('prop_a', 'Ίδιος τίτλος');
    const b = listingOf('prop_b', 'Ίδιος τίτλος');

    expect(compareShowcaseListings(a, b)).toBeLessThan(0);
    expect(compareShowcaseListings(b, a)).toBeGreaterThan(0);
    expect(compareShowcaseListings(a, a)).toBe(0);
  });

  it('🔴 Σ4 — ΤΑΥΤΟΣΗΜΟ `projectedAt` ⇒ η σειρά ΕΞΑΚΟΛΟΥΘΕΙ να είναι σταθερή και ανθρώπινη', () => {
    // Η ακριβής κατάσταση μετά από `rebuildAllPublicListings`: κάθε αγγελία έχει την
    // **ίδια** σφραγίδα. Ένα `sort` πάνω στο `projectedAt` θα ήταν εδώ **ισοπαλία
    // παντού** — δηλαδή θα επέστρεφε στην τύχη, ενώ θα φαινόταν χρονολογικό.
    const stamp = '2026-09-01T09:28:43.769Z';
    const listed = orderShowcaseListings([
      listingOf('prop_c', 'Οικόπεδο', stamp),
      listingOf('prop_a', 'Διαμέρισμα', stamp),
      listingOf('prop_b', 'Μεζονέτα', stamp),
    ]);

    expect(new Set(listed.map((l) => l.projectedAt)).size).toBe(1);
    expect(titlesOf(listed)).toEqual(['Διαμέρισμα', 'Μεζονέτα', 'Οικόπεδο']);
  });

  it('Σ5 — ίδια έξοδος για ΚΑΘΕ σειρά εισόδου (ολική σχέση)', () => {
    const items = [
      listingOf('prop_b', 'Μεζονέτα'),
      listingOf('prop_a', 'Μεζονέτα'),
      listingOf('prop_c', 'Διαμέρισμα'),
    ];
    const expected = listingIds(orderShowcaseListings(items));

    // Και οι 6 μεταθέσεις τριών στοιχείων.
    for (const [i, j, k] of [
      [0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0],
    ]) {
      expect(listingIds(orderShowcaseListings([items[i]!, items[j]!, items[k]!]))).toEqual(
        expected,
      );
    }
  });

  it('Σ6 — «Ακίνητο 2» πριν από «Ακίνητο 10» (numeric collation)', () => {
    const listed = orderShowcaseListings([
      listingOf('prop_b', 'Ακίνητο 10'),
      listingOf('prop_a', 'Ακίνητο 2'),
    ]);

    expect(titlesOf(listed)).toEqual(['Ακίνητο 2', 'Ακίνητο 10']);
  });

  it('Σ7 — ΔΕΝ μεταβάλλει την είσοδο (ανήκει στη συνδρομή)', () => {
    const items = [listingOf('prop_b', 'Οικόπεδο'), listingOf('prop_a', 'Διαμέρισμα')];
    const before = listingIds(items);

    orderShowcaseListings(items);

    expect(listingIds(items)).toEqual(before);
  });

  it('Σ8 — κενός τίτλος ΔΕΝ ρίχνει, και η σειρά μένει ολική', () => {
    // Ο γραφέας γράφει `(property.name ?? '').trim()` — το κενό είναι υπαρκτή τιμή.
    const listed = orderShowcaseListings([
      listingOf('prop_b', 'Διαμέρισμα'),
      listingOf('prop_a', ''),
    ]);

    expect(listed.map((l) => l.id)).toEqual(['prop_a', 'prop_b']);
  });
});

function listingIds(listings: readonly PublicListing[]): readonly string[] {
  return listings.map((l) => l.id);
}
