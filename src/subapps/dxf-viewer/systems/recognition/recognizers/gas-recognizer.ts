/**
 * ADR-434 — Stage 0 gas terminal recognizer (Tier 1).
 *
 * Recognizes the connectable gas appliances — the gas cooker / hob (`gas-cooker`, a
 * `mep-fixture`) AND the gas/oil boiler (a standalone `mep-boiler` entity) — as
 * `RecognizedTerminal`s, reading their embedded FUEL connectors for the service
 * classification. Tier 1 = our own BIM entities, so confidence is 1 (certain). The closest
 * analogue is `air-terminal-recognizer.ts` (ADR-432), but on the `'fuel'` domain and NOT
 * fixture-only: the gas boiler is a separate entity that is ALSO a gas terminal (via its
 * fuel inlet), so this recognizer narrows to BOTH hosts — exactly as the heating recognizer
 * narrows to radiator + underfloor.
 *
 * Flow-aware (the key distinction from the gas meter source, which is ALSO a fuel host): a
 * terminal RECEIVES gas (`flow: 'in'`), the meter source FEEDS gas (`flow: 'out'`). So this
 * recognizer reads fuel INLET connectors only — the meter's outlet is never mistaken for a
 * terminal. It stays classification-inclusive (gas OR oil inlet); the demand stage filters to
 * `fuel-gas` for the v1 gas network, so an oil boiler's `fuel-oil` inlet is recognized but not
 * fed by the gas engine.
 *
 * @see ../../../types/entities.ts (isMepFixtureEntity, isMepBoilerEntity)
 * @see ./air-terminal-recognizer.ts (the HVAC counterpart / template)
 * @see ./heating-terminal-recognizer.ts (the multi-entity-host pattern)
 */

import type { Entity } from '../../../types/entities';
import { isMepFixtureEntity, isMepBoilerEntity } from '../../../types/entities';
import type { MepFixtureEntity } from '../../../bim/types/mep-fixture-types';
import type { MepBoilerEntity } from '../../../bim/types/mep-boiler-types';
import type { Point2D } from '../../../rendering/types/Types';
import { getEntityConnectors } from '../../../bim/mep-systems/connector-access';
import type { RecognitionContext, Recognizer } from '../recognition-types';
import type {
  RecognizedConnectorRef,
  RecognizedTerminal,
} from './mep-recognized-types';

/** A gas terminal entity — a gas cooker fixture or a (gas/oil) boiler. */
type GasTerminalEntity = MepFixtureEntity | MepBoilerEntity;

/** The fuel INLET connectors of a host as `(entityId, connectorId, classification)` refs. */
function fuelInletConnectorRefs(entity: GasTerminalEntity): readonly RecognizedConnectorRef[] {
  const refs: RecognizedConnectorRef[] = [];
  for (const c of getEntityConnectors(entity)) {
    // INLET only: an appliance receives gas (flow 'in'); the meter source feeds it
    // (flow 'out') and must never be recognized here as a terminal.
    if (c.domain !== 'fuel' || c.flow !== 'in' || !c.fuel) continue;
    refs.push({
      entityId: entity.id,
      connectorId: c.connectorId,
      systemClassification: c.fuel.systemClassification,
    });
  }
  return refs;
}

/** Is this a connectable gas terminal (a cooker/boiler carrying ≥1 fuel inlet connector)? */
function isGasTerminal(e: Entity): e is GasTerminalEntity {
  return (
    (isMepFixtureEntity(e) || isMepBoilerEntity(e)) &&
    fuelInletConnectorRefs(e).length > 0
  );
}

function terminalPosition(entity: GasTerminalEntity): Point2D {
  return { x: entity.params.position.x, y: entity.params.position.y };
}

function buildGasTerminal(entity: GasTerminalEntity, storeyId: string): RecognizedTerminal {
  const connectorRefs = fuelInletConnectorRefs(entity);
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

/** Tier-1 recognizer: scene gas cookers + boilers (fuel inlets) → recognized gas terminals. */
export const gasRecognizer: Recognizer<RecognizedTerminal> = {
  id: 'gas-bim',
  category: 'mep-terminal',
  tier: 'bim-entity',
  recognize(ctx: RecognitionContext): readonly RecognizedTerminal[] {
    const out: RecognizedTerminal[] = [];
    for (const e of ctx.entities) {
      if (isGasTerminal(e)) out.push(buildGasTerminal(e, ctx.storeyId));
    }
    return out;
  },
};
