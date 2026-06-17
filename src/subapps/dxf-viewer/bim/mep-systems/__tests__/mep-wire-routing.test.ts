/**
 * ADR-408 Φ7 — MEP home-run wire routing SSoT tests (daisy-chain + seam).
 */

import {
  computeCircuitWirePaths,
  computeCircuitHostSegments,
  splicedSegmentInterior,
  expandSegment,
  buildWirePolyline,
  type WireHostPoint,
  type WireStyle,
  type ResolveWireHost,
  type CircuitWirePath,
} from '../mep-wire-routing';
import { buildSegmentKey, endpointKey, type WireWaypointMap } from '../mep-wire-waypoints';
import { DEFAULT_CONDUCTORS, type MepElectricalSystemParams, type MepSystemEntity, type MepSystemParams } from '../../types/mep-system-types';

function sys(id: string, color: string | undefined, members: string[], source: string): MepSystemEntity {
  const params: MepSystemParams = {
    systemType: 'electrical-circuit',
    name: id,
    systemClassification: 'lighting',
    sourceEntityId: source,
    sourceConnectorId: 'c1',
    members: members.map((entityId) => ({ entityId, connectorId: 'c1' })),
    ...(color ? { color } : {}),
  };
  return { id, params };
}

/** A system carrying an explicit per-circuit wire style. */
function sysWithStyle(id: string, wireStyle: WireStyle, members: string[], source: string): MepSystemEntity {
  const base = sys(id, undefined, members, source);
  return { ...base, params: { ...base.params, wireStyle } as MepElectricalSystemParams };
}

/** A resolver backed by a fixed id→point map (null for anything absent). */
function resolverFrom(points: Record<string, WireHostPoint>): ResolveWireHost {
  return (entityId) => points[entityId] ?? null;
}

const P = (x: number, y: number, zMm = 0): WireHostPoint => ({ x, y, zMm });

