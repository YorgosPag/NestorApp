/**
 * ADR-920 Β4.8 Τ.3 — breakline elevation conflicts reach the engineer as QA flags.
 *
 * Two promises are pinned here: (1) the check only TRANSLATES the builder's report — severity from Δz, LOCAL → WORLD,
 * the overruled breakline named by its 1-based number, nothing when the breaklines agree; (2) the report comes from the
 * ONE memoised build — `getTopoBuildReport().surface` IS the surface every other consumer reads, so asking QA's question
 * never triangulates the survey a second time.
 */

import { addBreakline, clearTopo, setTopoPoints } from '../../TopoPointStore';
import { getTopoBuildReport, getTopoSurfaceFull, invalidateTopoSurface } from '../../topo-surface';
import { buildTinWithReport } from '../../tin-builder';
import type { Breakline, TopoPoint, TopoPoint3D } from '../../topo-types';
import { breaklineConflictSeverity, checkBreaklineConflicts } from '../check-breakline-conflicts';
import { runTopoQa } from '../run-topo-qa';

/** Far from the world origin on purpose: a forgotten LOCAL → WORLD shift is off by ~500 km, not by a rounding error. */
const OX = 500_000_000;
const OY = 4_000_000_000;
const p = (x: number, y: number, z: number): TopoPoint3D => ({ x: OX + x, y: OY + y, z });

const SQUARE: readonly TopoPoint[] = [p(0, 0, 0), p(10_000, 0, 0), p(10_000, 10_000, 0), p(0, 10_000, 0)];
const EAST_WEST: readonly TopoPoint3D[] = [p(0, 5_000, 1_000), p(10_000, 5_000, 1_000)];
const northSouth = (z: number): TopoPoint3D[] => [p(5_000, 0, z), p(5_000, 10_000, z)];
const line = (id: string, vertices: readonly TopoPoint3D[]): Breakline => ({ id, vertices });

function flagsOf(points: readonly TopoPoint[], breaklines: readonly Breakline[]) {
  const report = buildTinWithReport(points, breaklines);
  return checkBreaklineConflicts(report.breaklineConflicts, breaklines, report.surface.origin);
}

beforeEach(() => {
  clearTopo();
  invalidateTopoSurface();
});

describe('checkBreaklineConflicts', () => {
  it('flags a crossing at the crossing, in WORLD, naming the overruled (later) breakline', () => {
    const flags = flagsOf(SQUARE, [line('a', EAST_WEST), line('b', northSouth(3_000))]);

    expect(flags).toHaveLength(1);
    const [flag] = flags;
    expect(flag!.kind).toBe('breakline-conflict');
    expect(flag!.messageKey).toBe('topography.qa.flag.breaklineCrossing');
    expect(flag!.at.x).toBeCloseTo(OX + 5_000, 6);
    expect(flag!.at.y).toBeCloseTo(OY + 5_000, 6);
    expect(flag!.atZMm).toBeCloseTo(1_000, 6); // the KEPT (earlier) elevation — what the surface carries
    expect(flag!.messageParams).toEqual({ line: 2, kept: '1.00', overruled: '3.00', deviation: '2.00' });
    expect(flag!.severity).toBe('high');
  });

  it('is silent when crossing breaklines agree — a junction, not a contradiction', () => {
    expect(flagsOf(SQUARE, [line('a', EAST_WEST), line('b', northSouth(1_000))])).toEqual([]);
  });

  it('flags a breakline passing through a survey point at another elevation (the point keeps its Z)', () => {
    const flags = flagsOf([...SQUARE, p(5_000, 5_000, 0)], [line('a', EAST_WEST)]);

    expect(flags).toHaveLength(1);
    expect(flags[0]!.messageKey).toBe('topography.qa.flag.breaklineVertexOn');
    expect(flags[0]!.messageParams).toEqual({ line: 1, kept: '0.00', overruled: '1.00', deviation: '1.00' });
  });

  it('lists the largest Δz first', () => {
    const flags = flagsOf(SQUARE, [
      line('a', EAST_WEST),
      line('b', [p(2_500, 0, 1_200), p(2_500, 10_000, 1_200)]), // Δ 0.20 m
      line('c', [p(7_500, 0, 4_000), p(7_500, 10_000, 4_000)]), // Δ 3.00 m
    ]);
    expect(flags.map((f) => f.messageParams.line)).toEqual([3, 2]);
  });
});

describe('breaklineConflictSeverity — the duplicate points\' bands, nothing hidden below them', () => {
  it.each([
    [1, 'low'], [99, 'low'], [100, 'medium'], [999, 'medium'], [1_000, 'high'], [5_000, 'high'],
  ] as const)('Δz %i mm → %s', (dz, severity) => {
    expect(breaklineConflictSeverity(dz)).toBe(severity);
  });
});

describe('the report comes from the ONE build', () => {
  it('getTopoBuildReport().surface IS getTopoSurfaceFull() — no second triangulation', () => {
    setTopoPoints(SQUARE);
    addBreakline(EAST_WEST);
    addBreakline(northSouth(3_000));

    const report = getTopoBuildReport();
    expect(getTopoSurfaceFull()).toBe(report.surface);
    expect(getTopoBuildReport()).toBe(report);
    expect(report.breaklineConflicts).toHaveLength(1);
  });

  it('runTopoQa surfaces the conflict in the report', () => {
    setTopoPoints(SQUARE);
    addBreakline(EAST_WEST);
    addBreakline(northSouth(3_000));

    const conflicts = runTopoQa('existing').flags.filter((f) => f.kind === 'breakline-conflict');
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]!.messageParams.line).toBe(2);
  });
});
