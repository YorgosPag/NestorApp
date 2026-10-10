/**
 * @jest-environment node
 *
 * @fileoverview 🏢 **Ο ΑΝΑΓΝΩΣΤΗΣ ΤΗΣ ΚΑΤΟΨΗΣ ΟΡΟΦΟΥ ΚΑΙ Ο ΕΝΑΣ ΤΟΠΟΣ ΤΩΝ ΠΗΓΩΝ** — ADR-907 §11.7.
 * @related services/listings/floor-plate.reader · services/listings/listing-media-sources
 *
 * 🔴 **ΤΙ ΦΥΛΑΕΙ**:
 * - **ΑΟ-1** — όροφος με υπογεγραμμένη δήλωση βγάζει **μία** πηγή `floorPlate`, με τη μονάδα που ρωτά ως `self`.
 * - **ΑΟ-2** — κάθε τι που λείπει ή δεν εξηγείται ⇒ **καμία** πηγή, με όνομα· ποτέ μισός όροφος.
 * - **ΑΟ-3** — τίποτα ιδιωτικό δεν φτάνει στην πηγή (όνομα, τιμή, ταυτότητα μη δημόσιου γείτονα).
 * - **ΑΟ-4** — γραφέας και συμφιλίωση παίρνουν τις **ίδιες** πηγές από τον **ίδιο** τόπο (το αποτύπωμα συμφωνεί).
 * - **ΑΟ-5** — *«σε ποιους ορόφους φαίνεται αυτή η μονάδα;»* απαντιέται από τα **περιγράμματα**, όχι από το `floorId` της (§11.8).
 * - **ΕΒ** — ο ΕΝΑΣ βρόχος με εμβέλεια (§11.8): στον **όροφο** ξαναψήνεται μόνο ό,τι διαφωνεί, δεύτερο πέρασμα δεν γράφει,
 *   γείτονας που άλλαξε ξυπνά **μόνο** τις αδελφές· στο **έργο** όλα, χωρίς κριτή· και ο βρόχος δεν ξέρει την πόρτα (χωρίς αναδρομή).
 *
 * ⚠️ Η κρίση επιμέλειας, η κανονικοποίηση και η κρίση της εικόνας **ΔΕΝ** γίνονται mock — τρέχουν οι αληθινές.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { COLLECTIONS } from '@/config/firestore-collections';
import { MEDIA_FINGERPRINT_FIELD } from '@/lib/listings/listing-media-fingerprint';
import { FakeFirestore } from '@/test-utils/fake-firestore/fake-firestore';
import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

jest.mock('server-only', () => ({}));
jest.mock('../public-listing-projection', () => ({
  isPubliclyListed: (property: { listed?: boolean }): boolean => property.listed === true,
}));

/** Τα αρχεία του ακινήτου — ο ρόλος του αναγνώστη του γραφείου, που έχει δικές του άγκυρες. */
const agencyMedia = [{ privateStoragePath: 'companies/c/photo.jpg', material: { kind: 'photo' } }];
jest.mock('../agency-media.reader', () => ({ createAgencyMediaResolver: () => async () => agencyMedia }));
jest.mock('../agency-media-publication', () => ({ agencyMediaDeclaration: () => ({}) }));
jest.mock('@/services/company/company-public-name.reader', () => ({
  createAgencyIdentityResolver: () => async () => null,
}));

/**
 * Ο γραφέας, **μόνο ως προς το αποτύπωμα** (ΕΒ): γράφει στη δημόσια αγγελία ό,τι θα έγραφε ο αληθινός για τις πηγές
 * που του έδωσε ο επιλυτής του περάσματος. Ο κριτής, ο αναγνώστης ορόφου και ο βρόχος τρέχουν **αληθινοί**.
 */
const republishListing = jest.fn(
  async (_db: unknown, propertyId: string, property: never, _agency: unknown, resolveMedia: MediaResolver): Promise<string> => {
    fake.seed(COLLECTIONS.PUBLIC_LISTINGS, propertyId, {
      [MEDIA_FINGERPRINT_FIELD]: mediaFingerprintOf(await resolveMedia(propertyId, property)),
    });
    return 'published';
  },
);
jest.mock('../publish-public-listing', () => ({
  republishListing: (...args: Parameters<typeof republishListing>) => republishListing(...args),
  reportProjectionFailure: () => 'failed',
}));

type MediaResolver = ReturnType<typeof import('../listing-media-sources').createListingMediaResolver>;

// eslint-disable-next-line @typescript-eslint/no-require-imports
const reader = require('../floor-plate.reader') as typeof import('../floor-plate.reader');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const scoped = require('../listing-scope-republish') as typeof import('../listing-scope-republish');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createListingMediaResolver } = require('../listing-media-sources') as typeof import('../listing-media-sources');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { mediaFingerprintOf } = require('../listing-media-fingerprint-stamp') as
  typeof import('../listing-media-fingerprint-stamp');

