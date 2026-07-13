/**
 * ADR-650 M5α — the QA pass orchestrator: the SSoT entry the UI calls.
 *
 * Reads the raw survey (TopoPointStore) + the derived surface (getTopoSurface — never a
 * second `buildTin`, ADR-650 invariant), runs the four deterministic checks, caps each kind
 * so a pathological surface cannot flood the report (dropped count surfaced, never silent),
 * and returns a severity-ordered {@link TopoQaReport}. Pure over the stores' current snapshot:
 * no side effects, no writes — the engine only reports (§9, human-certifier).
 */

import type { TopoSurfaceId } from '../topo-types';
import { getTopoDefinition, getTopoBoundary } from '../TopoPointStore';
import { getTopoSurface } from '../topo-surface';
import type { TopoQaFlag, TopoQaKind, TopoQaReport, TopoQaSeverity } from './topo-qa-types';
import { TOPO_QA_CONFIG } from './topo-qa-config';
import { checkElevationBusts } from './check-elevation-busts';
import { checkDuplicatePoints } from './check-duplicate-points';
import { checkBoundaryClosure } from './check-boundary-closure';
import { checkMissingBreaklines } from './check-missing-breaklines';

const SEVERITY_RANK: Readonly<Record<TopoQaSeverity, number>> = { high: 0, medium: 1, low: 2 };
const ALL_KINDS: readonly TopoQaKind[] = [
  'elevation-bust', 'duplicate-point', 'boundary-closure', 'self-intersection', 'missing-breakline',
];

/** Keep at most `MAX_FLAGS_PER_KIND` of each kind; return the survivors + how many were dropped. */
function applyCap(flags: readonly TopoQaFlag[]): { kept: TopoQaFlag[]; dropped: number } {
  const kept: TopoQaFlag[] = [];
  let dropped = 0;
  for (const kind of ALL_KINDS) {
    const ofKind = flags.filter((f) => f.kind === kind);
    kept.push(...ofKind.slice(0, TOPO_QA_CONFIG.MAX_FLAGS_PER_KIND));
    dropped += Math.max(0, ofKind.length - TOPO_QA_CONFIG.MAX_FLAGS_PER_KIND);
  }
  return { kept, dropped };
}

function countBySeverity(flags: readonly TopoQaFlag[]): Record<TopoQaSeverity, number> {
  const counts: Record<TopoQaSeverity, number> = { high: 0, medium: 0, low: 0 };
  for (const f of flags) counts[f.severity]++;
  return counts;
}

/** Run every QA check on a surface and assemble the report (defaults to the `existing` ground). */
export function runTopoQa(surfaceId: TopoSurfaceId = 'existing'): TopoQaReport {
  const definition = getTopoDefinition(surfaceId);
  const surface = getTopoSurface(surfaceId);
  const boundary = getTopoBoundary();

  const raw: TopoQaFlag[] = [
    ...checkElevationBusts(surface),
    ...checkDuplicatePoints(definition.points),
    ...checkBoundaryClosure(boundary, definition.breaklines),
    ...checkMissingBreaklines(surface, definition.breaklines, surface.origin),
  ];

  const { kept, dropped } = applyCap(raw);
  kept.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);

  return {
    surfaceId,
    flags: kept,
    counts: countBySeverity(kept),
    droppedByCap: dropped,
    notEnoughData: definition.points.length < 3,
  };
}
