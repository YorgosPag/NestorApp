/**
 * ADR-434 — Stage 1 Demand: build the gas demand model from Stage 0.
 *
 * Each recognized gas appliance exposes a fuel INLET connector (ADR-434) carrying the
 * `fuel-gas` classification. For each such connector we emit a `TerminalGasDemand` = its
 * design gas flow (from the pluggable `GasDemandStandard`) + the connector's WORLD point
 * (the routing target). The meter outlet (a fuel OUT connector) is not an appliance and is
 * never recognized here (the recognizer is flow-aware). Mirror of `hvac-air-demand.ts`.
 *
 * @see ../../recognition/index.ts (RecognizedTerminal, isRecognizedTerminal)
 * @see ../hvac/hvac-air-demand.ts (the air analogue / template)
 */

import type { Entity } from '../../../types/entities';
import type { RecognitionModel } from '../../recognition/recognition-types';
import { isRecognizedTerminal } from '../../recognition/recognizers/mep-recognized-types';
import type { MepSystemClassification } from '../../../bim/types/mep-connector-types';
import {
  GAS_SERVICE_CLASSIFICATION,
  type TerminalGasDemand,
  type GasDemandModel,
  type GasService,
} from './gas-design-types';
import { type GasDemandStandard } from './gas-flow-standard';
import { resolveConnectorWorldPoint } from '../shared/connector-resolve';

/** Service for a fuel classification, or `null` (fuel-oil / non-fuel — v1 gas only). */
function serviceForClassification(c: MepSystemClassification): GasService | null {
  return c === GAS_SERVICE_CLASSIFICATION.gas ? 'gas' : null;
}

/** Build the per-appliance gas demand model from recognized terminals. */
export function buildGasDemandModel(
  model: RecognitionModel,
  entities: readonly Entity[],
  standard: GasDemandStandard,
): GasDemandModel {
  const entityById = new Map(entities.map((e) => [e.id, e]));
  const demands: TerminalGasDemand[] = [];
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
        flowCmh: standard.gasFlowForTerminal(el.terminalKind),
        connectorId: ref.connectorId,
        point,
      });
    }
  }
  return { demands };
}