const COMPANY = 'comp_alpha';
const FLOOR = 'flr_ground';
const FILE = 'file_plate';
const BACKGROUND = 'rbg_plate';
const SELF = 'prop_self';
const NEIGHBOUR = 'prop_neighbour';
const HIDDEN = 'prop_hidden';

let fake: FakeFirestore;
const db = (): AdminFirestore => fake as unknown as AdminFirestore;

type Doc = Record<string, unknown>;

function seedFloor(overrides: Doc = {}): void {
  fake.seed(COLLECTIONS.FLOORS, FLOOR, {
    companyId: COMPANY,
    name: 'Ισόγειο',
    publishedFloorPlate: { fileId: FILE, declaredBy: 'uid_giorgio', declaredAt: '2026-10-10T09:00:00.000Z' },
    ...overrides,
  });
}

function seedImage(overrides: Doc = {}): void {
  fake.seed(COLLECTIONS.FILES, FILE, {
    companyId: COMPANY,
    entityType: 'floor',
    entityId: FLOOR,
    category: 'floorplans',
    classification: 'public',
    contentType: 'image/png',
    status: 'ready',
    lifecycleState: 'active',
    isDeleted: false,
    storagePath: `companies/${COMPANY}/floor.png`,
    createdAt: '2026-10-09T08:00:00.000Z',
    imageDimensions: { width: 1000, height: 800 },
    ...overrides,
  });
}

function seedBackground(overrides: Doc = {}, id: string = BACKGROUND): void {
  fake.seed(COLLECTIONS.FLOORPLAN_BACKGROUNDS, id, {
    companyId: COMPANY,
    floorId: FLOOR,
    fileId: FILE,
    naturalBounds: { width: 1000, height: 800 },
    transform: { translateX: 0, translateY: 0, scaleX: 1, scaleY: 1, rotation: 0 },
    ...overrides,
  });
}

/** Ορθογώνιο στον χώρο της εικόνας (pixels, Y προς τα πάνω). */
function rect(x0: number, y0: number, x1: number, y1: number): Doc {
  return { type: 'polygon', closed: true, vertices: [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }] };
}

function seedOutline(id: string, unitId: string | null, geometry: Doc, overrides: Doc = {}): void {
  fake.seed(COLLECTIONS.FLOORPLAN_OVERLAYS, id, {
    companyId: COMPANY,
    floorId: FLOOR,
    backgroundId: BACKGROUND,
    role: 'property',
    geometry,
    createdAt: `2026-10-09T10:00:0${id.slice(-1)}.000Z`,
    ...(unitId === null ? {} : { linked: { propertyId: unitId } }),
    ...overrides,
  });
}

function seedUnit(id: string, overrides: Doc = {}): void {
  fake.seed(COLLECTIONS.PROPERTIES, id, {
    companyId: COMPANY,
    floorId: FLOOR,
    name: `ΙΔΙΩΤΙΚΟ ΟΝΟΜΑ ${id}`,
    commercial: { askingPrice: 123456 },
    commercialStatus: 'for-sale',
    listed: false,
    ...overrides,
  });
}

/** Ο όροφος των δεδομένων δοκιμής, σε μικρογραφία: η μονάδα της αγγελίας, ένας δημόσιος γείτονας, ένας πωλημένος. */
function seedHealthyFloor(): void {
  seedFloor();
  seedImage();
  seedBackground();
  seedOutline('ovrl_1', SELF, rect(0, 400, 300, 800));
  seedOutline('ovrl_2', NEIGHBOUR, rect(300, 400, 600, 800));
  seedOutline('ovrl_3', HIDDEN, rect(600, 400, 1000, 800));
  seedUnit(SELF, { listed: true });
  seedUnit(NEIGHBOUR, { commercialStatus: 'reserved', listed: true });
  seedUnit(HIDDEN, { commercialStatus: 'sold' });
}

async function sourceFor(propertyId: string) {
  const evidence = await reader.readDeclaredFloorPlateEvidence(db(), COMPANY, FLOOR);
  return evidence.ok ? reader.floorPlateSourceOf(evidence.evidence, propertyId) : evidence;
}

beforeEach(() => {
  fake = new FakeFirestore();
});

