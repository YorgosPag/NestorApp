/**
 * ADR-358 (Q19 click-on-canvas carryover) — stair sub-element selection store tests.
 *
 * Covers the LOW-frequency reactive selection (select / clear / Tab-cycle wrap) and
 * the NON-REACTIVE hover singleton (set / reset + reset-on-select/clear coupling).
 *
 * @see ../stair-sub-element-selection-store.ts
 */

import {
  useStairSubElementSelectionStore,
  isSameStairSubElement,
  setStairSubElementHover,
  resetStairSubElementHover,
  getStairSubElementHover,
  subscribeStairSubElementHover,
  type StairSubElementRef,
} from '../stair-sub-element-selection-store';

const S = 'stair_test_1';
const tread = (index: number): StairSubElementRef => ({ stairId: S, part: 'tread', index });

describe('stair-sub-element-selection-store', () => {
  beforeEach(() => {
    useStairSubElementSelectionStore.setState({ selected: null });
    resetStairSubElementHover();
  });

  describe('selection (reactive)', () => {
    it('selectSub sets the selected ref', () => {
      useStairSubElementSelectionStore.getState().selectSub(tread(3));
      expect(useStairSubElementSelectionStore.getState().selected).toEqual(tread(3));
    });

    it('clear drops the selection', () => {
      useStairSubElementSelectionStore.getState().selectSub(tread(3));
      useStairSubElementSelectionStore.getState().clear();
      expect(useStairSubElementSelectionStore.getState().selected).toBeNull();
    });

    it('cycleNext advances the index', () => {
      useStairSubElementSelectionStore.getState().selectSub(tread(0));
      useStairSubElementSelectionStore.getState().cycleNext(5);
      expect(useStairSubElementSelectionStore.getState().selected).toEqual(tread(1));
    });

    it('cycleNext wraps around modulo count', () => {
      useStairSubElementSelectionStore.getState().selectSub(tread(4));
      useStairSubElementSelectionStore.getState().cycleNext(5);
      expect(useStairSubElementSelectionStore.getState().selected).toEqual(tread(0));
    });

    it('cycleNext is a no-op when nothing is selected', () => {
      useStairSubElementSelectionStore.getState().cycleNext(5);
      expect(useStairSubElementSelectionStore.getState().selected).toBeNull();
    });

    it('cycleNext is a no-op when count <= 0', () => {
      useStairSubElementSelectionStore.getState().selectSub(tread(2));
      useStairSubElementSelectionStore.getState().cycleNext(0);
      expect(useStairSubElementSelectionStore.getState().selected).toEqual(tread(2));
    });
  });

  describe('hover (non-reactive singleton)', () => {
    it('set / reset mutate the singleton', () => {
      setStairSubElementHover(tread(7));
      expect(getStairSubElementHover()).toEqual(tread(7));
      resetStairSubElementHover();
      expect(getStairSubElementHover()).toBeNull();
    });

    it('selectSub resets hover (indices go stale on a new selection)', () => {
      setStairSubElementHover(tread(7));
      useStairSubElementSelectionStore.getState().selectSub(tread(1));
      expect(getStairSubElementHover()).toBeNull();
    });

    it('clear resets hover', () => {
      setStairSubElementHover(tread(7));
      useStairSubElementSelectionStore.getState().clear();
      expect(getStairSubElementHover()).toBeNull();
    });

    it('getStairSubElementHover reflects the singleton', () => {
      setStairSubElementHover(tread(2));
      expect(getStairSubElementHover()).toEqual(tread(2));
    });
  });

  describe('hover subscription (Φ3c redraw trigger)', () => {
    it('notifies subscribers on a genuine change', () => {
      const cb = jest.fn();
      const unsub = subscribeStairSubElementHover(cb);
      setStairSubElementHover(tread(1));
      expect(cb).toHaveBeenCalledTimes(1);
      unsub();
    });

    it('skips notify + mutation when unchanged (same tread move = zero redraw)', () => {
      setStairSubElementHover(tread(1));
      const cb = jest.fn();
      const unsub = subscribeStairSubElementHover(cb);
      setStairSubElementHover(tread(1)); // structurally identical
      expect(cb).not.toHaveBeenCalled();
      unsub();
    });

    it('stops notifying after unsubscribe', () => {
      const cb = jest.fn();
      subscribeStairSubElementHover(cb)();
      setStairSubElementHover(tread(3));
      expect(cb).not.toHaveBeenCalled();
    });
  });

  describe('isSameStairSubElement', () => {
    it('true for structurally-equal refs', () => {
      expect(isSameStairSubElement(tread(3), tread(3))).toBe(true);
    });

    it('false when index / part / stairId differ', () => {
      expect(isSameStairSubElement(tread(3), tread(4))).toBe(false);
      expect(isSameStairSubElement(tread(3), { stairId: S, part: 'riser', index: 3 })).toBe(false);
      expect(isSameStairSubElement(tread(3), { stairId: 'other', part: 'tread', index: 3 })).toBe(false);
    });

    it('true for two nulls, false for one null', () => {
      expect(isSameStairSubElement(null, null)).toBe(true);
      expect(isSameStairSubElement(tread(3), null)).toBe(false);
      expect(isSameStairSubElement(null, tread(3))).toBe(false);
    });
  });
});
