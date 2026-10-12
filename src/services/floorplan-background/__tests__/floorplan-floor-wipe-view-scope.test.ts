/**
 * ADR-914 §2.17 — το wipe αντικατάστασης αφορά την ΟΨΗ ΤΟΥ ΟΡΟΦΟΥ, όχι ό,τι μοιράζεται το `floorId`.
 *
 * Ένας όροφος έχει πολλές όψεις (ADR-914 §2.13): το επίπεδο του ορόφου και μία κάτοψη ανά ακίνητό
 * του. Όλες κουβαλούν το ίδιο `floorId` (κλειδί εμβέλειας BIM, ADR-420). Το wipe τις διάβαζε όλες
 * με `floorId ==` και έσβηνε οριστικά το αρχείο της καθεμιάς.
 *
 * Εκτελεί τον πραγματικό `FloorplanFloorWipeService` πάνω σε in-memory Firestore.
 */

interface SeedDoc { id: string; data: Record<string, unknown>; }
interface MockRef { id: string; __col: string; }

jest.mock('@/lib/firebaseAdmin', () => {
  const store: Record<string, SeedDoc[]> = {};
  const rows = (name: string) => store[name] ?? [];
  const matches = (data: Record<string, unknown>, filters: Record<string, unknown>) =>
    Object.entries(filters).every(([field, value]) => data[field] === value);
  const snapOf = (name: string, d: SeedDoc) => ({
    id: d.id, exists: true, ref: { id: d.id, __col: name }, data: () => d.data,
  });

  const makeQuery = (name: string, filters: Record<string, unknown> = {}) => ({
    where: (field: string, _op: string, value: unknown) => makeQuery(name, { ...filters, [field]: value }),
    get: async () => ({ docs: rows(name).filter((d) => matches(d.data, filters)).map((d) => snapOf(name, d)) }),
    count: () => ({
      get: async () => ({ data: () => ({ count: rows(name).filter((d) => matches(d.data, filters)).length }) }),
    }),
    doc: (id: string) => ({
      get: async () => {
        const found = rows(name).find((d) => d.id === id);
        return found ? snapOf(name, found) : { id, exists: false, ref: { id, __col: name }, data: () => undefined };
      },
    }),
  });

  const db = {
    collection: (name: string) => makeQuery(name),
    batch: () => {
      const ops: Array<() => void> = [];
      return {
        delete: (ref: MockRef) => {
          ops.push(() => { store[ref.__col] = rows(ref.__col).filter((d) => d.id !== ref.id); });
        },
        update: (ref: MockRef, patch: Record<string, unknown>) => {
          ops.push(() => {
            const doc = rows(ref.__col).find((d) => d.id === ref.id);
            if (doc) Object.assign(doc.data, patch);
          });
        },
        commit: async () => { for (const op of ops) op(); },
      };
    },
  };

  return {
    getAdminFirestore: () => db,
    __store: store,
    __seed: (name: string, docs: SeedDoc[]) => { store[name] = docs; },
    __reset: () => { for (const k of Object.keys(store)) delete store[k]; },
  };
});

jest.mock('firebase-admin/firestore', () => ({ FieldValue: { serverTimestamp: () => 'TS' } }));

jest.mock('../floor-wipe-storage', () => ({
  deleteStorageObjects: jest.fn(async (fileRows: unknown[]) => ({ deleted: fileRows.length, failed: 0 })),
  sweepFloorCategoryPath: jest.fn(async () => ({ deleted: 0, failed: 0 })),
  sumTallies: () => ({ deleted: 0, failed: 0 }),
}));

jest.mock('../bim-floor-wipe.service', () => ({
  wipeBimForFloor: jest.fn(async () => ({ bimEntitiesDeleted: 0, boqItemsDeleted: 0 })),
  countBimForFloor: jest.fn(async () => ({ bimEntityCount: 0, boqItemCount: 0 })),
}));

jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
}));

import { FloorplanFloorWipeService } from '../floorplan-floor-wipe.service';
import { deleteStorageObjects } from '../floor-wipe-storage';
import { COLLECTIONS } from '@/config/firestore-collections';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const adminMock = require('@/lib/firebaseAdmin') as {
  __store: Record<string, SeedDoc[]>;
  __seed: (c: string, d: SeedDoc[]) => void;
  __reset: () => void;
};

