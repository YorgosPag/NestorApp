/**
 * ADR-428 — Heating (Hydronic) Auto-Design orchestrator (Slice 1, headless).
 *
 * Composes the stages over the Stage 0 `RecognitionModel`:
 *   Demand (W → l/s) → Source/Sink resolve (boiler supply-out + return-in) →
 *   Routing ×2 (shared orthogonal trunk-branch) → Sizing (Σflow → DN, velocity)
 * and returns a `HeatingNetworkProposal` of TWO networks (supply + return), pure data — no
 * canvas, no commit. The closed loop needs no new engine: both networks are routed by the
 * SAME shared router water/drainage use (root-outward, cumulative loading) and sized by the
 * SAME velocity table; the only per-network difference is which boiler endpoint is the root
 * and which terminal connector is the target. NO slope (pressurised loop). A missing boiler
 * endpoint is a warning, not an error (honest pilot, mirroring water/drainage).
 *
 * @see ../../recognition/index.ts (RecognitionModel input)
 * @see ./heating-discipline.ts (parameters: standards)
 * @see ../water/design-water-supply.ts · ../drainage/design-drainage.ts (the two patterns)
 */

import type { Entity } from '../../../types/entities';
import type { RecognitionModel } from '../../recognition/recognition-types';
import {
  HEATING_ROLE_CLASSIFICATION,
  type TerminalHeatDemand,
  type HeatingNetworkRole,
  type ProposedHeatingNetwork,
  type ProposedHeatingSegment,
  type HeatingNetworkProposal,
} from './heating-design-types';
import { HEATING_DISCIPLINE, type HeatingDiscipline } from './heating-discipline';
import { buildHeatingDemandModel } from './heating-demand';
import {
  resolveHeatingSupplySource,
  resolveHeatingReturnSink,
  type HeatingEndpoint,
} from './heating-source-resolve';
import { buildPairedReturnNetwork } from './pair-supply-return';
import { type RouteTarget } from '../routing/orthogonal-router';
import { routeWallAware } from '../routing/route-wall-aware';
import { wallObstacles } from '../routing/wall-obstacles';
import type { Rect2D } from '../routing/routing-constants';

/** Pick the connector (id, point) a demand exposes to the network of `role`. */
function terminalEndpoint(
  demand: TerminalHeatDemand,
  role: HeatingNetworkRole,
): { connectorId: string; point: RouteTarget['point'] } {
  return role === 'supply'
    ? { connectorId: demand.supplyConnectorId, point: demand.supplyPoint }
    : { connectorId: demand.returnConnectorId, point: demand.returnPoint };
}

/** Build one role's proposed network (route + size) rooted at a boiler endpoint. */
function buildNetwork(
  root: HeatingEndpoint,
  demands: readonly TerminalHeatDemand[],
  discipline: HeatingDiscipline,
  obstacles: readonly Rect2D[],
): ProposedHeatingNetwork {
  const { role } = root;
  const classification = HEATING_ROLE_CLASSIFICATION[role];
  // Flow is the cumulative-sum driver (the router's `loadingUnits` is a flow proxy here).
  const targets: RouteTarget[] = demands.map((d) => ({
    point: terminalEndpoint(d, role).point,
    loadingUnits: d.flowLps,
  }));
  const segments: ProposedHeatingSegment[] = routeWallAware(root.point, targets, obstacles).map(
    (r) => ({
      start: r.start,
      end: r.end,
      networkRole: role,
      classification,
      diameterMm: discipline.sizingStandard.diameterForFlowLps(r.cumulativeLU),
      cumulativeFlowLps: r.cumulativeLU,
      role: r.role,
    }),
  );
  return {
    role,
    classification,
    sourceEntityId: root.entityId,
    sourceConnectorId: root.connectorId,
    sourcePoint: root.point,
    sourceElevationMm: root.elevationMm,
    segments,
    servedTerminalIds: [...new Set(demands.map((d) => d.terminalId))],
    // Each demand carries the host's supply/return connector — those tuples ARE this
    // network's terminal membership; Slice 2 commits them directly, no scene re-scan.
    servedConnectors: demands.map((d) => {
      const { connectorId } = terminalEndpoint(d, role);
      return { entityId: d.entityId, connectorId };
    }),
    totalFlowLps: demands.reduce((s, d) => s + d.flowLps, 0),
  };
}

/**
 * Design the supply + return heating networks for a recognized storey. Slice 1 is headless:
 * returns the proposal (no entities emitted, nothing persisted).
 */
export function designHeating(
  model: RecognitionModel,
  entities: readonly Entity[],
  discipline: HeatingDiscipline = HEATING_DISCIPLINE,
): HeatingNetworkProposal {
  const demandModel = buildHeatingDemandModel(model, entities, discipline.demandStandard);
  const demands = demandModel.demands.filter((d) => d.flowLps > 0);
  const warnings: string[] = [];
  if (demands.length === 0) {
    return { networks: [], warnings, storeyId: model.storeyId };
  }
  // ADR-429 — extract wall obstacles once; both supply + return networks detour around them
  // (no walls ⇒ identical to the prior Manhattan ×2 output).
  const obstacles = wallObstacles(entities);
  const networks: ProposedHeatingNetwork[] = [];
  const supplySource = resolveHeatingSupplySource(entities);
  let supply: ProposedHeatingNetwork | null = null;
  if (supplySource) {
    supply = buildNetwork(supplySource, demands, discipline, obstacles);
    networks.push(supply);
  } else {
    warnings.push(
      `no ${HEATING_ROLE_CLASSIFICATION.supply} source recognized — supply network skipped (${demands.length} terminals)`,
    );
  }
  const returnSink = resolveHeatingReturnSink(entities);
  if (returnSink) {
    // ADR-429 Slice 3B — pair the return as a parallel offset of the supply spine when there
    // are no walls to detour around; with obstacles, keep the independent wall-aware route.
    const canPair =
      supply != null && obstacles.length === 0 && supply.segments.some((s) => s.role === 'trunk');
    networks.push(
      canPair
        ? buildPairedReturnNetwork(supply!, returnSink, demands, discipline)
        : buildNetwork(returnSink, demands, discipline, obstacles),
    );
  } else {
    warnings.push(
      `no ${HEATING_ROLE_CLASSIFICATION.return} sink recognized — return network skipped (${demands.length} terminals)`,
    );
  }
  return { networks, warnings, storeyId: model.storeyId };
}
