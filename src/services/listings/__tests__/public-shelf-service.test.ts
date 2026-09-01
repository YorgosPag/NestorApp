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
} from '@/services/upload/utils/storage-path-public-shelf';

// ---------------------------------------------------------------------------
// Ψεύτικος κάδος — κρατά bytes σε Map, όπως ο αληθινός κρατά objects
// ---------------------------------------------------------------------------

interface SavedObject {
  readonly bytes: Buffer;
  readonly contentType?: string;
  readonly cacheControl?: string;
  /**
   * 🔴 **Ο ψεύτικος κάδος απέκτησε μεταδεδομένα, γιατί ο αληθινός ΤΑ ΧΡΗΣΙΜΟΠΟΙΕΙ**
   * (ADR-841 §7 Α2.3): η επαναχρησιμοποίηση παραγώγων ρωτά *«ίδια πηγή; ίδια
   * συνταγή;»* πάνω στα custom metadata. Ένας κάδος χωρίς αυτά θα έκανε τη σουίτα
   * να μετρά **άλλη** διαδρομή από αυτήν που τρέχει στην παραγωγή.
   */
  readonly custom?: Record<string, string>;
  /** Η **γενιά** — αλλάζει σε κάθε επανεγγραφή, όπως στο GCS. */
  readonly generation: number;
}

let generationCounter = 0;

class FakeBucket {
  readonly objects = new Map<string, SavedObject>();
  saveCalls = 0;
  deleteCalls = 0;
  downloadCalls = 0;

  /** Γράφει ωμά, όπως ένα `gsutil cp` — χωρίς να περάσει από τον γραφέα μας. */
  put(name: string, bytes: Buffer): void {
    generationCounter += 1;
    this.objects.set(name, { bytes, generation: generationCounter });
  }

  file(name: string) {
    const bucket = this;
    return {
      name,
      get metadata() {
        const found = bucket.objects.get(name);
        return { generation: String(found?.generation ?? ''), metadata: found?.custom };
      },
      getMetadata: async () => {
        const found = bucket.objects.get(name);
        if (!found) throw new Error(`no such object: ${name}`);
        return [{ generation: String(found.generation) }];
      },
      save: async (
        bytes: Buffer,
        options?: {
          contentType?: string;
          metadata?: { cacheControl?: string; metadata?: Record<string, string> };
        },
      ) => {
        this.saveCalls += 1;
        generationCounter += 1;
        this.objects.set(name, {
          bytes,
          contentType: options?.contentType,
          cacheControl: options?.metadata?.cacheControl,
          custom: options?.metadata?.metadata,
          generation: generationCounter,
        });
      },
      delete: async () => {
        this.deleteCalls += 1;
        this.objects.delete(name);
      },
      download: async (): Promise<[Buffer]> => {
        this.downloadCalls += 1;
        const found = this.objects.get(name);
        if (!found) throw new Error(`no such object: ${name}`);
        return [found.bytes];
      },
    };
  }

  async getFiles({ prefix }: { prefix: string }) {
    const names = [...this.objects.keys()].filter((name) => name.startsWith(prefix));
    return [names.map((name) => this.file(name))];
  }
}

const shelf = new FakeBucket();
const privateBucket = new FakeBucket();

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
async function givenPrivatePhoto(path: string, tint: number): Promise<{ privateStoragePath: string }> {
  const bytes = await sharp({
    create: { width: 60, height: 40, channels: 3, background: { r: tint, g: 40, b: 90 } },
  })
    .jpeg()
    .toBuffer();
  privateBucket.put(path, bytes);
  return { privateStoragePath: path };
}

function shelfKeys(): string[] {
  return [...shelf.objects.keys()].sort();
}

beforeEach(() => {
  shelf.objects.clear();
  privateBucket.objects.clear();
  shelf.saveCalls = 0;
  shelf.deleteCalls = 0;
  privateBucket.downloadCalls = 0;
});

// ---------------------------------------------------------------------------

