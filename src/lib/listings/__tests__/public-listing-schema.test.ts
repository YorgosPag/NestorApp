/**
 * Άγκυρες της **έκδοσης σχήματος** και της αλυσίδας μεταναστεύσεων (ADR-839).
 *
 * ⚠️ Η κύρια είσοδος είναι **αντιγραμμένη αυτούσια από την παραγωγή** — το έγγραφο
 * `ownp_330a5a4b…` όπως το επέστρεψε η Firestore στις 2026-08-31, τη μέρα που η
 * σελίδα του κατέρρευσε. Ένα επινοημένο fixture θα είχε τα πεδία που λείπουν, άρα
 * θα ήταν πράσινο για λάθος λόγο.
 *
 * 🔴 Η ΚΡΙΣΙΜΗ ΕΙΝΑΙ Η Κ7: ρωτά τον **γραφέα** τι πεδία υπάρχουν και απαιτεί η
 * αλυσίδα να τα φτάνει όλα από την v1. Είναι ο λόγος που δεν χρειάζεται δεύτερη
 * χειρόγραφη λίστα πεδίων πουθενά.
 */

import {
  LISTING_MIGRATIONS,
  PUBLIC_LISTING_SCHEMA_VERSION,
  UNSTAMPED_SCHEMA_VERSION,
  storedSchemaVersion,
  upgradeListingDocument,
  type StoredListingDocument,
} from '../public-listing-schema';
import { readStoredListing, publicListingFromDocument } from '../public-listing-from-document';
import {
  projectListingShape,
  type PlaceKnowledge,
  type ProjectableProperty,
} from '@/services/listings/public-listing-projection';

// ============================================================================
// ΤΟ ΠΡΑΓΜΑΤΙΚΟ ΕΓΓΡΑΦΟ ΠΟΥ ΕΡΙΞΕ ΤΗ ΣΕΛΙΔΑ
// ============================================================================

/**
 * `public_listings/ownp_330a5a4b-3d36-41a6-8f61-b5a85f1ae9d1`, **αυτούσιο**.
 *
 * Δεν έχει `legality`, δεν έχει `stay`, δεν έχει `commercial.nightlyRate`, και δεν
 * έχει `schemaVersion` — γράφτηκε 06:46:59, ώρες πριν τα τρία πεδία μπουν στον τύπο.
 */
const PRODUCTION_V1: StoredListingDocument = {
  id: 'ownp_330a5a4b-3d36-41a6-8f61-b5a85f1ae9d1',
  commercialStatus: 'for-sale',
  commercial: { askingPrice: 150000, finalPrice: null, rentPrice: null },
  coverImage: null,
  gallery: [],
  type: 'plot',
  areaSqm: 500,
  offerKinds: ['sell'],
  position: { kind: 'unknown', reason: 'owner-declined' },
  place: null,
  floor: null,
  bedrooms: null,
  title: 'TEST-2 ADR-834',
  authorship: 'owner-declared',
  agencyName: null,
  agencyId: null,
  projectedAt: '2026-08-31T06:46:59.692Z',
};

const LISTING_ID = 'ownp_330a5a4b-3d36-41a6-8f61-b5a85f1ae9d1';

// ============================================================================
// ΒΟΗΘΟΙ — μόνο για τις άγκυρες
// ============================================================================

/** Κάθε **φύλλο** ενός αντικειμένου, ως διαδρομή. `null` και πίνακες είναι φύλλα. */
function leafPaths(value: unknown, prefix = ''): readonly string[] {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return [prefix];
  const entries = Object.entries(value);
  if (entries.length === 0) return [prefix];
  return entries.flatMap(([key, nested]) =>
    leafPaths(nested, prefix === '' ? key : `${prefix}.${key}`)
  );
}

/**
 * **Απαντήθηκε αυτή η διαδρομή;** — το ερώτημα που όντως έχει σημασία.
 *
 * 🔴 **ΔΕΝ ρωτά «ίδια τιμή», και η διάκριση κόστισε μια κόκκινη άγκυρα**: όταν το
 * `stay` είναι νόμιμα `null` (ακίνητο που δεν είναι κατάλυμα), τα `stay.minNights`
 * κ.λπ. **δεν υπάρχουν και δεν πρέπει** — η οθόνη το ξέρει, γιατί ο τύπος λέει
 * `PublicListingStay | null` και την αναγκάζει να ελέγξει. Η πρώτη διατύπωση
 * απαιτούσε να «επανέλθουν» και κοκκίνιζε για **σωστή** συμπεριφορά.
 *
 * Το πραγματικό ερώτημα είναι *«θα διάβαζε η οθόνη `undefined`;»*: `null` σε
 * πρόγονο = **απαντημένο**· `undefined` οπουδήποτε = **η βλάβη της 31/08**.
 */
