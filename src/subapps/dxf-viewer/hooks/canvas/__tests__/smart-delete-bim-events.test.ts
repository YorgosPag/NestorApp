/**
 * smart-delete-bim-events — SSoT id-collection + per-type Firestore delete-event
 * emission for bulk smart-delete.
 *
 * Guards the gap fixed for imported-mesh / generic-solid: both must be collected
 * by type AND emitted, exactly like the other 21 BIM types — otherwise Delete
 * removes them from the scene but never fires `deleteDoc`, so a reload re-adds
 * them (the reported bug). The `emitBimEntityDeleteRequested` SSoT is mocked so
 * the test asserts THIS module's collect/emit wiring, not the event-bus mapping.
 */

import { collectBimDeleteIds, emitBimDeleteEvents } from '../smart-delete-bim-events';
import { emitBimEntityDeleteRequested } from '../../../systems/events/bim-entity-lifecycle-events';
import type { LevelSceneManagerAdapter } from '../../../systems/entity-creation/LevelSceneManagerAdapter';

jest.mock('../../../systems/events/bim-entity-lifecycle-events', () => ({
  emitBimEntityDeleteRequested: jest.fn(),
}));

const emitMock = emitBimEntityDeleteRequested as jest.Mock;

function mkAdapter(typeById: Record<string, string>): LevelSceneManagerAdapter {
  return {
    getEntity: (id: string) => (typeById[id] ? { id, type: typeById[id] } : undefined),
  } as unknown as LevelSceneManagerAdapter;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('collectBimDeleteIds', () => {
  it('partitions imported-mesh and generic-solid ids by type', () => {
    const adapter = mkAdapter({
      m1: 'imported-mesh',
      m2: 'imported-mesh',
      g1: 'generic-solid',
      c1: 'column',
    });
    const collected = collectBimDeleteIds(['m1', 'm2', 'g1', 'c1'], adapter);
    expect(collected.importedMeshIds).toEqual(['m1', 'm2']);
    expect(collected.genericSolidIds).toEqual(['g1']);
    expect(collected.columnIds).toEqual(['c1']);
  });

  it('leaves imported-mesh / generic-solid buckets empty when none present', () => {
    const collected = collectBimDeleteIds(['w1'], mkAdapter({ w1: 'wall' }));
    expect(collected.importedMeshIds).toEqual([]);
    expect(collected.genericSolidIds).toEqual([]);
  });
});

describe('emitBimDeleteEvents', () => {
  const emptyIds = (): ReturnType<typeof collectBimDeleteIds> =>
    collectBimDeleteIds([], mkAdapter({}));

  it('emits a delete-requested event for each imported-mesh id', () => {
    emitBimDeleteEvents({ ...emptyIds(), importedMeshIds: ['m1', 'm2'] });
    expect(emitMock).toHaveBeenCalledWith('imported-mesh', 'm1');
    expect(emitMock).toHaveBeenCalledWith('imported-mesh', 'm2');
  });

  it('emits a delete-requested event for each generic-solid id', () => {
    emitBimDeleteEvents({ ...emptyIds(), genericSolidIds: ['g1'] });
    expect(emitMock).toHaveBeenCalledWith('generic-solid', 'g1');
  });

  it('emits nothing when no ids are collected', () => {
    emitBimDeleteEvents(emptyIds());
    expect(emitMock).not.toHaveBeenCalled();
  });
});
