/**
 * ADR-428 — Stage 1 Demand: build the heating demand model from the Stage 0 model.
 *
 * Each recognized heating terminal (radiator / underfloor loop, ADR-408 Εύρος Β) exposes a
 * hydronic-supply INLET and a hydronic-return OUTLET. For each terminal we read its thermal
 * output (`params.thermalOutputW`, made real by ADR-422 L2; a standard default when unset)
 * and convert it to a design mass-flow (l/s) via the pluggable demand standard. We emit a
 * single `TerminalHeatDemand` carrying that flow plus BOTH connector world points — the
 * supply network targets the inlet, the return network targets the outlet. A terminal
 * missing either hydronic connector is skipped (it cannot join a two-pipe loop).
 *
 * @see ../../recognition/recognizers/heating-terminal-recognizer.ts (RecognizedTerminal)
 * @see ../water/water-demand.ts (the supply counterpart)
 */

import type { Entity } from '../../../types/entities';
import { isMepRadiatorEntity, isMepUnderfloorEntity } from '../../../types/entities';
import type { RecognitionModel } from '../../recognition/recognition-types';
import { isRecognizedTerminal } from '../../recognition/recognizers/mep-recognized-types';
import { resolveConnectorWorldPoint } from '../shared/connector-resolve';
import { HEATING_ROLE_CLASSIFICATION, type TerminalHeatDemand, type HeatingDemandModel } from './heating-design-types';
import { flowLpsForTerminal, type HeatingDemandStandard } from './heating-flow';

/** Catalogue thermal output (W) of a heating terminal, or `undefined` when not yet set. */
function terminalThermalOutputW(entity: Entity): number | undefined {
  if (isMepRadiatorEntity(entity)) return entity.params.thermalOutputW;
  if (isMepUnderfloorEntity(entity)) return entity.params.thermalOutputW;
  return undefined;
}

/** Build the per-terminal heating demand model from recognized terminals. */
export function buildHeatingDemandModel(
  model: RecognitionModel,
  entities: readonly Entity[],
  standard: HeatingDemandStandard,
): HeatingDemandModel {
  const entityById = new Map(entities.map((e) => [e.id, e]));
  const demands: TerminalHeatDemand[] = [];
  for (const el of model.elements) {
    if (!isRecognizedTerminal(el)) continue;
    const supplyRef = el.connectorRefs.find(
      (r) => r.systemClassification === HEATING_ROLE_CLASSIFICATION.supply,
    );
    const returnRef = el.connectorRefs.find(
      (r) => r.systemClassification === HEATING_ROLE_CLASSIFICATION.return,
    );
    if (!supplyRef || !returnRef) continue;
    const supplyEntity = entityById.get(supplyRef.entityId);
    const returnEntity = entityById.get(returnRef.entityId);
    if (!supplyEntity || !returnEntity) continue;
    const supplyPoint = resolveConnectorWorldPoint(supplyEntity, supplyRef.connectorId);
    const returnPoint = resolveConnectorWorldPoint(returnEntity, returnRef.connectorId);
    if (!supplyPoint || !returnPoint) continue;
    const { thermalOutputW, flowLps } = flowLpsForTerminal(
      standard,
      terminalThermalOutputW(supplyEntity),
    );
    demands.push({
      terminalId: el.elementId,
      entityId: supplyRef.entityId,
      terminalKind: el.terminalKind,
      thermalOutputW,
      flowLps,
      supplyConnectorId: supplyRef.connectorId,
      supplyPoint,
      returnConnectorId: returnRef.connectorId,
      returnPoint,
    });
  }
  return { demands };
}