function isAnswered(doc: unknown, path: string): boolean {
  let cursor: unknown = doc;

  for (const key of path.split('.')) {
    if (cursor === null) return true; // ρητή απουσία — δηλωμένη, άρα απαντημένη
    if (typeof cursor !== 'object' || !(key in (cursor as Record<string, unknown>))) return false;
    cursor = (cursor as Record<string, unknown>)[key];
  }
  return cursor !== undefined;
}

/** Σβήνει μια διαδρομή — για να κατασκευαστεί «έγγραφο όπως ήταν πριν τον κρίκο». */
function omitPath(doc: StoredListingDocument, path: string): StoredListingDocument {
  const [head, ...rest] = path.split('.');
  const copy: Record<string, unknown> = { ...doc };

  if (rest.length === 0) {
    delete copy[head];
    return copy;
  }
  const nested = copy[head];
  if (typeof nested === 'object' && nested !== null) {
    copy[head] = omitPath(nested as StoredListingDocument, rest.join('.'));
  }
  return copy;
}

// ============================================================================

describe('Κ1 — το έγγραφο που έριξε τη σελίδα, ΔΕΝ τη ρίχνει πια', () => {
  it('🔴 το `legality` γίνεται ΚΕΝΟΣ ΠΙΝΑΚΑΣ, άρα το `.map` της οθόνης δουλεύει', () => {
    const listing = publicListingFromDocument(PRODUCTION_V1, LISTING_ID);

    expect(listing).not.toBeNull();
    expect(listing!.legality).toEqual([]);
    // Η ακριβής πράξη που πέταξε στην παραγωγή:
    expect(() => listing!.legality.map((signal) => signal.kind)).not.toThrow();
  });

  it('τα άλλα δύο πεδία του ADR-835 αποκτούν κι αυτά την προεπιλογή τους', () => {
    const listing = publicListingFromDocument(PRODUCTION_V1, LISTING_ID)!;

    expect(listing.stay).toBeNull();
    expect(listing.commercial.nightlyRate).toBeNull();
  });

  it('🔴 ό,τι ΥΠΗΡΧΕ δεν αγγίζεται — η αναβάθμιση δεν είναι ξαναγράψιμο', () => {
    const listing = publicListingFromDocument(PRODUCTION_V1, LISTING_ID)!;

    expect(listing.commercial.askingPrice).toBe(150000);
    expect(listing.offerKinds).toEqual(['sell']);
    expect(listing.title).toBe('TEST-2 ADR-834');
    expect(listing.projectedAt).toBe('2026-08-31T06:46:59.692Z');
  });
});

describe('Κ2 — η έκδοση: η απουσία ΕΙΝΑΙ πληροφορία', () => {
  it('έγγραφο χωρίς σφραγίδα διαβάζεται ως v1', () => {
    expect(storedSchemaVersion(PRODUCTION_V1)).toBe(UNSTAMPED_SCHEMA_VERSION);
  });

  it('η ανάγνωση αναφέρει ΟΤΙ ήταν παλιό — αλλιώς κανείς δεν θα το μάθαινε ποτέ', () => {
    const read = readStoredListing(PRODUCTION_V1, LISTING_ID)!;

    expect(read.storedVersion).toBe(1);
    expect(read.needsRebuild).toBe(true);
  });

  it('φρέσκο έγγραφο δεν ζητά επανασύνθεση', () => {
    const fresh = { ...PRODUCTION_V1, schemaVersion: PUBLIC_LISTING_SCHEMA_VERSION };
    expect(readStoredListing(fresh, LISTING_ID)!.needsRebuild).toBe(false);
  });

  it('🔴 σφραγίδα-σκουπίδι δεν περνά για έκδοση (θα παρέκαμπτε την αλυσίδα)', () => {
    expect(storedSchemaVersion({ schemaVersion: 'δύο' })).toBe(1);
    expect(storedSchemaVersion({ schemaVersion: 2.5 })).toBe(1);
    expect(storedSchemaVersion({ schemaVersion: 0 })).toBe(1);
  });
});

