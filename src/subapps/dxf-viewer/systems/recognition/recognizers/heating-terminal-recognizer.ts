/**
 * ADR-428 — Stage 0 heating terminal recognizer (Tier 1).
 *
 * Recognizes the already-connectable hydronic terminals (ADR-408 Εύρος Β: panel radiators
 * + underfloor loops) as `RecognizedTerminal`s, reading their embedded pipe connectors for
 * the `hydronic-supply` / `hydronic-return` classifications. Tier 1 = our own BIM entities,
 * so confidence is 1 (certain). Mirrors `sanitary-terminal-recognizer.ts` 1:1; the heating
 * demand stage then reads each terminal's thermal output and routes the two-pipe loop.
 *
 * The radiator is a point host (`params.position`); the underfloor loop is an area host with
 * no position — its representative plan point is the footprint centroid (SSoT
 * `polygonCentroid`), used only for space-binding (routing uses the connector world points).
 *
 * @see ../../../types/entities.ts (isMepRadiatorEntity, isMepUnderfloorEntity)
 * @see ./sanitary-terminal-recognizer.ts (the sanitary counterpart)
 */

import type { Entity } from '../../../types/entities';
import { isMepRadiatorEntity, isMepUnderfloorEntity } from '../../../types/entities';
import type { MepRadiatorEntity } from '../../../bim/types/mep-radiator-types';
import type { MepUnderfloorEntity } from '../../../bim/types/mep-underfloor-types';
import type { Point2D } from '../../../rendering/types/Types';
import { getEntityConnectors } from '../../../bim/mep-systems/connector-access';
import { polygonCentroid } from '../../../bim/geometry/shared/polygon-utils';
import type { RecognitionContext, Recognizer } from '../recognition-types';
import type {
  RecognizedConnectorRef,
  RecognizedTerminal,
} from './mep-recognized-types';

/** A heating terminal entity (radiator or underfloor loop). */
type HeatingTerminalEntity = MepRadiatorEntity | MepUnderfloorEntity;

/** Narrow to a heating terminal (radiator / underfloor). */
function isHeatingTerminal(e: Entity): e is HeatingTerminalEntity {
  return isMepRadiatorEntity(e) || isMepUnderfloorEntity(e);
}

/** Representative plan point: radiator insertion point, or underfloor footprint centroid. */
function terminalPosition(entity: HeatingTerminalEntity): Point2D {
  if (isMepRadiatorEntity(entity)) {
    return { x: entity.params.position.x, y: entity.params.position.y };
  }
  return polygonCentroid(entity.params.footprint.vertices);
}

/** The pipe connectors of a terminal as `(entityId, connectorId, classification)` refs. */
function pipeConnectorRefs(entity: HeatingTerminalEntity): readonly RecognizedConnectorRef[] {
  const refs: RecognizedConnectorRef[] = [];
  for (const c of getEntityConnectors(entity)) {
    if (c.domain !== 'pipe' || !c.pipe) continue;
    refs.push({
      entityId: entity.id,
      connectorId: c.connectorId,
      systemClassification: c.pipe.systemClassification,
    });
  }
  return refs;
}

function buildHeatingTerminal(
  entity: HeatingTerminalEntity,
  storeyId: string,
): RecognizedTerminal {
  const connectorRefs = pipeConnectorRefs(entity);
  const services = [...new Set(connectorRefs.map((r) => r.systemClassification))];
  return {
    elementId: `term:${entity.id}`,
    category: 'mep-terminal',
    position: terminalPosition(entity),
    tier: 'bim-entity',
    confidence: 1,
    storeyId,
    terminalKind: entity.params.kind,
    serviceClassifications: services,
    connectorRefs,
  };
}

/** Tier-1 recognizer: scene radiators/underfloor loops → recognized terminals. */
export const heatingTerminalRecognizer: Recognizer<RecognizedTerminal> = {
  id: 'heating-bim',
  category: 'mep-terminal',
  tier: 'bim-entity',
  recognize(ctx: RecognitionContext): readonly RecognizedTerminal[] {
    const out: RecognizedTerminal[] = [];
    for (const e of ctx.entities) {
      if (isHeatingTerminal(e)) out.push(buildHeatingTerminal(e, ctx.storeyId));
    }
    return out;
  },
};
