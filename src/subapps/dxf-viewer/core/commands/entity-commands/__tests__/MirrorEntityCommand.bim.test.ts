/**
 * ADR-363 Phase 7.2 — `MirrorEntityCommand` BIM dispatch tests.
 *
 * Verifies that `MirrorEntityCommand` routes BIM entities through
 * `calculateBimMirroredGeometry` (atomic `{params, geometry}` patch) and
 * falls through to `mirrorEntity()` for non-BIM types.
 */
import { MirrorEntityCommand } from '../MirrorEntityCommand';
import type { ISceneManager, SceneEntity } from '../../interfaces';
import type { MirrorAxis } from '../../../../utils/mirror-math';
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
    updateEntity: (id, updates) => {
      const e = scene.get(id);
      if (e) scene.set(id, { ...e, ...(updates as SceneEntity) });
    },
    updateEntities: (updates) => {
      updates.forEach((partial, id) => {
        const e = scene.get(id);
        if (e) scene.set(id, { ...e, ...(partial as SceneEntity) });
      });
    },
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
    id: 'wall_1',
    type: 'wall',
    kind: 'straight',
    layerId: 'L',
    params: {
      category: 'exterior',
      start: { x: 100, y: 0, z: 0 },
      end: { x: 500, y: 0, z: 0 },
      height: 3000,
      thickness: 250,
      flip: false,
    },
    geometry: { bbox: { min: { x: 100, y: -125 }, max: { x: 500, y: 125 } } },
    validation: { hasCodeViolations: false, violationKeys: [], lastValidatedAt: null },
  } as unknown as WallEntity;
}

const Y_AXIS: MirrorAxis = { p1: { x: 0, y: 0 }, p2: { x: 0, y: 1 } };

describe('MirrorEntityCommand — ADR-363 Phase 7.2 BIM dispatch', () => {
  it('reflects BIM wall params.start + params.end across the axis', () => {
    const wall = makeWall();
    const { scene, sm } = makeMockScene([wall as unknown as SceneEntity]);
    const cmd = new MirrorEntityCommand([wall.id], Y_AXIS, false, sm);
    cmd.execute();
    const after = scene.get(wall.id) as unknown as WallEntity;
    expect(after.params.start).toEqual({ x: -100, y: 0, z: 0 });
    expect(after.params.end).toEqual({ x: -500, y: 0, z: 0 });
    // Geometry was recomputed (bbox now in negative X range).
    expect(after.geometry.bbox.min.x).toBeLessThanOrEqual(-100);
  });

  it('undo restores the original BIM wall params', () => {
    const wall = makeWall();
    const { scene, sm } = makeMockScene([wall as unknown as SceneEntity]);
    const cmd = new MirrorEntityCommand([wall.id], Y_AXIS, false, sm);
    cmd.execute();
    cmd.undo();
    const after = scene.get(wall.id) as unknown as WallEntity;
    expect(after.params.start.x).toBe(100);
    expect(after.params.end.x).toBe(500);
  });

  it('redo re-applies the mirror', () => {
    const wall = makeWall();
    const { scene, sm } = makeMockScene([wall as unknown as SceneEntity]);
    const cmd = new MirrorEntityCommand([wall.id], Y_AXIS, false, sm);
    cmd.execute();
    cmd.undo();
    cmd.redo();
    const after = scene.get(wall.id) as unknown as WallEntity;
    expect(after.params.start.x).toBe(-100);
    expect(after.params.end.x).toBe(-500);
  });

  it('keepOriginals=true clones the wall with mirrored params (scene gets 2 entities)', () => {
    const wall = makeWall();
    const { scene, sm } = makeMockScene([wall as unknown as SceneEntity]);
    const cmd = new MirrorEntityCommand([wall.id], Y_AXIS, true, sm);
    cmd.execute();
    expect(scene.size).toBe(2);
    const orig = scene.get(wall.id) as unknown as WallEntity;
    // Original preserved.
    expect(orig.params.start.x).toBe(100);
    // Clone is the other entity with mirrored params.
    const cloneId = [...scene.keys()].find((id) => id !== wall.id);
    expect(cloneId).toBeDefined();
    const clone = scene.get(cloneId!) as unknown as WallEntity;
    expect(clone.params.start.x).toBe(-100);
  });

  it('falls through to generic mirror for non-BIM entities (line)', () => {
    const line: SceneEntity = {
      id: 'line_1',
      type: 'line',
      start: { x: 100, y: 200 },
      end: { x: 300, y: 400 },
    } as unknown as SceneEntity;
    const { scene, sm } = makeMockScene([line]);
    const cmd = new MirrorEntityCommand([line.id], Y_AXIS, false, sm);
    cmd.execute();
    const after = scene.get(line.id) as unknown as { start: { x: number; y: number }; end: { x: number; y: number } };
    expect(after.start.x).toBe(-100);
    expect(after.end.x).toBe(-300);
    expect(after.start.y).toBe(200);
  });
});