describe('Κ1 — δημοσίευση: το ράφι αποκτά ΑΚΡΙΒΩΣ ό,τι ζητήθηκε', () => {
  it('ανεβάζει καθαρισμένα bytes με αμετάβλητο κλειδί και σωστές επικεφαλίδες', async () => {
    const source = await givenPrivatePhoto('owner_properties/u1/ownp_77aa21bc/a.jpg', 200);

    const report = await reconcilePublicShelf(LISTING, [source]);

    expect(report.outcome).toBe('reconciled');
    expect(report.published).toHaveLength(1);
    expect(shelfKeys()).toHaveLength(1);

    const [key] = shelfKeys();
    expect(parsePublicShelfKey(key)).toMatchObject({ listingId: LISTING, ext: 'webp' });

    const saved = shelf.objects.get(key);
    expect(saved?.contentType).toBe('image/webp');
    expect(saved?.cacheControl).toBe(PUBLIC_SHELF_CACHE_CONTROL);
  });

  it('το URL δείχνει στο δημόσιο ράφι, όχι στο Firebase', async () => {
    const source = await givenPrivatePhoto('owner_properties/u1/ownp_77aa21bc/a.jpg', 200);
    const report = await reconcilePublicShelf(LISTING, [source]);

    expect(report.published[0]?.canonical.url).toContain('https://storage.googleapis.com/');
    expect(report.published[0]?.canonical.url).not.toContain('firebasestorage');
  });

  it('🔑 δημοσιεύει ΚΑΘΑΡΙΣΜΕΝΑ bytes — όχι το πρωτότυπο', async () => {
    const source = await givenPrivatePhoto('owner_properties/u1/ownp_77aa21bc/a.jpg', 200);
    await reconcilePublicShelf(LISTING, [source]);

    const original = privateBucket.objects.get(source.privateStoragePath)!.bytes;
    const published = shelf.objects.get(shelfKeys()[0])!.bytes;

    expect(published.equals(original)).toBe(false);
    expect((await sharp(published).metadata()).format).toBe('webp');
  });
});

describe('Κ2 — ΙΔΕΜΠΟΤΕΝΤΙΚΟΤΗΤΑ: ίδια bytes ⇒ καμία δεύτερη εγγραφή', () => {
  it('η δεύτερη κλήση δεν ξαναγράφει και δεν σβήνει τίποτα', async () => {
    const source = await givenPrivatePhoto('owner_properties/u1/ownp_77aa21bc/a.jpg', 200);

    await reconcilePublicShelf(LISTING, [source]);
    const afterFirst = shelfKeys();
    const savesAfterFirst = shelf.saveCalls;

    await reconcilePublicShelf(LISTING, [source]);

    expect(shelfKeys()).toEqual(afterFirst);
    expect(shelf.saveCalls).toBe(savesAfterFirst); // μηδέν επιπλέον εγγραφή
    expect(shelf.deleteCalls).toBe(0);
  });

  it('άλλα bytes ⇒ ΑΛΛΟ κλειδί, και το παλιό φεύγει', async () => {
    const first = await givenPrivatePhoto('owner_properties/u1/ownp_77aa21bc/a.jpg', 200);
    await reconcilePublicShelf(LISTING, [first]);
    const oldKey = shelfKeys()[0];

    // ο κάτοχος αντικαθιστά τη φωτογραφία στο ΙΔΙΟ μονοπάτι
    await givenPrivatePhoto('owner_properties/u1/ownp_77aa21bc/a.jpg', 15);
    await reconcilePublicShelf(LISTING, [first]);

    expect(shelfKeys()).toHaveLength(1);
    expect(shelfKeys()[0]).not.toBe(oldKey);
    expect(shelf.objects.has(oldKey)).toBe(false);
  });
});

describe('Κ3 — ΑΠΟΣΥΡΣΗ: κενό σύνολο ⇒ το πρόθεμα ΑΔΕΙΑΖΕΙ', () => {
  it('σβήνει ό,τι δημοσιεύτηκε όταν η αγγελία αποσύρεται', async () => {
    const a = await givenPrivatePhoto('owner_properties/u1/ownp_77aa21bc/a.jpg', 200);
    const b = await givenPrivatePhoto('owner_properties/u1/ownp_77aa21bc/b.jpg', 30);
    await reconcilePublicShelf(LISTING, [a, b]);
    expect(shelfKeys()).toHaveLength(2);

    const report = await reconcilePublicShelf(LISTING, []);

    expect(report.outcome).toBe('reconciled');
    expect(report.removed).toBe(2);
    expect(shelfKeys()).toEqual([]);
  });

  it('η ΕΠΑΝΑΦΟΡΑ ξαναγεμίζει — το ράφι δεν κατέχει κατάσταση', async () => {
    const a = await givenPrivatePhoto('owner_properties/u1/ownp_77aa21bc/a.jpg', 200);
    await reconcilePublicShelf(LISTING, [a]);
    const original = shelfKeys();

    await reconcilePublicShelf(LISTING, []); // απόσυρση
    expect(shelfKeys()).toEqual([]);

    await reconcilePublicShelf(LISTING, [a]); // επαναφορά
    expect(shelfKeys()).toEqual(original); // ΤΟ ΙΔΙΟ κλειδί — content-addressed
  });
});

