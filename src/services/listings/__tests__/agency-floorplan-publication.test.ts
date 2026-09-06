/**
 * @jest-environment node
 *
 * @fileoverview **Η ΑΓΚΥΡΑ ΤΗΣ ΚΑΤΟΨΗΣ ΤΟΥ ΓΡΑΦΕΙΟΥ** (ADR-841 §7 Α17.7 · Ο-21).
 * @related services/listings/agency-media-publication · agency-media.reader · lib/listings/listing-material
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΙ ΡΩΤΑ ΑΥΤΗ Η ΣΟΥΙΤΑ ΠΟΥ ΚΑΜΙΑ ΑΛΛΗ ΔΕΝ ΡΩΤΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 *   **Μπορεί το γραφείο να δημοσιεύσει κάτοψη — και ΜΟΝΟ όταν την ονομάσει;**
 *
 * Η αδελφή `listing-floorplan-separation` ρωτά *«μπορεί ένα ΣΧΕΔΙΟ να ανακοινωθεί ως
 * ΦΩΤΟΓΡΑΦΙΑ;»* και το **Κ4** της κλείδωσε την απάντηση *«όχι»* για το γραφείο. Η Α17.7
 * **δεν το χαλαρώνει** — προσθέτει **δεύτερο, αυστηρότερο** μονοπάτι. Άρα η ερώτηση εδώ
 * είναι διπλή, και **αμφότερα** τα σκέλη πρέπει να μένουν αληθή μαζί:
 *
 *   1. **ΧΩΡΙΣ** δήλωση ⇒ **τίποτα** δεν αλλάζει *(η Κ4 μένει αληθής)*
 *   2. **ΜΕ** δήλωση ⇒ φεύγει, **και ως κάτοψη**, **και μόνο** αν περνά όλους τους φρουρούς
 *
 * ⚠️ **ΚΑΙ ΤΟ ΕΡΩΤΗΜΑ FIRESTORE ΕΙΝΑΙ ΜΕΡΟΣ ΤΟΥ ΚΡΙΤΗΡΙΟΥ.** Μέχρι τις 2026-09-06 το
 * ερώτημα φιλτράριζε σε `category == 'photos'`, δηλαδή **καμία κάτοψη δεν έφτανε ποτέ**
 * στον κανόνα — η **πραγματική** αιτία του Ο-21 *(Α17.7.1)*. Μια σουίτα που δοκίμαζε
 * μόνο τον καθαρό κανόνα θα ήταν **πράσινη πάνω σε λειτουργία που δεν υπάρχει**.
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import { PUBLISHED_MEDIA_LIMIT } from '@/services/upload/utils/storage-path-public-shelf';
import type { PublicShelfReport } from '../public-shelf.service';
import type { AgencyMediaCandidate } from '../agency-media-publication';

const reconcilePublicShelf = jest.fn<Promise<PublicShelfReport>, [string, readonly unknown[]]>();

jest.mock('../public-shelf.service', () => ({
  reconcilePublicShelf: (...args: [string, readonly unknown[]]) => reconcilePublicShelf(...args),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { republishListing } = require('../publish-public-listing') as
  typeof import('../publish-public-listing');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { publishedAgencyMediaSources, agencyMediaMaterial, agencyMediaDeclaration } =
  require('../agency-media-publication') as typeof import('../agency-media-publication');

const LISTING = 'prop_a0000005-7777-4aaa-8aaa-000000000005';
const COMPANY = 'comp_9c7c1a50-f370-466d-bdf7-aa7b2b2d7757';
const PLAN_AT = '2026-08-04T10:00:00.000Z';

function property(over: Record<string, unknown> = {}) {
  return {
    id: LISTING,
    companyId: COMPANY,
    name: 'ΔΟΚΙΜΗ ΚΑΤΟΨΗΣ',
    type: 'apartment',
    commercialStatus: 'for-sale',
    areas: { gross: 70 },
    commercial: { askingPrice: 150000 },
    ...over,
  } as never;
}

function photo(over: Partial<AgencyMediaCandidate> & { id: string }): AgencyMediaCandidate {
  return {
    entityType: 'property',
    storagePath: `companies/${COMPANY}/entities/property/${LISTING}/photos/${over.id}.jpg`,
    category: 'photos',
    classification: 'public',
    contentType: 'image/jpeg',
    status: 'ready',
    createdAt: '2026-08-01T10:00:00.000Z',
    lifecycleState: 'active',
    isDeleted: false,
    ...over,
  };
}

/** Κάτοψη **ως εικόνα** — η μόνη μορφή που μπορεί να μπει σε `<img>`. */
function plan(over: Partial<AgencyMediaCandidate> & { id: string }): AgencyMediaCandidate {
  return photo({ category: 'floorplans', createdAt: PLAN_AT, ...over });
}

