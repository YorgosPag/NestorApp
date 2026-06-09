/**
 * ADR-432 — Stage 2: resolve the supply-air network SOURCE (the AHU outlet).
 *
 * Connector-driven (entity-agnostic): the AHU rides the `mep-fixture` rails, so rather
 * than a bespoke `isMepAhuEntity` guard we scan EVERY entity for a duct OUTLET
 * (`domain: 'duct'`, `flow: 'out'`) whose classification matches the service
 * (`supply-air`). The first such outlet is the routing origin. This keeps the engine
 * decoupled from how the source is modelled (a future standalone AHU entity drops in for
 * free as long as it exposes a supply-air duct outlet). A missing source is reported as a
 * warning by the orchestrator (honest pilot, mirroring water/heating).
 *
 * @see ../water/water-source-resolve.ts (the pipe analogue / template)
 */

import type { Point2D } from '../../../rendering/types/Types';
import type { Entity } from '../../../types/entities';
import type { DuctSystemClassification } from '../../../bim/types/mep-connector-types';
import { getEntityConnectors } from '../../../bim/mep-systems/connector-access';
import { resolveMepConnectorElevationMmAt } from '../../../bim/mep-segments/mep-connector-elevation';
import { resolveConnectorWorldPoint } from '../shared/connector-resolve';

/** A resolved supply-air routing origin (the AHU duct outlet). */
export interface HvacSource {
  readonly entityId: string;
  readonly connectorId: string;
  readonly classification: DuctSystemClassification;
  readonly point: Point2D;
  /** The outlet connector's WORLD elevation (mm) — the flat plenum datum the ducts run at. */
  readonly elevationMm: number;
}

/**
 * The first entity carrying a duct OUTLET of `classification`, or `null`. Returns the
 * outlet connector id + its world point (the routing origin) + its mm elevation.
 */
export function resolveHvacSource(
  entities: readonly Entity[],
  classification: DuctSystemClassification,
): HvacSource | null {
  for (const entity of entities) {
    for (const c of getEntityConnectors(entity)) {
      if (c.domain !== 'duct' || c.flow !== 'out') continue;
      if (c.duct?.systemClassification !== classification) continue;
      const point = resolveConnectorWorldPoint(entity, c.connectorId);
      if (!point) continue;
      // The connector world plan point is exactly the (x,y) the elevation resolver snaps
      // on → it returns THIS outlet's mm elevation. Guard with isFinite (a host missing
      // its mounting datum would yield NaN, which must never reach a segment's z).
      const resolved = resolveMepConnectorElevationMmAt(entity, point.x, point.y);
      const elevationMm = resolved != null && Number.isFinite(resolved) ? resolved : 0;
      return { entityId: entity.id, connectorId: c.connectorId, classification, point, elevationMm };
    }
  }
  return null;
}
