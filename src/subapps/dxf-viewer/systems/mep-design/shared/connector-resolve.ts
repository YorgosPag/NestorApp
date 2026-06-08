/**
 * ADR-423 — shared MEP-design helper: resolve a host connector's WORLD point.
 *
 * Reuses the SSoT `connectorWorldPosition` (point-host transform) + `getEntityConnectors`
 * accessor — zero new geometry. The host plan transform (origin + rotation) comes from the
 * canonical `getConnectorHostPlanTransform` SSoT (ADR-408 Φ-C): point hosts (fixture /
 * panel / manifold / radiator / boiler / water-heater) expose `position`+`rotation`, while
 * area/identity hosts (underfloor — connectors already in world coords) resolve through the
 * identity transform. Every discipline's demand + source/outfall resolution reuses this
 * (ADR-426 water, ADR-427 drainage, ADR-428 heating — the latter is what brought the
 * radiator/underfloor hosts in).
 *
 * @see ../../../bim/types/mep-connector-types.ts (connectorWorldPosition)
 * @see ../../../bim/mep-systems/connector-access.ts (getEntityConnectors, getConnectorHostPlanTransform)
 */

import type { Point2D } from '../../../rendering/types/Types';
import type { Entity } from '../../../types/entities';
import { connectorWorldPosition } from '../../../bim/types/mep-connector-types';
import {
  getEntityConnectors,
  getConnectorHostPlanTransform,
} from '../../../bim/mep-systems/connector-access';

/** World XY of a host connector (by id), or `null` if the connector is missing. */
export function resolveConnectorWorldPoint(
  entity: Entity,
  connectorId: string,
): Point2D | null {
  const connector = getEntityConnectors(entity).find((c) => c.connectorId === connectorId);
  if (!connector) return null;
  const { position, rotation } = getConnectorHostPlanTransform(entity);
  const world = connectorWorldPosition(connector, position, rotation);
  return { x: world.x, y: world.y };
}
