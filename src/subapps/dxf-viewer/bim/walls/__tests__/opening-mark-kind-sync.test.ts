/**
 * ADR-363 §5.4 — `syncMarkToKindAndPatchScene` unit tests.
 *
 * On a kind change, an AUTO mark re-aligns to the new kind's prefix (Θ→Π) and
 * pulls the next free sequence from the SSoT `OpeningMarkService`. Manual marks
 * (or already-correct prefixes) are left untouched.
 */

const mockGetDoc = jest.fn();
jest.mock('firebase/firestore', () => ({
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  doc: jest.fn((..._a: unknown[]) => ({ __kind: 'doc' })),
  getDocs: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  collection: jest.fn(),
}));
jest.mock('@/lib/firebase', () => ({ db: {} }));
jest.mock('@/config/firestore-collections', () => ({
  COLLECTIONS: { FLOORS: 'floors', FLOORPLAN_OPENINGS: 'floorplan_openings' },
}));

import { syncMarkToKindAndPatchScene } from '../opening-mark-allocator';
import {
  __setOpeningMarkServiceForTests,
  type OpeningMarkService,
} from '../../services/opening-mark-service';
import type { OpeningEntity, OpeningParams } from '../../types/opening-types';
import type { SceneModel } from '../../../types/entities';

const PREFIX: Record<string, string> = {
  'opening.tag.prefix.door': 'Θ',
  'opening.tag.prefix.window': 'Π',
  'opening.tag.basementPrefix': 'Υ',
};
const t = (k: string): string => PREFIX[k] ?? k;

function makeOpening(params: Partial<OpeningParams>): OpeningEntity {
  const full: OpeningParams = {
    kind: 'window', wallId: 'wall_1', offsetFromStart: 500,
    width: 1200, height: 1400, sillHeight: 900, ...params,
  };
  return {
    id: 'opening_x', type: 'opening', kind: full.kind, layerId: '0',
    params: full, geometry: undefined, validation: { hasCodeViolations: false } as never,
    ifcType: 'IfcWindow',
  } as unknown as OpeningEntity;
}

function makeDeps(entity: OpeningEntity, allocateMark: OpeningMarkService['allocateMark']) {
  __setOpeningMarkServiceForTests({ allocateMark });
  let saved: SceneModel | null = { entities: [entity] } as unknown as SceneModel;
  const levelManager = {
    currentLevelId: 'lvl_1',
    levels: [{ id: 'lvl_1', floorId: 'floor_1' }] as never,
    getLevelScene: () => saved,
    setLevelScene: (_id: string, s: SceneModel) => { saved = s; },
  };
  return {
    deps: { companyId: 'c', projectId: 'p', floorplanId: 'fp', levelManager, t },
    getSaved: () => saved,
  };
}

beforeEach(() => {
  mockGetDoc.mockReset();
  __setOpeningMarkServiceForTests(null);
});

describe('syncMarkToKindAndPatchScene (ADR-363 §5.4)', () => {
  it('1. auto mark, kind changed (door→window) → re-allocates Π prefix', async () => {
    mockGetDoc.mockResolvedValue({ data: () => ({ number: 1 }) });
    const alloc = jest.fn().mockResolvedValue('Π.101');
    const entity = makeOpening({ kind: 'window', mark: 'Θ.101' }); // stale door mark
    const { deps, getSaved } = makeDeps(entity, alloc);

    const result = await syncMarkToKindAndPatchScene(entity, deps);

    expect(alloc).toHaveBeenCalledTimes(1);
    expect(alloc.mock.calls[0][0]).toMatchObject({ kind: 'window', kindPrefix: 'Π' });
    expect(result.params.mark).toBe('Π.101');
    // Scene patched optimistically with the new mark.
    const patched = (getSaved()!.entities[0] as OpeningEntity);
    expect(patched.params.mark).toBe('Π.101');
  });

  it('2. manual mark → untouched, no allocation', async () => {
    const alloc = jest.fn();
    const entity = makeOpening({ kind: 'window', mark: 'Θ.101', markIsManual: true });
    const { deps } = makeDeps(entity, alloc);

    const result = await syncMarkToKindAndPatchScene(entity, deps);

    expect(alloc).not.toHaveBeenCalled();
    expect(result.params.mark).toBe('Θ.101');
  });

  it('3. prefix already matches kind → no-op', async () => {
    const alloc = jest.fn();
    const entity = makeOpening({ kind: 'window', mark: 'Π.105' });
    const { deps } = makeDeps(entity, alloc);

    const result = await syncMarkToKindAndPatchScene(entity, deps);

    expect(alloc).not.toHaveBeenCalled();
    expect(result.params.mark).toBe('Π.105');
  });

  it('4. no mark yet → no-op (placement allocator owns first allocation)', async () => {
    const alloc = jest.fn();
    const entity = makeOpening({ kind: 'window' });
    const { deps } = makeDeps(entity, alloc);

    const result = await syncMarkToKindAndPatchScene(entity, deps);

    expect(alloc).not.toHaveBeenCalled();
    expect(result.params.mark).toBeUndefined();
  });
});
