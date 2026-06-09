/**
 * ADR-426 — Water-Supply Auto-Design orchestrator (Slice 1, headless).
 *
 * Composes the four stages over the Stage 0 `RecognitionModel`:
 *   Demand (LU) → Source resolve → Routing (Manhattan trunk-branch) → Sizing (ΣLU→DN)
 * and returns a `WaterNetworkProposal` (pure data — no canvas, no commit). A service
 * with demand but no source is reported as a warning, not an error (honest pilot).
 *
 * @see ../../recognition/index.ts (RecognitionModel input)
 * @see ./water-supply-discipline.ts (parameters: standards + services)
 */

import type { Entity } from '../../../types/entities';
import type { RecognitionModel } from '../../recognition/recognition-types';
import {
  WATER_SERVICE_CLASSIFICATION,
  type FixtureDemand,
  type ProposedNetwork,
  type ProposedSegment,
  type WaterNetworkProposal,
  type WaterService,
} from './water-design-types';
import {
  WATER_SUPPLY_DISCIPLINE,
  type WaterSupplyDiscipline,
} from './water-supply-discipline';
import { buildWaterDemandModel } from './water-demand';
import { buildOffsetHotNetwork } from './pair-cold-hot';
import { resolveWaterSource, type WaterSource } from './water-source-resolve';
import { type RouteTarget } from '../routing/orthogonal-router';
import { routeWallAware } from '../routing/route-wall-aware';
import { wallObstacles } from '../routing/wall-obstacles';
import type { Rect2D } from '../routing/routing-constants';

/** Build one service's proposed network (route + size). */
function buildNetwork(
  service: WaterService,
  source: WaterSource,
  demands: readonly FixtureDemand[],
  discipline: WaterSupplyDiscipline,
  obstacles: readonly Rect2D[],
): ProposedNetwork {
  const classification = WATER_SERVICE_CLASSIFICATION[service];
  const targets: RouteTarget[] = demands.map((d) => ({
    point: d.point,
    loadingUnits: d.loadingUnits,
  }));
  const segments: ProposedSegment[] = routeWallAware(source.point, targets, obstacles).map(
    (r) => ({
      start: r.start,
      end: r.end,
      service,
      classification,
      diameterMm: discipline.sizingStandard.diameterForLU(r.cumulativeLU),
      cumulativeLU: r.cumulativeLU,
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
    // Each demand already carries the host fixture's supply connector (ADR-426
    // Stage 1). Those tuples ARE the fixture membership of this network — Slice 2
    // commits them directly, no scene re-scan.
    servedConnectors: demands.map((d) => ({ entityId: d.entityId, connectorId: d.connectorId })),
    totalLU: demands.reduce((s, d) => s + d.loadingUnits, 0),
  };
}

/**
 * Design the cold + hot water-supply networks for a recognized storey. Slice 1 is
 * headless: returns the proposal (no entities emitted, nothing persisted).
 */
export function designWaterSupply(
  model: RecognitionModel,
  entities: readonly Entity[],
  discipline: WaterSupplyDiscipline = WATER_SUPPLY_DISCIPLINE,
): WaterNetworkProposal {
  const demandModel = buildWaterDemandModel(model, entities, discipline.demandStandard);
  // ADR-429 — extract wall obstacles once; the router detours runs around them (no walls ⇒
  // identical to the prior Manhattan output).
  const obstacles = wallObstacles(entities);
  const networks: ProposedNetwork[] = [];
  const warnings: string[] = [];
  for (const service of discipline.services) {
    const classification = WATER_SERVICE_CLASSIFICATION[service];
    const demands = demandModel.demands.filter(
      (d) => d.service === service && d.loadingUnits > 0,
    );
    if (demands.length === 0) continue;
    const source = resolveWaterSource(entities, classification);
    if (!source) {
      warnings.push(
        `no ${classification} source recognized — ${service} network skipped (${demands.length} fixtures)`,
      );
      continue;
    }
    const net = buildNetwork(service, source, demands, discipline, obstacles);
    // ADR-426 cold/hot pairing: cold is the reference (stays); the hot spine runs as a constant
    // lateral offset so the two parallel pipes never overlap (Revit-grade). Wall-aware (Slice 3C):
    // the offset twin is locally A*-detoured by the core wherever it would land on a wall.
    const canPair = service === 'hot' && net.segments.some((s) => s.role === 'trunk');
    networks.push(canPair ? buildOffsetHotNetwork(net, demands, discipline, obstacles) : net);
  }
  return { networks, warnings, storeyId: model.storeyId };
}
