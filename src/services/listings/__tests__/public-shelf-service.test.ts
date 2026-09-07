/**
 * @jest-environment node
 *
 * @fileoverview **Η ΑΓΚΥΡΑ ΤΟΥ ΚΥΚΛΟΥ ΖΩΗΣ** — το ράφι γίνεται ΑΚΡΙΒΩΣ το επιθυμητό σύνολο.
 * @related ADR-841 §7 Α12.5 · Α12.6 · public-shelf.service.ts
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΙ ΡΩΤΑ ΑΥΤΗ Η ΣΟΥΙΤΑ ΠΟΥ ΚΑΜΙΑ ΑΛΛΗ ΔΕΝ ΡΩΤΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 *   **Ένα ράφι που μόνο γεμίζει είναι διαρροή που μεγαλώνει.**
 *
 * Η απόσυρση της αγγελίας είναι **αναστρέψιμη** (`lifecycle: 'withdrawn'`, χωρίς
 * `DELETE`), οπότε ένας σβήστης «κατά συμβάν» θα έχανε το συμβάν. Η απάντηση της Α12.6
 * είναι **συμφιλίωση προς επιθυμητό σύνολο** — και αυτό είναι εκτελέσιμο ερώτημα:
 * *μετά τη γραφή, το πρόθεμα περιέχει ΑΚΡΙΒΩΣ ό,τι ζητήθηκε, ούτε ένα byte παραπάνω;*
 *
 * ⚠️ Ο **καθαριστής τρέχει αληθινός** (`sharp`), δεν μοκάρεται: αλλιώς η σουίτα θα
 * επιβεβαίωνε ότι «κάτι ανέβηκε» χωρίς να ξέρει **τι** — και το κλειδί είναι το hash
 * **της εξόδου του καθαριστή**, άρα ένας μοκαρισμένος καθαριστής θα ακύρωνε ακριβώς
 * την ιδιότητα που κάνει τη σχεδίαση να στέκει (Α12.7).
 */

import sharp from 'sharp';

import {
  PUBLIC_SHELF_CACHE_CONTROL,
  parsePublicShelfKey,
  type PublicShelfSource,
} from '@/services/upload/utils/storage-path-public-shelf';
import { LISTING_SHELF } from '@/services/upload/utils/public-shelf-kinds';

// 🔑 **Ο ψεύτικος κάδος είναι ΚΟΙΝΟΣ** (N.18 / CHECK 3.28): η ίδια κλάση ζούσε αυτούσια
//    και στο `showcase-mark-publication.test.ts`, με ΔΙΑΦΟΡΕΤΙΚΟ σύνολο μετρητών — δύο
//    απαντήσεις στο «τι θυμάται ο κάδος;». Εδώ είναι η **ένωση**.
import { FakeShelfBucket } from '@/services/upload/__fixtures__/fake-shelf-bucket';

const shelf = new FakeShelfBucket();
const privateBucket = new FakeShelfBucket();

jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminStorage: () => ({ bucket: () => shelf }),
  getAdminBucket: () => privateBucket,
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { reconcilePublicShelf } = require('../public-shelf.service') as
  typeof import('../public-shelf.service');

// ---------------------------------------------------------------------------
// Βοηθοί
// ---------------------------------------------------------------------------

const LISTING = 'ownp_77aa21bc';

/** Βάζει μια αληθινή φωτογραφία στον **ιδιωτικό** κάδο και επιστρέφει το μονοπάτι της. */
async function givenPrivatePhoto(path: string, tint: number): Promise<PublicShelfSource> {
  const bytes = await sharp({
    create: { width: 60, height: 40, channels: 3, background: { r: tint, g: 40, b: 90 } },
  })
    .jpeg()
    .toBuffer();
  privateBucket.put(path, bytes);
  return { privateStoragePath: path, material: { kind: 'photo' } };
}

function shelfKeys(): string[] {
  return shelf.keys();
}