describe('ΑΟ-1 — όροφος με υπογεγραμμένη δήλωση βγάζει ΜΙΑ πηγή', () => {
  it('η μονάδα που ρωτά είναι `self`· οι γείτονες έχουν κατάσταση, και σύνδεσμο ΜΟΝΟ ο δημόσιος', async () => {
    seedHealthyFloor();
    const reading = await sourceFor(SELF);

    expect(reading).toMatchObject({ ok: true });
    if (!reading.ok) return;
    expect(reading.source.privateStoragePath).toBe(`companies/${COMPANY}/floor.png`);
    expect(reading.source.material).toEqual({
      kind: 'floorPlate',
      at: '2026-10-09T08:00:00.000Z',
      provenance: 'declared',
      units: [
        { outline: [0, 0.5, 0.3, 0.5, 0.3, 0, 0, 0], state: 'self' },
        { outline: [0.3, 0.5, 0.6, 0.5, 0.6, 0, 0.3, 0], state: 'reserved', listingId: NEIGHBOUR },
        { outline: [0.6, 0.5, 1, 0.5, 1, 0, 0.6, 0], state: 'unavailable' },
      ],
    });
  });

  it('η ίδια εικόνα, άλλη `self`, όταν ρωτά η αδελφή μονάδα', async () => {
    seedHealthyFloor();
    const reading = await sourceFor(NEIGHBOUR);

    expect(reading.ok).toBe(true);
    if (!reading.ok || reading.source.material.kind !== 'floorPlate') return;
    expect(reading.source.material.units.map((unit) => unit.state)).toEqual(['available', 'self', 'unavailable']);
    expect(reading.source.material.units[0].listingId).toBe(SELF);
  });

  it('περίγραμμα ΑΛΛΟΥ υποβάθρου του ίδιου ορόφου παραλείπεται — δεν αρνείται και δεν βγαίνει', async () => {
    seedHealthyFloor();
    seedOutline('ovrl_9', null, rect(0, 0, 50, 50), { backgroundId: 'file_other_drawing' });

    const reading = await sourceFor(SELF);
    expect(reading.ok && reading.source.material.kind === 'floorPlate' && reading.source.material.units).toHaveLength(3);
  });

  it('N αδελφές μονάδες στο ίδιο πέρασμα ⇒ ο όροφος διαβάζεται ΜΙΑ φορά', async () => {
    seedHealthyFloor();
    const collection = jest.spyOn(fake, 'collection');
    const resolve = reader.createFloorPlateResolver(db());

    const owner = { companyId: COMPANY, floorId: FLOOR };
    const [first, second] = await Promise.all([resolve(SELF, owner), resolve(NEIGHBOUR, owner)]);

    expect(first).toHaveLength(1);
    expect(second).toHaveLength(1);
    expect(collection.mock.calls.filter(([name]) => name === COLLECTIONS.FLOORS)).toHaveLength(1);
  });
});

