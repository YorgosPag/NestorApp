/**
 * Άγκυρες της μηχανής προβολής (ADR-777 Α1 · Α3 · Α5 · Α20).
 *
 * ⚠️ Οι είσοδοι είναι **αντιγραμμένες από τη ζωντανή βάση** (μέτρηση 2026-08-10) και όχι
 * επινοημένες: αν το σχήμα των πραγματικών εγγράφων δεν ταιριάζει, η μηχανή θα περνούσε
 * τα tests και θα αποτύγχανε στην παραγωγή.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  isPubliclyListed,
  resolveListingPosition,
  buildPublicListing,
  projectListingShape,
  addressToPositionCandidate,
  type ProjectableProperty,
  type PlaceKnowledge,
} from '../public-listing-projection';
import { offerKindsFromLegacyStatus } from '@/lib/offers/derive-commercial-status';

const AT = '2026-08-10T10:00:00.000Z';
const NO_PLACE: PlaceKnowledge = { candidates: [], ref: null };

/** Πραγματικό έγγραφο: `prop_2d612992…` «Μεζονέτα 95 τ.μ.» (χωρίς offerKinds — προ Α20). */
const REAL_MAISONETTE: ProjectableProperty = {
  id: 'prop_2d612992-32fd-4ec3-b459-38c9882f7017',
  name: 'Μεζονέτα 95 τ.μ.',
  type: 'maisonette',
  commercialStatus: 'for-sale',
  status: 'for-sale',
  floor: 1,
  layout: { bedrooms: 3 },
  areas: { gross: 95 },
  area: 95,
  commercial: { askingPrice: 200000, rentPrice: null },
};

describe('Κ1 — το κριτήριο δημοσίευσης είναι Η ΕΝΩΣΗ των δύο σκελών', () => {
  it('παλιό λεξιλόγιο: for-sale ⇒ δημοσιεύεται (και ΔΕΝ έχει offerKinds — όπως τα 8 πραγματικά)', () => {
    expect(REAL_MAISONETTE.offerKinds).toBeUndefined();
    expect(isPubliclyListed(REAL_MAISONETTE)).toBe(true);
  });

  it('🔴 ΜΟΝΟ ΑΝΤΙΠΑΡΟΧΗ: commercialStatus «unavailable» αλλά offerKinds ⇒ ΔΗΜΟΣΙΕΥΕΤΑΙ', () => {
    const exchangeOnly: ProjectableProperty = {
      id: 'p1', commercialStatus: 'unavailable', offerKinds: ['exchange'],
    };
    expect(isPubliclyListed(exchangeOnly)).toBe(true);
  });

  it('🔑 γιατί χρειάζονται ΚΑΙ ΤΑ ΔΥΟ: το καθένα μόνο του κρύβει άλλη κατηγορία', () => {
    // Μόνο το παλιό σκέλος ⇒ χάνει την αντιπαροχή.
    const exchangeOnly: ProjectableProperty = { id: 'p1', commercialStatus: 'unavailable', offerKinds: ['exchange'] };
    // Μόνο το νέο σκέλος ⇒ χάνει ΚΑΘΕ έγγραφο γραμμένο πριν την Α20 (δηλαδή και τα 8).
    expect(isPubliclyListed(exchangeOnly)).toBe(true);
    expect(isPubliclyListed(REAL_MAISONETTE)).toBe(true);
  });

  it('πωλημένο χωρίς διαθέσεις ⇒ ΔΕΝ δημοσιεύεται', () => {
    expect(isPubliclyListed({ id: 'p', commercialStatus: 'sold' })).toBe(false);
  });

  it('άγνωστη διάθεση δεν δημοσιεύει τίποτα — το σύνολο είναι κλειστό', () => {
    expect(isPubliclyListed({ id: 'p', commercialStatus: 'unavailable', offerKinds: ['barter'] })).toBe(false);
  });
});

