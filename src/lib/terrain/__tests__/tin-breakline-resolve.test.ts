/**
 * ADR-920 Β4.8 Τ — breakline resolution: crossings get a node, vertices on a breakline split it, and every place
 * where two elevations meet one position is REPORTED (the survey points' rule: the earlier statement is kept).
 */

import { buildTinWithReport } from '../tin-builder';
import { elevationsAgree } from '../tin-breakline-resolve';
import type { Breakline, TopoPoint } from '../terrain-types';
import { cross, hasEdge, jitteredGrid, triangleArea, type Pt } from './tin-test-geometry';

type Report = ReturnType<typeof buildTinWithReport>;

/**
 * Survey corners AROUND the breaklines (LOCAL origin = (−1000, −1000)) — no breakline vertex coincides with a survey
 * point, so each case isolates the one resolution it is about.
 */
const FRAME: TopoPoint[] = [
  { x: -1000, y: -1000, z: 0 },
  { x: 4000, y: -1000, z: 0 },
  { x: 4000, y: 2000, z: 0 },
  { x: -1000, y: 2000, z: 0 },
];

function line(id: string, x0: number, y0: number, x1: number, y1: number, z0: number, z1 = z0): Breakline {
  return { id, vertices: [{ x: x0, y: y0, z: z0 }, { x: x1, y: y1, z: z1 }] };
}

/** LOCAL point (origin subtracted) for a WORLD pair. */
function local(report: Report, x: number, y: number): Pt {
  return [x - report.surface.origin.x, y - report.surface.origin.y];
}

/** The surface elevation at a WORLD position that is a vertex. */
function zAt(report: Report, x: number, y: number): number {
  const [lx, ly] = local(report, x, y);
  const index = report.surface.positions.findIndex(([px, py]) => px === lx && py === ly);
  if (index < 0) throw new Error(`no vertex at ${x},${y}`);
  return report.surface.elevations[index];
}

const DIAGONALS = (za: number, zb: number): Breakline[] => [line('a', 0, 0, 3000, 1000, za), line('b', 3000, 0, 0, 1000, zb)];

