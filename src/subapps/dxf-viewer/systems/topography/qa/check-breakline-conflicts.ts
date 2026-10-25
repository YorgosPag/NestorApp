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

/** Δz → severity. Never «not flagged»: the builder only reports real disagreements. */
export function breaklineConflictSeverity(dzMm: number): TopoQaSeverity {
  if (dzMm >= BREAKLINE_CONFLICT_HIGH_DZ_MM) return 'high';
  return dzMm >= BREAKLINE_CONFLICT_MEDIUM_DZ_MM ? 'medium' : 'low';
}

/**
 * The surveyor's name for a breakline: its 1-based position, as `check-boundary-closure` names rings (`#{ring}`). The
 * ids come from the same definition the builder read, so a miss is impossible in practice — if it ever happens the raw
 * id is shown rather than a made-up number.
 */
function breaklineLabelsOf(breaklines: readonly Breakline[]): (id: string) => string | number {
  const position = new Map<string, number>();
  breaklines.forEach((line, i) => { if (!position.has(line.id)) position.set(line.id, i + 1); });
  return (id) => position.get(id) ?? id;
}

/** One flag per conflict, largest Δz first. `origin` = the LOCAL frame of the report's surface. */
export function checkBreaklineConflicts(
  conflicts: readonly BreaklineElevationConflict[],
  breaklines: readonly Breakline[],
  origin: LocalOrigin,
): TopoQaFlag[] {
  const labelOf = breaklineLabelsOf(breaklines);
  return conflicts
    .map((conflict, n) => ({ conflict, n, dz: Math.abs(conflict.keptZ - conflict.overruledZ) }))
    .sort((a, b) => b.dz - a.dz)
    .map(({ conflict, n, dz }) => ({
      id: `breakline-conflict:${n}`,
      kind: 'breakline-conflict' as const,
      severity: breaklineConflictSeverity(dz),
      at: { x: conflict.x + origin.x, y: conflict.y + origin.y },
      // The KEPT elevation — the surface the engineer is looking at carries it, so the 3D ⊙ sits on the ground.
      atZMm: conflict.keptZ,
      messageKey: MESSAGE_KEY[conflict.kind],
      messageParams: {
        line: labelOf(conflict.overruledBreaklineId),
        kept: mmToMetreString(conflict.keptZ),
        overruled: mmToMetreString(conflict.overruledZ),
        deviation: mmToMetreString(dz),
      },
    }));
}