describe('Κ2 — η θέση λύνεται με ΚΑΤΑΤΑΞΗ, όχι με σειρά άφιξης', () => {
  const point = { lat: 40.64, lng: 22.94 } as const;

  it('ισχυρότερη πηγή νικά ανεξάρτητα από τη σειρά', () => {
    const place: PlaceKnowledge = {
      candidates: [
        { kind: 'known', provenance: 'geocoded', point, locatedAt: AT, accuracy: 'center' },
        { kind: 'known', provenance: 'survey', point, locatedAt: AT },
      ],
    };
    expect(resolveListingPosition(place, null)).toMatchObject({ provenance: 'survey' });

    const reversed: PlaceKnowledge = { candidates: [...place.candidates].reverse() };
    expect(resolveListingPosition(reversed, null)).toMatchObject({ provenance: 'survey' });
  });

  it('🔴 αυτόματη γεωκωδικοποίηση ΔΕΝ σβήνει πινέζα ανθρώπου', () => {
    const place: PlaceKnowledge = {
      candidates: [
        { kind: 'known', provenance: 'manual', point, locatedAt: AT },
        { kind: 'known', provenance: 'geocoded', point, locatedAt: AT, accuracy: 'exact' },
      ],
    };
    expect(resolveListingPosition(place, null)).toMatchObject({ provenance: 'manual' });
  });

  it('ισοβαθμία ⇒ κρατά ο πρώτος· η σύγκρουση δεν λύνεται σιωπηλά από τη σειρά αποθήκευσης', () => {
    const place: PlaceKnowledge = {
      candidates: [
        { kind: 'known', provenance: 'survey', point, locatedAt: AT },
        { kind: 'known', provenance: 'bim', point, locatedAt: AT },
      ],
    };
    expect(resolveListingPosition(place, null)).toMatchObject({ provenance: 'survey' });
  });
});

describe('Κ3 — «δεν ξέρουμε» είναι ΔΥΟ καταστάσεις, όχι μία', () => {
  it('καμία υποψήφια, καμία δήλωση ⇒ never-asked (ΔΙΚΟ ΜΑΣ χρέος)', () => {
    expect(resolveListingPosition(NO_PLACE, null)).toEqual({ kind: 'unknown', reason: 'never-asked' });
  });

  it('ο κάτοχος αρνήθηκε ⇒ owner-declined (ΕΠΙΛΟΓΗ ΤΟΥ)', () => {
    expect(resolveListingPosition(NO_PLACE, 'declined')).toEqual({ kind: 'unknown', reason: 'owner-declined' });
  });

  it('🔑 η διάκριση αλλάζει ΤΙ ΚΑΝΕΙ η οθόνη: θεραπεία με ένα κλικ vs σεβασμός', () => {
    const ours = resolveListingPosition(NO_PLACE, null);
    const theirs = resolveListingPosition(NO_PLACE, 'declined');
    expect(ours).not.toEqual(theirs);
  });
});

