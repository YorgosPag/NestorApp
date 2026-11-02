/**
 * ADR-914 §2.17 — το wipe αντικατάστασης αφορά την ΟΨΗ ΤΟΥ ΟΡΟΦΟΥ, όχι ό,τι μοιράζεται το `floorId`.
 *
 * Ένας όροφος έχει πολλές όψεις (ADR-914 §2.13): το επίπεδο του ορόφου και μία κάτοψη ανά ακίνητό
 * του. Όλες κουβαλούν το ίδιο `floorId` (κλειδί εμβέλειας BIM, ADR-420). Το wipe τις διάβαζε όλες
 * με `floorId ==` και έσβηνε οριστικά το αρχείο της καθεμιάς.
 *
 * ADR-899 §2.2.1 — τα αρχεία του ορόφου πάνε στην ΜΙΑ αγωγό εκκαθάρισης (κάδος, `purgeAt = τώρα`), ΠΟΤΕ hard delete·
 * ό,τι κρατείται (`isFileHeld`) μένει όπως είναι, και η προεπισκόπηση το λέει.
 *
 * Εκτελεί τον πραγματικό `FloorplanFloorWipeService` πάνω σε in-memory Firestore.
 */

interface SeedDoc { id: string; data: Record<string, unknown>; }
interface MockRef { id: string; __col: string; }

jest.mock('@/lib/firebaseAdmin', () => {
  const store: Record<string, SeedDoc[]> = {};
  /** Η σειρά των δεσμευμένων πράξεων — για το συμβόλαιο «κάδος πριν από τα υπόβαθρα». */
  const opLog: string[] = [];
  /** Η τελευταία ΔΕΣΜΕΥΜΕΝΗ κατάσταση κάθε εγγράφου τη στιγμή που σβήστηκε — ό,τι διαβάζει ένα `onDelete` trigger. */
  const deletedAs: Record<string, Record<string, unknown>> = {};
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
          ops.push(() => {
            const gone = rows(ref.__col).find((d) => d.id === ref.id);
            if (gone) deletedAs[`${ref.__col}/${ref.id}`] = { ...gone.data };
            store[ref.__col] = rows(ref.__col).filter((d) => d.id !== ref.id);
            opLog.push(`delete:${ref.__col}:${ref.id}`);
          });
        },
        update: (ref: MockRef, patch: Record<string, unknown>) => {
          ops.push(() => {
            const doc = rows(ref.__col).find((d) => d.id === ref.id);
            if (doc) Object.assign(doc.data, patch);
            opLog.push(`update:${ref.__col}:${ref.id}`);
          });
        },
        commit: async () => { for (const op of ops) op(); opLog.push('commit'); },
      };
    },
  };

  return {
    getAdminFirestore: () => db,
    __store: store,
    __opLog: opLog,
    __deletedAs: deletedAs,
    __seed: (name: string, docs: SeedDoc[]) => { store[name] = docs; },
    __reset: () => {
      for (const k of Object.keys(store)) delete store[k];
      for (const k of Object.keys(deletedAs)) delete deletedAs[k];
      opLog.length = 0;
    },
  };
});

jest.mock('firebase-admin/firestore', () => ({ FieldValue: { serverTimestamp: () => 'TS' } }));

jest.mock('../floor-wipe-storage', () => ({
  claimedByFileRows: jest.fn((rows: unknown[]) => ({ rows })),
  sweepFloorCategoryPath: jest.fn(async () => ({ deleted: 0, failed: 0, spared: 0 })),
  sumTallies: () => ({ deleted: 0, failed: 0, spared: 0 }),
}));

jest.mock('../bim-floor-wipe.service', () => ({
  wipeBimForFloor: jest.fn(async () => ({ bimEntitiesDeleted: 0, boqItemsDeleted: 0 })),
  countBimForFloor: jest.fn(async () => ({ bimEntityCount: 0, boqItemCount: 0 })),
}));