describe('ΑΟ-1β — ό,τι ΔΕΝ ανήκει σε αυτόν τον όροφο δεν τον αγγίζει (Βήμα 9, ADR-907 §11.11)', () => {
  const unitsOf = async (propertyId: string = SELF) => {
    const reading = await sourceFor(propertyId);
    if (!reading.ok || reading.source.material.kind !== 'floorPlate') throw new Error(`refused: ${JSON.stringify(reading)}`);
    return reading.source.material.units;
  };

  it('🔐 περίγραμμα ΑΛΛΟΥ μισθωτή ή ΑΛΛΟΥ ορόφου πάνω στο ίδιο υπόβαθρο δεν διαβάζεται', async () => {
    seedHealthyFloor();
    seedOutline('ovrl_7', null, rect(0, 0, 50, 50), { companyId: 'comp_other' });
    seedOutline('ovrl_8', null, rect(0, 0, 60, 60), { floorId: 'flr_other' });

    await expect(unitsOf()).resolves.toHaveLength(3);
  });

  it('🔐 υπόβαθρο ΑΛΛΟΥ μισθωτή ή ΑΛΛΟΥ ορόφου για το ίδιο αρχείο δεν μετρά ως «δεύτερο υπόβαθρο»', async () => {
    seedHealthyFloor();
    seedBackground({ companyId: 'comp_other' }, 'rbg_foreign');
    seedBackground({ floorId: 'flr_other' }, 'rbg_elsewhere');

    await expect(unitsOf()).resolves.toHaveLength(3);
  });

  it('υπόβαθρο ΧΩΡΙΣ πεδίο μετασχηματισμού είναι ταυτοτικό — δεν αρνείται', async () => {
    seedHealthyFloor();
    seedBackground({ transform: undefined });

    await expect(unitsOf()).resolves.toHaveLength(3);
  });

  it.each([
    ['parking', 'parkingId', COLLECTIONS.PARKING_SPACES],
    ['storage', 'storageId', COLLECTIONS.STORAGE],
  ] as const)('το «%s» δένει με το ΔΙΚΟ του κλειδί, διαβάζεται από τη ΔΙΚΗ του συλλογή, και δεν γίνεται ποτέ σύνδεσμος', async (role, key, collection) => {
    seedHealthyFloor();
    seedOutline('ovrl_4', null, rect(0, 0, 300, 400), { role, linked: { [key]: 'space_1' } });
    // `listed: true`: ακόμη κι αν ο κριτής έλεγε «δημόσιο», χώρος στάθμευσης / αποθήκη δεν έχει αγγελία να δείξει.
    fake.seed(collection, 'space_1', { companyId: COMPANY, commercialStatus: 'reserved', listed: true });

    const units = await unitsOf();
    expect(units).toHaveLength(4);
    expect(units[3]).toEqual({ outline: [0, 1, 0.3, 1, 0.3, 0.5, 0, 0.5], state: 'reserved' });
  });

  it('ίδια στιγμή δημιουργίας ⇒ η σειρά είναι του αναγνωριστικού, όχι της τύχης της ανάγνωσης', async () => {
    seedFloor();
    seedImage();
    seedBackground();
    const at = { createdAt: '2026-10-09T10:00:00.000Z' };
    seedOutline('ovrl_c', HIDDEN, rect(600, 400, 1000, 800), at);
    seedOutline('ovrl_a', SELF, rect(0, 400, 300, 800), at);
    seedOutline('ovrl_b', NEIGHBOUR, rect(300, 400, 600, 800), at);
    seedUnit(SELF, { listed: true });
    seedUnit(NEIGHBOUR, { commercialStatus: 'reserved', listed: true });
    seedUnit(HIDDEN, { commercialStatus: 'sold' });

    expect((await unitsOf()).map((unit) => unit.state)).toEqual(['self', 'reserved', 'unavailable']);
  });

  /** Όροφος με `count` μονάδες σε πλέγμα 13 στηλών — καμία δεν ακουμπά άλλη, όλες μέσα στα 1000 × 800. */
  function seedCrowdedFloor(count: number): void {
    seedFloor();
    seedImage();
    seedBackground();
    for (let index = 0; index < count; index += 1) {
      const x = (index % 13) * 70;
      const y = Math.floor(index / 13) * 100;
      const unitId = index === 0 ? SELF : `prop_n${index}`;
      seedOutline(`ovrl_n${String(index).padStart(2, '0')}`, unitId, rect(x, y, x + 60, y + 90), { createdAt: '2026-10-09T10:00:00.000Z' });
      seedUnit(unitId);
    }
  }

  it('ταβάνι μονάδων: 64 βγαίνουν, η 65η αρνείται ΟΛΟΚΛΗΡΟ τον όροφο με όνομα', async () => {
    seedCrowdedFloor(64);
    await expect(unitsOf()).resolves.toHaveLength(64);

    fake = new FakeFirestore();
    seedCrowdedFloor(65);
    expect(await sourceFor(SELF)).toEqual({ ok: false, why: 'too-many-units', overlayId: null });
  });

  it('«η πρώτη δεμένη μονάδα» προσπερνά ό,τι δεν δένει (αποτύπωμα κτιρίου πρώτο στη σειρά)', async () => {
    seedHealthyFloor();
    seedOutline('ovrl_0', null, rect(0, 0, 1000, 800), { role: 'footprint' });

    const evidence = await reader.readDeclaredFloorPlateEvidence(db(), COMPANY, FLOOR);
    expect(evidence.ok && evidence.evidence.outlines[0].unitId).toBeNull();
    expect(evidence.ok && reader.firstLinkedUnitOf(evidence.evidence)).toBe(SELF);
  });

  it('η μνήμη του επιλυτή είναι ΑΝΑ ΟΡΟΦΟ: όροφος χωρίς δήλωση δεν «απαντά» για τον διπλανό του', async () => {
    seedHealthyFloor();
    fake.seed(COLLECTIONS.FLOORS, 'flr_bare', { companyId: COMPANY, name: 'Α΄' });
    const resolve = reader.createFloorPlateResolver(db());

    await expect(resolve('prop_upstairs', { companyId: COMPANY, floorId: 'flr_bare' })).resolves.toEqual([]);
    await expect(resolve(SELF, { companyId: COMPANY, floorId: FLOOR })).resolves.toHaveLength(1);
  });
});