describe('Κ4 — η προβολή δεν κουβαλά ΚΑΜΙΑ ταυτότητα πελάτη', () => {
  it('🔴 τα πεδία που διέρρεαν από το `properties` ΔΕΝ υπάρχουν στην έξοδο', () => {
    const withSecrets = {
      ...REAL_MAISONETTE,
      companyId: 'comp_9c7c1a50-f370-466d-bdf7-aa7b2b2d7757',
      createdBy: 'WKBWEg3DSfcdSbLNJfzGEW3vkct1',
      _lastModifiedByName: 'Georgios Pagonis',
      projectId: 'proj_04a6b4bb-31ba-47b0-9468-1b2b777508cb',
      buildingId: 'bldg_8acc7e34-59bd-4dfb-8a56-e2568686250f',
      code: 'A-ME-1.01',
      levelData: { some: 'internal' },
    } as ProjectableProperty;

    const listing = buildPublicListing(withSecrets, NO_PLACE, AT);
    expect(listing).not.toBeNull();

    const serialized = JSON.stringify(listing);
    for (const secret of ['comp_9c7c1a50', 'WKBWEg3D', 'Georgios Pagonis', 'proj_04a6b4bb', 'bldg_8acc7e34', 'A-ME-1.01', 'levelData']) {
      expect(serialized).not.toContain(secret);
    }
  });

  /**
   * ⚠️ **Το `place` προστέθηκε στις 2026-08-11, και αυτή η άγκυρα το ζήτησε ρητά** —
   * έγινε κόκκινη τη στιγμή που το πεδίο μπήκε. Είναι ακριβώς η δουλειά της: το σχήμα
   * είναι **απόφαση αποκάλυψης** (*«ό,τι δεν είναι γραμμένο εδώ, δεν φεύγει ποτέ»*),
   * οπότε κάθε νέο κλειδί οφείλει να περάσει από ανθρώπινο χέρι.
   *
   * 🔑 Και είναι ασφαλές για **δομικό** λόγο: το `land_*`/`pbld_*` δείχνει στο **κοινό**
   * επίπεδο Α, που ο κανόνας Firestore δίνει σε **κάθε** επισκέπτη (`read: if true`).
   * Ο έλεγχος διαρροής από πάνω (Κ4) το επιβεβαιώνει ανεξάρτητα: καμία ταυτότητα
   * πελάτη, χρήστη, έργου ή κτιρίου-επιπέδου-Β δεν εμφανίζεται στη σειριοποίηση.
   */
  it('το σχήμα εξόδου είναι ΚΛΕΙΣΤΟ — ακριβώς τα δηλωμένα κλειδιά', () => {
    const listing = buildPublicListing(REAL_MAISONETTE, NO_PLACE, AT)!;
    expect(Object.keys(listing).sort()).toEqual([
      // §8.33: `agencyName` + `authorship` — **η άγκυρα κοκκίνισε τη στιγμή που
      // μπήκαν**, και αυτό είναι η δουλειά της. Πέρασαν από απόφαση: η **κλάση**
      // προέλευσης δεν είναι ταυτότητα, και η **επωνυμία** είναι επιχείρησης, ποτέ
      // προσώπου (απόφαση Giorgio 2026-08-20). Δες `Υ1`-`Υ3` πιο κάτω.
      'agencyName',
      'areaSqm', 'authorship', 'bedrooms', 'commercial', 'commercialStatus', 'coverImage',
      'floor', 'id', 'offerKinds', 'place', 'position', 'projectedAt', 'title', 'type',
    ]);
  });

  // ===========================================================================
  // Υ — Η ΥΠΟΓΡΑΦΗ ΤΗΣ ΑΓΓΕΛΙΑΣ (§8.33)
  // ===========================================================================

  describe('🔴 Υ — ο επισκέπτης μαθαίνει ΤΙ ΕΙΔΟΥΣ γνώση είναι αυτή η γραμμή', () => {
    it('🔑 Υ1 — αγγελία ΓΡΑΦΕΙΟΥ κουβαλά κλάση ΚΑΙ επωνυμία', () => {
      const listing = buildPublicListing(
        { ...REAL_MAISONETTE, authorship: 'agency', agencyName: 'ΑΛΦΑ ΜΕΣΙΤΙΚΗ' },
        NO_PLACE,
        AT,
      )!;
      expect(listing.authorship).toBe('agency');
      expect(listing.agencyName).toBe('ΑΛΦΑ ΜΕΣΙΤΙΚΗ');
    });

    it('🔴 Υ2 — αγγελία ΙΔΙΩΤΗ: καμία επωνυμία υπάρχει καν ως τιμή', () => {
      const listing = buildPublicListing(
        { ...REAL_MAISONETTE, authorship: 'owner-declared', agencyName: null },
        NO_PLACE,
        AT,
      )!;
      expect(listing.authorship).toBe('owner-declared');
      expect(listing.agencyName).toBeNull();
    });

    it('🔑 Υ3 — ΑΠΟΥΣΙΑ ⇒ `agency`, γιατί ο μόνος παραγωγός που το παραλείπει είναι το `properties`', () => {
      // Ο παρονομαστής: το `REAL_MAISONETTE` είναι **ωμό έγγραφο έργου**, ακριβώς όπως
      // το διαβάζει το `publish-public-listing.ts` — δεν έχει `authorship`.
      expect('authorship' in REAL_MAISONETTE).toBe(false);
      const listing = buildPublicListing(REAL_MAISONETTE, NO_PLACE, AT)!;
      // Και η προεπιλογή είναι προς την **ακριβή** κατεύθυνση: ένα ακίνητο έργου
      // ΑΝΗΚΕΙ σε εταιρεία (το `assertPropertyCreatePolicy` απαιτεί `projectId`
      // πάντα). Ένα `owner-declared` εδώ θα **αφαιρούσε** γνώση που έχουμε.
      expect(listing.authorship).toBe('agency');
      expect(listing.agencyName).toBeNull();
    });
  });

  /**
   * 🔴 **Η ΑΓΚΥΡΑ ΤΟΥ §14.5** — ο λόγος που το πεδίο υπάρχει.
   *
   * Χωρίς αυτήν, το `place` θα μπορούσε να μείνει σιωπηλά `null` για κάθε αγγελία
   * (ένα `?? null` που κανείς δεν τροφοδοτεί) και η Ζ3/Ζ5 θα εξακολουθούσε να απαντά
   * `place-unresolved` — με το πεδίο **παρόν** και το σχήμα **πράσινο**. Δηλαδή το
   * ακριβές σχήμα «0 = κανείς δεν κοίταξε», μεταμφιεσμένο σε ολοκληρωμένη δουλειά.
   */
  it('🔑 ο ΔΕΣΜΟΣ προς το επίπεδο Α ταξιδεύει αυτούσιος — ζήτηση και προσφορά δείχνουν στο ΙΔΙΟ', () => {
    const ref = { landId: 'land_1', buildingId: 'pbld_1' };

    // ⚠️ Ο δεσμός έρχεται από τη **γνώση τόπου**, όχι από το ακίνητο (Β3): ο ιδιώτης
    // τον δηλώνει στο δικό του έγγραφο, ο επαγγελματίας τον κληρονομεί από το κτίριο,
    // και το `buildPublicListing` έχει **μία** είσοδο για ένα πεδίο εξόδου.
    const linked = buildPublicListing(REAL_MAISONETTE, { candidates: [], ref }, AT)!;
    expect(linked.place).toEqual(ref);

    // …και η απουσία μένει **ρητή**, ποτέ `undefined`.
    expect(buildPublicListing(REAL_MAISONETTE, NO_PLACE, AT)!.place).toBeNull();
  });
});

