/**
 * Unit tests for the polyline perpendicular-foot SSoT (ADR-572 §8 WI-4) —
 * `nearestFootOnPolyline` (clamped NEAREST) + `perpendicularFeetOverPolyline` (unclamped PERPENDICULAR).
 */

import { nearestFootOnPolyline, perpendicularFeetOverPolyline } from '../polyline-perpendicular-feet';

const OPEN = [{ x: 0, y: 0 }, { x: 10, y: 0 }]; // single open segment
const SQUARE = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }]; // closed CCW

describe('nearestFootOnPolyline (clamped)', () => {
  it('returns null for fewer than 2 vertices', () => {
    expect(nearestFootOnPolyline([], { x: 0, y: 0 }, false)).toBeNull();
    expect(nearestFootOnPolyline([{ x: 1, y: 1 }], { x: 0, y: 0 }, false)).toBeNull();
  });

  it('finds the clamped foot on an open segment', () => {
    const foot = nearestFootOnPolyline(OPEN, { x: 5, y: 5 }, false);
    expect(foot).toEqual({ x: 5, y: 0 });
  });

  it('clamps to an endpoint when the cursor is past the segment', () => {
    const foot = nearestFootOnPolyline(OPEN, { x: 20, y: 3 }, false);
    expect(foot).toEqual({ x: 10, y: 0 });
  });

  it('picks the nearest edge of a closed polygon (incl. closing edge)', () => {
    // cursor just below the bottom edge → nearest foot on edge 0
    expect(nearestFootOnPolyline(SQUARE, { x: 5, y: -3 }, true)).toEqual({ x: 5, y: 0 });
    // cursor just left of the left (closing) edge → foot on edge [3]→[0]
    expect(nearestFootOnPolyline(SQUARE, { x: -3, y: 5 }, true)).toEqual({ x: 0, y: 5 });
  });
});

describe('perpendicularFeetOverPolyline (unclamped, filtered by maxDistance)', () => {
  it('returns one foot per segment with 0-based segmentIndex (open)', () => {
    const feet = perpendicularFeetOverPolyline(OPEN, { x: 5, y: 5 }, 10, false);
    expect(feet).toEqual([{ point: { x: 5, y: 0 }, segmentIndex: 0 }]);
  });

  it('filters out feet beyond maxDistance', () => {
    expect(perpendicularFeetOverPolyline(OPEN, { x: 5, y: 5 }, 3, false)).toEqual([]);
  });

  it('covers all four closed edges incl. the closing edge, unclamped', () => {
    const feet = perpendicularFeetOverPolyline(SQUARE, { x: 5, y: 5 }, 10, true);
    expect(feet).toHaveLength(4);
    expect(feet.map((f) => f.segmentIndex)).toEqual([0, 1, 2, 3]);
    // each foot is the perpendicular projection onto that edge's infinite line
    expect(feet[0].point).toEqual({ x: 5, y: 0 });  // bottom  y=0
    expect(feet[1].point).toEqual({ x: 10, y: 5 }); // right   x=10
    expect(feet[2].point).toEqual({ x: 5, y: 10 }); // top     y=10
    expect(feet[3].point).toEqual({ x: 0, y: 5 });  // left    x=0
  });

  it('returns empty for fewer than 2 vertices', () => {
    expect(perpendicularFeetOverPolyline([{ x: 1, y: 1 }], { x: 0, y: 0 }, 10, false)).toEqual([]);
  });
});
