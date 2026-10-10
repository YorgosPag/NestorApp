/**
 * @jest-environment node
 *
 * @fileoverview 🏆 **Η ΑΓΚΥΡΑ Α-8** — υπάρχει ράφι της αγγελίας που η απόσυρση ΔΕΝ αδειάζει;
 * @related ADR-845 §8 (Α-7 · Α-8) · ADR-841 §7 Α12.6 · services/listings/publish-public-listing-shelf
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΙ ΡΩΤΑ ΑΥΤΗ Η ΣΟΥΙΤΑ ΠΟΥ ΚΑΜΙΑ ΑΛΛΗ ΔΕΝ ΡΩΤΑ, ΚΑΙ ΓΙΑΤΙ ΤΩΡΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 *   **Άδειασε η απόσυρση ΚΑΘΕ ράφι, ή μόνο εκείνο που θυμήθηκε ο συγγραφέας;**
 *
 * Ως τη Φ4.2α η απόσυρση ήταν **μία κλήση** *(`reconcileShelfSafely(listingId, [])`)* που
 * άδειαζε **μόνο** το raster ράφι. Ήταν **σωστή** τη μέρα που γράφτηκε — υπήρχε ένα ράφι. Τη
 * μέρα που εμφανίστηκε το δεύτερο *(`LISTING_MODEL_SHELF`, Φ4.2)* **δεν κοκκίνισε τίποτα**:
 * το τεστ της απόσυρσης ρωτούσε *«άδειασε το ράφι εικόνων;»*, και η απάντηση έμενε **ναι**.
 *
 * ⇒ Κάθε δημοσιευμένο `.glb` θα **επιβίωνε την απόσυρση**, δημόσια αναγνώσιμο, **για πάντα**,
 * χωρίς καμία οθόνη να το δείχνει — δηλαδή **κατά γράμμα** η Α12.6: *«διαρροή που ΜΕΓΑΛΩΝΕΙ,
 * και κανείς δεν θα το μάθαινε»*, μία γενιά μετά τη γραμμή που την ονόμασε.
 *
 * 🔑 **Η θεραπεία δεν είναι «να μην ξεχαστεί η δεύτερη γραμμή»** — είναι **να μην υπάρχει
 * γραμμή να ξεχαστεί**: η λίστα **παράγεται** από το `PUBLIC_SHELF_KINDS`. Αυτή η σουίτα
 * **εκτελεί** ακριβώς αυτό, συγκρίνοντας με τον **ίδιο** πίνακα.
 *
 * ⚠️ **ΣΥΝΑΡΤΗΣΕΙΣ, ΟΧΙ ΣΤΑΘΕΡΕΣ ΣΤΟ ΣΩΜΑ ΤΟΥ `describe`** — το σώμα τρέχει στη **συλλογή**,
 * και μια εξαίρεση εκεί ρίχνει **ΟΛΟΚΛΗΡΟ** το αρχείο με `Tests: 0 total`.
 */

import {
  LISTING_MODEL_SHELF,
  LISTING_SHELF,
  LISTING_VIDEO_SHELF,
  PUBLIC_SHELF_KINDS,
  PUBLIC_SHELF_LISTING_ROOT,
  SHOWCASE_SHELF,
} from '@/services/upload/utils/public-shelf-kinds';
import type { PublicShelfSource } from '@/services/upload/utils/storage-path-public-shelf';
import type { ListingMaterial } from '@/lib/listings/listing-material';
import type { PublicListing } from '@/types/public-listing';

type ShelfCall = [kind: { root: string; encoding: { kind: string } }, subjectId: string, sources: readonly unknown[]];

const reconcilePublicShelf = jest.fn<Promise<unknown>, ShelfCall>();
const reconcilePublicModelShelf = jest.fn<Promise<unknown>, ShelfCall>();
const reconcilePublicVideoShelf = jest.fn<Promise<unknown>, ShelfCall>();