describe('ΑΟ-2 — ό,τι λείπει ή δεν εξηγείται ⇒ ΚΑΜΙΑ πηγή, με όνομα', () => {
  /** Κάθε συνιστώσα του μετασχηματισμού, ΜΟΝΗ της: ο ταυτοτικός είναι σύζευξη πέντε όρων, όχι «η κλίμακα είναι 1». */
  const TRANSFORMED: readonly [string, Doc][] = [
    ['μετατόπιση X', { translateX: 5 }],
    ['μετατόπιση Y', { translateY: 5 }],
    ['κλίμακα X', { scaleX: 2 }],
    ['κλίμακα Y', { scaleY: 2 }],
    ['στροφή', { rotation: 90 }],
  ];
  const refusals: readonly [string, () => void, string][] = [
    ['χωρίς δήλωση', () => seedFloor({ publishedFloorPlate: null }), 'not-declared'],
    ['δήλωση χωρίς υπογράφοντα', () => seedFloor({ publishedFloorPlate: { fileId: FILE, declaredAt: '2026-10-10T09:00:00.000Z' } }), 'not-declared'],
    ['όροφος άλλου χώρου', () => seedFloor({ companyId: 'comp_other' }), 'floor-missing'],
    ['αρχείο άλλου χώρου', () => seedImage({ companyId: 'comp_other' }), 'image-missing'],
    ['αρχείο άλλου ορόφου', () => seedImage({ entityId: 'flr_other' }), 'image-missing'],
    ['εικόνα που δεν είναι `public`', () => seedImage({ classification: 'internal' }), 'image-not-public'],
    ['εικόνα χωρίς διαβάθμιση', () => seedImage({ classification: undefined }), 'image-not-public'],
    ['αρχείο στον κάδο', () => seedImage({ isDeleted: true }), 'image-not-deliverable'],
    ['σχέδιο DXF αντί για εικόνα', () => seedImage({ contentType: 'application/dxf' }), 'image-not-deliverable'],
    ['bytes που ο διακομιστής δεν μέτρησε', () => seedImage({ imageDimensions: undefined }), 'image-unmeasured'],
    ['υπόβαθρο με άλλα pixels από τα bytes', () => seedBackground({ naturalBounds: { width: 1000, height: 801 } }), 'frame-mismatch'],
    ['βαθμονομημένο υπόβαθρο', () => seedBackground({ transform: { translateX: 0, translateY: 0, scaleX: 2, scaleY: 2, rotation: 0 } }), 'background-transformed'],
    ['κανένα υπόβαθρο για το αρχείο', () => seedBackground({ fileId: 'file_other' }), 'background-missing'],
    ['άδετο περίγραμμα', () => seedOutline('ovrl_4', null, rect(0, 0, 100, 100)), 'unlinked-outline'],
    ['μονάδα άλλου χώρου', () => seedUnit(HIDDEN, { companyId: 'comp_other' }), 'foreign-unit'],
    ['περίγραμμα έξω από την εικόνα', () => seedOutline('ovrl_3', HIDDEN, rect(600, 400, 1200, 800)), 'outside-frame'],
    // ── Βήμα 9 (μεταλλάξεις, ADR-907 §11.11): ό,τι επέζησε στο πρώτο πέρασμα απέκτησε γραμμή.
    ['δήλωση χωρίς εικόνα', () => seedFloor({ publishedFloorPlate: { declaredBy: 'uid_giorgio', declaredAt: '2026-10-10T09:00:00.000Z' } }), 'not-declared'],
    ['δήλωση χωρίς ημερομηνία', () => seedFloor({ publishedFloorPlate: { fileId: FILE, declaredBy: 'uid_giorgio' } }), 'not-declared'],
    ['δήλωση με κενό υπογράφοντα', () => seedFloor({ publishedFloorPlate: { fileId: FILE, declaredBy: '  ', declaredAt: '2026-10-10T09:00:00.000Z' } }), 'not-declared'],
    ['αρχείο άλλης κατηγορίας', () => seedImage({ category: 'photos' }), 'image-missing'],
    ['αρχείο χωρίς ημερομηνία', () => seedImage({ createdAt: undefined }), 'image-undated'],
    ['υπόβαθρο με άλλο ΠΛΑΤΟΣ από τα bytes', () => seedBackground({ naturalBounds: { width: 1001, height: 800 } }), 'frame-mismatch'],
    ['δύο υπόβαθρα για το ίδιο αρχείο', () => seedBackground({}, 'rbg_second'), 'background-missing'],
    ['μετασχηματισμός που δεν είναι αντικείμενο', () => seedBackground({ transform: 'rotated' }), 'background-transformed'],
    ...TRANSFORMED.map(([label, change]): [string, () => void, string] => [
      `υπόβαθρο με ${label}`,
      () => seedBackground({ transform: { translateX: 0, translateY: 0, scaleX: 1, scaleY: 1, rotation: 0, ...change } }),
      'background-transformed',
    ]),
    ['σχήμα που δεν είναι πολύγωνο', () => seedOutline('ovrl_3', HIDDEN, { ...rect(600, 400, 1000, 800), type: 'rectangle' }), 'not-a-polygon'],
    ['ανοιχτή πολυγραμμή', () => seedOutline('ovrl_3', HIDDEN, { ...rect(600, 400, 1000, 800), closed: false }), 'not-a-polygon'],
    ['δεσμός με κενή ταυτότητα', () => seedOutline('ovrl_4', null, rect(0, 0, 100, 100), { linked: { propertyId: '' } }), 'unlinked-outline'],
  ];

  it.each(refusals)('%s', async (_label, damage, why) => {
    seedHealthyFloor();
    damage();

    const reading = await sourceFor(SELF);
    expect(reading).toMatchObject({ ok: false, why });
    await expect(reader.createFloorPlateResolver(db())(SELF, { companyId: COMPANY, floorId: FLOOR })).resolves.toEqual([]);
  });

  it('η άρνηση περιγράμματος ονομάζει ΠΟΙΟ περίγραμμα φταίει', async () => {
    seedHealthyFloor();
    seedOutline('ovrl_4', null, rect(0, 0, 100, 100));
    expect(await sourceFor(SELF)).toEqual({ ok: false, why: 'unlinked-outline', overlayId: 'ovrl_4' });
  });

  it('η αγγελία μονάδας που ΔΕΝ είναι πάνω στην κάτοψη δεν παίρνει κάτοψη ορόφου', async () => {
    seedHealthyFloor();
    expect(await sourceFor('prop_elsewhere')).toMatchObject({ ok: false, why: 'self-missing' });
  });

  it('ακίνητο χωρίς όροφο ή χωρίς χώρο ⇒ κενό ΧΩΡΙΣ καμία ανάγνωση', async () => {
    // Μάρτυρας είναι ότι η βάση ΔΕΝ ρωτήθηκε: ένα σκέτο `[]` θα το έδινε και το δίχτυ του `catch`.
    const collection = jest.fn(() => { throw new Error('δεν έπρεπε να διαβάσει'); });
    const resolve = reader.createFloorPlateResolver({ collection } as unknown as AdminFirestore);
    await expect(resolve(SELF, { companyId: COMPANY })).resolves.toEqual([]);
    await expect(resolve(SELF, { companyId: null, floorId: FLOOR })).resolves.toEqual([]);
    await expect(resolve(SELF, { companyId: COMPANY, floorId: '' })).resolves.toEqual([]);
    await expect(resolve(SELF, { companyId: '', floorId: FLOOR })).resolves.toEqual([]);
    expect(collection).not.toHaveBeenCalled();
  });

  it('βλάβη ανάγνωσης δεν πετά — η αγγελία δημοσιεύεται χωρίς κάτοψη ορόφου', async () => {
    const broken = { collection: () => { throw new Error('UNAVAILABLE'); } } as unknown as AdminFirestore;
    await expect(reader.createFloorPlateResolver(broken)(SELF, { companyId: COMPANY, floorId: FLOOR })).resolves.toEqual([]);
  });
});

