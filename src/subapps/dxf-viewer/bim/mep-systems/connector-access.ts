/**
 * ADR-408 Φ2 — entity-level connector accessor (SSoT).
 *
 * Resolves the embedded `MepConnector[]` from any scene entity without callers
 * switching on entity kind. Lives here (not in `mep-component-types.ts`) so it
 * can import the `Entity` union + type guards without creating an import cycle
 * through `types/entities.ts`.
 *
 * Connector hosts: the light fixture, the electrical panel (Φ3), and the linear
 * duct/pipe `mep-segment` (Φ9 — its two endpoint connectors join a pipe network).
 *
 * @see ../types/mep-connector-types.ts
 * @see ../types/mep-component-types.ts
 */

import type { Entity } from '../../types/entities';
import {
  isMepFixtureEntity,
  isElectricalPanelEntity,
  isMepSegmentEntity,
} from '../../types/entities';
import type { MepConnector } from '../types/mep-connector-types';

/** The connectors embedded in an entity's params, or `[]` when it has none. */
export function getEntityConnectors(entity: Entity): readonly MepConnector[] {
  if (isMepFixtureEntity(entity)) return entity.params.connectors ?? [];
  if (isElectricalPanelEntity(entity)) return entity.params.connectors ?? [];
  if (isMepSegmentEntity(entity)) return entity.params.connectors ?? [];
  return [];
}

/** True when an entity can carry MEP connectors (a connector host). */
export function isMepConnectorHost(entity: Entity): boolean {
  return (
    isMepFixtureEntity(entity) ||
    isElectricalPanelEntity(entity) ||
    isMepSegmentEntity(entity)
  );
}
