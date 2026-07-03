/**
 * ADR-419 Layer 5b — RegionGapMarkersStore (gap-endpoint markers pub/sub).
 */

import {
  setRegionGapMarkers,
  getRegionGapMarkers,
  subscribeRegionGapMarkers,
  clearRegionGapMarkers,
} from '../RegionGapMarkersStore';

afterEach(() => clearRegionGapMarkers());

describe('RegionGapMarkersStore', () => {
  it('starts empty', () => {
    expect(getRegionGapMarkers()).toEqual([]);
  });

  it('stores and returns the markers', () => {
    const pts = [{ x: 0, y: 0 }, { x: 0, y: 30 }];
    setRegionGapMarkers(pts);
    expect(getRegionGapMarkers()).toEqual(pts);
  });

  it('notifies subscribers on set and clear', () => {
    let hits = 0;
    const unsub = subscribeRegionGapMarkers(() => { hits += 1; });
    setRegionGapMarkers([{ x: 1, y: 1 }]);
    expect(hits).toBe(1);
    clearRegionGapMarkers();
    expect(hits).toBe(2);
    unsub();
  });

  it('clear is a no-op (no notify) when already empty', () => {
    let hits = 0;
    const unsub = subscribeRegionGapMarkers(() => { hits += 1; });
    clearRegionGapMarkers(); // already empty → skip notify
    expect(hits).toBe(0);
    unsub();
  });

  it('stops notifying after unsubscribe', () => {
    let hits = 0;
    const unsub = subscribeRegionGapMarkers(() => { hits += 1; });
    unsub();
    setRegionGapMarkers([{ x: 2, y: 2 }]);
    expect(hits).toBe(0);
  });
});
