/**
 * ADR-650 M10 — manual-pick session store + auto-align scene point extraction.
 */

import {
  getGeoRefPickState, armGeoRefPick, disarmGeoRefPick, captureGeoRefPick, clearGeoRefPicks,
} from '../geo-ref-pick-store';
import { sceneEntityCenters } from '../geo-ref-scene-points';
import type { Entity } from '../../../types/entities';

describe('geo-ref-pick-store', () => {
  beforeEach(() => clearGeoRefPicks());
  afterEach(() => clearGeoRefPicks());

  it('captures a click only into the armed slot (one-shot), then disarms', () => {
    expect(getGeoRefPickState().points).toEqual([null, null]);

    // No slot armed → click is ignored.
    captureGeoRefPick({ x: 10, y: 20 });
    expect(getGeoRefPickState().points).toEqual([null, null]);

    armGeoRefPick(0);
    expect(getGeoRefPickState().armedSlot).toBe(0);
    captureGeoRefPick({ x: 41_300, y: 147_600 });
    expect(getGeoRefPickState().points[0]).toEqual({ x: 41_300, y: 147_600 });
    expect(getGeoRefPickState().armedSlot).toBeNull(); // one-shot

    // A second click with nothing armed does not overwrite.
    captureGeoRefPick({ x: 0, y: 0 });
    expect(getGeoRefPickState().points[0]).toEqual({ x: 41_300, y: 147_600 });

    armGeoRefPick(1);
    captureGeoRefPick({ x: 50_000, y: 150_000 });
    expect(getGeoRefPickState().points[1]).toEqual({ x: 50_000, y: 150_000 });
  });

  it('disarm cancels capture without clearing picked points', () => {
    armGeoRefPick(0);
    captureGeoRefPick({ x: 1, y: 2 });
    armGeoRefPick(1);
    disarmGeoRefPick();
    expect(getGeoRefPickState().armedSlot).toBeNull();
    expect(getGeoRefPickState().points[0]).toEqual({ x: 1, y: 2 }); // kept
  });
});

describe('sceneEntityCenters', () => {
  const line = (x1: number, y1: number, x2: number, y2: number): Entity =>
    ({ id: `l_${x1}_${y1}`, type: 'line', layerId: '', start: { x: x1, y: y1 }, end: { x: x2, y: y2 } }) as unknown as Entity;

  it('returns the bbox center of each entity with resolvable bounds', () => {
    const centers = sceneEntityCenters([line(0, 0, 100, 200), line(1000, 1000, 3000, 3000)]);
    expect(centers).toEqual([{ x: 50, y: 100 }, { x: 2000, y: 2000 }]);
  });

  it('returns an empty array for no entities', () => {
    expect(sceneEntityCenters([])).toEqual([]);
  });
});
