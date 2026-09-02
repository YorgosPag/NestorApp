/**
 * @fileoverview ΑΓΚΥΡΑ — **ο μεταφραστής αγγελίας → μηχανής πληρότητας** (ADR-842 Φ5).
 * @related lib/listings/listing-completion-slice.ts · constants/property-completion.ts
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΓΙΑΤΙ ΑΥΤΗ Η ΑΓΚΥΡΑ ΤΡΕΧΕΙ ΤΗΝ **ΠΡΑΓΜΑΤΙΚΗ ΜΗΧΑΝΗ** ΚΑΙ ΟΧΙ ΜΟΝΟ ΤΗ ΦΕΤΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ένα test που ελέγχει μόνο ότι «το `areaSqm` έγινε `areaGross`» επιβεβαιώνει την
 * **αντιγραφή**, όχι το **αποτέλεσμα**. Οι αριθμοί που κουβαλά η τεκμηρίωση της Φ5
 * (παρονομαστές 23,0 · 14,0 · 9,0 · ταβάνι 91%) είναι **ισχυρισμοί για τη
 * βαθμολογία** — άρα ελέγχονται εκτελώντας το `assessPropertyCompleteness`.
 *
 * ⇒ Αν αύριο αλλάξει βάρος στη μηχανή, **αυτή η άγκυρα κοκκινίζει** και τα νούμερα
 * του ADR δεν παλιώνουν σιωπηλά. Είναι το ίδιο μάθημα με τους μπαγιάτικους αριθμούς
 * baseline του `CLAUDE.md` (N.12 · N.18 · CHECK 3.38), εφαρμοσμένο **πριν** συμβεί.
 */

import {
  assessPropertyCompleteness,
  type CompletionFormSlice,
} from '@/constants/property-completion';
import { FIELD_KEYS } from '@/constants/field-completion-weights';
import { UNASKED_LISTING_ATTRIBUTES, type PublicListing } from '@/types/public-listing';

import { listingCompletionArgs } from '../listing-completion-slice';

const AT = '2026-09-02T00:00:00.000Z';

/** Αγγελία **χωρίς κανένα** χαρακτηριστικό δηλωμένο — η βάση κάθε σεναρίου. */
function listing(over: Partial<PublicListing> = {}): PublicListing {
  return {
    id: 'prop_48a7caf6',
    commercialStatus: 'for-sale',
    commercial: { askingPrice: 170000, finalPrice: null, rentPrice: null, nightlyRate: null },
    stay: null,
    coverImage: null,
    gallery: [],
    type: 'apartment',
    areaSqm: null,
    offerKinds: ['sell'],
    position: { kind: 'unknown', reason: 'never-asked' },
    place: null,
    authorship: 'agency',
    agencyName: null,
    agencyId: null,
    floor: null,
    bedrooms: null,
    ...UNASKED_LISTING_ATTRIBUTES,
    title: 'Διαμέρισμα',
    legality: [],
    projectedAt: AT,
    ...over,
  };
}

/** Ο παρονομαστής που παράγει πράγματι η μηχανή για αυτή την αγγελία. */
function denominatorOf(over: Partial<PublicListing> = {}): number {
  return assessPropertyCompleteness(listingCompletionArgs(listing(over))).weightTotal;
}

// ============================================================================
// 1. Η ΜΕΤΡΗΣΗ ΤΗΣ §5.1 — ΕΚΤΕΛΕΣΙΜΗ, ΟΧΙ ΓΡΑΜΜΕΝΗ
// ============================================================================