describe('Κ3 — ιδιοδυναμία και η μελλοντική έκδοση', () => {
  it('δεύτερο πέρασμα δεν αλλάζει τίποτα', () => {
    const once = upgradeListingDocument(PRODUCTION_V1);
    expect(upgradeListingDocument(once)).toEqual(once);
  });

  it('🔴 έγγραφο ΝΕΟΤΕΡΟ από τον κώδικα επιστρέφεται ΑΥΤΟΥΣΙΟ (rolling deploy)', () => {
    const future = { ...PRODUCTION_V1, schemaVersion: 99, πεδίοΤουΜέλλοντος: 'x' };
    expect(upgradeListingDocument(future)).toBe(future);
  });
});

describe('Κ4 — `.catch()` και όχι `??`: η μορφή κρίνεται, δεν υποτίθεται', () => {
  it('🔴 `legality` με ΛΑΘΟΣ τύπο πέφτει στην προεπιλογή αντί να ταξιδέψει ως το `.map`', () => {
    const corrupt = { ...PRODUCTION_V1, legality: 'ναι' };
    expect(publicListingFromDocument(corrupt, LISTING_ID)!.legality).toEqual([]);
  });

  it('`legality` ΥΠΑΡΚΤΟ διατηρείται — η προεπιλογή δεν σβήνει γνώση', () => {
    const withSignal = {
      ...PRODUCTION_V1,
      legality: [{ state: 'undeclared', kind: 'energy-performance' }],
    };
    expect(publicListingFromDocument(withSignal, LISTING_ID)!.legality).toHaveLength(1);
  });

  it('`nightlyRate` μη-πεπερασμένο ⇒ null, ποτέ NaN σε τιμή', () => {
    const nan = { ...PRODUCTION_V1, commercial: { askingPrice: 1, nightlyRate: Number.NaN } };
    expect(publicListingFromDocument(nan, LISTING_ID)!.commercial.nightlyRate).toBeNull();
  });
});

describe('Κ5 — η ταυτότητα έρχεται από ΕΞΩ και νικά', () => {
  it('🔴 το `id` του εγγράφου υπερισχύει ενός `id` γραμμένου μέσα στο περιεχόμενο', () => {
    const lying = { ...PRODUCTION_V1, id: 'ownp_ΛΑΘΟΣ' };
    expect(publicListingFromDocument(lying, 'ownp_ΣΩΣΤΟ')!.id).toBe('ownp_ΣΩΣΤΟ');
  });

  it('ό,τι δεν είναι αντικείμενο ΔΕΝ είναι αγγελία — και δεν πετά', () => {
    for (const raw of [null, undefined, 'x', 42, []]) {
      expect(publicListingFromDocument(raw, LISTING_ID)).toBeNull();
    }
  });
});

describe('Κ6 — η αλυσίδα είναι συνεπής με τον εαυτό της', () => {
  it('🔴 η έκδοση ισούται με το πλήθος των κρίκων + 1', () => {
    expect(PUBLIC_LISTING_SCHEMA_VERSION).toBe(LISTING_MIGRATIONS.length + 1);
  });

  it('οι κρίκοι ανεβάζουν σε διαδοχικές εκδόσεις, χωρίς κενό', () => {
    LISTING_MIGRATIONS.forEach((migration, index) => {
      expect(migration.to).toBe(index + 2);
    });
  });

  it('🔴 το δηλωμένο `adds` ΕΚΤΕΛΕΙΤΑΙ — δεν είναι σχόλιο που πάλιωσε', () => {
    LISTING_MIGRATIONS.forEach((migration) => {
      const before: StoredListingDocument = migration.adds.reduce(omitPath, PRODUCTION_V1);
      const after = migration.apply(before);

      for (const path of migration.adds) {
        expect(leafPaths(after)).toContain(path);
      }
    });
  });

  it('κάθε κρίκος δηλώνει το ADR που τον γέννησε', () => {
    for (const migration of LISTING_MIGRATIONS) {
      expect(migration.adr).toMatch(/ADR-\d+/);
    }
  });
});

// ============================================================================
// Η ΠΥΛΗ
// ============================================================================

