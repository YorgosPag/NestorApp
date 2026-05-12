/**
 * ADR-344 Phase 11.E — Tests for ViewportStore plain singleton.
 *
 * Covers: granular subscriber notification, skip-if-unchanged, getter
 * synchronicity, scale list equality semantics.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import type { AnnotationScale } from '../../../text-engine/types';

// Reset module state between tests
beforeEach(() => {
  jest.isolateModules(() => {
    // Force a fresh import per test to get clean state
  });
});

// We import lazily because the store is a module-level singleton and we want
// the `__resetViewportStoreForTests` hook to clear state between tests.
import * as ViewportStoreModule from '../ViewportStore';
const {
  getActiveScaleName,
  getScaleList,
  getActiveScale,
  setActiveScale,
  setScaleList,
  subscribeActiveScale,
  subscribeScaleList,
  __resetViewportStoreForTests,
} = ViewportStoreModule;

// Mock UnifiedFrameScheduler to silence markSystemsDirty side-effects during tests.
jest.mock('../../../rendering/core/UnifiedFrameScheduler', () => ({
  markSystemsDirty: jest.fn(),
}));

describe('ViewportStore', () => {
  beforeEach(() => {
    __resetViewportStoreForTests();
  });

  describe('default state', () => {
    it('initializes activeScaleName to "1:1"', () => {
      expect(getActiveScaleName()).toBe('1:1');
    });

    it('initializes scaleList with 10 standard AutoCAD scales', () => {
      const list = getScaleList();
      expect(list).toHaveLength(10);
      expect(list[0].name).toBe('1:1');
      expect(list[list.length - 1].name).toBe('1:1000');
    });

    it('resolves active scale to the matching list entry', () => {
      const active = getActiveScale();
      expect(active).not.toBeNull();
      expect(active!.name).toBe('1:1');
    });
  });

  describe('setActiveScale', () => {
    it('notifies activeScale subscribers on change', () => {
      const cb = jest.fn();
      subscribeActiveScale(cb);

      setActiveScale('1:50');

      expect(cb).toHaveBeenCalledTimes(1);
      expect(getActiveScaleName()).toBe('1:50');
    });

    it('skips notification when value is unchanged (skip-if-unchanged)', () => {
      const cb = jest.fn();
      subscribeActiveScale(cb);

      setActiveScale('1:1'); // identical to default

      expect(cb).not.toHaveBeenCalled();
    });

    it('does NOT notify scaleList subscribers on active-scale change', () => {
      const listCb = jest.fn();
      subscribeScaleList(listCb);

      setActiveScale('1:100');

      expect(listCb).not.toHaveBeenCalled();
    });

    it('unsubscribe stops further notifications', () => {
      const cb = jest.fn();
      const unsubscribe = subscribeActiveScale(cb);

      setActiveScale('1:50');
      unsubscribe();
      setActiveScale('1:100');

      expect(cb).toHaveBeenCalledTimes(1);
    });
  });

  describe('setScaleList', () => {
    const customList: readonly AnnotationScale[] = [
      { name: 'Custom-A', paperHeight: 2.5, modelHeight: 5 },
      { name: 'Custom-B', paperHeight: 2.5, modelHeight: 10 },
    ];

    it('notifies scaleList subscribers on change', () => {
      const cb = jest.fn();
      subscribeScaleList(cb);

      setScaleList(customList);

      expect(cb).toHaveBeenCalledTimes(1);
      expect(getScaleList()).toBe(customList);
    });

    it('skips notification when content is identical (deep equality)', () => {
      setScaleList(customList);
      const cb = jest.fn();
      subscribeScaleList(cb);

      // Pass a NEW array reference with identical contents
      const identicalClone: readonly AnnotationScale[] = customList.map((s) => ({ ...s }));
      setScaleList(identicalClone);

      expect(cb).not.toHaveBeenCalled();
    });

    it('notifies when paperHeight differs even if name matches', () => {
      setScaleList(customList);
      const cb = jest.fn();
      subscribeScaleList(cb);

      const tweaked: readonly AnnotationScale[] = [
        { name: 'Custom-A', paperHeight: 5, modelHeight: 5 }, // paperHeight changed
        { name: 'Custom-B', paperHeight: 2.5, modelHeight: 10 },
      ];
      setScaleList(tweaked);

      expect(cb).toHaveBeenCalledTimes(1);
    });

    it('does NOT notify activeScale subscribers on list change', () => {
      const activeCb = jest.fn();
      subscribeActiveScale(activeCb);

      setScaleList(customList);

      expect(activeCb).not.toHaveBeenCalled();
    });
  });

  describe('getActiveScale resolution', () => {
    it('returns null when active name is not in list', () => {
      setActiveScale('NonExistent');
      expect(getActiveScale()).toBeNull();
    });

    it('returns matching entry when active name is in list', () => {
      setActiveScale('1:100');
      const entry = getActiveScale();
      expect(entry?.name).toBe('1:100');
    });
  });

  describe('getter synchronicity (no listener required)', () => {
    it('getActiveScaleName returns immediately without subscription', () => {
      setActiveScale('1:200');
      expect(getActiveScaleName()).toBe('1:200');
    });

    it('getScaleList returns immediately without subscription', () => {
      const list: readonly AnnotationScale[] = [
        { name: 'Solo', paperHeight: 1, modelHeight: 1 },
      ];
      setScaleList(list);
      expect(getScaleList()).toBe(list);
    });
  });
});
