/**
 * ADR-408 Φ7 — MEP home-run wire routing SSoT tests (daisy-chain + seam).
 */

import {
  computeCircuitWirePaths,
  expandSegment,
  buildWirePolyline,
  type WireHostPoint,
  type ResolveWireHost,
  type CircuitWirePath,
} from '../mep-wire-routing';
import type { MepSystemEntity, MepSystemParams } from '../../types/mep-system-types';

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
});

describe('expandSegment (style seam)', () => {
  it('straight returns the direct two-point segment', () => {
    expect(expandSegment(P(0, 0), P(10, 5), 'straight')).toEqual([P(0, 0), P(10, 5)]);
  });

  it('defaults to straight when no style is given', () => {
    expect(expandSegment(P(0, 0), P(10, 5))).toEqual([P(0, 0), P(10, 5)]);
  });

  it('orthogonal inserts an L-elbow (horizontal then vertical)', () => {
    expect(expandSegment(P(0, 0, 1), P(10, 5, 2), 'orthogonal')).toEqual([
      P(0, 0, 1),
      P(10, 0, 2),
      P(10, 5, 2),
    ]);
  });

  it('arc falls back to straight until the curved annotation lands', () => {
    expect(expandSegment(P(0, 0), P(10, 5), 'arc')).toEqual([P(0, 0), P(10, 5)]);
  });
});

describe('buildWirePolyline', () => {
  const straightPath: CircuitWirePath = {
    systemId: 's1',
    colorHex: '#000000',
    points: [P(0, 0), P(10, 0), P(10, 10)],
  };

  it('flattens a straight path with de-duplicated joins', () => {
    expect(buildWirePolyline(straightPath, 'straight')).toEqual([P(0, 0), P(10, 0), P(10, 10)]);
  });

  it('expands a diagonal segment into an L-elbow for orthogonal', () => {
    const diag: CircuitWirePath = { systemId: 's', colorHex: '#000000', points: [P(0, 0), P(10, 5)] };
    expect(buildWirePolyline(diag, 'orthogonal')).toEqual([P(0, 0), P(10, 0), P(10, 5)]);
  });

  it('returns empty for a path with no points', () => {
    expect(buildWirePolyline({ systemId: 's', colorHex: '#000000', points: [] })).toEqual([]);
  });
});