describe('🏆 16 από τα 17 FIELD_KEYS τροφοδοτούνται από τη δημόσια αγγελία', () => {
  /** Αγγελία με **κάθε** στοιχείο που μπορεί να δώσει το δημόσιο σχήμα. */
  const fullyDeclared = listing({
    areaSqm: 95,
    netAreaSqm: 85,
    bedrooms: 3,
    bathrooms: 2,
    orientations: ['northeast'],
    condition: 'good',
    energyClass: 'B',
    heatingType: 'autonomous',
    coolingType: 'split-units',
    windowFrames: 'aluminium',
    glazing: 'double',
    flooring: ['tiles'],
    interiorFeatures: ['fireplace'],
    securityFeatures: ['alarm'],
    gallery: [
      { url: 'a', width: 1, height: 1, altKey: 'k', sources: [] },
      { url: 'b', width: 1, height: 1, altKey: 'k', sources: [] },
      { url: 'c', width: 1, height: 1, altKey: 'k', sources: [] },
      { url: 'd', width: 1, height: 1, altKey: 'k', sources: [] },
      { url: 'e', width: 1, height: 1, altKey: 'k', sources: [] },
      { url: 'f', width: 1, height: 1, altKey: 'k', sources: [] },
      { url: 'g', width: 1, height: 1, altKey: 'k', sources: [] },
      // 🔑 **ΟΚΤΩ** — το `optimal` του διαμερίσματος (`media-completion-thresholds`).
      //    Με επτά, οι φωτογραφίες θα ήταν **μερικές** και η άγκυρα θα μετρούσε δύο
      //    ελλείψεις αντί για μία, κρύβοντας το πραγματικό ερώτημα.
      { url: 'h', width: 1, height: 1, altKey: 'k', sources: [] },
    ],
  });

  const assessment = assessPropertyCompleteness(listingCompletionArgs(fullyDeclared));

  it('η μηχανή έχει ακριβώς 17 βαθμολογήσιμα πεδία (ο παρονομαστής της §5.1)', () => {
    expect(FIELD_KEYS).toHaveLength(17);
  });

  /**
   * 🔴 **ΤΟ ΕΥΡΗΜΑ ΤΗΣ §5.1, ΩΣ ΕΚΤΕΛΕΣΗ**: με το δημόσιο σχήμα γεμάτο, το **μόνο**
   * που μένει ακάλυπτο είναι η **κάτοψη** — γιατί το `ListingImage` δεν έχει είδος
   * (ADR-842 §8 #2). Αν αύριο κάποιος «απλοποιήσει» μια χαρτογράφηση, εδώ θα
   * εμφανιστεί **δεύτερο** όνομα και η άγκυρα θα κοκκινίσει.
   */
  it('🔴 το ΜΟΝΟ πεδίο που μένει ακάλυπτο είναι η κάτοψη (§8 #2)', () => {
    expect(assessment.missing).toEqual(['floorplan']);
  });

  it('όλα τα υπόλοιπα βαθμολογούνται ως πλήρη', () => {
    const incomplete = assessment.breakdown
      .filter((entry) => entry.status !== 'complete' && entry.status !== 'exempt')
      .map((entry) => entry.fieldKey);
    expect(incomplete).toEqual(['floorplan']);
  });

  /**
   * 📐 **ΤΟ ΤΑΒΑΝΙ ΤΗΣ ΚΑΤΟΨΗΣ ΕΙΝΑΙ ΦΡΑΓΜΕΝΟ, ΚΑΙ ΤΟ ΠΡΑΣΙΝΟ ΠΑΡΑΜΕΝΕΙ ΕΦΙΚΤΟ.**
   * Ο ισχυρισμός `21/23 = 91%` της κεφαλίδας του μεταφραστή, εκτελεσμένος. Αν πάψει
   * να ισχύει, η σωστή κίνηση είναι **εξαίρεση** της κάτοψης — όχι σιωπή — και αυτή η
   * γραμμή είναι που θα το πει.
   */
  it('📐 χωρίς κάτοψη το μέγιστο είναι 91% — ΠΑΝΩ από το κατώφλι του πράσινου', () => {
    expect(assessment.weightTotal).toBe(23);
    expect(assessment.weightEarned).toBe(21);
    expect(assessment.percentage).toBe(91);
    expect(assessment.bucketColor).toBe('green');
  });
});

// ============================================================================
// 2. Η ΠΙΣΤΗ ΜΕΤΑΦΡΑΣΗ — ο μεταφραστής ΔΕΝ ξαναερμηνεύει (Α5)
// ============================================================================

