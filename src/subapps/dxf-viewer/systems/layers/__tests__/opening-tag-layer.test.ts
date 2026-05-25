/**
 * ADR-376 Phase A §4.7 — Opening Tag Layer SSoT unit tests.
 *
 * Covers: getters/setters, no-op on equal state, listener notification,
 * unsubscribe, multi-listener fanout, test reset.
 */

import {
  OPENING_TAG_LAYER_ID,
  isOpeningTagLayerVisible,
  setOpeningTagLayerVisible,
  subscribeOpeningTagLayer,
  __resetOpeningTagLayerForTests,
} from '../opening-tag-layer';

describe('opening-tag-layer SSoT', () => {
  beforeEach(() => {
    __resetOpeningTagLayerForTests();
  });

  it('exposes reserved layer ID constant', () => {
    expect(OPENING_TAG_LAYER_ID).toBe('__system_opening_tags__');
  });

  it('defaults to visible=true', () => {
    expect(isOpeningTagLayerVisible()).toBe(true);
  });

  it('setOpeningTagLayerVisible(false) flips state', () => {
    setOpeningTagLayerVisible(false);
    expect(isOpeningTagLayerVisible()).toBe(false);
  });

  it('setOpeningTagLayerVisible round-trips', () => {
    setOpeningTagLayerVisible(false);
    setOpeningTagLayerVisible(true);
    expect(isOpeningTagLayerVisible()).toBe(true);
  });

  it('notifies subscribed listener on state change', () => {
    const cb = jest.fn();
    subscribeOpeningTagLayer(cb);
    setOpeningTagLayerVisible(false);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('does NOT notify when state is unchanged (idempotent)', () => {
    const cb = jest.fn();
    subscribeOpeningTagLayer(cb);
    setOpeningTagLayerVisible(true); // already true (default)
    expect(cb).not.toHaveBeenCalled();
  });

  it('fans out to multiple listeners', () => {
    const a = jest.fn();
    const b = jest.fn();
    subscribeOpeningTagLayer(a);
    subscribeOpeningTagLayer(b);
    setOpeningTagLayerVisible(false);
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it('unsubscribe removes listener', () => {
    const cb = jest.fn();
    const unsub = subscribeOpeningTagLayer(cb);
    unsub();
    setOpeningTagLayerVisible(false);
    expect(cb).not.toHaveBeenCalled();
  });

  it('__resetOpeningTagLayerForTests restores defaults + clears listeners', () => {
    const cb = jest.fn();
    subscribeOpeningTagLayer(cb);
    setOpeningTagLayerVisible(false);
    expect(cb).toHaveBeenCalledTimes(1);

    __resetOpeningTagLayerForTests();
    expect(isOpeningTagLayerVisible()).toBe(true);

    cb.mockClear();
    setOpeningTagLayerVisible(false);
    expect(cb).not.toHaveBeenCalled(); // listener cleared
  });
});
