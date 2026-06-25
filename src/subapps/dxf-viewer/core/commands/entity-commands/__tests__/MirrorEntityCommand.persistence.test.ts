/**
 * ADR-363 §7.2 — `MirrorEntityCommand` copy+mirror persistence broadcasts.
 *
 * Regression for HANDOFFS/2026-06-01_BIM_copy-mirror-persistence-bug: a BIM
 * clone produced by copy+mirror (`keepOriginals=true`) must emit the same
 * create / delete / restore EventBus signals the draw + delete paths use, or the
 * Firestore subscription drops it on the next snapshot (clone flashes then
 * vanishes). Non-BIM clones must emit NO BIM signals.
 */
import { MirrorEntityCommand } from '../MirrorEntityCommand';
import type { SceneEntity } from '../../interfaces';
import type { MirrorAxis } from '../../../../utils/mirror-math';
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

const Y_AXIS: MirrorAxis = { p1: { x: 0, y: 0 }, p2: { x: 0, y: 1 } };

describe('MirrorEntityCommand — ADR-363 §7.2 copy+mirror persistence', () => {
  it('execute emits drawing:entity-created with tool=wall + a fresh enterprise id', () => {
    const wall = makeWall();
    const { sm } = makeMockScene([wall as unknown as SceneEntity]);
    const created: Array<{ tool: string; id: string }> = [];
    const off = EventBus.on('drawing:entity-created', (p) =>
      created.push({ tool: p.tool, id: p.entity.id }));

    const cmd = new MirrorEntityCommand([wall.id], Y_AXIS, true, sm);
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
    const cmd = new MirrorEntityCommand([wall.id], Y_AXIS, true, sm);
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

    const cmd = new MirrorEntityCommand([wall.id], Y_AXIS, true, sm);
    cmd.execute();
    const cloneId = cmd.getAffectedEntityIds()[0];
    cmd.undo();
    off();

    expect(deleted).toEqual([cloneId]);
  });

  it('redo re-adds the SAME clone id and emits restore (no orphan id)', () => {
    const wall = makeWall();
    const { scene, sm } = makeMockScene([wall as unknown as SceneEntity]);
    const restored: Array<{ id: string; source: string }> = [];
    const off = EventBus.on('bim:entity-restore-requested', (p) =>
      restored.push({ id: p.entitySnapshot.id, source: p.source }));

    const cmd = new MirrorEntityCommand([wall.id], Y_AXIS, true, sm);
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

    const cmd = new MirrorEntityCommand([line.id], Y_AXIS, true, sm);
    cmd.execute();
    cmd.undo();
    offs.forEach((o) => o());

    expect(created).toBe(0);
    expect(deleted).toBe(0);
  });
});
