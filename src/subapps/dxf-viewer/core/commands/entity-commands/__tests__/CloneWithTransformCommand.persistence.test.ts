/**
 * ADR-363 §7.2 / ADR-507 §8 — `CloneWithTransformCommand` BIM persistence broadcasts.
 *
 * Regression for HANDOFFS/2026-06-01_BIM_copy-mirror-persistence-bug: a BIM clone must
 * emit the same create / delete / restore EventBus signals the draw + delete paths use,
 * or the Firestore subscription drops it on the next snapshot (clone flashes then
 * vanishes). Non-BIM clones must emit NO BIM signals.
 *
 * Migrated from `MirrorEntityCommand.persistence.test.ts` and WIDENED to every kind.
 * That matters: mirror-copy was the only transform that ever did this correctly —
 * rotate-copy and scale-copy minted a generic `generateEntityId()` and broadcast
 * nothing, so Ctrl+rotate-copying a wall produced a clone that vanished on the next
 * snapshot. Those two now route through this command, so the suite is parameterized
 * over all three kinds to keep any of them from regressing back.
 */
import { CloneWithTransformCommand } from '../CloneWithTransformCommand';
import type { CloneTransformKind } from '../CloneWithTransformCommand';
import {
  buildRotatePatch,
  buildScalePatch,
  buildMirrorPatch,
} from '../transform-patch-builders';
import type { TransformPatch } from '../transform-patch-builders';
import type { SceneEntity } from '../../interfaces';
import type { WallEntity } from '../../../../bim/types/wall-types';
import { EventBus } from '../../../../systems/events/EventBus';
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
    id: 'wall_src',
    type: 'wall',
    kind: 'straight',
    layerId: 'L',
    ifcGuid: 'SOURCE_IFC_GUID_00000',
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

const Y_AXIS = { p1: { x: 0, y: 0 }, p2: { x: 0, y: 1 } };

/** The three copy paths, each as (kind, patch) — every one must persist identically. */
const KINDS: Array<[CloneTransformKind, () => TransformPatch]> = [
  ['rotate', () => buildRotatePatch({ x: 0, y: 0 }, 90)],
  ['scale', () => buildScalePatch({ x: 0, y: 0 }, { mode: 'uniform', factor: 2 })],
  ['mirror', () => buildMirrorPatch(Y_AXIS)],
];