beforeEach(() => {
  shelf.reset();
  privateBucket.reset();
});

// ---------------------------------------------------------------------------

describe('Κ1 — δημοσίευση: το ράφι αποκτά ΑΚΡΙΒΩΣ ό,τι ζητήθηκε', () => {
  it('ανεβάζει καθαρισμένα bytes με αμετάβλητο κλειδί και σωστές επικεφαλίδες', async () => {
    const source = await givenPrivatePhoto('owner_properties/u1/ownp_77aa21bc/a.jpg', 200);

    const report = await reconcilePublicShelf(LISTING_SHELF, LISTING, [source]);

    expect(report.outcome).toBe('reconciled');
    expect(report.published).toHaveLength(1);
    expect(shelfKeys()).toHaveLength(1);

    const [key] = shelfKeys();
    expect(parsePublicShelfKey(LISTING_SHELF, key)).toMatchObject({ subjectId: LISTING, ext: 'webp' });

    const saved = shelf.objects.get(key);
    expect(saved?.contentType).toBe('image/webp');
    expect(saved?.cacheControl).toBe(PUBLIC_SHELF_CACHE_CONTROL);
  });

  it('το URL δείχνει στο δημόσιο ράφι, όχι στο Firebase', async () => {
    const source = await givenPrivatePhoto('owner_properties/u1/ownp_77aa21bc/a.jpg', 200);
    const report = await reconcilePublicShelf(LISTING_SHELF, LISTING, [source]);

    expect(report.published[0]?.canonical.url).toContain('https://storage.googleapis.com/');
    expect(report.published[0]?.canonical.url).not.toContain('firebasestorage');
  });

  it('🔑 δημοσιεύει ΚΑΘΑΡΙΣΜΕΝΑ bytes — όχι το πρωτότυπο', async () => {
    const source = await givenPrivatePhoto('owner_properties/u1/ownp_77aa21bc/a.jpg', 200);
    await reconcilePublicShelf(LISTING_SHELF, LISTING, [source]);

    const original = privateBucket.objects.get(source.privateStoragePath)!.bytes;
    const published = shelf.objects.get(shelfKeys()[0])!.bytes;

    expect(published.equals(original)).toBe(false);
    expect((await sharp(published).metadata()).format).toBe('webp');
  });
});

describe('Κ2 — ΙΔΕΜΠΟΤΕΝΤΙΚΟΤΗΤΑ: ίδια bytes ⇒ καμία δεύτερη εγγραφή', () => {
  it('η δεύτερη κλήση δεν ξαναγράφει και δεν σβήνει τίποτα', async () => {
    const source = await givenPrivatePhoto('owner_properties/u1/ownp_77aa21bc/a.jpg', 200);

    await reconcilePublicShelf(LISTING_SHELF, LISTING, [source]);
    const afterFirst = shelfKeys();
    const savesAfterFirst = shelf.saveCalls;

    await reconcilePublicShelf(LISTING_SHELF, LISTING, [source]);

    expect(shelfKeys()).toEqual(afterFirst);
    expect(shelf.saveCalls).toBe(savesAfterFirst); // μηδέν επιπλέον εγγραφή
    expect(shelf.deleteCalls).toBe(0);
  });

  it('άλλα bytes ⇒ ΑΛΛΟ κλειδί, και το παλιό φεύγει', async () => {
    const first = await givenPrivatePhoto('owner_properties/u1/ownp_77aa21bc/a.jpg', 200);
    await reconcilePublicShelf(LISTING_SHELF, LISTING, [first]);
    const oldKey = shelfKeys()[0];

    // ο κάτοχος αντικαθιστά τη φωτογραφία στο ΙΔΙΟ μονοπάτι
    await givenPrivatePhoto('owner_properties/u1/ownp_77aa21bc/a.jpg', 15);
    await reconcilePublicShelf(LISTING_SHELF, LISTING, [first]);

    expect(shelfKeys()).toHaveLength(1);
    expect(shelfKeys()[0]).not.toBe(oldKey);
    expect(shelf.objects.has(oldKey)).toBe(false);
  });
});