const PHOTO = photo({ id: 'file_photo' });
const PLAN = plan({ id: 'file_plan' });

/** Το σχέδιο εργασίας της ζωντανής βάσης: DXF, **όχι** εικόνα. */
const DXF = plan({ id: 'file_dxf', contentType: 'application/dxf' });

const DECLARED = { publishedFloorplans: ['file_plan'] };

let filesInCollection: AgencyMediaCandidate[] = [];
let askedFilters: [string, string, unknown][] = [];

const listingRef = { set: jest.fn(async () => undefined), delete: jest.fn(async () => undefined) };

function filesQuery() {
  const query = {
    where: (field: string, op: string, value: unknown) => {
      askedFilters.push([field, op, value]);
      return query;
    },
    get: async () => ({ docs: filesInCollection.map((f) => ({ id: f.id, data: () => f })) }),
  };
  return query;
}

const adminDb = {
  collection: (name: string) =>
    name === COLLECTIONS.FILES ? filesQuery() : { doc: () => listingRef },
} as never;

const resolveAgency = async () => ({ id: COMPANY, name: 'ΠΑΓΩΝΗΣ Α.Ε.' });

/** Ό,τι έφτασε στο ράφι: ταυτότητα αρχείου **και το υλικό του**. */
function shelf(): { id: string; kind: string }[] {
  const call = reconcilePublicShelf.mock.calls[0];
  return ((call?.[1] ?? []) as { privateStoragePath: string; material: { kind: string } }[]).map(
    (source) => ({
      id: source.privateStoragePath.split('/').slice(-1)[0].replace('.jpg', ''),
      kind: source.material.kind,
    }),
  );
}

function sources(files: readonly AgencyMediaCandidate[], floorplans: readonly string[]) {
  return publishedAgencyMediaSources(files, { order: [], floorplans }).map((source) => ({
    id: source.privateStoragePath.split('/').slice(-1)[0].replace('.jpg', ''),
    kind: source.material.kind,
  }));
}

beforeEach(() => {
  filesInCollection = [];
  askedFilters = [];
  listingRef.set.mockClear();
  listingRef.delete.mockClear();
  reconcilePublicShelf.mockReset();
  reconcilePublicShelf.mockResolvedValue({
    outcome: 'reconciled',
    published: [],
    removed: 0,
    rejected: 0,
  });
});

// ============================================================================
// Φ1 — ΤΟ ΕΡΩΤΗΜΑ: η ΠΡΑΓΜΑΤΙΚΗ αιτία του Ο-21
// ============================================================================

describe('Φ1 — Η ΚΑΤΟΨΗ ΦΤΑΝΕΙ ΣΤΟΝ ΚΑΝΟΝΑ', () => {
  it('🔴 το ερώτημα ζητά ΚΑΙ ΤΟΥΣ ΔΥΟ ΚΑΔΟΥΣ — ποτέ μόνο `photos`', async () => {
    filesInCollection = [PHOTO];

    await republishListing(adminDb, LISTING, property(), resolveAgency);

    expect(askedFilters).toEqual([
      ['companyId', '==', COMPANY],
      ['entityType', '==', 'property'],
      ['entityId', '==', LISTING],
      ['category', 'in', ['photos', 'floorplans']],
    ]);
  });

  it('⛔ και ΔΕΝ γίνεται πλατύτερο — καμία σάρωση χωρίς κατηγορία', async () => {
    filesInCollection = [PHOTO];

    await republishListing(adminDb, LISTING, property(), resolveAgency);

    expect(askedFilters).toHaveLength(4);
    expect(askedFilters.map(([field]) => field)).toContain('category');
  });
});

