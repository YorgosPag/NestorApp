/**
 * ADR-408 Φ7 FU#3 — MEP wire waypoint hit-testing tests.
 */

import { hitTestWaypointNode, hitTestInsertion } from '../mep-wire-waypoint-hit';
import { buildSegmentKey, type WireWaypointMap } from '../mep-wire-waypoints';
import type { CircuitHostSegment } from '../mep-wire-routing';

const SEG: CircuitHostSegment = {
  systemId: 's1',
  keyA: 'a',
  keyB: 'b',
  a: { x: 0, y: 0, zMm: 0 },
  b: { x: 10, y: 0, zMm: 0 },
};

const WP_MAP: WireWaypointMap = { [buildSegmentKey('a', 'b')]: [{ x: 5, y: 0 }] };

describe('hitTestWaypointNode', () => {
  it('hits an existing node within tolerance', () => {
    const hit = hitTestWaypointNode({ x: 5.2, y: 0.1 }, [SEG], WP_MAP, 1);
    expect(hit).toMatchObject({ keyA: 'a', keyB: 'b', orientedIndex: 0, point: { x: 5, y: 0 } });
  });

  it('misses when no node is within tolerance', () => {
    expect(hitTestWaypointNode({ x: 8, y: 3 }, [SEG], WP_MAP, 1)).toBeNull();
  });

  it('returns null when the segment has no waypoints', () => {
    expect(hitTestWaypointNode({ x: 5, y: 0 }, [SEG], {}, 1)).toBeNull();
  });
});

describe('hitTestInsertion', () => {
  it('projects onto the bare segment when there are no waypoints', () => {
    const hit = hitTestInsertion({ x: 4, y: 0.3 }, [SEG], {}, 1);
    expect(hit).toMatchObject({ keyA: 'a', keyB: 'b', orientedInsertIndex: 0, point: { x: 4, y: 0 } });
  });

  it('picks the correct sub-segment when a waypoint splits the leg', () => {
    // Waypoint at x=5 ⇒ sub-segments [0,5] (k=0) and [5,10] (k=1).
    const hit = hitTestInsertion({ x: 8, y: 0.2 }, [SEG], WP_MAP, 1);
    expect(hit).toMatchObject({ orientedInsertIndex: 1, point: { x: 8, y: 0 } });
  });

  it('misses when the cursor is far from every sub-segment', () => {
    expect(hitTestInsertion({ x: 5, y: 50 }, [SEG], WP_MAP, 1)).toBeNull();
  });
});