describe('ΑΟ-3 — τίποτα ιδιωτικό δεν φτάνει στην πηγή', () => {
  it('ούτε όνομα, ούτε τιμή, ούτε ταυτότητα μη δημόσιου γείτονα ή περιγράμματος', async () => {
    seedHealthyFloor();
    const reading = await sourceFor(SELF);
    const wire = JSON.stringify(reading);

    expect(reading.ok).toBe(true);
    for (const secret of ['ΙΔΙΩΤΙΚΟ', '123456', HIDDEN, 'ovrl_', 'uid_giorgio', 'sold']) {
      expect(wire).not.toContain(secret);
    }
  });
});

describe('ΑΟ-4 — γραφέας και συμφιλίωση ρωτούν τον ΙΔΙΟ τόπο', () => {
  const property = { id: SELF, companyId: COMPANY, floorId: FLOOR } as never;

  it('αρχεία του ακινήτου ΠΡΩΤΑ, κάτοψη ορόφου ΤΕΛΕΥΤΑΙΑ', async () => {
    seedHealthyFloor();
    const sources = await createListingMediaResolver(db())(SELF, property);
    expect(sources.map((source) => source.material.kind)).toEqual(['photo', 'floorPlate']);
  });

  it('δύο περάσματα δίνουν το ΙΔΙΟ αποτύπωμα· γείτονας που πουλήθηκε το αλλάζει', async () => {
    seedHealthyFloor();
    const written = mediaFingerprintOf(await createListingMediaResolver(db())(SELF, property));
    const reconciled = mediaFingerprintOf(await createListingMediaResolver(db())(SELF, property));
    expect(reconciled).toBe(written);

    seedUnit(NEIGHBOUR, { commercialStatus: 'sold', listed: false });
    const after = mediaFingerprintOf(await createListingMediaResolver(db())(SELF, property));
    expect(after).not.toBe(written);
  });

  it('χωρίς δήλωση, οι πηγές είναι ακριβώς τα αρχεία του ακινήτου — καμία αγγελία δεν αλλάζει', async () => {
    seedHealthyFloor();
    seedFloor({ publishedFloorPlate: null });
    await expect(createListingMediaResolver(db())(SELF, property)).resolves.toEqual(agencyMedia);
  });
});

