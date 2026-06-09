/**
 * ADR-429 Slice 3B — Parallel supply/return pairing for the heating loop (pure, headless).
 *
 * Revit/MagiCAD/4M-FINE-grade two-pipe routing: the return trunk does NOT re-route
 * independently (which made it overlap the supply spine — in the integration test the
 * rad-supply / rad-return runs landed on the SAME geometry). Instead the return network
 * INHERITS the supply spine geometry and runs as a constant lateral **offset** of it, so the
 * two pipes are guaranteed parallel "twins". No 2nd A* / Manhattan pass is needed.
 *
 * FULL SSoT: the offset is `offsetPolyline` (ADR-358) and each terminal's return drop is a
 * re-tap via `getNearestPointOnLine` (ADR-065) — no bespoke geometry. The DN-aware offset
 * distance comes from `PAIRING_CLEARANCE_SCENE` (ADR-429 routing constants).
 *
 * Gated by the orchestrator to the no-detour (no walls) case; with wall obstacles the return
 * keeps its independent wall-aware route (a uniform offset + A* detour don't compose cleanly
 * in v1 — declared limitation in ADR-429 §5).
 *
 * Pure + deterministic.
 *
 * @see ./design-heating.ts (the gate + the supply network it pairs against)
 * @see ../../../rendering/entities/shared/geometry-offset-utils.ts (offsetPolyline)
 * @see ../../../rendering/entities/shared/geometry-utils.ts (getNearestPointOnLine)
 */

import type { Point2D, Point3D } from '../../../rendering/types/Types';
import { offsetPolyline } from '../../../rendering/entities/shared/geometry-offset-utils';
import { getNearestPointOnLine } from '../../../rendering/entities/shared/geometry-utils';
import { PAIRING_CLEARANCE_SCENE } from '../routing/routing-constants';
import type { HeatingDiscipline } from './heating-discipline';
import type { HeatingEndpoint } from './heating-source-resolve';
import {
  HEATING_ROLE_CLASSIFICATION,
  type ProposedHeatingNetwork,
  type ProposedHeatingSegment,
  type TerminalHeatDemand,
} from './heating-design-types';

const COINCIDENT_EPS = 1e-6;
const RETURN_CLASSIFICATION = HEATING_ROLE_CLASSIFICATION.return;

function near(a: Point2D, b: Point2D): boolean {
  return Math.abs(a.x - b.x) < COINCIDENT_EPS && Math.abs(a.y - b.y) < COINCIDENT_EPS;
}

/**
 * Chain the supply trunk segments head-to-tail from `sourcePoint` outward into ≤2 arms
 * (the Manhattan router splits at most into a left + right arm). Each arm is the ordered
 * list of its supply trunk segments — kept (not just the points) so the return can copy
 * each run's cumulative flow + DN verbatim.
 */
function reconstructArms(
  trunks: readonly ProposedHeatingSegment[],
  sourcePoint: Point2D,
): ProposedHeatingSegment[][] {
  const used = new Set<number>();
  const arms: ProposedHeatingSegment[][] = [];
  for (let i = 0; i < trunks.length; i++) {
    if (used.has(i) || !near(trunks[i].start, sourcePoint)) continue;
    const chain: ProposedHeatingSegment[] = [trunks[i]];
    used.add(i);
    let cur = trunks[i];
    for (let guard = 0; guard < trunks.length; guard++) {
      const nextIdx = trunks.findIndex((t, j) => !used.has(j) && near(t.start, cur.end));
      if (nextIdx < 0) break;
      used.add(nextIdx);
      cur = trunks[nextIdx];
      chain.push(cur);
    }
    arms.push(chain);
  }
  return arms;
}

const to3d = (p: Point2D): Point3D => ({ x: p.x, y: p.y, z: 0 });

/** A trunk run on the return side (a future hydronic-return `mep-segment`). */
function returnTrunk(
  start: Point2D,
  end: Point2D,
  cumulativeFlowLps: number,
  diameterMm: number,
): ProposedHeatingSegment {
  return { start, end, networkRole: 'return', classification: RETURN_CLASSIFICATION, diameterMm, cumulativeFlowLps, role: 'trunk' };
}

