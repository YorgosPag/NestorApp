/**
 * ADR-428 — Stage 2: resolve the boiler endpoints that root the two heating networks.
 *
 * The boiler is BOTH source and sink of the closed loop: its `hydronic-supply` OUTLET roots
 * the supply network (radiate FROM it, like the water source) and its `hydronic-return`
 * INLET roots the return network (converge INTO it, like the drainage collector — but with
 * no slope). Stage 0 already recognized the boiler as a source; routing needs each tapping
 * connector's world point + id + elevation, which live on the scene entity.
 *
 * We scan the recognized hydronic source hosts (the boiler — the only equipment that
 * sources/sinks a heating loop at the pilot) for the connector matching the requested
 * (classification, flow). Auto-PLACING a boiler when none exists is a later slice — here a
 * missing endpoint is reported as a warning (honest pilot, mirroring water/drainage).
 *
 * @see ../water/water-source-resolve.ts (the pressurised source counterpart)
 * @see ../drainage/outfall-resolve.ts (the converge-to-root counterpart)
 */

import type { Point2D } from '../../../rendering/types/Types';
import type { Entity } from '../../../types/entities';
import { isMepBoilerEntity } from '../../../types/entities';
import type {
  MepFlowDirection,
  PlumbingSystemClassification,
} from '../../../bim/types/mep-connector-types';
import { getEntityConnectors } from '../../../bim/mep-systems/connector-access';
import { resolveMepConnectorElevationMmAt } from '../../../bim/mep-segments/mep-connector-elevation';
import { resolveConnectorWorldPoint } from '../shared/connector-resolve';
import { HEATING_ROLE_CLASSIFICATION, type HeatingNetworkRole } from './heating-design-types';

/** A resolved boiler endpoint rooting one heating network. */
export interface HeatingEndpoint {
  readonly role: HeatingNetworkRole;
  readonly entityId: string;
  readonly connectorId: string;
  readonly classification: PlumbingSystemClassification;
  readonly point: Point2D;
  /**
   * The tapping connector's WORLD elevation (mm) — the flat datum the whole network runs at
   * (Revit "Connect To"). From the SSoT `resolveMepConnectorElevationMmAt`, so units match
   * the segment z (mm).
   */
  readonly elevationMm: number;
}

/** True for the equipment that can source/sink a hydronic loop (the boiler, at pilot). */
function isHydronicSourceHost(entity: Entity): boolean {
  return isMepBoilerEntity(entity);
}

/**
 * The first boiler endpoint carrying a `(classification, flow)` pipe connector, or `null`.
 * Supply uses (`hydronic-supply`, `'out'`); return uses (`hydronic-return`, `'in'`).
 */
function resolveBoilerEndpoint(
  entities: readonly Entity[],
  role: HeatingNetworkRole,
  flow: MepFlowDirection,
): HeatingEndpoint | null {
  const classification = HEATING_ROLE_CLASSIFICATION[role];
  for (const entity of entities) {
    if (!isHydronicSourceHost(entity)) continue;
    for (const c of getEntityConnectors(entity)) {
      if (c.domain !== 'pipe' || c.flow !== flow) continue;
      if (c.pipe?.systemClassification !== classification) continue;
      const point = resolveConnectorWorldPoint(entity, c.connectorId);
      if (!point) continue;
      // The connector world plan point is exactly the (x,y) the elevation resolver snaps on
      // → it returns THIS tapping's mm elevation. Guard with `isFinite` (not just `??`): a
      // host missing its mounting datum would yield NaN, which must never reach a segment z.
      const resolved = resolveMepConnectorElevationMmAt(entity, point.x, point.y);
      const elevationMm = resolved != null && Number.isFinite(resolved) ? resolved : 0;
      return { role, entityId: entity.id, connectorId: c.connectorId, classification, point, elevationMm };
    }
  }
  return null;
}

/** The boiler `hydronic-supply` outlet — roots the supply network. */
export function resolveHeatingSupplySource(entities: readonly Entity[]): HeatingEndpoint | null {
  return resolveBoilerEndpoint(entities, 'supply', 'out');
}

/** The boiler `hydronic-return` inlet — roots the return network. */
export function resolveHeatingReturnSink(entities: readonly Entity[]): HeatingEndpoint | null {
  return resolveBoilerEndpoint(entities, 'return', 'in');
}
