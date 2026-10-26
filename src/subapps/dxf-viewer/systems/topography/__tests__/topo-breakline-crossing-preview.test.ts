/**
 * ADR-920 Β4.8 Β3.6 — the resolve preview IS the result (same `crossingRuleZ` as the resolver), it says what the rule does
 * to the lines' grades, and the decision it writes lands where the resolver will find it.
 */

import { buildTinWithReport } from '@/lib/terrain/tin-builder';
import {
  bulkCrossingDecisions, crossingDecisionOf, isResolvable, previewCrossing, runAt,
} from '../topo-breakline-crossing-preview';
import { buildBreaklineInventory, type BreaklineConflictRow, type BreaklineSurfaceInput } from '../topo-breakline-inventory';
import { TOPO_QA_CONFIG } from '../qa/topo-qa-config';
import type { Breakline, TopoPoint } from '../topo-types';

const FRAME: TopoPoint[] = [
  { x: -1000, y: -1000, z: 0 }, { x: 4000, y: -1000, z: 0 }, { x: 4000, y: 2000, z: 0 }, { x: -1000, y: 2000, z: 0 },
];
const line = (id: string, x0: number, y0: number, x1: number, y1: number, z: number, extra: Partial<Breakline> = {}): Breakline => ({
  id, vertices: [{ x: x0, y: y0, z }, { x: x1, y: y1, z }], ...extra,
});
const EMPTY: BreaklineSurfaceInput = { breaklines: [], conflicts: [], origin: { x: 0, y: 0 }, unappliedResolutions: [] };

/** ridge (1.00 m, earlier) × ditch (3.00 m) at WORLD (1500, 500) — the live test level's shape. */
function inventoryOf(breaklines: readonly Breakline[], points: readonly TopoPoint[] = FRAME) {
  const report = buildTinWithReport(points, breaklines);
  const existing: BreaklineSurfaceInput = {
    breaklines, conflicts: report.breaklineConflicts, origin: report.surface.origin,
    unappliedResolutions: report.unappliedCrossingResolutions,
  };
  return buildBreaklineInventory({ surfaces: { existing, proposed: EMPTY }, sceneEntityIds: null });
}

const PAIR = [line('ridge', 0, 0, 3000, 1000, 1000), line('ditch', 3000, 0, 0, 1000, 3000)];
const byId = (lines: readonly Breakline[]) => (id: string) => lines.find((b) => b.id === id);

describe('previewCrossing', () => {
  const [row] = inventoryOf(PAIR).conflicts as [BreaklineConflictRow];

  it.each([['higher', 3000], ['lower', 1000], ['average', 2000]] as const)('%s → %d, and how far each line moves', (rule, z) => {
    const preview = previewCrossing(row, { rule }, byId(PAIR));
    expect(preview.z).toBe(z);
    expect(preview.shiftKept).toBe(z - 1000);
    expect(preview.shiftOverruled).toBe(z - 3000);
  });

  it('grade change = shift / run to the nearest vertex; steep above the QA threshold', () => {
    const run = Math.hypot(1500, 500); // the meeting point is mid-segment on both diagonals
    const preview = previewCrossing(row, { rule: 'higher' }, byId(PAIR));
    expect(preview.gradeChange).toBeCloseTo(2000 / run, 9);
    expect(preview.steep).toBe(2000 / run > TOPO_QA_CONFIG.BREAKLINE_RESOLUTION_GRADE_WARN);
    // The SAME 2 m over ~158 m runs is gentle — the warning is about grade, never about Δz alone.
    const LONG = [line('ridge', 0, 0, 300_000, 100_000, 1000), line('ditch', 300_000, 0, 0, 100_000, 3000)];
    const longFrame: TopoPoint[] = [
      { x: -1000, y: -1000, z: 0 }, { x: 301_000, y: -1000, z: 0 }, { x: 301_000, y: 101_000, z: 0 }, { x: -1000, y: 101_000, z: 0 },
    ];
    const [longRow] = inventoryOf(LONG, longFrame).conflicts as [BreaklineConflictRow];
    expect(previewCrossing(longRow, { rule: 'higher' }, byId(LONG)).steep).toBe(false);
  });

  it('a line it cannot find ⇒ no grade to report (never a made-up 0)', () => {
    expect(previewCrossing(row, { rule: 'higher' }, () => undefined).gradeChange).toBeNull();
  });
});

describe('crossingDecisionOf → the resolver', () => {
  it('the written decision is found by the resolver: preview z === surface z after the rebuild', () => {
    const [row] = inventoryOf(PAIR).conflicts as [BreaklineConflictRow];
    const decision = crossingDecisionOf(row, { rule: 'specify', z: 2400 })!;
    expect(decision.ownerBreaklineId).toBe('ditch');
    const next = PAIR.map((b) => (b.id === decision.ownerBreaklineId ? { ...b, crossingResolutions: [decision.resolution] } : b));
    const after = inventoryOf(next);
    expect(after.conflicts).toEqual([]);
    expect(after.resolved[0]?.surfaceZ).toBe(previewCrossing(row, { rule: 'specify', z: 2400 }, byId(PAIR)).z);
  });

  it('a resolved row re-decides on the line that already holds its decision', () => {
    const held = [PAIR[0]!, { ...PAIR[1]!, crossingResolutions: [] }];
    const ridgeHolds = [{ ...held[0]!, crossingResolutions: [{ withBreaklineId: 'ditch', x: 1500, y: 500, rule: 'lower' as const }] }, held[1]!];
    const [row] = inventoryOf(ridgeHolds).resolved as [BreaklineConflictRow];
    const decision = crossingDecisionOf(row, { rule: 'higher' })!;
    expect([decision.ownerBreaklineId, decision.resolution.withBreaklineId]).toEqual(['ridge', 'ditch']);
  });

  it('a survey point kept its Z ⇒ no rule to write (the measurement wins)', () => {
    const [row] = inventoryOf([line('slope', 0, 0, 3000, 1000, 0)], [...FRAME, { x: 1500, y: 500, z: 50 }]).conflicts as [BreaklineConflictRow];
    expect(isResolvable(row)).toBe(false);
    expect(crossingDecisionOf(row, { rule: 'higher' })).toBeNull();
  });

  it('«resolve all» = one decision per open, resolvable conflict, grouped by surface', () => {
    const third = line('path', 2000, -500, 2000, 1500, 5000);
    const inv = inventoryOf([...PAIR, third]);
    const groups = bulkCrossingDecisions(inv.conflicts, 'average');
    expect([...groups.keys()]).toEqual(['existing']);
    expect(groups.get('existing')).toHaveLength(inv.conflicts.length);
  });
});

describe('runAt', () => {
  it('a meeting point AT a vertex measures to the neighbours, not to itself', () => {
    const bent: Breakline = { id: 'b', vertices: [{ x: 0, y: 0, z: 0 }, { x: 100, y: 0, z: 0 }, { x: 100, y: 300, z: 0 }] };
    expect(runAt(bent, { x: 100, y: 0 })).toBe(100);
  });

  it('a point off the line ⇒ null', () => {
    expect(runAt(line('a', 0, 0, 100, 0, 0), { x: 50, y: 50 })).toBeNull();
  });
});
