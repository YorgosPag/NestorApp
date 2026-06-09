/**
 * ADR-427 — Sanitary Drainage Auto-Design orchestrator (Slice 1, headless).
 *
 * Composes the stages over the Stage 0 `RecognitionModel`:
 *   Demand (DU) → Outfall resolve (collector) → Routing (gravity trunk-branch) →
 *   Sizing (ΣDU→DN, growing) → Slope (descending elevations)
 * and returns a `DrainageNetworkProposal` (pure data — no canvas, no commit). Fixtures with
 * demand but no collector are reported as a warning, not an error (honest pilot, mirroring
 * `designWaterSupply`).
 *
 * @see ../../recognition/index.ts (RecognitionModel input)
 * @see ./drainage-discipline.ts (parameters: standards)
 * @see ../water/design-water-supply.ts (pressurised counterpart)
 */

import type { Entity } from '../../../types/entities';
import type { SceneUnits } from '../../../utils/scene-units';
import type { RecognitionModel } from '../../recognition/recognition-types';
import {
  DRAINAGE_CLASSIFICATION,
  type FixtureDischarge,
  type ProposedDrainageNetwork,
  type DrainageNetworkProposal,
} from './drainage-design-types';
import {
  SANITARY_DRAINAGE_DISCIPLINE,
  type SanitaryDrainageDiscipline,
} from './drainage-discipline';
import { buildDrainageDemandModel } from './drainage-demand';
import { resolveDrainageOutfall, type DrainageOutfall } from './outfall-resolve';
import { routeGravityNetwork } from './gravity-router';
import type { RouteTarget } from '../routing/orthogonal-router';
import { wallObstacles } from '../routing/wall-obstacles';
import type { Rect2D } from '../routing/routing-constants';

/** Build the proposed gravity network for one collector (route + size + slope). */
function buildNetwork(
  outfall: DrainageOutfall,
  discharges: readonly FixtureDischarge[],
  discipline: SanitaryDrainageDiscipline,
  sceneUnits: SceneUnits,
  obstacles: readonly Rect2D[],
): ProposedDrainageNetwork {
  const targets: RouteTarget[] = discharges.map((d) => ({
    point: d.point,
    loadingUnits: d.dischargeUnits,
    minBranchDiameterMm: d.minBranchDiameterMm,
  }));
  const segments = routeGravityNetwork(
    outfall.point,
    outfall.invertElevationMm,
    targets,
    discipline.sizingStandard,
    sceneUnits,
    obstacles,
  );
  return {
    classification: DRAINAGE_CLASSIFICATION,
    outfallEntityId: outfall.entityId,
    outfallConnectorId: outfall.connectorId,
    outfallPoint: outfall.point,
    outfallInvertElevationMm: outfall.invertElevationMm,
    segments,
    servedTerminalIds: [...new Set(discharges.map((d) => d.terminalId))],
    // Each discharge already carries the host fixture's drain connector (Stage 1). Those
    // tuples ARE the fixture membership of this network — Slice 2 commits them directly.
    servedConnectors: discharges.map((d) => ({ entityId: d.entityId, connectorId: d.connectorId })),
    totalDU: discharges.reduce((s, d) => s + d.dischargeUnits, 0),
  };
}

/**
 * Design the sanitary drainage network for a recognized storey. Slice 1 is headless:
 * returns the proposal (no entities emitted, nothing persisted). `sceneUnits` is needed
 * to convert plan lengths to mm for the gravity slope rise.
 */
export function designDrainage(
  model: RecognitionModel,
  entities: readonly Entity[],
  sceneUnits: SceneUnits,
  discipline: SanitaryDrainageDiscipline = SANITARY_DRAINAGE_DISCIPLINE,
): DrainageNetworkProposal {
  const demandModel = buildDrainageDemandModel(model, entities, discipline.demandStandard);
  const discharges = demandModel.discharges.filter((d) => d.dischargeUnits > 0);
  const warnings: string[] = [];
  if (discharges.length === 0) {
    return { networks: [], warnings, storeyId: model.storeyId };
  }
  const outfall = resolveDrainageOutfall(entities);
  if (!outfall) {
    warnings.push(
      `no drainage-collector recognized — drainage network skipped (${discharges.length} fixtures)`,
    );
    return { networks: [], warnings, storeyId: model.storeyId };
  }
  // ADR-429 — wall obstacles for the wall-aware router (no walls ⇒ Manhattan-identical).
  const obstacles = wallObstacles(entities);
  const network = buildNetwork(outfall, discharges, discipline, sceneUnits, obstacles);
  return { networks: [network], warnings, storeyId: model.storeyId };
}
