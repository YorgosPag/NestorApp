/**
 * ADR-635 Φ C.8 — `emitImportedEntityCreateEvents` (imported per-entity first-save emitter).
 *
 * Regression: εισαγόμενες AutoCAD γραμμοσκιάσεις «χάνονται μετά την εισαγωγή» επειδή το DXF
 * import δεν εξέπεμπε `drawing:entity-created` → κανένα `floorplan_hatches` doc → το
 * `reconcileLoadedSceneBim` τις πετούσε στο reload. Ο emitter (SSoT, shared .tek + DXF) πρέπει:
 *   - να εκπέμπει για κάθε per-entity-persisted entity (hatch / BIM / stair) με `tool === type`,
 *   - να ΑΓΝΟΕΙ τα pure-DXF primitives (line/arc/circle/text/dimension) — δεν έχουν host,
 *   - να διατηρεί το scene order (host-first: τοίχος ΠΡΙΝ κούφωμα).
 */

import type { AnySceneEntity } from '../../../types/entities';
import { EventBus } from '../../events/EventBus';
import { emitImportedEntityCreateEvents } from '../emit-imported-entity-create-events';

/** Minimal fixture — οι type guards + ο emitter διαβάζουν μόνο `id` & `type`. */
const ent = (type: string, id: string): AnySceneEntity =>
  ({ id, type } as unknown as AnySceneEntity);

describe('emitImportedEntityCreateEvents', () => {
  function capture(entities: readonly AnySceneEntity[]): Array<{ id: string; tool: string }> {
    const events: Array<{ id: string; tool: string }> = [];
    const off = EventBus.on('drawing:entity-created', (p) =>
      events.push({ id: p.entity.id, tool: p.tool }),
    );
    try {
      emitImportedEntityCreateEvents(entities);
    } finally {
      off();
    }
    return events;
  }

  it('emits for a hatch with tool "hatch" (the imported-AutoCAD regression case)', () => {
    const events = capture([ent('hatch', 'h1')]);
    expect(events).toEqual([{ id: 'h1', tool: 'hatch' }]);
  });

  it('emits for BIM + stair entities with tool === entity.type', () => {
    const events = capture([
      ent('wall', 'w1'),
      ent('column', 'c1'),
      ent('slab', 's1'),
      ent('stair', 'st1'),
    ]);
    expect(events).toEqual([
      { id: 'w1', tool: 'wall' },
      { id: 'c1', tool: 'column' },
      { id: 's1', tool: 'slab' },
      { id: 'st1', tool: 'stair' },
    ]);
  });

  it('ignores pure-DXF primitives (no per-entity host)', () => {
    const events = capture([
      ent('line', 'l1'),
      ent('polyline', 'p1'),
      ent('circle', 'ci1'),
      ent('text', 't1'),
      ent('dimension', 'd1'),
    ]);
    expect(events).toEqual([]);
  });

  it('emits only for per-entity entities in a mixed scene, preserving scene order', () => {
    const events = capture([
      ent('line', 'l1'),
      ent('wall', 'w1'), // host BEFORE opening (opening.wallId ref)
      ent('opening', 'o1'),
      ent('circle', 'ci1'),
      ent('hatch', 'h1'),
    ]);
    expect(events).toEqual([
      { id: 'w1', tool: 'wall' },
      { id: 'o1', tool: 'opening' },
      { id: 'h1', tool: 'hatch' },
    ]);
  });

  it('is a no-op for an empty scene', () => {
    expect(capture([])).toEqual([]);
  });
});
