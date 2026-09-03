/**
 * @fileoverview **ΟΙ ΛΕΙΤΟΥΡΓΙΕΣ ΤΗΣ ΡΙΖΑΣ** — τι εμφανίζεται, και γιατί (ADR-841 Α4).
 * @related ADR-841 §7 Α4 · Α5 · §9 Ο-6 · ADR-777 §8.10 · lib/landing/landing-modes
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΙ ΦΥΛΑΕΙ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το **Ο-6** έχει ήδη καταγράψει το ρίσκο: *«η Α4 **σχεδιάζει** τη λειτουργία· δεν την
 * **τροφοδοτεί**»*. Ένα κουμπί «Διαμονή» πάνω σε **μηδέν** αγγελίες οδηγεί σε άδεια
 * λίστα για **κάθε** πιθανή είσοδο — το σενάριο που το §8.10 ονόμασε *«γράφει «Πάτρα»,
 * παίρνει μηδέν, φεύγει για πάντα»*.
 */

import {
  LANDING_MODES,
  LANDING_MODE_OFFER,
  availableLandingModes,
  countLandingModes,
  defaultLandingMode,
  isListingMode,
  landingModeFilters,
} from '@/lib/landing/landing-modes';
import type { OfferKind } from '@/types/property-offers';
import type { PublicListing } from '@/types/public-listing';

function listing(...offerKinds: OfferKind[]): PublicListing {
  return { id: `l-${offerKinds.join('-')}`, offerKinds } as unknown as PublicListing;
}

const ATHENS = { lat: 37.98098, lng: 23.7333 };

describe('Μ1 — Η ΜΕΤΡΗΣΗ ΑΝΑ ΛΕΙΤΟΥΡΓΙΑ', () => {
  it('🔴 μία αγγελία με ΔΥΟ διαθέσεις μετρά ΚΑΙ ΣΤΙΣ ΔΥΟ', () => {
    // 🔑 **ΤΟ ΠΛΕΟΝΕΚΤΗΜΑ ΠΟΥ Η ZILLOW ΔΕΝ ΜΠΟΡΕΙ ΚΑΝ ΝΑ ΕΚΦΡΑΣΕΙ** (Α4): «πουλάω, και
    //    μέχρι να πουληθεί το βγάζω βραχυχρόνια». Το `offerKinds` είναι **πίνακας**.
    // 🔴 **Η ΜΕΤΑΛΛΑΞΗ**: κάνε το `includes` σε `offerKinds[0] === …` ⇒ κοκκινίζει.
    const counts = countLandingModes([listing('sell', 'leaseShort')], 0);

    expect(counts.buy).toBe(1);
    expect(counts.stay).toBe(1);
    expect(counts.rent).toBe(0);
  });

  it('🔴 το άθροισμα ΔΕΝ ισούται με το πλήθος των αγγελιών — και είναι σωστό', () => {
    // ⚠️ Άγκυρα **κατά** λανθασμένης «διόρθωσης»: κάποιος που θεωρεί τους κάδους
    //    αμοιβαία αποκλειόμενους θα «έφτιαχνε» το `includes` σε `else if`.
    const counts = countLandingModes([listing('sell', 'leaseOut')], 0);
    expect(counts.buy + counts.rent).toBe(2);
  });

  it('🔴 οι επαγγελματίες ΔΕΝ μετρώνται από τις αγγελίες', () => {
    // Α5: *«οι επαγγελματίες δεν είναι τύπος αγγελίας»*.
    expect(countLandingModes([listing('sell')], 22).pros).toBe(22);
    expect(countLandingModes([listing('sell')], 0).pros).toBe(0);
  });
});