describe('Κ5 — τιμή: ωμοί αριθμοί, καμία δεύτερη μηχανή', () => {
  it('περνούν αυτούσιοι ώστε να τους λύσει ο ΥΠΑΡΧΩΝ SSoT τιμής', () => {
    const listing = buildPublicListing(REAL_MAISONETTE, NO_PLACE, AT)!;
    expect(listing.commercial).toEqual({
      askingPrice: 200000,
      finalPrice: null,
      rentPrice: null,
      // ADR-835 §4.5 — το τέταρτο ποσό ταξιδεύει **ωμό**, όπως τα τρία από πάνω.
      // `null` εδώ επειδή αυτό το ακίνητο δεν διατίθεται για διανυκτέρευση.
      nightlyRate: null,
    });
  });

  it('το 0 είναι ΤΙΜΗ, η απουσία είναι null — δεν συγχέονται', () => {
    const listing = buildPublicListing(
      { ...REAL_MAISONETTE, floor: 0, layout: { bedrooms: 0 } }, NO_PLACE, AT
    )!;
    expect(listing.floor).toBe(0);
    expect(listing.bedrooms).toBe(0);
    expect(buildPublicListing(REAL_MAISONETTE, NO_PLACE, AT)!.bedrooms).toBe(3);
    expect(buildPublicListing({ id: 'x', commercialStatus: 'for-sale' }, NO_PLACE, AT)!.bedrooms).toBeNull();
  });
});

describe('Κ6 — το null ΕΙΝΑΙ εντολή διαγραφής', () => {
  it('μη δημοσιευμένο ⇒ null, ώστε η απόσυρση να ΣΥΜΒΑΙΝΕΙ αντί να αφήνει ορφανό έγγραφο', () => {
    expect(buildPublicListing({ id: 'p', commercialStatus: 'sold' }, NO_PLACE, AT)).toBeNull();
  });
});

