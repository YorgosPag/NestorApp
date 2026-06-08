/**
 * ADR-423 — shared MEP-design helper: resolve a host connector's WORLD point.
 *
 * Reuses the SSoT `connectorWorldPosition` (point-host transform) + `getEntityConnectors`
 * accessor — zero new geometry. Point hosts (fixture / manifold / boiler / water-heater)
 * carry `position` + `rotation` in their params; segments use a different SSoT and are not
 * routing endpoints here, so they are intentionally not handled. Every discipline's demand
 * + source/outfall resolution reuses this (ADR-426 water, ADR-427 drainage).
 *
 * @see ../../../bim/types/mep-connector-types.ts (connectorWorldPosition)
 * @see ../../../bim/mep-systems/connector-access.ts (getEntityConnectors)
 */

import type { Point2D } from '../../../rendering/types/Types';
import type { Point3D } from '../../../bim/types/bim-base';
import type { Entity } from '../../../types/entities';
import {
  isMepFixtureEntity,
  isMepManifoldEntity,
  isMepBoilerEntity,
  isMepWaterHeaterEntity,
} from '../../../types/entities';
import { connectorWorldPosition } from '../../../bim/types/mep-connector-types';
import { getEntityConnectors } from '../../../bim/mep-systems/connector-access';

/** Position + rotation of a point-host entity, or `null` if not a supported host. */
function hostTransform(entity: Entity): { position: Point3D; rotation: number } | null {
  if (isMepFixtureEntity(entity)) return entity.params;
  if (isMepManifoldEntity(entity)) return entity.params;
  if (isMepBoilerEntity(entity)) return entity.params;
  if (isMepWaterHeaterEntity(entity)) return entity.params;
  return null;
}

/** World XY of a host connector (by id), or `null` if host/connector missing. */
export function resolveConnectorWorldPoint(
  entity: Entity,
  connectorId: string,
): Point2D | null {
  const transform = hostTransform(entity);
  if (!transform) return null;
  const connector = getEntityConnectors(entity).find((c) => c.connectorId === connectorId);
  if (!connector) return null;
  const world = connectorWorldPosition(connector, transform.position, transform.rotation);
  return { x: world.x, y: world.y };
}
