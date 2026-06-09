/**
 * ADR-432 — HVAC (ventilation) Auto-Design orchestrator (Slice 1, headless).
 *
 * Composes the four stages over the Stage 0 `RecognitionModel`:
 *   Demand (air-flow) → Source resolve (AHU outlet) → Routing (Manhattan trunk-branch +
 *   A* wall-aware) → Sizing (Σair-flow → round Ø, ASHRAE equal-friction)
 * and returns a `DuctNetworkProposal` (pure data — no canvas, no commit). The supply duct
 * network needs NO new engine: it is routed by the SAME shared router water/drainage/heating
 * use (root-outward, cumulative loading) and sized by the duct-sizing standard; the only
 * per-discipline pieces are the air-flow demand + duct sizing. A missing AHU source is a
 * warning, not an error (honest pilot, mirroring water/heating).
 *
 * @see ../../recognition/index.ts (RecognitionModel input)
 * @see ./hvac-discipline.ts (parameters: standards + services)
 * @see ../water/design-water-supply.ts (the pressurised-pipe analogue / template)
 */

import type { Entity } from '../../../types/entities';
import type { RecognitionModel } from '../../recognition/recognition-types';
import {
  AIR_SERVICE_CLASSIFICATION,
  type TerminalAirDemand,
  type ProposedDuctNetwork,
  type ProposedDuctSegment,
  type DuctNetworkProposal,
  type AirService,
} from './hvac-design-types';
import { HVAC_DISCIPLINE, type HvacDiscipline } from './hvac-discipline';
import { buildHvacDemandModel } from './hvac-air-demand';
import { resolveHvacSource, type HvacSource } from './hvac-source-resolve';
import { type RouteTarget } from '../routing/orthogonal-router';
import { routeWallAware } from '../routing/route-wall-aware';
import { wallObstacles } from '../routing/wall-obstacles';
import type { Rect2D } from '../routing/routing-constants';

/** Build one service's proposed duct network (route + size) rooted at the AHU outlet. */
function buildNetwork(
  service: AirService,
  source: HvacSource,
  demands: readonly TerminalAirDemand[],
  discipline: HvacDiscipline,
  obstacles: readonly Rect2D[],
): ProposedDuctNetwork {
  const classification = AIR_SERVICE_CLASSIFICATION[service];
  // Air-flow is the cumulative-sum driver (the router's `loadingUnits` is an air-flow proxy).
  const targets: RouteTarget[] = demands.map((d) => ({
    point: d.point,
    loadingUnits: d.airflowCmh,
  }));
  const segments: ProposedDuctSegment[] = routeWallAware(source.point, targets, obstacles).map(
    (r) => ({
      start: r.start,
      end: r.end,
      service,
      classification,
      diameterMm: discipline.sizingStandard.diameterForAirflow(r.cumulativeLU),
      cumulativeAirflowCmh: r.cumulativeLU,
      role: r.role,
    }),
  );
  return {
    service,
    classification,
    sourceEntityId: source.entityId,
    sourceConnectorId: source.connectorId,
    sourcePoint: source.point,
    sourceElevationMm: source.elevationMm,
    segments,
    servedTerminalIds: [...new Set(demands.map((d) => d.terminalId))],
    // Each demand carries the terminal's duct inlet — those tuples ARE this network's
    // terminal membership; Slice 2 commits them directly, no scene re-scan.
    servedConnectors: demands.map((d) => ({ entityId: d.entityId, connectorId: d.connectorId })),
    totalAirflowCmh: demands.reduce((s, d) => s + d.airflowCmh, 0),
  };
}

/**
 * Design the supply-air duct network for a recognized storey. Slice 1 is headless:
 * returns the proposal (no entities emitted, nothing persisted).
 */
export function designHvac(
  model: RecognitionModel,
  entities: readonly Entity[],
  discipline: HvacDiscipline = HVAC_DISCIPLINE,
): DuctNetworkProposal {
  const demandModel = buildHvacDemandModel(model, entities, discipline.demandStandard);
  // ADR-429 — extract wall obstacles once; the router detours runs around them (no walls
  // ⇒ identical to the prior Manhattan output).
  const obstacles = wallObstacles(entities);
  const networks: ProposedDuctNetwork[] = [];
  const warnings: string[] = [];
  for (const service of discipline.services) {
    const classification = AIR_SERVICE_CLASSIFICATION[service];
    const demands = demandModel.demands.filter(
      (d) => d.service === service && d.airflowCmh > 0,
    );
    if (demands.length === 0) continue;
    const source = resolveHvacSource(entities, classification);
    if (!source) {
      warnings.push(
        `no ${classification} source (AHU) recognized — ${service} network skipped (${demands.length} terminals)`,
      );
      continue;
    }
    networks.push(buildNetwork(service, source, demands, discipline, obstacles));
  }
  return { networks, warnings, storeyId: model.storeyId };
}