describe('ΑΟ-5 — σε ποιους ορόφους ΦΑΙΝΕΤΑΙ μια μονάδα, και έχουν δήλωση;', () => {
  it('οι όροφοι βγαίνουν από τα ΠΕΡΙΓΡΑΜΜΑΤΑ — και μονάδα με άλλο `floorId` φαίνεται εκεί που σχεδιάστηκε', async () => {
    seedHealthyFloor();
    seedUnit(NEIGHBOUR, { floorId: 'flr_ΑΛΛΟΣ', listed: true });
    seedOutline('ovrl_7', NEIGHBOUR, rect(0, 0, 100, 100), { floorId: 'flr_first' });

    const floors = await reader.readFloorsShowingUnit(db(), COMPANY, { link: 'propertyId', unitId: NEIGHBOUR });

    expect([...floors].sort()).toEqual(['flr_first', FLOOR].sort());
  });

  it('το κλειδί του δεσμού μετρά: θέση στάθμευσης με ίδιο id δεν είναι το ακίνητο', async () => {
    seedHealthyFloor();
    seedOutline('ovrl_8', null, rect(0, 0, 100, 100), { role: 'parking', linked: { parkingId: 'park_1' }, floorId: 'flr_basement' });

    await expect(reader.readFloorsShowingUnit(db(), COMPANY, { link: 'parkingId', unitId: 'park_1' })).resolves.toEqual(['flr_basement']);
    await expect(reader.readFloorsShowingUnit(db(), COMPANY, { link: 'propertyId', unitId: 'park_1' })).resolves.toEqual([]);
  });

  it('🔒 ξένο περίγραμμα που δείχνει σε δική μας μονάδα δεν ξυπνά ξένο όροφο', async () => {
    seedHealthyFloor();
    seedOutline('ovrl_9', SELF, rect(0, 0, 100, 100), { companyId: 'comp_other', floorId: 'flr_ΞΕΝΟΣ' });

    await expect(reader.readFloorsShowingUnit(db(), COMPANY, { link: 'propertyId', unitId: SELF })).resolves.toEqual([FLOOR]);
  });

  it('δύο περιγράμματα της μονάδας στον ΙΔΙΟ όροφο ⇒ ο όροφος μία φορά· περίγραμμα χωρίς όροφο δεν δίνει «όροφο»', async () => {
    seedHealthyFloor();
    seedOutline('ovrl_7', SELF, rect(0, 0, 100, 100));
    seedOutline('ovrl_8', SELF, rect(0, 0, 100, 100), { floorId: undefined });
    seedOutline('ovrl_9', SELF, rect(0, 0, 100, 100), { floorId: '' });

    await expect(reader.readFloorsShowingUnit(db(), COMPANY, { link: 'propertyId', unitId: SELF })).resolves.toEqual([FLOOR]);
  });

  it('δήλωση: υπογεγραμμένος όροφος ναι· χωρίς δήλωση, ανύπαρκτος ή ξένος όχι', async () => {
    seedHealthyFloor();
    await expect(reader.hasFloorPlateDeclaration(db(), COMPANY, FLOOR)).resolves.toBe(true);
    await expect(reader.hasFloorPlateDeclaration(db(), 'comp_other', FLOOR)).resolves.toBe(false);
    await expect(reader.hasFloorPlateDeclaration(db(), COMPANY, 'flr_ΑΝΥΠΑΡΚΤΟΣ')).resolves.toBe(false);

    seedFloor({ publishedFloorPlate: null });
    await expect(reader.hasFloorPlateDeclaration(db(), COMPANY, FLOOR)).resolves.toBe(false);
  });
});

