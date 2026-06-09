/**
 * ADR-432 — Stage 1 Demand: build the HVAC supply-air demand model from Stage 0.
 *
 * Each recognized air terminal exposes a duct INLET connector (ADR-432) carrying the
 * `supply-air` classification. For each such connector we emit a `TerminalAirDemand` =
 * its design air-flow (from the pluggable `AirDemandStandard`) + the connector's WORLD
 * point (the routing target). The AHU outlet (a duct OUT connector) is not a terminal and
 * is never recognized here (the recognizer is flow-aware). Mirror of `water-demand.ts`.
 *
 * @see ../../recognition/index.ts (RecognizedTerminal, isRecognizedTerminal)
 * @see ../water/water-demand.ts (the water analogue / template)
 */

import type { Entity } from '../../../types/entities';
import type { RecognitionModel } from '../../recognition/recognition-types';
import { isRecognizedTerminal } from '../../recognition/recognizers/mep-recognized-types';
import type { MepSystemClassification } from '../../../bim/types/mep-connector-types';
import {
  AIR_SERVICE_CLASSIFICATION,
  type TerminalAirDemand,
  type HvacDemandModel,
  type AirService,
} from './hvac-design-types';
import { type AirDemandStandard } from './air-flow-standard';
import { resolveConnectorWorldPoint } from '../shared/connector-resolve';

/** Service for a duct classification, or `null` (exhaust / non-air / return — v1 supply only). */
function serviceForClassification(c: MepSystemClassification): AirService | null {
  return c === AIR_SERVICE_CLASSIFICATION.supply ? 'supply' : null;
}

/** Build the per-terminal supply-air demand model from recognized terminals. */
export function buildHvacDemandModel(
  model: RecognitionModel,
  entities: readonly Entity[],
  standard: AirDemandStandard,
): HvacDemandModel {
  const entityById = new Map(entities.map((e) => [e.id, e]));
  const demands: TerminalAirDemand[] = [];
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
        airflowCmh: standard.airflowForTerminal(el.terminalKind),
        connectorId: ref.connectorId,
        point,
      });
    }
  }
  return { demands };
}
