/**
 * ADR-594 — `createBimEntityPersistenceHook` behavioural smoke tests.
 *
 * Exercises the invariant scaffold end-to-end through a synthetic entity type
 * ('furniture' — a real restore-union member) with a fake Firestore service, a
 * fake level-manager, and the REAL EventBus + `mergeDocsIntoScene` SSoT:
 *   - first-save on `drawing:entity-created`
 *   - subscribe → diff-merge into the scene
 *   - update path on a known entity (saveNow)
 *   - delete → Firestore remove + optimistic scene removal + onDeleted
 *   - restore via `bim:entity-restore-requested`
 *   - debounced auto-save on selected-entity params change
 */

import { renderHook, act } from '@testing-library/react';

import { createBimEntityPersistenceHook } from '../create-bim-entity-persistence-hook';
import { EventBus } from '../../../systems/events/EventBus';

// ---------------------------------------------------------------------------
// FAKES
// ---------------------------------------------------------------------------

type TestEntity = {
  id: string;
  type: 'furniture';
  kind: string;
  params: { w: number };
  geometry: Record<string, unknown>;
  layerId: string;
};

const ent = (id: string, w: number): TestEntity => ({
  id,
  type: 'furniture',
  kind: 'chair',
  params: { w },
  geometry: {},
  layerId: 'L0',
});

function makeService() {
  const svc = {
    save: jest.fn(async (_e: TestEntity) => undefined),
    update: jest.fn(async (_id: string, _patch: unknown) => undefined),
    remove: jest.fn(async (_id: string) => undefined),
    onDocs: null as null | ((docs: readonly unknown[]) => void),
    subscribe: jest.fn((onDocs: (docs: readonly unknown[]) => void) => {
      svc.onDocs = onDocs;
      return () => {
        svc.onDocs = null;
      };
    }),
  };
  return svc;
}

function makeLevelManager() {
  const state: { scene: { entities: TestEntity[] } } = { scene: { entities: [] } };
  return {
    currentLevelId: 'lvl',
    levels: [{ id: 'lvl', floorId: 'f1' }],
    getLevelScene: (_id: string) => state.scene,
    setLevelScene: (_id: string, next: { entities: TestEntity[] }) => {
      state.scene = next;
    },
    _state: state,
  };
}

const tick = () => new Promise((r) => setTimeout(r, 0));

// ---------------------------------------------------------------------------
// HOOK UNDER TEST
// ---------------------------------------------------------------------------

