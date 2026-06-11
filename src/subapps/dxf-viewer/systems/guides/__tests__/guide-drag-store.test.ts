/**
 * ADR-441 Slice 3-perf — guide-drag-store tests.
 * Imperative drag-state SSoT: set/get/subscribe/no-op-on-same.
 */

import {
  getDraggingGuideId,
  setDraggingGuideId,
  subscribeGuideDrag,
} from '../guide-drag-store';

afterEach(() => setDraggingGuideId(null));

describe('guide-drag-store', () => {
  it('get returns null initially / after clear', () => {
    expect(getDraggingGuideId()).toBeNull();
  });

  it('set then get returns the id; clear resets to null', () => {
    setDraggingGuideId('guide_X_1');
    expect(getDraggingGuideId()).toBe('guide_X_1');
    setDraggingGuideId(null);
    expect(getDraggingGuideId()).toBeNull();
  });

  it('subscribe fires on change, not on same-value set', () => {
    let calls = 0;
    const off = subscribeGuideDrag(() => { calls++; });
    setDraggingGuideId('g1');
    setDraggingGuideId('g1'); // no-op (same)
    setDraggingGuideId('g2');
    setDraggingGuideId(null);
    off();
    setDraggingGuideId('g3'); // after unsubscribe → not counted
    expect(calls).toBe(3);
  });
});