describe('Κ4 — Η ΑΠΟΜΟΝΩΣΗ: η μία αγγελία δεν αγγίζει την άλλη', () => {
  it('η απόσυρση της μιας αφήνει άθικτη τη γειτονική με κοινό πρόθεμα ονόματος', async () => {
    // 🔴 `ownp_1` ⇄ `ownp_12`: χωρίς την κάθετη στο πρόθεμα, η μία θα έσβηνε την άλλη.
    const one = await givenPrivatePhoto('owner_properties/u1/one.jpg', 200);
    const twelve = await givenPrivatePhoto('owner_properties/u1/twelve.jpg', 60);

    await reconcilePublicShelf('ownp_1', [one]);
    await reconcilePublicShelf('ownp_12', [twelve]);
    expect(shelfKeys()).toHaveLength(2);

    await reconcilePublicShelf('ownp_1', []);

    const survivors = shelfKeys();
    expect(survivors).toHaveLength(1);
    expect(parsePublicShelfKey(survivors[0])?.listingId).toBe('ownp_12');
  });

  it('ΔΕΝ αγγίζει αντικείμενα που δεν αναγνωρίζει', async () => {
    // Ο ανεκτικός αναγνώστης: ό,τι δεν είναι δικής μας μορφής ΜΕΝΕΙ.
    shelf.put(`listings/${LISTING}/ksenο-arxeio.txt`, Buffer.from('x'));

    await reconcilePublicShelf(LISTING, []);

    expect(shelf.objects.has(`listings/${LISTING}/ksenο-arxeio.txt`)).toBe(true);
  });
});

