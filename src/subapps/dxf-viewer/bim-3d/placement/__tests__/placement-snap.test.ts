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

// ADR-544 — resolvePlacementSnapWithView uses the REAL global engine (ProSnapResult w/ description);
// mock it so we can assert the OSNAP view is surfaced from the SAME single query.
const mockFindSnapPoint = jest.fn();
const mockEnabled = { value: true };
jest.mock('../../../snapping/global-snap-engine', () => ({
  getGlobalSnapEngine: () => ({
    getSettings: () => ({ enabled: mockEnabled.value }),
    findSnapPoint: (p: unknown) => mockFindSnapPoint(p),
  }),
}));

import { resolvePlacementSnap, resolvePlacementSnapWithView, type PlacementSnapEngine } from '../placement-snap';
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

describe('resolvePlacementSnapWithView (ADR-544)', () => {
  beforeEach(() => { mockFindSnapPoint.mockReset(); mockEnabled.value = true; });

  it('returns null when OSNAP is disabled', () => {
    mockEnabled.value = false;
    expect(resolvePlacementSnapWithView({ x: 1, y: 2 })).toBeNull();
    expect(mockFindSnapPoint).not.toHaveBeenCalled();
  });

  it('surfaces snapped point + OSNAP view (glyph+label) from ONE engine query', () => {
    const pt = { x: 100, y: 200 };
    mockFindSnapPoint.mockReturnValue({
      found: true, snapPoint: { point: pt, description: 'Γωνία κολόνας' },
      snappedPoint: pt, activeMode: 'endpoint', allCandidates: [], originalPoint: { x: 0, y: 0 }, timestamp: 0,
    });
    const r = resolvePlacementSnapWithView({ x: 90, y: 210 });
    expect(mockFindSnapPoint).toHaveBeenCalledTimes(1); // single query → position + view
    expect(r?.snappedMm).toEqual(pt);
    expect(r?.view).toEqual({ point: pt, type: 'endpoint', description: 'Γωνία κολόνας' });
  });

  it('returns null when no feature is within tolerance', () => {
    mockFindSnapPoint.mockReturnValue({ found: false, snapPoint: null });
    expect(resolvePlacementSnapWithView({ x: 0, y: 0 })).toBeNull();
  });
});
