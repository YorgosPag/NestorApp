/**
 * ADR-399 / ADR-390 Φ4 / ADR-469 — «Όλοι οι όροφοι»: ένας όροφος με κάτοψη DXF αλλά
 * ΧΩΡΙΣ BIM στη μνήμη πρέπει να φορτώσει το BIM του από το snapshot / per-entity.
 *
 * ΤΟ ΕΛΑΤΤΩΜΑ ΠΟΥ ΚΑΡΦΩΝΕΙ: ο `useFloors3DAggregator` αποφάσιζε «ο όροφος είναι
 * γεμάτος» με `scene.entities.length > 0`. Το `reconcileLoadedSceneBim(Preserving)`
 * (ADR-390 Φ4) πετά το BIM του snapshot στο load και τα per-entity subscriptions που
 * το ξαναγεμίζουν είναι δεμένα στον **ενεργό** όροφο — άρα η in-memory σκηνή ενός
 * ΜΗ-ενεργού ορόφου μπορεί κάλλιστα να είναι **μόνο-DXF**. Με το παλιό κριτήριο αυτή
 * η σκηνή μετρούσε ως «γεμάτη», ο lazy-fetch δεν έτρεχε ΠΟΤΕ, και οι κολώνες του
 * ορόφου έλειπαν από τη σκηνή. Το κριτήριο είναι πλέον «έχει **BIM**;».
 *
 * Mutation check: γύρνα το `hasAnyBim3DEntity(resolveInMemoryBim(t))` σε
 * `(getLevelScene(t.levelId)?.entities.length ?? 0) > 0` → το 1ο test κοκκινίζει
 * (columns 0 αντί 1) ενώ το 2ο μένει πράσινο.
 */

import { renderHook, waitFor } from '@testing-library/react';
import type { SceneModel } from '../../../types/scene';
import type { FloorStackEntry } from '../../../bim-3d/scene/multi-floor-3d-source';

const LVL_GROUND = 'lvl-ground';
const LVL_UPPER = 'lvl-upper';
const FLOOR_GROUND = 'flr-ground';
const FLOOR_UPPER = 'flr-upper';
const UPPER_FILE = 'file-upper';

/** Ό,τι δεν ορίζεται ρητά είναι κενό slice — σταθερό ref ώστε τα useMemo να μη ρίχνουν loop. */
const mockEmptySlice: never[] = [];
const mockBimState = new Proxy({ activeLevelId: LVL_GROUND } as Record<string, unknown>, {
  get: (target, prop) => (prop in target ? target[prop as string] : mockEmptySlice),
});

/** Οι in-memory σκηνές ανά level — το κάθε test τις στήνει στο `beforeEach`. */
const mockLevelScenes: Record<string, SceneModel> = {};
/** Το `.scene.json` που θα γυρίσει το `loadFileV2` για τον πάνω όροφο. */
const mockSnapshotScene: { current: SceneModel | null } = { current: null };
/** Ό,τι δημοσιεύτηκε στο multi-floor SSoT source. */
const mockPublished: FloorStackEntry[][] = [];

jest.mock('@/auth/hooks/useAuth', () => ({
  useAuth: () => ({ user: { companyId: 'comp-1', uid: 'user-1' } }),
}));

jest.mock('../../../systems/levels/useLevels', () => ({
  useLevelsOptional: () => ({
    levels: [
      { id: LVL_GROUND, buildingId: 'bldg-1', floorId: FLOOR_GROUND, sceneFileId: null, projectId: 'proj-1' },
      { id: LVL_UPPER, buildingId: 'bldg-1', floorId: FLOOR_UPPER, sceneFileId: UPPER_FILE, projectId: 'proj-1' },
    ],
    currentLevelId: LVL_GROUND,
    getLevelScene: (levelId: string) => mockLevelScenes[levelId] ?? null,
  }),
}));

jest.mock('@/components/properties/shared/useFloorsByBuilding', () => ({
  useFloorsByBuilding: () => ({
    floors: [
      { id: FLOOR_GROUND, elevation: 0, number: 0, kind: 'ground' },
      { id: FLOOR_UPPER, elevation: 3, number: 1, kind: 'standard' },
    ],
  }),
}));

jest.mock('../../../services/dxf-firestore.service', () => ({
  DxfFirestoreService: {
    loadFileV2: jest.fn(async () => ({ entityType: 'floor', entityId: FLOOR_UPPER, scene: mockSnapshotScene.current })),
  },
}));

jest.mock('../../../systems/levels/cross-floor-link', () => ({
  resolveFloorScopedScene: (rec: { scene: SceneModel | null } | null) => rec?.scene ?? null,
}));

