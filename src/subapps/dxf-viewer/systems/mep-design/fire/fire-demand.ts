/**
 * ADR-433 — Stage 1 Demand: build the fire-sprinkler demand model from Stage 0.
 *
 * Each recognized sprinkler head exposes a pipe INLET connector (ADR-433) carrying the
 * `fire-sprinkler` classification. For each such connector we emit a `SprinklerDemand` =
 * its design discharge flow (from the pluggable `FireDemandStandard`) + the connector's
 * WORLD point (the routing target). The fire riser outlet (a pipe OUT connector) is not a
 * terminal and is never recognized here (the recognizer is flow-aware). Mirror of
 * `water-demand.ts` / `hvac-air-demand.ts`.
 *
 * @see ../../recognition/index.ts (RecognizedTerminal, isRecognizedTerminal)
 * @see ../water/water-demand.ts (the water analogue / template)
 */

import type { Entity } from '../../../types/entities';
import type { RecognitionModel } from '../../recognition/recognition-types';
import { isRecognizedTerminal } from '../../recognition/recognizers/mep-recognized-types';
import type { MepSystemClassification } from '../../../bim/types/mep-connector-types';
import {
  FIRE_SERVICE_CLASSIFICATION,
  type SprinklerDemand,
  type FireDemandModel,
  type FireService,
} from './fire-design-types';
import { type FireDemandStandard } from './fire-flow-standard';
import { resolveConnectorWorldPoint } from '../shared/connector-resolve';

/** Service for a classification, or `null` (non-fire pipe / duct — v1 sprinkler only). */
function serviceForClassification(c: MepSystemClassification): FireService | null {
  return c === FIRE_SERVICE_CLASSIFICATION.sprinkler ? 'sprinkler' : null;
}

/** Build the per-head sprinkler demand model from recognized terminals. */
export function buildFireDemandModel(
  model: RecognitionModel,
  entities: readonly Entity[],
  standard: FireDemandStandard,
): FireDemandModel {
  const entityById = new Map(entities.map((e) => [e.id, e]));
  const demands: SprinklerDemand[] = [];
  for (const el of model.elements) {
    if (!isRecognizedTerminal(el)) continue;
    for (const ref of el.connectorRefs) {
      const service = serviceForClassification(ref.systemClassification);
      if (!service) continue;
      const entity = entityById.get(ref.entityId);
      if (!entity) continue;
      const point = resolveConnectorWorldPoint(entity, ref.connectorId);
      if (!point) continue;
      demands.push({
        terminalId: el.elementId,
        entityId: ref.entityId,
        service,
        flowLpm: standard.flowForTerminal(el.terminalKind),
        connectorId: ref.connectorId,
        point,
      });
    }
  }
  return { demands };
}
