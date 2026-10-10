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

function seedBackground(overrides: Doc = {}): void {
  fake.seed(COLLECTIONS.FLOORPLAN_BACKGROUNDS, BACKGROUND, {
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

describe('ΑΟ-2 — ό,τι λείπει ή δεν εξηγείται ⇒ ΚΑΜΙΑ πηγή, με όνομα', () => {
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
    const resolve = reader.createFloorPlateResolver({} as AdminFirestore);
    await expect(resolve(SELF, { companyId: COMPANY })).resolves.toEqual([]);
    await expect(resolve(SELF, { companyId: null, floorId: FLOOR })).resolves.toEqual([]);
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
