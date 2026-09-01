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
}

class FakeBucket {
  readonly objects = new Map<string, SavedObject>();
  saveCalls = 0;
  deleteCalls = 0;

  file(name: string) {
    return {
      name,
      save: async (
        bytes: Buffer,
        options?: { contentType?: string; metadata?: { cacheControl?: string } },
      ) => {
        this.saveCalls += 1;
        this.objects.set(name, {
          bytes,
          contentType: options?.contentType,
          cacheControl: options?.metadata?.cacheControl,
        });
      },
      delete: async () => {
        this.deleteCalls += 1;
        this.objects.delete(name);
      },
      download: async (): Promise<[Buffer]> => {
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
  privateBucket.objects.set(path, { bytes });
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

    expect(report.published[0]?.url).toContain('https://storage.googleapis.com/');
    expect(report.published[0]?.url).not.toContain('firebasestorage');
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
    shelf.objects.set(`listings/${LISTING}/ksenο-arxeio.txt`, { bytes: Buffer.from('x') });

    await reconcilePublicShelf(LISTING, []);

    expect(shelf.objects.has(`listings/${LISTING}/ksenο-arxeio.txt`)).toBe(true);
  });
});

describe('Κ5 — ΑΝΘΕΚΤΙΚΟΤΗΤΑ: μια χαλασμένη πηγή δεν ρίχνει τη δημοσίευση', () => {
  it('δημοσιεύει τις καλές και ΜΕΤΡΑΕΙ τις απορριφθείσες', async () => {
    const good = await givenPrivatePhoto('owner_properties/u1/good.jpg', 200);
    privateBucket.objects.set('owner_properties/u1/broken.jpg', { bytes: Buffer.from('MZ not an image') });

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