function buildHook(spies: {
  onPersisted?: jest.Mock;
  onDeleted?: jest.Mock;
  onRestored?: jest.Mock;
}) {
  let svc: ReturnType<typeof makeService>;
  const created: ReturnType<typeof makeService>[] = [];
  const hook = createBimEntityPersistenceHook<
    ReturnType<typeof makeService>,
    { id: string; params: { w: number } },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    any,
    { w: number }
  >({
    entityType: 'furniture',
    restoreEntityType: 'furniture',
    saveErrorKey: 'SAVE_ERR',
    restoreErrorKey: 'RESTORE_ERR',
    entityComparable: (e) => e.params,
    createService: () => {
      svc = makeService();
      created.push(svc);
      return svc;
    },
    service: {
      save: (s, e) => s.save(e),
      update: (s, e) => s.update(e.id, e),
      remove: (s, id) => s.remove(id),
      subscribe: (s, onDocs, _onErr) => s.subscribe(onDocs),
    },
    merge: {
      mode: 'generic',
      config: {
        isEntity: (e): e is TestEntity => (e as { type?: string }).type === 'furniture',
        docToEntity: (doc: { id: string; params: { w: number } }) => ent(doc.id, doc.params.w),
        entityComparable: (e) => e.params,
        docComparable: (d) => d.params,
      },
    },
    deleteTrigger: {
      event: 'bim:furniture-delete-requested',
      getId: (p) => (p as { furnitureId?: string }).furnitureId,
    },
    onPersisted: spies.onPersisted,
    onDeleted: spies.onDeleted,
    onRestored: spies.onRestored,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any;
  return { hook, getSvc: () => created[created.length - 1] };
}

const baseParams = (lm: ReturnType<typeof makeLevelManager>, primarySelected: TestEntity | null) => ({
  companyId: 'c1',
  projectId: 'p1',
  floorplanId: 'fp1',
  floorId: 'f1',
  buildingId: 'b1',
  userId: 'u1',
  levelManager: lm,
  primarySelected,
});

// ---------------------------------------------------------------------------
// TESTS
// ---------------------------------------------------------------------------

describe('createBimEntityPersistenceHook', () => {
  it('first-save: drawing:entity-created → service.save + onPersisted(created)', async () => {
    const onPersisted = jest.fn();
    const { hook, getSvc } = buildHook({ onPersisted });
    const lm = makeLevelManager();
    const { unmount } = renderHook(() => hook(baseParams(lm, null)));

    await act(async () => {
      EventBus.emit('drawing:entity-created', { tool: 'furniture', entity: ent('e1', 5) });
      await tick();
    });

    expect(getSvc().save).toHaveBeenCalledTimes(1);
    expect(onPersisted).toHaveBeenCalledTimes(1);
    expect(onPersisted.mock.calls[0][1].isNew).toBe(true);
    unmount();
  });

  it('deferred first-save (Φ C.15): create-event before the service is ready flushes once scope resolves', async () => {
    // Repro of the "imported hatch appears then vanishes" race: a fresh import emits
    // drawing:entity-created SYNCHRONOUSLY, before the async service-instantiation effect
    // has run for the imported level's scope. The OLD code early-returned on the null
    // service → the first-save was lost AND the entity was never protected → the first
    // (docless) snapshot dropped it. The fix defers the save + flushes on service-ready.
    const onPersisted = jest.fn();
    const { hook, getSvc } = buildHook({ onPersisted });
    const lm = makeLevelManager();
    // Start with an UNRESOLVABLE scope (no companyId) → resolveBimPersistenceScope → null → no service.
    const { rerender, unmount } = renderHook(
      ({ company }: { company: string }) => hook({ ...baseParams(lm, null), companyId: company }),
      { initialProps: { company: '' } },
    );

    // Create-event arrives while the service is still null.
    await act(async () => {
      EventBus.emit('drawing:entity-created', { tool: 'furniture', entity: ent('e1', 5) });
      await tick();
    });
    // Nothing could have been saved yet (no service was ever created).
    expect(getSvc()).toBeUndefined();

    // Scope resolves → service instantiated → the deferred first-save flushes exactly once.
    rerender({ company: 'c1' });
    await act(async () => {
      await tick();
    });

    expect(getSvc().save).toHaveBeenCalledTimes(1);
    expect(onPersisted).toHaveBeenCalledTimes(1);
    expect(onPersisted.mock.calls[0][1].isNew).toBe(true);
    unmount();
  });

  it('subscribe → diff-merge adds the doc entity to the scene', async () => {
    const { hook, getSvc } = buildHook({});
    const lm = makeLevelManager();
    const { unmount } = renderHook(() => hook(baseParams(lm, null)));

    await act(async () => {
      getSvc().onDocs?.([{ id: 'd1', params: { w: 9 } }]);
      await tick();
    });

    expect(lm._state.scene.entities.map((e) => e.id)).toContain('d1');
    unmount();
  });

  it('update path: a known (subscribed) entity persists via update, not save', async () => {
    const onPersisted = jest.fn();
    const { hook, getSvc } = buildHook({ onPersisted });
    const lm = makeLevelManager();
    const selected = ent('d1', 9);
    const { rerender, result, unmount } = renderHook(
      ({ sel }: { sel: TestEntity | null }) => hook(baseParams(lm, sel)),
      { initialProps: { sel: null as TestEntity | null } },
    );

    // Seed the baseline via a snapshot, then select + saveNow with changed params.
    await act(async () => {
      getSvc().onDocs?.([{ id: 'd1', params: { w: 9 } }]);
      await tick();
    });
    rerender({ sel: { ...selected, params: { w: 42 } } });
    await act(async () => {
      await result.current.saveNow();
      await tick();
    });

    expect(getSvc().update).toHaveBeenCalledTimes(1);
    expect(getSvc().save).not.toHaveBeenCalled();
    expect(onPersisted.mock.calls.at(-1)?.[1].isNew).toBe(false);
    unmount();
  });

  it('delete: service.remove + optimistic scene removal + onDeleted', async () => {
    const onDeleted = jest.fn();
    const { hook, getSvc } = buildHook({ onDeleted });
    const lm = makeLevelManager();
    const { result, unmount } = renderHook(() => hook(baseParams(lm, null)));

    await act(async () => {
      getSvc().onDocs?.([{ id: 'd1', params: { w: 9 } }]);
      await tick();
    });
    await act(async () => {
      await result.current.deleteEntity('d1');
      await tick();
    });

    expect(getSvc().remove).toHaveBeenCalledWith('d1');
    expect(onDeleted).toHaveBeenCalledTimes(1);
    expect(lm._state.scene.entities.map((e) => e.id)).not.toContain('d1');
    unmount();
  });

  it('delete-requested event routes through the configured id field', async () => {
    const onDeleted = jest.fn();
    const { hook, getSvc } = buildHook({ onDeleted });
    const lm = makeLevelManager();
    const { unmount } = renderHook(() => hook(baseParams(lm, null)));

    await act(async () => {
      getSvc().onDocs?.([{ id: 'd7', params: { w: 1 } }]);
      await tick();
    });
    await act(async () => {
      EventBus.emit('bim:furniture-delete-requested', { furnitureId: 'd7' });
      await tick();
    });

    expect(getSvc().remove).toHaveBeenCalledWith('d7');
    unmount();
  });

  it('restore: bim:entity-restore-requested → service.save + onRestored', async () => {
    const onRestored = jest.fn();
    const { hook, getSvc } = buildHook({ onRestored });
    const lm = makeLevelManager();
    const { unmount } = renderHook(() => hook(baseParams(lm, null)));

    await act(async () => {
      EventBus.emit('bim:entity-restore-requested', {
        entityType: 'furniture',
        entitySnapshot: ent('r1', 3),
        source: 'undo-delete',
      });
      await tick();
    });

    expect(getSvc().save).toHaveBeenCalledTimes(1);
    expect(onRestored).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('neverUpdate: a known entity re-saves via setDoc (save), never update', async () => {
    const svcs: ReturnType<typeof makeService>[] = [];
    const hook = createBimEntityPersistenceHook<
      ReturnType<typeof makeService>,
      { id: string; params: { w: number } },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      any,
      { w: number }
    >({
      entityType: 'furniture',
      restoreEntityType: 'furniture',
      saveErrorKey: 'E',
      restoreErrorKey: 'E',
      neverUpdate: true,
      entityComparable: (e) => e.params,
      createService: () => {
        const s = makeService();
        svcs.push(s);
        return s;
      },
      service: {
        save: (s, e) => s.save(e),
        update: (s, e) => s.update(e.id, e),
        remove: (s, id) => s.remove(id),
        subscribe: (s, onDocs) => s.subscribe(onDocs),
      },
      merge: {
        mode: 'generic',
        config: {
          isEntity: (e): e is TestEntity => (e as { type?: string }).type === 'furniture',
          docToEntity: (doc: { id: string; params: { w: number } }) => ent(doc.id, doc.params.w),
          entityComparable: (e) => e.params,
          docComparable: (d) => d.params,
        },
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any;
    const lm = makeLevelManager();
    const { rerender, result, unmount } = renderHook(
      ({ sel }: { sel: TestEntity | null }) => hook(baseParams(lm, sel)),
      { initialProps: { sel: null as TestEntity | null } },
    );
    const svc = svcs[svcs.length - 1];
    await act(async () => {
      svc.onDocs?.([{ id: 'd1', params: { w: 9 } }]);
      await tick();
    });
    rerender({ sel: ent('d1', 42) });
    await act(async () => {
      await result.current.saveNow();
      await tick();
    });
    expect(svc.save).toHaveBeenCalledTimes(1);
    expect(svc.update).not.toHaveBeenCalled();
    unmount();
  });

  it('function-config merge seeds the per-instance extra bag; onDeleteCleanup clears it', async () => {
    const seen = new Set<string>();
    const cleared: string[] = [];
    const svcs: ReturnType<typeof makeService>[] = [];
    const hook = createBimEntityPersistenceHook<
      ReturnType<typeof makeService>,
      { id: string; params: { w: number } },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      any,
      { w: number },
      void,
      { seen: Set<string> }
    >({
      entityType: 'furniture',
      restoreEntityType: 'furniture',
      saveErrorKey: 'E',
      restoreErrorKey: 'E',
      entityComparable: (e) => e.params,
      createExtraRefs: () => ({ seen }),
      createService: () => {
        const s = makeService();
        svcs.push(s);
        return s;
      },
      service: {
        save: (s, e) => s.save(e),
        update: (s, e) => s.update(e.id, e),
        remove: (s, id) => s.remove(id),
        subscribe: (s, onDocs) => s.subscribe(onDocs),
      },
      merge: {
        mode: 'generic',
        config: (extra: { seen: Set<string> }) => ({
          isEntity: (e): e is TestEntity => (e as { type?: string }).type === 'furniture',
          docToEntity: (doc: { id: string; params: { w: number } }) => ent(doc.id, doc.params.w),
          entityComparable: (e) => e.params,
          docComparable: (d) => d.params,
          seedExtraBaseline: (doc: { id: string }) => extra.seen.add(doc.id),
        }),
      },
      deleteTrigger: { event: 'bim:furniture-delete-requested', getId: (p) => (p as { furnitureId?: string }).furnitureId },
      onDeleteCleanup: (id, extra) => {
        extra.seen.delete(id);
        cleared.push(id);
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any;
    const lm = makeLevelManager();
    const { result, unmount } = renderHook(() => hook(baseParams(lm, null)));
    const svc = svcs[svcs.length - 1];
    await act(async () => {
      svc.onDocs?.([{ id: 'd1', params: { w: 9 } }]);
      await tick();
    });
    expect(seen.has('d1')).toBe(true);
    await act(async () => {
      await result.current.deleteEntity('d1');
      await tick();
    });
    expect(cleared).toContain('d1');
    expect(seen.has('d1')).toBe(false);
    unmount();
  });

  it('auto-save debounce fires persist after the selected entity params change', async () => {
    jest.useFakeTimers();
    try {
      const onPersisted = jest.fn();
      const { hook, getSvc } = buildHook({ onPersisted });
      const lm = makeLevelManager();
      const { rerender, unmount } = renderHook(
        ({ sel }: { sel: TestEntity | null }) => hook(baseParams(lm, sel)),
        { initialProps: { sel: null as TestEntity | null } },
      );

      // Seed baseline (known) via snapshot.
      act(() => {
        getSvc().onDocs?.([{ id: 'd1', params: { w: 9 } }]);
      });
      // Select with changed params → schedules debounced save.
      rerender({ sel: ent('d1', 77) });
      act(() => {
        jest.advanceTimersByTime(2000);
      });
      // Flush the async persist microtasks.
      await act(async () => {
        await Promise.resolve();
      });

      expect(getSvc().update).toHaveBeenCalledTimes(1);
      unmount();
    } finally {
      jest.useRealTimers();
    }
  });
});
