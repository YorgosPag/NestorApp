/**
 * ADR-650 M8β/Γ — auto-breakline detection: the SSoT entry the UI calls.
 *
 * Differentiator #3 (§9): today the engineer marks every breakline by hand (M2-Β); here the
 * system reads its OWN surface and proposes them. Deterministic — zero LLM, zero cost, the
 * same discipline as the M5α QA engine: the same survey always yields the same proposals.
 *
 * Two functions, and the split between them is the whole safety model:
 *   - `detectAutoBreaklines` — PURE. Reads the derived TIN (`getTopoSurface` — never a second
 *     `buildTin`) and returns proposals. Writes nothing.
 *   - `acceptAutoBreaklines` — the ONLY writer, and it takes the candidates the ENGINEER ticked.
 *     Neither Civil 3D nor CloudCompare writes feature lines on its own, and §9 (human-certifier)
 *     forbids it outright: the machine proposes, the engineer certifies.
 */

import type { TopoSurfaceId } from '../topo-types';
import type { AutoBreaklineCandidate, AutoBreaklineReport } from './auto-breakline-types';
import { getTopoBreaklines, addBreakline } from '../TopoPointStore';
import { getTopoSurface } from '../topo-surface';
import { findSteepUnconstrainedEdges } from './detect-feature-edges';
import { chainFeatureEdges } from './chain-feature-edges';
import { AUTO_BREAKLINE_CONFIG } from './auto-breakline-config';

export type { AutoBreaklineCandidate, AutoBreaklineReport } from './auto-breakline-types';

/**
 * Propose feature lines for a surface: steep unconstrained folds, chained into ordered
 * polylines and filtered for noise. Read-only over the stores' current snapshot.
 */
export function detectAutoBreaklines(surfaceId: TopoSurfaceId = 'existing'): AutoBreaklineReport {
  const surface = getTopoSurface(surfaceId);
  if (surface.triangles.length === 0) {
    return { surfaceId, candidates: [], droppedByCap: 0, notEnoughData: true };
  }

  const steepEdges = findSteepUnconstrainedEdges(
    surface,
    getTopoBreaklines(surfaceId),
    surface.origin,
    AUTO_BREAKLINE_CONFIG.MIN_FOLD_ANGLE_DEG,
  );
  const { candidates, droppedByCap } = chainFeatureEdges(surface, steepEdges);

  return { surfaceId, candidates, droppedByCap, notEnoughData: false };
}

/**
 * Commit the candidates the engineer approved — one `addBreakline` each (enterprise id minted
 * there, N.6). The surface rebuilds itself off the changed definition (`topo-surface` memo),
 * so the very next `detectAutoBreaklines` no longer proposes what was just accepted: the
 * accepted edges are now CONSTRAINED, and constrained edges are not candidates. Idempotent by
 * construction — re-running the pass cannot duplicate a breakline.
 *
 * Returns the ids actually created (a candidate with fewer than 2 vertices cannot exist, but
 * `addBreakline` is the authority on that, not this caller).
 */
export function acceptAutoBreaklines(
  candidates: readonly AutoBreaklineCandidate[],
  surfaceId: TopoSurfaceId = 'existing',
): string[] {
  const created: string[] = [];
  for (const candidate of candidates) {
    const id = addBreakline(candidate.vertices, candidate.closed, undefined, surfaceId);
    if (id !== null) created.push(id);
  }
  return created;
}
