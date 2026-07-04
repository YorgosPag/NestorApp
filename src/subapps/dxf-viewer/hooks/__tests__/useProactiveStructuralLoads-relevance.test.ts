/**
 * Wiring test (end-to-end του gate): αποδεικνύει ότι το `bim:entities-moved` με
 * ΜΗ-δομικό entity (γραμμή) ΔΕΝ καλεί τον πυρήνα `runStructuralLoadTakedown`, ενώ με
 * δομικό μέλος (κολόνα) τον καλεί. Κλειδώνει τη διόρθωση 2026-07-04 στη σωστή στρώση
 * (useGroupedStructuralReaction → eventTouchesStructuralMember), όχι μόνο τον predicate.
 */

import { act, renderHook } from '@testing-library/react';
import { EventBus } from '../../systems/events/EventBus';
import { resetGlobalCommandHistory } from '../../core/commands/CommandHistory';

const runStructuralLoadTakedown = jest.fn();
jest.mock('../structural-load-takedown-core', () => ({
  runStructuralLoadTakedown: (...args: unknown[]) => runStructuralLoadTakedown(...args),
}));
jest.mock('../useBuildingStoreyCount', () => ({ useBuildingStoreyCount: () => 1 }));
jest.mock('../useBuildingOccupancy', () => ({ useBuildingOccupancy: () => 'residential' }));
jest.mock('../../bim/structural/loads/occupancy-loads', () => ({
  resolveEffectiveAreaLoads: () => ({ deadAreaLoadKpa: 0, liveAreaLoadKpa: 0 }),
}));
jest.mock('../../bim/hosting/guide-store-offset-lookup', () => ({ makeGuideOffsetLookup: () => ({}) }));
jest.mock('../../state/structural-settings-store', () => ({
  useStructuralSettingsStore: { getState: () => ({}) },
}));

import { useProactiveStructuralLoads } from '../useProactiveStructuralLoads';

async function flush(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('useProactiveStructuralLoads — structural-relevance gate (wiring)', () => {
  beforeEach(() => {
    resetGlobalCommandHistory();
    EventBus.clear();
    runStructuralLoadTakedown.mockClear();
  });

  it('μετακίνηση ΓΡΑΜΜΗΣ → ο πυρήνας φορτίων ΔΕΝ καλείται (το reported bug)', async () => {
    renderHook(() => useProactiveStructuralLoads({ levelManager: {} as never }));
    await act(async () => {
      EventBus.emit('bim:entities-moved', {
        movedEntities: [{ id: 'l1', type: 'line' }],
      } as never);
    });
    await flush();
    expect(runStructuralLoadTakedown).not.toHaveBeenCalled();
  });

  it('μετακίνηση ΚΟΛΟΝΑΣ → ο πυρήνας φορτίων καλείται κανονικά', async () => {
    renderHook(() => useProactiveStructuralLoads({ levelManager: {} as never }));
    await act(async () => {
      EventBus.emit('bim:entities-moved', {
        movedEntities: [{ id: 'c1', type: 'column' }],
      } as never);
    });
    await flush();
    expect(runStructuralLoadTakedown).toHaveBeenCalledTimes(1);
  });

  it('μεικτή μετακίνηση (γραμμή + κολόνα) → καλείται (χρειάζεται recompute)', async () => {
    renderHook(() => useProactiveStructuralLoads({ levelManager: {} as never }));
    await act(async () => {
      EventBus.emit('bim:entities-moved', {
        movedEntities: [{ id: 'l1', type: 'line' }, { id: 'c1', type: 'column' }],
      } as never);
    });
    await flush();
    expect(runStructuralLoadTakedown).toHaveBeenCalledTimes(1);
  });
});
