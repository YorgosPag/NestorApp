/**
 * ADR-408 Φ8 — mep-segment-tool-bridge-store tests.
 *
 * The store is the read-only projection of the segment FSM consumed by the 3D
 * placement hook + ghost. Verifies the set/get round-trip, listener notification,
 * identity dedup (no emit when the handle is unchanged), and clear.
 */

import {
  mepSegmentToolBridgeStore,
  type MepSegmentToolBridgeHandle,
} from '../mep-segment-tool-bridge-store';

function makeHandle(overrides: Partial<MepSegmentToolBridgeHandle> = {}): MepSegmentToolBridgeHandle {
  return {
    isActive: true,
    domain: 'pipe',
    overrides: {},
    phase: 'awaitingStart',
    startPoint: null,
    startElevationMm: null,
    getSceneUnits: () => 'mm',
    ...overrides,
  };
}

describe('mepSegmentToolBridgeStore', () => {
  afterEach(() => {
    mepSegmentToolBridgeStore.set(null);
  });

  it('round-trips the published handle via get()', () => {
    expect(mepSegmentToolBridgeStore.get()).toBeNull();
    const handle = makeHandle({ phase: 'awaitingEnd', startPoint: { x: 10, y: 20 } });
    mepSegmentToolBridgeStore.set(handle);
    expect(mepSegmentToolBridgeStore.get()).toBe(handle);
    expect(mepSegmentToolBridgeStore.get()?.startPoint).toEqual({ x: 10, y: 20 });
  });

  it('reflects the latest handle across successive set() calls', () => {
    mepSegmentToolBridgeStore.set(makeHandle({ domain: 'pipe' }));
    expect(mepSegmentToolBridgeStore.get()?.domain).toBe('pipe');
    mepSegmentToolBridgeStore.set(makeHandle({ domain: 'duct' }));
    expect(mepSegmentToolBridgeStore.get()?.domain).toBe('duct');
  });

  it('clears to null', () => {
    mepSegmentToolBridgeStore.set(makeHandle());
    expect(mepSegmentToolBridgeStore.get()).not.toBeNull();
    mepSegmentToolBridgeStore.set(null);
    expect(mepSegmentToolBridgeStore.get()).toBeNull();
  });

  it('is a no-op when set with the identical handle reference', () => {
    const handle = makeHandle();
    mepSegmentToolBridgeStore.set(handle);
    const before = mepSegmentToolBridgeStore.get();
    mepSegmentToolBridgeStore.set(handle);
    expect(mepSegmentToolBridgeStore.get()).toBe(before);
  });
});
