/**
 * Tests for wall-structural-attach-coordinator (ADR-401 Phase C).
 *
 * Covers the host-deletion warning path: detecting `attached` walls that lose
 * their structural top support and emitting `bim:wall-attach-host-missing`.
 * The associative *follow* behaviour (host move/resize) is intentionally NOT
 * tested here -- it is handled by fresh-recompute in BimSceneLayer.syncWalls /
 * section-intersect / wall-boq-feed, not by this module.
 */

import { notifyWallsOnHostDeletion } from '../wall-structural-attach-coordinator';
import { findAttachedWalls } from '../../cascade/bim-cascade-resolver';
import { EventBus, type DrawingEventPayload } from '../../../systems/events/EventBus';
import type { ISceneManager } from '../../../core/commands/interfaces';
import type { Entity } from '../../../types/entities';

interface FakeEntity {
  id: string;
  type: string;
  params?: Record<string, unknown>;
}

function makeSceneManager(entities: FakeEntity[]): ISceneManager {
  const byId = new Map(entities.map((e) => [e.id, e]));
  return {
    getEntity: (id: string) => byId.get(id) ?? null,
    getEntities: () => [...byId.values()],
    updateEntities: () => {},
    updateEntity: () => {},
  } as unknown as ISceneManager;
}

/** Capture every `bim:wall-attach-host-missing` payload during `fn`. */
function captureHostMissing(
  fn: () => void,
): Array<DrawingEventPayload<'bim:wall-attach-host-missing'>> {
  const events: Array<DrawingEventPayload<'bim:wall-attach-host-missing'>> = [];
  const unsub = EventBus.on('bim:wall-attach-host-missing', (p) => events.push(p));
  try {
    fn();
  } finally {
    unsub();
  }
  return events;
}

const attachedWall = (id: string, hostIds: string[]): FakeEntity => ({
  id,
  type: 'wall',
  params: { topBinding: 'attached', attachTopToIds: hostIds },
});

describe('findAttachedWalls', () => {
  it('returns walls whose attachTopToIds intersect the host set', () => {
    const entities = [
      attachedWall('w1', ['beam1']),
      attachedWall('w2', ['beam2']),
      { id: 'beam1', type: 'beam' },
    ] as unknown as Entity[];
    expect(findAttachedWalls(new Set(['beam1']), entities)).toEqual(['w1']);
  });

  it('ignores walls whose topBinding is not "attached"', () => {
    const entities = [
      { id: 'w1', type: 'wall', params: { topBinding: 'storey-ceiling', attachTopToIds: ['beam1'] } },
    ] as unknown as Entity[];
    expect(findAttachedWalls(new Set(['beam1']), entities)).toEqual([]);
  });

  it('ignores walls with no attachTopToIds', () => {
    const entities = [{ id: 'w1', type: 'wall', params: { topBinding: 'attached' } }] as unknown as Entity[];
    expect(findAttachedWalls(new Set(['beam1']), entities)).toEqual([]);
  });

  it('matches multiple walls and unions multiple hosts', () => {
    const entities = [
      attachedWall('w1', ['beam1']),
      attachedWall('w2', ['slab1', 'beam9']),
      attachedWall('w3', ['beam2']),
    ] as unknown as Entity[];
    expect(findAttachedWalls(new Set(['beam1', 'slab1']), entities).sort()).toEqual(['w1', 'w2']);
  });

  it('no-ops on an empty host set', () => {
    const entities = [attachedWall('w1', ['beam1'])] as unknown as Entity[];
    expect(findAttachedWalls(new Set(), entities)).toEqual([]);
  });
});

describe('notifyWallsOnHostDeletion', () => {
  it('emits one event listing affected walls when a referenced host is deleted', () => {
    const manager = makeSceneManager([
      attachedWall('w1', ['beam1']),
      attachedWall('w2', ['beam1']),
    ]);
    const events = captureHostMissing(() => {
      const affected = notifyWallsOnHostDeletion(['beam1'], manager);
      expect(affected.sort()).toEqual(['w1', 'w2']);
    });
    expect(events).toHaveLength(1);
    expect(events[0].wallIds.slice().sort()).toEqual(['w1', 'w2']);
    expect(events[0].deletedHostIds).toEqual(['beam1']);
  });

  it('does NOT emit when the deleted entity hosts no attached wall', () => {
    const manager = makeSceneManager([attachedWall('w1', ['beam1'])]);
    const events = captureHostMissing(() => {
      expect(notifyWallsOnHostDeletion(['beam2'], manager)).toEqual([]);
    });
    expect(events).toHaveLength(0);
  });

  it('does NOT emit for a non-attached wall referencing the host', () => {
    const manager = makeSceneManager([
      { id: 'w1', type: 'wall', params: { topBinding: 'storey-ceiling', attachTopToIds: ['beam1'] } },
    ]);
    const events = captureHostMissing(() => {
      expect(notifyWallsOnHostDeletion(['beam1'], manager)).toEqual([]);
    });
    expect(events).toHaveLength(0);
  });

  it('no-ops on empty input or a manager without getEntities', () => {
    expect(notifyWallsOnHostDeletion([], makeSceneManager([]))).toEqual([]);
    const bare = { getEntity: () => null } as unknown as ISceneManager;
    expect(notifyWallsOnHostDeletion(['beam1'], bare)).toEqual([]);
  });
});