describe('ΕΒ — ο ΕΝΑΣ βρόχος επαναπροβολής, με εμβέλεια', () => {
  const floorScope = { kind: 'floor', floorId: FLOOR, companyId: COMPANY } as const;
  const republished = (): string[] => republishListing.mock.calls.map((call) => call[1]).sort();

  beforeEach(() => republishListing.mockClear());

  it('ΕΒ-1 όροφος: ξαναπροβάλλονται ΜΟΝΟ οι δημοσιευμένες, και δεύτερο πέρασμα δεν γράφει τίποτα', async () => {
    seedHealthyFloor();
    // Δημοσιευμένες μονάδες που ΔΕΝ είναι αυτού του ορόφου: άλλος όροφος του ίδιου χώρου, ίδιος όροφος άλλου χώρου.
    seedUnit('prop_upstairs', { listed: true, floorId: 'flr_other' });
    seedUnit('prop_foreign', { listed: true, companyId: 'comp_other' });

    const first = await scoped.republishListingsInScope(db(), floorScope);
    expect(first.map((report) => report.propertyId).sort()).toEqual([NEIGHBOUR, SELF].sort());
    expect(republished()).not.toContain(HIDDEN);

    republishListing.mockClear();
    await expect(scoped.republishListingsInScope(db(), floorScope)).resolves.toEqual([]);
    expect(republishListing).not.toHaveBeenCalled();
  });

  it('ΕΒ-2 όροφος: γείτονας που πουλήθηκε ξυπνά ΤΗΝ ΑΔΕΛΦΗ — όχι τον εαυτό του, όχι όλο τον όροφο', async () => {
    seedHealthyFloor();
    seedOutline('ovrl_4', 'prop_third', rect(0, 0, 300, 400));
    seedUnit('prop_third', { listed: true });
    await scoped.republishListingsInScope(db(), floorScope);
    republishListing.mockClear();

    // Η κατάσταση του γείτονα αλλάζει — στη δική του κάτοψη είναι `self`, άρα το ΔΙΚΟ του αποτύπωμα δεν αλλάζει.
    seedUnit(NEIGHBOUR, { commercialStatus: 'sold', listed: true });
    await scoped.republishListingsInScope(db(), floorScope);

    expect(republished()).toEqual(['prop_third', SELF].sort());
  });

  it('ΕΒ-2β όροφος: γείτονας που ΒΓΗΚΕ από την αγορά — η αδελφή χάνει τον σύνδεσμο· ο ίδιος δεν ξαναπροβάλλεται εδώ', async () => {
    seedHealthyFloor();
    await scoped.republishListingsInScope(db(), floorScope);
    republishListing.mockClear();

    seedUnit(NEIGHBOUR, { commercialStatus: 'reserved', listed: false });
    await scoped.republishListingsInScope(db(), floorScope);

    expect(republished()).toEqual([SELF]);
  });

  it('ΕΒ-2γ όροφος: ένας επιλυτής για όλο το πέρασμα — ο ίδιος σε κάθε αδελφή', async () => {
    seedHealthyFloor();
    await scoped.republishListingsInScope(db(), floorScope);

    const [first, second] = republishListing.mock.calls;
    expect(second[3]).toBe(first[3]);
    expect(second[4]).toBe(first[4]);
    // Ο γραφέας παίρνει τη μονάδα ΜΕ την ταυτότητά της — το έγγραφο της βάσης δεν την κουβαλά.
    expect(first[2]).toMatchObject({ id: first[1] });
    expect(second[2]).toMatchObject({ id: second[1] });
  });

  it('ΕΒ-2δ όροφος: βλάβη στην ανάγνωση της αγγελίας ⇒ «οφείλει», ποτέ «συμφωνεί»', async () => {
    seedHealthyFloor();
    await scoped.republishListingsInScope(db(), floorScope);
    republishListing.mockClear();

    const blind = {
      getAll: fake.getAll.bind(fake),
      collection: (name: string) => {
        if (name === COLLECTIONS.PUBLIC_LISTINGS) throw new Error('UNAVAILABLE');
        return fake.collection(name);
      },
    } as unknown as AdminFirestore;
    republishListing.mockImplementationOnce(async () => 'failed').mockImplementationOnce(async () => 'failed');

    const reports = await scoped.republishListingsInScope(blind, floorScope);

    expect(reports.map((report) => report.outcome)).toEqual(['failed', 'failed']);
  });

  it('ΕΒ-3 έργο: ΟΛΑ τα ακίνητα του έργου, και τα μη δημοσιευμένα, χωρίς να ρωτηθεί ο κριτής', async () => {
    seedHealthyFloor();
    for (const id of [SELF, NEIGHBOUR]) seedUnit(id, { listed: true, projectId: 'proj_1' });
    seedUnit(HIDDEN, { commercialStatus: 'sold', projectId: 'proj_1' });
    seedUnit('prop_ΑΛΛΟΥ_ΕΡΓΟΥ', { listed: true, projectId: 'proj_2' });
    await scoped.republishListingsInScope(db(), floorScope);
    republishListing.mockClear();

    // Όλα συμφωνούν ήδη με το υλικό τους — το έργο ξαναπροβάλλει παρ' όλα αυτά: άλλαξε ο τόπος.
    const tally = await scoped.republishListingsForProject(db(), 'proj_1');

    expect(tally).toEqual({ published: 3, withdrawn: 0, failed: 0 });
    expect(republished()).toEqual([HIDDEN, NEIGHBOUR, SELF].sort());
  });

  it('ΕΒ-4 ΧΩΡΙΣ ΑΝΑΔΡΟΜΗ: ο βρόχος δεν εισάγει την πόρτα «άλλαξε μονάδα» — καλεί μόνο τον γραφέα', () => {
    const source = readFileSync(join(__dirname, '..', 'listing-scope-republish.ts'), 'utf8');
    const imports = source.split('\n').filter((line) => /\bfrom '/.test(line)).join('\n');

    expect(imports).toContain("from './publish-public-listing'");
    expect(imports).not.toContain('listing-media-refresh');
    expect(source).toMatch(/await republishListing\(/);
  });
});