describe('computeCircuitWirePaths', () => {
  it('places the panel first, then a single member (home-run leg)', () => {
    const paths = computeCircuitWirePaths(
      [sys('s1', '#2563eb', ['fx1'], 'pnl1')],
      resolverFrom({ pnl1: P(0, 0), fx1: P(10, 0) }),
    );
    expect(paths).toHaveLength(1);
    expect(paths[0]!.points).toEqual([P(0, 0), P(10, 0)]);
    expect(paths[0]!.colorHex).toBe('#2563eb');
    expect(paths[0]!.systemId).toBe('s1');
  });

  it('orders members as a greedy nearest-neighbour daisy chain from the panel', () => {
    // Panel at origin; fixtures listed far→near, expect near→far chaining.
    const paths = computeCircuitWirePaths(
      [sys('s1', undefined, ['far', 'mid', 'near'], 'pnl')],
      resolverFrom({ pnl: P(0, 0), far: P(30, 0), mid: P(20, 0), near: P(10, 0) }),
    );
    expect(paths[0]!.points).toEqual([P(0, 0), P(10, 0), P(20, 0), P(30, 0)]);
  });

  it('breaks ties by member order (deterministic / replay-stable)', () => {
    const paths = computeCircuitWirePaths(
      [sys('s1', undefined, ['a', 'b'], 'pnl')],
      resolverFrom({ pnl: P(0, 0), a: P(5, 0), b: P(0, 5) }), // equal distance to panel
    );
    // 'a' listed first → wins the tie at the first hop.
    expect(paths[0]!.points[1]).toEqual(P(5, 0));
  });

  it('skips off-scene members but still routes the rest', () => {
    const paths = computeCircuitWirePaths(
      [sys('s1', undefined, ['fx1', 'gone', 'fx2'], 'pnl')],
      resolverFrom({ pnl: P(0, 0), fx1: P(10, 0), fx2: P(20, 0) }),
    );
    expect(paths[0]!.points).toEqual([P(0, 0), P(10, 0), P(20, 0)]);
  });

  it('skips a system whose panel source is off-scene (no home-run anchor)', () => {
    const paths = computeCircuitWirePaths(
      [sys('s1', undefined, ['fx1'], 'missingPanel')],
      resolverFrom({ fx1: P(10, 0) }),
    );
    expect(paths).toHaveLength(0);
  });

  it('skips a system with no resolvable members', () => {
    const paths = computeCircuitWirePaths(
      [sys('s1', undefined, ['gone'], 'pnl')],
      resolverFrom({ pnl: P(0, 0) }),
    );
    expect(paths).toHaveLength(0);
  });

  it('falls back to a deterministic palette colour when the system stores none', () => {
    const paths = computeCircuitWirePaths(
      [sys('s1', undefined, ['fx1'], 'pnl')],
      resolverFrom({ pnl: P(0, 0), fx1: P(10, 0) }),
    );
    expect(paths[0]!.colorHex).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('returns nothing for an empty systems list', () => {
    expect(computeCircuitWirePaths([], resolverFrom({}))).toEqual([]);
  });

  it('carries the per-circuit wireStyle onto the path (absent ⇒ straight)', () => {
    const def = computeCircuitWirePaths(
      [sys('s1', undefined, ['fx1'], 'pnl')],
      resolverFrom({ pnl: P(0, 0), fx1: P(10, 0) }),
    );
    expect(def[0]!.style).toBe('straight');

    const ortho = computeCircuitWirePaths(
      [sysWithStyle('s2', 'orthogonal', ['fx1'], 'pnl')],
      resolverFrom({ pnl: P(0, 0), fx1: P(10, 0) }),
    );
    expect(ortho[0]!.style).toBe('orthogonal');
  });
});

describe('expandSegment (style seam)', () => {
  it('straight returns the direct two-point segment', () => {
    expect(expandSegment(P(0, 0), P(10, 5), 'straight')).toEqual([P(0, 0), P(10, 5)]);
  });

  it('defaults to straight when no style is given', () => {
    expect(expandSegment(P(0, 0), P(10, 5))).toEqual([P(0, 0), P(10, 5)]);
  });

  // ADR-408 Φ-C EXT — 3D vertical riser for height changes (no free diagonal). The
  // horizontal leg runs at the HIGHER end; the vertical riser is at the lower device.
  it('rises at the lower end when the destination is higher (run stays high)', () => {
    // a@300 → b@2700 (b higher): rise vertically at a's XY to b.z, then horizontal to b.
    // 2D (z ignored): corner shares a's XY → collapses onto a → straight a→b.
    expect(expandSegment(P(0, 0, 300), P(10, 5, 2700), 'straight')).toEqual([
      P(0, 0, 300),
      P(0, 0, 2700),
      P(10, 5, 2700),
    ]);
  });

  it('drops at the destination when the source is higher (run stays high)', () => {
    // a@2700 → b@300 (a higher): horizontal at a.z to b's XY, then drop down to b.
    // 2D: corner shares b's XY → collapses onto b → straight a→b.
    expect(expandSegment(P(10, 5, 2700), P(0, 0, 300), 'straight')).toEqual([
      P(10, 5, 2700),
      P(0, 0, 2700),
      P(0, 0, 300),
    ]);
  });

  it('straight stays a direct segment when the height delta is below epsilon (float noise)', () => {
    expect(expandSegment(P(0, 0, 2700), P(10, 5, 2699.9999), 'straight')).toEqual([
      P(0, 0, 2700),
      P(10, 5, 2699.9999),
    ]);
  });

  it('orthogonal inserts an L-elbow (horizontal then vertical)', () => {
    expect(expandSegment(P(0, 0, 1), P(10, 5, 2), 'orthogonal')).toEqual([
      P(0, 0, 1),
      P(10, 0, 2),
      P(10, 5, 2),
    ]);
  });

  it('arc samples a curved Bézier polyline (endpoints exact, interior bulged)', () => {
    const pts = expandSegment(P(0, 0), P(10, 0), 'arc');
    expect(pts.length).toBeGreaterThan(2);
    expect(pts[0]).toEqual(P(0, 0));
    expect(pts[pts.length - 1]).toEqual(P(10, 0));
    // The control point pushes the midpoint perpendicular off the straight line.
    const mid = pts[Math.floor(pts.length / 2)]!;
    expect(Math.abs(mid.y)).toBeGreaterThan(0);
  });

  it('arc collapses a zero-length segment to the direct two points', () => {
    expect(expandSegment(P(5, 5), P(5, 5), 'arc')).toEqual([P(5, 5), P(5, 5)]);
  });
});

describe('buildWirePolyline', () => {
  it('flattens a straight path (default style) with de-duplicated joins', () => {
    const straightPath: CircuitWirePath = {
      systemId: 's1',
      colorHex: '#000000',
      points: [P(0, 0), P(10, 0), P(10, 10)],
    };
    expect(buildWirePolyline(straightPath)).toEqual([P(0, 0), P(10, 0), P(10, 10)]);
  });

  it('expands diagonals into L-elbows when the path style is orthogonal', () => {
    const diag: CircuitWirePath = {
      systemId: 's', colorHex: '#000000', style: 'orthogonal', points: [P(0, 0), P(10, 5)],
    };
    expect(buildWirePolyline(diag)).toEqual([P(0, 0), P(10, 0), P(10, 5)]);
  });

  it('samples a curve when the path style is arc', () => {
    const arc: CircuitWirePath = {
      systemId: 's', colorHex: '#000000', style: 'arc', points: [P(0, 0), P(10, 0)],
    };
    expect(buildWirePolyline(arc).length).toBeGreaterThan(2);
  });

  it('returns empty for a path with no points', () => {
    expect(buildWirePolyline({ systemId: 's', colorHex: '#000000', points: [] })).toEqual([]);
  });

  // ADR-408 Φ-C EXT — straight path crossing heights (panel 1500 → light 2700 →
  // light 2700): the height-changing leg gets a riser; the same-height leg stays direct.
  it('inserts 3D risers on a straight path that crosses heights', () => {
    const path: CircuitWirePath = {
      systemId: 's', colorHex: '#000000', points: [P(0, 0, 1500), P(10, 0, 2700), P(20, 0, 2700)],
    };
    expect(buildWirePolyline(path)).toEqual([
      P(0, 0, 1500),
      P(0, 0, 2700), // panel rises in place to the higher (light) elevation
      P(10, 0, 2700), // light1 (horizontal run at ceiling height)
      P(20, 0, 2700), // light2 (same height → no riser)
    ]);
  });
});

describe('computeCircuitWirePaths (waypoints — Φ7 FU#3)', () => {
  /** Attach a waypoint map (keyed by host pair) to a system's params. */
  function withWaypoints(s: MepSystemEntity, map: WireWaypointMap): MepSystemEntity {
    return { ...s, params: { ...s.params, wireWaypoints: map } as MepElectricalSystemParams };
  }

  it('splices a per-segment waypoint between the two hosts', () => {
    const system = withWaypoints(sys('s1', undefined, ['fx1'], 'pnl'), {
      [buildSegmentKey(endpointKey('pnl', 'c1'), endpointKey('fx1', 'c1'))]: [{ x: 5, y: 3 }],
    });
    const paths = computeCircuitWirePaths(
      [system],
      resolverFrom({ pnl: P(0, 0), fx1: P(10, 0) }),
    );
    expect(paths[0]!.points).toEqual([P(0, 0), P(5, 3), P(10, 0)]);
  });

  it('interpolates waypoint zMm linearly along the broken polyline', () => {
    const system = withWaypoints(sys('s1', undefined, ['fx1'], 'pnl'), {
      [buildSegmentKey(endpointKey('pnl', 'c1'), endpointKey('fx1', 'c1'))]: [{ x: 5, y: 0 }],
    });
    const paths = computeCircuitWirePaths(
      [system],
      resolverFrom({ pnl: P(0, 0, 0), fx1: P(10, 0, 100) }),
    );
    // Midpoint at half the chord length ⇒ z = 50.
    expect(paths[0]!.points[1]).toEqual({ x: 5, y: 0, zMm: 50 });
  });

  it('composes per-circuit style across each sub-segment created by a waypoint', () => {
    const system = withWaypoints(sysWithStyle('s1', 'orthogonal', ['fx1'], 'pnl'), {
      [buildSegmentKey(endpointKey('pnl', 'c1'), endpointKey('fx1', 'c1'))]: [{ x: 5, y: 5 }],
    });
    const [path] = computeCircuitWirePaths(
      [system],
      resolverFrom({ pnl: P(0, 0), fx1: P(10, 10) }),
    );
    // Each leg (panel→wp, wp→fixture) gets its own L-elbow.
    expect(buildWirePolyline(path!)).toEqual([
      P(0, 0), P(5, 0), P(5, 5),   // panel → waypoint, elbow at waypoint.x
      P(10, 5), P(10, 10),          // waypoint → fixture, elbow at fixture.x
    ]);
  });

  it('keeps waypoints attached to the host pair when the daisy chain re-orders', () => {
    const segKey = buildSegmentKey(endpointKey('near', 'c1'), endpointKey('far', 'c1'));
    const map: WireWaypointMap = { [segKey]: [{ x: 15, y: 9 }] };
    const system = withWaypoints(sys('s1', undefined, ['near', 'far'], 'pnl'), map);

    // Layout A: chain pnl→near→far. Layout B: positions swap ⇒ chain pnl→far→near.
    const a = computeCircuitWirePaths([system], resolverFrom({ pnl: P(0, 0), near: P(10, 0), far: P(20, 0) }));
    const b = computeCircuitWirePaths([system], resolverFrom({ pnl: P(0, 0), near: P(20, 0), far: P(10, 0) }));

    // The waypoint survives both orderings (orientation may flip, presence must not).
    expect(a[0]!.points).toContainEqual({ x: 15, y: 9, zMm: 0 });
    expect(b[0]!.points).toContainEqual({ x: 15, y: 9, zMm: 0 });
  });
});

describe('computeCircuitHostSegments', () => {
  it('returns host-level legs with order-independent endpoint keys (no waypoints)', () => {
    const segs = computeCircuitHostSegments(
      [sys('s1', undefined, ['fx1', 'fx2'], 'pnl')],
      resolverFrom({ pnl: P(0, 0), fx1: P(10, 0), fx2: P(20, 0) }),
    );
    expect(segs).toHaveLength(2);
    expect(segs[0]).toMatchObject({ systemId: 's1', keyA: 'pnl:c1', keyB: 'fx1:c1', a: P(0, 0), b: P(10, 0) });
    expect(segs[1]).toMatchObject({ keyA: 'fx1:c1', keyB: 'fx2:c1' });
  });

  it('skips systems with no resolvable source / members', () => {
    expect(computeCircuitHostSegments([sys('s1', undefined, ['fx1'], 'gone')], resolverFrom({ fx1: P(1, 1) }))).toEqual([]);
  });
});

describe('splicedSegmentInterior (arc-length zMm — shared by conduit + 3D handle)', () => {
  it('interpolates a waypoint zMm by plan arc-length, NOT by index fraction', () => {
    // a@z=0 → b@z=100, single waypoint near a (10% of the run). Arc-length gives
    // z≈10; an index fraction (1/(1+1)=0.5) would wrongly give z=50. This is the
    // gap that made the 3D handle sphere float off the conduit when orbiting.
    const interior = splicedSegmentInterior(P(0, 0, 0), P(100, 0, 100), [{ x: 10, y: 0 }]);
    expect(interior).toHaveLength(1);
    expect(interior[0]!.x).toBe(10);
    expect(interior[0]!.zMm).toBeCloseTo(10, 6);
  });

  it('matches the conduit point the wire is built from (handle === wire, same z)', () => {
    // The routed path splices the identical interior; the handle must read the
    // SAME function so the sphere sits on the line.
    const a = P(0, 0, 0);
    const b = P(40, 0, 80);
    const wps = [{ x: 30, y: 0 }];
    const interior = splicedSegmentInterior(a, b, wps);
    // 30/40 = 0.75 of the run → z = 60 (arc-length), not 40 (index 0.5).
    expect(interior[0]!.zMm).toBeCloseTo(60, 6);
  });

  it('is empty when the segment has no waypoints', () => {
    expect(splicedSegmentInterior(P(0, 0, 0), P(10, 0, 50), [])).toEqual([]);
  });
});

describe('computeCircuitWirePaths (conductors — Φ7)', () => {
  it('defaults a path conductor breakdown when the system has none', () => {
    const paths = computeCircuitWirePaths(
      [sys('s1', undefined, ['fx1'], 'pnl')],
      resolverFrom({ pnl: P(0, 0), fx1: P(10, 0) }),
    );
    expect(paths[0]!.conductors).toEqual(DEFAULT_CONDUCTORS);
  });

  it('carries the system\'s explicit conductor breakdown onto the path', () => {
    const base = sys('s1', undefined, ['fx1'], 'pnl');
    const withConductors: MepSystemEntity = {
      ...base,
      params: { ...base.params, conductors: { hot: 2, neutral: 1, ground: 1 } } as MepElectricalSystemParams,
    };
    const paths = computeCircuitWirePaths(
      [withConductors],
      resolverFrom({ pnl: P(0, 0), fx1: P(10, 0) }),
    );
    expect(paths[0]!.conductors).toEqual({ hot: 2, neutral: 1, ground: 1 });
  });
});