const COMPANY = 'comp_1';
const FLOOR = 'flr_first';
const PROPERTY = 'prop_apartment';

const level = (id: string, sceneFileId: string | null, propertyId: string | null): SeedDoc => ({
  id,
  data: { companyId: COMPANY, floorId: FLOOR, sceneFileId, sceneFileName: sceneFileId && `${id}.dxf`, propertyId },
});

const file = (id: string, entityType: string, entityId: string): SeedDoc => ({
  id,
  data: { companyId: COMPANY, entityType, entityId, storagePath: `companies/${COMPANY}/${id}.dxf` },
});

const docOf = (collection: string, id: string) => adminMock.__store[collection]?.find((d) => d.id === id);

/** Όροφος με δική του κάτοψη + υπόβαθρο, και ένα ακίνητο του ορόφου με δική του κάτοψη. */
function seedFloorWithPropertyView(): void {
  adminMock.__seed(COLLECTIONS.DXF_VIEWER_LEVELS, [
    level('lvl_storey', 'file_storey', null),
    level('lvl_property', 'file_property', PROPERTY),
  ]);
  adminMock.__seed(COLLECTIONS.FILES, [
    file('file_storey', 'floor', FLOOR),
    file('file_background', 'floor', FLOOR),
    file('file_property', 'property', PROPERTY),
  ]);
  adminMock.__seed(COLLECTIONS.FLOORPLAN_BACKGROUNDS, [
    { id: 'rbg_1', data: { companyId: COMPANY, floorId: FLOOR, fileId: 'file_background' } },
  ]);
  adminMock.__seed(COLLECTIONS.FLOORS, [{ id: FLOOR, data: { companyId: COMPANY, projectId: 'proj_1' } }]);
}

beforeEach(() => {
  adminMock.__reset();
  (deleteStorageObjects as jest.Mock).mockClear();
  seedFloorWithPropertyView();
});

describe('wipeAllForFloor — εμβέλεια: η όψη του ορόφου', () => {
  it('ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ: η κάτοψη ακινήτου του ίδιου ορόφου επιζεί (επίπεδο, αρχείο, bytes)', async () => {
    await FloorplanFloorWipeService.wipeAllForFloor(COMPANY, FLOOR);

    expect(docOf(COLLECTIONS.DXF_VIEWER_LEVELS, 'lvl_property')?.data.sceneFileId).toBe('file_property');
    expect(docOf(COLLECTIONS.FILES, 'file_property')).toBeDefined();
    const wipedIds = ((deleteStorageObjects as jest.Mock).mock.calls[0][0] as Array<{ ref: MockRef }>)
      .map((row) => row.ref.id);
    expect(wipedIds).not.toContain('file_property');
  });

  it('η όψη του ορόφου αντικαθίσταται όπως πριν: δέσιμο σκηνής, αρχεία, υπόβαθρο', async () => {
    const result = await FloorplanFloorWipeService.wipeAllForFloor(COMPANY, FLOOR);

    expect(docOf(COLLECTIONS.DXF_VIEWER_LEVELS, 'lvl_storey')?.data.sceneFileId).toBeNull();
    expect(docOf(COLLECTIONS.DXF_VIEWER_LEVELS, 'lvl_storey')).toBeDefined();
    expect(docOf(COLLECTIONS.FILES, 'file_storey')).toBeUndefined();
    expect(docOf(COLLECTIONS.FILES, 'file_background')).toBeUndefined();
    expect(adminMock.__store[COLLECTIONS.FLOORPLAN_BACKGROUNDS]).toHaveLength(0);
    expect(result).toMatchObject({ dxfLevelsCleared: 1, floorplanBackgroundsDeleted: 1, fileRecordsDeleted: 2 });
  });

  it('η προεπισκόπηση μετρά ό,τι θα σβηστεί — όχι τα αρχεία των ακινήτων', async () => {
    const preview = await FloorplanFloorWipeService.preview(COMPANY, FLOOR);

    expect(preview.fileRecordCount).toBe(2);
  });
});
