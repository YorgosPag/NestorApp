/**
 * ADR-434 — Stage 2: resolve the fuel-gas network SOURCE (the gas-meter outlet).
 *
 * Connector-driven (entity-agnostic): the gas meter rides the `mep-fixture` rails, so rather
 * than a bespoke `isMepGasMeterEntity` guard we scan EVERY entity for a fuel OUTLET
 * (`domain: 'fuel'`, `flow: 'out'`) whose classification matches the service (`fuel-gas`).
 * The first such outlet is the routing origin. This keeps the engine decoupled from how the
 * source is modelled (a future standalone gas-meter / gas-supply-riser entity drops in for
 * free as long as it exposes a fuel-gas outlet). A missing source is reported as a warning by
 * the orchestrator (honest pilot, mirroring HVAC).
 *
 * @see ../hvac/hvac-source-resolve.ts (the air analogue / template)
 */

import type { Point2D } from '../../../rendering/types/Types';
import type { Entity } from '../../../types/entities';
import type { FuelSystemClassification } from '../../../bim/types/mep-connector-types';
import { getEntityConnectors } from '../../../bim/mep-systems/connector-access';
import { resolveMepConnectorElevationMmAt } from '../../../bim/mep-segments/mep-connector-elevation';
import { resolveConnectorWorldPoint } from '../shared/connector-resolve';

/** A resolved fuel-gas routing origin (the gas-meter fuel outlet). */
export interface GasSource {
  readonly entityId: string;
  readonly connectorId: string;
  readonly classification: FuelSystemClassification;
  readonly point: Point2D;
  /** The outlet connector's WORLD elevation (mm) — the flat datum the gas lines run at. */
  readonly elevationMm: number;
}

/**
 * The first entity carrying a fuel OUTLET of `classification`, or `null`. Returns the outlet
 * connector id + its world point (the routing origin) + its mm elevation.
 */
export function resolveGasSource(
  entities: readonly Entity[],
  classification: FuelSystemClassification,
): GasSource | null {
  for (const entity of entities) {
    for (const c of getEntityConnectors(entity)) {
      if (c.domain !== 'fuel' || c.flow !== 'out') continue;
      if (c.fuel?.systemClassification !== classification) continue;
      const point = resolveConnectorWorldPoint(entity, c.connectorId);
      if (!point) continue;
      // The connector world plan point is exactly the (x,y) the elevation resolver snaps on →
      // it returns THIS outlet's mm elevation. Guard with isFinite (a host missing its mounting
      // datum would yield NaN, which must never reach a segment's z).
      const resolved = resolveMepConnectorElevationMmAt(entity, point.x, point.y);
      const elevationMm = resolved != null && Number.isFinite(resolved) ? resolved : 0;
      return { entityId: entity.id, connectorId: c.connectorId, classification, point, elevationMm };
    }
  }
  return null;
}
