/**
 * ADR-403 Phase 2 — placement-snap OSNAP resolver unit tests.
 *
 * Verifies the three branches with an injected fake engine (no scene / singleton):
 *   - OSNAP off            → null (free placement)
 *   - OSNAP on, hit        → snappedMm + markerMm = the snap target
 *   - OSNAP on, no feature → null (caller keeps the raw point)
 * Plus that the cursor is probed verbatim in plan mm and no exclude id is passed
 * (the placed element does not exist yet).
 */

import { resolvePlacementSnap, type PlacementSnapEngine } from '../placement-snap';
import type { Point2D } from '../../../rendering/types/Types';
import { ExtendedSnapType } from '../../../snapping/extended-types';

type FindResult = {
  found: boolean;
  snapPoint: { point: Point2D; entityId?: string; type?: ExtendedSnapType } | null;
};

function makeEngine(enabled: boolean, result: FindResult): {
  engine: PlacementSnapEngine;
  calls: Array<{ cursor: Point2D; excludeEntityId?: string }>;
} {
  const calls: Array<{ cursor: Point2D; excludeEntityId?: string }> = [];
  const engine: PlacementSnapEngine = {
    getSettings: () => ({ enabled }),
    findSnapPoint: (cursor, excludeEntityId) => {
      calls.push({ cursor, excludeEntityId });
      return result;
    },
  };
  return { engine, calls };
}

describe('resolvePlacementSnap', () => {
  it('returns null when OSNAP is disabled (free placement)', () => {
    const { engine, calls } = makeEngine(false, { found: true, snapPoint: { point: { x: 1, y: 2 } } });
    expect(resolvePlacementSnap({ x: 100, y: 200 }, engine)).toBeNull();
    expect(calls).toHaveLength(0); // short-circuits before querying the engine
  });

  it('returns the snap target for snappedMm + markerMm on a hit', () => {
    const target = { x: 4200, y: -1500 };
    const { engine } = makeEngine(true, { found: true, snapPoint: { point: target } });
    const r = resolvePlacementSnap({ x: 4180, y: -1490 }, engine);
    expect(r).toEqual({ snappedMm: target, markerMm: target });
  });

  it('surfaces the snap candidate entityId + type (ADR-408 Φ-B1 connector-mate)', () => {
    const target = { x: 100, y: 200 };
    const { engine } = makeEngine(true, {
      found: true,
      snapPoint: { point: target, entityId: 'mfld-1', type: ExtendedSnapType.BIM_MEP_CONNECTOR },
    });
    const r = resolvePlacementSnap({ x: 90, y: 210 }, engine);
    expect(r).toEqual({
      snappedMm: target,
      markerMm: target,
      snapEntityId: 'mfld-1',
      snapType: ExtendedSnapType.BIM_MEP_CONNECTOR,
    });
  });

  it('returns null when OSNAP is on but no feature is within tolerance', () => {
    const { engine } = makeEngine(true, { found: false, snapPoint: null });
    expect(resolvePlacementSnap({ x: 0, y: 0 }, engine)).toBeNull();
  });

  it('returns null when found is true but snapPoint is missing (defensive)', () => {
    const { engine } = makeEngine(true, { found: true, snapPoint: null });
    expect(resolvePlacementSnap({ x: 0, y: 0 }, engine)).toBeNull();
  });

  it('probes the cursor verbatim in plan mm and passes no exclude id', () => {
    const { engine, calls } = makeEngine(true, { found: true, snapPoint: { point: { x: 0, y: 0 } } });
    resolvePlacementSnap({ x: 12345, y: -6789 }, engine);
    expect(calls).toHaveLength(1);
    expect(calls[0].cursor).toEqual({ x: 12345, y: -6789 });
    expect(calls[0].excludeEntityId).toBeUndefined();
  });
});
