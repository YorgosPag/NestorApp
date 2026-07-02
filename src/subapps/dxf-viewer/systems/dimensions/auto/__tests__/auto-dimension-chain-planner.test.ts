/**
 * ADR-563 — chain planner unit tests.
 */

import { planChains } from '../auto-dimension-chain-planner';
import {
  AUTO_DIMENSION_DEFAULTS,
  type AutoDimSide,
  type AutoDimTier,
  type Bounds2D,
  type ReferencePoint,
} from '../auto-dimension-types';

const OVERALL: Bounds2D = { min: { x: 0, y: 0 }, max: { x: 2400, y: 400 } };

function ref(coord: number, side: AutoDimSide, tier: AutoDimTier, id = ''): ReferencePoint {
  return { coord, side, tier, sourceEntityId: id, edge: 'center' };
}

describe('planChains', () => {
  it('emits one segment per adjacent coordinate pair', () => {
    const pts = [
      ref(0, 'south', 'detail', 'a'),
      ref(400, 'south', 'detail', 'b'),
      ref(2000, 'south', 'detail', 'c'),
      ref(2400, 'south', 'detail', 'd'),
    ];
    const segs = planChains(pts, OVERALL, AUTO_DIMENSION_DEFAULTS);
    expect(segs).toHaveLength(3);
  });

  it('builds south def points with the detail-tier offset below the model', () => {
    const segs = planChains(
      [ref(0, 'south', 'detail', 'a'), ref(400, 'south', 'detail', 'b')],
      OVERALL,
      AUTO_DIMENSION_DEFAULTS,
    );
    const [s] = segs;
    // detail tier index 0 → offset = offsetFromModel (600); south dim line below (y negative)
    expect(s.defPoints[0]).toEqual({ x: 0, y: 0 });
    expect(s.defPoints[1]).toEqual({ x: 400, y: 0 });
    expect(s.defPoints[2]).toEqual({ x: 0, y: -600 });
    expect(s.rotation).toBe(0);
  });

  it('stacks tiers outward (axes farther than detail, overall farthest)', () => {
    const detail = planChains([ref(0, 'south', 'detail'), ref(400, 'south', 'detail')], OVERALL, AUTO_DIMENSION_DEFAULTS);
    const axes = planChains([ref(0, 'south', 'axes'), ref(400, 'south', 'axes')], OVERALL, AUTO_DIMENSION_DEFAULTS);
    const overall = planChains([ref(0, 'south', 'overall'), ref(400, 'south', 'overall')], OVERALL, AUTO_DIMENSION_DEFAULTS);
    expect(detail[0].defPoints[2].y).toBe(-600); // 600 + 0*400
    expect(axes[0].defPoints[2].y).toBe(-1000); // 600 + 1*400
    expect(overall[0].defPoints[2].y).toBe(-1400); // 600 + 2*400
  });

  it('west side measures Y and rotates the dim line 90°', () => {
    const segs = planChains(
      [ref(0, 'west', 'detail'), ref(400, 'west', 'detail')],
      OVERALL,
      AUTO_DIMENSION_DEFAULTS,
    );
    const [s] = segs;
    expect(s.rotation).toBe(90);
    expect(s.defPoints[0]).toEqual({ x: 0, y: 0 });
    expect(s.defPoints[1]).toEqual({ x: 0, y: 400 });
    expect(s.defPoints[2]).toEqual({ x: -600, y: 0 });
  });

  it('dedups near-coincident coordinates within 1mm', () => {
    const segs = planChains(
      [ref(400, 'south', 'detail'), ref(400.4, 'south', 'detail'), ref(2000, 'south', 'detail')],
      OVERALL,
      AUTO_DIMENSION_DEFAULTS,
    );
    // 400 and 400.4 merge → coords [400, 2000] → 1 segment
    expect(segs).toHaveLength(1);
    expect(segs[0].defPoints[0].x).toBe(400);
    expect(segs[0].defPoints[1].x).toBe(2000);
  });

  it('carries association sources onto the segment', () => {
    const segs = planChains(
      [ref(0, 'south', 'detail', 'wallA'), ref(400, 'south', 'detail', 'wallB')],
      OVERALL,
      AUTO_DIMENSION_DEFAULTS,
    );
    expect(segs[0].source1?.id).toBe('wallA');
    expect(segs[0].source2?.id).toBe('wallB');
  });

  it('skips groups with fewer than 2 coordinates', () => {
    const segs = planChains([ref(0, 'south', 'detail')], OVERALL, AUTO_DIMENSION_DEFAULTS);
    expect(segs).toHaveLength(0);
  });
});