describe.each(KINDS)('CloneWithTransformCommand [%s] — ADR-363 §7.2 persistence', (kind, patch) => {
  it('execute emits drawing:entity-created with tool=wall + a fresh enterprise id', () => {
    const wall = makeWall();
    const { sm } = makeMockScene([wall as unknown as SceneEntity]);
    const created: Array<{ tool: string; id: string }> = [];
    const off = EventBus.on('drawing:entity-created', (p) =>
      created.push({ tool: p.tool, id: p.entity.id }));

    const cmd = new CloneWithTransformCommand([wall.id], sm, patch(), kind);
    cmd.execute();
    off();

    expect(created).toHaveLength(1);
    expect(created[0].tool).toBe('wall');
    expect(created[0].id).toMatch(/^wall_/i);
    expect(created[0].id).not.toBe(wall.id);
  });

  it('clone gets a NEW ifcGuid (no IFC GlobalId collision with source)', () => {
    const wall = makeWall();
    const { scene, sm } = makeMockScene([wall as unknown as SceneEntity]);
    const cmd = new CloneWithTransformCommand([wall.id], sm, patch(), kind);
    cmd.execute();
    const cloneId = [...scene.keys()].find((id) => id !== wall.id)!;
    const clone = scene.get(cloneId) as unknown as { ifcGuid?: string };
    expect(clone.ifcGuid).toBeDefined();
    expect(clone.ifcGuid).not.toBe('SOURCE_IFC_GUID_00000');
  });

  it('undo emits bim:wall-delete-requested for the clone id', () => {
    const wall = makeWall();
    const { sm } = makeMockScene([wall as unknown as SceneEntity]);
    const deleted: string[] = [];
    const off = EventBus.on('bim:wall-delete-requested', (p) => deleted.push(p.wallId));

    const cmd = new CloneWithTransformCommand([wall.id], sm, patch(), kind);
    cmd.execute();
    const cloneId = cmd.getAffectedEntityIds()[0];
    cmd.undo();
    off();

    expect(deleted).toEqual([cloneId]);
  });

  it('redo re-adds the SAME clone id and emits restore (no orphan doc)', () => {
    const wall = makeWall();
    const { scene, sm } = makeMockScene([wall as unknown as SceneEntity]);
    const restored: Array<{ id: string; source: string }> = [];
    const off = EventBus.on('bim:entity-restore-requested', (p) =>
      restored.push({ id: p.entitySnapshot.id, source: p.source }));

    const cmd = new CloneWithTransformCommand([wall.id], sm, patch(), kind);
    cmd.execute();
    const cloneId = cmd.getAffectedEntityIds()[0];
    cmd.undo();
    cmd.redo();
    off();

    // id-stable across undo/redo — redo did NOT mint a new id.
    expect(cmd.getAffectedEntityIds()).toEqual([cloneId]);
    expect(scene.has(cloneId)).toBe(true);
    expect(restored).toEqual([{ id: cloneId, source: 'redo-restore' }]);
  });

  it('clones the BIM wall, source preserved', () => {
    const wall = makeWall();
    const { scene, sm } = makeMockScene([wall as unknown as SceneEntity]);
    const cmd = new CloneWithTransformCommand([wall.id], sm, patch(), kind);
    cmd.execute();

    expect(scene.size).toBe(2);
    const orig = scene.get(wall.id) as unknown as WallEntity;
    expect(orig.params.start.x).toBe(100); // source untouched
  });

  it('non-BIM clone (line) emits NO BIM persistence signals', () => {
    const line: SceneEntity = {
      id: 'line_1',
      type: 'line',
      start: { x: 100, y: 200 },
      end: { x: 300, y: 400 },
    } as unknown as SceneEntity;
    const { sm } = makeMockScene([line]);
    let created = 0;
    let deleted = 0;
    const offs = [
      EventBus.on('drawing:entity-created', () => { created++; }),
      EventBus.on('bim:wall-delete-requested', () => { deleted++; }),
    ];

    const cmd = new CloneWithTransformCommand([line.id], sm, patch(), kind);
    cmd.execute();
    cmd.undo();
    offs.forEach((o) => o());

    expect(created).toBe(0);
    expect(deleted).toBe(0);
  });
});

describe('CloneWithTransformCommand — BIM-aware patch reaches the clone', () => {
  // Migrated from MirrorEntityCommand.bim.test.ts (`keepOriginals=true` case) and widened
  // to rotate, which previously had NO BIM-aware copy at all.
  //
  // Scale is deliberately absent: `scale-entity-transform` SKIPS parametric BIM
  // (wall/column/beam/slab/stair) by design — see its `skip parametric BIM` guard. So a
  // scale-copy of a wall clones it un-transformed. That is pre-existing, intentional
  // behaviour of the scale math, unrelated to the copy path, and out of scope here.
  it.each([
    ['rotate', () => buildRotatePatch({ x: 0, y: 0 }, 90)],
    ['mirror', () => buildMirrorPatch(Y_AXIS)],
  ])('%s: the clone carries transformed BIM params, the source does not', (kind, patch) => {
    const wall = makeWall();
    const { scene, sm } = makeMockScene([wall as unknown as SceneEntity]);
    const cmd = new CloneWithTransformCommand(
      [wall.id], sm, patch(), kind as CloneTransformKind,
    );
    cmd.execute();

    const orig = scene.get(wall.id) as unknown as WallEntity;
    expect(orig.params.start.x).toBe(100); // source untouched

    const clone = scene.get(cmd.getAffectedEntityIds()[0]) as unknown as WallEntity;
    expect(clone.params.start.x).not.toBe(100); // BIM patch landed on the clone
  });
});