describe('Κ7 — η προέλευση συνάγεται από ΤΑ ΔΕΔΟΜΕΝΑ', () => {
  it('συντεταγμένες ΜΕ μεταδεδομένα geocoder ⇒ geocoded, και κουβαλά την ακρίβεια', () => {
    const c = addressToPositionCandidate(
      { coordinates: { lat: 40.64, lng: 22.94 }, geocodingMetadata: { accuracy: 'center' } }, AT
    );
    expect(c).toMatchObject({ provenance: 'geocoded', accuracy: 'center' });
  });

  it('🔴 συντεταγμένες ΧΩΡΙΣ geocoder ⇒ manual, ΟΧΙ «geocoded/center»', () => {
    const c = addressToPositionCandidate({ coordinates: { lat: 40.64, lng: 22.94 } }, AT);
    expect(c).toMatchObject({ provenance: 'manual' });
    // Το εύκολο λάθος θα έκρυβε γνώση: σκιασμένη πόλη εκεί που άνθρωπος έδειξε σημείο.
    expect(c).not.toMatchObject({ provenance: 'geocoded' });
  });

  it('χωρίς συντεταγμένες ⇒ null — καμία υποψήφια, ποτέ lat/lng 0', () => {
    expect(addressToPositionCandidate({}, AT)).toBeNull();
    expect(addressToPositionCandidate({ coordinates: { lat: null, lng: null } }, AT)).toBeNull();
  });

  it('🔑 ΤΟ ΠΡΑΓΜΑΤΙΚΟ ΕΡΓΟ: «Εγνατίας 147» ΔΕΝ έχει coordinates ⇒ καμία θέση σήμερα', () => {
    // Αντιγραμμένο από τη ζωντανή βάση (proj_2497601f…, addresses[0]).
    const real = { street: 'Εγνατίας', number: '147', city: 'Θεσσαλονίκη', postalCode: '54622', isPrimary: true };
    expect(addressToPositionCandidate(real, AT)).toBeNull();
  });
});

// =============================================================================
// Κ6 — 🔴 Η ΑΣΥΜΜΕΤΡΙΑ ΤΩΝ ΔΥΟ ΛΕΞΙΛΟΓΙΩΝ, ΚΛΕΙΣΤΗ
// =============================================================================
//
// Η `isPubliclyListed` δεχόταν **δύο** λεξιλόγια, η γραμμή του `offerKinds` **ένα**.
// Ζωντανή μέτρηση 2026-08-11: **6/6** δημόσιες αγγελίες με σωστό `commercialStatus`
// και `offerKinds: []` ⇒ έξι κάρτες **χωρίς είδος διάθεσης**, όλες οι πύλες πράσινες.

describe('Κ6 — η προβολή μιλά και τα ΔΥΟ λεξιλόγια στο offerKinds', () => {
  it('🔴 ΤΟ ΕΛΑΤΤΩΜΑ: πραγματικό έγγραφο προ-Α20 δεν βγαίνει πια με κενό άξονα', () => {
    const listing = buildPublicListing(REAL_MAISONETTE, NO_PLACE, AT)!;
    expect(listing.offerKinds).toEqual(['sell']);
  });

  it.each([
    ['for-sale', ['sell']],
    ['for-rent', ['leaseOut']],
    ['for-sale-and-rent', ['leaseOut', 'sell']],
  ] as const)('%s χωρίς offerKinds → [%s]', (commercialStatus, expected) => {
    const listing = buildPublicListing({ id: 'p', commercialStatus }, NO_PLACE, AT)!;
    expect(listing.offerKinds).toEqual(expected);
  });

  it('🔑 ΤΟ ΝΕΟ ΛΕΞΙΛΟΓΙΟ ΝΙΚΑ ΟΤΑΝ ΥΠΑΡΧΕΙ — η εφεδρεία δεν το σκεπάζει ποτέ', () => {
    // Έγγραφο μετά την Α20: πώληση ενεργή ΚΑΙ αντιπαροχή. Το παλιό λεξιλόγιο θα
    // έλεγε μόνο `['sell']` — και θα έσβηνε σιωπηλά την αντιπαροχή.
    const listing = buildPublicListing(
      { id: 'p', commercialStatus: 'for-sale', offerKinds: ['exchange', 'sell'] },
      NO_PLACE,
      AT
    )!;
    expect(listing.offerKinds).toEqual(['exchange', 'sell']);
  });

  it('offerKinds με ΜΟΝΟ άγνωστη λέξη ⇒ πέφτει στην εφεδρεία, δεν μένει κενό', () => {
    const listing = buildPublicListing(
      { id: 'p', commercialStatus: 'for-rent', offerKinds: ['barter'] },
      NO_PLACE,
      AT
    )!;
    expect(listing.offerKinds).toEqual(['leaseOut']);
  });

  it('η ωμή άγνωστη λέξη ΔΕΝ διαρρέει ποτέ στο δημόσιο έγγραφο', () => {
    const listing = buildPublicListing(
      { id: 'p', commercialStatus: 'unavailable', offerKinds: ['barter', 'exchange'] },
      NO_PLACE,
      AT
    )!;
    expect(listing.offerKinds).toEqual(['exchange']);
  });

  it('εφεδρικό πεδίο `status` όταν λείπει το `commercialStatus` — ίδια αλυσίδα με τη γρ. 203', () => {
    const listing = buildPublicListing({ id: 'p', status: 'for-rent' }, NO_PLACE, AT)!;
    expect(listing.offerKinds).toEqual(['leaseOut']);
  });
});

