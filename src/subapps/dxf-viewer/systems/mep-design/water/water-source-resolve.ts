/**
 * ADR-426 — Stage 2 (pilot): resolve the network SOURCE for a service.
 *
 * The Stage 0 model tells us a source EXISTS; routing needs the outlet connector's
 * world point + id, which live on the scene entity. We scan the recognized source
 * hosts (manifold / boiler) for an outlet (`flow:'out'`, pipe domain) whose
 * classification matches the service. Auto-PLACING a source when none exists is a
 * later slice — here a missing source is reported as a warning (honest pilot).
 */

import type { Point2D } from '../../../rendering/types/Types';
import type { Entity } from '../../../types/entities';
import { isMepManifoldEntity, isMepBoilerEntity, isMepWaterHeaterEntity } from '../../../types/entities';
import type { PlumbingSystemClassification } from '../../../bim/types/mep-connector-types';
import { getEntityConnectors } from '../../../bim/mep-systems/connector-access';
import { resolveMepConnectorElevationMmAt } from '../../../bim/mep-segments/mep-connector-elevation';
import { resolveConnectorWorldPoint } from './connector-resolve';

/** A resolved routing origin for one service. */
export interface WaterSource {
  readonly entityId: string;
  readonly connectorId: string;
  readonly classification: PlumbingSystemClassification;
  readonly point: Point2D;
  /**
   * The outlet connector's WORLD elevation (mm) — the datum the whole network runs
   * at (ADR-426 Slice 2). Routed flat at the source height, exactly like the manual
   * pipe tool inheriting a snapped connector's elevation (Revit "Connect To"). From
   * the SSoT `resolveMepConnectorElevationMmAt`, so units match the segment z (mm).
   */
  readonly elevationMm: number;
}

/** True for the point hosts that can originate a pipe network (manifold/boiler/water-heater). */
function isWaterSourceHost(entity: Entity): boolean {
  return isMepManifoldEntity(entity) || isMepBoilerEntity(entity) || isMepWaterHeaterEntity(entity);
}

/**
 * The first source host carrying an outlet of `classification`, or `null`. Returns
 * the outlet connector id + its world point (the routing origin).
 */
export function resolveWaterSource(
  entities: readonly Entity[],
  classification: PlumbingSystemClassification,
): WaterSource | null {
  for (const entity of entities) {
    if (!isWaterSourceHost(entity)) continue;
    for (const c of getEntityConnectors(entity)) {
      if (c.domain !== 'pipe' || c.flow !== 'out') continue;
      if (c.pipe?.systemClassification !== classification) continue;
      const point = resolveConnectorWorldPoint(entity, c.connectorId);
      if (point) {
        // The connector world plan point is exactly the (x,y) the elevation resolver
        // snaps on → it returns THIS outlet's mm elevation (mounting datum + local z).
        // Guard with `isFinite` (not just `??`): a host missing its mounting datum
        // would yield NaN, which must never reach a segment's z.
        const resolved = resolveMepConnectorElevationMmAt(entity, point.x, point.y);
        const elevationMm = resolved != null && Number.isFinite(resolved) ? resolved : 0;
        return { entityId: entity.id, connectorId: c.connectorId, classification, point, elevationMm };
      }
    }
  }
  return null;
}