jest.mock('@/services/file-audit-admin.service', () => ({ recordFileAudit: jest.fn(async () => 'aud_1') }));

jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
}));

import { FloorplanFloorWipeService } from '../floorplan-floor-wipe.service';
import { claimedByFileRows } from '../floor-wipe-storage';
import { recordFileAudit } from '@/services/file-audit-admin.service';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FILE_LIFECYCLE_STATES, HOLD_TYPES } from '@/config/domain-constants';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const adminMock = require('@/lib/firebaseAdmin') as {
  __store: Record<string, SeedDoc[]>;
  __opLog: string[];
  __deletedAs: Record<string, Record<string, unknown>>;
  __seed: (c: string, d: SeedDoc[]) => void;
  __reset: () => void;
};

const COMPANY = 'comp_1';
const FLOOR = 'flr_first';
const PROPERTY = 'prop_apartment';
const WIPER = 'uid_wiper';
const OPTS = { performedBy: WIPER };

const level = (id: string, sceneFileId: string | null, propertyId: string | null): SeedDoc => ({
  id,
  data: { companyId: COMPANY, floorId: FLOOR, sceneFileId, sceneFileName: sceneFileId && `${id}.dxf`, propertyId },
});

const file = (id: string, entityType: string, entityId: string, extra: Record<string, unknown> = {}): SeedDoc => ({
  id,
  data: { companyId: COMPANY, entityType, entityId, storagePath: `companies/${COMPANY}/${id}.dxf`, ...extra },
});

const docOf = (collection: string, id: string) => adminMock.__store[collection]?.find((d) => d.id === id);
const fileData = (id: string) => docOf(COLLECTIONS.FILES, id)?.data;

/** Όροφος με δική του κάτοψη + υπόβαθρο, και ένα ακίνητο του ορόφου με δική του κάτοψη. */
function seedFloorWithPropertyView(extraFiles: SeedDoc[] = []): void {
  adminMock.__seed(COLLECTIONS.DXF_VIEWER_LEVELS, [
    level('lvl_storey', 'file_storey', null),
    level('lvl_property', 'file_property', PROPERTY),
  ]);
  adminMock.__seed(COLLECTIONS.FILES, [
    file('file_storey', 'floor', FLOOR),
    file('file_background', 'floor', FLOOR),
    file('file_property', 'property', PROPERTY),
    ...extraFiles,
  ]);
  adminMock.__seed(COLLECTIONS.FLOORPLAN_BACKGROUNDS, [
    { id: 'rbg_1', data: { companyId: COMPANY, floorId: FLOOR, fileId: 'file_background' } },
  ]);
  adminMock.__seed(COLLECTIONS.FLOORS, [{ id: FLOOR, data: { companyId: COMPANY, projectId: 'proj_1' } }]);
}

const isQueuedForPurge = (data: Record<string, unknown> | undefined) =>
  data?.isDeleted === true && data.lifecycleState === FILE_LIFECYCLE_STATES.TRASHED && typeof data.purgeAt === 'string';

beforeEach(() => {
  adminMock.__reset();
  jest.clearAllMocks();
  seedFloorWithPropertyView();
});