describe('πιστή μετάφραση — «δεν ρωτήθηκε» γίνεται απουσία, τίποτα άλλο', () => {
  it('null ⇒ undefined σε κάθε βαθμωτό', () => {
    const slice: CompletionFormSlice = listingCompletionArgs(listing()).formData;
    expect(slice.areaGross).toBeUndefined();
    expect(slice.areaNet).toBeUndefined();
    expect(slice.condition).toBeUndefined();
    expect(slice.energyClass).toBeUndefined();
  });

  it('null ⇒ undefined σε κάθε σύνολο· [] παραμένει [] (η τρίτη κατάσταση ΔΕΝ ισοπεδώνεται)', () => {
    const unasked = listingCompletionArgs(listing()).formData;
    expect(unasked.securityFeatures).toBeUndefined();

    const answeredNone = listingCompletionArgs(listing({ securityFeatures: [] })).formData;
    expect(answeredNone.securityFeatures).toEqual([]);
  });

  /**
   * 🔴 **Η ΔΗΛΩΜΕΝΗ ΑΠΟΚΛΙΣΗ (κεφαλίδα §1) — ΓΡΑΜΜΕΝΗ ΩΣ ΠΡΟΣΔΟΚΙΑ.**
   *
   * Το `[]` σημαίνει *«ο κάτοχος απάντησε: καμία»*, και η **λογιστική** της Φ3 το
   * μετρά ως δηλωμένο. Η **μηχανή** του ADR-287 ρωτά `length > 0`, άρα το μετρά ως
   * έλλειψη. Ο μεταφραστής **δεν το κρύβει** — δεν στέλνει δείκτη-φάντασμα.
   *
   * ⚠️ Αν κάποια μέρα αλλάξει η μηχανή (ξεχωριστό ADR, δες
   * `.claude-rules/pending-ratchet-work.md`), **αυτή η γραμμή θα κοκκινίσει** και θα
   * ζητήσει να ενημερωθεί η τεκμηρίωση μαζί. Αυτό είναι το ζητούμενο: η απόκλιση
   * είναι **δηλωμένη**, όχι ξεχασμένη.
   */
  it('🔴 δηλωμένο «καμία» ΔΕΝ κερδίζει βαθμό — η απόκλιση είναι δηλωμένη, όχι κρυφή', () => {
    const answeredNone = assessPropertyCompleteness(
      listingCompletionArgs(listing({ securityFeatures: [] })),
    );
    const entry = answeredNone.breakdown.find((b) => b.fieldKey === 'securityFeatures');
    expect(entry?.status).toBe('missing');
  });

  /**
   * 🔴 **ΤΟ ΙΔΙΟ ΚΡΙΤΗΡΙΟ ΜΕ ΤΗ ΛΟΓΙΣΤΙΚΗ**: «δηλωμένο» σημαίνει **ονομάσιμο**. Ένα
   * είδος που η οθόνη δεν μπορεί να ονομάσει δεν είναι γνώση — και αν ο δείκτης το
   * μετρούσε ως δηλωμένο, θα έλεγε στον κάτοχο ότι έχει κάτι που ο αγοραστής **δεν
   * βλέπει**. Ίδιο ψέμα με τη λίστα που λέει 11 και τον χάρτη που δείχνει 10.
   */
  it('🔴 το είδος περνά από την αυθεντία — μη ονομάσιμο ⇒ ΛΕΙΠΕΙ, όπως στη λογιστική', () => {
    expect(listingCompletionArgs(listing({ type: 'apartment' })).formData.type).toBe('apartment');

    // Παλαιά ελληνική τιμή: **ονομάσιμη** μέσω της αυθεντίας ⇒ κανονικοποιείται.
    expect(listingCompletionArgs(listing({ type: 'Αποθήκη' })).formData.type).toBe('storage');

    // Ανώνυμη τιμή ⇒ κενό, και η μηχανή τη μετρά ως **έλλειψη**.
    const unnamable = listing({ type: 'κάτι τυχαίο' as PublicListing['type'] });
    expect(listingCompletionArgs(unnamable).formData.type).toBe('');
    const entry = assessPropertyCompleteness(listingCompletionArgs(unnamable)).breakdown.find(
      (b) => b.fieldKey === 'type',
    );
    expect(entry?.status).toBe('missing');
  });
});