describe('Κ5 — ΑΝΘΕΚΤΙΚΟΤΗΤΑ: μια χαλασμένη πηγή δεν ρίχνει τη δημοσίευση', () => {
  it('δημοσιεύει τις καλές και ΜΕΤΡΑΕΙ τις απορριφθείσες', async () => {
    const good = await givenPrivatePhoto('owner_properties/u1/good.jpg', 200);
    privateBucket.put('owner_properties/u1/broken.jpg', Buffer.from('MZ not an image'));

    const report = await reconcilePublicShelf(LISTING, [
      good,
      { privateStoragePath: 'owner_properties/u1/broken.jpg' },
    ]);

    expect(report.outcome).toBe('reconciled');
    expect(report.published).toHaveLength(1);
    expect(report.rejected).toBe(1);
  });

  it('πηγή που ΛΕΙΠΕΙ μετριέται, δεν πετά', async () => {
    const report = await reconcilePublicShelf(LISTING, [
      { privateStoragePath: 'owner_properties/u1/does-not-exist.jpg' },
    ]);

    expect(report.outcome).toBe('reconciled');
    expect(report.rejected).toBe(1);
    expect(shelfKeys()).toEqual([]);
  });

  it('ταυτότητα μισθωτή ως listingId ⇒ ΑΠΟΤΥΓΧΑΝΕΙ, δεν δημοσιεύει', async () => {
    const source = await givenPrivatePhoto('owner_properties/u1/a.jpg', 200);

    const report = await reconcilePublicShelf('comp_secret', [source]);

    expect(report.outcome).toBe('failed');
    expect(shelfKeys()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Φ3 — τα παράγωγα (ADR-841 §7 Α2.2 · Α2.3)
// ---------------------------------------------------------------------------

/** Ένα **μεγάλο** πρωτότυπο, ώστε τα τρία πλάτη να δώσουν **διαφορετικά** bytes. */
async function givenLargePrivatePhoto(path: string): Promise<{ privateStoragePath: string }> {
  const bytes = await sharp({
    create: { width: 1400, height: 1000, channels: 3, background: { r: 10, g: 120, b: 200 } },
  })
    .jpeg()
    .toBuffer();
  privateBucket.put(path, bytes);
  return { privateStoragePath: path };
}

describe('Κ6 — ΤΑ ΠΑΡΑΓΩΓΑ: κάθε πλάτος έχει ΔΙΚΗ ΤΟΥ διεύθυνση, ένα manifest τα δένει', () => {
  it('ένα μεγάλο πρωτότυπο δίνει ΤΡΙΑ διακριτά αντικείμενα, σε αύξον πλάτος', async () => {
    const source = await givenLargePrivatePhoto('owner_properties/u1/big.jpg');

    const report = await reconcilePublicShelf(LISTING, [source]);

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

    const report = await reconcilePublicShelf(LISTING, [source]);

    expect(report.published[0].variants).toHaveLength(1);
    expect(shelfKeys()).toHaveLength(1);
  });

  it('η ΑΠΟΣΥΡΣΗ παίρνει ΟΛΑ τα παράγωγα, όχι μόνο το κανονικό', async () => {
    const source = await givenLargePrivatePhoto('owner_properties/u1/big.jpg');
    await reconcilePublicShelf(LISTING, [source]);
    expect(shelfKeys()).toHaveLength(3);

    const report = await reconcilePublicShelf(LISTING, []);

    expect(report.removed).toBe(3);
    expect(shelfKeys()).toEqual([]);
  });
});

describe('Κ7 — ΕΠΑΝΑΧΡΗΣΙΜΟΠΟΙΗΣΗ: η δεύτερη αποθήκευση δεν ξανακατεβάζει τίποτα', () => {
  it('ίδια πηγή + ίδια συνταγή ⇒ ΜΗΔΕΝ κατεβάσματα, μηδέν εγγραφές', async () => {
    const source = await givenLargePrivatePhoto('owner_properties/u1/big.jpg');
    await reconcilePublicShelf(LISTING, [source]);

    privateBucket.downloadCalls = 0;
    shelf.saveCalls = 0;

    const report = await reconcilePublicShelf(LISTING, [source]);

    // 🔴 **Αυτό είναι όλο το νόημα της Α2.3**: η συμφιλίωση τρέχει σε κάθε αποθήκευση
    //    του κατόχου, και χωρίς αυτό θα κατέβαζε + ξανακωδικοποιούσε κάθε φωτογραφία.
    expect(privateBucket.downloadCalls).toBe(0);
    expect(shelf.saveCalls).toBe(0);
    expect(report.published[0].variants).toHaveLength(3);
    expect(shelfKeys()).toHaveLength(3);
  });

  it('🔴 ΑΝΤΙΚΑΤΑΣΤΑΘΗΚΕ το πρωτότυπο ⇒ ΝΕΑ γενιά ⇒ ξανακατεβαίνει και τα παλιά φεύγουν', async () => {
    const source = await givenLargePrivatePhoto('owner_properties/u1/big.jpg');
    await reconcilePublicShelf(LISTING, [source]);
    const before = shelfKeys();

    // ο κάτοχος ανεβάζει ΑΛΛΗ φωτογραφία στο ΙΔΙΟ μονοπάτι
    const replaced = await sharp({
      create: { width: 1400, height: 1000, channels: 3, background: { r: 220, g: 20, b: 20 } },
    })
      .jpeg()
      .toBuffer();
    privateBucket.put(source.privateStoragePath, replaced);
    privateBucket.downloadCalls = 0;

    await reconcilePublicShelf(LISTING, [source]);

    expect(privateBucket.downloadCalls).toBe(1);
    expect(shelfKeys()).toHaveLength(3);
    expect(shelfKeys()).not.toEqual(before);
  });

  it('τα μεταδεδομένα ΔΕΝ κουβαλούν το ιδιωτικό μονοπάτι — ούτε ένα κομμάτι του', async () => {
    // 🔴 Ο `legacyObjectReader` δίνει `objects.get`, που επιστρέφει **και τα
    //    μεταδεδομένα**: ωμό μονοπάτι εκεί μέσα = διαρροή του `userId` σε ανώνυμο.
    const source = await givenLargePrivatePhoto('owner_properties/u-secret-42/big.jpg');
    await reconcilePublicShelf(LISTING, [source]);

    const serialised = JSON.stringify([...shelf.objects.values()].map((o) => o.custom));
    expect(serialised).not.toContain('u-secret-42');
    expect(serialised).not.toContain('owner_properties');
  });
});