describe('wipeAllForFloor — εμβέλεια: η όψη του ορόφου', () => {
  it('ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ: η κάτοψη ακινήτου του ίδιου ορόφου επιζεί (επίπεδο, αρχείο, bytes)', async () => {
    const before = { ...fileData('file_property') };
    await FloorplanFloorWipeService.wipeAllForFloor(COMPANY, FLOOR, OPTS);

    expect(docOf(COLLECTIONS.DXF_VIEWER_LEVELS, 'lvl_property')?.data.sceneFileId).toBe('file_property');
    expect(fileData('file_property')).toEqual(before);
    const claimedIds = ((claimedByFileRows as jest.Mock).mock.calls[0][0] as Array<{ ref: MockRef }>)
      .map((row) => row.ref.id);
    expect(claimedIds).not.toContain('file_property');
  });

  it('η όψη του ορόφου αντικαθίσταται: δέσιμο σκηνής, υπόβαθρο — τα αρχεία στην ουρά εκκαθάρισης, ΟΧΙ hard delete', async () => {
    const result = await FloorplanFloorWipeService.wipeAllForFloor(COMPANY, FLOOR, OPTS);

    expect(docOf(COLLECTIONS.DXF_VIEWER_LEVELS, 'lvl_storey')?.data.sceneFileId).toBeNull();
    expect(docOf(COLLECTIONS.DXF_VIEWER_LEVELS, 'lvl_storey')).toBeDefined();
    expect(isQueuedForPurge(fileData('file_storey'))).toBe(true);
    expect(isQueuedForPurge(fileData('file_background'))).toBe(true);
    expect(fileData('file_storey')?.trashedBy).toBe(WIPER);
    expect(adminMock.__store[COLLECTIONS.FLOORPLAN_BACKGROUNDS]).toHaveLength(0);
    expect(result).toMatchObject({
      dxfLevelsCleared: 1, floorplanBackgroundsDeleted: 1, fileRecordsTrashed: 2, fileRecordsHeld: 0,
    });
  });

  it('η προεπισκόπηση μετρά ό,τι θα γίνει — όχι τα αρχεία των ακινήτων', async () => {
    const preview = await FloorplanFloorWipeService.preview(COMPANY, FLOOR);

    expect(preview.fileRecordCount).toBe(2);
    expect(preview.heldFileCount).toBe(0);
  });
});

