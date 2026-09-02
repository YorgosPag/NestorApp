/**
 * @jest-environment node
 *
 * @fileoverview **Η ΑΓΚΥΡΑ ΤΗΣ ΚΑΛΩΔΙΩΣΗΣ** — η σειρά, το δέσιμο, η αντιστάθμιση.
 * @related ADR-841 §7 (Α2.2 · Α12.6) · services/listings/publish-public-listing
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΙ ΡΩΤΑ ΑΥΤΗ Η ΣΟΥΙΤΑ ΠΟΥ ΚΑΜΙΑ ΑΛΛΗ ΔΕΝ ΡΩΤΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 *   **Ρωτήθηκε το ράφι ΠΡΙΝ γραφτεί το έγγραφο;**
 *
 * Είναι η ερώτηση που η Φ1 έμαθε με κόστος ολόκληρης υλοποίησης: *δεν έλειπε μηχανή,
 * έλειπε **μία κλήση***. Η προβολή ξέρει να δέσει τη συλλογή, το ράφι ξέρει να τη
 * δημοσιεύσει — και αν ο γραφέας τα καλέσει με **λάθος σειρά**, το έγγραφο γράφεται με
 * `gallery: []` και **κανένα από τα δύο tests τους δεν κοκκινίζει**.
 *
 * 🔑 Και η δεύτερη ερώτηση: **αν η γραφή αποτύχει, μένουν bytes στον κόσμο για αγγελία
 * που δεν υπάρχει;** Ο φόβος ήταν γραμμένος στη Φ2 ως λόγος για την **αντίστροφη**
 * σειρά· η Φ3 τον απαντά με **αντιστάθμιση**, όχι με σειρά.
 */

import type { PublicShelfReport } from '../public-shelf.service';

const reconcilePublicShelf = jest.fn<Promise<PublicShelfReport>, [string, readonly unknown[]]>();