// ============================================================================
// 3. ΤΑ ΜΕΣΑ
// ============================================================================

describe('τα μέσα — φωτογραφίες από τη συλλογή, κάτοψη πάντα μηδέν (§8 #2)', () => {
  it('photos = gallery.length', () => {
    const media = listingCompletionArgs(
      listing({
        gallery: [
          { url: 'a', width: 1, height: 1, altKey: 'k', sources: [] },
          { url: 'b', width: 1, height: 1, altKey: 'k', sources: [] },
        ],
      }),
    ).mediaCounts;
    expect(media.photos).toBe(2);
  });

  it('⛔ floorplan = 0 πάντα — δηλωμένο κενό, όχι εικασία', () => {
    expect(listingCompletionArgs(listing()).mediaCounts.floorplan).toBe(0);
  });
});

// ============================================================================
// 4. ΤΑ ΕΠΙΠΕΔΑ — ΤΟ §8 #7 ΠΟΥ ΕΚΛΕΙΣΕ
// ============================================================================

describe('🔴 §8 #7 — ο αριθμός επιπέδων φτάνει στη βαθμολόγηση της κάτοψης', () => {
  const withPlanFor = (levels: PublicListing['levels']) =>
    assessPropertyCompleteness({
      ...listingCompletionArgs(listing({ type: 'maisonette', levels })),
      // Μία κάτοψη — το ερώτημα είναι *«αρκεί για πόσα επίπεδα;»*
      mediaCounts: { photos: 0, floorplan: 1 },
    });

  it('δηλωμένο 1 επίπεδο ⇒ μία κάτοψη αρκεί (πλήρης πίστωση)', () => {
    const entry = withPlanFor({ provenance: 'declared', value: 1, at: AT }).breakdown.find(
      (b) => b.fieldKey === 'floorplan',
    );
    expect(entry?.status).toBe('complete');
  });

  /**
   * 🔴 **ΤΟ ΠΡΑΓΜΑΤΙΚΟ ΕΥΡΗΜΑ**: πριν τη Φ5 η μεζονέτα του `prop_2d612992` έδινε
   * `levels: null` ⇒ `levelCount = 1` ⇒ **μία** κάτοψη έπαιρνε **πλήρη** πίστωση για
   * **δύο** ορόφους. Ένας ολόκληρος βαθμός που δεν δικαιούταν, και coaching που ποτέ
   * δεν ζητούσε την κάτοψη του δεύτερου ορόφου.
   */
  it('🔴 μετρημένα 2 επίπεδα ⇒ μία κάτοψη είναι ΜΕΡΙΚΗ, και η ζητά η δεύτερη', () => {
    const result = withPlanFor({
      provenance: 'measured',
      value: 2,
      at: AT,
      sourceRef: 'property-model:levels',
    });
    const entry = result.breakdown.find((b) => b.fieldKey === 'floorplan');
    expect(entry?.status).toBe('partial');
    expect(entry?.earned).toBe(1);
    expect(result.missing).toContain('floorplan');
  });

  it('άγνωστα επίπεδα ⇒ 1 — η ΣΥΝΤΗΡΗΤΙΚΗ επιλογή, δεν χρεώνει άγνωστα', () => {
    expect(listingCompletionArgs(listing({ levels: null })).levelCount).toBe(1);
  });

  it('⚠️ μη έγκυρος αριθμός επιπέδων ΔΕΝ μολύνει το ποσοστό', () => {
    for (const value of [0, -3, Number.NaN, Number.POSITIVE_INFINITY]) {
      const args = listingCompletionArgs(
        listing({ levels: { provenance: 'declared', value, at: AT } }),
      );
      expect(args.levelCount).toBe(1);
    }
  });
});

// ============================================================================
// 5. Ο ΠΑΡΟΝΟΜΑΣΤΗΣ — §8 #1 ΚΑΙ §8 #3, ΜΕ ΝΟΥΜΕΡΑ
// ============================================================================

