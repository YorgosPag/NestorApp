/**
 * ADR-920 Β4.8 Β3.6 — what a Resolve WOULD do, before it does it; and the decision it writes.
 *
 * Civil 3D's «Crossing Breaklines» vista shows the Δz and applies the rule; nothing tells the engineer what the rule does
 * to the LINES. Here, for a candidate rule: the elevation the meeting point gets, how far each line moves there, and how
 * much that changes the line's grade next to it (rise / run to the nearest vertex) — a Δz harmless over 20 m is a cliff
 * over 30 cm. Same `crossingRuleZ` the resolver applies, so the preview is the result, not an estimate.
 *
 * Pure — zero React/store. The decision's position is the conflict's WORLD position (`flag.at`), the frame the
 * resolver matches stored decisions in.
 */

import { distanceToSegment } from '@/lib/geometry/planar-polygon';
import { crossingRuleZ } from '@/lib/terrain/breakline-crossing-rule';
import type { BreaklineCrossingResolution, BreaklineCrossingRule } from '@/lib/terrain/terrain-types';
import type { Breakline, TopoSurfaceId } from './topo-types';
import type { BreaklineConflictRow } from './topo-breakline-inventory';
import { TOPO_QA_CONFIG } from './qa/topo-qa-config';

/** The rules a whole list can take at once — «Specify» names ONE value for ONE point, never a batch. */
export const BULK_CROSSING_RULES = ['higher', 'lower', 'average'] as const satisfies readonly BreaklineCrossingRule[];

export type CrossingChoice =
  | { readonly rule: (typeof BULK_CROSSING_RULES)[number] }
  /** WORLD canonical mm. */
  | { readonly rule: 'specify'; readonly z: number };

export interface CrossingDecision {
  readonly ownerBreaklineId: string;
  readonly resolution: BreaklineCrossingResolution;
}

export interface CrossingPreview {
  /** The meeting point's elevation under the rule (WORLD mm). */
  readonly z: number;
  /** How far each line moves THERE (WORLD mm, signed: + = up). */
  readonly shiftKept: number;
  readonly shiftOverruled: number;
  /** The larger of the two lines' grade changes next to the point (rise / run); `null` = no run to measure. */
  readonly gradeChange: number | null;
  readonly steep: boolean;
}

/** Below this a vertex IS the meeting point (WORLD mm) — not a run to measure a grade over. */
const SAME_POSITION_MM = 1;

/** Only a breakline-vs-breakline conflict takes a rule: where a survey point kept its Z, the measurement wins. */
export function isResolvable(row: BreaklineConflictRow): boolean {
  return row.keptBreaklineId !== null;
}

/**
 * The decision to store: on the line that already holds this point's decision, else on the BENT line — the one
 * the engineer is looking at. `null` for a conflict that takes no rule.
 */
export function crossingDecisionOf(row: BreaklineConflictRow, choice: CrossingChoice): CrossingDecision | null {
  if (row.keptBreaklineId === null) return null;
  const owner = row.resolution?.key.ownerBreaklineId ?? row.overruledBreaklineId;
  const withBreaklineId = owner === row.overruledBreaklineId ? row.keptBreaklineId : row.overruledBreaklineId;
  const at = { withBreaklineId, x: row.flag.at.x, y: row.flag.at.y };
  return { ownerBreaklineId: owner, resolution: { ...at, ...choice } };
}

/**
 * Planimetric distance from `at` to the nearest vertex of the segment(s) `at` lies on — the run over which a Z
 * change at `at` is absorbed. `null` when the line does not pass through `at`.
 */
export function runAt(line: Breakline, at: { readonly x: number; readonly y: number }): number | null {
  const v = line.vertices;
  const count = line.closed && v.length > 2 ? v.length : v.length - 1;
  let run = Infinity;
  for (let i = 0; i < count; i++) {
    const a = v[i]!;
    const b = v[(i + 1) % v.length]!;
    if (distanceToSegment(at, a, b) > SAME_POSITION_MM) continue;
    for (const end of [a, b]) {
      const d = Math.hypot(end.x - at.x, end.y - at.y);
      if (d > SAME_POSITION_MM) run = Math.min(run, d);
    }
  }
  return Number.isFinite(run) ? run : null;
}

function gradeChangeOf(line: Breakline | undefined, at: { readonly x: number; readonly y: number }, shift: number): number | null {
  const run = line ? runAt(line, at) : null;
  return run === null ? null : Math.abs(shift) / run;
}

/** What `choice` would do at `row`'s meeting point. `lineOf` resolves a breakline id of the row's surface. */
export function previewCrossing(
  row: BreaklineConflictRow,
  choice: CrossingChoice,
  lineOf: (id: string) => Breakline | undefined,
): CrossingPreview {
  const { kept, overruled } = row.statements;
  const z = crossingRuleZ({ withBreaklineId: '', x: 0, y: 0, ...choice }, kept, overruled);
  const shiftKept = z - kept;
  const shiftOverruled = z - overruled;
  const grades = [
    row.keptBreaklineId === null ? null : gradeChangeOf(lineOf(row.keptBreaklineId), row.flag.at, shiftKept),
    gradeChangeOf(lineOf(row.overruledBreaklineId), row.flag.at, shiftOverruled),
  ].filter((g): g is number => g !== null);
  const gradeChange = grades.length > 0 ? Math.max(...grades) : null;
  return {
    z, shiftKept, shiftOverruled, gradeChange,
    steep: gradeChange !== null && gradeChange > TOPO_QA_CONFIG.BREAKLINE_RESOLUTION_GRADE_WARN,
  };
}

/**
 * «Resolve all»: one decision per OPEN, resolvable conflict, grouped by surface — the command is per surface, so each
 * group is ONE undoable step.
 */
export function bulkCrossingDecisions(
  rows: readonly BreaklineConflictRow[],
  rule: (typeof BULK_CROSSING_RULES)[number],
): ReadonlyMap<TopoSurfaceId, CrossingDecision[]> {
  const bySurface = new Map<TopoSurfaceId, CrossingDecision[]>();
  for (const row of rows) {
    const decision = row.resolution === null ? crossingDecisionOf(row, { rule }) : null;
    if (!decision) continue;
    const list = bySurface.get(row.surfaceId);
    if (list) list.push(decision);
    else bySurface.set(row.surfaceId, [decision]);
  }
  return bySurface;
}
