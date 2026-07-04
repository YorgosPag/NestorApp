/**
 * Wiring test (structural-relevance gate του wall-retrim): αποδεικνύει ότι το
 * `bim:entities-moved` με ΜΗ-δομικό entity (γραμμή) ΔΕΝ πυροδοτεί `recomputeWallTrims`,
 * ενώ με δομικό μέλος (τοίχος/κολόνα) το πυροδοτεί. Κλειδώνει τη διόρθωση 2026-07-04:
 * ο wall-retrim άκουγε το generic `bim:entities-moved` για ΚΑΘΕ entity, οπότε η
 * μετακίνηση μιας απλής γραμμής έτρεχε full `recomputeWallTrims` → (cold, 1η φορά) οι
 * τοίχοι «άλλαζαν» → re-emit structural event → proactive load-takedown σε όλο το κτίριο
 * (spurious toast «N μέλη έλαβαν φορτίο» ΜΟΝΟ στην πρώτη μετακίνηση μετά από hard refresh).
 *
 * @see hooks/tools/useSpecialTools-wall-retrim.ts — ο gate (eventTouchesStructuralMember)
 */

import { act, renderHook } from '@testing-library/react';
import { EventBus } from '../../../systems/events/EventBus';

const recomputeWallTrims = jest.fn();
jest.mock('../../../bim/walls/add-wall-to-scene', () => ({
  recomputeWallTrims: (...args: unknown[]) => recomputeWallTrims(...args),
}));

import { useWallRetrimEffect } from '../useSpecialTools-wall-retrim';
import type { LevelsHookReturn } from '../../../systems/levels';

const levelManager = { currentLevelId: 'lvl-1' } as unknown as LevelsHookReturn;

describe('useWallRetrimEffect — structural-relevance gate (wiring)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    EventBus.clear();
    recomputeWallTrims.mockClear();
  });
  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('μετακίνηση ΓΡΑΜΜΗΣ → ο wall-retrim ΔΕΝ τρέχει (το reported bug)', () => {
    renderHook(() => useWallRetrimEffect(levelManager));
    act(() => {
      EventBus.emit('bim:entities-moved', { movedEntities: [{ id: 'l1', type: 'line' }] } as never);
    });
    act(() => {
      jest.advanceTimersByTime(250); // πέρα από το 200ms debounce
    });
    expect(recomputeWallTrims).not.toHaveBeenCalled();
  });

  it('μετακίνηση ΤΟΙΧΟΥ → ο wall-retrim τρέχει κανονικά', () => {
    renderHook(() => useWallRetrimEffect(levelManager));
    act(() => {
      EventBus.emit('bim:entities-moved', { movedEntities: [{ id: 'w1', type: 'wall' }] } as never);
    });
    act(() => {
      jest.advanceTimersByTime(250);
    });
    expect(recomputeWallTrims).toHaveBeenCalledTimes(1);
  });

  it('μετακίνηση ΚΟΛΟΝΑΣ → ο wall-retrim τρέχει (column-miter dependency)', () => {
    renderHook(() => useWallRetrimEffect(levelManager));
    act(() => {
      EventBus.emit('bim:entities-moved', { movedEntities: [{ id: 'c1', type: 'column' }] } as never);
    });
    act(() => {
      jest.advanceTimersByTime(250);
    });
    expect(recomputeWallTrims).toHaveBeenCalledTimes(1);
  });

  it('bim:wall-params-updated → τρέχει πάντα (ήδη structural-scoped, χωρίς gate)', () => {
    renderHook(() => useWallRetrimEffect(levelManager));
    act(() => {
      EventBus.emit('bim:wall-params-updated', { entityId: 'w1' } as never);
    });
    act(() => {
      jest.advanceTimersByTime(250);
    });
    expect(recomputeWallTrims).toHaveBeenCalledTimes(1);
  });
});
