/**
 * ADR-363 Phase 7.2 — `RotateEntityCommand` BIM dispatch tests.
 *
 * Verifies that `RotateEntityCommand` routes BIM entities through
 * `calculateBimRotatedGeometry` (atomic `{params, geometry}` patch) and
 * falls through to `rotateEntity()` for non-BIM types.
 */
import { RotateEntityCommand } from '../RotateEntityCommand';
import type { SceneEntity } from '../../interfaces';
import type { WallEntity } from '../../../../bim/types/wall-types';
import type { ColumnEntity } from '../../../../bim/types/column-types';
import { createMockSceneManager } from '../../__tests__/mock-scene-manager';

function makeMockScene(initial: SceneEntity[] = []): {
  scene: Map<string, SceneEntity>;
  sm: ReturnType<typeof createMockSceneManager>;
} {
  const sm = createMockSceneManager(initial, { getEntityIndex: () => -1 });
  return { scene: sm.store, sm };
}

function makeWall(): WallEntity {
  return {
    id: 'wall_1',
    type: 'wall',
    kind: 'straight',
    layerId: 'L',
    params: {
      category: 'exterior',
      start: { x: 1000, y: 0, z: 0 },
      end: { x: 5000, y: 0, z: 0 },
      height: 3000,
      thickness: 250,
      flip: false,
    },
    geometry: { bbox: { min: { x: 1000, y: -125 }, max: { x: 5000, y: 125 } } },
    validation: { hasCodeViolations: false, violationKeys: [], lastValidatedAt: null },
  } as unknown as WallEntity;
}

function makeColumn(): ColumnEntity {
  return {
    id: 'col_1',
    type: 'column',
    kind: 'rectangular',
    layerId: 'L',
    params: {
      kind: 'rectangular',
      position: { x: 1000, y: 0, z: 0 },
      anchor: 'center',
      width: 400,
      depth: 400,
      height: 3000,
      rotation: 30,
    },
    geometry: { bbox: { min: { x: 800, y: -200 }, max: { x: 1200, y: 200 } } },
    validation: { hasCodeViolations: false, violationKeys: [], lastValidatedAt: null },
  } as unknown as ColumnEntity;
}

describe('RotateEntityCommand — ADR-363 Phase 7.2 BIM dispatch', () => {
  it('rotates BIM wall start + end around pivot by 90°', () => {
    const wall = makeWall();
    const { scene, sm } = makeMockScene([wall as unknown as SceneEntity]);
    const cmd = new RotateEntityCommand([wall.id], { x: 0, y: 0 }, 90, sm);
    cmd.execute();
    const after = scene.get(wall.id) as unknown as WallEntity;
    expect(after.params.start.x).toBeCloseTo(0, 4);
    expect(after.params.start.y).toBeCloseTo(1000, 4);
    expect(after.params.end.x).toBeCloseTo(0, 4);
    expect(after.params.end.y).toBeCloseTo(5000, 4);
  });

  it('column: position rotates around pivot AND rotation accumulates', () => {
    const col = makeColumn();
    const { scene, sm } = makeMockScene([col as unknown as SceneEntity]);
    const cmd = new RotateEntityCommand([col.id], { x: 0, y: 0 }, 60, sm);
    cmd.execute();
    const after = scene.get(col.id) as unknown as ColumnEntity;
    // position (1000, 0) rotated 60° CCW: (500, 866).
    expect(after.params.position.x).toBeCloseTo(500, 0);
    expect(after.params.position.y).toBeCloseTo(866, 0);
    // rotation 30° + 60° = 90°.
    expect(after.params.rotation).toBeCloseTo(90, 4);
  });

  it('undo restores the original BIM column params', () => {
    const col = makeColumn();
    const { scene, sm } = makeMockScene([col as unknown as SceneEntity]);
    const cmd = new RotateEntityCommand([col.id], { x: 0, y: 0 }, 60, sm);
    cmd.execute();
    cmd.undo();
    const after = scene.get(col.id) as unknown as ColumnEntity;
    expect(after.params.position.x).toBe(1000);
    expect(after.params.position.y).toBe(0);
    expect(after.params.rotation).toBe(30);
  });

  it('group rotation around common pivot (two walls)', () => {
    const w1 = makeWall();
    const w2: WallEntity = { ...makeWall(), id: 'wall_2' };
    const { scene, sm } = makeMockScene([w1 as unknown as SceneEntity, w2 as unknown as SceneEntity]);
    const cmd = new RotateEntityCommand([w1.id, w2.id], { x: 0, y: 0 }, 90, sm);
    cmd.execute();
    const a1 = scene.get(w1.id) as unknown as WallEntity;
    const a2 = scene.get(w2.id) as unknown as WallEntity;
    expect(a1.params.start.x).toBeCloseTo(0, 4);
    expect(a2.params.start.x).toBeCloseTo(0, 4);
    expect(a1.params.start.y).toBeCloseTo(1000, 4);
    expect(a2.params.start.y).toBeCloseTo(1000, 4);
  });

  it('falls through to generic rotate for non-BIM entities (line)', () => {
    const line: SceneEntity = {
      id: 'line_1',
      type: 'line',
      start: { x: 1000, y: 0 },
      end: { x: 2000, y: 0 },
    } as unknown as SceneEntity;
    const { scene, sm } = makeMockScene([line]);
    const cmd = new RotateEntityCommand([line.id], { x: 0, y: 0 }, 90, sm);
    cmd.execute();
    const after = scene.get(line.id) as unknown as { start: { x: number; y: number }; end: { x: number; y: number } };
    expect(after.start.x).toBeCloseTo(0, 4);
    expect(after.start.y).toBeCloseTo(1000, 4);
    expect(after.end.x).toBeCloseTo(0, 4);
    expect(after.end.y).toBeCloseTo(2000, 4);
  });
});