describe('Κ3 — ΑΠΟΣΥΡΣΗ: κενό σύνολο ⇒ το πρόθεμα ΑΔΕΙΑΖΕΙ', () => {
  it('σβήνει ό,τι δημοσιεύτηκε όταν η αγγελία αποσύρεται', async () => {
    const a = await givenPrivatePhoto('owner_properties/u1/ownp_77aa21bc/a.jpg', 200);
    const b = await givenPrivatePhoto('owner_properties/u1/ownp_77aa21bc/b.jpg', 30);
    await reconcilePublicShelf(LISTING_SHELF, LISTING, [a, b]);
    expect(shelfKeys()).toHaveLength(2);

    const report = await reconcilePublicShelf(LISTING_SHELF, LISTING, []);

    expect(report.outcome).toBe('reconciled');
    expect(report.removed).toBe(2);
    expect(shelfKeys()).toEqual([]);
  });

  it('η ΕΠΑΝΑΦΟΡΑ ξαναγεμίζει — το ράφι δεν κατέχει κατάσταση', async () => {
    const a = await givenPrivatePhoto('owner_properties/u1/ownp_77aa21bc/a.jpg', 200);
    await reconcilePublicShelf(LISTING_SHELF, LISTING, [a]);
    const original = shelfKeys();

    await reconcilePublicShelf(LISTING_SHELF, LISTING, []); // απόσυρση
    expect(shelfKeys()).toEqual([]);

    await reconcilePublicShelf(LISTING_SHELF, LISTING, [a]); // επαναφορά
    expect(shelfKeys()).toEqual(original); // ΤΟ ΙΔΙΟ κλειδί — content-addressed
  });
});

describe('Κ4 — Η ΑΠΟΜΟΝΩΣΗ: η μία αγγελία δεν αγγίζει την άλλη', () => {
  it('η απόσυρση της μιας αφήνει άθικτη τη γειτονική με κοινό πρόθεμα ονόματος', async () => {
    // 🔴 `ownp_1` ⇄ `ownp_12`: χωρίς την κάθετη στο πρόθεμα, η μία θα έσβηνε την άλλη.
    const one = await givenPrivatePhoto('owner_properties/u1/one.jpg', 200);
    const twelve = await givenPrivatePhoto('owner_properties/u1/twelve.jpg', 60);

    await reconcilePublicShelf(LISTING_SHELF, 'ownp_1', [one]);
    await reconcilePublicShelf(LISTING_SHELF, 'ownp_12', [twelve]);
    expect(shelfKeys()).toHaveLength(2);

    await reconcilePublicShelf(LISTING_SHELF, 'ownp_1', []);

    const survivors = shelfKeys();
    expect(survivors).toHaveLength(1);
    expect(parsePublicShelfKey(LISTING_SHELF, survivors[0])?.subjectId).toBe('ownp_12');
  });

  it('ΔΕΝ αγγίζει αντικείμενα που δεν αναγνωρίζει', async () => {
    // Ο ανεκτικός αναγνώστης: ό,τι δεν είναι δικής μας μορφής ΜΕΝΕΙ.
    shelf.put(`listings/${LISTING}/ksenο-arxeio.txt`, Buffer.from('x'));

    await reconcilePublicShelf(LISTING_SHELF, LISTING, []);

    expect(shelf.objects.has(`listings/${LISTING}/ksenο-arxeio.txt`)).toBe(true);
  });
});

