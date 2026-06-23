/**
 * ADR-507 / ADR-390 — HatchLifecycleSignalCommand undo/redo persistence signals.
 *
 * Verifies το zero-scene-effect triptych:
 *   · 1ο execute      → ΚΑΝΕΝΑ event (first-save μέσω `drawing:complete`)
 *   · undo            → `bim:hatch-delete-requested` { id }
 *   · redo (execute#2)→ `bim:entity-restore-requested` { entityType:'hatch', source:'redo-restore' }
 */
import { HatchLifecycleSignalCommand } from '../HatchLifecycleSignalCommand';
import { EventBus } from '../../../../systems/events/EventBus';
import type { ISceneManager, SceneEntity } from '../../interfaces';

function makeMockScene(initial: SceneEntity[] = []): ISceneManager {
  const scene = new Map<string, SceneEntity>(initial.map((e) => [e.id, e]));
  return {
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
}

function makeHatch(id = 'ent_hatch_1'): SceneEntity {
  return {
    id,
    type: 'hatch',
    boundaryPaths: [[{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }]],
  } as unknown as SceneEntity;
}

function capture<T>(event: string): { events: T[]; cleanup: () => void } {
  const events: T[] = [];
  const cleanup = EventBus.on(event as never, (p) => { events.push(p as T); });
  return { events, cleanup };
}

describe('HatchLifecycleSignalCommand', () => {
  it('1ο execute → ΔΕΝ εκπέμπει κανένα lifecycle event', () => {
    const sm = makeMockScene([makeHatch()]);
    const del = capture<{ id: string }>('bim:hatch-delete-requested');
    const res = capture('bim:entity-restore-requested');

    new HatchLifecycleSignalCommand('ent_hatch_1', sm).execute();

    del.cleanup(); res.cleanup();
    expect(del.events).toHaveLength(0);
    expect(res.events).toHaveLength(0);
  });

  it('undo → εκπέμπει bim:hatch-delete-requested με το σωστό id', () => {
    const sm = makeMockScene([makeHatch()]);
    const del = capture<{ id: string }>('bim:hatch-delete-requested');

    const cmd = new HatchLifecycleSignalCommand('ent_hatch_1', sm);
    cmd.execute();
    cmd.undo();

    del.cleanup();
    expect(del.events).toHaveLength(1);
    expect(del.events[0].id).toBe('ent_hatch_1');
  });

  it('redo (2ο execute) → εκπέμπει bim:entity-restore-requested entityType=hatch', () => {
    const sm = makeMockScene([makeHatch()]);
    const res = capture<{ entityType: string; entitySnapshot: { id: string }; source: string }>(
      'bim:entity-restore-requested',
    );

    const cmd = new HatchLifecycleSignalCommand('ent_hatch_1', sm);
    cmd.execute(); // 1ο = no-op
    cmd.execute(); // redo path (CompoundCommand.redo → execute)

    res.cleanup();
    expect(res.events).toHaveLength(1);
    expect(res.events[0].entityType).toBe('hatch');
    expect(res.events[0].entitySnapshot.id).toBe('ent_hatch_1');
    expect(res.events[0].source).toBe('redo-restore');
  });

  it('redo() (direct) → εκπέμπει restore· δεν εξαρτάται από το execute flag', () => {
    const sm = makeMockScene([makeHatch()]);
    const res = capture<{ entityType: string }>('bim:entity-restore-requested');

    new HatchLifecycleSignalCommand('ent_hatch_1', sm).redo();

    res.cleanup();
    expect(res.events).toHaveLength(1);
    expect(res.events[0].entityType).toBe('hatch');
  });

  it('redo → no-op όταν το entity λείπει από τη σκηνή (καμία restore)', () => {
    const sm = makeMockScene([]); // entity NOT in scene
    const res = capture('bim:entity-restore-requested');

    const cmd = new HatchLifecycleSignalCommand('ent_missing', sm);
    cmd.execute();
    cmd.execute();

    res.cleanup();
    expect(res.events).toHaveLength(0);
  });

  it('undo→redo cycle = delete μετά restore (full create-undo/redo)', () => {
    const sm = makeMockScene([makeHatch()]);
    const del = capture<{ id: string }>('bim:hatch-delete-requested');
    const res = capture<{ source: string }>('bim:entity-restore-requested');

    const cmd = new HatchLifecycleSignalCommand('ent_hatch_1', sm);
    cmd.execute(); // create (no-op)
    cmd.undo();    // → delete
    cmd.execute(); // redo → restore

    del.cleanup(); res.cleanup();
    expect(del.events).toHaveLength(1);
    expect(res.events).toHaveLength(1);
    expect(res.events[0].source).toBe('redo-restore');
  });
});
