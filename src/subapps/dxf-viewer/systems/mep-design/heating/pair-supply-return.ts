/**
 * ADR-429 Slice 3B — Parallel supply/return pairing for the heating loop (pure, headless).
 *
 * Revit/MagiCAD/4M-FINE-grade two-pipe routing: the return trunk does NOT re-route
 * independently (which made it overlap the supply spine). Instead the return network INHERITS
 * the supply spine geometry and runs as a constant lateral **offset** of it, so the two pipes
 * are guaranteed parallel "twins". No 2nd A* / Manhattan pass is needed.
 *
 * FULL SSoT: this is now a THIN wrapper over the discipline-agnostic geometric core
 * `../routing/offset-pairing.ts` (Boy-Scout N.0.2 — the same core powers the water cold/hot
 * pairing). This module only supplies heating types + the DN-aware offset distance, and maps the
 * core's index-tagged runs back to `ProposedHeatingSegment`s, copying each run's flow + DN from
 * its supply counterpart by index. The DN-aware offset comes from `PAIRING_CLEARANCE_SCENE`.
 *
 * Gated by the orchestrator to the no-detour (no walls) case; with wall obstacles the return
 * keeps its independent wall-aware route (declared limitation in ADR-429 §5).
 *
 * Pure + deterministic.
 *
 * @see ../routing/offset-pairing.ts (the shared geometric core)
 * @see ./design-heating.ts (the gate + the supply network it pairs against)
 */

import type { Point2D } from '../../../rendering/types/Types';
import { buildOffsetPairing } from '../routing/offset-pairing';
import { PAIRING_CLEARANCE_SCENE, type Rect2D } from '../routing/routing-constants';
import type { HeatingDiscipline } from './heating-discipline';
import type { HeatingEndpoint } from './heating-source-resolve';
import {
  HEATING_ROLE_CLASSIFICATION,
  type ProposedHeatingNetwork,
  type ProposedHeatingSegment,
  type TerminalHeatDemand,
} from './heating-design-types';

const RETURN_CLASSIFICATION = HEATING_ROLE_CLASSIFICATION.return;

/** A return trunk/stub run carrying a copied flow + DN from its supply counterpart. */
function returnTrunk(
  start: Point2D,
  end: Point2D,
  cumulativeFlowLps: number,
  diameterMm: number,
): ProposedHeatingSegment {
  return {
    start,
    end,
    networkRole: 'return',
    classification: RETURN_CLASSIFICATION,
    diameterMm,
    cumulativeFlowLps,
    role: 'trunk',
  };
}

/**
 * Build the return network as a parallel lateral offset of the already-routed `supply` network
 * (Slice 3B). Caller guarantees `supply` has ≥1 trunk segment. With `obstacles` (Slice 3C) the
 * offset is wall-aware: any offset run that lands on a wall is locally A\*-detoured by the core.
 */
export function buildPairedReturnNetwork(
  supply: ProposedHeatingNetwork,
  returnSink: HeatingEndpoint,
  demands: readonly TerminalHeatDemand[],
  discipline: HeatingDiscipline,
  obstacles: readonly Rect2D[] = [],
): ProposedHeatingNetwork {
  const trunks = supply.segments.filter((s) => s.role === 'trunk');
  const maxTrunkDN = Math.max(...trunks.map((s) => s.diameterMm));
  const offsetMm = maxTrunkDN + PAIRING_CLEARANCE_SCENE;
  const pairing = buildOffsetPairing(
    trunks,
    supply.sourcePoint,
    returnSink.point,
    demands.map((d) => d.returnPoint),
    offsetMm,
    { obstacles },
  );
  // Stub carries its arm's total (first trunk's load); each offset trunk copies its counterpart.
  const trunkSegs: ProposedHeatingSegment[] = [
    ...pairing.stubs.map((s) =>
      returnTrunk(s.start, s.end, trunks[s.armFirstTrunkIndex].cumulativeFlowLps, trunks[s.armFirstTrunkIndex].diameterMm),
    ),
    ...pairing.trunks.map((t) =>
      returnTrunk(t.start, t.end, trunks[t.sourceTrunkIndex].cumulativeFlowLps, trunks[t.sourceTrunkIndex].diameterMm),
    ),
  ];
  const branches: ProposedHeatingSegment[] = pairing.branches.map((b) => {
    const d = demands[b.targetIndex];
    return {
      start: b.start,
      end: b.end,
      networkRole: 'return',
      classification: RETURN_CLASSIFICATION,
      diameterMm: discipline.sizingStandard.diameterForFlowLps(d.flowLps),
      cumulativeFlowLps: d.flowLps,
      role: 'branch',
    };
  });
  return {
    role: 'return',
    classification: RETURN_CLASSIFICATION,
    sourceEntityId: returnSink.entityId,
    sourceConnectorId: returnSink.connectorId,
    sourcePoint: returnSink.point,
    sourceElevationMm: returnSink.elevationMm,
    segments: [...trunkSegs, ...branches],
    servedTerminalIds: [...new Set(demands.map((d) => d.terminalId))],
    servedConnectors: demands.map((d) => ({ entityId: d.entityId, connectorId: d.returnConnectorId })),
    totalFlowLps: supply.totalFlowLps,
  };
}