describe('🔴 §8 #3 — το είδος διαλέγει τον ΣΩΣΤΟ πίνακα βαρών', () => {
  it('τα ονόματα του λεξιλογίου δίνουν τους δικούς τους παρονομαστές', () => {
    expect(denominatorOf({ type: 'apartment' })).toBe(23);
    expect(denominatorOf({ type: 'shop' })).toBe(14);
    expect(denominatorOf({ type: 'storage' })).toBe(9);
  });

  /**
   * 🔴 **ΤΟ ΣΙΩΠΗΛΑ ΛΑΘΟΣ ΠΑΡΟΝΟΜΑΣΤΗ, ΩΣ ΕΚΤΕΛΕΣΗ.** Πριν τη Φ5 ένα `'Αποθήκη'`
   * έπεφτε στον πίνακα του διαμερίσματος: **22,0** αντί για **9,0**, με τα υπνοδωμάτια
   * να ζητούνται ως **κρίσιμα** από αποθήκη.
   */
  it('🔴 παλαιά ελληνική τιμή Firestore παίρνει τον ΔΙΚΟ της πίνακα, όχι του διαμερίσματος', () => {
    expect(denominatorOf({ type: 'Αποθήκη' })).toBe(9);
    expect(denominatorOf({ type: 'Κατάστημα' })).toBe(14);
    expect(denominatorOf({ type: 'Στούντιο' })).toBe(21.5);
    expect(denominatorOf({ type: 'Γκαρσονιέρα' })).toBe(22);
  });

  it('η αποθήκη ΔΕΝ ζητά πια υπνοδωμάτια', () => {
    const assessment = assessPropertyCompleteness(
      listingCompletionArgs(listing({ type: 'Αποθήκη' })),
    );
    expect(assessment.exemptFields).toContain('bedrooms');
    expect(assessment.missingCritical).not.toContain('bedrooms');
  });

  it('άγνωστο είδος πέφτει στη συντηρητική προεπιλογή (διαμέρισμα)', () => {
    expect(denominatorOf({ type: 'κάτι τυχαίο' as PublicListing['type'] })).toBe(23);
  });
});

describe('🔴 §8 #1 — «σύντομα διαθέσιμο» δεν πληρώνει για ΠΕΑ που δεν εκδόθηκε', () => {
  /**
   * Απόφαση Giorgio 2026-09-02. Τα νούμερα: πλήρης **23,0** ⇒ προ-αποπεράτωσης
   * **14,5** *(−7,5 από τις επτά εξαιρέσεις, −1,0 από τις μισές φωτογραφίες)*.
   */
  it('η διάθεση «coming-soon» βγάζει φινιρίσματα/συστήματα/ΠΕΑ από τον παρονομαστή', () => {
    expect(denominatorOf({ commercialStatus: 'for-sale' })).toBe(23);
    expect(
      denominatorOf({ commercialStatus: 'coming-soon' as PublicListing['commercialStatus'] }),
    ).toBe(14.5);
  });

  it('⛔ και ΔΕΝ κρύβει τον δείκτη — μια δημοσιευμένη αγγελία δεν είναι πρόχειρο', () => {
    const assessment = assessPropertyCompleteness(
      listingCompletionArgs(
        listing({ commercialStatus: 'coming-soon' as PublicListing['commercialStatus'] }),
      ),
    );
    expect(assessment.shouldHide).toBe(false);
  });

  it('καμία διάθεση δεν κρύβει τον δείκτη', () => {
    for (const status of ['for-sale', 'sold', 'unavailable', 'reserved'] as const) {
      const assessment = assessPropertyCompleteness(
        listingCompletionArgs(listing({ commercialStatus: status })),
      );
      expect(assessment.shouldHide).toBe(false);
    }
  });
});

// ============================================================================
// 6. ΚΑΘΑΡΟΤΗΤΑ
// ============================================================================

describe('καθαρή συνάρτηση', () => {
  it('ίδια είσοδος ⇒ ίδια έξοδος', () => {
    const input = listing({ areaSqm: 95 });
    expect(listingCompletionArgs(input)).toEqual(listingCompletionArgs(input));
  });
});
