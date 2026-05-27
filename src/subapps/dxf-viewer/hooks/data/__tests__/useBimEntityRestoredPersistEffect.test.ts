/**
 * ADR-390 Phase 3 — useBimEntityRestoredPersistEffect SSoT hook tests.
 *
 * Coverage:
 *  - Type-discriminator filter (wrong entityType → no-op)
 *  - Service-null guard (serviceRef.current === null → no-op)
 *  - Type-guard rejection (isEntityType returns false → no-op)
 *  - Happy path: pending add + tombstone clear + persistRestore invoke
 *  - Unsubscribe on unmount (no leak after component unmounts)
 */

import { renderHook } from '@testing-library/react';
import { act } from 'react';

import { EventBus } from '../../../systems/events/EventBus';
import { useBimEntityRestoredPersistEffect } from '../useBimEntityRestoredPersistEffect';
import type { AnySceneEntity } from '../../../types/entities';

type SlabLike = AnySceneEntity & { type: 'slab'; id: string };
type WallLike = AnySceneEntity & { type: 'wall'; id: string };

function makeSlab(id = 'slab_x'): SlabLike {
  return { id, type: 'slab' } as unknown as SlabLike;
}

function makeWall(id = 'wall_x'): WallLike {
  return { id, type: 'wall' } as unknown as WallLike;
}

function isSlab(e: AnySceneEntity): e is SlabLike {
  return (e as { type?: string }).type === 'slab';
}

function setupHook(opts: {
  serviceRef?: { current: { tag: string } | null };
  pendingRef?: { current: Set<string> };
  deletedRef?: { current: Set<string> };
  persistRestore?: jest.Mock;
}) {
  const serviceRef = opts.serviceRef ?? { current: { tag: 'svc' } };
  const pendingRef = opts.pendingRef ?? { current: new Set<string>() };
  const deletedRef = opts.deletedRef ?? { current: new Set<string>() };
  const persistRestore = opts.persistRestore ?? jest.fn().mockResolvedValue(undefined);

  const { unmount } = renderHook(() =>
    useBimEntityRestoredPersistEffect<SlabLike, { tag: string }>(
      'slab',
      isSlab,
      serviceRef,
      pendingRef,
      deletedRef,
      persistRestore,
    ),
  );

  return { serviceRef, pendingRef, deletedRef, persistRestore, unmount };
}

describe('useBimEntityRestoredPersistEffect — ADR-390 SSoT subscriber', () => {
  it('invokes persistRestore when payload.entityType matches', () => {
    const { persistRestore, pendingRef, deletedRef } = setupHook({});
    const slab = makeSlab('slab_42');
    deletedRef.current.add('slab_42'); // pre-existing tombstone

    act(() => {
      EventBus.emit('bim:entity-restore-requested', {
        entityType: 'slab',
        entitySnapshot: slab,
        source: 'undo-delete',
      });
    });

    expect(persistRestore).toHaveBeenCalledTimes(1);
    expect(persistRestore).toHaveBeenCalledWith(slab);
    expect(pendingRef.current.has('slab_42')).toBe(true);
    expect(deletedRef.current.has('slab_42')).toBe(false);
  });

  it('does NOT invoke persistRestore when payload.entityType differs', () => {
    const { persistRestore } = setupHook({});
    const wall = makeWall();

    act(() => {
      EventBus.emit('bim:entity-restore-requested', {
        entityType: 'wall',
        entitySnapshot: wall,
        source: 'undo-delete',
      });
    });

    expect(persistRestore).not.toHaveBeenCalled();
  });

  it('does NOT invoke persistRestore when serviceRef.current is null', () => {
    const persistRestore = jest.fn().mockResolvedValue(undefined);
    setupHook({
      serviceRef: { current: null },
      persistRestore,
    });
    const slab = makeSlab();

    act(() => {
      EventBus.emit('bim:entity-restore-requested', {
        entityType: 'slab',
        entitySnapshot: slab,
        source: 'undo-delete',
      });
    });

    expect(persistRestore).not.toHaveBeenCalled();
  });

  it('does NOT invoke persistRestore when isEntityType returns false', () => {
    const { persistRestore } = setupHook({});
    const malformed = { id: 'x_1', type: 'slab-imposter' } as unknown as AnySceneEntity;

    act(() => {
      EventBus.emit('bim:entity-restore-requested', {
        entityType: 'slab',
        entitySnapshot: malformed,
        source: 'undo-delete',
      });
    });

    expect(persistRestore).not.toHaveBeenCalled();
  });

  it('adds id to pendingFirstSaveIdsRef BEFORE persistRestore returns', () => {
    let pendingAtCallTime = false;
    const persistRestore = jest.fn().mockImplementation((entity: SlabLike) => {
      pendingAtCallTime = pendingRef.current.has(entity.id);
      return Promise.resolve();
    });
    const pendingRef = { current: new Set<string>() };
    setupHook({ pendingRef, persistRestore });

    const slab = makeSlab('slab_race');
    act(() => {
      EventBus.emit('bim:entity-restore-requested', {
        entityType: 'slab',
        entitySnapshot: slab,
        source: 'undo-delete',
      });
    });

    expect(pendingAtCallTime).toBe(true);
  });

  it('unsubscribes on unmount (no persistRestore after teardown)', () => {
    const { persistRestore, unmount } = setupHook({});
    unmount();

    act(() => {
      EventBus.emit('bim:entity-restore-requested', {
        entityType: 'slab',
        entitySnapshot: makeSlab(),
        source: 'undo-delete',
      });
    });

    expect(persistRestore).not.toHaveBeenCalled();
  });

  it('handles multiple restore events in sequence', () => {
    const { persistRestore } = setupHook({});
    const slab1 = makeSlab('slab_a');
    const slab2 = makeSlab('slab_b');

    act(() => {
      EventBus.emit('bim:entity-restore-requested', {
        entityType: 'slab',
        entitySnapshot: slab1,
        source: 'undo-delete',
      });
      EventBus.emit('bim:entity-restore-requested', {
        entityType: 'slab',
        entitySnapshot: slab2,
        source: 'undo-delete',
      });
    });

    expect(persistRestore).toHaveBeenCalledTimes(2);
    expect(persistRestore.mock.calls[0][0].id).toBe('slab_a');
    expect(persistRestore.mock.calls[1][0].id).toBe('slab_b');
  });
});
