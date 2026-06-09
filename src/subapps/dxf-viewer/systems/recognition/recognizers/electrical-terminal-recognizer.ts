/**
 * ADR-430 — Stage 0 electrical-strong terminal recognizer (Tier 1).
 *
 * Recognizes the connectable electrical loads — luminaires (`light-fixture`,
 * classification `'lighting'`) and sockets (`socket`, classification `'power'`,
 * ADR-430 Slice 0) — as `RecognizedTerminal`s, reading their embedded electrical
 * connectors for the service classification. Tier 1 = our own BIM entities, so
 * confidence is 1 (certain). Mirrors `heating-terminal-recognizer.ts` 1:1; the
 * electrical demand stage then assigns a VA load per terminal and the grouping stage
 * bins them into lighting (10A) vs socket (16A) circuits.
 *
 * The recognizer is service-agnostic: it does NOT branch on `light-fixture` vs
 * `socket`, it reads each fixture's electrical connector classification, so a future
 * electrical fixture kind joins automatically once it carries an electrical connector.
 *
 * @see ../../../types/entities.ts (isMepFixtureEntity)
 * @see ./heating-terminal-recognizer.ts (the hydronic counterpart / template)
 */

import type { Entity } from '../../../types/entities';
import { isMepFixtureEntity } from '../../../types/entities';
import type { MepFixtureEntity } from '../../../bim/types/mep-fixture-types';
import type { Point2D } from '../../../rendering/types/Types';
import { getEntityConnectors } from '../../../bim/mep-systems/connector-access';
import type { RecognitionContext, Recognizer } from '../recognition-types';
import type {
  RecognizedConnectorRef,
  RecognizedTerminal,
} from './mep-recognized-types';

/** The electrical connectors of a fixture as `(entityId, connectorId, classification)` refs. */
function electricalConnectorRefs(entity: MepFixtureEntity): readonly RecognizedConnectorRef[] {
  const refs: RecognizedConnectorRef[] = [];
  for (const c of getEntityConnectors(entity)) {
    if (c.domain !== 'electrical' || !c.electrical) continue;
    refs.push({
      entityId: entity.id,
      connectorId: c.connectorId,
      systemClassification: c.electrical.systemClassification,
    });
  }
  return refs;
}

/** Is this a connectable electrical load (a fixture carrying ≥1 electrical connector)? */
function isElectricalTerminal(e: Entity): e is MepFixtureEntity {
  return isMepFixtureEntity(e) && electricalConnectorRefs(e).length > 0;
}

function terminalPosition(entity: MepFixtureEntity): Point2D {
  return { x: entity.params.position.x, y: entity.params.position.y };
}

function buildElectricalTerminal(
  entity: MepFixtureEntity,
  storeyId: string,
): RecognizedTerminal {
  const connectorRefs = electricalConnectorRefs(entity);
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

/** Tier-1 recognizer: scene luminaires/sockets → recognized electrical terminals. */
export const electricalTerminalRecognizer: Recognizer<RecognizedTerminal> = {
  id: 'electrical-strong-bim',
  category: 'mep-terminal',
  tier: 'bim-entity',
  recognize(ctx: RecognitionContext): readonly RecognizedTerminal[] {
    const out: RecognizedTerminal[] = [];
    for (const e of ctx.entities) {
      if (isElectricalTerminal(e)) out.push(buildElectricalTerminal(e, ctx.storeyId));
    }
    return out;
  },
};
