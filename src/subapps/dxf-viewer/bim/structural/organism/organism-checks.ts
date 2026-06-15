/**
 * Structural Organism — cross-entity diagnostics (ADR-459, Phase 1).
 *
 * Pure checks registry πάνω στον DERIVED `StructuralGraph`. Υλοποιεί τα Revit-grade
 * warnings που ζήτησε ο μηχανικός:
 *   · `columnMissingFooting` — «λείπει το πέδιλο» (κολόνα χωρίς έδραση από κάτω).
 *   · `beamUnsupportedEnd`   — δοκάρι χωρίς στήριξη σε άκρο (cantilever ⇒ θεμιτό 1 άκρο).
 *   · `memberIsolated`       — μεμονωμένο πέδιλο (χωρίς κολόνα από πάνω).
 *
 * Cross-entity → ΔΕΝ γράφεται στο `entity.validation` (αυτό ανήκει στους per-entity
 * validators)· τα ευρήματα είναι DERIVED, επιφανειακά μέσω store/panel. i18n keys
 * μόνο (N.11).
 *
 * @see structural-graph.ts — ο graph builder
 * @see structural-organism-types.ts
 */

import { isPointInPolygon } from '../../../utils/geometry/GeometryUtils';
import type {
  OrganismPoint,
  StructuralDiagnostic,
  StructuralGraph,
  StructuralNode,
} from './structural-organism-types';

/** i18n key prefix (ns `dxf-viewer-shell`). */
const MSG = 'structuralOrganism.diagnostics';

/** True αν ≥1 ακμή αγγίζει τον κόμβο (ως support ή ως supported). */
function hasAnyEdge(graph: StructuralGraph, nodeId: string): boolean {
  return graph.edges.some((e) => e.supportId === nodeId || e.supportedId === nodeId);
}

// ─── Check 1: κολόνα χωρίς πέδιλο ────────────────────────────────────────────

function checkColumnMissingFooting(graph: StructuralGraph): StructuralDiagnostic[] {
  const out: StructuralDiagnostic[] = [];
  for (const node of graph.nodes) {
    if (node.memberKind !== 'column') continue;
    const supported = graph.edges.some(
      (e) => e.kind === 'footing-bearing' && e.supportedId === node.id,
    );
    if (supported) continue;
    out.push({
      id: `columnMissingFooting:${node.id}`,
      code: 'columnMissingFooting',
      severity: 'error',
      messageKey: `${MSG}.columnMissingFooting`,
      primaryEntityId: node.id,
      entityIds: [node.id],
    });
  }
  return out;
}

// ─── Check 2: δοκάρι χωρίς στήριξη σε άκρο ────────────────────────────────────

/** Προβολή footprint στον άξονα (s, μοναδιαίο u) → [tmin, tmax]. */
function projectOntoAxis(
  poly: readonly OrganismPoint[],
  s: OrganismPoint,
  ux: number,
  uy: number,
): { tmin: number; tmax: number } {
  let tmin = Infinity;
  let tmax = -Infinity;
  for (const p of poly) {
    const t = (p.x - s.x) * ux + (p.y - s.y) * uy;
    if (t < tmin) tmin = t;
    if (t > tmax) tmax = t;
  }
  return { tmin, tmax };
}

/** Columns που στηρίζουν (framing) το δοκάρι, από τις column-bearing ακμές. */
function framingColumnsOf(graph: StructuralGraph, beamId: string): StructuralNode[] {
  const ids = new Set(
    graph.edges.filter((e) => e.kind === 'column-bearing' && e.supportedId === beamId).map((e) => e.supportId),
  );
  return graph.nodes.filter((n) => ids.has(n.id) && n.footprint);
}

/** True αν κάποια framing κολόνα «καλύπτει» την παράμετρο p (με slack tol) στον άξονα. */
function paramCovered(cols: StructuralNode[], s: OrganismPoint, ux: number, uy: number, p: number, tol: number): boolean {
  return cols.some((c) => {
    const { tmin, tmax } = projectOntoAxis(c.footprint!, s, ux, uy);
    return p >= tmin - tol && p <= tmax + tol;
  });
}

function checkBeamUnsupportedEnd(graph: StructuralGraph): StructuralDiagnostic[] {
  const out: StructuralDiagnostic[] = [];
  for (const node of graph.nodes) {
    if (node.memberKind !== 'beam' || !node.axis) continue;
    const { start: s, end: e, halfWidth } = node.axis;
    const len = Math.hypot(e.x - s.x, e.y - s.y);
    if (len < 1e-6) continue;
    const ux = (e.x - s.x) / len;
    const uy = (e.y - s.y) / len;
    const cols = framingColumnsOf(graph, node.id);
    const startOk = paramCovered(cols, s, ux, uy, 0, halfWidth);
    const endOk = paramCovered(cols, s, ux, uy, len, halfWidth);
    const cantilever = node.supportType === 'cantilever';
    const fails = cantilever ? !startOk && !endOk : !startOk || !endOk;
    if (!fails) continue;
    out.push({
      id: `beamUnsupportedEnd:${node.id}`,
      code: 'beamUnsupportedEnd',
      severity: 'warning',
      messageKey: `${MSG}.beamUnsupportedEnd`,
      primaryEntityId: node.id,
      entityIds: [node.id],
    });
  }
  return out;
}

// ─── Check 3: μεμονωμένο πέδιλο ───────────────────────────────────────────────

function checkIsolatedFooting(graph: StructuralGraph): StructuralDiagnostic[] {
  const out: StructuralDiagnostic[] = [];
  for (const node of graph.nodes) {
    if (node.memberKind !== 'footing') continue;
    if (hasAnyEdge(graph, node.id)) continue;
    out.push({
      id: `memberIsolated:${node.id}`,
      code: 'memberIsolated',
      severity: 'warning',
      messageKey: `${MSG}.memberIsolated`,
      primaryEntityId: node.id,
      entityIds: [node.id],
    });
  }
  return out;
}

// ─── Registry ─────────────────────────────────────────────────────────────────

const CHECKS: ReadonlyArray<(g: StructuralGraph) => StructuralDiagnostic[]> = [
  checkColumnMissingFooting,
  checkBeamUnsupportedEnd,
  checkIsolatedFooting,
];

/** Τρέξε όλους τους cross-entity ελέγχους πάνω στον οργανισμό. Pure. */
export function runOrganismChecks(graph: StructuralGraph): StructuralDiagnostic[] {
  return CHECKS.flatMap((check) => check(graph));
}

// Re-export ευκολίας: graph + checks σε ΕΝΑ pass (consumers: store/hook).
export { buildStructuralGraph } from './structural-graph';