describe('Κ7 — 🔴 ΠΛΗΡΟΤΗΤΑ: ό,τι γράφει ο γραφέας, το φτάνει η αλυσίδα', () => {
  const AT = '2026-09-01T10:00:00.000Z';
  const NO_PLACE: PlaceKnowledge = { candidates: [], ref: null };

  /** Ακίνητο που ενεργοποιεί **κάθε** κλάδο του γραφέα — και τη βραχυχρόνια. */
  const EVERY_BRANCH: ProjectableProperty = {
    id: 'ownp_πληρότητα',
    name: 'Κάθε κλάδος',
    type: 'apartment',
    commercialStatus: 'for-sale',
    offerKinds: ['sell', 'leaseShort'],
    floor: 2,
    layout: { bedrooms: 3 },
    areas: { gross: 90 },
    commercial: { askingPrice: 200000, rentPrice: 900, nightlyRate: 80 },
    stay: { minNights: 2, maxGuests: 4 },
  };

  /**
   * 🔴 **Η ΑΓΚΥΡΑ ΠΟΥ ΚΑΝΕΙ ΠΕΡΙΤΤΗ ΤΗ ΔΕΥΤΕΡΗ ΛΙΣΤΑ ΠΕΔΙΩΝ.**
   *
   * Ρωτά τον **ίδιο τον γραφέα** ποια πεδία υπάρχουν (ο μεταγλωττιστής τον
   * αναγκάζει να τα γράφει όλα, γιατί επιστρέφει `PublicListing`), κατασκευάζει
   * το «όπως θα ήταν στην v1» αφαιρώντας ό,τι δηλώνει η αλυσίδα, και απαιτεί η
   * αναβάθμιση να τα ξαναφτάσει **όλα**.
   *
   * Αν αύριο μπει πεδίο στον τύπο χωρίς κρίκο, **αυτή η γραμμή κοκκινίζει** — και
   * είναι το ακριβές σφάλμα που έφτασε στην παραγωγή στις 31/08.
   */
  it('κάθε πεδίο του γραφέα ΑΠΑΝΤΙΕΤΑΙ μετά τη διαδρομή v1 → σήμερα', () => {
    const written = projectListingShape(EVERY_BRANCH, NO_PLACE, AT);
    const expected = leafPaths(written);

    const asV1 = LISTING_MIGRATIONS.flatMap((migration) => migration.adds).reduce(
      omitPath,
      written as unknown as StoredListingDocument
    );
    const upgraded = upgradeListingDocument(asV1);

    const unanswered = expected.filter((path) => !isAnswered(upgraded, path));
    expect(unanswered).toEqual([]);
  });

  it('🔴 Η ΑΓΚΥΡΑ ΜΠΟΡΕΙ ΝΑ ΚΟΚΚΙΝΙΣΕΙ: πεδίο χωρίς κρίκο ΔΕΝ απαντιέται', () => {
    // Προσομοιώνει το αυριανό λάθος — πεδίο στον τύπο, κανένας κρίκος γι' αυτό.
    // Χωρίς αυτή τη γραμμή, η Κ7 θα ήταν πράσινη ακόμη κι αν το `isAnswered`
    // επέστρεφε πάντα `true` (μάθημα: «άγκυρα χωρίς μετάλλαξη είναι σχόλιο»).
    const v1WithoutNewField = omitPath(PRODUCTION_V1, 'legality');
    expect(isAnswered(v1WithoutNewField, 'legality')).toBe(false);
    expect(isAnswered(upgradeListingDocument(v1WithoutNewField), 'legality')).toBe(true);
  });

  it('🔴 `null` σε πρόγονο ΕΙΝΑΙ απάντηση — το `stay` ακινήτου που δεν νοικιάζεται', () => {
    const notAStay = upgradeListingDocument(PRODUCTION_V1);
    expect(notAStay.stay).toBeNull();
    expect(isAnswered(notAStay, 'stay.minNights')).toBe(true);
  });

  it('🔴 ΑΝΤΙΣΤΡΟΦΑ: η αλυσίδα δεν εφευρίσκει πεδία που ο γραφέας δεν γράφει', () => {
    const written = projectListingShape(EVERY_BRANCH, NO_PLACE, AT);
    const restored = leafPaths(upgradeListingDocument(written as unknown as StoredListingDocument));

    // `schemaVersion` είναι η σφραγίδα που προσθέτει η αναβάθμιση — δες την
    // κεφαλίδα του `publish-public-listing.ts`: δεν ανήκει στο κλειστό σχήμα.
    const invented = restored.filter(
      (path) => path !== 'schemaVersion' && !leafPaths(written).includes(path)
    );
    expect(invented).toEqual([]);
  });
});
