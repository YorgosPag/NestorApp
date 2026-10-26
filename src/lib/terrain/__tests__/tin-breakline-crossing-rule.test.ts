/**
 * ADR-920 Β4.8 Β3.6 — the engineer's rule at a meeting point of two breaklines (Civil 3D «Crossing Breaklines» ›
 * Use Higher / Lower / Average / Specify), applied by the ONE resolver on every build — and honestly reported when it
 * no longer decides anything.
 */

import {
  CROSSING_RESOLUTION_MATCH_MM,
  crossingRuleZ,
  indexCrossingResolutions,
} from '../breakline-crossing-rule';
import { buildTinWithReport } from '../tin-builder';
import type { Breakline, BreaklineCrossingResolution, TopoPoint } from '../terrain-types';

const FRAME: TopoPoint[] = [
  { x: -1000, y: -1000, z: 0 },
  { x: 4000, y: -1000, z: 0 },
  { x: 4000, y: 2000, z: 0 },
  { x: -1000, y: 2000, z: 0 },
];

function line(
  id: string, x0: number, y0: number, x1: number, y1: number, z0: number, z1 = z0,
  crossingResolutions?: readonly BreaklineCrossingResolution[],
): Breakline {
  return { id, vertices: [{ x: x0, y: y0, z: z0 }, { x: x1, y: y1, z: z1 }], ...(crossingResolutions && { crossingResolutions }) };
}

type Report = ReturnType<typeof buildTinWithReport>;

function zAt(report: Report, x: number, y: number): number {
  const [lx, ly] = [x - report.surface.origin.x, y - report.surface.origin.y];
  const index = report.surface.positions.findIndex(([px, py]) => px === lx && py === ly);
  if (index < 0) throw new Error(`no vertex at ${x},${y}`);
  return report.surface.elevations[index];
}

/** ridge (100, earlier) × ditch (90, later) meet at WORLD (1500, 500). */
const crossing = (onDitch?: BreaklineCrossingResolution, onRidge?: BreaklineCrossingResolution): Breakline[] => [
  line('ridge', 0, 0, 3000, 1000, 100, 100, onRidge && [onRidge]),
  line('ditch', 3000, 0, 0, 1000, 90, 90, onDitch && [onDitch]),
];

const AT = { x: 1500, y: 500 } as const;

describe('crossingRuleZ — the four Civil 3D options', () => {
  it.each([
    ['higher', 100], ['lower', 90], ['average', 95],
  ] as const)('%s → %d', (rule, z) => {
    expect(crossingRuleZ({ withBreaklineId: 'x', ...AT, rule }, 100, 90)).toBe(z);
    // Order-independent: the rule names a VALUE, not a line — unlike «the earlier wins».
    expect(crossingRuleZ({ withBreaklineId: 'x', ...AT, rule }, 90, 100)).toBe(z);
  });

  it('specify → the given value, whatever the lines say', () => {
    expect(crossingRuleZ({ withBreaklineId: 'x', ...AT, rule: 'specify', z: 97 }, 100, 90)).toBe(97);
  });
});

