/**
 * ADR-920 Β4.8 Β3.6 — the drawn line goes through the meeting point at the Z the SURFACE carries there (the earlier
 * line's, a measurement's, or an engineer's rule), never above or below the surface it cuts.
 */

import { breaklinesAsCarried } from '../breakline-carried';
import { buildTinWithReport } from '../tin-builder';
import type { Breakline, TopoPoint } from '../terrain-types';

const FRAME: TopoPoint[] = [
  { x: -1000, y: -1000, z: 0 }, { x: 4000, y: -1000, z: 0 }, { x: 4000, y: 2000, z: 0 }, { x: -1000, y: 2000, z: 0 },
];
const line = (id: string, x0: number, y0: number, x1: number, y1: number, z: number, extra: Partial<Breakline> = {}): Breakline => ({
  id, vertices: [{ x: x0, y: y0, z }, { x: x1, y: y1, z }], ...extra,
});

function carried(breaklines: readonly Breakline[], points: readonly TopoPoint[] = FRAME) {
  const report = buildTinWithReport(points, breaklines);
  return breaklinesAsCarried(breaklines, report.breaklineConflicts, report.surface.origin);
}

describe('breaklinesAsCarried', () => {
  it('the overruled line gets a vertex at the meeting point with the KEPT Z (the default «earlier wins»)', () => {
    const [ridge, ditch] = carried([line('ridge', 0, 0, 3000, 1000, 100), line('ditch', 3000, 0, 0, 1000, 90)]);
    expect(ditch!.vertices).toEqual([{ x: 3000, y: 0, z: 90 }, { x: 1500, y: 500, z: 100 }, { x: 0, y: 1000, z: 90 }]);
    // The kept line passes through its own Z — the inserted vertex changes nothing about its shape.
    expect(ridge!.vertices[1]).toEqual({ x: 1500, y: 500, z: 100 });
  });

  it("an engineer's rule: BOTH lines pass through the rule's Z", () => {
    const lines = [
      line('ridge', 0, 0, 3000, 1000, 100),
      line('ditch', 3000, 0, 0, 1000, 90, { crossingResolutions: [{ withBreaklineId: 'ridge', x: 1500, y: 500, rule: 'average' }] }),
    ];
    const out = carried(lines);
    expect(out.map((b) => b.vertices[1]!.z)).toEqual([95, 95]);
  });

  it('a meeting point AT an existing vertex takes the carried Z instead of adding a vertex', () => {
    const lines = [line('drive', 1500, 500, 1500, 1500, 9), line('road', 0, 500, 3000, 500, 7)];
    const [drive, road] = carried(lines);
    expect(drive!.vertices).toHaveLength(2);
    expect(road!.vertices).toEqual([{ x: 0, y: 500, z: 7 }, { x: 1500, y: 500, z: 9 }, { x: 3000, y: 500, z: 7 }]);
  });

  it('a survey point kept its Z: the line bends to the MEASUREMENT', () => {
    const [slope] = carried([line('slope', 0, 0, 3000, 1000, 0, { vertices: [{ x: 0, y: 0, z: 0 }, { x: 3000, y: 1000, z: 40 }] })], [
      ...FRAME, { x: 1500, y: 500, z: 50 },
    ]);
    expect(slope!.vertices[1]).toEqual({ x: 1500, y: 500, z: 50 });
  });

  it('no meeting points ⇒ the SAME array (a cache by identity stays warm)', () => {
    const lines = [line('a', 0, 0, 3000, 0, 5), line('b', 0, 1000, 3000, 1000, 5)];
    expect(carried(lines)).toBe(lines);
  });

  it('a line without a meeting point keeps its identity even when another changes', () => {
    const lonely = line('lonely', 0, 1500, 3000, 1500, 1);
    const out = carried([line('ridge', 0, 0, 3000, 1000, 100), line('ditch', 3000, 0, 0, 1000, 90), lonely]);
    expect(out[2]).toBe(lonely);
  });
});
