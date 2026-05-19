/**
 * ADR-363 Phase 7.2 — `BimCopyCommand` undo/redo round-trip tests.
 */
import { BimCopyCommand } from '../BimCopyCommand';
import type { ISceneManager, SceneEntity } from '../../interfaces';
import type { WallEntity } from '../../../../bim/types/wall-types';

function makeMockScene(initial: SceneEntity[] = []): {
  scene: Map<string, SceneEntity>;
  sm: ISceneManager;
} {
  const scene = new Map<string, SceneEntity>(initial.map((e) => [e.id, e]));
  const sm: ISceneManager = {
    getEntity: (id) => scene.get(id),
    addEntity: (e) => { scene.set(e.id, e); },
    removeEntity: (id) => { scene.delete(id); },
    updateEntity: () => {},
    updateEntities: () => {},
    getVertices: () => undefined,
    insertVertex: () => {},
    removeVertex: () => {},
    updateVertex: () => {},
    getEntityIndex: () => -1,
    reorderEntity: () => {},
    moveEntityToIndex: () => {},
  };
  return { scene, sm };
}

function makeWall(): WallEntity {
  return {
    id: 'wall_src',
    type: 'wall',
    kind: 'straight',
    layerId: 'L',
    params: {
      category: 'exterior',
      start: { x: 0, y: 0, z: 0 },
      end: { x: 4000, y: 0, z: 0 },
      height: 3000,
      thickness: 250,
      flip: false,
    },
    geometry: { bbox: { min: { x: 0, y: -125 }, max: { x: 4000, y: 125 } } },
    validation: { hasCodeViolations: false, violationKeys: [], lastValidatedAt: null },
  } as unknown as WallEntity;
}

describe('BimCopyCommand — ADR-363 Phase 7.2', () => {
  it('execute adds clone with translated params to the scene', () => {
    const wall = makeWall();
    const { scene, sm } = makeMockScene([wall as unknown as SceneEntity]);
    const cmd = new BimCopyCommand(
      [wall.id],
      { kind: 'translate', delta: { x: 500, y: 0 } },
      sm,
    );
    cmd.execute();
    expect(scene.size).toBe(2);
    const cloneId = cmd.getAffectedEntityIds()[0];
    const clone = scene.get(cloneId) as unknown as WallEntity;
    expect(clone.params.start.x).toBe(500);
    expect(clone.params.end.x).toBe(4500);
  });

  it('undo removes the clone from the scene', () => {
    const wall = makeWall();
    const { scene, sm } = makeMockScene([wall as unknown as SceneEntity]);
    const cmd = new BimCopyCommand(
      [wall.id],
      { kind: 'translate', delta: { x: 500, y: 0 } },
      sm,
    );
    cmd.execute();
    cmd.undo();
    expect(scene.size).toBe(1);
    expect(scene.get(wall.id)).toBeDefined();
  });

  it('redo replays the clone snapshot deterministically', () => {
    const wall = makeWall();
    const { scene, sm } = makeMockScene([wall as unknown as SceneEntity]);
    const cmd = new BimCopyCommand(
      [wall.id],
      { kind: 'mirror', axis: { p1: { x: 0, y: 0 }, p2: { x: 0, y: 1 } } },
      sm,
    );
    cmd.execute();
    const cloneIdAfterExecute = cmd.getAffectedEntityIds()[0];
    cmd.undo();
    cmd.redo();
    const cloneIdAfterRedo = cmd.getAffectedEntityIds()[0];
    expect(cloneIdAfterRedo).toBe(cloneIdAfterExecute);
    expect(scene.size).toBe(2);
    const clone = scene.get(cloneIdAfterRedo) as unknown as WallEntity;
    expect(clone.params.end.x).toBe(-4000);
  });

  it('validate rejects empty source list', () => {
    const { sm } = makeMockScene([]);
    const cmd = new BimCopyCommand([], { kind: 'translate', delta: { x: 1, y: 1 } }, sm);
    expect(cmd.validate()).toBe('At least one source entity is required');
  });

  it('getDescription scales with clone count', () => {
    const wall = makeWall();
    const { sm } = makeMockScene([wall as unknown as SceneEntity]);
    const cmd = new BimCopyCommand(
      [wall.id],
      { kind: 'translate', delta: { x: 1, y: 1 } },
      sm,
    );
    cmd.execute();
    expect(cmd.getDescription()).toBe('Copy BIM entity');
  });

  it('serialize includes sourceIds + transform + createdEntityIds', () => {
    const wall = makeWall();
    const { sm } = makeMockScene([wall as unknown as SceneEntity]);
    const cmd = new BimCopyCommand(
      [wall.id],
      { kind: 'translate', delta: { x: 100, y: 0 } },
      sm,
    );
    cmd.execute();
    const s = cmd.serialize();
    expect(s.type).toBe('bim-copy-entities');
    expect(s.data.sourceIds).toEqual([wall.id]);
    expect((s.data.transform as { kind: string }).kind).toBe('translate');
    expect((s.data.createdEntityIds as string[]).length).toBe(1);
  });
});
