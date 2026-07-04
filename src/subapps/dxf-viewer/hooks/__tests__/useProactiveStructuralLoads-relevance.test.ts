/**
 * Wiring test (end-to-end SINGLE-PATH, ADR-459 v19): mount `useStructuralRelevanceRouter` +
 * `useProactiveStructuralLoads`, emit το generic `bim:entities-moved` → ο router κρίνει τη
 * σχετικότητα ΜΙΑ φορά και (μόνο για δομικά) εκπέμπει `bim:structural-geometry-changed`, που ο
 * hook ακούει. Αποδεικνύει: γραμμή → ο πυρήνας `runStructuralLoadTakedown` ΔΕΝ καλείται· κολόνα
 * / μεικτή → καλείται ΜΙΑ φορά. Κλειδώνει το single-path (μηδέν per-subscriber gate).
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
// ADR-459 v19 — end-to-end SINGLE-PATH: ο router κρίνει τη σχετικότητα, ο hook αντιδρά στο σημασιολογικό event.
import { useStructuralRelevanceRouter } from '../useStructuralRelevanceRouter';

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
    renderHook(() => {
      useStructuralRelevanceRouter();
      useProactiveStructuralLoads({ levelManager: {} as never });
    });
    await act(async () => {
      EventBus.emit('bim:entities-moved', {
        movedEntities: [{ id: 'l1', type: 'line' }],
      } as never);
    });
    await flush();
    expect(runStructuralLoadTakedown).not.toHaveBeenCalled();
  });

  it('μετακίνηση ΚΟΛΟΝΑΣ → ο πυρήνας φορτίων καλείται κανονικά', async () => {
    renderHook(() => {
      useStructuralRelevanceRouter();
      useProactiveStructuralLoads({ levelManager: {} as never });
    });
    await act(async () => {
      EventBus.emit('bim:entities-moved', {
        movedEntities: [{ id: 'c1', type: 'column' }],
      } as never);
    });
    await flush();
    expect(runStructuralLoadTakedown).toHaveBeenCalledTimes(1);
  });

  it('μεικτή μετακίνηση (γραμμή + κολόνα) → καλείται (χρειάζεται recompute)', async () => {
    renderHook(() => {
      useStructuralRelevanceRouter();
      useProactiveStructuralLoads({ levelManager: {} as never });
    });
    await act(async () => {
      EventBus.emit('bim:entities-moved', {
        movedEntities: [{ id: 'l1', type: 'line' }, { id: 'c1', type: 'column' }],
      } as never);
    });
    await flush();
    expect(runStructuralLoadTakedown).toHaveBeenCalledTimes(1);
  });
});
