/**
 * ADR-408 Φ-C / ADR-507 §8 — SnapshotTransformCommand self-cascades its associative
 * FOLLOWERS (connected pipes + a slab's slab-openings) inside execute/undo/redo for
 * EVERY transform (rotate/scale/mirror), so 2D + 3D gestures both follow.
 *
 * Verifies the WIRING the spine owns: it feeds the SAME `computeUpdates` to both
 * transform-agnostic engines (pipe-follow gets the extracted NEW params; slab-opening
 * gets the full patch), threads their moved followers into the single reframe/emit, and
 * restores them from snapshot on undo. The engines + the reframe/emit + wall-opening SSoTs
 * are mocked — they have their own suites; here we assert orchestration only.
 */

import type { ICommand, ISceneManager, SceneEntity, SerializedCommand } from '../../interfaces';
import { createMockSceneManager } from '../../__tests__/mock-scene-manager';

jest.mock('../../../../bim/mep-segments/cascade-connected-pipes', () => ({
  cascadeConnectedPipes: jest.fn(() => ({ moved: [], snapshots: [] })),
  nextParamsFromTransformPatch: (patch: unknown) =>
    patch && typeof patch === 'object' && 'params' in (patch as object)
      ? (patch as { params?: unknown }).params ?? null
      : null,
}));
jest.mock('../../../../bim/cascade/cascade-transformed-slab-openings', () => ({
  cascadeTransformedSlabOpenings: jest.fn(() => ({ moved: [], snapshots: [] })),
}));
// ADR-540 — the scene-derived reconcile (openings + beam-reframe + single emit) is now ONE SSoT.
jest.mock('../../../../bim/cascade/associative-geometry-reconcile', () => ({
  reconcileAssociativeGeometry: jest.fn(),
}));
jest.mock('../../../../bim/beams/beam-column-reframe-cascade', () => ({
  emitRestoredEntities: jest.fn(),
}));

import { SnapshotTransformCommand } from '../SnapshotTransformCommand';
import { cascadeConnectedPipes } from '../../../../bim/mep-segments/cascade-connected-pipes';
import { cascadeTransformedSlabOpenings } from '../../../../bim/cascade/cascade-transformed-slab-openings';
import { reconcileAssociativeGeometry } from '../../../../bim/cascade/associative-geometry-reconcile';
import { emitRestoredEntities } from '../../../../bim/beams/beam-column-reframe-cascade';

const mockPipes = cascadeConnectedPipes as jest.Mock;
const mockSlab = cascadeTransformedSlabOpenings as jest.Mock;
const mockReconcile = reconcileAssociativeGeometry as jest.Mock;
const mockEmitRestored = emitRestoredEntities as jest.Mock;

function makeScene(initial: SceneEntity[]): {
  scene: Map<string, SceneEntity>;
  sm: ISceneManager;
} {
  const sm = createMockSceneManager(initial, { getEntityIndex: () => -1 });
  return { scene: sm.store, sm };
}

const host = (id: string, x: number): SceneEntity =>
  ({ id, type: 'mep-manifold', layer: 'L0', visible: true, params: { x } } as unknown as SceneEntity);

/** Shifts `params.x` by `dx` — a stand-in MEP-host transform (snapshot-restore undo). */
class ShiftMep extends SnapshotTransformCommand {
  readonly name = 'ShiftMep';
  readonly type = 'test-shift-mep';
  constructor(entityIds: string[], private readonly dx: number, sm: ISceneManager) {
    super(entityIds, sm);
  }
  protected computeUpdates(entity: SceneEntity): Partial<SceneEntity> {
    const x = (entity as unknown as { params?: { x?: number } }).params?.x ?? 0;
    return { params: { x: x + this.dx } } as unknown as Partial<SceneEntity>;
  }
  getDescription(): string { return `ShiftMep ${this.dx}`; }
  serialize(): SerializedCommand {
    return { type: this.type, id: this.id, name: this.name, timestamp: this.timestamp, data: this.baseTransformData(), version: 1 };
  }
}

