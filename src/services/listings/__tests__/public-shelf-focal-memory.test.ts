/**
 * @jest-environment node
 *
 * @fileoverview 🎯 **ΤΟ ΡΑΦΙ ΘΥΜΑΤΑΙ ΤΟ ΣΗΜΕΙΟ ΕΣΤΙΑΣΗΣ** — υπολογισμός, μνήμη, αυτοθεραπεία (ADR-880).
 * @related public-shelf.service · public-shelf-plan (`META_FOCAL_POINT`) · public-shelf-focal-point
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΧΡΕΙΑΖΕΤΑΙ ΜΝΗΜΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η γρήγορη διαδρομή (Α2.3) **δεν αποκωδικοποιεί**: μια αποθήκευση τίτλου δεν ξανακατεβάζει καμία
 * φωτογραφία. Χωρίς μνήμη, το σημείο εστίασης θα υπήρχε μόνο την **πρώτη** φορά και θα χανόταν στη
 * δεύτερη αποθήκευση — πράσινο στο πρώτο test, λάθος στην παραγωγή.
 */

import sharp from 'sharp';

import type { PublicShelfSource } from '@/services/upload/utils/storage-path-public-shelf';
import { LISTING_SHELF } from '@/services/upload/utils/public-shelf-kinds';
import { FakeShelfBucket } from '@/services/upload/__fixtures__/fake-shelf-bucket';

import { META_FOCAL_POINT } from '../public-shelf-plan';

const shelf = new FakeShelfBucket();
const privateBucket = new FakeShelfBucket();

jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminStorage: () => ({ bucket: () => shelf }),
  getAdminBucket: () => privateBucket,
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { reconcilePublicShelf } = require('../public-shelf.service') as
  typeof import('../public-shelf.service');

const LISTING = 'ownp_77aa21bc';
const PATH = 'owner_properties/u1/ownp_77aa21bc/portrait.jpg';

/** Κάθετη φωτογραφία κινητού με το θέμα ψηλά δεξιά — ακριβώς η περίπτωση που ακρωτηριάζεται. */
async function givenPortrait(material: PublicShelfSource['material'] = { kind: 'photo' }): Promise<PublicShelfSource> {
  const blob = await sharp({
    create: { width: 80, height: 80, channels: 3, background: { r: 230, g: 160, b: 130 } },
  }).png().toBuffer();
  const bytes = await sharp({
    create: { width: 600, height: 900, channels: 3, background: { r: 128, g: 128, b: 128 } },
  })
    .composite([{ input: blob, left: 380, top: 140 }])
    .jpeg()
    .toBuffer();
  privateBucket.put(PATH, bytes);
  return { privateStoragePath: PATH, material };
}

function focalMeta(): (string | undefined)[] {
  return shelf.keys().map((key) => shelf.objects.get(key)?.custom?.[META_FOCAL_POINT]);
}

beforeEach(() => {
  shelf.reset();
  privateBucket.reset();
});

describe('Κ1 — υπολογίζεται στη ΓΕΝΝΗΣΗ των δημόσιων bytes', () => {
  it('φωτογραφία: σημείο κοντά στο θέμα, γραμμένο σε ΚΑΘΕ παράγωγο', async () => {
    const report = await reconcilePublicShelf(LISTING_SHELF, LISTING, [await givenPortrait()]);
    const point = report.published[0]?.focalPoint;

    expect(point?.x).toBeCloseTo(0.7, 1);
    expect(point?.y).toBeCloseTo(0.2, 1);
    expect(focalMeta().every((value) => value === `${point?.x},${point?.y}`)).toBe(true);
  });

  it('κάτοψη: δεν ρωτιέται καθόλου — κανένα μεταδεδομένο, κανένα σημείο', async () => {
    const floorplan = await givenPortrait({ kind: 'floorplan', at: '2026-09-24T00:00:00.000Z' });
    const report = await reconcilePublicShelf(LISTING_SHELF, LISTING, [floorplan]);

    expect(report.published[0]?.focalPoint).toBeNull();
    expect(focalMeta().every((value) => value === undefined)).toBe(true);
  });

  it('η ΔΗΛΩΣΗ του ανθρώπου ταξιδεύει αυτούσια, χωρίς να αλλάζει το αυτόματο', async () => {
    const source = { ...(await givenPortrait()), focalPoint: { x: 0.1, y: 0.9 } };
    const report = await reconcilePublicShelf(LISTING_SHELF, LISTING, [source]);

    expect(report.published[0]?.declaredFocalPoint).toEqual({ x: 0.1, y: 0.9 });
    expect(report.published[0]?.focalPoint?.x).toBeCloseTo(0.7, 1);
  });
});

describe('Κ2 — η γρήγορη διαδρομή το ΘΥΜΑΤΑΙ, χωρίς αποκωδικοποίηση', () => {
  it('δεύτερη συμφιλίωση: ίδιο σημείο, μηδέν κατεβάσματα, μηδέν εγγραφές', async () => {
    const source = await givenPortrait();
    const first = await reconcilePublicShelf(LISTING_SHELF, LISTING, [source]);
    const downloads = privateBucket.downloadCalls + shelf.downloadCalls;

    const second = await reconcilePublicShelf(LISTING_SHELF, LISTING, [source]);

    expect(second.published[0]?.focalPoint).toEqual(first.published[0]?.focalPoint);
    expect(privateBucket.downloadCalls + shelf.downloadCalls).toBe(downloads);
    expect(shelf.metadataCalls).toBe(0);
  });
});

describe('🩹 Κ3 — αυτοθεραπεία: αντικείμενα γραμμένα ΠΡΙΝ το ADR-880', () => {
  async function publishedWithoutMemory(): Promise<PublicShelfSource> {
    const source = await givenPortrait();
    await reconcilePublicShelf(LISTING_SHELF, LISTING, [source]);
    for (const key of shelf.keys()) {
      const found = shelf.objects.get(key)!;
      const { [META_FOCAL_POINT]: _dropped, ...custom } = found.custom ?? {};
      shelf.objects.set(key, { ...found, custom });
    }
    shelf.downloadCalls = 0;
    privateBucket.downloadCalls = 0;
    return source;
  }

  it('υπολογίζει από το ΜΙΚΡΟΤΕΡΟ δημόσιο παράγωγο, όχι από το ιδιωτικό πρωτότυπο', async () => {
    const source = await publishedWithoutMemory();
    const report = await reconcilePublicShelf(LISTING_SHELF, LISTING, [source]);

    expect(report.published[0]?.focalPoint?.x).toBeCloseTo(0.7, 1);
    expect(privateBucket.downloadCalls).toBe(0);
    expect(shelf.downloadCalls).toBe(1);
    expect(focalMeta().every((value) => typeof value === 'string')).toBe(true);
  });

  it('και μετά δεν ξαναπληρώνει: η τρίτη συμφιλίωση δεν κατεβάζει τίποτα', async () => {
    const source = await publishedWithoutMemory();
    await reconcilePublicShelf(LISTING_SHELF, LISTING, [source]);
    const downloads = shelf.downloadCalls;

    await reconcilePublicShelf(LISTING_SHELF, LISTING, [source]);
    expect(shelf.downloadCalls).toBe(downloads);
  });
});
