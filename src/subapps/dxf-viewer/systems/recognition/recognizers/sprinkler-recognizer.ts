/**
 * ADR-433 — Stage 0 fire-protection sprinkler recognizer (Tier 1).
 *
 * Recognizes the connectable fire-protection terminals — sprinkler heads (`sprinkler`,
 * classification `'fire-sprinkler'`) — as `RecognizedTerminal`s, reading their embedded
 * PIPE connectors for the service classification. Tier 1 = our own BIM entities, so
 * confidence is 1 (certain). Mirrors `air-terminal-recognizer.ts` 1:1 but on the `'pipe'`
 * domain; the fire demand stage then assigns a design flow per head and the engine routes
 * the wet-pipe network to it from the fire riser.
 *
 * Flow-aware (the key distinction from the fire riser, which is ALSO a fire-sprinkler pipe
 * fixture): a sprinkler RECEIVES fire water (`flow: 'in'`), the riser source FEEDS it
 * (`flow: 'out'`). So this recognizer reads pipe INLET connectors classified
 * `fire-sprinkler` only — the riser's outlet is never mistaken for a terminal. It stays
 * kind-agnostic (no `sprinkler` literal branch): any future fire terminal carrying a
 * fire-sprinkler pipe inlet joins automatically.
 *
 * @see ../../../types/entities.ts (isMepFixtureEntity)
 * @see ./air-terminal-recognizer.ts (the HVAC counterpart / template)
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

/** The fire-sprinkler pipe INLET connectors of a fixture as `(entityId, connectorId, classification)` refs. */
function sprinklerInletConnectorRefs(entity: MepFixtureEntity): readonly RecognizedConnectorRef[] {
  const refs: RecognizedConnectorRef[] = [];
  for (const c of getEntityConnectors(entity)) {
    // INLET only: a sprinkler head receives fire water (flow 'in'); the fire riser source
    // feeds it (flow 'out') and must never be recognized here as a terminal. The
    // classification guard keeps non-fire pipe inlets (cold/hot water) out of this set.
    if (c.domain !== 'pipe' || c.flow !== 'in' || c.pipe?.systemClassification !== 'fire-sprinkler') {
      continue;
    }
    refs.push({
      entityId: entity.id,
      connectorId: c.connectorId,
      systemClassification: c.pipe.systemClassification,
    });
  }
  return refs;
}

/** Is this a connectable fire terminal (a fixture carrying ≥1 fire-sprinkler pipe inlet)? */
function isSprinklerTerminal(e: Entity): e is MepFixtureEntity {
  return isMepFixtureEntity(e) && sprinklerInletConnectorRefs(e).length > 0;
}

function terminalPosition(entity: MepFixtureEntity): Point2D {
  return { x: entity.params.position.x, y: entity.params.position.y };
}

function buildSprinklerTerminal(entity: MepFixtureEntity, storeyId: string): RecognizedTerminal {
  const connectorRefs = sprinklerInletConnectorRefs(entity);
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

/** Tier-1 recognizer: scene sprinkler heads → recognized fire-protection terminals. */
export const sprinklerRecognizer: Recognizer<RecognizedTerminal> = {
  id: 'fire-sprinkler-bim',
  category: 'mep-terminal',
  tier: 'bim-entity',
  recognize(ctx: RecognitionContext): readonly RecognizedTerminal[] {
    const out: RecognizedTerminal[] = [];
    for (const e of ctx.entities) {
      if (isSprinklerTerminal(e)) out.push(buildSprinklerTerminal(e, ctx.storeyId));
    }
    return out;
  },
};
