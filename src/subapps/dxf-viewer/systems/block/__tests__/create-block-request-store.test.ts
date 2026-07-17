/**
 * ADR-652 M6 — create-block-request-store (action → dialog host signal).
 * Επιβεβαιώνει: null start, snapshot COPY (όχι alias του caller array), clear→null, subscribe/unsub.
 */

import {
  requestCreateBlockFromSelection,
  clearCreateBlockRequest,
  getCreateBlockRequest,
  subscribeCreateBlockRequest,
  __resetCreateBlockRequestForTests,
} from '../create-block-request-store';

describe('ADR-652 M6 — create-block-request-store', () => {
  afterEach(() => __resetCreateBlockRequestForTests());

  it('starts null (no active request → host stays unmounted)', () => {
    expect(getCreateBlockRequest()).toBeNull();
  });

  it('stores a COPY of the selection snapshot (later caller mutation does not leak in)', () => {
    const ids = ['a', 'b'];
    requestCreateBlockFromSelection(ids);
    expect(getCreateBlockRequest()).toEqual(['a', 'b']);

    ids.push('c'); // mutate the ORIGINAL array the caller passed
    expect(getCreateBlockRequest()).toEqual(['a', 'b']); // snapshot unaffected
  });

  it('clear resets to null', () => {
    requestCreateBlockFromSelection(['a']);
    clearCreateBlockRequest();
    expect(getCreateBlockRequest()).toBeNull();
  });

  it('notifies subscribers on request + clear, and stops after unsubscribe', () => {
    const cb = jest.fn();
    const unsub = subscribeCreateBlockRequest(cb);

    requestCreateBlockFromSelection(['a']);
    clearCreateBlockRequest();
    expect(cb).toHaveBeenCalledTimes(2);

    unsub();
    requestCreateBlockFromSelection(['b']);
    expect(cb).toHaveBeenCalledTimes(2); // no further calls after unsub
  });
});
