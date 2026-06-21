/**
 * ADR-390 — CreateBimEntityCommand (symmetric, undoable BIM create).
 *
 * Verifies: execute/redo add to scene + broadcast `drawing:entity-created`
 * (microtask); undo removes + emits `bim:<type>-delete-requested`; undo before
 * execute is a no-op; the snapshot is deep-cloned (later edits don't leak).
 */

import { CreateBimEntityCommand } from '../CreateBimEntityCommand';
import { EventBus } from '../../../../systems/events/EventBus';
import type { ISceneManager, SceneEntity } from '../../interfaces';
import type { AnySceneEntity } from '../../../../types/scene';

const flush = (): Promise<void> => Promise.resolve();

function makeFakeSceneManager(): { mgr: ISceneManager; entities: Map<string, SceneEntity> } {
  const entities = new Map<string, SceneEntity>();
  const mgr = {
    addEntity: (e: SceneEntity) => { entities.set(e.id, e); },
    removeEntity: (id: string) => { entities.delete(id); },
    getEntity: (id: string) => entities.get(id),
  } as unknown as ISceneManager;
  return { mgr, entities };
}

function makeColumn(id = 'col_1'): AnySceneEntity {
  return { id, type: 'column', params: { width: 400 } } as unknown as AnySceneEntity;
}

describe('CreateBimEntityCommand', () => {
  it('execute adds the entity to the scene synchronously', () => {
    const { mgr, entities } = makeFakeSceneManager();
    new CreateBimEntityCommand(makeColumn(), 'column', mgr).execute();
    expect(entities.has('col_1')).toBe(true);
  });

  it('execute broadcasts drawing:entity-created in a microtask (deferred)', async () => {
    const { mgr } = makeFakeSceneManager();
    const events: Array<{ id: string; tool: string }> = [];
    const off = EventBus.on('drawing:entity-created', (p) => events.push({ id: p.entity.id, tool: p.tool }));
    new CreateBimEntityCommand(makeColumn(), 'column', mgr).execute();
    expect(events).toHaveLength(0); // not synchronous
    await flush();
    expect(events).toEqual([{ id: 'col_1', tool: 'column' }]);
    off();
  });

  it('undo removes the entity + emits bim:column-delete-requested', async () => {
    const { mgr, entities } = makeFakeSceneManager();
    const deletes: string[] = [];
    const off = EventBus.on('bim:column-delete-requested', (p) => deletes.push(p.columnId));
    const cmd = new CreateBimEntityCommand(makeColumn(), 'column', mgr);
    cmd.execute();
    await flush();
    cmd.undo();
    expect(entities.has('col_1')).toBe(false);
    await flush();
    expect(deletes).toEqual(['col_1']);
    off();
  });

  it('undo before execute is a no-op (no scene mutation, no delete event)', async () => {
    const { mgr, entities } = makeFakeSceneManager();
    entities.set('col_1', makeColumn() as unknown as SceneEntity); // pre-existing, unrelated
    const deletes: string[] = [];
    const off = EventBus.on('bim:column-delete-requested', (p) => deletes.push(p.columnId));
    new CreateBimEntityCommand(makeColumn(), 'column', mgr).undo();
    await flush();
    expect(entities.has('col_1')).toBe(true); // untouched
    expect(deletes).toHaveLength(0);
    off();
  });

  it('redo re-adds the entity + re-broadcasts drawing:entity-created', async () => {
    const { mgr, entities } = makeFakeSceneManager();
    const events: string[] = [];
    const off = EventBus.on('drawing:entity-created', (p) => events.push(p.entity.id));
    const cmd = new CreateBimEntityCommand(makeColumn(), 'column', mgr);
    cmd.execute();
    cmd.undo();
    await flush();
    cmd.redo();
    expect(entities.has('col_1')).toBe(true);
    await flush();
    // apply (execute) + apply (redo) → 2 created broadcasts.
    expect(events.filter((id) => id === 'col_1').length).toBe(2);
    off();
  });

  it('deep-clones the snapshot — mutating the original after construction does not leak', () => {
    const { mgr, entities } = makeFakeSceneManager();
    const original = makeColumn() as unknown as { params: { width: number } };
    const cmd = new CreateBimEntityCommand(original as unknown as AnySceneEntity, 'column', mgr);
    original.params.width = 999; // mutate AFTER construction
    cmd.execute();
    const stored = entities.get('col_1') as unknown as { params: { width: number } };
    expect(stored.params.width).toBe(400);
  });
});
