/**
 * ADR-510 Φ4d — OffsetEntityCommand (execute/undo/erase) + OffsetToolStore tests.
 */

import { OffsetEntityCommand } from '../../../core/commands/entity-commands/OffsetEntityCommand';
import type { ISceneManager, SceneEntity } from '../../../core/commands/interfaces';
import { OffsetToolStore } from '../OffsetToolStore';
import type { Entity } from '../../../types/entities';

function ent(id: string): Entity {
  return { id, type: 'line', visible: true, start: { x: 0, y: 0 }, end: { x: 1, y: 0 } } as unknown as Entity;
}

function fakeSceneManager() {
  const added: string[] = [];
  const removed: string[] = [];
  const mgr = {
    addEntity: (e: SceneEntity) => added.push(e.id),
    removeEntity: (id: string) => removed.push(id),
    updateEntity: () => {},
  } as unknown as ISceneManager;
  return { mgr, added, removed };
}

describe('OffsetEntityCommand', () => {
  it('execute adds the copy; undo removes it (no erase)', () => {
    const { mgr, added, removed } = fakeSceneManager();
    const cmd = new OffsetEntityCommand(
      { copy: ent('COPY'), source: ent('SRC'), erase: false, pickPoint: { x: 0, y: 0 } },
      mgr,
    );
    cmd.execute();
    expect(added).toEqual(['COPY']);
    expect(removed).toEqual([]);
    cmd.undo();
    expect(removed).toEqual(['COPY']);
  });

  it('erase mode also removes source on execute and restores it on undo', () => {
    const { mgr, added, removed } = fakeSceneManager();
    const cmd = new OffsetEntityCommand(
      { copy: ent('COPY'), source: ent('SRC'), erase: true, pickPoint: { x: 0, y: 0 } },
      mgr,
    );
    cmd.execute();
    expect(added).toEqual(['COPY']);
    expect(removed).toEqual(['SRC']);
    cmd.undo();
    expect(removed).toEqual(['SRC', 'COPY']);
    expect(added).toEqual(['COPY', 'SRC']);
  });

  it('undo is a no-op before execute', () => {
    const { mgr, removed } = fakeSceneManager();
    const cmd = new OffsetEntityCommand(
      { copy: ent('COPY'), source: ent('SRC'), erase: false, pickPoint: { x: 0, y: 0 } },
      mgr,
    );
    cmd.undo();
    expect(removed).toEqual([]);
  });

  it('reports affected ids + validates', () => {
    const { mgr } = fakeSceneManager();
    const cmd = new OffsetEntityCommand(
      { copy: ent('COPY'), source: ent('SRC'), erase: true, pickPoint: { x: 0, y: 0 } },
      mgr,
    );
    expect(cmd.getAffectedEntityIds().sort()).toEqual(['COPY', 'SRC']);
    expect(cmd.validate()).toBeNull();
  });
});

describe('OffsetToolStore', () => {
  beforeEach(() => OffsetToolStore.reset());

  it('picks a source → advances to picking-side', () => {
    OffsetToolStore.setSource(ent('SRC'));
    expect(OffsetToolStore.getState().phase).toBe('picking-side');
    expect(OffsetToolStore.getState().source?.id).toBe('SRC');
  });

  it('clearSource returns to picking-source and drops typed distance', () => {
    OffsetToolStore.setSource(ent('SRC'));
    OffsetToolStore.setTypedDistance(50);
    OffsetToolStore.clearSource();
    expect(OffsetToolStore.getState().phase).toBe('picking-source');
    expect(OffsetToolStore.getState().source).toBeNull();
    expect(OffsetToolStore.getState().typedDistance).toBeNull();
  });

  it('typed digit buffer parses into a positive distance', () => {
    OffsetToolStore.appendTypedChar('2');
    OffsetToolStore.appendTypedChar('0');
    expect(OffsetToolStore.getState().typedDistance).toBe(20);
    OffsetToolStore.popTypedChar();
    expect(OffsetToolStore.getState().typedDistance).toBe(2);
    OffsetToolStore.popTypedChar();
    expect(OffsetToolStore.getState().typedDistance).toBeNull();
  });

  it('toggles erase-source', () => {
    expect(OffsetToolStore.getState().eraseSource).toBe(false);
    OffsetToolStore.toggleEraseSource();
    expect(OffsetToolStore.getState().eraseSource).toBe(true);
  });

  it('notifies subscribers and unsubscribes cleanly', () => {
    let calls = 0;
    const unsub = OffsetToolStore.subscribe(() => { calls += 1; });
    OffsetToolStore.setPhase('picking-side');
    expect(calls).toBe(1);
    unsub();
    OffsetToolStore.setPhase('picking-source');
    expect(calls).toBe(1);
  });
});