describe('Κ5 — ΑΝΘΕΚΤΙΚΟΤΗΤΑ: μια χαλασμένη πηγή δεν ρίχνει τη δημοσίευση', () => {
  it('δημοσιεύει τις καλές και ΜΕΤΡΑΕΙ τις απορριφθείσες', async () => {
    const good = await givenPrivatePhoto('owner_properties/u1/good.jpg', 200);
    privateBucket.put('owner_properties/u1/broken.jpg', Buffer.from('MZ not an image'));

    const report = await reconcilePublicShelf(LISTING_SHELF, LISTING, [
      good,
      { privateStoragePath: 'owner_properties/u1/broken.jpg', material: { kind: 'photo' } },
    ]);

    expect(report.outcome).toBe('reconciled');
    expect(report.published).toHaveLength(1);
    expect(report.rejected).toBe(1);
  });

  it('πηγή που ΛΕΙΠΕΙ μετριέται, δεν πετά', async () => {
    const report = await reconcilePublicShelf(LISTING_SHELF, LISTING, [
      { privateStoragePath: 'owner_properties/u1/does-not-exist.jpg', material: { kind: 'photo' } },
    ]);

    expect(report.outcome).toBe('reconciled');
    expect(report.rejected).toBe(1);
    expect(shelfKeys()).toEqual([]);
  });

  it('ταυτότητα μισθωτή ως listingId ⇒ ΑΠΟΤΥΓΧΑΝΕΙ, δεν δημοσιεύει', async () => {
    const source = await givenPrivatePhoto('owner_properties/u1/a.jpg', 200);

    const report = await reconcilePublicShelf(LISTING_SHELF, 'comp_secret', [source]);

    expect(report.outcome).toBe('failed');
    expect(shelfKeys()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Φ3 — τα παράγωγα (ADR-841 §7 Α2.2 · Α2.3)
// ---------------------------------------------------------------------------

/** Ένα **μεγάλο** πρωτότυπο, ώστε τα τρία πλάτη να δώσουν **διαφορετικά** bytes. */
async function givenLargePrivatePhoto(path: string): Promise<PublicShelfSource> {
  const bytes = await sharp({
    create: { width: 1400, height: 1000, channels: 3, background: { r: 10, g: 120, b: 200 } },
  })
    .jpeg()
    .toBuffer();
  privateBucket.put(path, bytes);
  return { privateStoragePath: path, material: { kind: 'photo' } };
}

describe('Κ6 — ΤΑ ΠΑΡΑΓΩΓΑ: κάθε πλάτος έχει ΔΙΚΗ ΤΟΥ διεύθυνση, ένα manifest τα δένει', () => {
  it('ένα μεγάλο πρωτότυπο δίνει ΤΡΙΑ διακριτά αντικείμενα, σε αύξον πλάτος', async () => {
    const source = await givenLargePrivatePhoto('owner_properties/u1/big.jpg');

    const report = await reconcilePublicShelf(LISTING_SHELF, LISTING, [source]);

    const [image] = report.published;
    expect(image.variants).toHaveLength(3);
    expect(image.variants.map((v) => v.width)).toEqual([640, 1280, 1400]);
    // 🔑 Το κανονικό είναι το **μεγαλύτερο**, και είναι μέσα στα παράγωγα.
    expect(image.canonical).toEqual(image.variants[2]);
    expect(new Set(image.variants.map((v) => v.key)).size).toBe(3);
    expect(shelfKeys()).toHaveLength(3);
  });

  it('🏆 μικρό πρωτότυπο ⇒ τα περιττά παράγωγα ΕΞΑΦΑΝΙΖΟΝΤΑΙ ΜΟΝΑ ΤΟΥΣ', async () => {
    // Με `withoutEnlargement`, μια 60x40 δίνει για ΚΑΙ ΤΑ ΤΡΙΑ πλάτη τα ΙΔΙΑ bytes ⇒
    // ίδιο sha256 ⇒ **ένα** αντικείμενο. Κανένας κανόνας δεν το απέτρεψε — η
    // διεύθυνση περιεχομένου το κάνει δομικά (ADR-841 §7 Α2.2).
    const source = await givenPrivatePhoto('owner_properties/u1/small.jpg', 200);

    const report = await reconcilePublicShelf(LISTING_SHELF, LISTING, [source]);

    expect(report.published[0].variants).toHaveLength(1);
    expect(shelfKeys()).toHaveLength(1);
  });

  it('η ΑΠΟΣΥΡΣΗ παίρνει ΟΛΑ τα παράγωγα, όχι μόνο το κανονικό', async () => {
    const source = await givenLargePrivatePhoto('owner_properties/u1/big.jpg');
    await reconcilePublicShelf(LISTING_SHELF, LISTING, [source]);
    expect(shelfKeys()).toHaveLength(3);

    const report = await reconcilePublicShelf(LISTING_SHELF, LISTING, []);

    expect(report.removed).toBe(3);
    expect(shelfKeys()).toEqual([]);
  });
});

describe('Κ7 — ΕΠΑΝΑΧΡΗΣΙΜΟΠΟΙΗΣΗ: η δεύτερη αποθήκευση δεν ξανακατεβάζει τίποτα', () => {
  it('ίδια πηγή + ίδια συνταγή ⇒ ΜΗΔΕΝ κατεβάσματα, μηδέν εγγραφές', async () => {
    const source = await givenLargePrivatePhoto('owner_properties/u1/big.jpg');
    await reconcilePublicShelf(LISTING_SHELF, LISTING, [source]);

    privateBucket.downloadCalls = 0;
    shelf.saveCalls = 0;

    const report = await reconcilePublicShelf(LISTING_SHELF, LISTING, [source]);

    // 🔴 **Αυτό είναι όλο το νόημα της Α2.3**: η συμφιλίωση τρέχει σε κάθε αποθήκευση
    //    του κατόχου, και χωρίς αυτό θα κατέβαζε + ξανακωδικοποιούσε κάθε φωτογραφία.
    expect(privateBucket.downloadCalls).toBe(0);
    expect(shelf.saveCalls).toBe(0);
    expect(report.published[0].variants).toHaveLength(3);
    expect(shelfKeys()).toHaveLength(3);
  });

  it('🔴 ΑΝΤΙΚΑΤΑΣΤΑΘΗΚΕ το πρωτότυπο ⇒ ΝΕΑ γενιά ⇒ ξανακατεβαίνει και τα παλιά φεύγουν', async () => {
    const source = await givenLargePrivatePhoto('owner_properties/u1/big.jpg');
    await reconcilePublicShelf(LISTING_SHELF, LISTING, [source]);
    const before = shelfKeys();

    // ο κάτοχος ανεβάζει ΑΛΛΗ φωτογραφία στο ΙΔΙΟ μονοπάτι
    const replaced = await sharp({
      create: { width: 1400, height: 1000, channels: 3, background: { r: 220, g: 20, b: 20 } },
    })
      .jpeg()
      .toBuffer();
    privateBucket.put(source.privateStoragePath, replaced);
    privateBucket.downloadCalls = 0;

    await reconcilePublicShelf(LISTING_SHELF, LISTING, [source]);

    expect(privateBucket.downloadCalls).toBe(1);
    expect(shelfKeys()).toHaveLength(3);
    expect(shelfKeys()).not.toEqual(before);
  });

  it('τα μεταδεδομένα ΔΕΝ κουβαλούν το ιδιωτικό μονοπάτι — ούτε ένα κομμάτι του', async () => {
    // 🔴 Ο `legacyObjectReader` δίνει `objects.get`, που επιστρέφει **και τα
    //    μεταδεδομένα**: ωμό μονοπάτι εκεί μέσα = διαρροή του `userId` σε ανώνυμο.
    const source = await givenLargePrivatePhoto('owner_properties/u-secret-42/big.jpg');
    await reconcilePublicShelf(LISTING_SHELF, LISTING, [source]);

    const serialised = JSON.stringify([...shelf.objects.values()].map((o) => o.custom));
    expect(serialised).not.toContain('u-secret-42');
    expect(serialised).not.toContain('owner_properties');
  });
});
