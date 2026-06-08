/**
 * ADR-427 — Stage 1 Demand: build the drainage demand model from the Stage 0 model.
 *
 * Each recognized sanitary terminal exposes a sanitary-drainage outlet connector (ADR-408
 * Φ14). For each such connector we emit a `FixtureDischarge` = its Discharge Units +
 * minimum branch DN (from the pluggable `DischargeDemandStandard`) + the connector's WORLD
 * point (the routing target). Supply connectors (cold/hot) are ignored here — they are the
 * water discipline's demand.
 *
 * @see ../../recognition/index.ts (RecognizedTerminal, isRecognizedTerminal)
 * @see ../water/water-demand.ts (supply counterpart)
 */

import type { Entity } from '../../../types/entities';
import type { RecognitionModel } from '../../recognition/recognition-types';
import { isRecognizedTerminal } from '../../recognition/recognizers/mep-recognized-types';
import { resolveConnectorWorldPoint } from '../shared/connector-resolve';
import {
  DRAINAGE_CLASSIFICATION,
  type FixtureDischarge,
  type DrainageDemandModel,
} from './drainage-design-types';
import type { DischargeDemandStandard } from './discharge-units';

/** Build the per-fixture drainage demand model from recognized terminals. */
export function buildDrainageDemandModel(
  model: RecognitionModel,
  entities: readonly Entity[],
  standard: DischargeDemandStandard,
): DrainageDemandModel {
  const entityById = new Map(entities.map((e) => [e.id, e]));
  const discharges: FixtureDischarge[] = [];
  for (const el of model.elements) {
    if (!isRecognizedTerminal(el)) continue;
    const appliance = standard.discharge(el.terminalKind);
    if (!appliance) continue;
    for (const ref of el.connectorRefs) {
      if (ref.systemClassification !== DRAINAGE_CLASSIFICATION) continue;
      const entity = entityById.get(ref.entityId);
      if (!entity) continue;
      const point = resolveConnectorWorldPoint(entity, ref.connectorId);
      if (!point) continue;
      discharges.push({
        terminalId: el.elementId,
        entityId: ref.entityId,
        terminalKind: el.terminalKind,
        dischargeUnits: appliance.dischargeUnits,
        minBranchDiameterMm: appliance.minBranchDiameterMm,
        connectorId: ref.connectorId,
        point,
      });
    }
  }
  return { discharges };
}