describe('resolveBreaklines through buildTinWithReport (ADR-920 Β4.8 Τ)', () => {
  it('two crossing breaklines BOTH survive: a node is inserted and each is split there', () => {
    const report = buildTinWithReport(FRAME, DIAGONALS(5, 5));
    expect(report.surface.positions).toHaveLength(FRAME.length + 4 + 1);
    const node = local(report, 1500, 500);
    for (const [x, y] of [[0, 0], [3000, 1000], [3000, 0], [0, 1000]] as const) {
      expect(hasEdge(report.surface, local(report, x, y), node)).toBe(true);
    }
    expect(report.refusedSegmentCount).toBe(0);
  });

  it('a junction at ONE elevation is not a problem: no conflict is reported', () => {
    const report = buildTinWithReport(FRAME, [line('a', 0, 0, 3000, 1000, 0, 10), line('b', 3000, 0, 0, 1000, 10, 0)]);
    expect(report.breaklineConflicts).toEqual([]);
    expect(zAt(report, 1500, 500)).toBe(5);
  });

  it('two elevations at a crossing: the EARLIER breakline is kept and the later one is named', () => {
    const report = buildTinWithReport(FRAME, [line('ridge', 0, 0, 3000, 1000, 100), line('ditch', 3000, 0, 0, 1000, 90)]);
    expect(zAt(report, 1500, 500)).toBe(100);
    expect(report.breaklineConflicts).toEqual([
      {
        kind: 'crossing', x: 2500, y: 1500, keptZ: 100, overruledZ: 90,
        overruledBreaklineId: 'ditch', keptBreaklineId: 'ridge',
      },
    ]);
  });

  it('the input order decides which statement is kept (deterministic, like the survey points)', () => {
    const report = buildTinWithReport(FRAME, [line('ditch', 3000, 0, 0, 1000, 90), line('ridge', 0, 0, 3000, 1000, 100)]);
    expect(zAt(report, 1500, 500)).toBe(90);
    // Β3.2 — the PAIR, both halves (Civil 3D «Crossing Breaklines»): who was kept AND who was overruled.
    expect(report.breaklineConflicts.map((c) => [c.keptBreaklineId, c.overruledBreaklineId])).toEqual([['ditch', 'ridge']]);
  });

  it("an earlier breakline's VERTEX on a later breakline names the earlier one as kept (Β3.2)", () => {
    const report = buildTinWithReport(FRAME, [line('drive', 1500, 500, 1500, 1500, 9), line('road', 0, 500, 3000, 500, 7)]);
    expect(zAt(report, 1500, 500)).toBe(9);
    expect(report.breaklineConflicts).toEqual([
      {
        kind: 'vertex-on-breakline', x: 2500, y: 1500, keptZ: 9, overruledZ: 7,
        overruledBreaklineId: 'road', keptBreaklineId: 'drive',
      },
    ]);
  });

  it('a survey vertex ON a breakline splits it and keeps its measured Z; a disagreement is reported', () => {
    const points: TopoPoint[] = [...FRAME, { x: 1500, y: 500, z: 50 }];
    const report = buildTinWithReport(points, [line('slope', 0, 0, 3000, 1000, 0, 40)]);
    const mid = local(report, 1500, 500);
    expect(hasEdge(report.surface, local(report, 0, 0), mid)).toBe(true);
    expect(hasEdge(report.surface, mid, local(report, 3000, 1000))).toBe(true);
    expect(report.surface.positions).toHaveLength(points.length + 2);
    expect(report.breaklineConflicts).toEqual([
      { kind: 'vertex-on-breakline', x: 2500, y: 1500, keptZ: 50, overruledZ: 20, overruledBreaklineId: 'slope' },
    ]);
    // A measurement kept its Z — naming a breakline as «kept» would be a lie (Β3.2).
    expect(report.breaklineConflicts[0]).not.toHaveProperty('keptBreaklineId');
  });

  it("a survey vertex on a breakline at the breakline's own elevation is silent", () => {
    const points: TopoPoint[] = [...FRAME, { x: 1500, y: 500, z: 20 }];
    expect(buildTinWithReport(points, [line('slope', 0, 0, 3000, 1000, 0, 40)]).breaklineConflicts).toEqual([]);
  });

  it('a breakline vertex ON a survey point merges with it, keeps the measured Z, and the disagreement is reported', () => {
    const points: TopoPoint[] = [...FRAME, { x: 0, y: 0, z: 3 }];
    const report = buildTinWithReport(points, [line('kerb', 0, 0, 3000, 1000, 8)]);
    expect(zAt(report, 0, 0)).toBe(3);
    expect(report.breaklineConflicts).toEqual([
      { kind: 'vertex-on-breakline', x: 1000, y: 1000, keptZ: 3, overruledZ: 8, overruledBreaklineId: 'kerb' },
    ]);
    // The merged vertex belongs to the survey point (collected first), not to the breakline that landed on it.
    expect(report.breaklineConflicts[0]).not.toHaveProperty('keptBreaklineId');
  });

  it('a T-junction (one breakline ending on another) splits the through-line at the junction', () => {
    const report = buildTinWithReport(FRAME, [line('road', 0, 500, 3000, 500, 7), line('drive', 1500, 500, 1500, 1500, 7, 9)]);
    const junction = local(report, 1500, 500);
    expect(hasEdge(report.surface, local(report, 0, 500), junction)).toBe(true);
    expect(hasEdge(report.surface, junction, local(report, 3000, 500))).toBe(true);
    expect(report.breaklineConflicts).toEqual([]);
    expect(report.refusedSegmentCount).toBe(0);
  });

  it('overlapping collinear breaklines become shared sub-edges, none refused', () => {
    const report = buildTinWithReport(FRAME, [line('a', 0, 0, 3000, 0, 3), line('b', 1000, 0, 4000, 0, 3)]);
    const at = (x: number): Pt => local(report, x, 0);
    expect(hasEdge(report.surface, at(0), at(1000))).toBe(true);
    expect(hasEdge(report.surface, at(1000), at(3000))).toBe(true);
    expect(hasEdge(report.surface, at(3000), at(4000))).toBe(true);
    expect(report.refusedSegmentCount).toBe(0);
  });

  it('three breaklines through one point share ONE node', () => {
    const report = buildTinWithReport(FRAME, [...DIAGONALS(1, 1), line('c', 1500, -500, 1500, 1500, 1)]);
    expect(report.surface.positions).toHaveLength(FRAME.length + 6 + 1);
    expect(report.refusedSegmentCount).toBe(0);
  });

  it('a dense tangle of crossing breaklines: nothing refused, every vertex used, every triangle CCW, no hole', () => {
    const points = jitteredGrid(20, 20, 1000);
    const breaklines: Breakline[] = [];
    let seed = 12345;
    const next = (): number => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
    const coord = (): number => Math.round(next() * 17000) + 1000;
    for (let i = 0; i < 40; i++) breaklines.push(line(`bl${i}`, coord(), coord(), coord(), coord(), 100 + i));
    const plain = buildTinWithReport(points).surface;
    const report = buildTinWithReport(points, breaklines);
    const { surface } = report;
    expect(report.refusedSegmentCount).toBe(0);
    expect(report.breaklineConflicts.length).toBeGreaterThan(0);
    expect(new Set(surface.triangles.flat()).size).toBe(surface.positions.length);
    for (const [i, j, k] of surface.triangles) {
      expect(cross(surface.positions[i], surface.positions[j], surface.positions[k])).toBeGreaterThan(0);
    }
    expect(triangleArea(surface)).toBeCloseTo(triangleArea(plain), 3);
  });

  it('elevations agree on float noise only — a millimetre is a disagreement', () => {
    expect(elevationsAgree(123_456.789, 123_456.789 + 1e-9)).toBe(true);
    expect(elevationsAgree(100, 101)).toBe(false);
    expect(elevationsAgree(100, 100.001)).toBe(false);
  });
});