// =============================================================================
// Κ7 — ⛔ Η ΜΕΤΑΦΡΑΣΗ ΔΕΝ ΕΙΝΑΙ ΣΚΕΛΟΣ ΚΑΝΟΝΑ ΔΗΜΟΣΙΕΥΣΗΣ
// =============================================================================
//
// 🔴 Η **μοναδική** επικίνδυνη χρήση της αντιστροφής: το `sold` **αποδεικνύει**
// `['sell']`, οπότε αν η εφεδρεία τροφοδοτούσε την `isPubliclyListed`, κάθε
// **πουλημένο** ακίνητο θα έβγαινε ξανά **στην αγορά**. Οι άγκυρες παρακάτω είναι
// ο λόγος που η εφεδρεία ζει **μετά** την πύλη και ποτέ μέσα της.

describe('Κ7 — καμία κατάσταση δεν αποκτά δημοσίευση από την εφεδρεία', () => {
  it.each(['sold', 'rented', 'reserved', 'unavailable'] as const)(
    '⛔ %s χωρίς offerKinds ⇒ ΚΑΜΙΑ προβολή (η μετάφραση δεν δημοσιεύει)',
    (commercialStatus) => {
      const property: ProjectableProperty = { id: 'p', commercialStatus };
      expect(isPubliclyListed(property)).toBe(false);
      expect(buildPublicListing(property, NO_PLACE, AT)).toBeNull();
    }
  );

  it('🔑 και η απόδειξη ότι η άγκυρα ΔΕΝ είναι κενή: το sold ΟΝΤΩΣ ονομάζει είδος', () => {
    // Αν η μετάφραση επέστρεφε `[]` για το `sold`, η άγκυρα παραπάνω θα περνούσε
    // για λάθος λόγο — «πράσινο επειδή κανείς δεν κοίταξε».
    expect(offerKindsFromLegacyStatus('sold')).toEqual(['sell']);
  });
});

// ============================================================================
// Κ8 — ΤΟ ΔΗΛΩΜΕΝΟ `offerKinds` ΔΕΝ ΑΝΑΣΤΑΙΝΕΙ ΠΟΥΛΗΜΕΝΟ  (ADR-777 Α14, 2026-08-11)
// ============================================================================
//
// 🔴 Το Κ7 φρουρεί τη **μετάφραση** (`offerKindsFromLegacyStatus`). Αυτό εδώ φρουρεί
// το **δηλωμένο** πεδίο — και είναι **άλλη διαδρομή προς το ίδιο ελάττωμα**:
//
//   `LIVE_OFFER_LIFECYCLES` περιλαμβάνει ΣΚΟΠΙΜΑ το `closed` (έτσι παράγεται το
//   `sold`), άρα `deriveOfferKinds` πουλημένης μονάδας ⇒ `['sell']` ⇒ το δεύτερο
//   σκέλος της πύλης θα την κρατούσε **στην αγορά**.
//
// ⚠️ Μέχρι σήμερα ήταν **λανθάνον**: κανένα έγγραφο δεν έγραφε `offerKinds`. Η **Α14**
// (προσφορά ιδιώτη) είναι το ΠΡΩΤΟ που το γράφει πραγματικά — άρα η άγκυρα μπήκε
// **πριν** το πρώτο ζωντανό έγγραφο, όχι μετά το πρώτο περιστατικό.

