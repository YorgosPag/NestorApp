/**
 * ADR-433 — Fire-protection (sprinkler) Auto-Design orchestrator (Slice 1, headless).
 *
 * Composes the four stages over the Stage 0 `RecognitionModel`:
 *   Demand (design flow) → Source resolve (riser outlet) → Routing (Manhattan trunk-branch +
 *   A* wall-aware) → Sizing (Σflow → DN, velocity-limited)
 * and returns a `FireNetworkProposal` (pure data — no canvas, no commit). The wet-pipe
 * network needs NO new engine: it is routed by the SAME shared router water/drainage/heating/
 * HVAC use (root-outward, cumulative loading) and sized by the fire-sizing standard; the only
 * per-discipline pieces are the design-flow demand + the velocity-limited sizing. A missing
 * riser source is a warning, not an error (honest pilot, mirroring water/HVAC).
 *
 * @see ../../recognition/index.ts (RecognitionModel input)
 * @see ./fire-protection-discipline.ts (parameters: standards + services)
 * @see ../water/design-water-supply.ts (the pressurised-pipe analogue / template)
 */

import type { Entity } from '../../../types/entities';
import type { RecognitionModel } from '../../recognition/recognition-types';
import {
  FIRE_SERVICE_CLASSIFICATION,
  type SprinklerDemand,
  type ProposedNetwork,
  type ProposedSegment,
  type FireNetworkProposal,
  type FireService,
} from './fire-design-types';
import {
  FIRE_PROTECTION_DISCIPLINE,
  type FireProtectionDiscipline,
} from './fire-protection-discipline';
import { buildFireDemandModel } from './fire-demand';
import { resolveFireSource, type FireSource } from './fire-source-resolve';
import { type RouteTarget } from '../routing/orthogonal-router';
import { routeWallAware } from '../routing/route-wall-aware';
import { wallObstacles } from '../routing/wall-obstacles';
import type { Rect2D } from '../routing/routing-constants';

/** Build one service's proposed wet-pipe network (route + size) rooted at the riser outlet. */
function buildNetwork(
  service: FireService,
  source: FireSource,
  demands: readonly SprinklerDemand[],
  discipline: FireProtectionDiscipline,
  obstacles: readonly Rect2D[],
): ProposedNetwork {
  const classification = FIRE_SERVICE_CLASSIFICATION[service];
  // Design flow is the cumulative-sum driver (the router's `loadingUnits` is a flow proxy).
  const targets: RouteTarget[] = demands.map((d) => ({
    point: d.point,
    loadingUnits: d.flowLpm,
  }));
  const segments: ProposedSegment[] = routeWallAware(source.point, targets, obstacles).map(
    (r) => ({
      start: r.start,
      end: r.end,
      service,
      classification,
      diameterMm: discipline.sizingStandard.diameterForFlow(r.cumulativeLU),
      cumulativeFlowLpm: r.cumulativeLU,
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
    // Each demand carries the head's pipe inlet — those tuples ARE this network's terminal
    // membership; Slice 2 commits them directly, no scene re-scan.
    servedConnectors: demands.map((d) => ({ entityId: d.entityId, connectorId: d.connectorId })),
    totalFlowLpm: demands.reduce((s, d) => s + d.flowLpm, 0),
  };
}

/**
 * Design the wet-pipe sprinkler network for a recognized storey. Slice 1 is headless:
 * returns the proposal (no entities emitted, nothing persisted).
 */
export function designFire(
  model: RecognitionModel,
  entities: readonly Entity[],
  discipline: FireProtectionDiscipline = FIRE_PROTECTION_DISCIPLINE,
): FireNetworkProposal {
  const demandModel = buildFireDemandModel(model, entities, discipline.demandStandard);
  // ADR-429 — extract wall obstacles once; the router detours runs around them (no walls
  // ⇒ identical to the prior Manhattan output).
  const obstacles = wallObstacles(entities);
  const networks: ProposedNetwork[] = [];
  const warnings: string[] = [];
  for (const service of discipline.services) {
    const classification = FIRE_SERVICE_CLASSIFICATION[service];
    const demands = demandModel.demands.filter(
      (d) => d.service === service && d.flowLpm > 0,
    );
    if (demands.length === 0) continue;
    const source = resolveFireSource(entities, classification);
    if (!source) {
      warnings.push(
        `no ${classification} source (riser) recognized — ${service} network skipped (${demands.length} heads)`,
      );
      continue;
    }
    networks.push(buildNetwork(service, source, demands, discipline, obstacles));
  }
  return { networks, warnings, storeyId: model.storeyId };
}
