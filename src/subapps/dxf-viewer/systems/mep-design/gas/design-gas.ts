/**
 * ADR-434 — Gas (φυσικό αέριο) Auto-Design orchestrator (Slice 1, headless).
 *
 * Composes the four stages over the Stage 0 `RecognitionModel`:
 *   Demand (gas flow) → Source resolve (meter outlet) → Routing (Manhattan trunk-branch +
 *   A* wall-aware) → Sizing (Σflow → round Ø, low-pressure velocity-limited)
 * and returns a `GasNetworkProposal` (pure data — no canvas, no commit). The fuel network
 * needs NO new engine: it is routed by the SAME shared router water/drainage/heating/HVAC/fire
 * use (root-outward, cumulative loading) and sized by the gas-sizing standard; the only
 * per-discipline pieces are the gas-flow demand + gas sizing. A missing meter source is a
 * warning, not an error (honest pilot, mirroring HVAC).
 *
 * @see ../../recognition/index.ts (RecognitionModel input)
 * @see ./gas-discipline.ts (parameters: standards + services)
 * @see ../hvac/design-hvac.ts (the new-system-family analogue / template)
 */

import type { Entity } from '../../../types/entities';
import type { RecognitionModel } from '../../recognition/recognition-types';
import {
  GAS_SERVICE_CLASSIFICATION,
  type TerminalGasDemand,
  type ProposedFuelNetwork,
  type ProposedFuelSegment,
  type GasNetworkProposal,
  type GasService,
} from './gas-design-types';
import { GAS_DISCIPLINE, type GasDiscipline } from './gas-discipline';
import { buildGasDemandModel } from './gas-demand';
import { resolveGasSource, type GasSource } from './gas-source-resolve';
import { type RouteTarget } from '../routing/orthogonal-router';
import { routeWallAware } from '../routing/route-wall-aware';
import { wallObstacles } from '../routing/wall-obstacles';
import type { Rect2D } from '../routing/routing-constants';

/** Build one service's proposed fuel network (route + size) rooted at the meter outlet. */
function buildNetwork(
  service: GasService,
  source: GasSource,
  demands: readonly TerminalGasDemand[],
  discipline: GasDiscipline,
  obstacles: readonly Rect2D[],
): ProposedFuelNetwork {
  const classification = GAS_SERVICE_CLASSIFICATION[service];
  // Gas flow is the cumulative-sum driver (the router's `loadingUnits` is a flow proxy).
  const targets: RouteTarget[] = demands.map((d) => ({
    point: d.point,
    loadingUnits: d.flowCmh,
  }));
  const segments: ProposedFuelSegment[] = routeWallAware(source.point, targets, obstacles).map(
    (r) => ({
      start: r.start,
      end: r.end,
      service,
      classification,
      diameterMm: discipline.sizingStandard.diameterForFlow(r.cumulativeLU),
      cumulativeFlowCmh: r.cumulativeLU,
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
    // Each demand carries the appliance's fuel inlet — those tuples ARE this network's
    // terminal membership; Slice 2 commits them directly, no scene re-scan.
    servedConnectors: demands.map((d) => ({ entityId: d.entityId, connectorId: d.connectorId })),
    totalFlowCmh: demands.reduce((s, d) => s + d.flowCmh, 0),
  };
}

/**
 * Design the fuel-gas supply network for a recognized storey. Slice 1 is headless:
 * returns the proposal (no entities emitted, nothing persisted).
 */
export function designGas(
  model: RecognitionModel,
  entities: readonly Entity[],
  discipline: GasDiscipline = GAS_DISCIPLINE,
): GasNetworkProposal {
  const demandModel = buildGasDemandModel(model, entities, discipline.demandStandard);
  // ADR-429 — extract wall obstacles once; the router detours runs around them (no walls
  // ⇒ identical to the prior Manhattan output).
  const obstacles = wallObstacles(entities);
  const networks: ProposedFuelNetwork[] = [];
  const warnings: string[] = [];
  for (const service of discipline.services) {
    const classification = GAS_SERVICE_CLASSIFICATION[service];
    const demands = demandModel.demands.filter(
      (d) => d.service === service && d.flowCmh > 0,
    );
    if (demands.length === 0) continue;
    const source = resolveGasSource(entities, classification);
    if (!source) {
      warnings.push(
        `no ${classification} source (gas meter) recognized — ${service} network skipped (${demands.length} appliances)`,
      );
      continue;
    }
    networks.push(buildNetwork(service, source, demands, discipline, obstacles));
  }
  return { networks, warnings, storeyId: model.storeyId };
}