describe('Κ8 — δηλωμένο offerKinds + τελική κατάσταση ⇒ ΚΑΜΙΑ προβολή', () => {
  it.each(['sold', 'rented'] as const)(
    '⛔ %s ΜΕ δηλωμένο offerKinds ⇒ δεν δημοσιεύεται',
    (commercialStatus) => {
      const property: ProjectableProperty = {
        id: 'p',
        commercialStatus,
        offerKinds: ['sell', 'leaseOut'],
      };
      expect(isPubliclyListed(property)).toBe(false);
      expect(buildPublicListing(property, NO_PLACE, AT)).toBeNull();
    }
  );

  it('🔑 ο παρονομαστής: η ΙΔΙΑ δήλωση σε ΜΗ τελική κατάσταση ΔΗΜΟΣΙΕΥΕΤΑΙ', () => {
    // Χωρίς αυτό, η άγκυρα παραπάνω θα ήταν πράσινη ακόμη κι αν το `offerKinds`
    // αγνοούνταν ολότελα — «πράσινο επειδή κανείς δεν κοίταξε».
    const live: ProjectableProperty = {
      id: 'p',
      commercialStatus: 'unavailable',
      offerKinds: ['exchange'],
    };
    expect(isPubliclyListed(live)).toBe(true);
  });
});

// ============================================================================
// Κ1 — Η ΠΥΛΗ ΔΗΜΟΣΙΕΥΣΗΣ ΜΕΤΑ ΤΗ ΔΙΑΣΠΑΣΗ (ADR-777 §8.22, 2026-08-12)
// ============================================================================
//
// 🔴 Το `buildPublicListing` χωρίστηκε σε **πύλη** + **σχήμα** ώστε το δόλωμα του
// §12.6 να μπορεί να κρίνει ακίνητο που ο ιδιοκτήτης **δεν έχει ανεβάσει**. Η
// διάσπαση δημιουργεί έναν **νέο κίνδυνο με όνομα**: κάποιος να χρησιμοποιήσει το
// ασύδοτο `projectListingShape` εκεί όπου **γράφεται** η δημόσια προβολή — δηλαδή να
// βγάλει στον κόσμο ακίνητο που η πολιτική απαγορεύει, **χωρίς να αλλάξει η πολιτική**.
//
// ⚠️ Η δεύτερη άγκυρα διαβάζει **πραγματικό αρχείο πηγής**, όχι fixture: ο γραφέας
// είναι *άλλο module*, και ένα test που τον προσομοιώνει δεν αποδεικνύει τίποτα για
// εκείνον.

describe('🔴 Κ1 — η πύλη ζει στο `buildPublicListing`· ο ΓΡΑΦΕΑΣ περνά από αυτήν', () => {
  const HIDDEN: ProjectableProperty = {
    id: 'prop_hidden',
    name: 'Κλειστό κατάστημα',
    type: 'commercial',
    commercialStatus: 'unavailable',
    offerKinds: [],
  };

  it('η ΠΥΛΗ αρνείται — καμία δημόσια προβολή για μη δηλωμένο ακίνητο', () => {
    expect(isPubliclyListed(HIDDEN)).toBe(false);
    expect(buildPublicListing(HIDDEN, NO_PLACE, AT)).toBeNull();
  });

  it('🔑 το ΣΧΗΜΑ δίνει δομή για το ΙΔΙΟ ακίνητο — αλλιώς το δόλωμα δεν έχει τι να κρίνει', () => {
    const shape = projectListingShape(HIDDEN, NO_PLACE, AT);
    expect(shape.id).toBe('prop_hidden');
    expect(shape.offerKinds).toEqual([]);
  });

  it('ταυτότητα: όπου η πύλη ΠΕΡΝΑ, τα δύο μονοπάτια δίνουν ΤΟ ΙΔΙΟ έγγραφο', () => {
    // Ο παρονομαστής της διάσπασης: «καμία αλλαγή συμπεριφοράς» είναι ισχυρισμός
    // μέχρι να συγκριθούν τα δύο αποτελέσματα πάνω σε είσοδο που περνά.
    expect(buildPublicListing(REAL_MAISONETTE, NO_PLACE, AT)).toEqual(
      projectListingShape(REAL_MAISONETTE, NO_PLACE, AT)
    );
  });

  it('⛔ ο γραφέας της προβολής ΔΕΝ εισάγει το ασύδοτο σχήμα', () => {
    const writer = readFileSync(
      join(__dirname, '..', 'publish-public-listing.ts'),
      'utf8'
    );
    expect(writer).toContain('buildPublicListing');
    expect(writer).not.toContain('projectListingShape');
  });
});