jest.mock('../public-shelf.service', () => ({
  reconcilePublicShelf: (...args: [string, readonly unknown[]]) => reconcilePublicShelf(...args),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { writeListingProjection } = require('../publish-public-listing') as
  typeof import('../publish-public-listing');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { LISTING_MATERIAL_KEYS } = require('@/lib/listings/listing-authorship') as
  typeof import('@/lib/listings/listing-authorship');

const LISTING = 'ownp_77aa21bc';
const AT = '2026-09-01T10:00:00.000Z';
const NO_PLACE = { candidates: [], ref: null };

const LISTED = {
  id: LISTING,
  name: 'Διαμέρισμα 80 τ.μ.',
  type: 'apartment',
  commercialStatus: 'for-sale',
  areas: { gross: 80 },
  commercial: { askingPrice: 150000 },
  publishedMedia: [{ privateStoragePath: 'owner_properties/u1/a.jpg' }],
} as const;

/** Καταγράφει **τη σειρά** των πράξεων — αυτό ακριβώς μετρά η σουίτα. */
let trace: string[] = [];
const written: Record<string, unknown>[] = [];

const ref = {
  set: jest.fn(async (doc: Record<string, unknown>) => {
    trace.push('set');
    written.push(doc);
  }),
  delete: jest.fn(async () => {
    trace.push('delete');
  }),
};

const adminDb = { collection: () => ({ doc: () => ref }) } as never;

function shelfReport(count: number): PublicShelfReport {
  const image = (index: number) => ({
    canonical: { key: `k${index}-2560`, url: `https://shelf/${index}-2560.webp`, width: 2560, height: 1700 },
    variants: [
      { key: `k${index}-640`, url: `https://shelf/${index}-640.webp`, width: 640, height: 425 },
      { key: `k${index}-2560`, url: `https://shelf/${index}-2560.webp`, width: 2560, height: 1700 },
    ],
  });
  return {
    outcome: 'reconciled',
    published: Array.from({ length: count }, (_, index) => image(index)),
    removed: 0,
    rejected: 0,
  };
}

beforeEach(() => {
  trace = [];
  written.length = 0;
  ref.set.mockClear();
  ref.delete.mockClear();
  reconcilePublicShelf.mockReset();
  reconcilePublicShelf.mockImplementation(async (_id, sources) => {
    trace.push(`reconcile(${sources.length})`);
    return shelfReport(sources.length);
  });
});

describe('Κ1 — Η ΣΕΙΡΑ: το ράφι ρωτιέται ΠΡΙΝ τη γραφή', () => {
  it('🔴 συμφιλίωση ΠΡΩΤΑ, `set` ΜΕΤΑ — αλλιώς τα URL δεν υπάρχουν ακόμη', async () => {
    await writeListingProjection(adminDb, LISTING, LISTED, NO_PLACE, AT);

    expect(trace).toEqual(['reconcile(1)', 'set']);
  });

  it('η επιλογή του κατόχου φτάνει ΑΥΤΟΥΣΙΑ στη συμφιλίωση', async () => {
    await writeListingProjection(adminDb, LISTING, LISTED, NO_PLACE, AT);

    expect(reconcilePublicShelf).toHaveBeenCalledWith(LISTING, LISTED.publishedMedia);
  });
});

describe('Κ2 — ΤΟ ΔΕΣΙΜΟ: το έγγραφο κουβαλά ό,τι ΕΙΔΕ το ράφι', () => {
  it('η συλλογή γράφεται με URL, διαστάσεις, παράγωγα και κλειδί i18n', async () => {
    const outcome = await writeListingProjection(adminDb, LISTING, LISTED, NO_PLACE, AT);

    expect(outcome).toBe('published');
    expect(written[0].gallery).toEqual([
      {
        url: 'https://shelf/0-2560.webp',
        width: 2560,
        height: 1700,
        // 🔑 **ΓΡΑΦΕΙΟΥ, και το fixture δεν το λέει πουθενά** (Α15): το `LISTED` δεν
        //    έχει `authorship`, και ο **κανόνας της απουσίας** (§8.33) το κάνει
        //    `'agency'`. Δηλαδή αυτή η γραμμή ελέγχει **δύο** πράγματα με ένα κλειδί:
        //    ότι το `altKey` παράγεται από την προέλευση, και ότι η **σιωπή** του
        //    εγγράφου εξακολουθεί να διαβάζεται ως γραφείο.
        altKey: LISTING_MATERIAL_KEYS.agency.galleryAlt,
        sources: [
          { url: 'https://shelf/0-640.webp', width: 640 },
          { url: 'https://shelf/0-2560.webp', width: 2560 },
        ],
      },
    ]);
  });

  it('🔑 ό,τι ΔΕΝ κάθεται στο ράφι ΔΕΝ διαφημίζεται — ούτε καν όταν ζητήθηκε', async () => {
    // Η φωτογραφία απορρίφθηκε στον καθαρισμό: ζητήθηκε **μία**, δημοσιεύτηκε **καμία**.
    reconcilePublicShelf.mockResolvedValueOnce({
      outcome: 'reconciled',
      published: [],
      removed: 0,
      rejected: 1,
    });

    await writeListingProjection(adminDb, LISTING, LISTED, NO_PLACE, AT);

    expect(written[0].gallery).toEqual([]);
  });

  it('αστοχία ραφιού ⇒ η αγγελία γράφεται ΧΩΡΙΣ εικόνες, ποτέ δεν χάνεται', async () => {
    reconcilePublicShelf.mockResolvedValueOnce({
      outcome: 'failed',
      published: [],
      removed: 0,
      rejected: 0,
    });

    const outcome = await writeListingProjection(adminDb, LISTING, LISTED, NO_PLACE, AT);

    expect(outcome).toBe('published');
    expect(written[0].gallery).toEqual([]);
  });
});

describe('Κ3 — Η ΑΠΟΣΥΡΣΗ ΚΑΙ Η ΑΝΤΙΣΤΑΘΜΙΣΗ', () => {
  it('μη δημοσιεύσιμο ⇒ `delete` + ράφι σε ΚΕΝΟ σύνολο', async () => {
    const withdrawn = { ...LISTED, commercialStatus: 'unavailable', offerKinds: [] };

    const outcome = await writeListingProjection(adminDb, LISTING, withdrawn, NO_PLACE, AT);

    expect(outcome).toBe('withdrawn');
    expect(trace).toEqual(['delete', 'reconcile(0)']);
  });

  it('🔴 η γραφή απέτυχε ΑΦΟΥ δημοσιεύτηκαν bytes ⇒ ΑΔΕΙΑΖΕΙ το ράφι', async () => {
    ref.set.mockImplementationOnce(async () => {
      trace.push('set');
      throw new Error('Firestore unavailable');
    });

    const outcome = await writeListingProjection(adminDb, LISTING, LISTED, NO_PLACE, AT);

    expect(outcome).toBe('failed');
    expect(trace).toEqual(['reconcile(1)', 'set', 'reconcile(0)']);
  });

  it('γραφή απέτυχε ΧΩΡΙΣ δημοσιευμένα bytes ⇒ καμία περιττή δεύτερη συμφιλίωση', async () => {
    reconcilePublicShelf.mockImplementationOnce(async () => {
      trace.push('reconcile(0)');
      return shelfReport(0);
    });
    ref.set.mockImplementationOnce(async () => {
      trace.push('set');
      throw new Error('Firestore unavailable');
    });

    await writeListingProjection(adminDb, LISTING, { ...LISTED, publishedMedia: [] }, NO_PLACE, AT);

    expect(trace).toEqual(['reconcile(0)', 'set']);
  });
});
