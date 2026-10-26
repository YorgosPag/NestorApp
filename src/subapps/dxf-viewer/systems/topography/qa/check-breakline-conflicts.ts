/**
 * ADR-920 Β4.8 Τ.3 — breaklines that give ONE position TWO elevations.
 *
 * The builder (`buildTinWithReport`) already resolved every one of them: a node at each crossing, a split at each vertex
 * on a breakline, the EARLIER statement kept and the later one overruled — the same rule as two survey shots at one
 * position. What it cannot do is tell the engineer. This check is that telling, and nothing else: it reads the report of
 * the ONE triangulation (`getTopoBuildReport`, never a second `buildTin`) and turns each conflict into a flag.
 *
 * Big-player model: Carlson «Highlight Crossing Breaklines» (mark them) · Civil 3D «Resolve Crossing Breaklines» (list the
 * pairs with their Δz, Zoom To). Beyond both: nothing below a tolerance is hidden — the overruled breakline HAS been bent,
 * so every one is listed and the Δz only triages it (bands shared with `duplicate-point`, `topo-qa-config`).
 */

import type { Breakline, BreaklineElevationConflict, LocalOrigin } from '../topo-types';
import type { TopoQaFlag, TopoQaSeverity } from './topo-qa-types';
import { TOPO_QA_CONFIG } from './topo-qa-config';
import { mmToMetreString } from './topo-qa-format';

const { BREAKLINE_CONFLICT_MEDIUM_DZ_MM, BREAKLINE_CONFLICT_HIGH_DZ_MM } = TOPO_QA_CONFIG;

const MESSAGE_KEY: Readonly<Record<BreaklineElevationConflict['kind'], string>> = {
  'crossing': 'topography.qa.flag.breaklineCrossing',
  'vertex-on-breakline': 'topography.qa.flag.breaklineVertexOn',
};

/** ADR-920 Β3.6 — a conflict an engineer's rule decided: listed as a decision, no longer a QA finding. */
const RESOLVED_MESSAGE_KEY = 'topography.qa.flag.breaklineResolved';

/** `keptLine` when no breakline holds the kept elevation — a survey point does. The `none` branch of the ICU select. */
export const KEPT_BY_SURVEY = 'none';

/** Δz → severity. Never «not flagged»: the builder only reports real disagreements. */
export function breaklineConflictSeverity(dzMm: number): TopoQaSeverity {
  if (dzMm >= BREAKLINE_CONFLICT_HIGH_DZ_MM) return 'high';
  return dzMm >= BREAKLINE_CONFLICT_MEDIUM_DZ_MM ? 'medium' : 'low';
}

/**
 * The surveyor's name for a breakline: its 1-based position, as `check-boundary-closure` names rings (`#{ring}`). The
 * ids come from the same definition the builder read, so a miss is impossible in practice — if it ever happens the raw
 * id is shown rather than a made-up number. Exported: the breakline list (ADR-920 Β3.5) numbers its rows with the SAME
 * function, so «#2» in a QA message and «#2» in the list are always the same line.
 */
export function breaklineLabelsOf(breaklines: readonly Breakline[]): (id: string) => string | number {
  const position = new Map<string, number>();
  breaklines.forEach((line, i) => { if (!position.has(line.id)) position.set(line.id, i + 1); });
  return (id) => position.get(id) ?? id;
}

/** One conflict with its report index (`n` → stable flag id) and its |Δz|. */
export interface RankedBreaklineConflict {
  readonly conflict: BreaklineElevationConflict;
  readonly n: number;
  readonly dz: number;
}

/**
 * ADR-920 Β3.6 — what the two sides SAID at the meeting point (WORLD mm), whether or not a rule then decided it: the
 * kept side's own statement and the overruled line's. Without a rule the surface carries `kept`; with one, `keptZ`.
 */
export function conflictStatements(conflict: BreaklineElevationConflict): { readonly kept: number; readonly overruled: number } {
  return { kept: conflict.resolution?.keptLineZ ?? conflict.keptZ, overruled: conflict.overruledZ };
}

/**
 * Largest Δz first — the order both the QA report and the breakline list show (ADR-920 Β3.5: one ranking, not two).
 * Δz = how far the two statements DISAGREED (Β3.6: a rule does not shrink the question it answered).
 */
export function rankBreaklineConflicts(conflicts: readonly BreaklineElevationConflict[]): RankedBreaklineConflict[] {
  return conflicts
    .map((conflict, n) => {
      const { kept, overruled } = conflictStatements(conflict);
      return { conflict, n, dz: Math.abs(kept - overruled) };
    })
    .sort((a, b) => b.dz - a.dz);
}

/** The QA flag of ONE ranked conflict. `origin` = the LOCAL frame of the report's surface. */
export function breaklineConflictFlag(
  { conflict, n, dz }: RankedBreaklineConflict,
  labelOf: (id: string) => string | number,
  origin: LocalOrigin,
): TopoQaFlag {
  const { kept } = conflictStatements(conflict);
  return {
    id: `breakline-conflict:${n}`,
    kind: 'breakline-conflict',
    severity: breaklineConflictSeverity(dz),
    at: { x: conflict.x + origin.x, y: conflict.y + origin.y },
    // The KEPT elevation — the surface the engineer is looking at carries it, so the 3D ⊙ sits on the ground.
    atZMm: conflict.keptZ,
    messageKey: conflict.resolution ? RESOLVED_MESSAGE_KEY : MESSAGE_KEY[conflict.kind],
    messageParams: {
      line: labelOf(conflict.overruledBreaklineId),
      // ADR-920 Β3.2 — the OTHER half of the pair. `none` = the kept Z is a survey point's (ICU `select`).
      keptLine: conflict.keptBreaklineId !== undefined ? labelOf(conflict.keptBreaklineId) : KEPT_BY_SURVEY,
      kept: mmToMetreString(kept),
      overruled: mmToMetreString(conflict.overruledZ),
      deviation: mmToMetreString(dz),
      // Β3.6 — the decision and what it gave, only on a resolved conflict (its own message key).
      ...(conflict.resolution && { rule: conflict.resolution.rule, result: mmToMetreString(conflict.keptZ) }),
    },
  };
}

/**
 * One flag per OPEN conflict, largest Δz first. `origin` = the LOCAL frame of the report's surface. A conflict an
 * engineer's rule decided (Β3.6) is a decision, not a finding — Civil 3D drops it from the vista; the breakline list
 * keeps showing it as resolved, so it can be changed or reverted.
 */
export function checkBreaklineConflicts(
  conflicts: readonly BreaklineElevationConflict[],
  breaklines: readonly Breakline[],
  origin: LocalOrigin,
): TopoQaFlag[] {
  const labelOf = breaklineLabelsOf(breaklines);
  // Rank ALL, then drop the decided: `n` (→ the flag id) stays the conflict's index in the report, so the QA report
  // and the breakline list name the same conflict with the same id.
  return rankBreaklineConflicts(conflicts)
    .filter(({ conflict }) => conflict.resolution === undefined)
    .map((ranked) => breaklineConflictFlag(ranked, labelOf, origin));
}
