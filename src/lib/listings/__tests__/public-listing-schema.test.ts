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
} from '../public-listing-schema';
import type { StoredListingDocument } from '../public-listing-schema-types';
import { LISTING_MIGRATIONS_02_10 } from '../public-listing-migrations-02-10';
import { LISTING_MIGRATIONS_11_20 } from '../public-listing-migrations-11-20';
import { LISTING_MIGRATIONS_21_30 } from '../public-listing-migrations-21-30';
import { readStoredListing, publicListingFromDocument } from '../public-listing-from-document';
import { LISTING_MATERIAL_KEYS } from '../listing-authorship';
import {
  isPubliclyListed,
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

  /**
   * Κρίκος που γεμίζει πεδίο **μέσα** σε προαιρετικό κουτί (κρίκος 13: `stay.pets`) δεν αποδεικνύεται
   * σε έγγραφο **χωρίς** το κουτί — εκεί σωστά δεν προσθέτει τίποτα. Του δίνεται κατάλυμα, ώστε η
   * δήλωση να **εκτελείται** αντί να εξαιρείται.
   */
  const baseFor = (adds: readonly string[]): StoredListingDocument => {
    if (adds.some((path) => path.startsWith('stay.'))) {
      return { ...PRODUCTION_V1, offerKinds: ['leaseShort'], stay: { minNights: null, maxGuests: 2 } };
    }
    // Ίδιος λόγος για το κουτί του ΠΕΑ (κρίκος 23): το `PRODUCTION_V1` είναι οικόπεδο, όπου το κουτί είναι νόμιμα `null`.
    if (adds.some((path) => path.startsWith('energyCertificate.'))) {
      return { ...PRODUCTION_V1, type: 'apartment', energyCertificate: { primaryEnergy: null, co2Emissions: null, absence: null } };
    }
    // Ίδιος λόγος για την απόδοση περιοχής (κρίκος 28, ADR-890 §21): αγγελία χωρίς θέση έχει νόμιμα `adminArea: null`.
    if (adds.some((path) => path.startsWith('adminArea.'))) {
      return { ...PRODUCTION_V1, adminArea: { regionId: 'region:112', municipalityId: 'municipality:1303', nearBoundary: false } };
    }
    return PRODUCTION_V1;
  };

  it('🔴 το δηλωμένο `adds` ΕΚΤΕΛΕΙΤΑΙ — δεν είναι σχόλιο που πάλιωσε', () => {
    LISTING_MIGRATIONS.forEach((migration) => {
      const before: StoredListingDocument = migration.adds.reduce(omitPath, baseFor(migration.adds));
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

// ============================================================================
// Κ8 — 🏆 Ο ΚΡΙΚΟΣ ΤΗΣ Φ3 ΓΡΑΦΕΙ `null` ΣΤΑ ΣΥΝΟΛΑ, ΠΟΤΕ `[]`
// ============================================================================

/**
 * 🔴 **Η Κ7 ΔΕΝ ΜΠΟΡΕΙ ΝΑ ΤΟ ΠΙΑΣΕΙ, ΚΑΙ ΓΙ' ΑΥΤΟ ΥΠΑΡΧΕΙ ΑΥΤΗ Η ΟΜΑΔΑ.** Εκείνη
 * ρωτά *«απαντήθηκε η διαδρομή;»* — και **`[]` είναι απάντηση**, εξίσου με το `null`.
 * Δηλαδή ένας κρίκος που γέμιζε τα σύνολα με `[]` θα περνούσε **πράσινος**.
 *
 * Και θα ήταν **η χειρότερη δυνατή βλάβη της Φ3**: το `[]` σημαίνει *«ο κάτοχος
 * απάντησε: καμία παροχή»* (δες `ListingFeatureSetState`). Γραμμένο από μετανάστευση,
 * είναι **ισχυρισμός για λογαριασμό ανθρώπου που δεν ρωτήθηκε ποτέ** — και θα
 * κατέστρεφε **σιωπηλά** την τρίτη κατάσταση, σε **κάθε** παλιό έγγραφο ταυτόχρονα.
 * Ίδιο σχήμα με το *«αντικείμενο με μηδενικά»* που το ADR-835 §4.5 απέρριψε για το
 * `stay`, με τη διαφορά ότι εδώ η ζημιά είναι **μαζική και μη αναστρέψιμη από την όψη**.
 */
describe('Κ8 — 🏆 η τρίτη κατάσταση επιβιώνει της μετανάστευσης', () => {
  const PHASE3_SETS = [
    'flooring',
    'orientations',
    'interiorFeatures',
    'securityFeatures',
    'amenities',
  ] as const;

  it('παλιό έγγραφο ⇒ κάθε σύνολο είναι `null` («κανείς δεν ρώτησε»), όχι `[]`', () => {
    const upgraded = upgradeListingDocument(PRODUCTION_V1);
    for (const key of PHASE3_SETS) {
      expect([key, upgraded[key]]).toEqual([key, null]);
    }
  });

  it('και κάθε βαθμωτό είναι `null`, ποτέ `0` — το `0` είναι ΤΙΜΗ', () => {
    const upgraded = upgradeListingDocument(PRODUCTION_V1);
    for (const key of ['energyClass', 'condition', 'wc', 'balconies', 'netAreaSqm'] as const) {
      expect([key, upgraded[key]]).toEqual([key, null]);
    }
  });

  it('⚠️ έγγραφο που ΕΧΕΙ ήδη την απάντηση «καμία» δεν τη χάνει', () => {
    const answered = { ...PRODUCTION_V1, amenities: [] };
    expect(upgradeListingDocument(answered).amenities).toEqual([]);
  });
});

// ============================================================================
// ΚΡΙΚΟΣ 7 — ΤΟ ΠΑΓΩΜΕΝΟ `altKey` (ADR-841 Α15.6 · Ο-18)
// ============================================================================

describe('Κ9 — 🔴 ΤΟ ΠΑΓΩΜΕΝΟ `altKey` ΞΕΠΑΓΩΝΕΙ ΣΤΗΝ ΑΝΑΓΝΩΣΗ', () => {
  /** Το κλειδί που κουβαλούσαν και τα **6** ζωντανά έγγραφα πριν την Α15. */
  const FROZEN = 'search-results:detail.media.galleryAlt';

  const withGallery = (authorship: string | undefined, altKey: unknown): StoredListingDocument => {
    // ⚠️ Το `PRODUCTION_V1` **έχει** `authorship` — άρα η «απούσα» περίπτωση απαιτεί
    //    **αφαίρεση**, όχι παράλειψη. Ένα `...(x ? {x} : {})` εδώ θα άφηνε το πεδίο
    //    του προτύπου και η Κ9.3 θα δοκίμαζε **άλλο πράγμα** από αυτό που λέει.
    const { authorship: _dropped, ...withoutAuthorship } = PRODUCTION_V1 as Record<string, unknown>;
    const base = authorship === undefined ? withoutAuthorship : { ...withoutAuthorship, authorship };
    return {
      ...base,
      gallery: [{ url: 'https://shelf/a.webp', width: 640, height: 480, altKey, sources: [] }],
    };
  };

  const altKeyOf = (doc: StoredListingDocument): unknown =>
    (upgradeListingDocument(doc).gallery as readonly Record<string, unknown>[])[0].altKey;

  it('🔴 Κ9.1 — έγγραφο ΓΡΑΦΕΙΟΥ με το παλιό κλειδί ⇒ κλειδί ΓΡΑΦΕΙΟΥ', () => {
    // 🔴 **Η ΜΕΤΑΛΛΑΞΗ**: σβήσε τον κρίκο 7 ⇒ το παλιό όνομα επιβιώνει, και η οθόνη
    //    δείχνει **ωμό κλειδί** — χειρότερο από το ψέμα που η Α15 διόρθωσε.
    expect(altKeyOf(withGallery('agency', FROZEN))).toBe(LISTING_MATERIAL_KEYS.agency.galleryAlt);
  });

  it('🔴 Κ9.2 — έγγραφο ΙΔΙΩΤΗ με το ΙΔΙΟ παλιό κλειδί ⇒ κλειδί ΙΔΙΩΤΗ', () => {
    // Το ίδιο παγωμένο κλειδί, **δύο** προορισμοί: αν ο κρίκος γίνει σταθερός, το ένα
    // από τα δύο σκέλη πέφτει — όποια σταθερά κι αν διαλεχτεί.
    expect(altKeyOf(withGallery('owner-declared', FROZEN)))
      .toBe(LISTING_MATERIAL_KEYS['owner-declared'].galleryAlt);
  });

  it('⛔ Κ9.3 — ΑΠΟΥΣΑ ή άγνωστη προέλευση ⇒ `agency` (ο κανόνας της απουσίας, §8.33)', () => {
    // ⚠️ ΟΧΙ «άσ' το ως έχει»: αυτό θα άφηνε ωμό κλειδί σε **δημόσια** οθόνη —
    //    σιωπηλή βλάβη αντί για δηλωμένη προεπιλογή.
    expect(altKeyOf(withGallery(undefined, FROZEN))).toBe(LISTING_MATERIAL_KEYS.agency.galleryAlt);
    expect(altKeyOf(withGallery('σκουπίδι', FROZEN))).toBe(LISTING_MATERIAL_KEYS.agency.galleryAlt);
  });

  it('🔑 Κ9.4 — ΙΔΙΟΔΥΝΑΜΟ: κλειδί που ΗΔΗ ανήκει στο λεξιλόγιο μένει άθικτο', () => {
    // Και η ιδιοδυναμία ελέγχεται πάνω στο **σύνολο τιμών**, ποτέ σε πρόθεμα (Α15.2):
    // εδώ ένα έγγραφο ΙΔΙΩΤΗ κρατά το κλειδί του ακόμη κι όταν ξαναπεράσει ο κρίκος.
    const already = LISTING_MATERIAL_KEYS['owner-declared'].galleryAlt;
    expect(altKeyOf(withGallery('owner-declared', already))).toBe(already);

    const upgraded = upgradeListingDocument(withGallery('agency', FROZEN));
    expect(altKeyOf(upgraded)).toBe(LISTING_MATERIAL_KEYS.agency.galleryAlt);
  });

  it('Κ9.5 — κενή ή απούσα συλλογή δεν πειράζεται (η μία ζωντανή αγγελία ιδιώτη)', () => {
    // Μετρημένο 2026-09-03: η **μόνη** `owner-declared` αγγελία έχει `gallery: []`.
    expect(upgradeListingDocument({ ...PRODUCTION_V1, gallery: [] }).gallery).toEqual([]);
  });
});


// ============================================================================
// Κ10 — ΤΟ ΛΕΞΙΛΟΓΙΟ ΣΤΟ ΣΥΝΟΡΟ (ADR-842 §7.6.12 / §8 #11)
// ============================================================================

describe('Κ10 — 🔴 Η ΚΑΝΟΝΙΚΟΠΟΙΗΣΗ ΤΟΥ ΕΙΔΟΥΣ ΓΙΝΕΤΑΙ ΕΔΩ, ΑΝΕΥ ΟΡΩΝ', () => {
  /**
   * ⚠️ **Το «άνευ όρων» είναι ΟΛΟΚΛΗΡΟ το σκέλος.** Η δουλειά λεξιλογίου **δεν** μπήκε
   * ως κρίκος μετανάστευσης, γιατί το {@link upgradeListingDocument} επιστρέφει
   * **αυτούσιο** κάθε έγγραφο που φέρει ήδη τη σημερινή σφραγίδα — άρα ένα έγγραφο
   * **τρέχουσας έκδοσης** με ωμή τιμή δεν θα περνούσε ποτέ από τον κρίκο.
   */
  const CURRENT = { ...PRODUCTION_V1, schemaVersion: PUBLIC_LISTING_SCHEMA_VERSION };

  it('Κ10.1 — παλαιά ελληνική τιμή μεταφράζεται, ΚΑΙ η ολίσθηση καταγράφεται', () => {
    const read = readStoredListing({ ...PRODUCTION_V1, type: 'Κατάστημα' }, LISTING_ID)!;
    expect(read.listing.type).toBe('shop');
    expect(read.vocabularyDrift).toBe('Κατάστημα');
  });

  it('Κ10.2 — 🔴 ΚΑΙ ΣΕ ΕΓΓΡΑΦΟ ΤΡΕΧΟΥΣΑΣ ΕΚΔΟΣΗΣ (εδώ θα σιωπούσε ένας κρίκος)', () => {
    const read = readStoredListing({ ...CURRENT, type: 'Οικόπεδο' }, LISTING_ID)!;
    expect(read.needsRebuild).toBe(false); // η αλυσίδα δεν έτρεξε…
    expect(read.listing.type).toBe('plot'); // …και όμως η τιμή λύθηκε
    expect(read.vocabularyDrift).toBe('Οικόπεδο');
  });

  it('Κ10.3 — αγνώριστη τιμή ⇒ `null`, ΠΟΤΕ σιωπηλό «apartment»', () => {
    const read = readStoredListing({ ...PRODUCTION_V1, type: 'parking' }, LISTING_ID)!;
    expect(read.listing.type).toBeNull();
    expect(read.listing.type).not.toBe('apartment');
    expect(read.vocabularyDrift).toBe('parking');
  });

  it('Κ10.4 — απόν είδος ⇒ `null` ΧΩΡΙΣ ολίσθηση (απουσία ≠ ολίσθηση)', () => {
    const { type: _dropped, ...withoutType } = PRODUCTION_V1;
    const read = readStoredListing(withoutType, LISTING_ID)!;
    expect(read.listing.type).toBeNull();
    expect(read.vocabularyDrift).toBeNull();
  });

  it('Κ10.5 — κανονική τιμή μένει αυτούσια και ΧΩΡΙΣ ολίσθηση (ιδιοδυναμία)', () => {
    const read = readStoredListing(PRODUCTION_V1, LISTING_ID)!;
    expect(read.listing.type).toBe('plot');
    expect(read.vocabularyDrift).toBeNull();
  });

  it('Κ10.6 — 🔑 Η ΠΥΛΗ ΔΗΜΟΣΙΕΥΣΗΣ ΑΡΝΕΙΤΑΙ ΑΚΙΝΗΤΟ ΧΩΡΙΣ ΛΥΜΕΝΟ ΕΙΔΟΣ', () => {
    // Ο δρόμος **Γ′**: το έγγραφο ΖΕΙ και ο κάτοχος το βλέπει· ο **κόσμος** όχι.
    // Η απόσυρση υπάρχει ήδη: `buildPublicListing() === null ⇒ ref.delete()`.
    const base: ProjectableProperty = {
      id: LISTING_ID,
      commercialStatus: 'for-sale',
      offerKinds: ['sell'],
    };
    expect(isPubliclyListed({ ...base, type: 'plot' })).toBe(true);
    expect(isPubliclyListed({ ...base, type: 'Οικόπεδο' })).toBe(true);
    expect(isPubliclyListed({ ...base, type: 'parking' })).toBe(false);
    expect(isPubliclyListed({ ...base, type: null })).toBe(false);
  });
});

// ============================================================================
// Η ΣΥΝΕΧΕΙΑ ΤΗΣ ΣΥΝΘΕΜΕΝΗΣ ΑΛΥΣΙΔΑΣ (ΑΝΑ ΔΕΚΑΔΑ)
// ============================================================================

describe('Κ11 — η αλυσίδα είναι συνεχής και κάθε δεκάδα κρατά μόνο τους δικούς της κρίκους', () => {
  it('Κ11.1 — LISTING_MIGRATIONS.to = [2 … PUBLIC_LISTING_SCHEMA_VERSION], χωρίς κενό ή διπλότυπο', () => {
    const expected = Array.from({ length: PUBLIC_LISTING_SCHEMA_VERSION - 1 }, (_, i) => i + 2);
    expect(LISTING_MIGRATIONS.map((m) => m.to)).toEqual(expected);
  });

  it('Κ11.2 — κάθε δεκάδα έχει κρίκους μόνο του δικού της εύρους', () => {
    expect(LISTING_MIGRATIONS_02_10.every((m) => m.to >= 2 && m.to <= 10)).toBe(true);
    expect(LISTING_MIGRATIONS_11_20.every((m) => m.to >= 11 && m.to <= 20)).toBe(true);
    expect(LISTING_MIGRATIONS_21_30.every((m) => m.to >= 21 && m.to <= 30)).toBe(true);
  });
});

describe('Κ12 — κρίκος 21: τα κοινόχρηστα (ADR-777 §8.93)', () => {
  const link = LISTING_MIGRATIONS_21_30.find((migration) => migration.to === 21)!;
  const stored = (over: StoredListingDocument): StoredListingDocument => ({ type: 'apartment', offerKinds: ['sell'], ...over });

  it('🔴 παλιό έγγραφο κατοικίας ⇒ κουτί με «δεν δηλώθηκαν» — ποτέ ποσό, ποτέ μηδέν', () => {
    expect(link.apply(stored({})).commonCharges).toEqual({ monthlyAmount: null, includes: null });
  });

  it('🔴 γη · μόνο βραχυχρόνια · μόνο αντιπαροχή ⇒ null — ο ίδιος κριτής με τον προβολέα', () => {
    expect(link.apply(stored({ type: 'land' })).commonCharges).toBeNull();
    expect(link.apply(stored({ offerKinds: ['leaseShort'] })).commonCharges).toBeNull();
    expect(link.apply(stored({ offerKinds: ['exchange'] })).commonCharges).toBeNull();
    expect(link.apply(stored({ offerKinds: 'sell' })).commonCharges).toBeNull();
  });

  it('ιδιοδύναμο: ό,τι έγραψε ήδη ο γραφέας μένει αυτούσιο· σκουπίδι γίνεται «δεν δηλώθηκαν»', () => {
    const written = { monthlyAmount: 120, includes: ['heating'] };
    const once = link.apply(stored({ commonCharges: written }));
    expect(once.commonCharges).toEqual(written);
    expect(link.apply(once)).toEqual(once);
    expect(link.apply(stored({ commonCharges: { monthlyAmount: -5 } })).commonCharges).toEqual({ monthlyAmount: null, includes: null });
  });
});

describe('Κ13 — κρίκος 22: οι αριθμοί του ενεργειακού πιστοποιητικού (ADR-777 §8.94)', () => {
  const link = LISTING_MIGRATIONS_21_30.find((migration) => migration.to === 22)!;
  const stored = (over: StoredListingDocument): StoredListingDocument => ({ type: 'apartment', offerKinds: ['sell'], ...over });
  const UNDECLARED = { primaryEnergy: null, co2Emissions: null, absence: null };

  it('🔴 παλιό έγγραφο κτιρίου ⇒ κουτί με «δεν δηλώθηκαν» — ποτέ αριθμός, και το `energyClass` μένει ανέγγιχτο', () => {
    const upgraded = link.apply(stored({ energyClass: 'C' }));
    expect(upgraded.energyCertificate).toEqual(UNDECLARED);
    expect(upgraded.energyClass).toBe('C');
  });

  it('🔴 γη ή καμία διάθεση ⇒ null — ο ίδιος κριτής με τον προβολέα', () => {
    expect(link.apply(stored({ type: 'land' })).energyCertificate).toBeNull();
    expect(link.apply(stored({ offerKinds: [] })).energyCertificate).toBeNull();
    expect(link.apply(stored({ offerKinds: 'sell' })).energyCertificate).toBeNull();
  });

  it('ιδιοδύναμο: ό,τι έγραψε ήδη ο γραφέας μένει αυτούσιο· σκουπίδι γίνεται «δεν δηλώθηκαν»', () => {
    const written = { primaryEnergy: 132.4, co2Emissions: 38.1, absence: null };
    const once = link.apply(stored({ energyCertificate: written }));
    expect(once.energyCertificate).toEqual(written);
    expect(link.apply(once)).toEqual(once);
    expect(link.apply(stored({ energyCertificate: { primaryEnergy: -5, absence: 'lost' } })).energyCertificate).toEqual(UNDECLARED);
  });
});

describe('Κ14 — κρίκος 23: ωφέλιμη επιφάνεια και τελική ενέργεια του ΠΕΑ (ADR-777 §8.95)', () => {
  const link = LISTING_MIGRATIONS_21_30.find((migration) => migration.to === 23)!;
  const stored = (over: StoredListingDocument): StoredListingDocument => ({ type: 'apartment', offerKinds: ['sell'], ...over });
  const V22_BOX = { primaryEnergy: 132.4, co2Emissions: 38.1, absence: null };

  it('🔴 κουτί έκδοσης 22 ⇒ τα δύο νέα πεδία `null` — καμία εκτίμηση κόστους από έγγραφο που δεν τα δήλωσε', () => {
    const upgraded = link.apply(stored({ energyClass: 'C', energyCertificate: V22_BOX }));
    expect(upgraded.energyCertificate).toEqual({ ...V22_BOX, usefulArea: null, finalEnergy: null });
    expect(upgraded.energyClass).toBe('C');
  });

  it('🔴 ο κρίκος 22 εξακολουθεί να δίνει ΑΚΡΙΒΩΣ το κουτί της έκδοσης 22 — είναι παγωμένος', () => {
    const link22 = LISTING_MIGRATIONS_21_30.find((migration) => migration.to === 22)!;
    expect(Object.keys(link22.apply(stored({})).energyCertificate as object).sort()).toEqual(['absence', 'co2Emissions', 'primaryEnergy']);
  });

  it('γη ⇒ null· ιδιοδύναμο πάνω σε ό,τι έγραψε ήδη ο γραφέας', () => {
    expect(link.apply(stored({ type: 'land', energyCertificate: V22_BOX })).energyCertificate).toBeNull();
    const written = { ...V22_BOX, usefulArea: 84.6, finalEnergy: [{ source: 'oil', perSqm: 96.3 }] };
    const once = link.apply(stored({ energyCertificate: written }));
    expect(once.energyCertificate).toEqual(written);
    expect(link.apply(once)).toEqual(once);
  });
});

describe('Κ15 — κρίκος 24: εμβέλεια του ΠΕΑ, μονάδα ή κτήριο (ADR-777 §8.96)', () => {
  const link = LISTING_MIGRATIONS_21_30.find((migration) => migration.to === 24)!;
  const stored = (over: StoredListingDocument): StoredListingDocument => ({ type: 'apartment', offerKinds: ['sell'], ...over });
  const V23_BOX = { primaryEnergy: 132.4, co2Emissions: 38.1, usefulArea: 84.6, finalEnergy: null, absence: null };

  it('🔴 κουτί έκδοσης 23 ⇒ `scope: null` («δεν δηλώθηκε»), ΠΟΤΕ `unit` — και η εκτίμηση κόστους μένει όπως ήταν', () => {
    expect(link.apply(stored({ energyClass: 'C', energyCertificate: V23_BOX })).energyCertificate).toEqual({ ...V23_BOX, scope: null });
  });

  it('🔴 ο κρίκος 23 εξακολουθεί να δίνει ΑΚΡΙΒΩΣ το κουτί της έκδοσης 23 — είναι παγωμένος', () => {
    const link23 = LISTING_MIGRATIONS_21_30.find((migration) => migration.to === 23)!;
    expect(Object.keys(link23.apply(stored({})).energyCertificate as object)).not.toContain('scope');
  });

  it('γη ⇒ null· ιδιοδύναμο· σκουπίδι ⇒ null', () => {
    expect(link.apply(stored({ type: 'land', energyCertificate: V23_BOX })).energyCertificate).toBeNull();
    const once = link.apply(stored({ energyCertificate: { ...V23_BOX, scope: 'building' } }));
    expect(once.energyCertificate).toEqual({ ...V23_BOX, scope: 'building' });
    expect(link.apply(once)).toEqual(once);
    expect((link.apply(stored({ energyCertificate: { ...V23_BOX, scope: 'tower' } })).energyCertificate as { scope: unknown }).scope).toBeNull();
  });
});

describe('Κ16 — κρίκος 25: η διαθεσιμότητα (ADR-919 §7)', () => {
  const link = LISTING_MIGRATIONS_21_30.find((migration) => migration.to === 25)!;
  const Q3_2027 = { kind: 'scheduled', precision: 'quarter', window: { start: '2027-07-01', end: '2027-09-30' } };

  it('🔴 παλιό έγγραφο ⇒ `unknown`, ΠΟΤΕ `ready` — αλλιώς τα υπό κατασκευή θα έμπαιναν στο «Τώρα»', () => {
    expect(link.apply({ type: 'apartment' }).availability).toEqual({ kind: 'unknown' });
    expect(upgradeListingDocument({ ...PRODUCTION_V1 }).availability).toEqual({ kind: 'unknown' });
  });

  it('ιδιοδύναμο: ό,τι έγραψε ήδη ο γραφέας μένει αυτούσιο· σκουπίδι ⇒ unknown', () => {
    const once = link.apply({ availability: Q3_2027 });
    expect(once.availability).toEqual(Q3_2027);
    expect(link.apply(once)).toEqual(once);
    expect(link.apply({ availability: { kind: 'ready' } }).availability).toEqual({ kind: 'ready' });
    expect(link.apply({ availability: { kind: 'scheduled', precision: 'quarter' } }).availability).toEqual({ kind: 'unknown' });
  });
});

describe('Κ17 — κρίκος 26: το έδαφος (ADR-920 §12)', () => {
  const link = LISTING_MIGRATIONS_21_30.find((migration) => migration.to === 26)!;
  const TERRAIN = {
    provenance: 'measured',
    sourceRef: 'property-terrain:measured',
    at: '2026-10-23T10:00:00.000Z',
    value: {
      url: 'https://storage.googleapis.com/b/listings/prop_1/abc.json',
      snapshotVersion: 1,
      stats: {
        planAreaM2: 400, minElevationM: 120, maxElevationM: 122,
        reliefM: 2, meanSlopePct: 10, maxSlopePct: 10, downslopeAzimuthDeg: 270,
      },
      contourIntervalM: 0.5,
      envelope: { kind: 'volume', maxHeightM: 7.5 },
      survey: { surveyorName: 'Τοπογράφος Α', surveyedOn: '2026-05-04' },
    },
  };

  it('🔴 παλιό έγγραφο ⇒ `null` («δεν δημοσιεύτηκε»), ποτέ επινοημένο έδαφος', () => {
    expect(link.apply({ type: 'plot' }).terrain).toBeNull();
    expect(upgradeListingDocument({ ...PRODUCTION_V1 }).terrain).toBeNull();
  });

  it('ιδιοδύναμο: ό,τι έγραψε ήδη ο binder μένει αυτούσιο', () => {
    const once = link.apply({ terrain: TERRAIN });
    expect(once.terrain).toEqual(TERRAIN);
    expect(link.apply(once)).toEqual(once);
  });

  it.each([
    ['όχι measured', { ...TERRAIN, provenance: 'declared' }],
    ['χωρίς url', { ...TERRAIN, value: { ...TERRAIN.value, url: '' } }],
    ['κλίση NaN', { ...TERRAIN, value: { ...TERRAIN.value, stats: { ...TERRAIN.value.stats, meanSlopePct: Number.NaN } } }],
    ['ψεύτικη ημέρα αποτύπωσης', { ...TERRAIN, value: { ...TERRAIN.value, survey: { surveyorName: 'Α', surveyedOn: '2026-02-30' } } }],
    ['πρίσμα χωρίς ύψος', { ...TERRAIN, value: { ...TERRAIN.value, envelope: { kind: 'volume' } } }],
    ['κείμενο', 'ναι'],
  ])('σκουπίδι (%s) ⇒ `null`, ποτέ σε δημόσια οθόνη', (_label, garbage) => {
    expect(link.apply({ terrain: garbage }).terrain).toBeNull();
  });
});

describe('Κ18 — κρίκος 27: η ιστορία της υπόσχεσης (ADR-919 §10)', () => {
  const link = LISTING_MIGRATIONS_21_30.find((migration) => migration.to === 27)!;
  const Q2_2027 = { kind: 'scheduled', precision: 'quarter', window: { start: '2027-04-01', end: '2027-06-30' } };
  const Q4_2027 = { kind: 'scheduled', precision: 'quarter', window: { start: '2027-10-01', end: '2027-12-31' } };
  const TRACK = {
    originally: Q2_2027,
    slips: 1,
    lastChange: { kind: 'slipped', from: Q2_2027, at: '2026-10-23T10:00:00.000Z' },
  };

  it('🔴 παλιό έγγραφο ⇒ `null` («καμία ιστορία»), ποτέ ψεύτικο πλήθος μεταθέσεων', () => {
    expect(link.apply({ availability: Q4_2027 }).availabilityTrack).toBeNull();
    expect(upgradeListingDocument({ ...PRODUCTION_V1 }).availabilityTrack).toBeNull();
  });

  it('ιδιοδύναμο: ό,τι έγραψε ήδη ο γραφέας μένει αυτούσιο', () => {
    const once = link.apply({ availabilityTrack: TRACK });
    expect(once.availabilityTrack).toEqual(TRACK);
    expect(link.apply(once)).toEqual(once);
  });

  it.each([
    ['αρχική υπόσχεση όχι scheduled', { ...TRACK, originally: { kind: 'ready' } }],
    ['αρνητικές μεταθέσεις', { ...TRACK, slips: -1 }],
    ['άγνωστο είδος αλλαγής', { ...TRACK, lastChange: { ...TRACK.lastChange, kind: 'teleported' } }],
    ['τρίμηνο με λάθος τέλος', { ...TRACK, originally: { ...Q2_2027, window: { start: '2027-04-01', end: '2027-05-31' } } }],
    ['κείμενο', 'μετατέθηκε'],
  ])('σκουπίδι (%s) ⇒ `null`, ποτέ σε δημόσια οθόνη', (_label, garbage) => {
    expect(link.apply({ availabilityTrack: garbage }).availabilityTrack).toBeNull();
  });
});

describe('Κ19 — κρίκος 28: η προέλευση της απόδοσης ανά βαθμίδα (ADR-890 §21)', () => {
  const link = LISTING_MIGRATIONS_21_30.find((migration) => migration.to === 28)!;
  const LEGACY = {
    regionId: 'region:112',
    regionalUnitId: 'regional_unit:13',
    municipalityId: 'municipality:1303',
    municipalUnitId: null,
    communityId: null,
    nearBoundary: false,
  };

  it('🔴 παλιά απόδοση ⇒ `measuredDepth` = η βαθύτερη ταυτότητα (πριν το §21 όλα ήταν μετρημένα)', () => {
    expect(link.apply({ adminArea: LEGACY }).adminArea).toEqual({ ...LEGACY, measuredDepth: 5 });
  });

  it('χωρίς απόδοση ⇒ `null`, όπως ήταν', () => {
    expect(link.apply({ adminArea: null }).adminArea).toBeNull();
    expect(link.apply({}).adminArea).toBeNull();
  });

  it('ιδιοδύναμο: ό,τι έγραψε ήδη ο γραφέας (με δηλωμένη ουρά) μένει αυτούσιο', () => {
    const declared = { ...LEGACY, municipalUnitId: 'municipal_unit:130301', measuredDepth: 5 };
    const once = link.apply({ adminArea: declared });
    expect(once.adminArea).toEqual(declared);
    expect(link.apply(once)).toEqual(once);
  });

  it('απόδοση χωρίς καμία ταυτότητα (σκουπίδι) ⇒ `null`, ποτέ ψεύτικο βάθος', () => {
    expect(link.apply({ adminArea: { nearBoundary: false } }).adminArea).toBeNull();
  });
});
