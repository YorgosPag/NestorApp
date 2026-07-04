/**
 * ADR-397 — `addColumnToScene` SSoT + `commitColumnCopy` (Ctrl-copy) +
 * `commitHotGripCopy` dispatch.
 *
 * Coverage:
 *   - addColumnToScene: appends column, persists scene, broadcasts
 *     `drawing:entity-created` (tool 'column'); no-op guards (null level / scene).
 *   - commitColumnCopy: builds a NEW column (fresh ID) translated by the move
 *     delta, original untouched, persists 2 columns + broadcasts; no-op for
 *     non-center grips / missing entity.
 *   - commitHotGripCopy: routes column-center → copy (true), unknown kind → false.
 */
import { addColumnToScene } from '../add-column-to-scene';
import {
  commitColumnCopy,
  commitHotGripCopy,
} from '../../../hooks/grips/grip-parametric-commits';
import { buildDefaultColumnParams } from '../../../hooks/drawing/column-completion';
import { buildColumnEntity } from '../../../hooks/drawing/column-completion';
import { EventBus } from '../../../systems/events/EventBus';
import type { SceneModel } from '../../../types/scene';
import type { ColumnEntity } from '../../types/column-types';
import type { UnifiedGripInfo, DxfCommitDeps } from '../../../hooks/grips/unified-grip-types';

function makeColumn(pos: { x: number; y: number }, layerId = 'lyr_a'): ColumnEntity {
  const r = buildColumnEntity(buildDefaultColumnParams(pos, 'rectangular'), layerId, 'mm');
  if (!r.ok) throw new Error(`fixture column invalid: ${r.hardErrors.join(',')}`);
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

function centerGrip(entityId: string, pos = { x: 0, y: 0 }): UnifiedGripInfo {
  return {
    id: `dxf_${entityId}_0`, source: 'dxf', gripIndex: 0, type: 'center',
    position: pos, movesEntity: true,
    entityId, columnGripKind: 'column-center',
  };
}

describe('addColumnToScene', () => {
  it('appends the column, persists the scene, broadcasts drawing:entity-created', async () => {
    const col = makeColumn({ x: 0, y: 0 });
    const scene = { current: { entities: [] } as unknown as SceneModel };
    const events: Array<{ id: string; tool: string }> = [];
    const off = EventBus.on('drawing:entity-created', (p) => events.push({ id: p.entity.id, tool: p.tool }));

    addColumnToScene(col, makeDeps(scene));

    // Scene mutation is synchronous (CreateBimEntityCommand.execute → adapter.addEntity).
    expect(scene.current?.entities.map((e) => e.id)).toContain(col.id);
    // ADR-390 — the persistence broadcast now fires in a microtask (deferred so it
    // runs after CommandHistory.execute pushes the command → reaction grouping is safe).
    await Promise.resolve();
    expect(events).toEqual([{ id: col.id, tool: 'column' }]);
    off();
  });

  it('no-op when there is no active level', () => {
    const col = makeColumn({ x: 0, y: 0 });
    const scene = { current: { entities: [] } as unknown as SceneModel };
    let fired = 0;
    const off = EventBus.on('drawing:entity-created', () => { fired += 1; });

    addColumnToScene(col, makeDeps(scene, null));

    expect(scene.current?.entities).toHaveLength(0);
    expect(fired).toBe(0);
    off();
  });

  it('no-op when the active level has no scene', () => {
    const col = makeColumn({ x: 0, y: 0 });
    const scene = { current: null as SceneModel | null };
    let fired = 0;
    const off = EventBus.on('drawing:entity-created', () => { fired += 1; });

    addColumnToScene(col, makeDeps(scene));

    expect(scene.current).toBeNull();
    expect(fired).toBe(0);
    off();
  });
});

describe('commitColumnCopy', () => {
  it('inserts a NEW column translated by delta, original untouched', async () => {
    const original = makeColumn({ x: 0, y: 0 });
    const scene = { current: { entities: [original] } as unknown as SceneModel };
    const created: ColumnEntity[] = [];
    const off = EventBus.on('drawing:entity-created', (p) => created.push(p.entity as ColumnEntity));

    commitColumnCopy(centerGrip(original.id), { x: 250, y: 400 }, makeDeps(scene));

    const ids = scene.current!.entities.map((e) => e.id);
    expect(ids).toHaveLength(2);
    expect(ids).toContain(original.id);

    const copy = scene.current!.entities.find((e) => e.id !== original.id) as ColumnEntity;
    expect(copy.id).toMatch(/^col/);
    expect(copy.id).not.toBe(original.id);
    // Whole-column translate by (+250, +400).
    expect(copy.params.position.x).toBeCloseTo(original.params.position.x + 250, 6);
    expect(copy.params.position.y).toBeCloseTo(original.params.position.y + 400, 6);
    expect(copy.layerId).toBe(original.layerId);

    // Original unchanged.
    const stillOriginal = scene.current!.entities.find((e) => e.id === original.id) as ColumnEntity;
    expect(stillOriginal.params.position.x).toBeCloseTo(0, 6);

    // ADR-390 — broadcast deferred to a microtask (CreateBimEntityCommand).
    await Promise.resolve();
    expect(created).toHaveLength(1);
    expect(created[0].id).toBe(copy.id);
    off();
  });

  it('no-op for a non-center grip kind', () => {
    const original = makeColumn({ x: 0, y: 0 });
    const scene = { current: { entities: [original] } as unknown as SceneModel };
    const grip = { ...centerGrip(original.id), columnGripKind: 'column-rotation' as const };

    commitColumnCopy(grip, { x: 250, y: 0 }, makeDeps(scene));

    expect(scene.current!.entities).toHaveLength(1);
  });

  it('no-op when the target entity is missing from the scene', () => {
    const scene = { current: { entities: [] } as unknown as SceneModel };
    commitColumnCopy(centerGrip('col_missing'), { x: 250, y: 0 }, makeDeps(scene));
    expect(scene.current!.entities).toHaveLength(0);
  });
});

describe('commitHotGripCopy dispatch', () => {
  it('routes column-center → copy (returns true, inserts a copy)', () => {
    const original = makeColumn({ x: 0, y: 0 });
    const scene = { current: { entities: [original] } as unknown as SceneModel };

    // ADR-567 — the copy must clear the original's footprint (400×400 → ±200), else the
    // structural no-overlap guard blocks the insert. This test verifies the DISPATCH routing
    // (column-center → copy path), so we translate well past the footprint (Δx=500 > width).
    const result = commitHotGripCopy(centerGrip(original.id), { x: 500, y: 0 }, makeDeps(scene));

    expect(result).toBe(true);
    expect(scene.current!.entities).toHaveLength(2);
  });

  it('returns false for a kind with no copy path (no insert)', () => {
    const original = makeColumn({ x: 0, y: 0 });
    const scene = { current: { entities: [original] } as unknown as SceneModel };
    const grip = { ...centerGrip(original.id), columnGripKind: 'column-width' as const };

    const result = commitHotGripCopy(grip, { x: 100, y: 0 }, makeDeps(scene));

    expect(result).toBe(false);
    expect(scene.current!.entities).toHaveLength(1);
  });
});
