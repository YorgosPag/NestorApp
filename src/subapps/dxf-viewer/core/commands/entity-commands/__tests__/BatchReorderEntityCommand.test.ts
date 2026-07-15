/**
 * ADR-661 — BatchReorderEntityCommand unit tests.
 *
 * Verifies the command's execute/undo/redo cycle against the Map-backed
 * `createMockSceneManager` (ADR-527 SSoT test helper), now that the mock implements the
 * real `reorderEntities` / `getEntityOrder` / `setEntityOrder` trio (ADR-661) instead of
 * no-op stubs.
 */
import { BatchReorderEntityCommand } from '../BatchReorderEntityCommand';
import type { SceneEntity } from '../../interfaces';
import { createMockSceneManager } from '../../__tests__/mock-scene-manager';

const make = (...ids: string[]): SceneEntity[] => ids.map((id) => ({ id, type: 'line', visible: true }));

describe('BatchReorderEntityCommand (ADR-661)', () => {
  it('execute() moves the id-set to the back (array start), preserving relative order', () => {
    const sm = createMockSceneManager(make('a', 'b', 'c', 'd', 'e'));
    const cmd = new BatchReorderEntityCommand(['d', 'b'], 'back', sm);

    cmd.execute();

    expect(sm.getEntityOrder()).toEqual(['b', 'd', 'a', 'c', 'e']);
  });

  it('execute() moves the id-set to the front (array end), preserving relative order', () => {
    const sm = createMockSceneManager(make('a', 'b', 'c', 'd', 'e'));
    const cmd = new BatchReorderEntityCommand(['d', 'b'], 'front', sm);

    cmd.execute();

    expect(sm.getEntityOrder()).toEqual(['a', 'c', 'e', 'b', 'd']);
  });

  it('undo() restores the EXACT prior order for a non-trivial scene + subset move', () => {
    const sm = createMockSceneManager(make('a', 'b', 'c', 'd', 'e', 'f', 'g'));
    const orderBefore = sm.getEntityOrder();
    expect(orderBefore).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g']);

    const cmd = new BatchReorderEntityCommand(['g', 'c', 'e'], 'front', sm);
    cmd.execute();
    expect(sm.getEntityOrder()).toEqual(['a', 'b', 'd', 'f', 'c', 'e', 'g']);

    cmd.undo();

    expect(sm.getEntityOrder()).toEqual(orderBefore);
  });

  it('redo() re-applies the same reorder after an undo', () => {
    const sm = createMockSceneManager(make('a', 'b', 'c', 'd', 'e'));
    const cmd = new BatchReorderEntityCommand(['a', 'd'], 'back', sm);

    cmd.execute();
    const orderAfterExecute = sm.getEntityOrder();
    expect(orderAfterExecute).toEqual(['a', 'd', 'b', 'c', 'e']);

    cmd.undo();
    expect(sm.getEntityOrder()).toEqual(['a', 'b', 'c', 'd', 'e']);

    cmd.redo();
    expect(sm.getEntityOrder()).toEqual(orderAfterExecute);
  });

  it('empty ids → execute() is a no-op (order unchanged) and undo() stays safe', () => {
    const sm = createMockSceneManager(make('a', 'b', 'c'));
    const orderBefore = sm.getEntityOrder();

    const cmd = new BatchReorderEntityCommand([], 'front', sm);
    cmd.execute();

    expect(sm.getEntityOrder()).toEqual(orderBefore);

    // undo() must not throw and must not corrupt scene state when execute() never captured a snapshot
    expect(() => cmd.undo()).not.toThrow();
    expect(sm.getEntityOrder()).toEqual(orderBefore);
  });

  it('getDescription() reports entity count and direction', () => {
    const sm = createMockSceneManager(make('a', 'b', 'c'));
    const cmd = new BatchReorderEntityCommand(['a', 'b'], 'back', sm);
    expect(cmd.getDescription()).toBe('Reorder 2 entities to back');
  });

  it('getAffectedEntityIds() returns a copy of the moved ids', () => {
    const sm = createMockSceneManager(make('a', 'b', 'c'));
    const ids = ['a', 'c'];
    const cmd = new BatchReorderEntityCommand(ids, 'front', sm);
    const affected = cmd.getAffectedEntityIds();
    expect(affected).toEqual(['a', 'c']);
    affected.push('mutated');
    expect(cmd.getAffectedEntityIds()).toEqual(['a', 'c']); // defensive copy, not the live array
  });

  it('serialize() captures type/direction/ids/orderBefore after execute()', () => {
    const sm = createMockSceneManager(make('a', 'b', 'c'));
    const cmd = new BatchReorderEntityCommand(['b'], 'back', sm);
    cmd.execute();

    const serialized = cmd.serialize();
    expect(serialized.type).toBe('batch-reorder-entity');
    expect(serialized.data.direction).toBe('back');
    expect(serialized.data.entityIds).toEqual(['b']);
    expect(serialized.data.orderBefore).toEqual(['a', 'b', 'c']);
  });
});
