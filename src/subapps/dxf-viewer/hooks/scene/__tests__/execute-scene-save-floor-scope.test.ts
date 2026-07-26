/**
 * ADR-714 — executor floor-scope tests.
 *
 * ΤΟ ΣΕΝΑΡΙΟ ΤΗΣ ΖΗΜΙΑΣ (2026-07-26), κωδικοποιημένο:
 * ο χρήστης φορτώνει το ΙΔΙΟ `Ισόγειο 1.dxf` σε δύο ορόφους, επεξεργάζεται τον Α,
 * αλλάζει σε Β μέσα στο παράθυρο του 2s debounce. Πριν το ADR-714 το save εκτελούνταν
 * με τον προορισμό του Β και έγραφε τη σκηνή του Α στο αρχείο του Β — δύο όροφοι,
 * ένα `.scene.json`. Εδώ αποδεικνύεται ότι πλέον γράφει στο αρχείο του Α.
 */

import { createSceneSaveTicket } from '../scene-save-ticket';
import { executeSceneSave } from '../execute-scene-save';
import type { SceneModel } from '../../../types/scene';

jest.mock('../../../services/dxf-firestore.service', () => ({
  DxfFirestoreService: {
    getFileFloorScope: jest.fn(),
    findFloorFloorplanFileRecord: jest.fn(),
    findExistingFileRecord: jest.fn(),
    deriveScenePath: (p: string) => `${p.replace(/(\.[a-zA-Z0-9]+)+$/, '')}.scene.json`,
    generateFileId: () => 'file_NEW',
    autoSaveV2: jest.fn(),
  },
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { DxfFirestoreService } = require('../../../services/dxf-firestore.service');

type SceneEntity = SceneModel['entities'][number];
const entity = (id: string, type: string): SceneEntity =>
  ({ id, type, layerId: 'lyr_1', visible: true }) as unknown as SceneEntity;
const scene = (...entities: SceneEntity[]): SceneModel =>
  ({
    entities,
    layersById: {},
    bounds: { min: { x: 0, y: 0 }, max: { x: 0, y: 0 } },
    units: 'mm',
  }) as unknown as SceneModel;

const FLOOR_A = 'flr_4275c4c9'; // 1ος Όροφος
const FLOOR_B = 'flr_7a0a8be2'; // Ισόγειο
const FILE_A = 'file_90ee1df2';
const FILE_B = 'file_751f0286';
const PATH_A = `companies/c/entities/floor/${FLOOR_A}/…/${FILE_A}.dxf`;
const PATH_B = `companies/c/entities/floor/${FLOOR_B}/…/${FILE_B}.dxf`;

const deps = {
  getBaselineDxfCount: jest.fn(() => 0),
  markFileTargetOrphaned: jest.fn(),
};

const ticketFor = (overrides: Partial<Parameters<typeof createSceneSaveTicket>[0]> = {}) =>
  createSceneSaveTicket({
    levelId: 'lvl_A',
    floorId: FLOOR_A,
    companyId: 'comp_1',
    userUid: 'uid_1',
    fileId: FILE_A,
    fileName: 'Ισόγειο 1.dxf',
    canonicalScenePath: null,
    saveContext: null,
    scene: scene(entity('l1', 'line'), entity('c1', 'column')),
    ...overrides,
  });

beforeEach(() => {
  jest.clearAllMocks();
  deps.getBaselineDxfCount.mockReturnValue(0);
  DxfFirestoreService.autoSaveV2.mockResolvedValue(true);
});

describe('executeSceneSave — write identity', () => {
  it('ΤΟ ΣΕΝΑΡΙΟ: εναλλαγή ορόφου μέσα στο debounce ΔΕΝ ανακατευθύνει την εγγραφή', async () => {
    // Το ticket του ορόφου Α πάγωσε στο Τ₀.
    const ticket = ticketFor();

    // …και ΤΩΡΑ (Τ₀+2s) το «τρέχον» αρχείο είναι του ορόφου Β. Ο executor δεν το βλέπει
    // ποτέ — διαβάζει μόνο το ticket. Το mock απαντά για το FILE_A του ticket.
    DxfFirestoreService.getFileFloorScope.mockResolvedValue({
      storagePath: PATH_A,
      entityType: 'floor',
      entityId: FLOOR_A,
    });

    const outcome = await executeSceneSave(ticket, deps);

    expect(outcome.status).toBe('saved');
    expect(DxfFirestoreService.autoSaveV2).toHaveBeenCalledTimes(1);
    const [fileId, , , ctx] = DxfFirestoreService.autoSaveV2.mock.calls[0];
    expect(fileId).toBe(FILE_A);
    expect(ctx.canonicalScenePath).toContain(FLOOR_A);
    expect(ctx.canonicalScenePath).not.toContain(FLOOR_B);
  });

  it('ΜΠΛΟΚΑΡΕΙ όταν ο προορισμός ανήκει σε άλλον όροφο', async () => {
    DxfFirestoreService.getFileFloorScope.mockResolvedValue({
      storagePath: PATH_B,
      entityType: 'floor',
      entityId: FLOOR_B, // ξένος όροφος
    });

    const outcome = await executeSceneSave(ticketFor({ fileId: FILE_B }), deps);

    expect(outcome).toEqual({ status: 'blocked', reason: 'cross-floor-target' });
    expect(DxfFirestoreService.autoSaveV2).not.toHaveBeenCalled();
  });

  it('ΜΠΛΟΚΑΡΕΙ ακόμη κι όταν το path ήταν ήδη cached (cache ≠ ιδιοκτησία)', async () => {
    DxfFirestoreService.getFileFloorScope.mockResolvedValue({
      storagePath: PATH_B,
      entityType: 'floor',
      entityId: FLOOR_B,
    });

    const outcome = await executeSceneSave(
      ticketFor({ fileId: FILE_B, canonicalScenePath: `${PATH_B}.scene.json` }),
      deps,
    );

    expect(outcome).toEqual({ status: 'blocked', reason: 'cross-floor-target' });
    expect(DxfFirestoreService.autoSaveV2).not.toHaveBeenCalled();
  });

  it('ΜΠΛΟΚΑΡΕΙ εγγραφή που μηδενίζει τη DXF γεωμετρία', async () => {
    DxfFirestoreService.getFileFloorScope.mockResolvedValue({
      storagePath: PATH_A,
      entityType: 'floor',
      entityId: FLOOR_A,
    });
    deps.getBaselineDxfCount.mockReturnValue(1169);

    const outcome = await executeSceneSave(
      ticketFor({ scene: scene(entity('c1', 'column')) }),
      deps,
    );

    expect(outcome).toEqual({ status: 'blocked', reason: 'dxf-wipe' });
    expect(DxfFirestoreService.autoSaveV2).not.toHaveBeenCalled();
  });

  it('latch + skip όταν το backing doc λείπει (ADR-469 belt #2)', async () => {
    DxfFirestoreService.getFileFloorScope.mockResolvedValue(null);

    const outcome = await executeSceneSave(ticketFor(), deps);

    expect(outcome).toEqual({ status: 'skipped', reason: 'orphaned-target' });
    expect(deps.markFileTargetOrphaned).toHaveBeenCalledWith(FILE_A);
    expect(DxfFirestoreService.autoSaveV2).not.toHaveBeenCalled();
  });
});

describe('executeSceneSave — target resolution χωρίς fileId', () => {
  it('ψάχνει ΑΝΑ ΟΡΟΦΟ, όχι ανά όνομα αρχείου', async () => {
    DxfFirestoreService.findFloorFloorplanFileRecord.mockResolvedValue({
      id: FILE_A,
      storagePath: PATH_A,
    });

    const outcome = await executeSceneSave(ticketFor({ fileId: null }), deps);

    expect(DxfFirestoreService.findFloorFloorplanFileRecord).toHaveBeenCalledWith('comp_1', FLOOR_A);
    // Το name-based lookup — που επέστρεφε αυθαίρετα ένα από τα δύο ομώνυμα — δεν καλείται.
    expect(DxfFirestoreService.findExistingFileRecord).not.toHaveBeenCalled();
    expect(outcome.status).toBe('saved');
  });

  it('πέφτει σε name-based lookup ΜΟΝΟ όταν δεν υπάρχει όροφος (legacy σκηνή)', async () => {
    DxfFirestoreService.findExistingFileRecord.mockResolvedValue({
      id: 'file_LEGACY',
      storagePath: 'companies/c/entities/project/proj_1/…/file_LEGACY.dxf',
    });

    const outcome = await executeSceneSave(ticketFor({ fileId: null, floorId: null }), deps);

    expect(DxfFirestoreService.findFloorFloorplanFileRecord).not.toHaveBeenCalled();
    expect(DxfFirestoreService.findExistingFileRecord).toHaveBeenCalledWith('comp_1', 'Ισόγειο 1.dxf');
    expect(outcome.status).toBe('saved');
  });

  it('γεννά νέο enterprise id όταν ο όροφος δεν έχει ακόμη αρχείο (γνήσιο πρώτο save)', async () => {
    DxfFirestoreService.findFloorFloorplanFileRecord.mockResolvedValue(null);

    const outcome = await executeSceneSave(
      ticketFor({ fileId: null, canonicalScenePath: `${PATH_A}.scene.json` }),
      deps,
    );

    expect(outcome.status).toBe('saved');
    expect(DxfFirestoreService.autoSaveV2.mock.calls[0][0]).toBe('file_NEW');
  });
});
