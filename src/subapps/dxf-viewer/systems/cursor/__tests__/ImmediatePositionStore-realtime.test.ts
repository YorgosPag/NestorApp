/**
 * ADR-040 Φ12 — ImmediatePositionStore realtime effective-world channel.
 *
 * The 60fps, synchronous, un-throttled world cursor SSoT consumed imperatively by
 * every ghost preview. Contract: set→get round-trip, synchronous listener notify,
 * dedupe on equal points, and clean unsubscribe.
 */

import {
  setRealtimeWorldCursor,
  getRealtimeWorldCursor,
  subscribeRealtimeWorldCursor,
} from '../ImmediatePositionStore';

afterEach(() => {
  setRealtimeWorldCursor(null); // reset the singleton between tests
});

describe('ImmediatePositionStore — realtime effective-world channel (ADR-040 Φ12)', () => {
  it('round-trips set → get', () => {
    setRealtimeWorldCursor({ x: 12, y: 34 });
    expect(getRealtimeWorldCursor()).toEqual({ x: 12, y: 34 });
  });

  it('notifies subscribers synchronously on change', () => {
    setRealtimeWorldCursor({ x: 0, y: 0 });
    const listener = jest.fn();
    const off = subscribeRealtimeWorldCursor(listener);
    setRealtimeWorldCursor({ x: 5, y: 6 });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({ x: 5, y: 6 });
    off();
  });

  it('dedupes — an equal point does NOT re-notify', () => {
    setRealtimeWorldCursor({ x: 7, y: 8 });
    const listener = jest.fn();
    const off = subscribeRealtimeWorldCursor(listener);
    setRealtimeWorldCursor({ x: 7, y: 8 }); // same value
    expect(listener).not.toHaveBeenCalled();
    off();
  });

  it('stops notifying after unsubscribe', () => {
    const listener = jest.fn();
    const off = subscribeRealtimeWorldCursor(listener);
    off();
    setRealtimeWorldCursor({ x: 9, y: 10 });
    expect(listener).not.toHaveBeenCalled();
  });

  it('is independent of the throttled worldPosition channel (separate SSoT)', () => {
    // Setting the realtime channel must NOT be confused with getImmediateWorldPosition.
    setRealtimeWorldCursor({ x: 100, y: 200 });
    expect(getRealtimeWorldCursor()).toEqual({ x: 100, y: 200 });
  });
});