/**
 * Build one arm's return runs: the lateral-offset trunk (parallel to the supply arm, each run
 * copying its supply counterpart's flow + DN by vertex index) plus the root stub bridging the
 * boiler return inlet to the offset arm's start.
 */
function buildArmReturnTrunks(
  arm: readonly ProposedHeatingSegment[],
  offsetMm: number,
  returnRoot: Point2D,
): ProposedHeatingSegment[] {
  const supplyPts: Point2D[] = [arm[0].start, ...arm.map((s) => s.end)];
  // offsetPolyline returns Point3D (z preserved); drop z back to clean Point2D for the segments
  // (Slice 2 re-stamps z = sourceElevationMm at commit time — the loop is flat).
  const offsetPts: Point2D[] = offsetPolyline(supplyPts.map(to3d), offsetMm, { join: 'miter' }).map(
    (p) => ({ x: p.x, y: p.y }),
  );
  if (offsetPts.length < 2) return [];
  const out: ProposedHeatingSegment[] = [];
  // Stub: boiler return inlet → offset arm start (carries the arm total = first trunk's load).
  if (!near(returnRoot, offsetPts[0])) {
    out.push(returnTrunk(returnRoot, offsetPts[0], arm[0].cumulativeFlowLps, arm[0].diameterMm));
  }
  for (let i = 0; i < arm.length; i++) {
    out.push(returnTrunk(offsetPts[i], offsetPts[i + 1], arm[i].cumulativeFlowLps, arm[i].diameterMm));
  }
  return out;
}

/** Re-tap one terminal's return drop: nearest point on any return trunk → the return connector. */
function retapBranch(
  demand: TerminalHeatDemand,
  trunks: readonly ProposedHeatingSegment[],
  discipline: HeatingDiscipline,
): ProposedHeatingSegment | null {
  let best: { point: Point2D; dist: number } | null = null;
  for (const t of trunks) {
    const p = getNearestPointOnLine(demand.returnPoint, t.start, t.end, true);
    const dist = Math.hypot(p.x - demand.returnPoint.x, p.y - demand.returnPoint.y);
    if (!best || dist < best.dist) best = { point: p, dist };
  }
  if (!best || near(best.point, demand.returnPoint)) return null;
  return {
    start: best.point,
    end: demand.returnPoint,
    networkRole: 'return',
    classification: RETURN_CLASSIFICATION,
    diameterMm: discipline.sizingStandard.diameterForFlowLps(demand.flowLps),
    cumulativeFlowLps: demand.flowLps,
    role: 'branch',
  };
}

/**
 * Build the return network as a parallel lateral offset of the already-routed `supply` network
 * (Slice 3B). Caller guarantees `supply` has ≥1 trunk segment and the no-detour gate.
 */
export function buildPairedReturnNetwork(
  supply: ProposedHeatingNetwork,
  returnSink: HeatingEndpoint,
  demands: readonly TerminalHeatDemand[],
  discipline: HeatingDiscipline,
): ProposedHeatingNetwork {
  const trunks = supply.segments.filter((s) => s.role === 'trunk');
  const maxTrunkDN = Math.max(...trunks.map((s) => s.diameterMm));
  const offsetMm = maxTrunkDN + PAIRING_CLEARANCE_SCENE;
  const arms = reconstructArms(trunks, supply.sourcePoint);
  const returnTrunks = arms.flatMap((arm) =>
    buildArmReturnTrunks(arm, offsetMm, returnSink.point),
  );
  const branches = demands
    .map((d) => retapBranch(d, returnTrunks, discipline))
    .filter((b): b is ProposedHeatingSegment => b !== null);
  return {
    role: 'return',
    classification: RETURN_CLASSIFICATION,
    sourceEntityId: returnSink.entityId,
    sourceConnectorId: returnSink.connectorId,
    sourcePoint: returnSink.point,
    sourceElevationMm: returnSink.elevationMm,
    segments: [...returnTrunks, ...branches],
    servedTerminalIds: [...new Set(demands.map((d) => d.terminalId))],
    servedConnectors: demands.map((d) => ({ entityId: d.entityId, connectorId: d.returnConnectorId })),
    totalFlowLps: supply.totalFlowLps,
  };
}
