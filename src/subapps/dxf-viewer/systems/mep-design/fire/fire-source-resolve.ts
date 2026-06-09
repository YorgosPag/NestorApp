/**
 * ADR-433 — Stage 2: resolve the wet-pipe network SOURCE (the fire-riser outlet).
 *
 * Connector-driven (entity-agnostic): the fire riser rides the `mep-fixture` rails, so
 * rather than a bespoke `isMepFireRiserEntity` guard we scan EVERY entity for a pipe OUTLET
 * (`domain: 'pipe'`, `flow: 'out'`) whose classification matches the service
 * (`fire-sprinkler`). The first such outlet is the routing origin. This keeps the engine
 * decoupled from how the source is modelled (a future standalone fire-pump / standpipe
 * entity drops in for free as long as it exposes a fire-sprinkler pipe outlet). A missing
 * source is reported as a warning by the orchestrator (honest pilot, mirroring water/HVAC).
 *
 * The `fire-sprinkler` classification guard keeps non-fire pipe outlets (e.g. a boiler's
 * hydronic-supply outlet) out — only the riser sources this network. Mirror of
 * `hvac-source-resolve.ts` (connector-driven) on the `'pipe'` domain.
 *
 * @see ../water/water-source-resolve.ts · ../hvac/hvac-source-resolve.ts (templates)
 */

import type { Point2D } from '../../../rendering/types/Types';
import type { Entity } from '../../../types/entities';
import type { PlumbingSystemClassification } from '../../../bim/types/mep-connector-types';
import { getEntityConnectors } from '../../../bim/mep-systems/connector-access';
import { resolveMepConnectorElevationMmAt } from '../../../bim/mep-segments/mep-connector-elevation';
import { resolveConnectorWorldPoint } from '../shared/connector-resolve';

/** A resolved fire-sprinkler routing origin (the fire-riser pipe outlet). */
export interface FireSource {
  readonly entityId: string;
  readonly connectorId: string;
  readonly classification: PlumbingSystemClassification;
  readonly point: Point2D;
  /** The outlet connector's WORLD elevation (mm) — the flat datum the wet pipes run at. */
  readonly elevationMm: number;
}

/**
 * The first entity carrying a pipe OUTLET of `classification`, or `null`. Returns the outlet
 * connector id + its world point (the routing origin) + its mm elevation.
 */
export function resolveFireSource(
  entities: readonly Entity[],
  classification: PlumbingSystemClassification,
): FireSource | null {
  for (const entity of entities) {
    for (const c of getEntityConnectors(entity)) {
      if (c.domain !== 'pipe' || c.flow !== 'out') continue;
      if (c.pipe?.systemClassification !== classification) continue;
      const point = resolveConnectorWorldPoint(entity, c.connectorId);
      if (!point) continue;
      // The connector world plan point is exactly the (x,y) the elevation resolver snaps on
      // → it returns THIS outlet's mm elevation. Guard with isFinite (a host missing its
      // mounting datum would yield NaN, which must never reach a segment's z).
      const resolved = resolveMepConnectorElevationMmAt(entity, point.x, point.y);
      const elevationMm = resolved != null && Number.isFinite(resolved) ? resolved : 0;
      return { entityId: entity.id, connectorId: c.connectorId, classification, point, elevationMm };
    }
  }
  return null;
}
