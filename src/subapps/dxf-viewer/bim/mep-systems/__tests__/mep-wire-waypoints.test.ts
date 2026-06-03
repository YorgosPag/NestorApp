/**
 * ADR-408 Φ7 FU#3 — MEP wire waypoint SSoT tests (key, orientation, builders).
 */

import {
  buildSegmentKey,
  endpointKey,
  getOrientedWaypoints,
  insertWaypointOriented,
  moveWaypointOriented,
  deleteWaypointOriented,
  type WireWaypointMap,
} from '../mep-wire-waypoints';

describe('endpointKey / buildSegmentKey', () => {
  it('builds an entity:connector endpoint key', () => {
    expect(endpointKey('fx1', 'c2')).toBe('fx1:c2');
  });

  it('is order-independent for the segment key', () => {
    expect(buildSegmentKey('a', 'b')).toBe(buildSegmentKey('b', 'a'));
    expect(buildSegmentKey('a', 'b')).toBe('a|b');
  });
});

describe('getOrientedWaypoints', () => {
  const map: WireWaypointMap = { 'a|b': [{ x: 1, y: 0 }, { x: 2, y: 0 }] };

  it('returns the stored array unchanged in canonical direction (min→max)', () => {
    expect(getOrientedWaypoints(map, 'a', 'b')).toEqual([{ x: 1, y: 0 }, { x: 2, y: 0 }]);
  });

  it('reverses the array in the non-canonical direction (max→min)', () => {
    expect(getOrientedWaypoints(map, 'b', 'a')).toEqual([{ x: 2, y: 0 }, { x: 1, y: 0 }]);
  });

  it('returns [] for an unknown / empty segment', () => {
    expect(getOrientedWaypoints(map, 'x', 'y')).toEqual([]);
    expect(getOrientedWaypoints(undefined, 'a', 'b')).toEqual([]);
  });
});

describe('insertWaypointOriented', () => {
  it('inserts at the draw index in canonical direction', () => {
    const out = insertWaypointOriented({}, 'a', 'b', 0, { x: 5, y: 5 });
    expect(out['a|b']).toEqual([{ x: 5, y: 5 }]);
  });

  it('inserts so the new vertex appears at the draw index when reversed', () => {
    const base: WireWaypointMap = { 'a|b': [{ x: 1, y: 0 }, { x: 2, y: 0 }] };
    // Draw direction b→a, insert at oriented index 0 (right after b).
    const out = insertWaypointOriented(base, 'b', 'a', 0, { x: 9, y: 9 });
    // Stored (canonical a→b) grows at the end; oriented b→a shows it first.
    expect(out['a|b']).toEqual([{ x: 1, y: 0 }, { x: 2, y: 0 }, { x: 9, y: 9 }]);
    expect(getOrientedWaypoints(out, 'b', 'a')[0]).toEqual({ x: 9, y: 9 });
  });
});

describe('moveWaypointOriented', () => {
  it('moves the addressed vertex (canonical)', () => {
    const base: WireWaypointMap = { 'a|b': [{ x: 1, y: 0 }, { x: 2, y: 0 }] };
    const out = moveWaypointOriented(base, 'a', 'b', 1, { x: 7, y: 7 });
    expect(out['a|b']).toEqual([{ x: 1, y: 0 }, { x: 7, y: 7 }]);
  });

  it('maps the draw index to the canonical index when reversed', () => {
    const base: WireWaypointMap = { 'a|b': [{ x: 1, y: 0 }, { x: 2, y: 0 }] };
    // Oriented b→a index 0 = canonical last.
    const out = moveWaypointOriented(base, 'b', 'a', 0, { x: 7, y: 7 });
    expect(out['a|b']).toEqual([{ x: 1, y: 0 }, { x: 7, y: 7 }]);
  });
});

describe('deleteWaypointOriented', () => {
  it('removes the addressed vertex', () => {
    const base: WireWaypointMap = { 'a|b': [{ x: 1, y: 0 }, { x: 2, y: 0 }] };
    expect(deleteWaypointOriented(base, 'a', 'b', 0)['a|b']).toEqual([{ x: 2, y: 0 }]);
  });

  it('drops the segment key entirely when its last vertex is deleted', () => {
    const base: WireWaypointMap = { 'a|b': [{ x: 1, y: 0 }] };
    const out = deleteWaypointOriented(base, 'a', 'b', 0);
    expect(out['a|b']).toBeUndefined();
    expect(Object.keys(out)).toHaveLength(0);
  });
});
