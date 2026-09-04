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
  landingPanelListings,
  landingModeSeeksPeople,
  landingProShowcase,
  landingSwitchIsVisible,
} from '@/lib/landing/landing-modes';
import { LANDING_SHOWCASE_LIMIT } from '@/lib/listings/listing-coverage';
import type { OfferKind } from '@/types/property-offers';
import type { PublicListing } from '@/types/public-listing';
import type { PublicShowcase } from '@/types/agency-profile';

function listing(...offerKinds: OfferKind[]): PublicListing {
  return { id: `l-${offerKinds.join('-')}`, offerKinds } as unknown as PublicListing;
}

/**
 * **Αγγελία με ΕΛΕΓΧΟΜΕΝΗ θέση στη σειρά** — η βιτρίνα ταξινομεί κατά τίτλο→id.
 *
 * ⚠️ Χρειάζεται **μόνο** όπου η άγκυρα μιλά για τη σχέση **σειράς και κοψίματος**.
 * Αλλού ο τίτλος θα ήταν θόρυβος που κρύβει ποιο σκέλος ελέγχεται.
 */
function titled(title: string, ...offerKinds: OfferKind[]): PublicListing {
  return { id: `l-${title}`, title, offerKinds } as unknown as PublicListing;
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

describe('Μ4 — 🔴 ΤΟ ΠΑΝΕΛ: Η ΒΙΤΡΙΝΑ ΑΚΟΛΟΥΘΕΙ ΤΟΝ ΔΙΑΚΟΠΤΗ (Α4.3)', () => {
  // 🔴 **ΤΟ ΕΛΑΤΤΩΜΑ ΠΟΥ ΦΥΛΑΕΙ ΑΥΤΗ Η ΟΜΑΔΑ, ΜΕ ΤΑ ΛΟΓΙΑ ΤΟΥ GIORGIO**:
  //    *«είναι σωστό όταν πατάω **αγορά** να εμφανίζονται και εικόνες **ενοικίασης**;»*
  //
  // ⚠️ Βρέθηκε από **μάτι σε στιγμιότυπο**, με **20/20 άγκυρες πράσινες** — γιατί καμία
  //    δεν ρωτούσε *«τι δείχνει η οθόνη ΚΑΤΩ από το κουμπί που μόλις πάτησα;»*.

  const SELL_ONLY = listing('sell');
  const RENT_ONLY = listing('leaseOut');
  const BOTH = listing('sell', 'leaseOut');

  it('🔴 η «Αγορά» ΔΕΝ δείχνει ενοικιάσεις — και το αντίστροφο', () => {
    // 🔴 **Η ΜΕΤΑΛΛΑΞΗ**: κάνε το `landingPanelListings` να επιστρέφει
    //    `landingShowcaseListings(listings)` αδιακρίτως ⇒ κοκκινίζει και στα δύο σκέλη.
    const stock = [SELL_ONLY, RENT_ONLY, BOTH];

    expect(landingPanelListings('buy', stock)).toEqual(
      expect.arrayContaining([SELL_ONLY, BOTH]),
    );
    expect(landingPanelListings('buy', stock)).not.toContain(RENT_ONLY);

    expect(landingPanelListings('rent', stock)).toEqual(
      expect.arrayContaining([RENT_ONLY, BOTH]),
    );
    expect(landingPanelListings('rent', stock)).not.toContain(SELL_ONLY);
  });

  it('🔴 η αγγελία με ΔΥΟ διαθέσεις εμφανίζεται ΚΑΙ ΣΤΙΣ ΔΥΟ λειτουργίες', () => {
    // 🔑 Το πλεονέκτημα της Α4 — «πουλάω, και μέχρι να πουληθεί το νοικιάζω». Ένα
    //    φίλτρο γραμμένο ως `offerKinds[0] === …` θα την εξαφάνιζε από τη μία.
    expect(landingPanelListings('buy', [BOTH])).toHaveLength(1);
    expect(landingPanelListings('rent', [BOTH])).toHaveLength(1);
  });

  it('🔴 ΤΟ ΦΙΛΤΡΟ ΤΡΕΧΕΙ ΠΡΙΝ ΤΟ ΚΟΨΙΜΟ — αλλιώς το έλλειμμα είναι ΑΟΡΑΤΟ', () => {
    // 🔴 **Η ΜΕΤΑΛΛΑΞΗ**: αντίστρεψε τη σειρά σε «κόψε στα 6, μετά φιλτράρισε» ⇒
    //    εδώ επιστρέφει **0** αντί για 4, και στην οθόνη θα φαινόταν φυσιολογικό:
    //    κάρτες υπάρχουν, απλώς οι περισσότερες λείπουν. Ίδιο σχήμα με το «slice πριν
    //    το sort» που το `landingShowcaseListings` ήδη απαγορεύει γραμμένο.
    //
    // 🔴 **ΟΙ ΤΙΤΛΟΙ ΕΙΝΑΙ ΤΟ ΜΙΣΟ ΤΗΣ ΑΓΚΥΡΑΣ, ΟΧΙ ΔΙΑΚΟΣΜΗΣΗ.** Η βιτρίνα ταξινομεί
    //    κατά **τίτλο→id** (`compareShowcaseListings`). Χωρίς ρητούς τίτλους, τα
    //    `id` των ψεύτικων αντικειμένων έβαζαν **τυχαία** τις ενοικιάσεις πρώτες,
    //    οπότε ακόμη και το «κόψε πρώτα» επέστρεφε 4 — και **η μετάλλαξη επιβίωνε**.
    //    *(Μετρημένο: η πρώτη γραφή αυτής της άγκυρας ήταν πράσινη και στις δύο
    //    εκδοχές — δηλαδή δεν φύλαγε τίποτα.)* Εδώ οι πωλήσεις καταλαμβάνουν
    //    **ολόκληρο** το ταβάνι, ώστε ένα πρόωρο κόψιμο να μην αφήνει καμία ενοικίαση.
    const stock = [
      ...Array.from({ length: LANDING_SHOWCASE_LIMIT }, (_, i) =>
        titled(`Α${i}`, 'sell'),
      ),
      ...Array.from({ length: 4 }, (_, i) => titled(`Ω${i}`, 'leaseOut')),
    ];

    expect(stock).toHaveLength(LANDING_SHOWCASE_LIMIT + 4);
    expect(landingPanelListings('rent', stock)).toHaveLength(4);
  });

  it('🔴 το ταβάνι της βιτρίνας ΕΞΑΚΟΛΟΥΘΕΙ να ισχύει μέσα στη λειτουργία', () => {
    const many = Array.from({ length: LANDING_SHOWCASE_LIMIT + 5 }, () => listing('sell'));

    expect(landingPanelListings('buy', many)).toHaveLength(LANDING_SHOWCASE_LIMIT);
  });

  it('🔴 οι ΕΠΑΓΓΕΛΜΑΤΙΕΣ δεν αποδεικνύονται με αγγελίες — η διακλάδωση είναι ΤΥΠΟΥ', () => {
    // Α5. Το `null` είναι που επιτρέπει στη βιτρίνα να αποδώσει **κάρτες προσώπων**
    // χωρίς να ξαναγράψει κανείς τον κανόνα ως `if (mode === 'pros')`.
    // 🔴 **Η ΜΕΤΑΛΛΑΞΗ**: δώσε στο `pros` ένα `OfferKind` ⇒ κοκκινίζει.
    expect(landingPanelListings('pros', [SELL_ONLY, RENT_ONLY])).toBeNull();
  });

  it('🔴 ΧΩΡΙΣ ΔΙΑΚΟΠΤΗ ΔΕΝ ΦΙΛΤΡΑΡΟΥΜΕ — φίλτρο χωρίς χειριστήριο είναι ΑΠΩΛΕΙΑ', () => {
    // 🔴 **Η ΜΕΤΑΛΛΑΞΗ**: κάνε το `mode === null` να πέφτει στο `landingModeFilters` ⇒
    //    κοκκινίζει, γιατί η αντιπαροχή θα εξαφανιζόταν **σιωπηλά**.
    //
    // ⚠️ Είναι **χειρότερο** από το ελάττωμα που έκλεισε η Α4.3: εκεί ο επισκέπτης
    //    έβλεπε **παραπάνω** απ' όσα ζήτησε *(θόρυβος)*· εδώ θα έβλεπε **λιγότερα απ'
    //    όσα υπάρχουν** *(απώλεια)*, χωρίς τίποτα στην οθόνη να το εξηγεί.
    const stock = [SELL_ONLY, listing('exchange')];

    expect(landingPanelListings(null, stock)).toHaveLength(2);
    expect(landingPanelListings('buy', stock)).toHaveLength(1);
  });
});

describe('Μ5 — 🔴 ΤΟ ΧΕΙΡΙΣΤΗΡΙΟ ΕΧΕΙ ΜΙΑ ΠΗΓΗ (Α4.3)', () => {
  it('🔴 ένα κουμπί ΔΕΝ είναι διακόπτης — είναι ετικέτα που μοιάζει με επιλογή', () => {
    // 🔴 **Η ΜΕΤΑΛΛΑΞΗ**: κάνε το `>= 2` σε `>= 1` ⇒ κοκκινίζει. Τότε η βιτρίνα θα
    //    φιλτράριζε ενώ ο επισκέπτης δεν βλέπει **κανένα** κουμπί να το αναιρέσει.
    expect(landingSwitchIsVisible([])).toBe(false);
    expect(landingSwitchIsVisible(['buy'])).toBe(false);
    expect(landingSwitchIsVisible(['buy', 'rent'])).toBe(true);
  });

  it('🔴 το κριτήριο ζει ΕΞΩ από το component, γιατί το ρωτούν ΔΥΟ', () => {
    // Ο διακόπτης το ρωτά για να σιωπήσει· η σελίδα για να ξέρει αν επιτρέπεται να
    // φιλτράρει. Δύο `length < 2` σε δύο αρχεία θα ήταν δύο απαντήσεις (N.0.2).
    const counts = countLandingModes([listing('sell')], 0);

    expect(availableLandingModes(counts)).toEqual(['buy']);
    expect(landingSwitchIsVisible(availableLandingModes(counts))).toBe(false);
  });
});

describe('Μ6 — 🔴 Η ΒΙΤΡΙΝΑ ΤΩΝ ΕΠΑΓΓΕΛΜΑΤΙΩΝ (Α4.3)', () => {
  function profile(id: string): PublicShowcase {
    return { companyId: id } as unknown as PublicShowcase;
  }

  it('🔴 ΙΔΙΟ ταβάνι με τις αγγελίες — «δείγμα» δεν έχει δύο μεγέθη', () => {
    // 🔴 **Η ΜΕΤΑΛΛΑΞΗ**: βάλε δεύτερη σταθερά (π.χ. 4) ⇒ κοκκινίζει. Θα σήμαινε ότι
    //    το πόσα δείχνει η βιτρίνα αλλάζει ανάλογα με το κουμπί, χωρίς κανείς να το μάθει.
    const many = Array.from({ length: LANDING_SHOWCASE_LIMIT + 3 }, (_, i) => profile(`c${i}`));

    expect(landingProShowcase(many)).toHaveLength(LANDING_SHOWCASE_LIMIT);
  });

  it('🔴 ΔΕΝ ξανα-ταξινομεί — η σειρά έρχεται από τον `usePublicAgencies`', () => {
    // 🔴 **Η ΜΕΤΑΛΛΑΞΗ**: βάλε `sort()` εδώ ⇒ κοκκινίζει. Θα ήταν **δεύτερη** σειρά
    //    για το ίδιο σύνολο, ελεύθερη να αποκλίνει από τον κατάλογο `/pro`.
    const given = [profile('γ'), profile('α'), profile('β')];

    expect(landingProShowcase(given).map((p) => p.companyId)).toEqual(['γ', 'α', 'β']);
  });
});

describe('Μ7 — 🔴 Η ΠΟΡΤΑ «ΔΕΣ ΤΑ ΟΛΑ» ΞΕΡΕΙ ΠΟΥ ΣΤΕΚΕΣΑΙ (Α4.4-Β)', () => {
  // 🔴 **ΤΟ ΕΡΩΤΗΜΑ ΤΟΥ GIORGIO**: *«θέλω υδραυλικό — τι κάνω;»*. Μετρήθηκε ότι δεν
  //    υπήρχε **καμία** διαδρομή προς τον κατάλογο χωρίς να πληκτρολογήσεις τόπο:
  //    το «Αναζήτηση» είναι απενεργοποιημένο με κενό πεδίο, και οι κάρτες οδηγούν σε
  //    **ένα** προφίλ. Δηλαδή «επαγγελματίες οπουδήποτε» ήταν **αδύνατο**.

  it('🔴 στους ΕΠΑΓΓΕΛΜΑΤΙΕΣ η πόρτα ψάχνει ΠΡΟΣΩΠΟ, όχι ακίνητο', () => {
    // 🔴 **Η ΜΕΤΑΛΛΑΞΗ**: κάνε το να επιστρέφει πάντα `false` ⇒ κοκκινίζει, και ο
    //    επισκέπτης που μόλις είπε «ψάχνω πρόσωπο» ξαναστέλνεται σε **αγγελίες**.
    expect(landingModeSeeksPeople('pros')).toBe(true);
  });

  it('🔴 στις λειτουργίες ΑΓΓΕΛΙΩΝ μένει η ιστορική πόρτα', () => {
    for (const mode of LANDING_MODES) {
      if (!isListingMode(mode)) continue;
      expect(landingModeSeeksPeople(mode)).toBe(false);
    }
  });

  it('🔴 ΧΩΡΙΣ ΔΙΑΚΟΠΤΗ κανείς δεν δήλωσε τι ψάχνει — η πόρτα δεν αλλάζει', () => {
    // ⚠️ Ίδιος κανόνας με το `landingPanelListings(null, …)`: χωρίς χειριστήριο, καμία
    //    σιωπηλή απόφαση εκ μέρους του ανθρώπου.
    expect(landingModeSeeksPeople(null)).toBe(false);
  });

  it('🔴 είναι Η ΙΔΙΑ διατύπωση με τον τύπο — ποτέ δεύτερη λίστα ονομάτων', () => {
    // 🔴 **Η ΜΕΤΑΛΛΑΞΗ**: γράψ' το ως `mode === 'pros'` και πρόσθεσε λειτουργία στο
    //    `LANDING_MODES` χωρίς `OfferKind` ⇒ οι δύο απαντήσεις αποκλίνουν. Εδώ δεν
    //    μπορούν: και οι δύο ρωτούν το ίδιο `landingModeFilters`.
    for (const mode of LANDING_MODES) {
      expect(landingModeSeeksPeople(mode)).toBe(!isListingMode(mode));
    }
  });
});
