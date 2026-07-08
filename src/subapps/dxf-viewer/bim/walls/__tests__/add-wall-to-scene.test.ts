/**
 * ADR-363 Phase 1G.4 — `addWallToScene` SSoT + `commitWallCopy` (Ctrl-copy).
 *
 * Coverage:
 *   - addWallToScene: appends wall, recomputes (no-op) trims, persists scene,
 *     broadcasts `drawing:entity-created` (tool 'wall') with the inserted entity;
 *     no-op guards (null level / null scene).
 *   - commitWallCopy: builds a NEW wall (fresh ID) with params translated by the
 *     move delta, leaves the original untouched, persists 2 walls + broadcasts;
 *     no-op for non-midpoint grips / missing entity.
 */
import { addWallToScene } from '../add-wall-to-scene';
import { commitWallCopy } from '../../../hooks/grips/grip-parametric-commits';
import { buildDefaultWallParams, buildWallEntity } from '../../../hooks/drawing/wall-completion';
import { EventBus } from '../../../systems/events/EventBus';
import type { SceneModel } from '../../../types/scene';
import type { WallEntity } from '../../types/wall-types';
import type { UnifiedGripInfo, DxfCommitDeps } from '../../../hooks/grips/unified-grip-types';

function makeWall(start: { x: number; y: number }, end: { x: number; y: number }, layerId = 'lyr_a'): WallEntity {
  const r = buildWallEntity(buildDefaultWallParams(start, end), layerId, 'straight', 'mm');
  if (!r.ok) throw new Error(`fixture wall invalid: ${r.hardErrors.join(',')}`);
  return r.entity;
}

function makeDeps(scene: { current: SceneModel | null }, levelId: string | null = 'lvl1'): DxfCommitDeps {
  return {
    currentLevelId: levelId,
    getLevelScene: (id) => (id === 'lvl1' ? scene.current : null),
    setLevelScene: (_id, s) => { scene.current = s; },
    execute: () => {},
    moveEntities: () => {},
    onToolChange: () => {},
  };
}

describe('addWallToScene', () => {
  it('appends the wall, persists the scene, and broadcasts drawing:entity-created', () => {
    const wall = makeWall({ x: 0, y: 0 }, { x: 1000, y: 0 });
    const scene = { current: { entities: [] } as unknown as SceneModel };
    const events: Array<{ id: string; tool: string }> = [];
    const off = EventBus.on('drawing:entity-created', (p) => events.push({ id: p.entity.id, tool: p.tool }));

    addWallToScene(wall, makeDeps(scene));

    expect(scene.current?.entities.map((e) => e.id)).toContain(wall.id);
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ id: wall.id, tool: 'wall' });
    off();
  });

  it('no-op when there is no active level', () => {
    const wall = makeWall({ x: 0, y: 0 }, { x: 1000, y: 0 });
    const scene = { current: { entities: [] } as unknown as SceneModel };
    let fired = 0;
    const off = EventBus.on('drawing:entity-created', () => { fired += 1; });

    addWallToScene(wall, makeDeps(scene, null));

    expect(scene.current?.entities).toHaveLength(0);
    expect(fired).toBe(0);
    off();
  });

  it('no-op when the active level has no scene', () => {
    const wall = makeWall({ x: 0, y: 0 }, { x: 1000, y: 0 });
    const scene = { current: null as SceneModel | null };
    let fired = 0;
    const off = EventBus.on('drawing:entity-created', () => { fired += 1; });

    addWallToScene(wall, makeDeps(scene));

    expect(scene.current).toBeNull();
    expect(fired).toBe(0);
    off();
  });
});

describe('commitWallCopy', () => {
  function midpointGrip(entityId: string): UnifiedGripInfo {
    return {
      id: `dxf_${entityId}_2`, source: 'dxf', gripIndex: 2, type: 'vertex',
      position: { x: 500, y: 0 }, movesEntity: true,
      entityId, gripKind: { on: 'wall', kind: 'wall-midpoint' },
    };
  }

  it('inserts a NEW wall translated by delta, leaving the original untouched', () => {
    const original = makeWall({ x: 0, y: 0 }, { x: 1000, y: 0 });
    const scene = { current: { entities: [original] } as unknown as SceneModel };
    const created: WallEntity[] = [];
    const off = EventBus.on('drawing:entity-created', (p) => created.push(p.entity as WallEntity));

    commitWallCopy(midpointGrip(original.id), { x: 0, y: 300 }, makeDeps(scene));

    const ids = scene.current!.entities.map((e) => e.id);
    expect(ids).toHaveLength(2);
    expect(ids).toContain(original.id);

    const copy = scene.current!.entities.find((e) => e.id !== original.id) as WallEntity;
    expect(copy.id).toMatch(/^wall_/);
    expect(copy.id).not.toBe(original.id);
    // Translated whole-wall by +300 in Y.
    expect(copy.params.start.y).toBeCloseTo(300, 6);
    expect(copy.params.end.y).toBeCloseTo(300, 6);
    expect(copy.layerId).toBe(original.layerId);

    // Original unchanged.
    const stillOriginal = scene.current!.entities.find((e) => e.id === original.id) as WallEntity;
    expect(stillOriginal.params.start.y).toBeCloseTo(0, 6);

    expect(created).toHaveLength(1);
    expect(created[0].id).toBe(copy.id);
    off();
  });

  it('no-op for a non-midpoint grip kind', () => {
    const original = makeWall({ x: 0, y: 0 }, { x: 1000, y: 0 });
    const scene = { current: { entities: [original] } as unknown as SceneModel };
    const grip = { ...midpointGrip(original.id), gripKind: { on: 'wall', kind: 'wall-start' } as const };

    commitWallCopy(grip, { x: 0, y: 300 }, makeDeps(scene));

    expect(scene.current!.entities).toHaveLength(1);
  });

  it('no-op when the target entity is missing from the scene', () => {
    const scene = { current: { entities: [] } as unknown as SceneModel };
    commitWallCopy(midpointGrip('wall_missing'), { x: 0, y: 300 }, makeDeps(scene));
    expect(scene.current!.entities).toHaveLength(0);
  });
});