// ============================================================================
// Φ2 — ΧΩΡΙΣ ΔΗΛΩΣΗ: ΤΙΠΟΤΑ ΔΕΝ ΑΛΛΑΖΕΙ (η Κ4 μένει αληθής)
// ============================================================================

describe('Φ2 — ΧΩΡΙΣ ΔΗΛΩΣΗ, Η ΚΑΤΟΨΗ ΔΕΝ ΦΕΥΓΕΙ', () => {
  it('🔴 κάτοψη-JPEG σημασμένη `public` ΔΕΝ φεύγει — η ονομαστική δήλωση ΔΕΝ είναι διακοσμητική', async () => {
    filesInCollection = [PHOTO, PLAN];

    await republishListing(adminDb, LISTING, property(), resolveAgency);

    expect(shelf()).toEqual([{ id: 'file_photo', kind: 'photo' }]);
  });

  it('🔴 ΚΑΙ ο καθαρός κανόνας συμφωνεί — κενή δήλωση ⇒ μόνο φωτογραφίες', () => {
    expect(sources([PHOTO, PLAN], [])).toEqual([{ id: 'file_photo', kind: 'photo' }]);
  });

  it('🔴 καμία υπάρχουσα αγγελία δεν αλλάζει: ίδιο αποτέλεσμα με πριν την Α17.7', () => {
    expect(sources([PHOTO], [])).toEqual([{ id: 'file_photo', kind: 'photo' }]);
  });
});

// ============================================================================
// Φ3 — ΜΕ ΔΗΛΩΣΗ: ΦΕΥΓΕΙ, ΚΑΙ **ΩΣ ΚΑΤΟΨΗ**
// ============================================================================

describe('Φ3 — Η ΔΗΛΩΜΕΝΗ ΚΑΤΟΨΗ ΦΕΥΓΕΙ ΩΣ ΚΑΤΟΨΗ', () => {
  it('🔴 από άκρη σε άκρη: `properties/{id}` → ερώτημα → κανόνας → ράφι', async () => {
    filesInCollection = [PHOTO, PLAN];

    const outcome = await republishListing(adminDb, LISTING, property(DECLARED), resolveAgency);

    expect(outcome).toBe('published');
    expect(shelf()).toEqual([
      { id: 'file_photo', kind: 'photo' },
      { id: 'file_plan', kind: 'floorplan' },
    ]);
  });

  it('🔴 ΤΟ ΥΛΙΚΟ ΚΟΥΒΑΛΑΕΙ ΤΗ ΣΤΙΓΜΗ ΤΟΥ ΑΝΘΡΩΠΟΥ — ποτέ ρολόι του γραφέα', () => {
    const material = agencyMediaMaterial(PLAN, new Set(['file_plan']));

    expect(material).toEqual({ kind: 'floorplan', at: PLAN_AT });
  });

  it('🔴 αδήλωτη κάτοψη ⇒ `null` — δεν γίνεται σιωπηλά φωτογραφία', () => {
    expect(agencyMediaMaterial(PLAN, new Set())).toBeNull();
  });

  it('🔴 φωτογραφία ΔΕΝ γίνεται κάτοψη επειδή κάποιος τη δήλωσε κατά λάθος', () => {
    expect(agencyMediaMaterial(PHOTO, new Set(['file_photo']))).toEqual({ kind: 'photo' });
  });
});

// ============================================================================
// Φ4 — ΟΙ ΦΡΟΥΡΟΙ ΠΑΡΑΜΕΝΟΥΝ: Η ΔΗΛΩΣΗ ΠΡΟΣΤΙΘΕΤΑΙ, ΔΕΝ ΑΝΤΙΚΑΘΙΣΤΑ
// ============================================================================