// 🔑 **ΚΑΙ ΤΑ ΔΥΟ κεφάλια μοκάρονται** — όχι μόνο για ταχύτητα: το κεφάλι του μοντέλου σέρνει
//    τον ψήστη, δηλαδή **WASM** (`meshoptimizer`, `gltf-validator`). Αυτή η σουίτα ρωτά για
//    **καλωδίωση**, όχι για ψήσιμο· το ψήσιμο έχει δική του άγκυρα με **αληθινό GLB**.
jest.mock('../public-shelf.service', () => ({
  reconcilePublicShelf: (...args: ShelfCall) => reconcilePublicShelf(...args),
}));
jest.mock('../public-shelf-model.service', () => ({
  reconcilePublicModelShelf: (...args: ShelfCall) => reconcilePublicModelShelf(...args),
}));
// ADR-907 §10 — το τρίτο κεφάλι: η καλωδίωση ρωτιέται εδώ, το ψήσιμο στο `public-shelf-video-bake.test`.
jest.mock('../public-shelf-video.service', () => ({
  reconcilePublicVideoShelf: (...args: ShelfCall) => reconcilePublicVideoShelf(...args),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { partitionListingSources, withdrawListingShelves, writeWithShelf } =
  require('../publish-public-listing-shelf') as typeof import('../publish-public-listing-shelf');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { buildPublicListing } = require('../public-listing-projection') as
  typeof import('../public-listing-projection');

const LISTING = 'ownp_77aa21bc';
const AT = '2026-09-01T10:00:00.000Z';
const SOURCE_AT = '2026-08-14T07:30:00.000Z';

/** Κενή αναφορά — ό,τι επιστρέφει ένα ράφι που δεν δημοσίευσε τίποτα. */
function emptyReport(): { outcome: 'reconciled'; published: never[]; removed: number; rejected: number } {
  return { outcome: 'reconciled', published: [], removed: 0, rejected: 0 };
}

function source(path: string, material: ListingMaterial): PublicShelfSource<ListingMaterial> {
  return { privateStoragePath: path, material };
}

function listing(): PublicListing {
  const built = buildPublicListing(
    {
      id: LISTING,
      name: 'Διαμέρισμα 80 τ.μ.',
      type: 'apartment',
      commercialStatus: 'for-sale',
      areas: { gross: 80 },
      commercial: { askingPrice: 150000 },
    },
    { candidates: [], ref: null },
    AT,
  );
  if (built === null) throw new Error('το fixture όφειλε να δημοσιεύεται');
  return built;
}

/** Τα είδη της ρίζας **των αγγελιών**, υπολογισμένα από τον ΙΔΙΟ πίνακα που διαβάζει ο κώδικας. */
function listingRootKinds(): readonly { root: string }[] {
  return PUBLIC_SHELF_KINDS.filter((kind) => kind.root === PUBLIC_SHELF_LISTING_ROOT);
}

/** Όλα τα είδη που κλήθηκαν, από **αμφότερα** τα κεφάλια. */
function calledKinds(): readonly { root: string; encoding: { kind: string } }[] {
  return [
    ...reconcilePublicShelf.mock.calls.map((call) => call[0]),
    ...reconcilePublicModelShelf.mock.calls.map((call) => call[0]),
    ...reconcilePublicVideoShelf.mock.calls.map((call) => call[0]),
  ];
}

beforeEach(() => {
  jest.clearAllMocks();
  reconcilePublicShelf.mockResolvedValue(emptyReport());
  reconcilePublicModelShelf.mockResolvedValue(emptyReport());
  reconcilePublicVideoShelf.mockResolvedValue(emptyReport());
});

// ---------------------------------------------------------------------------

describe('🏆 Α-8 — Η ΑΠΟΣΥΡΣΗ ΑΔΕΙΑΖΕΙ ΚΑΘΕ ΡΑΦΙ ΤΗΣ ΑΓΓΕΛΙΑΣ', () => {
  it('🔴 καλεί ΚΑΙ ΤΑ ΔΥΟ κεφάλια — η μετάλλαξη που πιάνει την επιστροφή στο ΕΝΑ ράφι', () => {
    return withdrawListingShelves(LISTING).then(() => {
      expect(reconcilePublicShelf).toHaveBeenCalledTimes(1);
      expect(reconcilePublicModelShelf).toHaveBeenCalledTimes(1);
      expect(reconcilePublicVideoShelf).toHaveBeenCalledTimes(1);
    });
  });

  it('🔴 με ΚΕΝΟ σύνολο — «κενό σύνολο ⇒ το πρόθεμα αδειάζει», ποτέ «σβήσε τα»', async () => {
    await withdrawListingShelves(LISTING);

    expect(reconcilePublicShelf).toHaveBeenCalledWith(LISTING_SHELF, LISTING, []);
    expect(reconcilePublicModelShelf).toHaveBeenCalledWith(LISTING_MODEL_SHELF, LISTING, []);
    expect(reconcilePublicVideoShelf).toHaveBeenCalledWith(LISTING_VIDEO_SHELF, LISTING, []);
  });

  it('🔴 ΚΑΘΕ είδος της ρίζας των αγγελιών αδειάζεται — η λίστα ΠΑΡΑΓΕΤΑΙ από τον πίνακα', async () => {
    // 🔑 Η άγκυρα που κάνει τη διαρροή αδύνατη να ξαναγεννηθεί: η αναμενόμενη λίστα δεν
    //    γράφεται εδώ — **υπολογίζεται από το `PUBLIC_SHELF_KINDS`**, τον ίδιο πίνακα που
    //    διαβάζει ο κώδικας. Τέταρτη γραμμή στον πίνακα με ρίζα `listings/` ⇒ αυτή η άγκυρα
    //    **κοκκινίζει** μέχρι να απαντηθεί «πώς αδειάζει;».
    await withdrawListingShelves(LISTING);

    expect(calledKinds()).toHaveLength(listingRootKinds().length);
    expect(new Set(calledKinds())).toEqual(new Set(listingRootKinds()));
  });

  it('🔴 και ΔΕΝ αγγίζει τη ΒΙΤΡΙΝΑ — άλλη ρίζα, ΑΝΤΙΘΕΤΟΣ φρουρός ταυτότητας', async () => {
    // Χωρίς αυτό, ένα «άδειασε τα πάντα» θα περνούσε τα από πάνω και θα **πετούσε** στην
    // παραγωγή: το `publicShelfPrefix` της βιτρίνας απαιτεί ταυτότητα **εταιρείας**.
    await withdrawListingShelves(LISTING);

    expect(calledKinds()).not.toContain(SHOWCASE_SHELF);
    for (const kind of calledKinds()) {
      expect(kind.root).toBe(PUBLIC_SHELF_LISTING_ROOT);
    }
  });

  it('🔑 και ο πίνακας ΟΝΤΩΣ έχει ΔΥΟ είδη σε αυτή τη ρίζα — αλλιώς τα από πάνω είναι κενά', () => {
    // «Πράσινο επειδή κανείς δεν κοίταξε», στην ακριβή του μορφή: αν ο πίνακας έχανε τη
    // γραμμή του μοντέλου, ΟΛΑ τα από πάνω θα έμεναν πράσινα με μία μόνο κλήση.
    expect(listingRootKinds().length).toBeGreaterThanOrEqual(2);
    expect(listingRootKinds()).toContain(LISTING_SHELF);
    expect(listingRootKinds()).toContain(LISTING_MODEL_SHELF);
    expect(listingRootKinds()).toContain(LISTING_VIDEO_SHELF);
  });
});

describe('🏆 Η ΔΙΑΜΕΡΙΣΗ — ΕΝΑ πέρασμα, κάθε πηγή ΑΚΡΙΒΩΣ μία φορά', () => {
  function mixed(): readonly PublicShelfSource<ListingMaterial>[] {
    return [
      source('owner_properties/u1/a.jpg', { kind: 'photo' }),
      source('owner_properties/u1/plan.png', { kind: 'floorplan', at: SOURCE_AT, provenance: 'declared' }),
      source('owner_properties/u1/model.glb', { kind: 'model' }),
      source('owner_properties/u1/tour.mp4', { kind: 'video' }),
    ];
  }

  it('🔴 η φωτογραφία ΚΑΙ η κάτοψη πάνε στο raster· το μοντέλο ΟΧΙ', () => {
    const { raster, model, video } = partitionListingSources(mixed());

    expect(raster.map((s) => s.material.kind)).toEqual(['photo', 'floorplan']);
    expect(model.map((s) => s.material.kind)).toEqual(['model']);
    expect(video.map((s) => s.material.kind)).toEqual(['video']);
  });

  it('🔴 καμία πηγή δεν χάνεται και καμία δεν διπλογράφεται — ΕΝΑ πέρασμα', () => {
    // Η μετρημένη κλάση σφάλματος της Φ4.1: **δύο** ανεξάρτητα κατηγορήματα με άρνηση
    // μπορούν να αφήσουν κενό (καμία δεν πιάνεται) Ή να διπλογράψουν (και τα δύο πιάνουν).
    const sources = mixed();
    const { raster, model, video } = partitionListingSources(sources);

    expect(raster.length + model.length + video.length).toBe(sources.length);
    expect(new Set([...raster, ...model, ...video]).size).toBe(sources.length);
  });

  it('🔴 το ΜΟΝΤΕΛΟ δεν φτάνει ΠΟΤΕ στο ράφι εικόνων — και το αντίστροφο', async () => {
    // Αν έφτανε, ο `withPublishedGallery` θα **πετούσε** στον `case 'model'` — και η
    // δημοσίευση θα έπεφτε ολόκληρη. Η διαμέριση είναι που κρατά εκείνον τον κλάδο
    // απροσπέλαστο, δηλαδή **δεύτερο φρουρό** αντί για ζωντανή διαδρομή.
    await writeWithShelf({ set: jest.fn(async () => undefined) } as never, LISTING, listing(), mixed());

    const rasterSources = reconcilePublicShelf.mock.calls[0][2] as readonly PublicShelfSource<ListingMaterial>[];
    const modelSources = reconcilePublicModelShelf.mock.calls[0][2] as readonly PublicShelfSource<ListingMaterial>[];

    const videoSources = reconcilePublicVideoShelf.mock.calls[0][2] as readonly PublicShelfSource<ListingMaterial>[];

    // ⚠️ Καταφατικά για το raster: «ό,τι δεν είναι μοντέλο» θα άφηνε το βίντεο να περάσει στις εικόνες.
    expect(rasterSources.map((s) => s.material.kind)).toEqual(['photo', 'floorplan']);
    expect(modelSources.every((s) => s.material.kind === 'model')).toBe(true);
    expect(videoSources.map((s) => s.material.kind)).toEqual(['video']);
  });
});

describe('ΚΟ-4 (καλωδίωση) — Η ΚΑΤΟΨΗ ΟΡΟΦΟΥ ΠΕΡΝΑ ΑΠΟ ΤΟ RASTER ΡΑΦΙ ΚΑΙ ΚΑΘΕΤΑΙ ΣΤΟ ΔΙΚΟ ΤΗΣ ΚΟΥΤΙ', () => {
  const FLOOR_URL = 'https://storage.googleapis.com/bucket/listings/ownp_77aa21bc/ff.webp';
  const SELF = { outline: [0.1, 0.1, 0.9, 0.1, 0.5, 0.9], state: 'self' } as const;
  const NEIGHBOUR = { outline: [0.2, 0.2, 0.4, 0.2, 0.4, 0.4], state: 'reserved' } as const;

  function floorPlate(units: readonly { outline: readonly number[]; state: 'self' | 'reserved' }[]): ListingMaterial {
    return { kind: 'floorPlate', at: SOURCE_AT, provenance: 'measured', units };
  }

  /** Μια εικόνα όπως την αναφέρει το raster ράφι — ό,τι διαβάζει ο ενορχηστρωτής. */
  function shelfImage(url: string, material: ListingMaterial): Record<string, unknown> {
    const face = { key: 'k', url, width: 2560, height: 1829 };
    return {
      canonical: face, variants: [face], material, focalPoint: null, declaredFocalPoint: null,
      sourceFileId: null, declaredCaptureSpot: null, declaredNorthRad: null,
    };
  }

  function writtenBy(set: jest.Mock): Record<string, unknown> {
    return set.mock.calls[0][0] as Record<string, unknown>;
  }

  it('🔴 η διαμέριση τη στέλνει στο raster — ίδιο ράφι με τις φωτογραφίες, καμία δεύτερη κλήση', async () => {
    const plate = source('companies/c1/floors/f1/floor.png', floorPlate([SELF, NEIGHBOUR]));
    const photo = source('owner_properties/u1/a.jpg', { kind: 'photo' });

    expect(partitionListingSources([photo, plate]).raster).toEqual([photo, plate]);

    await writeWithShelf({ set: jest.fn(async () => undefined) } as never, LISTING, listing(), [photo, plate]);

    expect(reconcilePublicShelf).toHaveBeenCalledTimes(1);
    expect(reconcilePublicShelf.mock.calls[0][2]).toEqual([photo, plate]);
  });

  it('🔴 γράφεται στο `floorPlates[]` ΑΠΟ ΤΗΝ ΑΝΑΦΟΡΑ — και ΟΧΙ στη συλλογή ή στις κατόψεις του ακινήτου', async () => {
    // 🔴 **Η ΜΕΤΑΛΛΑΞΗ**: βγάλε το `splitFloorPlateImages` ⇒ η εικόνα φτάνει στο `withPublishedGallery`, που πετά,
    //    και η αγγελία δεν γράφεται καθόλου.
    const material = floorPlate([SELF, NEIGHBOUR]);
    reconcilePublicShelf.mockResolvedValue({
      outcome: 'reconciled',
      published: [shelfImage('https://shelf/a.webp', { kind: 'photo' }), shelfImage(FLOOR_URL, material)],
      removed: 0,
      rejected: 0,
    });

    const set = jest.fn(async () => undefined);
    await writeWithShelf({ set } as never, LISTING, listing(), [
      source('owner_properties/u1/a.jpg', { kind: 'photo' }),
      source('companies/c1/floors/f1/floor.png', material),
    ]);

    const doc = writtenBy(set);
    const plates = doc.floorPlates as readonly {
      provenance: string;
      at: string;
      value: { image: { url: string }; units: unknown };
    }[];

    expect(plates).toHaveLength(1);
    expect(plates[0].value.image.url).toBe(FLOOR_URL);
    expect(plates[0].value.units).toEqual([SELF, NEIGHBOUR]);
    expect(plates[0].provenance).toBe('measured');
    expect(plates[0].at).toBe(SOURCE_AT);
    expect((doc.gallery as readonly { url: string }[]).map((image) => image.url)).toEqual(['https://shelf/a.webp']);
    expect(doc.floorplans).toEqual([]);
  });

  it('🔴 κάτοψη που ΔΕΝ περνά την κρίση δεν φτάνει ΠΟΤΕ στο ράφι — κανένα δημόσιο byte χωρίς έγγραφο', async () => {
    // Χωρίς μονάδα «αυτό το ακίνητο»: αν ανέβαινε, η εικόνα ολόκληρου του ορόφου θα έμενε στον δημόσιο κάδο.
    const refused = source('companies/c1/floors/f1/floor.png', floorPlate([NEIGHBOUR]));
    const photo = source('owner_properties/u1/a.jpg', { kind: 'photo' });
    const set = jest.fn(async () => undefined);

    await writeWithShelf({ set } as never, LISTING, listing(), [photo, refused]);

    expect(reconcilePublicShelf.mock.calls[0][2]).toEqual([photo]);
    expect(writtenBy(set).floorPlates).toEqual([]);
  });

  it('αγγελία χωρίς κάτοψη ορόφου γράφει ΚΕΝΟ κουτί — το ίδιο έγγραφο με πριν', async () => {
    const set = jest.fn(async () => undefined);
    await writeWithShelf({ set } as never, LISTING, listing(), []);

    expect(writtenBy(set).floorPlates).toEqual([]);
  });
});

describe('🏆 Α-7 (καλωδίωση) — ΕΝΑ `set`, ΚΑΙ ΤΑ ΜΟΝΤΕΛΑ ΑΠΟ ΤΗΝ ΑΝΑΦΟΡΑ', () => {
  const MODEL_URL = 'https://storage.googleapis.com/bucket/listings/ownp_77aa21bc/aa.glb';

  function refSpy(): { set: jest.Mock; written: Record<string, unknown>[] } {
    const written: Record<string, unknown>[] = [];
    return {
      set: jest.fn(async (doc: Record<string, unknown>) => {
        written.push(doc);
      }),
      written,
    };
  }

  it('🔴 το έγγραφο γράφεται ΜΙΑ φορά — ποτέ δεύτερο `set`/`update` για τα μοντέλα', async () => {
    // Μια μερική ενημέρωση θα άφηνε το δημόσιο έγγραφο **μείγμα δύο καταστάσεων** — αυτό
    // ακριβώς που το `public-shelf.service` γράφει ως λόγο ύπαρξης της συμφιλίωσης.
    const ref = refSpy();
    await writeWithShelf(ref as never, LISTING, listing(), []);

    expect(ref.set).toHaveBeenCalledTimes(1);
  });

  it('🔴 το `models[]` του εγγράφου βγαίνει από την ΑΝΑΦΟΡΑ του ραφιού μοντέλων', async () => {
    reconcilePublicModelShelf.mockResolvedValue({
      outcome: 'reconciled',
      published: [{ key: 'listings/ownp_77aa21bc/aa.glb', url: MODEL_URL, at: SOURCE_AT }],
      removed: 0,
      rejected: 0,
    });

    const ref = refSpy();
    await writeWithShelf(ref as never, LISTING, listing(), [
      source('owner_properties/u1/model.glb', { kind: 'model' }),
    ]);

    const models = ref.written[0].models as readonly { value: { url: string }; at: string }[];
    expect(models).toHaveLength(1);
    expect(models[0].value.url).toBe(MODEL_URL);
    expect(models[0].at).toBe(SOURCE_AT);
  });

  it('🔴 πηγή που ΑΠΟΡΡΙΦΘΗΚΕ δεν εμφανίζεται — το κουτί ακολουθεί την αναφορά, όχι την επιθυμία', async () => {
    // Ο ψήστης απέρριψε (άκυρο glTF, διαφωνία λογιστικής, ταβάνι…) ⇒ κενό `published`.
    reconcilePublicModelShelf.mockResolvedValue({
      outcome: 'reconciled',
      published: [],
      removed: 0,
      rejected: 1,
    });

    const ref = refSpy();
    await writeWithShelf(ref as never, LISTING, listing(), [
      source('owner_properties/u1/model.glb', { kind: 'model' }),
    ]);

    expect(ref.written[0].models).toEqual([]);
  });

  it('🔴 ΚΑΙ ΤΑ ΔΥΟ ράφια αδειάζουν όταν το `set` αποτύχει — η αντιστάθμιση', async () => {
    // Ο παλιός φόβος: bytes δημοσιευμένα για αγγελία που δεν γράφτηκε ποτέ. Ως τη Φ4.2α η
    // αντιστάθμιση άδειαζε **μόνο** τις εικόνες ⇒ ορφανό `.glb` σε κάθε αποτυχία γραφής.
    reconcilePublicModelShelf.mockResolvedValue({
      outcome: 'reconciled',
      published: [{ key: 'listings/ownp_77aa21bc/aa.glb', url: MODEL_URL, at: SOURCE_AT }],
      removed: 0,
      rejected: 0,
    });

    const boom = { set: jest.fn(async () => { throw new Error('firestore down'); }) };
    await expect(
      writeWithShelf(boom as never, LISTING, listing(), [
        source('owner_properties/u1/model.glb', { kind: 'model' }),
      ]),
    ).rejects.toThrow('firestore down');

    // Η πρώτη κλήση καθενός ήταν η συμφιλίωση· η **δεύτερη** είναι η απόσυρση, με κενό σύνολο.
    expect(reconcilePublicShelf).toHaveBeenLastCalledWith(LISTING_SHELF, LISTING, []);
    expect(reconcilePublicModelShelf).toHaveBeenLastCalledWith(LISTING_MODEL_SHELF, LISTING, []);
  });
});