describe('Μ2 — ΤΟ ΚΟΥΜΠΙ ΕΜΦΑΝΙΖΕΤΑΙ ΜΟΝΟ ΟΤΑΝ ΜΠΟΡΕΙ ΝΑ ΤΗΡΗΣΕΙ ΤΗΝ ΥΠΟΣΧΕΣΗ', () => {
  it('🔴 η ΖΩΝΤΑΝΗ κατάσταση της 2026-09-04: «Διαμονή» ΔΕΝ εμφανίζεται', () => {
    // Μετρημένο στο Firestore: `sell` 6 · `leaseOut` 4 · `leaseShort` **0** · 22 προφίλ.
    // 🔴 **Η ΜΕΤΑΛΛΑΞΗ**: κάνε το `counts[mode] > 0` σε `>= 0` ⇒ κοκκινίζει, και η
    //    οθόνη θα υποσχόταν βραχυχρόνια που δεν υπάρχει (Ο-6).
    const listings = [
      ...Array.from({ length: 6 }, () => listing('sell')),
      ...Array.from({ length: 4 }, () => listing('leaseOut')),
    ];

    expect(availableLandingModes(countLandingModes(listings, 22))).toEqual([
      'buy',
      'rent',
      'pros',
    ]);
  });

  it('🔴 μία μόνο αγγελία ΑΡΚΕΙ — το κατώφλι είναι ένα, όχι «αρκετά»', () => {
    expect(availableLandingModes(countLandingModes([listing('leaseShort')], 0))).toEqual([
      'stay',
    ]);
  });

  it('🔴 με άδεια βάση δεν εμφανίζεται ΚΑΜΙΑ, και η προεπιλογή είναι `null`', () => {
    const none = availableLandingModes(countLandingModes([], 0));
    expect(none).toEqual([]);
    expect(defaultLandingMode(none)).toBeNull();
  });

  it('🔴 Η ΣΕΙΡΑ ΔΕΝ ΑΝΑΔΙΑΤΑΣΣΕΤΑΙ ΚΑΤΑ ΠΛΗΘΟΣ', () => {
    // Τα κουμπιά δεν επιτρέπεται να **μετακινούνται κάτω από το δάχτυλο** όταν
    // αλλάξουν τα δεδομένα της ζωντανής συνδρομής.
    // 🔴 **Η ΜΕΤΑΛΛΑΞΗ**: πρόσθεσε `.sort((a,b)=>counts[b]-counts[a])` ⇒ κοκκινίζει.
    const counts = countLandingModes(
      [listing('leaseShort'), listing('leaseShort'), listing('sell')],
      1,
    );
    expect(availableLandingModes(counts)).toEqual(['buy', 'stay', 'pros']);
  });

  it('🔴 η προεπιλογή είναι η πρώτη ΔΙΑΘΕΣΙΜΗ, ποτέ καρφωμένο «Αγορά»', () => {
    // 🔴 **Η ΜΕΤΑΛΛΑΞΗ**: γύρνα το `available[0]` σε σκέτο `'buy'` ⇒ κοκκινίζει.
    //    Θα άνοιγε τη σελίδα σε λειτουργία που μόλις κρίθηκε ότι δεν εμφανίζεται.
    const counts = countLandingModes([listing('leaseOut')], 0);
    expect(defaultLandingMode(availableLandingModes(counts))).toBe('rent');
  });
});

describe('Μ3 — Ο ΠΡΟΟΡΙΣΜΟΣ', () => {
  it('🔴 ταξιδεύει ΑΚΡΙΒΩΣ ΕΝΑ είδος — αυτό που πάτησε ο επισκέπτης', () => {
    // 🔴 **Η ΜΕΤΑΛΛΑΞΗ**: βάλε δεύτερο `OfferKind` στον πίνακα ⇒ κοκκινίζει.
    //    Θα έδινε αποτελέσματα που κανείς δεν ζήτησε, ακυρώνοντας τον διακόπτη.
    for (const mode of LANDING_MODES) {
      const filters = landingModeFilters(mode, ATHENS);
      if (!isListingMode(mode)) continue;
      expect(filters?.offerKinds).toEqual([LANDING_MODE_OFFER[mode]]);
      expect(filters?.near?.center).toEqual(ATHENS);
    }
  });

  it('🔴 οι ΕΠΑΓΓΕΛΜΑΤΙΕΣ δεν παράγουν φίλτρα αγγελιών — η διακλάδωση είναι ΤΥΠΟΥ', () => {
    // Α5. Το `null` είναι που επιτρέπει στον καταναλωτή να στείλει στο `/pro` **χωρίς**
    // να ξαναγράψει τον κανόνα ως `if (mode === 'pros')`.
    // 🔴 **Η ΜΕΤΑΛΛΑΞΗ**: δώσε στο `pros` ένα `OfferKind` ⇒ κοκκινίζει.
    expect(landingModeFilters('pros', ATHENS)).toBeNull();
    expect(isListingMode('pros')).toBe(false);
  });

  it('🔴 η ΑΝΤΙΠΑΡΟΧΗ δεν έχει κουμπί — είναι ΔΙΑΣΤΑΣΗ, όχι είδος (Α20)', () => {
    // 🔴 **Η ΜΕΤΑΛΛΑΞΗ**: πρόσθεσε `'exchange'` στο `LANDING_MODES` ⇒ κοκκινίζει.
    expect(Object.values(LANDING_MODE_OFFER)).not.toContain('exchange');
    expect(LANDING_MODES).toHaveLength(4);
  });
});
