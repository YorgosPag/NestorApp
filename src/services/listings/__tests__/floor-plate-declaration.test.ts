/**
 * @jest-environment node
 *
 * @fileoverview ✍️ **Η ΔΗΛΩΣΗ ΟΡΟΦΟΥ: υπογραφή, άρση, επαναπροβολή** — ADR-907 §11.7.
 * @related services/listings/floor-plate-declaration.service · services/listings/listing-media-refresh (`refreshListingsOfFloor`)
 *
 * 🔴 **ΤΙ ΦΥΛΑΕΙ**:
 * - **ΔΟ-1** — η υπογραφή γράφει «ποιος, πότε» στον όροφο, με σφραγίδα έκδοσης και **μία** γραμμή ιστορικού.
 * - **ΔΟ-2** — η κρίση τρέχει **πριν**: άρνηση ⇒ καμία γραφή, καμία γραμμή, και το όνομα φτάνει στον καλούντα.
 * - **ΔΟ-3** — ιδεμποτία και άρση· ξένος χώρος δεν γράφει ποτέ.
 * - **ΔΟ-4** — η επαναπροβολή πιάνει **μόνο** τις δημοσιευμένες μονάδες του ορόφου, του ίδιου χώρου.
 *
 * ⚠️ Ο αναγνώστης και η κρίση **ΔΕΝ** γίνονται mock.
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import { FakeFirestore } from '@/test-utils/fake-firestore/fake-firestore';
import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

jest.mock('server-only', () => ({}));

const recordChange = jest.fn(async (..._args: unknown[]): Promise<string | null> => 'audit_1');
jest.mock('@/services/entity-audit.service', () => ({
  EntityAuditService: { recordChange: (...args: unknown[]) => recordChange(...args) },
}));

const republishListing = jest.fn(async (..._args: unknown[]): Promise<string> => 'published');
jest.mock('../publish-public-listing', () => ({
  republishListing: (...args: unknown[]) => republishListing(...args),
  reportProjectionFailure: () => 'failed',
}));
jest.mock('../public-listing-projection', () => ({
  isPubliclyListed: (property: { listed?: boolean }): boolean => property.listed === true,
}));
jest.mock('@/services/company/company-public-name.reader', () => ({
  createAgencyIdentityResolver: () => async () => null,
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const service = require('../floor-plate-declaration.service') as typeof import('../floor-plate-declaration.service');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { refreshListingsOfFloor } = require('../listing-media-refresh') as typeof import('../listing-media-refresh');

const COMPANY = 'comp_alpha';
const FLOOR = 'flr_ground';
const FILE = 'file_plate';
const ACTOR = { floorId: FLOOR, companyId: COMPANY, performedBy: 'uid_giorgio' };

let fake: FakeFirestore;
const db = (): AdminFirestore => fake as unknown as AdminFirestore;
const floor = (): Record<string, unknown> => fake.getAllDocs(COLLECTIONS.FLOORS)[FLOOR];

function seedUnit(id: string, overrides: Record<string, unknown> = {}): void {
  fake.seed(COLLECTIONS.PROPERTIES, id, { companyId: COMPANY, floorId: FLOOR, commercialStatus: 'for-sale', listed: true, ...overrides });
}

function seedFloorWithPlate(): void {
  fake.seed(COLLECTIONS.FLOORS, FLOOR, { companyId: COMPANY, name: 'Ισόγειο', _v: 4 });
  fake.seed(COLLECTIONS.FILES, FILE, {
    companyId: COMPANY, entityType: 'floor', entityId: FLOOR, category: 'floorplans', classification: 'public',
    contentType: 'image/png', status: 'ready', lifecycleState: 'active', isDeleted: false,
    storagePath: 'companies/c/floor.png', createdAt: '2026-10-09T08:00:00.000Z', imageDimensions: { width: 1000, height: 800 },
  });
  fake.seed(COLLECTIONS.FLOORPLAN_BACKGROUNDS, 'rbg_1', {
    companyId: COMPANY, floorId: FLOOR, fileId: FILE, naturalBounds: { width: 1000, height: 800 },
  });
  fake.seed(COLLECTIONS.FLOORPLAN_OVERLAYS, 'ovrl_1', {
    companyId: COMPANY, floorId: FLOOR, backgroundId: 'rbg_1', role: 'property', createdAt: '2026-10-09T10:00:00.000Z',
    linked: { propertyId: 'prop_a' },
    geometry: { type: 'polygon', vertices: [{ x: 0, y: 0 }, { x: 500, y: 0 }, { x: 500, y: 400 }, { x: 0, y: 400 }] },
  });
  seedUnit('prop_a');
}

const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  jest.clearAllMocks();
  fake = new FakeFirestore();
  seedFloorWithPlate();
});

describe('ΔΟ-1 — η υπογραφή γράφει «ποιος, πότε» και αφήνει γραμμή', () => {
  it('δήλωση στον όροφο, έκδοση +1, μία γραμμή ιστορικού του ορόφου', async () => {
    const outcome = await service.declareFloorPlate(db(), { ...ACTOR, fileId: FILE });
    await flush();

    expect(outcome).toMatchObject({ state: 'declared', declaration: { fileId: FILE, declaredBy: 'uid_giorgio' } });
    expect(floor().publishedFloorPlate).toMatchObject({ fileId: FILE, declaredBy: 'uid_giorgio' });
    expect(Date.parse((floor().publishedFloorPlate as { declaredAt: string }).declaredAt)).not.toBeNaN();
    expect(floor()._v).toBe(5);
    expect(recordChange).toHaveBeenCalledTimes(1);
    expect(recordChange.mock.calls[0][0]).toMatchObject({
      entityType: 'floor', entityId: FLOOR, companyId: COMPANY, performedBy: 'uid_giorgio',
      changes: [{ field: 'publishedFloorPlate', oldValue: null, newValue: FILE }],
    });
  });
});

describe('ΔΟ-2 — η κρίση τρέχει ΠΡΙΝ από την υπογραφή', () => {
  it('άδετο περίγραμμα ⇒ άρνηση με όνομα και περίγραμμα· καμία γραφή, καμία γραμμή', async () => {
    fake.seed(COLLECTIONS.FLOORPLAN_OVERLAYS, 'ovrl_2', {
      companyId: COMPANY, floorId: FLOOR, backgroundId: 'rbg_1', role: 'property', createdAt: '2026-10-09T10:00:05.000Z',
      geometry: { type: 'polygon', vertices: [{ x: 500, y: 0 }, { x: 900, y: 0 }, { x: 900, y: 400 }] },
    });

    const outcome = await service.declareFloorPlate(db(), { ...ACTOR, fileId: FILE });
    await flush();

    expect(outcome).toEqual({ state: 'refused', why: 'unlinked-outline', overlayId: 'ovrl_2' });
    expect(floor().publishedFloorPlate).toBeUndefined();
    expect(floor()._v).toBe(4);
    expect(recordChange).not.toHaveBeenCalled();
  });

  it('όροφος χωρίς καμία μονάδα πάνω στην εικόνα δεν υπογράφεται', async () => {
    fake.seed(COLLECTIONS.FLOORPLAN_OVERLAYS, 'ovrl_1', { companyId: COMPANY, floorId: FLOOR, backgroundId: 'other' });
    expect(await service.declareFloorPlate(db(), { ...ACTOR, fileId: FILE })).toMatchObject({ state: 'refused', why: 'self-missing' });
  });

  it('εικόνα που δεν είναι `public` δεν υπογράφεται', async () => {
    fake.seed(COLLECTIONS.FILES, FILE, { ...fake.getAllDocs(COLLECTIONS.FILES)[FILE], classification: 'internal' });
    expect(await service.declareFloorPlate(db(), { ...ACTOR, fileId: FILE })).toMatchObject({ state: 'refused', why: 'image-not-public' });
  });
});

describe('ΔΟ-3 — ιδεμποτία, άρση, κηδεμονία', () => {
  it('δεύτερη υπογραφή της ίδιας εικόνας κρατά τον ΠΡΩΤΟ υπογράφοντα — καμία γραφή, καμία δεύτερη γραμμή', async () => {
    await service.declareFloorPlate(db(), { ...ACTOR, fileId: FILE });
    const second = await service.declareFloorPlate(db(), { ...ACTOR, performedBy: 'uid_other', fileId: FILE });
    await flush();

    expect(second).toMatchObject({ state: 'already', declaration: { declaredBy: 'uid_giorgio' } });
    expect(floor()._v).toBe(5);
    expect(recordChange).toHaveBeenCalledTimes(1);
  });

  it('η άρση αδειάζει τη δήλωση με γραμμή· δεύτερη άρση δεν γράφει τίποτα', async () => {
    await service.declareFloorPlate(db(), { ...ACTOR, fileId: FILE });

    expect(await service.withdrawFloorPlate(db(), ACTOR)).toEqual({ state: 'withdrawn' });
    expect(floor().publishedFloorPlate).toBeNull();
    expect(await service.withdrawFloorPlate(db(), ACTOR)).toEqual({ state: 'absent' });
    await flush();

    expect(recordChange).toHaveBeenCalledTimes(2);
    expect(recordChange.mock.calls[1][0]).toMatchObject({ changes: [{ oldValue: FILE, newValue: null }] });
  });

  it('ξένος χώρος δεν υπογράφει και δεν αίρει', async () => {
    const stranger = { ...ACTOR, companyId: 'comp_other' };
    expect(await service.declareFloorPlate(db(), { ...stranger, fileId: FILE })).toMatchObject({ state: 'refused' });
    expect(await service.withdrawFloorPlate(db(), stranger)).toEqual({ state: 'failed' });
    expect(floor().publishedFloorPlate).toBeUndefined();
  });
});

describe('ΔΟ-4 — η επαναπροβολή του ορόφου', () => {
  it('μόνο οι ΔΗΜΟΣΙΕΥΜΕΝΕΣ μονάδες ΑΥΤΟΥ του ορόφου και ΑΥΤΟΥ του χώρου', async () => {
    seedUnit('prop_b');
    seedUnit('prop_unlisted', { listed: false });
    seedUnit('prop_other_floor', { floorId: 'flr_first' });
    seedUnit('prop_other_company', { companyId: 'comp_other' });

    const reports = await refreshListingsOfFloor(db(), FLOOR, COMPANY);

    expect(reports.map((report) => report.propertyId).sort()).toEqual(['prop_a', 'prop_b']);
    expect(republishListing).toHaveBeenCalledTimes(2);
  });

  it('όλες οι αδελφές παίρνουν τον ΙΔΙΟ επιλυτή μέσων — ένα πέρασμα, μία ανάγνωση ορόφου', async () => {
    seedUnit('prop_b');
    await refreshListingsOfFloor(db(), FLOOR, COMPANY);

    const [first, second] = republishListing.mock.calls;
    expect(typeof first[4]).toBe('function');
    expect(second[4]).toBe(first[4]);
  });

  it('βλάβη ανάγνωσης δεν πετά', async () => {
    const broken = { collection: () => { throw new Error('UNAVAILABLE'); } } as unknown as AdminFirestore;
    await expect(refreshListingsOfFloor(broken, FLOOR, COMPANY)).resolves.toEqual([]);
  });
});