beforeEach(() => {
  mockPipes.mockReset().mockReturnValue({ moved: [], snapshots: [] });
  mockSlab.mockReset().mockReturnValue({ moved: [], snapshots: [] });
  mockReconcile.mockReset();
  mockEmitRestored.mockReset();
});

describe('SnapshotTransformCommand — follower self-cascade', () => {
  it('feeds the same computeUpdates to both follower engines', () => {
    const { sm } = makeScene([host('h', 0)]);
    new ShiftMep(['h'], 5, sm).execute();

    expect(mockPipes).toHaveBeenCalledTimes(1);
    expect(mockSlab).toHaveBeenCalledTimes(1);

    const [pipeIds, , pipeCb] = mockPipes.mock.calls[0];
    expect(pipeIds).toEqual(['h']);
    // The pipe-follow callback returns the NEW params (extracted from the transform patch).
    expect((pipeCb as (e: SceneEntity) => unknown)(host('h', 0))).toEqual({ x: 5 });

    const [slabIds, , slabCb] = mockSlab.mock.calls[0];
    expect(slabIds).toEqual(['h']);
    // The slab-opening callback returns the FULL transform patch.
    expect((slabCb as (e: SceneEntity) => unknown)(host('h', 0))).toEqual({ params: { x: 5 } });
  });

  it('threads the moved followers into the single reconcile announce', () => {
    const pipeMoved = { id: 'p1', type: 'mep-segment' } as unknown as SceneEntity;
    const openMoved = { id: 'o1', type: 'slab-opening' } as unknown as SceneEntity;
    mockPipes.mockReturnValue({ moved: [pipeMoved], snapshots: [] });
    mockSlab.mockReturnValue({ moved: [openMoved], snapshots: [] });
    const { sm } = makeScene([host('h', 0)]);

    new ShiftMep(['h'], 5, sm).execute();

    // ADR-540 — reconcile is called (entityIds, sm, { announceEntities }); the followers ride in announce.
    const [, , opts] = mockReconcile.mock.calls[0] as [string[], ISceneManager, { announceEntities: SceneEntity[] }];
    expect(opts.announceEntities.map((e) => e.id)).toEqual(expect.arrayContaining(['h', 'p1', 'o1']));
  });

  it('undo restores followers from snapshot and emits them first', () => {
    const pipeSnap = {
      id: 'p1', type: 'mep-segment', layer: 'L0', visible: true, params: { orig: true },
    } as unknown as SceneEntity;
    mockPipes.mockReturnValue({ moved: [{ id: 'p1' } as SceneEntity], snapshots: [pipeSnap] });
    // The live pipe starts at the post-transform pose (orig:false); undo must restore orig:true.
    const liveP1 = { ...(pipeSnap as unknown as object), params: { orig: false } } as unknown as SceneEntity;
    const { scene, sm } = makeScene([host('h', 0), liveP1]);

    const cmd = new ShiftMep(['h'], 5, sm);
    cmd.execute();
    cmd.undo();

    const lastEmit = mockEmitRestored.mock.calls.at(-1)?.[0] as SceneEntity[];
    expect(lastEmit.map((e) => e.id)).toEqual(expect.arrayContaining(['h', 'p1']));
    expect((scene.get('p1') as unknown as { params: { orig: boolean } }).params.orig).toBe(true);
  });

  it('redo re-runs the follower cascades', () => {
    const { sm } = makeScene([host('h', 0)]);
    const cmd = new ShiftMep(['h'], 5, sm);
    cmd.execute();
    cmd.undo();
    mockPipes.mockClear();
    mockSlab.mockClear();
    cmd.redo();
    expect(mockPipes).toHaveBeenCalledTimes(1);
    expect(mockSlab).toHaveBeenCalledTimes(1);
  });
});