describe('Φ4 — Η ΔΗΛΩΣΗ ΔΕΝ ΠΑΡΑΚΑΜΠΤΕΙ ΚΑΝΕΝΑΝ ΦΡΟΥΡΟ', () => {
  it('🔴 δηλωμένη κάτοψη ΧΩΡΙΣ `public` ΔΕΝ φεύγει — ο φρουρός #1 στέκει', () => {
    const secret = plan({ id: 'file_plan', classification: 'internal' });
    expect(sources([secret], ['file_plan'])).toEqual([]);
  });

  it('🔴 δηλωμένο **DXF** ΔΕΝ φεύγει — δεν μπαίνει σε `<img>`, όσο κι αν το θέλει κανείς', () => {
    expect(sources([DXF], ['file_dxf'])).toEqual([]);
  });

  it('🔴 δηλωμένη κάτοψη στα ΣΚΟΥΠΙΔΙΑ ΔΕΝ φεύγει', () => {
    const trashed = plan({ id: 'file_plan', isDeleted: true });
    expect(sources([trashed], ['file_plan'])).toEqual([]);
  });

  it('🔴 δηλωμένη κάτοψη ΞΕΝΗΣ οντότητας ΔΕΝ φεύγει', () => {
    const foreign = plan({ id: 'file_plan', entityType: 'project' });
    expect(sources([foreign], ['file_plan'])).toEqual([]);
  });

  it('🔴 δηλωμένη κάτοψη με ΜΗ ΑΝΑΓΝΩΣΙΜΗ στιγμή ΔΕΝ φεύγει — το `at` είναι υποχρεωτικό', () => {
    const timeless = plan({ id: 'file_plan', createdAt: 'όχι ημερομηνία' });
    expect(sources([timeless], ['file_plan'])).toEqual([]);
  });

  it('🔴 δήλωση ΑΓΝΩΣΤΗΣ ταυτότητας δεν δημιουργεί τίποτα', () => {
    expect(sources([PHOTO], ['file_ghost'])).toEqual([{ id: 'file_photo', kind: 'photo' }]);
  });
});

// ============================================================================
// Φ5 — ΤΟ ΟΡΙΟ ΕΙΝΑΙ **ΕΝΑ ΚΑΙ ΣΥΝΟΛΙΚΟ**, ΚΑΙ Η ΣΕΙΡΑ ΤΟ ΚΑΝΕΙ ΑΣΦΑΛΕΣ
// ============================================================================

