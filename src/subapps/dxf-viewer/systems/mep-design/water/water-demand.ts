/**
 * ADR-426 — Stage 1 Demand: build the water demand model from the Stage 0 model.
 *
 * Each recognized sanitary terminal exposes supply connectors (ADR-408 Φ14) carrying
 * a classification (`domestic-cold-water` / `-hot-water`). For each such connector we
 * emit a `FixtureDemand` = its Loading Units (from the pluggable `DemandStandard`) +
 * the connector's WORLD point (the routing target). Drainage connectors are ignored.
 *
 * @see ../../recognition/index.ts (RecognizedTerminal, isRecognizedTerminal)
 */

import type { Entity } from '../../../types/entities';
import type { RecognitionModel } from '../../recognition/recognition-types';
import { isRecognizedTerminal } from '../../recognition/recognizers/mep-recognized-types';
import type { PlumbingSystemClassification } from '../../../bim/types/mep-connector-types';
import {
  WATER_SERVICE_CLASSIFICATION,
  type FixtureDemand,
  type WaterDemandModel,
  type WaterService,
} from './water-design-types';
import { loadingUnitsFor, type DemandStandard } from './water-loading-units';
import { resolveConnectorWorldPoint } from './connector-resolve';

/** Service for a supply classification, or `null` (e.g. drainage). */
function serviceForClassification(c: PlumbingSystemClassification): WaterService | null {
  if (c === WATER_SERVICE_CLASSIFICATION.cold) return 'cold';
  if (c === WATER_SERVICE_CLASSIFICATION.hot) return 'hot';
  return null;
}

/** Build the per-(fixture, service) demand model from recognized terminals. */
export function buildWaterDemandModel(
  model: RecognitionModel,
  entities: readonly Entity[],
  standard: DemandStandard,
): WaterDemandModel {
  const entityById = new Map(entities.map((e) => [e.id, e]));
  const demands: FixtureDemand[] = [];
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
        loadingUnits: loadingUnitsFor(standard, el.terminalKind, service),
        connectorId: ref.connectorId,
        point,
      });
    }
  }
  return { demands };
}
