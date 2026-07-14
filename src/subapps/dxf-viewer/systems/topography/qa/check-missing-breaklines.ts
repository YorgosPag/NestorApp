/**
 * ADR-650 M5α — suspected missing breaklines (unconstrained steep TIN edges).
 *
 * Where the surface folds sharply — a road edge, a ditch, a retaining wall — the TIN should
 * be pinned by a breakline, or Delaunay will swing the triangulation across the break and
 * round off the very feature that matters (ADR-650 §5). The measurement itself is the shared
 * `findSteepUnconstrainedEdges` SSoT (M8β/Γ chains the very same edges into candidate feature
 * lines); this check is the QA READER of it: each steep edge becomes the surveyor's cue
 * «should there be a breakline here?». Advisory by nature (a hint, not an error), so it tops
 * out at `medium`.
 *
 * @see ../auto-breaklines/detect-feature-edges.ts — the fold measurement (shared with M8β/Γ)
 */

import type { TinSurface, Breakline, LocalOrigin } from '../topo-types';
import type { TopoQaFlag, TopoQaSeverity } from './topo-qa-types';
import { TOPO_QA_CONFIG } from './topo-qa-config';
import { edgeKey } from './topo-qa-topology';
import { findSteepUnconstrainedEdges } from '../auto-breaklines/detect-feature-edges';

/** WORLD midpoint of an edge (marker + zoom-to). */
function edgeMidWorld(surface: TinSurface, a: number, b: number): { x: number; y: number } {
  const pa = surface.positions[a]!; const pb = surface.positions[b]!;
  return { x: (pa[0] + pb[0]) / 2 + surface.origin.x, y: (pa[1] + pb[1]) / 2 + surface.origin.y };
}

/** Steep UNCONSTRAINED edges as flags, steepest first (per-kind cap applied by the orchestrator). */
export function checkMissingBreaklines(
  surface: TinSurface,
  breaklines: readonly Breakline[],
  origin: LocalOrigin,
): TopoQaFlag[] {
  const { MISSING_BREAKLINE_ANGLE_DEG, MISSING_BREAKLINE_HIGH_ANGLE_DEG } = TOPO_QA_CONFIG;

  return findSteepUnconstrainedEdges(surface, breaklines, origin, MISSING_BREAKLINE_ANGLE_DEG)
    .map(({ a, b, foldDeg }) => {
      const severity: TopoQaSeverity = foldDeg >= MISSING_BREAKLINE_HIGH_ANGLE_DEG ? 'medium' : 'low';
      return {
        id: `missing-breakline:${edgeKey(a, b)}`,
        kind: 'missing-breakline' as const,
        severity,
        at: edgeMidWorld(surface, a, b),
        messageKey: 'topography.qa.flag.missingBreakline',
        messageParams: { angle: foldDeg.toFixed(0) },
      };
    });
}