describe('wipeAllForFloor — ο κριτής δέσμευσης (ADR-899 §2.2.1)', () => {
  const HELD = [
    file('file_legal', 'floor', FLOOR, { hold: HOLD_TYPES.LEGAL }),
    file('file_preserved', 'floor', FLOOR, { preservedFor: ['phdl_1'] }),
    file('file_record', 'floor', FLOOR, { handoverProtocolOf: 'hp_1' }),
  ];

  it('🔴 ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ: δέσμευση · διατήρηση · record ⇒ η εγγραφή μένει ΑΚΡΙΒΩΣ όπως ήταν, και μετριέται', async () => {
    seedFloorWithPropertyView(HELD);
    const before = HELD.map((d) => ({ ...fileData(d.id) }));

    const result = await FloorplanFloorWipeService.wipeAllForFloor(COMPANY, FLOOR, OPTS);

    expect(HELD.map((d) => fileData(d.id))).toEqual(before);
    expect(result).toMatchObject({ fileRecordsTrashed: 2, fileRecordsHeld: 3 });
  });

  it('🔴 οι κρατημένες εγγραφές ΔΙΕΚΔΙΚΟΥΝ τα αντικείμενά τους στη σάρωση φακέλου', async () => {
    seedFloorWithPropertyView(HELD);
    await FloorplanFloorWipeService.wipeAllForFloor(COMPANY, FLOOR, OPTS);

    const claimedIds = ((claimedByFileRows as jest.Mock).mock.calls[0][0] as Array<{ ref: MockRef }>)
      .map((row) => row.ref.id);
    expect(claimedIds).toEqual(expect.arrayContaining(['file_legal', 'file_preserved', 'file_record', 'file_storey']));
  });

  it('🔴 η προεπισκόπηση λέει πόσα ΔΕΝ θα σβηστούν', async () => {
    seedFloorWithPropertyView(HELD);
    const preview = await FloorplanFloorWipeService.preview(COMPANY, FLOOR);

    expect(preview).toMatchObject({ fileRecordCount: 2, heldFileCount: 3 });
  });

  it('ήδη στον κάδο / επιτύμβιο ⇒ ανέγγιχτα: δεύτερος κάδος δεν ξαναγράφει το ρολόι, το επιτύμβιο δεν ξανα-«σβήνεται»', async () => {
    seedFloorWithPropertyView([
      file('file_trashed', 'floor', FLOOR, {
        isDeleted: true, lifecycleState: FILE_LIFECYCLE_STATES.TRASHED, purgeAt: '2026-12-01T00:00:00.000Z',
      }),
      file('file_tombstone', 'floor', FLOOR, { lifecycleState: FILE_LIFECYCLE_STATES.PURGED, purgeAt: null }),
    ]);
    const before = ['file_trashed', 'file_tombstone'].map((id) => ({ ...fileData(id) }));

    const result = await FloorplanFloorWipeService.wipeAllForFloor(COMPANY, FLOOR, OPTS);

    expect(['file_trashed', 'file_tombstone'].map((id) => fileData(id))).toEqual(before);
    expect(result.fileRecordsTrashed).toBe(2);
    expect((await FloorplanFloorWipeService.preview(COMPANY, FLOOR)).fileRecordCount).toBe(0);
  });

  it('κάθε εγγραφή στην ουρά γράφει ΜΙΑ γραμμή στο βιβλίο του κατόχου, με τον αιτούντα — οι κρατημένες καμία', async () => {
    seedFloorWithPropertyView(HELD);
    await FloorplanFloorWipeService.wipeAllForFloor(COMPANY, FLOOR, OPTS);

    const audited = (recordFileAudit as jest.Mock).mock.calls.map(([input]) => input);
    expect(audited.map((a) => a.fileId).sort()).toEqual(['file_background', 'file_storey']);
    expect(audited[0]).toMatchObject({
      action: 'delete', performedBy: WIPER, companyId: COMPANY, metadata: { reason: 'floor_wipe', floorId: FLOOR },
    });
  });

  it('🔴 η εγγραφή μπαίνει στην ουρά ΠΡΙΝ σβηστεί το υπόβαθρο (το trigger του υποβάθρου τη βρίσκει ήδη εκεί)', async () => {
    await FloorplanFloorWipeService.wipeAllForFloor(COMPANY, FLOOR, OPTS);

    const log = adminMock.__opLog;
    const fileQueued = log.indexOf(`update:${COLLECTIONS.FILES}:file_background`);
    const backgroundGone = log.indexOf(`delete:${COLLECTIONS.FLOORPLAN_BACKGROUNDS}:rbg_1`);
    expect(fileQueued).toBeGreaterThanOrEqual(0);
    expect(backgroundGone).toBeGreaterThan(fileQueued);
  });

  it('🔴 το υπόβαθρο σβήνεται ΑΠΟΣΥΝΔΕΜΕΝΟ (`fileId: null`, σε δικό του commit) — το trigger δεν ξανακρίνει κρατημένο αρχείο', async () => {
    seedFloorWithPropertyView([file('file_legal', 'floor', FLOOR, { hold: HOLD_TYPES.LEGAL })]);
    adminMock.__seed(COLLECTIONS.FLOORPLAN_BACKGROUNDS, [
      { id: 'rbg_held', data: { companyId: COMPANY, floorId: FLOOR, fileId: 'file_legal' } },
    ]);

    await FloorplanFloorWipeService.wipeAllForFloor(COMPANY, FLOOR, OPTS);

    expect(adminMock.__deletedAs[`${COLLECTIONS.FLOORPLAN_BACKGROUNDS}/rbg_held`]?.fileId).toBeNull();
    const log = adminMock.__opLog;
    const detached = log.indexOf(`update:${COLLECTIONS.FLOORPLAN_BACKGROUNDS}:rbg_held`);
    const deleted = log.indexOf(`delete:${COLLECTIONS.FLOORPLAN_BACKGROUNDS}:rbg_held`);
    expect(log.slice(detached, deleted)).toContain('commit');
    expect(fileData('file_legal')?.isDeleted).toBeUndefined();
  });
});
