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

// 🔑 **ΚΑΙ ΤΑ ΔΥΟ κεφάλια μοκάρονται** — όχι μόνο για ταχύτητα: το κεφάλι του μοντέλου σέρνει
//    τον ψήστη, δηλαδή **WASM** (`meshoptimizer`, `gltf-validator`). Αυτή η σουίτα ρωτά για
//    **καλωδίωση**, όχι για ψήσιμο· το ψήσιμο έχει δική του άγκυρα με **αληθινό GLB**.
jest.mock('../public-shelf.service', () => ({
  reconcilePublicShelf: (...args: ShelfCall) => reconcilePublicShelf(...args),
}));
jest.mock('../public-shelf-model.service', () => ({
  reconcilePublicModelShelf: (...args: ShelfCall) => reconcilePublicModelShelf(...args),
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
  ];
}

beforeEach(() => {
  jest.clearAllMocks();
  reconcilePublicShelf.mockResolvedValue(emptyReport());
  reconcilePublicModelShelf.mockResolvedValue(emptyReport());
});

// ---------------------------------------------------------------------------

describe('🏆 Α-8 — Η ΑΠΟΣΥΡΣΗ ΑΔΕΙΑΖΕΙ ΚΑΘΕ ΡΑΦΙ ΤΗΣ ΑΓΓΕΛΙΑΣ', () => {
  it('🔴 καλεί ΚΑΙ ΤΑ ΔΥΟ κεφάλια — η μετάλλαξη που πιάνει την επιστροφή στο ΕΝΑ ράφι', () => {
    return withdrawListingShelves(LISTING).then(() => {
      expect(reconcilePublicShelf).toHaveBeenCalledTimes(1);
      expect(reconcilePublicModelShelf).toHaveBeenCalledTimes(1);
    });
  });

  it('🔴 με ΚΕΝΟ σύνολο — «κενό σύνολο ⇒ το πρόθεμα αδειάζει», ποτέ «σβήσε τα»', async () => {
    await withdrawListingShelves(LISTING);

    expect(reconcilePublicShelf).toHaveBeenCalledWith(LISTING_SHELF, LISTING, []);
    expect(reconcilePublicModelShelf).toHaveBeenCalledWith(LISTING_MODEL_SHELF, LISTING, []);
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
  });
});

describe('🏆 Η ΔΙΑΜΕΡΙΣΗ — ΕΝΑ πέρασμα, κάθε πηγή ΑΚΡΙΒΩΣ μία φορά', () => {
  function mixed(): readonly PublicShelfSource<ListingMaterial>[] {
    return [
      source('owner_properties/u1/a.jpg', { kind: 'photo' }),
      source('owner_properties/u1/plan.png', { kind: 'floorplan', at: SOURCE_AT }),
      source('owner_properties/u1/model.glb', { kind: 'model' }),
    ];
  }

  it('🔴 η φωτογραφία ΚΑΙ η κάτοψη πάνε στο raster· το μοντέλο ΟΧΙ', () => {
    const { raster, model } = partitionListingSources(mixed());

    expect(raster.map((s) => s.material.kind)).toEqual(['photo', 'floorplan']);
    expect(model.map((s) => s.material.kind)).toEqual(['model']);
  });

  it('🔴 καμία πηγή δεν χάνεται και καμία δεν διπλογράφεται — ΕΝΑ πέρασμα', () => {
    // Η μετρημένη κλάση σφάλματος της Φ4.1: **δύο** ανεξάρτητα κατηγορήματα με άρνηση
    // μπορούν να αφήσουν κενό (καμία δεν πιάνεται) Ή να διπλογράψουν (και τα δύο πιάνουν).
    const sources = mixed();
    const { raster, model } = partitionListingSources(sources);

    expect(raster.length + model.length).toBe(sources.length);
    expect(new Set([...raster, ...model]).size).toBe(sources.length);
  });

  it('🔴 το ΜΟΝΤΕΛΟ δεν φτάνει ΠΟΤΕ στο ράφι εικόνων — και το αντίστροφο', async () => {
    // Αν έφτανε, ο `withPublishedGallery` θα **πετούσε** στον `case 'model'` — και η
    // δημοσίευση θα έπεφτε ολόκληρη. Η διαμέριση είναι που κρατά εκείνον τον κλάδο
    // απροσπέλαστο, δηλαδή **δεύτερο φρουρό** αντί για ζωντανή διαδρομή.
    await writeWithShelf({ set: jest.fn(async () => undefined) } as never, LISTING, listing(), mixed());

    const rasterSources = reconcilePublicShelf.mock.calls[0][2] as readonly PublicShelfSource<ListingMaterial>[];
    const modelSources = reconcilePublicModelShelf.mock.calls[0][2] as readonly PublicShelfSource<ListingMaterial>[];

    expect(rasterSources.every((s) => s.material.kind !== 'model')).toBe(true);
    expect(modelSources.every((s) => s.material.kind === 'model')).toBe(true);
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
