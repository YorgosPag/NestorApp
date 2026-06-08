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
  isMepManifoldEntity,
  isMepRadiatorEntity,
  isMepBoilerEntity,
  isMepWaterHeaterEntity,
  isMepUnderfloorEntity,
} from '../../types/entities';
import type { MepConnector } from '../types/mep-connector-types';
import type { Point3D } from '../types/bim-base';

/** The connectors embedded in an entity's params, or `[]` when it has none. */
export function getEntityConnectors(entity: Entity): readonly MepConnector[] {
  if (isMepFixtureEntity(entity)) return entity.params.connectors ?? [];
  if (isElectricalPanelEntity(entity)) return entity.params.connectors ?? [];
  if (isMepSegmentEntity(entity)) return entity.params.connectors ?? [];
  if (isMepManifoldEntity(entity)) return entity.params.connectors ?? [];
  if (isMepRadiatorEntity(entity)) return entity.params.connectors ?? [];
  if (isMepBoilerEntity(entity)) return entity.params.connectors ?? [];
  if (isMepWaterHeaterEntity(entity)) return entity.params.connectors ?? [];
  if (isMepUnderfloorEntity(entity)) return entity.params.connectors ?? [];
  return [];
}

/** Identity host transform — area/segment hosts store connectors in world coords. */
const IDENTITY_HOST_TRANSFORM: { position: Point3D; rotation: number } = {
  position: { x: 0, y: 0, z: 0 },
  rotation: 0,
};

/**
 * The plan transform (host origin + CCW rotation, degrees) used to resolve a host's
 * connector world positions via {@link connectorWorldPosition}. SSoT so callers
 * (move-propagation, snap) never switch on entity kind. Point hosts (fixture / panel
 * / manifold / radiator / boiler / water-heater) expose `params.position` +
 * `params.rotation`; area/identity hosts (underfloor — its connectors are already in
 * world coords) resolve through the identity transform.
 */
export function getConnectorHostPlanTransform(
  entity: Entity,
): { position: Point3D; rotation: number } {
  if (
    isMepFixtureEntity(entity) ||
    isElectricalPanelEntity(entity) ||
    isMepManifoldEntity(entity) ||
    isMepRadiatorEntity(entity) ||
    isMepBoilerEntity(entity) ||
    isMepWaterHeaterEntity(entity)
  ) {
    return { position: entity.params.position, rotation: entity.params.rotation ?? 0 };
  }
  return IDENTITY_HOST_TRANSFORM;
}

/** True when an entity can carry MEP connectors (a connector host). */
export function isMepConnectorHost(entity: Entity): boolean {
  return (
    isMepFixtureEntity(entity) ||
    isElectricalPanelEntity(entity) ||
    isMepSegmentEntity(entity) ||
    isMepManifoldEntity(entity) ||
    isMepRadiatorEntity(entity) ||
    isMepBoilerEntity(entity) ||
    isMepWaterHeaterEntity(entity) ||
    isMepUnderfloorEntity(entity)
  );
}