describe('Φ5 — ΕΝΑ ΟΡΙΟ ΓΙΑ ΤΑ ΔΥΟ ΕΙΔΗ', () => {
  const MANY = Array.from({ length: PUBLISHED_MEDIA_LIMIT }, (_, i) =>
    photo({
      id: `file_p${String(i).padStart(3, '0')}`,
      createdAt: `2026-08-${String(1 + i).padStart(2, '0')}T09:00:00.000Z`,
    }),
  );

  /**
   * ⚠️ **Η ΚΑΤΟΨΗ ΕΙΝΑΙ ΡΗΤΑ Η ΝΕΟΤΕΡΗ ΟΛΩΝ, ΚΑΙ ΕΙΝΑΙ ΤΟ ΝΟΗΜΑ.** Πρώτη γραφή αυτής της
   * ομάδας χρησιμοποιούσε την `PLAN` *(4η χρονικά)* και ισχυριζόταν ότι «κόβεται» — **ήταν
   * ψευδές**: κοβόταν η τελευταία **φωτογραφία**. Το κριτήριο ήταν πράσινο για λάθος λόγο
   * μέχρι που η μέτρηση το διέψευσε. 🔑 *Ένα κριτήριο ορίου πρέπει να βάλει το υπό εξέταση
   * αντικείμενο **ΣΤΗΝ ΟΥΡΑ**, αλλιώς δοκιμάζει κάποιο άλλο.*
   */
  const LATE_AT = '2026-09-30T10:00:00.000Z';
  const LATE_PLAN = plan({ id: 'file_late_plan', createdAt: LATE_AT });

  it('🔴 ΚΑΝΕΝΑ δεύτερο όριο: φωτογραφίες + κατόψεις κόβονται ΜΑΖΙ στο ΕΝΑ όριο', () => {
    const out = sources([...MANY, LATE_PLAN], ['file_late_plan']);
    expect(out).toHaveLength(PUBLISHED_MEDIA_LIMIT);
  });

  it('🔴 ΓΕΜΑΤΟ ΡΑΦΙ: η κάτοψη ΚΟΒΕΤΑΙ αν κανείς δεν τη βάλει μπροστά', () => {
    const out = sources([...MANY, LATE_PLAN], ['file_late_plan']);
    expect(out.some((s) => s.id === 'file_late_plan')).toBe(false);
    expect(out.every((s) => s.kind === 'photo')).toBe(true);
  });

  /**
   * 🔑 **ΤΟ ΚΡΙΤΗΡΙΟ ΠΟΥ ΔΙΚΑΙΩΝΕΙ ΤΗ ΣΕΙΡΑ ΤΟΥ Ο-16.** Το ADR έγραφε — **πριν** υπάρξει
   * η λύση — *«η σειρά του Ο-16 προηγείται: χωρίς πράξη σειράς, το γραφείο δεν έχει πού
   * να πει **ποια** κάτοψη είναι πρώτη»*. Εδώ αποδεικνύεται εκτελέσιμα: με γεμάτο ράφι, η
   * **μόνη** διαδρομή για να φύγει η κάτοψη είναι η δήλωση σειράς της Α14.7.
   */
  it('🔴 …ΚΑΙ Η ΠΡΑΞΗ ΣΕΙΡΑΣ ΤΗΝ ΞΑΝΑΦΕΡΝΕΙ — οι δύο δηλώσεις συνεργάζονται', () => {
    const out = publishedAgencyMediaSources([...MANY, LATE_PLAN], {
      order: ['file_late_plan'],
      floorplans: ['file_late_plan'],
    });

    expect(out).toHaveLength(PUBLISHED_MEDIA_LIMIT);
    expect(out[0].material).toEqual({ kind: 'floorplan', at: LATE_AT });
  });
});

// ============================================================================
// Φ6 — Η ΑΝΑΓΝΩΣΗ ΤΩΝ ΔΥΟ ΠΕΔΙΩΝ ΓΙΝΕΤΑΙ ΜΕ **ΜΙΑ** ΚΛΗΣΗ
// ============================================================================

describe('Φ6 — `agencyMediaDeclaration` ΔΙΑΒΑΖΕΙ ΚΑΙ ΤΑ ΔΥΟ', () => {
  it('🔴 και τα δύο πεδία, από το ίδιο έγγραφο', () => {
    expect(
      agencyMediaDeclaration({
        publishedMediaOrder: ['a', 'b'],
        publishedFloorplans: ['c'],
      }),
    ).toEqual({ order: ['a', 'b'], floorplans: ['c'] });
  });

  it('🔴 σκουπίδι σε ΟΠΟΙΟΔΗΠΟΤΕ από τα δύο ⇒ κενό ΕΚΕΙΝΟ, ποτέ και τα δύο', () => {
    expect(
      agencyMediaDeclaration({ publishedMediaOrder: 42, publishedFloorplans: ['c'] }),
    ).toEqual({ order: [], floorplans: ['c'] });

    expect(
      agencyMediaDeclaration({ publishedMediaOrder: ['a'], publishedFloorplans: 'όχι' }),
    ).toEqual({ order: ['a'], floorplans: [] });
  });

  it('🔴 ΚΕΝΟ έγγραφο ⇒ καμία δήλωση, καμία εξαίρεση', () => {
    expect(agencyMediaDeclaration({})).toEqual({ order: [], floorplans: [] });
  });
});