jest.mock('../../../bim-3d/stores/Bim3DEntitiesStore', () => ({
  ...jest.requireActual('../../../bim-3d/stores/Bim3DEntitiesStore'),
  useBim3DEntitiesStore: (selector: (s: unknown) => unknown) => selector(mockBimState),
}));

jest.mock('../../../state/foundation-level-store', () => ({
  useFoundationLevelStore: (selector: (s: unknown) => unknown) =>
    selector({ target: null, entities: mockEmptySlice }),
}));

jest.mock('../../../bim-3d/scene/multi-floor-3d-source', () => ({
  setMultiFloorStack: (stack: FloorStackEntry[]) => { mockPublished.push(stack); },
}));

jest.mock('../../../bim/persistence/bim-floor-scope', () => ({
  resolveBimPersistenceScope: () => null,
}));
jest.mock('../../../bim/persistence/cross-floor-bim-loader', () => ({
  loadFloorBimEntities: jest.fn(async () => []),
}));

import { useFloors3DAggregator } from '../useFloors3DAggregator';

/** Σκηνή με τα δοσμένα entities (τα υπόλοιπα πεδία δεν διαβάζονται σε αυτό το μονοπάτι). */
function sceneOf(entities: unknown[]): SceneModel {
  return { entities, layersById: {}, units: 'mm' } as unknown as SceneModel;
}

const dxfLine = { id: 'ln-1', type: 'line', start: { x: 0, y: 0 }, end: { x: 1, y: 0 } };
const bimColumn = (id: string) => ({ id, type: 'column', params: {} });

/** Η τελευταία δημοσιευμένη εγγραφή του πάνω ορόφου. */
function upperEntry(): FloorStackEntry | undefined {
  return mockPublished.at(-1)?.find((e) => e.levelId === LVL_UPPER);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockPublished.length = 0;
  for (const key of Object.keys(mockLevelScenes)) delete mockLevelScenes[key];
  mockSnapshotScene.current = null;
});

describe('useFloors3DAggregator — πηγή BIM ανά όροφο', () => {
  // ⭐ DISCRIMINATING — αυτό ακριβώς έσπαγε: κάτοψη DXF ⇒ «γεμάτος» ⇒ μηδέν fetch.
  it('φορτώνει το snapshot BIM ορόφου του οποίου η in-memory σκηνή είναι ΜΟΝΟ-DXF', async () => {
    mockLevelScenes[LVL_UPPER] = sceneOf([dxfLine]);
    mockSnapshotScene.current = sceneOf([dxfLine, bimColumn('col-upper')]);

    renderHook(() => useFloors3DAggregator(true));

    await waitFor(() => {
      expect(upperEntry()?.entities.columns).toHaveLength(1);
    });
    expect(upperEntry()?.entities.columns[0]?.id).toBe('col-upper');
  });

  // Η άλλη πλευρά του κανόνα: in-memory BIM = φρεσκότερο, δεν το ακυρώνει το fetch.
  it('προτιμά το in-memory BIM και ΔΕΝ ζητά snapshot όταν ο όροφος έχει ήδη BIM', async () => {
    const { DxfFirestoreService } = jest.requireMock('../../../services/dxf-firestore.service');
    mockLevelScenes[LVL_UPPER] = sceneOf([dxfLine, bimColumn('col-memory')]);
    mockSnapshotScene.current = sceneOf([bimColumn('col-snapshot')]);

    renderHook(() => useFloors3DAggregator(true));

    await waitFor(() => {
      expect(upperEntry()?.entities.columns).toHaveLength(1);
    });
    expect(upperEntry()?.entities.columns[0]?.id).toBe('col-memory');
    expect(DxfFirestoreService.loadFileV2).not.toHaveBeenCalled();
  });

  // Ο one-shot guard: κενό αποτέλεσμα δεν πρέπει να γεννά ατέρμονο re-fetch.
  it('δεν ξαναζητά snapshot όταν ο όροφος όντως δεν έχει BIM πουθενά', async () => {
    const { DxfFirestoreService } = jest.requireMock('../../../services/dxf-firestore.service');
    mockLevelScenes[LVL_UPPER] = sceneOf([dxfLine]);
    mockSnapshotScene.current = sceneOf([dxfLine]);

    renderHook(() => useFloors3DAggregator(true));

    await waitFor(() => {
      expect(DxfFirestoreService.loadFileV2).toHaveBeenCalled();
    });
    expect(DxfFirestoreService.loadFileV2).toHaveBeenCalledTimes(1);
  });
});
