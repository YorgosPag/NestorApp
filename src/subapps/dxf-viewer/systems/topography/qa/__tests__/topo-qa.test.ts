/**
 * ADR-650 M5α — Topography QA engine tests (deterministic, no LLM).
 *
 * Each check is a pure function over a TinSurface / raw points, so the tests build tiny
 * analytic inputs with a KNOWN answer: a flat grid with one keyed-in spike (elevation bust),
 * coincident points with clashing Z (duplicate), a bow-tie ring (self-intersection), a sharp
 * tent (missing breakline) — plus one store-driven `runTopoQa` integration.
 */

import { buildTin } from '../../tin-builder';
import type { TopoPoint, Breakline, TopoBoundary } from '../../topo-types';
import { checkElevationBusts } from '../check-elevation-busts';
import { checkDuplicatePoints } from '../check-duplicate-points';
import { checkBoundaryClosure } from '../check-boundary-closure';
import { checkMissingBreaklines } from '../check-missing-breaklines';
import { runTopoQa } from '../run-topo-qa';
import { setTopoPoints, clearTopo } from '../../TopoPointStore';
import { invalidateTopoSurface } from '../../topo-surface';

/** n×n grid at spacing `step` mm, all at elevation `z` mm. */
function flatGrid(n: number, step: number, z: number): TopoPoint[] {
  const pts: TopoPoint[] = [];
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) pts.push({ x: i * step, y: j * step, z });
  return pts;
}

describe('checkElevationBusts', () => {
  it('flags a keyed-in Z spike on an otherwise flat surface', () => {
    const points = flatGrid(3, 500, 1000);
    points[4] = { x: 500, y: 500, z: 9000 }; // centre node, +8 m bust
    const flags = checkElevationBusts(buildTin(points));
    expect(flags.length).toBe(1);
    expect(flags[0]!.kind).toBe('elevation-bust');
    expect(flags[0]!.severity).toBe('high');
    expect(flags[0]!.at).toEqual({ x: 500, y: 500 });
  });

  it('is quiet on a clean flat surface', () => {
    expect(checkElevationBusts(buildTin(flatGrid(3, 500, 1000)))).toEqual([]);
  });
});

describe('checkDuplicatePoints', () => {
  it('flags coincident points with incompatible Z', () => {
    const points: TopoPoint[] = [
      { x: 0, y: 0, z: 100 },
      { x: 10, y: 0, z: 2100 }, // 1 cm away, 2 m higher → incompatible
    ];
    const flags = checkDuplicatePoints(points);
    expect(flags.length).toBe(1);
    expect(flags[0]!.severity).toBe('high');
  });

  it('does not flag coincident points that agree in Z', () => {
    const points: TopoPoint[] = [{ x: 0, y: 0, z: 100 }, { x: 10, y: 0, z: 120 }];
    expect(checkDuplicatePoints(points)).toEqual([]);
  });
});

describe('checkBoundaryClosure', () => {
  it('flags a self-intersecting (bow-tie) boundary', () => {
    const boundary: TopoBoundary = {
      vertices: [{ x: 0, y: 0 }, { x: 2000, y: 2000 }, { x: 2000, y: 0 }, { x: 0, y: 2000 }],
    };
    const kinds = checkBoundaryClosure(boundary, []).map((f) => f.kind);
    expect(kinds).toContain('self-intersection');
  });

  it('passes a clean, ample square boundary', () => {
    const boundary: TopoBoundary = {
      vertices: [{ x: 0, y: 0 }, { x: 2000, y: 0 }, { x: 2000, y: 2000 }, { x: 0, y: 2000 }],
    };
    expect(checkBoundaryClosure(boundary, [])).toEqual([]);
  });
});

describe('checkMissingBreaklines', () => {
  /** A sharp tent: a high ridge line at x=1000 between two low rows. */
  function tentPoints(): TopoPoint[] {
    return [
      { x: 0, y: 0, z: 0 }, { x: 0, y: 1000, z: 0 },
      { x: 1000, y: 0, z: 6000 }, { x: 1000, y: 1000, z: 6000 },
      { x: 2000, y: 0, z: 0 }, { x: 2000, y: 1000, z: 0 },
    ];
  }

  it('flags a steep fold that has no breakline constraint', () => {
    const surface = buildTin(tentPoints());
    const flags = checkMissingBreaklines(surface, [], surface.origin);
    expect(flags.length).toBeGreaterThan(0);
    expect(flags[0]!.kind).toBe('missing-breakline');
  });

  it('a breakline along the ridge suppresses at least one fold flag', () => {
    const points = tentPoints();
    const withoutBl = buildTin(points);
    const beforeCount = checkMissingBreaklines(withoutBl, [], withoutBl.origin).length;

    const ridge: Breakline = {
      id: 'bl-ridge',
      vertices: [{ x: 1000, y: 0, z: 6000 }, { x: 1000, y: 1000, z: 6000 }],
    };
    const withBl = buildTin(points, [ridge]);
    const afterCount = checkMissingBreaklines(withBl, [ridge], withBl.origin).length;
    expect(afterCount).toBeLessThan(beforeCount);
  });
});

describe('runTopoQa (store integration)', () => {
  beforeEach(() => { clearTopo(); invalidateTopoSurface(); });
  afterEach(() => { clearTopo(); invalidateTopoSurface(); });

  it('reports notEnoughData under 3 points', () => {
    setTopoPoints([{ x: 0, y: 0, z: 0 }]);
    const report = runTopoQa('existing');
    expect(report.notEnoughData).toBe(true);
    expect(report.flags).toEqual([]);
  });

  it('surfaces a bust from the live surface, severity-sorted', () => {
    const points = flatGrid(3, 500, 1000);
    points[4] = { x: 500, y: 500, z: 9000 };
    setTopoPoints(points);
    const report = runTopoQa('existing');
    expect(report.counts.high).toBeGreaterThanOrEqual(1);
    expect(report.flags[0]!.severity).toBe('high');
  });
});