describe('the resolver applies a stored rule (ADR-920 Β3.6)', () => {
  it('a rule on the LATER line decides the node; ONE conflict carries the resolution and both statements', () => {
    const report = buildTinWithReport(FRAME, crossing({ withBreaklineId: 'ridge', ...AT, rule: 'average' }));
    expect(zAt(report, 1500, 500)).toBe(95);
    expect(report.breaklineConflicts).toEqual([
      {
        kind: 'crossing', x: 2500, y: 1500, keptZ: 95, overruledZ: 90,
        overruledBreaklineId: 'ditch', keptBreaklineId: 'ridge',
        resolution: {
          rule: 'average', keptLineZ: 100,
          key: { ownerBreaklineId: 'ditch', withBreaklineId: 'ridge', ...AT },
        },
      },
    ]);
    expect(report.unappliedCrossingResolutions).toEqual([]);
  });

  it('the rule may be stored on EITHER line of the pair', () => {
    const report = buildTinWithReport(FRAME, crossing(undefined, { withBreaklineId: 'ditch', ...AT, rule: 'lower' }));
    expect(zAt(report, 1500, 500)).toBe(90);
    expect(report.breaklineConflicts[0].resolution?.key.ownerBreaklineId).toBe('ridge');
  });

  it('specify writes the engineer\'s value at the node', () => {
    const report = buildTinWithReport(FRAME, crossing({ withBreaklineId: 'ridge', ...AT, rule: 'specify', z: 97 }));
    expect(zAt(report, 1500, 500)).toBe(97);
  });

  it('a rule makes the result independent of the input order (the default is not)', () => {
    const rule: BreaklineCrossingResolution = { withBreaklineId: 'ridge', ...AT, rule: 'higher' };
    const [ridge, ditch] = crossing(rule);
    expect(zAt(buildTinWithReport(FRAME, [ridge, ditch]), 1500, 500)).toBe(100);
    expect(zAt(buildTinWithReport(FRAME, [ditch, ridge]), 1500, 500)).toBe(100);
  });

  it(`a meeting point within ${CROSSING_RESOLUTION_MATCH_MM} mm of the stored one is the same decision`, () => {
    const report = buildTinWithReport(FRAME, crossing({ withBreaklineId: 'ridge', x: 1507, y: 500, rule: 'lower' }));
    expect(zAt(report, 1500, 500)).toBe(90);
  });

  it('a meeting point that MOVED further is a different question: default kept, rule reported as not applying', () => {
    const stored = { withBreaklineId: 'ridge', x: 1500 + CROSSING_RESOLUTION_MATCH_MM + 1, y: 500, rule: 'lower' } as const;
    const report = buildTinWithReport(FRAME, crossing(stored));
    expect(zAt(report, 1500, 500)).toBe(100);
    expect(report.breaklineConflicts[0]).not.toHaveProperty('resolution');
    expect(report.unappliedCrossingResolutions).toEqual([
      { ownerBreaklineId: 'ditch', withBreaklineId: 'ridge', x: stored.x, y: stored.y },
    ]);
  });

  it('a rule whose partner is gone decides nothing and is reported', () => {
    const report = buildTinWithReport(FRAME, [line('ditch', 3000, 0, 0, 1000, 90, 90, [{ withBreaklineId: 'ridge', ...AT, rule: 'higher' }])]);
    expect(report.unappliedCrossingResolutions).toHaveLength(1);
  });

  it('a rule where the lines now AGREE decides nothing (no conflict, reported as not needed)', () => {
    const report = buildTinWithReport(FRAME, [
      line('ridge', 0, 0, 3000, 1000, 90),
      line('ditch', 3000, 0, 0, 1000, 90, 90, [{ withBreaklineId: 'ridge', ...AT, rule: 'higher' }]),
    ]);
    expect(report.breaklineConflicts).toEqual([]);
    expect(report.unappliedCrossingResolutions).toHaveLength(1);
  });

  it("a breakline VERTEX on another breakline: the rule moves the shared vertex, so both lines pass through it", () => {
    const report = buildTinWithReport(FRAME, [
      line('drive', 1500, 500, 1500, 1500, 9),
      line('road', 0, 500, 3000, 500, 7, 7, [{ withBreaklineId: 'drive', ...AT, rule: 'lower' }]),
    ]);
    expect(zAt(report, 1500, 500)).toBe(7);
    expect(report.breaklineConflicts).toEqual([
      expect.objectContaining({ kind: 'vertex-on-breakline', keptZ: 7, overruledZ: 7, resolution: expect.objectContaining({ keptLineZ: 9 }) }),
    ]);
  });

  it('a vertex rule is final BEFORE crossings interpolate from it (resolution order)', () => {
    // drive's foot is ruled 9 → 7; a line crossing drive half-way must then read (7 + 9) / 2 = 8, and agree at 8.
    const report = buildTinWithReport(FRAME, [
      line('drive', 1500, 500, 1500, 1500, 9),
      line('road', 0, 500, 3000, 500, 7, 7, [{ withBreaklineId: 'drive', ...AT, rule: 'lower' }]),
      line('path', 1000, 1000, 2000, 1000, 8),
    ]);
    expect(zAt(report, 1500, 1000)).toBe(8);
    expect(report.breaklineConflicts.filter((c) => c.kind === 'crossing')).toEqual([]);
  });

  it('a SURVEY point is never overruled by a rule — the measurement wins (ADR-720)', () => {
    const points: TopoPoint[] = [...FRAME, { x: 1500, y: 500, z: 50 }];
    const report = buildTinWithReport(points, [
      line('slope', 0, 0, 3000, 1000, 0, 40, [{ withBreaklineId: 'anything', ...AT, rule: 'specify', z: 20 }]),
    ]);
    expect(zAt(report, 1500, 500)).toBe(50);
    expect(report.breaklineConflicts[0]).not.toHaveProperty('resolution');
    expect(report.unappliedCrossingResolutions).toHaveLength(1);
  });

  it('too few vertices to triangulate: every stored rule is reported as not applying', () => {
    const report = buildTinWithReport([], [line('a', 0, 0, 1, 0, 1, 1, [{ withBreaklineId: 'b', x: 0, y: 0, rule: 'higher' }])]);
    expect(report.unappliedCrossingResolutions).toHaveLength(1);
  });
});

describe('indexCrossingResolutions', () => {
  it('finds by the unordered pair and the NEAREST stored position within the radius', () => {
    const index = indexCrossingResolutions([
      line('a', 0, 0, 1, 1, 0, 0, [
        { withBreaklineId: 'b', x: 100, y: 0, rule: 'higher' },
        { withBreaklineId: 'b', x: 104, y: 0, rule: 'lower' },
      ]),
    ], { x: 0, y: 0 });
    expect(index.find('b', 'a', 103, 0)?.resolution.rule).toBe('lower');
    expect(index.find('a', 'c', 100, 0)).toBeUndefined();
  });
});
