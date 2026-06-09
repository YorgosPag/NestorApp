/**
 * ADR-432 — Stage 0 HVAC air-terminal recognizer (Tier 1).
 *
 * Recognizes the connectable HVAC supply terminals — air terminals / supply diffusers
 * (`air-terminal`, classification `'supply-air'`) — as `RecognizedTerminal`s, reading
 * their embedded DUCT connectors for the service classification. Tier 1 = our own BIM
 * entities, so confidence is 1 (certain). Mirrors `electrical-terminal-recognizer.ts`
 * 1:1 but on the `'duct'` domain; the HVAC demand stage then assigns an air-flow per
 * terminal and the engine routes the supply-air duct network to it from the AHU.
 *
 * Flow-aware (the key distinction from the AHU, which is ALSO a duct fixture): a
 * terminal RECEIVES air (`flow: 'in'`), the AHU source FEEDS air (`flow: 'out'`). So
 * this recognizer reads duct INLET connectors only — the AHU's outlet is never mistaken
 * for a terminal. It stays kind-agnostic (no `air-terminal` literal branch): any future
 * supply fixture carrying a duct inlet joins automatically.
 *
 * @see ../../../types/entities.ts (isMepFixtureEntity)
 * @see ./electrical-terminal-recognizer.ts (the electrical counterpart / template)
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

/** The duct INLET connectors of a fixture as `(entityId, connectorId, classification)` refs. */
function ductInletConnectorRefs(entity: MepFixtureEntity): readonly RecognizedConnectorRef[] {
  const refs: RecognizedConnectorRef[] = [];
  for (const c of getEntityConnectors(entity)) {
    // INLET only: a supply diffuser receives air (flow 'in'); the AHU source feeds it
    // (flow 'out') and must never be recognized here as a terminal.
    if (c.domain !== 'duct' || c.flow !== 'in' || !c.duct) continue;
    refs.push({
      entityId: entity.id,
      connectorId: c.connectorId,
      systemClassification: c.duct.systemClassification,
    });
  }
  return refs;
}

/** Is this a connectable HVAC terminal (a fixture carrying ≥1 duct inlet connector)? */
function isAirTerminal(e: Entity): e is MepFixtureEntity {
  return isMepFixtureEntity(e) && ductInletConnectorRefs(e).length > 0;
}

function terminalPosition(entity: MepFixtureEntity): Point2D {
  return { x: entity.params.position.x, y: entity.params.position.y };
}

function buildAirTerminal(entity: MepFixtureEntity, storeyId: string): RecognizedTerminal {
  const connectorRefs = ductInletConnectorRefs(entity);
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

/** Tier-1 recognizer: scene air terminals (supply diffusers) → recognized HVAC terminals. */
export const airTerminalRecognizer: Recognizer<RecognizedTerminal> = {
  id: 'hvac-air-terminal-bim',
  category: 'mep-terminal',
  tier: 'bim-entity',
  recognize(ctx: RecognitionContext): readonly RecognizedTerminal[] {
    const out: RecognizedTerminal[] = [];
    for (const e of ctx.entities) {
      if (isAirTerminal(e)) out.push(buildAirTerminal(e, ctx.storeyId));
    }
    return out;
  },
};
