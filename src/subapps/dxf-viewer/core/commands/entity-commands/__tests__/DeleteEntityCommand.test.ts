/**
 * ADR-390 Phase 3 — DeleteEntityCommand + DeleteMultipleEntitiesCommand
 * undo() emits `bim:entity-restore-requested` for BIM entities only.
 */
import { DeleteEntityCommand, DeleteMultipleEntitiesCommand } from '../DeleteEntityCommand';
import { EventBus } from '../../../../systems/events/EventBus';
import type { ISceneManager, SceneEntity } from '../../interfaces';

type RestorePayload = {
  entityType: 'wall' | 'opening' | 'slab' | 'slab-opening' | 'column' | 'beam' | 'stair';
  entitySnapshot: SceneEntity;
  source: 'undo-delete' | 'redo-restore';
};

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

function makeBimSlab(id = 'slab_1'): SceneEntity {
  return { id, type: 'slab' } as unknown as SceneEntity;
}

function makeBimWall(id = 'wall_1'): SceneEntity {
  return { id, type: 'wall' } as unknown as SceneEntity;
}

function makeNonBimLine(id = 'line_1'): SceneEntity {
  return { id, type: 'line' } as unknown as SceneEntity;
}

function captureRestoreEvents(): {
  events: RestorePayload[];
  cleanup: () => void;
} {
  const events: RestorePayload[] = [];
  const cleanup = EventBus.on('bim:entity-restore-requested', (p) => {
    events.push(p as unknown as RestorePayload);
  });
  return { events, cleanup };
}

describe('DeleteEntityCommand — ADR-390 symmetric restore emit', () => {
  it('undo() emits exactly 1 bim:entity-restore-requested for BIM entity', () => {
    const slab = makeBimSlab();
    const { sm } = makeMockScene([slab]);
    const { events, cleanup } = captureRestoreEvents();

    const cmd = new DeleteEntityCommand(slab.id, sm);
    cmd.execute();
    cmd.undo();

    cleanup();
    expect(events).toHaveLength(1);
    expect(events[0].entityType).toBe('slab');
    expect(events[0].entitySnapshot.id).toBe('slab_1');
    expect(events[0].source).toBe('undo-delete');
  });

  it('undo() does NOT emit for non-BIM entity types', () => {
    const line = makeNonBimLine();
    const { sm } = makeMockScene([line]);
    const { events, cleanup } = captureRestoreEvents();

    const cmd = new DeleteEntityCommand(line.id, sm);
    cmd.execute();
    cmd.undo();

    cleanup();
    expect(events).toHaveLength(0);
  });

  it('undo() restores entity to scene before emit', () => {
    const wall = makeBimWall();
    const { scene, sm } = makeMockScene([wall]);

    const cmd = new DeleteEntityCommand(wall.id, sm);
    cmd.execute();
    expect(scene.has(wall.id)).toBe(false);
    cmd.undo();
    expect(scene.has(wall.id)).toBe(true);
  });

  it('undo() is no-op when execute() was never called (no snapshot)', () => {
    const { sm } = makeMockScene([]);
    const { events, cleanup } = captureRestoreEvents();

    const cmd = new DeleteEntityCommand('missing_id', sm);
    cmd.undo();

    cleanup();
    expect(events).toHaveLength(0);
  });

  it('redo() removes entity again but does NOT emit restore', () => {
    const slab = makeBimSlab();
    const { scene, sm } = makeMockScene([slab]);
    const { events, cleanup } = captureRestoreEvents();

    const cmd = new DeleteEntityCommand(slab.id, sm);
    cmd.execute();
    cmd.undo();
    expect(events).toHaveLength(1);
    cmd.redo();

    cleanup();
    expect(scene.has(slab.id)).toBe(false);
    expect(events).toHaveLength(1);
  });
});

describe('DeleteMultipleEntitiesCommand — ADR-390 fan-out emit', () => {
  it('undo() emits N events for N BIM snapshots', () => {
    const slab = makeBimSlab('slab_1');
    const wall = makeBimWall('wall_1');
    const beam = { id: 'beam_1', type: 'beam' } as unknown as SceneEntity;
    const { sm } = makeMockScene([slab, wall, beam]);
    const { events, cleanup } = captureRestoreEvents();

    const cmd = new DeleteMultipleEntitiesCommand([slab.id, wall.id, beam.id], sm);
    cmd.execute();
    cmd.undo();

    cleanup();
    expect(events).toHaveLength(3);
    const types = events.map((e) => e.entityType).sort();
    expect(types).toEqual(['beam', 'slab', 'wall']);
    events.forEach((e) => expect(e.source).toBe('undo-delete'));
  });

  it('undo() emits only for BIM entities (filters non-BIM)', () => {
    const slab = makeBimSlab();
    const line = makeNonBimLine();
    const { sm } = makeMockScene([slab, line]);
    const { events, cleanup } = captureRestoreEvents();

    const cmd = new DeleteMultipleEntitiesCommand([slab.id, line.id], sm);
    cmd.execute();
    cmd.undo();

    cleanup();
    expect(events).toHaveLength(1);
    expect(events[0].entityType).toBe('slab');
  });

  it('undo() restores all entities to scene before emit (fan-out order)', () => {
    const wall = makeBimWall();
    const slab = makeBimSlab();
    const { scene, sm } = makeMockScene([wall, slab]);

    const cmd = new DeleteMultipleEntitiesCommand([wall.id, slab.id], sm);
    cmd.execute();
    expect(scene.size).toBe(0);
    cmd.undo();
    expect(scene.has(wall.id)).toBe(true);
    expect(scene.has(slab.id)).toBe(true);
  });

  it('undo() emits 0 events when no entities snapshotted', () => {
    const { sm } = makeMockScene([]);
    const { events, cleanup } = captureRestoreEvents();

    const cmd = new DeleteMultipleEntitiesCommand(['missing_1', 'missing_2'], sm);
    cmd.execute();
    cmd.undo();

    cleanup();
    expect(events).toHaveLength(0);
  });
});
