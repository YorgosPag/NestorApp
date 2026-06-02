/**
 * ADR-408 Φ2 — entity-level connector accessor (SSoT).
 *
 * Resolves the embedded `MepConnector[]` from any scene entity without callers
 * switching on entity kind. Lives here (not in `mep-component-types.ts`) so it
 * can import the `Entity` union + type guards without creating an import cycle
 * through `types/entities.ts`.
 *
 * First slice: only the light fixture is a connector host. The electrical panel
 * (Φ3) is added to both functions when it lands.
 *
 * @see ../types/mep-connector-types.ts
 * @see ../types/mep-component-types.ts
 */

import type { Entity } from '../../types/entities';
import { isMepFixtureEntity, isElectricalPanelEntity } from '../../types/entities';
import type { MepConnector } from '../types/mep-connector-types';

/** The connectors embedded in an entity's params, or `[]` when it has none. */
export function getEntityConnectors(entity: Entity): readonly MepConnector[] {
  if (isMepFixtureEntity(entity)) return entity.params.connectors ?? [];
  if (isElectricalPanelEntity(entity)) return entity.params.connectors ?? [];
  return [];
}

/** True when an entity can carry MEP connectors (a connector host). */
export function isMepConnectorHost(entity: Entity): boolean {
  return isMepFixtureEntity(entity) || isElectricalPanelEntity(entity);
}
